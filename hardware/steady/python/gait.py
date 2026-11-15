"""Balance scoring from a waist-worn accelerometer.

Works on 10-second windows of 50 Hz samples (in g). The sensor can be worn in any
orientation: gravity is estimated from the window mean and the motion is split
into vertical (along gravity) and horizontal parts.

Features, all common in gait and fall-risk research:
  * cadence: steps per minute
  * step-time variability: coefficient of variation of the time between steps.
    Steady walkers stay around 2-4 %; above ~7 % is linked with falls.
  * regularity: autocorrelation of the vertical signal one stride (two steps)
    later. Close to 1 means every stride looks the same.
  * sway ratio: horizontal motion relative to vertical motion. Wobbling side to
    side raises it.
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
    step_cv: float | None = None
    regularity: float | None = None
    sway: float | None = None
    steps: int = 0

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
    # Unbiased: each lag has fewer overlapping samples.
    ac = ac / (n - np.arange(n))
    return ac / ac[0] if ac[0] > 0 else ac


def _clip01(v: float) -> float:
    return float(min(1.0, max(0.0, v)))


def score_from_features(step_cv: float, regularity: float, sway: float) -> float:
    """0-100, higher is steadier."""
    penalty = (
        35 * _clip01((step_cv - 3.0) / 9.0)
        + 35 * _clip01((0.75 - regularity) / 0.5)
        + 30 * _clip01((sway - 0.9) / 1.0)
    )
    return 100.0 - penalty


def analyze_window(acc: np.ndarray, t: float) -> GaitWindow:
    """acc: (N, 3) array in g covering one window."""
    if len(acc) < FS * 4:
        return GaitWindow(t=t, walking=False)

    g = acc.mean(axis=0)
    g_norm = np.linalg.norm(g)
    if g_norm < 0.3:
        return GaitWindow(t=t, walking=False)
    g_unit = g / g_norm

    dyn = acc - g
    vert = dyn @ g_unit
    horiz = dyn - np.outer(vert, g_unit)
    horiz_mag = np.linalg.norm(horiz, axis=1)

    vert_s = _smooth(vert, 5)  # ~10 Hz low-pass; the sensor's 6-bit steps are noisy
    vert_rms = float(np.sqrt(np.mean(vert_s**2)))
    if vert_rms < 0.04:
        return GaitWindow(t=t, walking=False)

    # Step period from the autocorrelation: first strong peak between 0.33 and 1.1 s.
    ac = _autocorr(vert_s)
    lo, hi = int(0.33 * FS), int(1.1 * FS)
    step_lag = lo + int(np.argmax(ac[lo:hi]))
    step_ac = float(ac[step_lag])
    if step_ac < 0.15:
        return GaitWindow(t=t, walking=False)

    # Walkers alternate legs, so the stride (two steps) can correlate better than
    # one step. If the peak we found is really a stride, halve it.
    half = step_lag // 2
    if half >= lo and ac[half] > 0.6 * step_ac:
        step_lag = half
    stride_lag = min(2 * step_lag, len(ac) - 1)
    regularity = float(max(ac[stride_lag - 2 : stride_lag + 3]))

    # Individual steps: peaks of the vertical signal at least 60 % of a step apart.
    min_gap = int(0.6 * step_lag)
    thresh = 0.4 * np.std(vert_s)
    peaks = []
    for i in range(1, len(vert_s) - 1):
        if vert_s[i] > thresh and vert_s[i] >= vert_s[i - 1] and vert_s[i] > vert_s[i + 1]:
            if peaks and i - peaks[-1] < min_gap:
                if vert_s[i] > vert_s[peaks[-1]]:
                    peaks[-1] = i
                continue
            peaks.append(i)
    if len(peaks) < 6:
        return GaitWindow(t=t, walking=False)

    intervals = np.diff(peaks) / FS
    cadence = 60.0 / float(np.median(intervals))
    if not 40 <= cadence <= 160:
        return GaitWindow(t=t, walking=False)
    step_cv = float(np.std(intervals) / np.mean(intervals) * 100)

    horiz_rms = float(np.sqrt(np.mean(_smooth(horiz_mag - horiz_mag.mean(), 5) ** 2)))
    sway = horiz_rms / vert_rms

    return GaitWindow(
        t=t,
        walking=True,
        score=score_from_features(step_cv, regularity, sway),
        cadence=cadence,
        step_cv=step_cv,
        regularity=regularity,
        sway=sway,
        steps=len(peaks),
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
    if current < 50 or drop >= 20 or projected < 45:
        return "high"
    if current < 65 or drop >= 10 or (slope is not None and slope < -1.0):
        return "moderate"
    return "low"
