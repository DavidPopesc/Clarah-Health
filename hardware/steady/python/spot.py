"""Spot check: is the last 10 s of walking far worse than usual? No Arduino dependency.

Thresholds come from recordings on the board: steady walking scores ~90 with ~3 degrees of
trunk sway, while visibly wobbly stretches score 73-80 with 25-50 degrees of sway.
"""

SPOT_COOLDOWN_S = 30.0   # don't repeat the pop-up more often than this
BAD_SCORE = 80.0         # a window this unsteady is bad on its own
BAD_DROP = 8.0           # or this many points below the wearer's usual
BAD_SWAY_DEG = 25.0      # or the trunk swinging this far from its usual posture

DOCTOR_ADVICE = "If you feel your walking is getting worse, call your doctor."


def spot_check(score: float, usual: float | None, sway: float | None = None) -> dict | None:
    """Returns an alert when one 10 s window is really bad, else None."""
    drop = (usual - score) if usual is not None else 0.0
    swaying = sway is not None and sway >= BAD_SWAY_DEG
    if score > BAD_SCORE and drop < BAD_DROP and not swaying:
        return None
    vs = f" (usual {usual:.0f})" if usual is not None else ""
    sway_note = f", swaying {sway:.0f} degrees" if swaying else ""
    return {
        "score": round(score, 1),
        "usual": None if usual is None else round(usual, 1),
        "drop": round(max(drop, 0.0), 1),
        "sway": None if sway is None else round(sway, 1),
        "message": (f"Your last 10 seconds of walking were much less steady than usual: steadiness {score:.0f}{vs}{sway_note}. "
                    f"Stop, hold on to something or sit down. {DOCTOR_ADVICE}"),
    }
