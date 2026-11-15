"""Run with: python3 -m unittest discover -s hardware/steady/tests (needs numpy)."""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "python"))
import gait  # noqa: E402

RNG = np.random.default_rng(7)


def walk(seconds=10, step_s=0.55, jitter=0.0, sway=0.08, still=False):
    """Synthetic waist accelerometer in g, quantized like the MMA7660 (21.33 counts/g)."""
    n = int(seconds * gait.FS)
    t = np.arange(n) / gait.FS
    if still:
        vert = np.zeros(n)
        side = np.zeros(n)
    else:
        # Step times with optional jitter; each step is a bump in vertical accel.
        steps = np.cumsum(step_s * (1 + jitter * RNG.standard_normal(int(seconds / step_s) + 4)))
        vert = np.zeros(n)
        for i, s in enumerate(steps):
            vert += (0.35 if i % 2 else 0.30) * np.exp(-((t - s) ** 2) / (2 * 0.06**2))
        vert -= vert.mean()
        side = sway * np.sin(2 * np.pi * t / (2 * step_s)) + sway * 0.6 * RNG.standard_normal(n) * (jitter > 0)
    acc = np.stack([side, 0.05 * RNG.standard_normal(n), 1.0 + vert], axis=1)
    # Worn tilted ~30 degrees: rotate around x.
    a = np.radians(30)
    rot = np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]])
    acc = acc @ rot.T
    return np.round(acc * 21.33) / 21.33


class GaitTest(unittest.TestCase):
    def test_still_is_not_walking(self):
        self.assertFalse(gait.analyze_window(walk(still=True), 0).walking)

    def test_steady_walk_scores_high(self):
        w = gait.analyze_window(walk(), 0)
        self.assertTrue(w.walking)
        self.assertAlmostEqual(w.cadence, 60 / 0.55, delta=8)
        self.assertGreater(w.score, 80, w)

    def test_unsteady_walk_scores_lower(self):
        steady = gait.analyze_window(walk(), 0)
        wobbly = gait.analyze_window(walk(jitter=0.18, sway=0.25), 0)
        self.assertTrue(wobbly.walking, wobbly)
        self.assertLess(wobbly.score, steady.score - 20, (steady, wobbly))

    def test_trend_and_risk(self):
        pts = [(i * 30.0, 85 - i * 2.0) for i in range(12)]  # -4 points/min
        slope = gait.trend(pts)
        self.assertAlmostEqual(slope, -4.0, places=3)
        self.assertEqual(gait.risk_level(80, 82, 0.0), "low")
        self.assertEqual(gait.risk_level(70, 85, -0.2), "moderate")
        self.assertEqual(gait.risk_level(62, 84, slope), "high")


if __name__ == "__main__":
    unittest.main()
