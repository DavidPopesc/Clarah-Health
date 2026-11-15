"""Run with: python3 -m unittest discover -s hardware/steady/tests (needs numpy)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "python"))
sys.path.insert(0, os.path.dirname(__file__))
import gait  # noqa: E402
import sim  # noqa: E402


class GaitTest(unittest.TestCase):
    def test_still_gets_no_score(self):
        self.assertFalse(gait.analyze_window(sim.motion(**sim.STAGES["still"]), 0).walking)

    def test_steady_walk_scores_high(self):
        w = gait.analyze_window(sim.motion(**sim.STAGES["steady walk"]), 0)
        self.assertTrue(w.walking)
        self.assertGreater(w.score, 85, w)

    def test_score_falls_as_movement_gets_wilder(self):
        names = ["steady walk", "a bit wobbly", "bigger swings", "huge swings"]
        scores = [gait.analyze_window(sim.motion(**sim.STAGES[n]), 0).score for n in names]
        self.assertTrue(all(a > b for a, b in zip(scores, scores[1:])), scores)

    def test_board_recordings_map_to_low_moderate_high(self):
        # Jolt measured from dashboard traces of the real sensor; sway typical for each.
        low = gait.score_from_features(sway=5, jolt=0.15, regularity=0.8)
        moderate = gait.score_from_features(sway=15, jolt=0.52, regularity=0.8)
        high = gait.score_from_features(sway=30, jolt=0.66, regularity=0.8)
        self.assertEqual(gait.risk_level(low, None, None), "low", low)
        self.assertEqual(gait.risk_level(moderate, None, None), "moderate", moderate)
        self.assertEqual(gait.risk_level(high, None, None), "high", high)

    def test_trend_and_risk(self):
        pts = [(i * 30.0, 85 - i * 2.0) for i in range(12)]  # -4 points/min
        slope = gait.trend(pts)
        self.assertAlmostEqual(slope, -4.0, places=3)
        self.assertEqual(gait.risk_level(85, 88, 0.0), "low")
        self.assertEqual(gait.risk_level(72, 88, -0.5), "moderate")
        self.assertEqual(gait.risk_level(62, 84, slope), "high")


if __name__ == "__main__":
    unittest.main()
