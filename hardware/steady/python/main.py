"""Clarah Steady: the Linux side of the UNO Q.

Receives accelerometer samples and events from the microcontroller sketch, scores
balance while the wearer walks, watches the trend, raises warnings, sends alerts
(ntfy push notifications) and serves the dashboard on port 7000.
"""

from __future__ import annotations

import json
import os
import secrets
import threading
import time
import urllib.parse
import urllib.request
from collections import deque
from datetime import datetime, timedelta, timezone

import numpy as np

from arduino.app_utils import App, Bridge, Logger
from arduino.app_bricks.web_ui import WebUI

import gait
import spot
import prosthetic
import sync

log = Logger("steady")

DATA_DIR = os.environ.get("STEADY_DATA", "/app/data")
os.makedirs(DATA_DIR, exist_ok=True)
SETTINGS_PATH = os.path.join(DATA_DIR, "settings.json")
HISTORY_PATH = os.path.join(DATA_DIR, "history.jsonl")
EVENTS_PATH = os.path.join(DATA_DIR, "events.jsonl")
PROSTHETIC_PATH = os.path.join(DATA_DIR, "prosthetic.jsonl")

COUNTS_PER_G = 21.33
WARN_COOLDOWN_S = 15 * 60
DOCTOR_COOLDOWN_S = 60 * 60

lock = threading.RLock()

# ---------------------------------------------------------------- persistence

DEFAULT_SETTINGS = {
    "patient_name": "",
    "countdown_s": 30,
    "harsh_countdown_s": 10,
    "mode": "fall_prevention",
    "device_id": "uno-q",
    "clarah_url": "https://www.clarah.health",
    "share_with_doctor": False,  # opt-in: the doctor only hears about balance if the patient asks
    "doctor_name": "",
    "doctor_phone": "",
    "doctor_topic": "",
    "contact_name": "",
    "contact_phone": "",
    "contact_topic": "",
    "alert_contact": True,
    "baseline": None,
    "clock_offset": 0.0,
    "tz_offset_min": 0,  # minutes east of UTC, from the dashboard's browser
}


def load_settings() -> dict:
    s = dict(DEFAULT_SETTINGS)
    try:
        with open(SETTINGS_PATH) as f:
            s.update(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    if not s["contact_topic"]:
        s["contact_topic"] = "clarah-steady-" + secrets.token_hex(5)
    if not s["doctor_topic"]:
        s["doctor_topic"] = "clarah-care-" + secrets.token_hex(5)
    return s


def save_settings():
    tmp = SETTINGS_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(settings, f, indent=2)
        f.flush()
        os.fsync(f.fileno())  # survive the board losing power
    os.replace(tmp, SETTINGS_PATH)


def read_jsonl(path: str, limit: int | None = None) -> list[dict]:
    try:
        with open(path) as f:
            lines = f.readlines()
    except FileNotFoundError:
        return []
    if limit:
        lines = lines[-limit:]
    out = []
    for line in lines:
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return out


def append_jsonl(path: str, item: dict):
    with open(path, "a") as f:
        f.write(json.dumps(item) + "\n")
        f.flush()
        os.fsync(f.fileno())


settings = load_settings()
# Offline the board boots with a stale clock (Dec 2025) and the dashboard corrects it.
# Once Wi-Fi has set the real time, a saved correction would push everything ahead.
CLOCK_PLAUSIBLE = 1_790_000_000  # Sep 2026
if time.time() > CLOCK_PLAUSIBLE:
    settings["clock_offset"] = 0.0
save_settings()


def now() -> float:
    """Wall-clock time. The board has no network clock, so the dashboard corrects it."""
    return time.time() + settings.get("clock_offset", 0.0)


# ---------------------------------------------------------------- live state

samples: deque = deque(maxlen=int(gait.FS * 60))  # (t, x, y, z) in g
history: list[dict] = read_jsonl(HISTORY_PATH)
events: list[dict] = read_jsonl(EVENTS_PATH, limit=300)
prosthetic_minutes: list[dict] = read_jsonl(PROSTHETIC_PATH)
outbox: list[dict] = []

device = {"state": "unknown", "last_seen": 0.0, "sensor": "unknown", "last_imu": 0.0}
balance = {"score": None, "smoothed": None, "risk": "unknown", "slope": None, "projected": None,
           "walking": False, "last_window": None, "baseline": settings.get("baseline")}
last_warn_at = {"moderate": 0.0, "high": 0.0}
last_doctor_at = 0.0
active_alert: dict | None = None  # the fall / help episode in progress
emergency = {"active": False, "reason": None, "since": None, "simulated_911": False, "simulated_911_at": None}
sync_status = {"state": "no_token" if not os.environ.get("STEADY_INGEST_TOKEN") else "pending", "at": None, "error": None}
sync_requested = threading.Event()
last_seq = None
dropped = 0

ui = WebUI()


def cmd(c: str):
    try:
        Bridge.notify("fg_cmd", c)
    except Exception as e:  # router not connected yet
        log.warning(f"fg_cmd {c} failed: {e}")


# ---------------------------------------------------------------- notifications


def notify(audience: str, title: str, message: str, priority: str = "high", tags: str = "warning"):
    """Queue a push notification for 'contact' or 'doctor' and try to send it now."""
    topic = settings.get(f"{audience}_topic", "")
    if not topic:
        return
    item = {"id": secrets.token_hex(6), "t": now(), "audience": audience, "topic": topic, "title": title,
            "message": message, "priority": priority, "tags": tags, "status": "pending"}
    with lock:
        outbox.append(item)
        del outbox[:-50]
    threading.Thread(target=_deliver, args=(item,), daemon=True).start()


def ntfy_url(item: dict) -> str:
    q = urllib.parse.urlencode({"title": item["title"], "priority": item["priority"], "tags": item["tags"]})
    return f"https://ntfy.sh/{urllib.parse.quote(item['topic'])}?{q}"


net = {"ok": None, "checked": 0.0}


def _deliver(item: dict):
    # The board is often offline (no Wi-Fi). An open dashboard relays alerts instead.
    # After a failure, skip straight to the dashboard for a while: a failed DNS lookup
    # alone takes ~10 s, too long to wait in an emergency.
    if net["ok"] is False and time.time() - net["checked"] < 300:
        item["status"] = "relay"
        push_outbox()
        return
    try:
        req = urllib.request.Request(ntfy_url(item), data=item["message"].encode(), method="POST")
        urllib.request.urlopen(req, timeout=6).read()
        item["status"] = "sent"
        item["via"] = "board"
        net["ok"] = True
    except Exception as e:
        log.info(f"board could not send notification ({e}); asking dashboard to relay")
        item["status"] = "relay"
        net["ok"] = False
    net["checked"] = time.time()
    push_outbox()


def push_outbox():
    with lock:
        ui.send_message("outbox", {"items": outbox[-20:], "urls": {i["id"]: ntfy_url(i) for i in outbox[-20:]}})


def on_relayed(sid, data=None):
    data = data or {}
    with lock:
        for item in outbox:
            if item["id"] == data.get("id") and item["status"] != "sent":
                item["status"] = "sent" if data.get("ok") else "failed"
                item["via"] = "dashboard"
    push_outbox()


# ---------------------------------------------------------------- events


def add_event(kind: str, detail: str = "", **extra) -> dict:
    ev = {"t": now(), "kind": kind, "detail": detail, **extra}
    with lock:
        events.append(ev)
        del events[:-300]
        append_jsonl(EVENTS_PATH, ev)
    ui.send_message("event", ev)
    return ev


def recent_trace(seconds: float) -> list[float]:
    """Acceleration magnitude for the last few seconds, for the event chart."""
    with lock:
        pts = list(samples)[-int(seconds * gait.FS):]
    return [round(float(np.sqrt(x * x + y * y + z * z)), 2) for _, x, y, z in pts]


def who() -> str:
    return settings.get("patient_name") or "Your family member"


def local_dt(t: float) -> datetime:
    """The container runs on UTC; show times in the wearer's time zone."""
    return datetime.fromtimestamp(t, timezone.utc) + timedelta(minutes=settings.get("tz_offset_min", 0))


def clock_str(t: float) -> str:
    return local_dt(t).strftime("%-I:%M %p")


def on_mcu_event(name: str, detail: str):
    global active_alert
    log.info(f"event {name} {detail}")
    if name == "fall_suspected":
        add_event(name, detail)
        threading.Timer(3.0, lambda: _attach_trace()).start()
    elif name == "fall_detected":
        harsh = "harsh" in detail.split()
        active_alert = {"kind": "harsh_fall" if harsh else "fall", "t": now(), "detail": detail,
                        "countdown_s": settings["harsh_countdown_s"] if harsh else settings["countdown_s"]}
        add_event(name, detail)
    elif name in ("fall_dismissed", "fall_cancelled", "help_cancelled", "silenced", "sensor_ok", "sensor_missing"):
        if name in ("fall_cancelled", "help_cancelled"):
            active_alert = None
        if name.startswith("sensor"):
            device["sensor"] = "ok" if name == "sensor_ok" else "missing"
        add_event(name, detail)
    elif name == "help_pressed":
        active_alert = {"kind": "help", "t": now(), "detail": detail, "countdown_s": 5}
        add_event(name, detail)
    elif name == "emergency":
        reason = detail or "help"
        active_alert = {**(active_alert or {}), "kind": reason, "t": now(), "emergency": True}
        add_event("emergency", reason)
        emergency.update({"active": True, "reason": reason, "since": now(),
                          "simulated_911": reason == "harsh_fall", "simulated_911_at": now() if reason == "harsh_fall" else None})
        if reason == "harsh_fall":
            add_event("simulated_911", "SIMULATION: no real call was placed")
        if settings.get("alert_contact", True):
            if reason in ("fall", "harsh_fall"):
                notify("contact", f"{who()} may have fallen",
                       f"Clarah Steady detected a {'hard ' if reason == 'harsh_fall' else ''}fall at {clock_str(now())} and got no response for "
                       f"{settings['harsh_countdown_s'] if reason == 'harsh_fall' else settings['countdown_s']} seconds."
                       + (" (simulated 911 call placed)" if reason == "harsh_fall" else "")
                       + " Call them now. If you can't reach them, call 911.",
                       priority="urgent", tags="rotating_light")
            else:
                notify("contact", f"{who()} pressed the help button",
                       f"Help was requested from Clarah Steady at {clock_str(now())}. Call them now. "
                       f"If you can't reach them, call 911.", priority="urgent", tags="sos")
    elif name == "resolved":
        if active_alert and active_alert.get("emergency") and settings.get("alert_contact", True):
            notify("contact", f"{who()} is OK", f"The alert from {clock_str(active_alert['t'])} was marked resolved.",
                   priority="default", tags="white_check_mark")
        active_alert = None
        emergency.update({"active": False, "reason": None, "since": None, "simulated_911": False, "simulated_911_at": None})
        add_event(name, detail)
    else:
        add_event(name, detail)
    push_status()
    if name in ("fall_detected", "fall_cancelled", "help_pressed", "help_cancelled", "emergency", "resolved"):
        sync_requested.set()


def _attach_trace():
    trace = recent_trace(6)
    with lock:
        for ev in reversed(events):
            if ev["kind"] == "fall_suspected":
                ev["trace"] = trace
                break
    ui.send_message("trace", {"trace": trace})


def on_mcu_state(state: str):
    prev = device["state"]
    device["state"] = state
    device["last_seen"] = time.time()
    if prev != state:
        push_status()
        if state in ("fall_check", "fall_countdown", "help_countdown", "emergency", "normal"):
            sync_requested.set()


def on_imu(seq: int, data: str):
    global last_seq, dropped
    t_end = now()
    n = len(data) // 3
    with lock:
        if last_seq is not None and seq != (last_seq + 1) % 2**31:
            dropped += 1
        last_seq = seq
        mags = []
        for i in range(n):
            x, y, z = ((ord(data[i * 3 + k]) - 64) / COUNTS_PER_G for k in range(3))
            samples.append((t_end - (n - 1 - i) / gait.FS, x, y, z))
            mags.append(round((x * x + y * y + z * z) ** 0.5, 2))
    device["last_imu"] = time.time()
    device["last_seen"] = time.time()
    device["sensor"] = "ok"
    ui.send_message("imu", {"m": mags})


# ---------------------------------------------------------------- balance analysis


def recompute_trend():
    """Update smoothed score, baseline, slope and risk from the stored history."""
    walk = [h for h in history if h.get("walking") and h.get("mode", "fall_prevention") == settings["mode"]]
    if not walk:
        balance.update({"score": None, "smoothed": None, "baseline": None, "slope": None,
                        "projected": None, "risk": "unknown", "last_window": None})
        return
    recent = [h for h in walk if h["t"] > now() - 30 * 60][-36:]
    alpha = 0.3
    smoothed = None
    for h in (recent or walk[-12:]):
        smoothed = h["score"] if smoothed is None else alpha * h["score"] + (1 - alpha) * smoothed
    baseline = settings.get("baseline")
    if baseline is None and len(walk) >= 12:
        # Your usual steadiness: the upper-middle of your last dozen windows. Skip
        # it while those look unsteady (e.g. the sensor being handled while set up),
        # so a bad start doesn't become the yardstick.
        candidate = float(np.percentile([h["score"] for h in walk[-12:]], 75))
        if candidate >= 70:
            settings["baseline"] = round(candidate, 1)
            save_settings()
    slope = gait.trend([(h["t"], h["score"]) for h in recent])
    balance.update({
        "score": walk[-1]["score"],
        "last_window": walk[-1],
        "smoothed": round(smoothed, 1),
        "baseline": settings.get("baseline"),
        "slope": None if slope is None else round(slope, 2),
        "projected": None if slope is None else round(max(0, min(100, smoothed + slope * 10)), 1),
        "risk": gait.risk_level(smoothed, settings.get("baseline"), slope),
    })


def check_risk(prev_risk: str):
    global last_warn_at, last_doctor_at
    risk = balance["risk"]
    order = {"unknown": 0, "low": 0, "moderate": 1, "high": 2}
    t = now()
    # Warn on every step up (moderate, then high), but repeat a level at most every 15 min.
    if order[risk] > order.get(prev_risk, 0) and order[risk] >= 1 and t - last_warn_at[risk] > WARN_COOLDOWN_S:
        last_warn_at[risk] = t
        cmd("warn")
        advice = " If you feel your walking is getting worse, call your doctor."
        msg = ("Your steadiness has dropped a lot. Please slow down, hold on to something or sit and rest."
               if risk == "high" else "Your walking is getting less steady. Take it slow.") + advice
        add_event("balance_warning", msg, risk=risk, score=balance["smoothed"], slope=balance["slope"])
    if risk == "high" and settings.get("share_with_doctor") and t - last_doctor_at > DOCTOR_COOLDOWN_S:
        last_doctor_at = t
        w = balance.get("last_window") or {}
        base = settings.get("baseline")
        notify(
            "doctor",
            f"Balance alert: {settings.get('patient_name') or 'your patient'}",
            f"Clarah Steady balance score {balance['smoothed']:.0f}/100"
            + (f" (baseline {base:.0f})" if base is not None else "")
            + (f", trending {balance['slope']:+.1f} points per minute of walking" if balance["slope"] is not None else "")
            + f". Trunk sway {w.get('sway') or 0:.0f} degrees, jolt {w.get('jolt') or 0:.2f} g"
            + (f", cadence {w['cadence']:.0f} steps/min" if w.get("cadence") else "")
            + ". If you feel your walking is getting worse, call your doctor. Sent at the patient's request.",
            priority="high", tags="chart_with_downwards_trend",
        )
        add_event("doctor_alerted", f"Shared balance trend with {settings.get('doctor_name') or 'the doctor'}")


# The latest spot-check alert (one really unsteady 10 s window), sent to Clarah for a pop-up.
instability: dict | None = None
last_spot = {"checked": 0.0, "alerted": 0.0}


def spot_check_window(score: float):
    """Every 10 s, compare the last 10 s of walking with the wearer's usual score."""
    global instability
    t = now()
    if t - last_spot["checked"] < spot.SPOT_EVERY_S:
        return
    last_spot["checked"] = t
    usual = settings.get("baseline") or balance.get("smoothed")
    alert = spot.spot_check(score, usual)
    if not alert or t - last_spot["alerted"] < spot.SPOT_COOLDOWN_S:
        return
    last_spot["alerted"] = t
    instability = {**alert, "t": t}
    cmd("warn")
    add_event("instability", alert["message"], score=alert["score"], usual=alert["usual"])
    sync_requested.set()  # tell Clarah now, not at the next scheduled sync


def analysis_loop():
    while True:
        time.sleep(gait.HOP_S)
        try:
            with lock:
                pts = list(samples)
            if len(pts) < gait.FS * gait.WINDOW_S * 0.9 or device["state"] not in ("normal", "unknown"):
                continue
            if time.time() - device["last_imu"] > 2:
                continue
            arr = np.array([p[1:] for p in pts[-int(gait.FS * gait.WINDOW_S):]])
            w = gait.analyze_window(arr, now())
            balance["walking"] = w.walking
            prev_risk = balance["risk"]
            if w.walking:
                d = w.to_dict()
                d["mode"] = settings["mode"]
                balance["score"] = round(w.score, 1)
                balance["last_window"] = d
                with lock:
                    history.append(d)
                    append_jsonl(HISTORY_PATH, d)
                recompute_trend()
                spot_check_window(w.score)
                if settings["mode"] == "fall_prevention":
                    check_risk(prev_risk)
                cmd(f"score={int(balance['smoothed'])},{balance['risk'][0]}")
            push_balance()
        except Exception as e:
            log.exception(f"analysis failed: {e}")


def prosthetic_loop():
    """Persist one non-overlapping movement estimate per minute in prosthetic mode."""
    while True:
        time.sleep(60)
        if settings["mode"] != "prosthetic" or device["state"] != "normal" or time.time() - device["last_imu"] > 3:
            continue
        with lock:
            pts = list(samples)[-int(gait.FS * 60):]
        if len(pts) < gait.FS * 50:
            continue
        arr = np.array([p[1:] for p in pts])
        walking = any(h.get("walking") and h.get("mode") == "prosthetic" and h["t"] >= now() - 60
                      for h in history[-20:])
        m = {"t": now(), **prosthetic.minute_features(arr, walking)}
        if any(e["kind"] == "fall_detected" and e["t"] >= m["t"] - 60 for e in events[-20:]):
            m["stumbles"] = 0
        with lock:
            prosthetic_minutes.append(m)
            append_jsonl(PROSTHETIC_PATH, m)
        if m["stumbles"]:
            add_event("stumble", f"{m['stumbles']} sharp jolt(s) while walking")
        push_balance()


# ---------------------------------------------------------------- dashboard messages


def daily_summary(days: int = 14) -> list[dict]:
    by_day: dict[str, list[float]] = {}
    for h in history:
        if h.get("walking") and h.get("mode", "fall_prevention") == settings["mode"]:
            day = local_dt(h["t"]).strftime("%Y-%m-%d")
            by_day.setdefault(day, []).append(h["score"])
    out = [{"day": d, "score": round(float(np.median(v)), 1), "windows": len(v)} for d, v in sorted(by_day.items())]
    return out[-days:]


def balance_payload() -> dict:
    walk = [h for h in history if h.get("walking") and h.get("mode", "fall_prevention") == settings["mode"] and h["t"] > now() - 3 * 3600][-120:]
    return {**balance, "recent": walk, "daily": daily_summary(), "mode": settings["mode"], "prosthetic": prosthetic_payload()}


def prosthetic_payload():
    if settings["mode"] != "prosthetic":
        return None
    return prosthetic.summarize(prosthetic_minutes, history, now(), settings.get("tz_offset_min", 0))


def push_balance():
    ui.send_message("balance", balance_payload())


def status_payload() -> dict:
    online = time.time() - device["last_seen"] < 3
    # The board only reports sensor changes; if it's talking but no samples arrive,
    # the accelerometer is unplugged or on the wrong port.
    sensor = "missing" if online and time.time() - device["last_imu"] > 3 else device["sensor"]
    return {
        "device": {**device, "sensor": sensor, "online": online, "dropped": dropped},
        "alert": active_alert,
        "now": now(),
        "emergency": dict(emergency),
        "sync": dict(sync_status),
    }


def push_status():
    ui.send_message("status", status_payload())


def public_settings() -> dict:
    return {k: v for k, v in settings.items() if k not in ("clock_offset", "tz_offset_min")}


def on_hello(sid, data=None):
    client_ms = (data or {}).get("now")
    if client_ms and time.time() < CLOCK_PLAUSIBLE:
        offset = client_ms / 1000 - time.time()
        if abs(offset - settings.get("clock_offset", 0.0)) > 30:
            settings["clock_offset"] = offset
            save_settings()
            log.info(f"clock corrected by {offset:.0f}s from dashboard")
    tz = (data or {}).get("tz_offset_min")
    if isinstance(tz, (int, float)) and tz != settings.get("tz_offset_min"):
        settings["tz_offset_min"] = int(tz)
        save_settings()
    ui.send_message("settings", public_settings(), sid)
    ui.send_message("status", status_payload(), sid)
    ui.send_message("balance", balance_payload(), sid)
    with lock:
        ui.send_message("events", {"items": events[-60:]}, sid)
    push_outbox()


def on_save_settings(sid, data=None):
    allowed = set(DEFAULT_SETTINGS) - {"baseline", "clock_offset", "tz_offset_min"}
    for k, v in (data or {}).items():
        if k in allowed:
            settings[k] = v
    try:
        settings["countdown_s"] = max(10, min(120, int(settings["countdown_s"])))
    except (TypeError, ValueError):
        settings["countdown_s"] = 30
    try:
        settings["harsh_countdown_s"] = max(5, min(30, int(settings["harsh_countdown_s"])))
    except (TypeError, ValueError):
        settings["harsh_countdown_s"] = 10
    if settings["mode"] not in ("fall_prevention", "prosthetic"):
        settings["mode"] = "fall_prevention"
    settings["clarah_url"] = str(settings["clarah_url"]).rstrip("/")
    save_settings()
    cmd(f"countdown={settings['countdown_s']}")
    cmd(f"harsh_countdown={settings['harsh_countdown_s']}")
    recompute_trend()
    add_event("settings_saved", "Doctor sharing " + ("on" if settings["share_with_doctor"] else "off"))
    ui.send_message("settings", public_settings())
    push_balance()
    sync_requested.set()


def on_set_baseline(sid, data=None):
    s = balance.get("smoothed")
    settings["baseline"] = s
    save_settings()
    balance["baseline"] = s
    recompute_trend()
    add_event("baseline_set", "Baseline cleared" if s is None else f"Baseline set to {s:.0f}")
    push_balance()


def on_test_alert(sid, data=None):
    audience = (data or {}).get("audience", "contact")
    notify(audience, "Clarah Steady test", f"This is a test alert for {who()}. Alerts will arrive here.",
           priority="default", tags="bell")


def on_seed_demo(sid, data=None):
    """Sample history: two weeks of walking with balance slipping in the last few days."""
    rng = np.random.default_rng(3)
    base_t = now()
    if settings["mode"] == "prosthetic":
        with lock:
            for day in range(13, -1, -1):
                t = base_t - day * 86400
                walk_min = 15 + (13 - day) * 4
                wear_min = 125 + (13 - day) * 16
                for minute in range(wear_min):
                    m = {"t": t - (t % 86400) + 9 * 3600 + minute * 60,
                         "worn": True, "walking": minute < walk_min,
                         "stumbles": 1 if minute == 4 and day > 9 else 0}
                    prosthetic_minutes.append(m)
                    append_jsonl(PROSTHETIC_PATH, m)
                for k in range(walk_min // 5):
                    d = {"t": t - (t % 86400) + 9 * 3600 + k * 300, "walking": True,
                         "score": round(55 + (13 - day) * 2.1 + rng.normal(0, 2), 1),
                         "mode": "prosthetic", "sample": True}
                    history.append(d)
                    append_jsonl(HISTORY_PATH, d)
            history.sort(key=lambda h: h["t"])
            prosthetic_minutes.sort(key=lambda m: m["t"])
        add_event("sample_data", "Loaded two weeks of prosthetic sample data")
        recompute_trend()
        push_balance()
        sync_requested.set()
        return
    with lock:
        for day in range(14, 0, -1):
            level = 84 - max(0, 6 - day) * 4.5  # steady, then slipping over the last 5 days
            for k in range(30):
                t = base_t - day * 86400 + 9 * 3600 + k * 60
                sc = float(np.clip(level + rng.normal(0, 4), 0, 100))
                d = {"t": t, "walking": True, "score": round(sc, 1), "cadence": round(100 - (84 - level) * 0.5, 1),
                     "regularity": round(0.85 - (84 - level) / 120, 3),
                     "sway": round(4 + (84 - level) / 2, 1), "jolt": round(0.15 + (84 - level) / 90, 3), "sample": True}
                history.append(d)
                append_jsonl(HISTORY_PATH, d)
        history.sort(key=lambda h: h["t"])
    if settings.get("baseline") is None:
        settings["baseline"] = 84.0
        save_settings()
    add_event("sample_data", "Loaded two weeks of sample walking data")
    recompute_trend()
    push_balance()


def on_clear_history(sid, data=None):
    with lock:
        history.clear()
        open(HISTORY_PATH, "w").close()
        prosthetic_minutes.clear()
        open(PROSTHETIC_PATH, "w").close()
    settings["baseline"] = None
    save_settings()
    balance.update({"score": None, "smoothed": None, "risk": "unknown", "slope": None, "projected": None,
                    "baseline": None, "last_window": None})
    add_event("history_cleared", "")
    push_balance()


def simple(command: str):
    def handler(sid, data=None):
        cmd(command)
    return handler


for name, c in (("cancel", "cancel"), ("resolve", "resolve"), ("help", "help"),
                ("test_fall", "test_fall"), ("test_harsh_fall", "test_harsh_fall"),
                ("locate", "locate"), ("silence", "silence")):
    ui.on_message(name, simple(c))
ui.on_message("hello", on_hello)
ui.on_message("save_settings", on_save_settings)
ui.on_message("set_baseline", on_set_baseline)
ui.on_message("test_alert", on_test_alert)
ui.on_message("seed_demo", on_seed_demo)
ui.on_message("clear_history", on_clear_history)
ui.on_message("relayed", on_relayed)


# A JSON summary other apps (e.g. the Clarah Health web app) can read.
def api_summary():
    return {"balance": {k: v for k, v in balance.items() if k != "last_window"}, "last_window": balance.get("last_window"),
            "daily": daily_summary(), **status_payload(), "events": events[-20:]}


ui.expose_api("GET", "/api/summary", api_summary)


# Idle pace. Clarah's reply sets the next wait (next_sync_s): 1 s while someone has /steady open.
SYNC_INTERVAL_S = float(os.environ.get("STEADY_SYNC_INTERVAL_S", "10"))


def ingest_payload():
    with lock:
        payload = sync.build_payload(settings, balance, daily_summary(), status_payload()["device"],
                                     active_alert, dict(emergency), prosthetic_payload(), events, now())
        pts = list(samples)
    fresh = pts and time.time() - device["last_imu"] < 3
    payload["motion"] = sync.motion_trace(pts, gait.FS, clock_offset=now() - time.time()) if fresh else None
    payload["instability"] = instability if instability and now() - instability["t"] < 120 else None
    return payload


def sync_loop():
    token = os.environ.get("STEADY_INGEST_TOKEN")
    if not token:
        return
    wait = SYNC_INTERVAL_S
    while True:
        sync_requested.wait(wait)
        sync_requested.clear()
        wait = SYNC_INTERVAL_S
        try:
            req = urllib.request.Request(
                settings["clarah_url"].rstrip("/") + "/api/steady/ingest",
                data=json.dumps(ingest_payload()).encode(), method="POST",
                headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as response:
                reply = json.loads(response.read() or b"{}")
            # The website can end ("resolve") or cancel the alarm; run it like the dashboard does.
            for c in reply.get("commands") or []:
                if c in ("cancel", "resolve"):
                    log.info(f"Clarah asked the device to {c}")
                    cmd(c)
            try:
                wait = min(60.0, max(1.0, float(reply.get("next_sync_s") or SYNC_INTERVAL_S)))
            except (TypeError, ValueError):
                wait = SYNC_INTERVAL_S
            if sync_status.get("state") != "ok":
                log.info("Clarah sync succeeded")
            sync_status.update({"state": "ok", "at": now(), "error": None})
        except Exception as e:
            sync_status.update({"state": "error", "at": now(), "error": str(e)[:160]})
            log.warning(f"Clarah sync failed: {e}")
        push_status()

try:
    from fastapi.middleware.cors import CORSMiddleware
    ui.app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])
except Exception as e:
    log.warning(f"CORS not enabled: {e}")

Bridge.provide("fg_imu", on_imu)
Bridge.provide("fg_event", on_mcu_event)
Bridge.provide("fg_state", on_mcu_state)


def status_loop():
    was_online = None
    sent_countdown = False
    while True:
        time.sleep(1)
        online = time.time() - device["last_seen"] < 3
        if online and not sent_countdown:
            cmd(f"countdown={settings['countdown_s']}")
            cmd(f"harsh_countdown={settings['harsh_countdown_s']}")
            if balance.get("smoothed") is not None:
                cmd(f"score={int(balance['smoothed'])},{balance['risk'][0]}")
            sent_countdown = True
        if online != was_online:
            was_online = online
            push_status()
        if active_alert:
            push_status()
        with lock:
            stuck = [i for i in outbox if i["status"] == "relay"]
        if stuck and int(time.time()) % 10 == 0:
            push_outbox()


def net_probe_loop():
    """Know ahead of an emergency whether the board itself can reach ntfy."""
    while True:
        try:
            urllib.request.urlopen("https://ntfy.sh/v1/health", timeout=5).read()
            net["ok"] = True
        except Exception:
            net["ok"] = False
        net["checked"] = time.time()
        time.sleep(240)


recompute_trend()
threading.Thread(target=net_probe_loop, daemon=True).start()
threading.Thread(target=analysis_loop, daemon=True).start()
threading.Thread(target=prosthetic_loop, daemon=True).start()
threading.Thread(target=status_loop, daemon=True).start()
threading.Thread(target=sync_loop, daemon=True).start()

App.run()
