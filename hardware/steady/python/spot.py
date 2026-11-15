"""Spot check: is the last 10 s of walking far worse than usual? No Arduino dependency."""

SPOT_EVERY_S = 10.0      # check at most this often
SPOT_COOLDOWN_S = 60.0   # don't repeat the pop-up more often than this
BAD_SCORE = 45.0         # a window this unsteady is bad on its own
BAD_DROP = 30.0          # or this many points below the wearer's usual

DOCTOR_ADVICE = "If you feel your walking is getting worse, call your doctor."


def spot_check(score: float, usual: float | None) -> dict | None:
    """Returns an alert when one 10 s window is really bad, else None."""
    drop = (usual - score) if usual is not None else 0.0
    if score > BAD_SCORE and drop < BAD_DROP:
        return None
    vs = f" (usual {usual:.0f})" if usual is not None else ""
    return {
        "score": round(score, 1),
        "usual": None if usual is None else round(usual, 1),
        "drop": round(max(drop, 0.0), 1),
        "message": (f"Your last 10 seconds of walking were much less steady than usual: steadiness {score:.0f}{vs}. "
                    f"Stop, hold on to something or sit down. {DOCTOR_ADVICE}"),
    }
