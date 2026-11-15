import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "python"))
import fall  # noqa: E402
import prosthetic  # noqa: E402
import sync  # noqa: E402


class HarshFallTest(unittest.TestCase):
    def test_sustained_two_axis_saturation(self):
        self.assertTrue(fall.harsh_saturation_run([(0, 0, 1)] * 3 + [(1.45, 1.45, 1.3)] * 3))

    def test_single_bump_and_one_axis_saturation_do_not_qualify(self):
        self.assertFalse(fall.harsh_saturation_run([(1.45, 1.45, .3), (0, 0, 1), (1.45, 1.45, .3)]))
        self.assertFalse(fall.harsh_saturation_run([(1.5, .8, .8)] * 5))

    def test_posture_stillness_and_freefall_required_for_harsh(self):
        impact = [(1.45, 1.45, 1.3)] * 3
        self.assertEqual(fall.classify_fall(True, 55, .08, impact), "harsh_fall")
        self.assertEqual(fall.classify_fall(False, 55, .08, impact), "fall")
        self.assertIsNone(fall.classify_fall(True, 20, .08, impact))
        self.assertIsNone(fall.classify_fall(True, 55, .3, impact))


class ProstheticTest(unittest.TestCase):
    def test_table_still_is_not_wear_and_walk_has_stumble(self):
        self.assertFalse(prosthetic.minute_features(np.tile([0, 0, 1.0], (3000, 1)), False)["worn"])
        motion = np.tile([0, 0, 1.0], (3000, 1))
        motion[:, 2] += .12 * np.sin(np.arange(3000) / 8)
        motion[500:503, :2] = 1.45
        self.assertEqual(prosthetic.minute_features(motion, True), {"worn": True, "walking": True, "stumbles": 1})

    def test_bouts_and_adaptation(self):
        minutes, windows = [], []
        for day in range(14):
            t = day * 86400 + 12 * 3600
            for i in range(20 + day * 2):
                minutes.append({"t": t + i * 60, "worn": True, "walking": i < 5 or 10 <= i < 15 + day,
                                "stumbles": 0})
            windows.append({"t": t, "mode": "prosthetic", "walking": True, "score": 55 + day * 2})
        result = prosthetic.summarize(minutes, windows, minutes[-1]["t"])
        self.assertEqual(result["adaptation"], "adapting")
        self.assertEqual(result["bouts_today"], 2)
        self.assertEqual(result["longest_bout_min"], 18)
        self.assertEqual(len(result["daily"]), 14)
        declining = [{"day": str(i), "wear_min": 300 - i * 8, "walking_min": 40,
                      "stumbles": 3, "score": 80 - i * 2} for i in range(14)]
        self.assertEqual(prosthetic.adaptation(declining)[0], "struggling")
        flat = [{"day": str(i), "wear_min": 300, "walking_min": 40,
                 "stumbles": 0, "score": 70} for i in range(5)]
        self.assertEqual(prosthetic.adaptation(flat)[0], "adjusting")


class SyncTest(unittest.TestCase):
    def test_exact_v1_shape_and_recent_warning(self):
        balance = {"score": 71.2, "smoothed": 70.4, "baseline": 82., "slope": -.4,
                   "projected": 66., "risk": "moderate", "walking": True, "last_window": {"score": 71.2}}
        events = [{"t": 100., "kind": "balance_warning", "detail": "Call your doctor.", "risk": "high"},
                  {"t": 100000., "kind": "balance_warning", "detail": "Call your doctor.", "risk": "moderate"}]
        payload = sync.build_payload({"mode": "prosthetic", "patient_name": "Ada"}, balance, [],
                                     {"state": "normal", "online": True, "sensor": "ok", "last_seen": 0},
                                     None, {"active": False, "reason": None, "since": None,
                                            "simulated_911": False, "simulated_911_at": None},
                                     {"wear_min_today": 12}, events, 100010.)
        self.assertEqual(set(payload), {"v", "device_id", "sent_at", "mode", "patient_name", "balance",
                                        "last_window", "daily", "device", "alert", "emergency", "prosthetic",
                                        "warning", "events"})
        self.assertEqual(payload["device"], {"state": "normal", "online": True, "sensor": "ok"})
        self.assertEqual(payload["warning"]["risk"], "moderate")
        self.assertIn("If you feel your walking is getting worse, call your doctor.", payload["warning"]["message"])
        self.assertEqual(payload["events"][0], {"t": 100., "kind": "balance_warning", "detail": "Call your doctor."})
        self.assertIsNone(sync.build_payload({"mode": "fall_prevention"}, balance, [], {}, None, {}, {}, [], 0)["prosthetic"])


if __name__ == "__main__":
    unittest.main()


class MotionTraceTest(unittest.TestCase):
    def test_downsamples_to_ten_hz_and_keeps_peaks(self):
        from sync import motion_trace
        pts = [(i / 50, 0.0, 0.0, 1.0) for i in range(500)]
        pts[250] = (5.0, 1.4, 1.4, 1.0)  # one sharp jolt
        trace = motion_trace(pts, 50)
        self.assertEqual(len(trace["mag"]), 100)
        self.assertEqual(trace["hz"], 10)
        self.assertAlmostEqual(max(trace["mag"]), 2.22, places=2)
        self.assertAlmostEqual(trace["z"][0], 1.0)
