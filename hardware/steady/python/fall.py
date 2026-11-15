"""Shared, testable description of the MCU harsh-fall saturation rule."""

SATURATION_G = 1.40  # MMA7660 registers top out near +1.45 / -1.50 g
HARSH_MAG_G = 2.40
HARSH_SAMPLES = 3  # consecutive 50 Hz samples (60 ms)


def harsh_saturation_run(samples) -> bool:
    """Only a sustained, multi-axis saturated impact qualifies as harsh.

    The MCU also requires preceding free fall, a >=50 degree posture change and
    stillness afterwards; this function covers its impact portion.
    """
    run = 0
    for x, y, z in samples:
        magnitude = (x*x + y*y + z*z) ** 0.5
        run = run + 1 if magnitude >= HARSH_MAG_G and sum(abs(v) >= SATURATION_G for v in (x, y, z)) >= 2 else 0
        if run >= HARSH_SAMPLES:
            return True
    return False


def classify_fall(freefall: bool, angle_deg: float, still_sd_g: float, impact_samples,
                  normal_trigger: bool = True) -> str | None:
    """Reference for the MCU's final fall-tier decision, using measured features."""
    if not normal_trigger or angle_deg < 50 or still_sd_g > 0.15:
        return None
    return "harsh_fall" if freefall and harsh_saturation_run(impact_samples) else "fall"
