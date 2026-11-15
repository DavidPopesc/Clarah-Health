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
