"""Minute-level prosthetic wear and walking summaries from a shank sensor."""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

import numpy as np


def minute_features(acc: np.ndarray, walking: bool) -> dict:
    """Detect active wear from movement or a changing gravity direction.

    A quiet prosthesis resting on a table is not counted. Slow wear while sitting
    can be missed, so these minutes are an estimate rather than clinical usage.
    """
    if len(acc) < 100:
        return {"worn": False, "walking": False, "stumbles": 0}
    mag = np.linalg.norm(acc, axis=1)
    early = acc[:len(acc)//4].mean(axis=0)
    late = acc[-len(acc)//4:].mean(axis=0)
    change = np.linalg.norm(early / max(np.linalg.norm(early), .01) - late / max(np.linalg.norm(late), .01))
    worn = bool(np.std(mag) >= .045 or change >= .12)
    # A stumble is a sharp multi-sample jolt during walking; cooldown clusters a
    # single jolt into one event. A fall is excluded by the caller.
    spikes = np.flatnonzero(mag >= 2.0) if walking else []
    stumbles, last = 0, -100
    for i in spikes:
        if i - last >= 50:
            stumbles += 1
        last = i
    return {"worn": worn, "walking": bool(worn and walking), "stumbles": stumbles}


def adaptation(daily: list[dict]) -> tuple[str, str]:
    days = [d for d in daily if d.get("walking_min", 0) and d.get("score") is not None]
    if len(days) < 3:
        return "unknown", "Keep wearing the leg to build a starting picture."
    first = days[:min(3, len(days)//2)]
    recent = days[-min(3, len(days)//2):]
    avg = lambda rows, key: sum(d[key] for d in rows) / len(rows)
    score_change = avg(recent, "score") - avg(first, "score")
    walk_change = avg(recent, "walking_min") - avg(first, "walking_min")
    wear_change = avg(recent, "wear_min") - avg(first, "wear_min")
    if score_change <= -7 or wear_change <= -45 or avg(recent, "stumbles") >= 3:
        return "struggling", "Walking looks less steady or wear time is falling. Your prosthetist may need to adjust the fit."
    if score_change >= 5 and walk_change >= 8:
        return "adapting", "Walking time and steadiness are improving as you get used to the prosthesis."
    return "adjusting", "Your walking is holding roughly steady while you get used to the prosthesis."


def summarize(minutes: list[dict], windows: list[dict], now_t: float, tz_offset_min: int = 0) -> dict:
    """Aggregate persisted minute records into daily metrics, oldest first."""
    def day(t):
        return (datetime.fromtimestamp(t, timezone.utc) + timedelta(minutes=tz_offset_min)).strftime("%Y-%m-%d")
    rows = defaultdict(lambda: {"wear_min": 0, "walking_min": 0, "bouts": 0, "stumbles": 0, "longest_bout_min": 0, "score": None})
    prev_walking = False
    prev_t = None
    bout = 0
    for m in sorted(minutes, key=lambda m: m["t"]):
        d = rows[day(m["t"])]
        if m.get("worn"):
            d["wear_min"] += 1
        walking = bool(m.get("walking"))
        if walking:
            d["walking_min"] += 1
            if not prev_walking or prev_t is None or m["t"] - prev_t > 90 or day(prev_t) != day(m["t"]):
                d["bouts"] += 1
                bout = 0
            bout += 1
            d["longest_bout_min"] = max(d["longest_bout_min"], bout)
        else:
            bout = 0
        d["stumbles"] += m.get("stumbles", 0)
        prev_walking, prev_t = walking, m["t"]
    scores = defaultdict(list)
    for w in windows:
        if w.get("mode") == "prosthetic" and w.get("walking") and w.get("score") is not None:
            scores[day(w["t"])].append(w["score"])
    for key, vals in scores.items():
        rows[key]["score"] = round(float(np.median(vals)), 1)
    daily = [{"day": key, **rows[key]} for key in sorted(rows)[-14:]]
    today = next((d for d in daily if d["day"] == day(now_t)), {})
    status, note = adaptation(daily)
    return {"wear_min_today": today.get("wear_min", 0), "walking_min_today": today.get("walking_min", 0),
            "bouts_today": today.get("bouts", 0), "longest_bout_min": today.get("longest_bout_min", 0),
            "stumbles_today": today.get("stumbles", 0), "adaptation": status, "adaptation_note": note,
            "daily": [{k: d[k] for k in ("day", "wear_min", "walking_min", "bouts", "stumbles", "score")} for d in daily]}
