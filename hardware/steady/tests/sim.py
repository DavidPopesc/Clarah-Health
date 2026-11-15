"""Synthetic waist-sensor motion for tests: steady walking up to wild swaying."""
import numpy as np

FS = 50.0
RNG = np.random.default_rng(7)


def motion(seconds=10, bump=0.2, swing_deg=0.0, period=0.9, radius=0.35, jitter=0.0, noise=0.02):
    """bump: vertical step bump (g). swing_deg: trunk sway amplitude, rocking like a pendulum."""
    n = int(seconds * FS)
    t = np.arange(n) / FS
    w = 2 * np.pi / (2 * period)  # one sway cycle per stride
    phase = w * t + jitter * np.cumsum(RNG.standard_normal(n)) / np.sqrt(FS)
    th = np.radians(swing_deg) * np.sin(phase)
    thd = np.gradient(th, 1 / FS)
    thdd = np.gradient(thd, 1 / FS)
    # Step bumps along the body axis, twice per sway cycle.
    steps = bump * np.maximum(0, np.sin(2 * phase)) ** 3
    # Gravity seen by a sensor tilted by th, plus pendulum tangential/centripetal accel.
    ax = np.sin(th) + radius * thdd / 9.81
    az = np.cos(th) + steps + radius * thd**2 / 9.81
    ay = noise * RNG.standard_normal(n)
    acc = np.stack([ax, ay, az], axis=1) + noise * RNG.standard_normal((n, 3))
    return np.clip(np.round(acc * 21.33) / 21.33, -1.5, 1.45)


# Roughly matching recordings from the board: |a| ranged 0.8-1.3 g walking steadily,
# 0.1-1.6 g in big swings and the sensor's full range in wild ones.
STAGES = {
    "still": dict(bump=0.0, swing_deg=0.0),
    "steady walk": dict(bump=0.3, swing_deg=4.0),
    "a bit wobbly": dict(bump=0.45, swing_deg=15.0, radius=0.6),
    "bigger swings": dict(bump=0.7, swing_deg=30.0, radius=0.9, jitter=0.2),
    "huge swings": dict(bump=1.0, swing_deg=50.0, radius=1.2, jitter=0.4),
}
