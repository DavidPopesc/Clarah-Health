"""Balance scoring from a waist-worn accelerometer.

Works on 10-second windows of 50 Hz samples (in g). The sensor can be worn in any
orientation: gravity is estimated from the window mean.

The score rests on two measures of how much the trunk is thrown around, because
unsteady walkers sway and lurch more than steady ones:
  * sway: RMS tilt of the trunk away from its average posture, in degrees.
    Steady walking stays around 3-6 degrees.
  * jolt: spread (standard deviation) of the total acceleration, in g.
    Steady walking at the waist is around 0.1-0.2 g.
Stride regularity (autocorrelation one stride later) counts a little. Cadence is
shown but not scored. Step-to-step timing isn't used: the MMA7660's 6-bit readings
give double peaks that make per-step timing unreliable.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict

import numpy as np

FS = 50.0
WINDOW_S = 10.0
HOP_S = 5.0


@dataclass
class GaitWindow:
    t: float
    walking: bool
    score: float | None = None
    cadence: float | None = None
    regularity: float | None = None
    sway: float | None = None  # degrees
    jolt: float | None = None  # g

    def to_dict(self) -> dict:
        d = asdict(self)
        for k, v in d.items():
            if isinstance(v, float):
                d[k] = round(v, 3)
        return d


def _smooth(x: np.ndarray, n: int) -> np.ndarray:
    if n <= 1:
        return x
    k = np.ones(n) / n
    return np.convolve(x, k, mode="same")


def _autocorr(x: np.ndarray) -> np.ndarray:
    x = x - x.mean()
    n = len(x)
    f = np.fft.rfft(x, 2 * n)
    ac = np.fft.irfft(f * np.conj(f))[:n]
    ac = ac / (n - np.arange(n))  # unbiased: later lags overlap fewer samples
    return ac / ac[0] if ac[0] > 0 else ac


def _clip01(v: float) -> float:
    return float(min(1.0, max(0.0, v)))


def score_from_features(sway: float, jolt: float, regularity: float | None) -> float:
    """0-100, higher is steadier."""
    # Calibrated on recordings from the board: steady movement ~0.15 g jolt (low risk),
    # big swings ~0.52 g (moderate), wild swings at the sensor's limits ~0.66 g (high).
    penalty = 75 * _clip01((jolt - 0.15) / 0.65) + 15 * _clip01((sway - 6.0) / 30.0)
    if regularity is not None:
        penalty += 10 * _clip01((0.5 - regularity) / 0.5)
    return max(0.0, 100.0 - penalty)


def analyze_window(acc: np.ndarray, t: float) -> GaitWindow:
    """acc: (N, 3) array in g covering one window."""
    if len(acc) < FS * 4:
        return GaitWindow(t=t, walking=False)

    acc = np.column_stack([_smooth(acc[:, i], 3) for i in range(3)])  # tame 6-bit steps
    g = acc.mean(axis=0)
    g_norm = np.linalg.norm(g)
    if g_norm < 0.3:
        return GaitWindow(t=t, walking=False)
    g_unit = g / g_norm

    mag = np.linalg.norm(acc, axis=1)
    jolt = float(np.std(mag))
    if jolt < 0.05:  # sitting, standing or lying still
        return GaitWindow(t=t, walking=False)

    cos = np.clip((acc @ g_unit) / np.maximum(mag, 1e-6), -1, 1)
    sway = float(np.sqrt(np.mean(np.degrees(np.arccos(cos)) ** 2)))

    # Rhythm: first strong autocorrelation peak between 0.33 and 1.1 s is a step.
    vert = (acc - g) @ g_unit
    ac = _autocorr(vert)
    lo, hi = int(0.33 * FS), int(1.1 * FS)
    step_lag = lo + int(np.argmax(ac[lo:hi]))
    step_ac = float(ac[step_lag])
    rhythmic = step_ac >= 0.15

    # Unsteady movement often loses its rhythm; count it as long as it's vigorous.
    if not rhythmic and jolt < 0.15:
        return GaitWindow(t=t, walking=False)

    cadence = regularity = None
    if rhythmic:
        half = step_lag // 2
        if half >= lo and ac[half] > 0.6 * step_ac:  # the peak was a stride, not a step
            step_lag = half
        cadence = 60.0 * FS / step_lag
        stride = min(2 * step_lag, len(ac) - 3)
        regularity = float(max(ac[stride - 2 : stride + 3]))

    return GaitWindow(
        t=t,
        walking=True,
        score=score_from_features(sway, jolt, regularity),
        cadence=cadence,
        regularity=regularity,
        sway=sway,
        jolt=jolt,
    )


def trend(points: list[tuple[float, float]]) -> float | None:
    """Least-squares slope in score points per minute. points = [(unix_t, score)]."""
    if len(points) < 6:
        return None
    t = np.array([p[0] for p in points]) / 60.0
    y = np.array([p[1] for p in points])
    if t.max() - t.min() < 0.5:
        return None
    slope, _ = np.polyfit(t - t.mean(), y, 1)
    return float(slope)


def risk_level(current: float, baseline: float | None, slope: float | None) -> str:
    """'low', 'moderate' or 'high' fall risk from the smoothed score and its trend."""
    drop = (baseline - current) if baseline is not None else 0.0
    projected = current + (slope or 0.0) * 10  # ten minutes of walking ahead
    if current < 45 or drop >= 25 or projected < 35:
        return "high"
    if current < 70 or drop >= 12 or projected < 55:
        return "moderate"
    return "low"
