"""
tests/test_fusion.py
====================
Unit tests for the EduBridge stress fusion formula and report logic.

The combined stress score formula is:
    final_score = (face_stress_ratio * 0.6) + (voice_stress_conf * 0.4)
    stress_level = HIGH if final_score >= 0.5 else NORMAL

These tests verify the mathematical correctness of the formula,
boundary conditions, and edge cases.

Run:
    python -m pytest tests/test_fusion.py -v
"""

import os
import sys
import json
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── Pure formula tests (no Flask needed) ──────────────────────────────────────

def compute_fusion(face_ratio, voice_label, voice_conf):
    """Replicate the fusion formula from routes/report.py."""
    voice_stress = voice_conf if voice_label == "STRESSED" else 0.0
    final_score  = round((face_ratio * 0.6) + (voice_stress * 0.4), 4)
    stress_level = "HIGH" if final_score >= 0.5 else "NORMAL"
    return final_score, stress_level


class TestFusionFormula(unittest.TestCase):

    # ── Boundary conditions ────────────────────────────────────────────────────

    def test_all_zeros_produces_zero_score(self):
        """No stress signals should produce a score of 0."""
        score, level = compute_fusion(0.0, "NORMAL", 0.0)
        self.assertEqual(score, 0.0)
        self.assertEqual(level, "NORMAL")

    def test_all_max_produces_score_of_one(self):
        """Maximum signals should produce a score of 1.0."""
        score, level = compute_fusion(1.0, "STRESSED", 1.0)
        self.assertEqual(score, 1.0)
        self.assertEqual(level, "HIGH")

    def test_threshold_exactly_0_5_is_high(self):
        """A score of exactly 0.5 should be classified as HIGH."""
        # face_ratio=0.5, NORMAL voice => 0.5 * 0.6 = 0.3 (not 0.5)
        # Need: face*0.6 + voice*0.4 = 0.5
        # e.g. face=0.5, STRESSED voice conf=0.5 => 0.3 + 0.2 = 0.5
        score, level = compute_fusion(0.5, "STRESSED", 0.5)
        self.assertEqual(score, 0.5)
        self.assertEqual(level, "HIGH")

    def test_just_below_threshold_is_normal(self):
        """A score just below 0.5 should be classified as NORMAL."""
        # face=0.4, STRESSED conf=0.6 => 0.24 + 0.24 = 0.48
        score, level = compute_fusion(0.4, "STRESSED", 0.6)
        self.assertLess(score, 0.5)
        self.assertEqual(level, "NORMAL")

    def test_just_above_threshold_is_high(self):
        """A score just above 0.5 should be classified as HIGH."""
        # face=0.6, STRESSED conf=0.6 => 0.36 + 0.24 = 0.60
        score, level = compute_fusion(0.6, "STRESSED", 0.6)
        self.assertGreater(score, 0.5)
        self.assertEqual(level, "HIGH")

    # ── Voice label logic ──────────────────────────────────────────────────────

    def test_normal_voice_does_not_contribute(self):
        """NORMAL voice label should contribute 0 to the score regardless of conf."""
        score_low,  _ = compute_fusion(0.3, "NORMAL", 0.1)
        score_high, _ = compute_fusion(0.3, "NORMAL", 0.99)
        self.assertEqual(score_low, score_high,
            "NORMAL voice confidence should not affect score")

    def test_stressed_voice_contributes_to_score(self):
        """STRESSED voice should increase the final score."""
        score_no_voice, _ = compute_fusion(0.3, "NORMAL",   0.8)
        score_stressed, _ = compute_fusion(0.3, "STRESSED", 0.8)
        self.assertGreater(score_stressed, score_no_voice)

    def test_face_weight_is_0_6(self):
        """Face ratio should be weighted at 0.6."""
        # No voice contribution
        score, _ = compute_fusion(1.0, "NORMAL", 0.0)
        self.assertAlmostEqual(score, 0.6, places=4)

    def test_voice_weight_is_0_4(self):
        """Voice confidence should be weighted at 0.4 when stressed."""
        # No face contribution
        score, _ = compute_fusion(0.0, "STRESSED", 1.0)
        self.assertAlmostEqual(score, 0.4, places=4)

    def test_weights_sum_to_1_at_maximum(self):
        """At maximum input, weights should sum to 1.0."""
        score, _ = compute_fusion(1.0, "STRESSED", 1.0)
        self.assertAlmostEqual(score, 1.0, places=4)

    # ── Rounding ───────────────────────────────────────────────────────────────

    def test_score_is_rounded_to_4_decimal_places(self):
        """Final score should be rounded to 4 decimal places."""
        score, _ = compute_fusion(0.333333, "STRESSED", 0.666666)
        # Check it is rounded to 4dp
        self.assertEqual(score, round(score, 4))
        self.assertLessEqual(len(str(score).split(".")[-1]), 4)

    # ── Realistic scenarios ────────────────────────────────────────────────────

    def test_high_face_stress_normal_voice(self):
        """High face stress ratio alone can trigger HIGH."""
        score, level = compute_fusion(0.9, "NORMAL", 0.0)
        # 0.9 * 0.6 = 0.54 => HIGH
        self.assertEqual(level, "HIGH")
        self.assertAlmostEqual(score, 0.54, places=4)

    def test_low_face_high_voice_stress(self):
        """High voice stress alone cannot trigger HIGH (max 0.4)."""
        score, level = compute_fusion(0.0, "STRESSED", 1.0)
        # 0.0 * 0.6 + 1.0 * 0.4 = 0.4 => NORMAL
        self.assertEqual(level, "NORMAL")
        self.assertAlmostEqual(score, 0.4, places=4)

    def test_combined_moderate_signals_high(self):
        """Moderate signals from both modalities can combine to HIGH."""
        score, level = compute_fusion(0.5, "STRESSED", 0.6)
        # 0.5 * 0.6 + 0.6 * 0.4 = 0.3 + 0.24 = 0.54 => HIGH
        self.assertEqual(level, "HIGH")

    def test_combined_low_signals_normal(self):
        """Low signals from both modalities should remain NORMAL."""
        score, level = compute_fusion(0.2, "STRESSED", 0.3)
        # 0.12 + 0.12 = 0.24 => NORMAL
        self.assertEqual(level, "NORMAL")

    def test_score_never_exceeds_1(self):
        """Score should never exceed 1.0 even with maximum inputs."""
        score, _ = compute_fusion(1.0, "STRESSED", 1.0)
        self.assertLessEqual(score, 1.0)

    def test_score_never_below_0(self):
        """Score should never be negative."""
        score, _ = compute_fusion(0.0, "NORMAL", 0.0)
        self.assertGreaterEqual(score, 0.0)


# ── Integration: fusion via API ────────────────────────────────────────────────

class TestFusionViaAPI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        import app as flask_app
        flask_app.app.config["TESTING"] = True
        cls.client = flask_app.app.test_client()

    def post_combined(self, face_ratio, face_emotion, voice_label, voice_conf):
        import json
        return json.loads(self.client.post(
            "/api/analyze/combined",
            data=json.dumps({
                "face_ratio":   face_ratio,
                "face_emotion": face_emotion,
                "voice_label":  voice_label,
                "voice_conf":   voice_conf,
            }),
            content_type="application/json"
        ).data)

    def test_api_formula_matches_local_formula(self):
        """API result should match locally computed fusion formula."""
        face_ratio  = 0.6
        voice_conf  = 0.7
        voice_label = "STRESSED"

        expected_score, expected_level = compute_fusion(face_ratio, voice_label, voice_conf)
        data = self.post_combined(face_ratio, "sad", voice_label, voice_conf)

        self.assertAlmostEqual(data["final_score"], expected_score, places=3)
        self.assertEqual(data["stress_level"], expected_level)

    def test_api_high_stress_scenario(self):
        """API should classify as HIGH for a clearly stressed scenario."""
        data = self.post_combined(0.8, "angry", "STRESSED", 0.9)
        self.assertEqual(data["stress_level"], "HIGH")

    def test_api_normal_scenario(self):
        """API should classify as NORMAL for a clearly calm scenario."""
        data = self.post_combined(0.1, "happy", "NORMAL", 0.2)
        self.assertEqual(data["stress_level"], "NORMAL")

    def test_api_preserves_face_emotion(self):
        """API should preserve the face_emotion value in the response."""
        data = self.post_combined(0.3, "surprised", "NORMAL", 0.4)
        self.assertEqual(data["face_emotion"], "surprised")

    def test_api_preserves_voice_label(self):
        """API should preserve the voice_label value in the response."""
        data = self.post_combined(0.3, "neutral", "STRESSED", 0.7)
        self.assertEqual(data["voice_label"], "STRESSED")


if __name__ == "__main__":
    unittest.main(verbosity=2)
