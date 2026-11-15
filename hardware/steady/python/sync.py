"""Versioned Clarah Health ingest payload. No network or Arduino dependency."""

DOCTOR_ADVICE = "If you feel your walking is getting worse, call your doctor."


def build_payload(settings, balance, daily, device, alert, emergency, prosthetic, events, sent_at):
    warning = next(({"risk": e["risk"], "message": e["detail"], "t": e["t"]}
                    for e in reversed(events) if e.get("kind") == "balance_warning"
                    and e.get("risk") in ("moderate", "high") and sent_at - 86400 <= e["t"] <= sent_at), None)
    if warning and DOCTOR_ADVICE not in warning["message"]:
        warning["message"] = warning["message"].rstrip() + " " + DOCTOR_ADVICE
    return {
        "v": 1, "device_id": settings.get("device_id", "uno-q"), "sent_at": sent_at,
        "mode": settings.get("mode", "fall_prevention"), "patient_name": settings.get("patient_name", ""),
        "balance": {k: balance.get(k) for k in ("score", "smoothed", "baseline", "slope", "projected", "risk", "walking")},
        "last_window": {k: v for k, v in balance["last_window"].items() if k not in ("mode", "sample")}
                       if balance.get("last_window") else None,
        "daily": daily[-14:],
        "device": {k: device.get(k) for k in ("state", "online", "sensor")},
        "alert": alert, "emergency": emergency,
        "prosthetic": prosthetic if settings.get("mode") == "prosthetic" else None,
        "warning": warning,
        "events": [{k: e.get(k) for k in ("t", "kind", "detail")} for e in events[-20:]],
    }


def motion_trace(samples, fs, seconds=10, hz=10, clock_offset=0.0):
    """The last `seconds` of acceleration, averaged down to `hz`, for Clarah's live motion graph.

    `samples` are (t, x, y, z) in g at `fs` Hz. Each output point averages the axes over its
    slot but keeps the slot's peak magnitude, so a sharp jolt still shows.
    """
    pts = list(samples)[-int(seconds * fs):]
    step = max(1, int(round(fs / hz)))
    out = {"hz": fs / step, "t_end": None, "x": [], "y": [], "z": [], "mag": []}
    for i in range(0, len(pts) - step + 1, step):
        chunk = pts[i:i + step]
        for axis, k in (("x", 1), ("y", 2), ("z", 3)):
            out[axis].append(round(sum(p[k] for p in chunk) / len(chunk), 2))
        out["mag"].append(round(max((p[1] ** 2 + p[2] ** 2 + p[3] ** 2) ** 0.5 for p in chunk), 2))
    if pts:
        out["t_end"] = round(pts[-1][0] + clock_offset, 2)
    return out
