import os
import sys
import json
import base64
import unittest

import numpy as np
import cv2

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app as flask_app

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_base64_image(width=200, height=200):
    """Return a synthetic base64 JPEG image string."""
    img = np.random.randint(100, 200, (height, width, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode("utf-8")


def make_base64_audio(duration=0.5, sr=22050):
    """Return a base64-encoded silent WebM-ish audio blob (WAV bytes wrapped)."""
    import io
    import wave

    samples = np.zeros(int(sr * duration), dtype=np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(samples.tobytes())
    raw = buf.getvalue()
    return "data:audio/wav;base64," + base64.b64encode(raw).decode("utf-8")


# ── Test setup ─────────────────────────────────────────────────────────────────

class EduBridgeAPITestCase(unittest.TestCase):
    """Base class that sets up the Flask test client."""

    @classmethod
    def setUpClass(cls):
        flask_app.app.config["TESTING"] = True
        flask_app.app.config["DEBUG"]   = False
        cls.client = flask_app.app.test_client()

    def post_json(self, url, data):
        return self.client.post(
            url,
            data=json.dumps(data),
            content_type="application/json"
        )


# ── GET /api/health ────────────────────────────────────────────────────────────

class TestHealthEndpoint(EduBridgeAPITestCase):

    def test_health_returns_200(self):
        """Health endpoint should return HTTP 200."""
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)

    def test_health_returns_json(self):
        """Health endpoint should return valid JSON."""
        response = self.client.get("/api/health")
        data = json.loads(response.data)
        self.assertIsInstance(data, dict)

    def test_health_contains_status(self):
        """Health response should contain a 'status' field."""
        response = self.client.get("/api/health")
        data = json.loads(response.data)
        self.assertIn("status", data)
        self.assertEqual(data["status"], "ok")

    def test_health_contains_models(self):
        """Health response should contain a 'models' field with three keys."""
        response = self.client.get("/api/health")
        data = json.loads(response.data)
        self.assertIn("models", data)
        self.assertIn("face",    data["models"])
        self.assertIn("audio",   data["models"])
        self.assertIn("chatbot", data["models"])

    def test_health_model_values_are_boolean(self):
        """Each model status value should be a boolean."""
        response = self.client.get("/api/health")
        data = json.loads(response.data)
        for key, val in data["models"].items():
            self.assertIsInstance(val, bool, f"models.{key} should be bool")

    def test_health_contains_tensorflow_version(self):
        """Health response should include the TensorFlow version string."""
        response = self.client.get("/api/health")
        data = json.loads(response.data)
        self.assertIn("tensorflow", data)
        self.assertIsInstance(data["tensorflow"], str)


# ── POST /api/analyze/face ─────────────────────────────────────────────────────

class TestFaceEndpoint(EduBridgeAPITestCase):

    def test_missing_image_returns_400(self):
        """Request with no image field should return 400."""
        response = self.post_json("/api/analyze/face", {})
        self.assertEqual(response.status_code, 400)

    def test_empty_image_returns_400(self):
        """Request with empty image string should return 400."""
        response = self.post_json("/api/analyze/face", {"image": ""})
        self.assertEqual(response.status_code, 400)

    def test_invalid_base64_returns_400(self):
        """Request with invalid base64 should return 400."""
        response = self.post_json("/api/analyze/face", {"image": "not_valid_base64!!!"})
        self.assertEqual(response.status_code, 400)

    def test_valid_image_returns_200_or_503(self):
        """Valid image should return 200 (model loaded) or 503 (model missing)."""
        b64 = make_base64_image()
        response = self.post_json("/api/analyze/face", {"image": b64})
        self.assertIn(response.status_code, [200, 503])

    def test_valid_image_response_structure_when_loaded(self):
        """If face model is loaded, response should have correct structure."""
        from models import face as face_model
        if not face_model.is_loaded:
            self.skipTest("Face model not loaded")

        b64 = make_base64_image()
        response = self.post_json("/api/analyze/face", {"image": b64})
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertIn("has_face", data)
        self.assertIsInstance(data["has_face"], bool)

    def test_no_face_response_has_false_has_face(self):
        """Blank image (no face) should return has_face: false."""
        from models import face as face_model
        if not face_model.is_loaded:
            self.skipTest("Face model not loaded")

        # Solid colour image — very unlikely to trigger Haar cascade
        blank = np.zeros((200, 200, 3), dtype=np.uint8)
        _, buf = cv2.imencode(".jpg", blank)
        b64 = "data:image/jpeg;base64," + base64.b64encode(buf).decode("utf-8")

        response = self.post_json("/api/analyze/face", {"image": b64})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertFalse(data["has_face"])

    def test_face_detected_response_fields(self):
        """When has_face is True, all fields should be present."""
        from models import face as face_model
        if not face_model.is_loaded:
            self.skipTest("Face model not loaded")

        b64 = make_base64_image()
        response = self.post_json("/api/analyze/face", {"image": b64})
        data = json.loads(response.data)

        if data.get("has_face"):
            for field in ("emotion", "confidence", "is_stressed", "all_probabilities"):
                self.assertIn(field, data)
            self.assertIsInstance(data["confidence"], float)
            self.assertIsInstance(data["is_stressed"], bool)
            self.assertIsInstance(data["all_probabilities"], dict)

    def test_503_when_model_not_loaded(self):
        """Should return 503 when face model is not loaded."""
        from models import face as face_mod
        original = face_mod.is_loaded
        face_mod.is_loaded = False
        response = self.post_json("/api/analyze/face", {"image": make_base64_image()})
        self.assertEqual(response.status_code, 503)
        face_mod.is_loaded = original


# ── POST /api/analyze/voice ────────────────────────────────────────────────────

class TestVoiceEndpoint(EduBridgeAPITestCase):

    def test_missing_audio_returns_400(self):
        """Request with no audio field should return 400."""
        response = self.post_json("/api/analyze/voice", {})
        self.assertEqual(response.status_code, 400)

    def test_empty_audio_returns_400(self):
        """Request with empty audio string should return 400."""
        response = self.post_json("/api/analyze/voice", {"audio": ""})
        self.assertEqual(response.status_code, 400)

    def test_invalid_audio_returns_400(self):
        """Request with invalid audio data should return 400."""
        response = self.post_json("/api/analyze/voice", {"audio": "invalid_audio_data"})
        self.assertIn(response.status_code, [400, 503])

    def test_valid_audio_returns_200_or_503(self):
        """Valid audio should return 200 (model loaded) or 503 (model missing)."""
        b64 = make_base64_audio()
        response = self.post_json("/api/analyze/voice", {"audio": b64})
        self.assertIn(response.status_code, [200, 503])

    def test_voice_response_structure_when_loaded(self):
        """If voice model is loaded, response should have correct structure."""
        from models import voice as voice_model
        if not voice_model.is_loaded:
            self.skipTest("Voice model not loaded")

        b64 = make_base64_audio()
        response = self.post_json("/api/analyze/voice", {"audio": b64})
        if response.status_code == 200:
            data = json.loads(response.data)
            for field in ("label", "confidence", "is_stressed", "all_probabilities"):
                self.assertIn(field, data)

    def test_voice_label_is_uppercase_when_loaded(self):
        """Voice label should be uppercase."""
        from models import voice as voice_model
        if not voice_model.is_loaded:
            self.skipTest("Voice model not loaded")

        b64 = make_base64_audio()
        response = self.post_json("/api/analyze/voice", {"audio": b64})
        if response.status_code == 200:
            data = json.loads(response.data)
            self.assertEqual(data["label"], data["label"].upper())

    def test_503_when_model_not_loaded(self):
        """Should return 503 when voice model is not loaded."""
        from models import voice as voice_mod
        original = voice_mod.is_loaded
        voice_mod.is_loaded = False
        response = self.post_json("/api/analyze/voice", {"audio": make_base64_audio()})
        self.assertEqual(response.status_code, 503)
        voice_mod.is_loaded = original


# ── POST /api/analyze/combined ─────────────────────────────────────────────────

class TestCombinedEndpoint(EduBridgeAPITestCase):

    def _combined_payload(self, face_ratio=0.3, face_emotion="neutral",
                           voice_label="NORMAL", voice_conf=0.6):
        return {
            "face_ratio":   face_ratio,
            "face_emotion": face_emotion,
            "voice_label":  voice_label,
            "voice_conf":   voice_conf,
        }

    def test_returns_200(self):
        """Combined endpoint should return 200."""
        response = self.post_json("/api/analyze/combined", self._combined_payload())
        self.assertEqual(response.status_code, 200)

    def test_response_contains_required_fields(self):
        """Combined response should contain all required fields."""
        response = self.post_json("/api/analyze/combined", self._combined_payload())
        data = json.loads(response.data)
        for field in ("face_emotion", "face_ratio", "voice_label", "voice_conf",
                      "final_score", "stress_level", "timestamp"):
            self.assertIn(field, data)

    def test_final_score_calculation_normal(self):
        """Final score = face_ratio * 0.6 + 0 for NORMAL voice."""
        payload = self._combined_payload(face_ratio=0.5, voice_label="NORMAL", voice_conf=0.8)
        response = self.post_json("/api/analyze/combined", payload)
        data = json.loads(response.data)
        expected = round(0.5 * 0.6 + 0.0 * 0.4, 4)
        self.assertAlmostEqual(data["final_score"], expected, places=3)

    def test_final_score_calculation_stressed(self):
        """Final score = face_ratio * 0.6 + voice_conf * 0.4 for STRESSED voice."""
        payload = self._combined_payload(face_ratio=0.6, voice_label="STRESSED", voice_conf=0.8)
        response = self.post_json("/api/analyze/combined", payload)
        data = json.loads(response.data)
        expected = round(0.6 * 0.6 + 0.8 * 0.4, 4)
        self.assertAlmostEqual(data["final_score"], expected, places=3)

    def test_high_stress_level_when_score_above_threshold(self):
        """Stress level should be HIGH when final score >= 0.5."""
        payload = self._combined_payload(face_ratio=0.8, voice_label="STRESSED", voice_conf=0.9)
        response = self.post_json("/api/analyze/combined", payload)
        data = json.loads(response.data)
        self.assertEqual(data["stress_level"], "HIGH")

    def test_normal_stress_level_when_score_below_threshold(self):
        """Stress level should be NORMAL when final score < 0.5."""
        payload = self._combined_payload(face_ratio=0.1, voice_label="NORMAL", voice_conf=0.2)
        response = self.post_json("/api/analyze/combined", payload)
        data = json.loads(response.data)
        self.assertEqual(data["stress_level"], "NORMAL")

    def test_empty_payload_uses_defaults(self):
        """Empty payload should not raise — defaults should be used."""
        response = self.post_json("/api/analyze/combined", {})
        self.assertEqual(response.status_code, 200)

    def test_timestamp_is_present(self):
        """Response should contain a timestamp string."""
        response = self.post_json("/api/analyze/combined", self._combined_payload())
        data = json.loads(response.data)
        self.assertIsInstance(data["timestamp"], str)
        self.assertGreater(len(data["timestamp"]), 0)

    def test_face_ratio_is_rounded(self):
        """face_ratio in response should be rounded to 4 decimal places."""
        payload = self._combined_payload(face_ratio=0.123456789)
        response = self.post_json("/api/analyze/combined", payload)
        data = json.loads(response.data)
        # Should be rounded to 4dp
        self.assertEqual(data["face_ratio"], round(0.123456789, 4))

    def test_report_is_persisted_after_combined(self):
        """After a combined request, /api/report should return a report."""
        self.post_json("/api/analyze/combined", self._combined_payload(
            face_ratio=0.4, face_emotion="sad",
            voice_label="STRESSED", voice_conf=0.75
        ))
        response = self.client.get("/api/report")
        self.assertEqual(response.status_code, 200)


# ── POST /api/chat ─────────────────────────────────────────────────────────────

class TestChatEndpoint(EduBridgeAPITestCase):

    def test_missing_message_returns_400(self):
        """Request with no message field should return 400."""
        response = self.post_json("/api/chat", {})
        self.assertEqual(response.status_code, 400)

    def test_empty_message_returns_400(self):
        """Request with empty message should return 400."""
        response = self.post_json("/api/chat", {"message": ""})
        self.assertEqual(response.status_code, 400)

    def test_whitespace_only_returns_400(self):
        """Request with whitespace-only message should return 400."""
        response = self.post_json("/api/chat", {"message": "   "})
        self.assertEqual(response.status_code, 400)

    def test_valid_message_returns_200_or_503(self):
        """Valid message should return 200 or 503."""
        response = self.post_json("/api/chat", {"message": "Hello"})
        self.assertIn(response.status_code, [200, 503])

    def test_chat_response_structure(self):
        """Chat response should contain required fields."""
        from models import chatbot as chatbot_model
        if not chatbot_model.is_loaded:
            self.skipTest("Chatbot model not loaded")

        response = self.post_json("/api/chat", {"message": "Hello"})
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        for field in ("tag", "response", "confidence", "scores", "timestamp"):
            self.assertIn(field, data)

    def test_chat_response_is_string(self):
        """Response text should be a non-empty string."""
        from models import chatbot as chatbot_model
        if not chatbot_model.is_loaded:
            self.skipTest("Chatbot model not loaded")

        response = self.post_json("/api/chat", {"message": "I feel stressed"})
        data = json.loads(response.data)
        self.assertIsInstance(data["response"], str)
        self.assertGreater(len(data["response"]), 0)

    def test_confidence_is_valid(self):
        """Confidence should be between 0 and 1."""
        from models import chatbot as chatbot_model
        if not chatbot_model.is_loaded:
            self.skipTest("Chatbot model not loaded")

        response = self.post_json("/api/chat", {"message": "I feel stressed"})
        data = json.loads(response.data)
        self.assertGreaterEqual(data["confidence"], 0.0)
        self.assertLessEqual(data["confidence"], 1.0)

    def test_503_when_model_not_loaded(self):
        """Should return 503 when chatbot model is not loaded."""
        from models import chatbot as chatbot_mod
        original = chatbot_mod.is_loaded
        chatbot_mod.is_loaded = False
        response = self.post_json("/api/chat", {"message": "Hello"})
        self.assertEqual(response.status_code, 503)
        chatbot_mod.is_loaded = original

    def test_multiple_messages_return_different_responses(self):
        """Different messages should generally produce different responses."""
        from models import chatbot as chatbot_model
        if not chatbot_model.is_loaded:
            self.skipTest("Chatbot model not loaded")

        r1 = json.loads(self.post_json("/api/chat", {"message": "Hello"}).data)
        r2 = json.loads(self.post_json("/api/chat", {"message": "I want to give up"}).data)
        # Tags should be different for clearly different intents
        self.assertNotEqual(r1["tag"], r2["tag"])


# ── GET /api/report ────────────────────────────────────────────────────────────

class TestReportEndpoint(EduBridgeAPITestCase):

    def test_report_returns_404_when_no_data(self):
        """Report endpoint should return 404 if no report has been generated yet."""
        from routes.report import _reports, _latest_report
        import routes.report as report_mod
        original_latest = report_mod._latest_report
        report_mod._latest_report = None

        response = self.client.get("/api/report")
        self.assertEqual(response.status_code, 404)
        report_mod._latest_report = original_latest

    def test_report_returns_200_after_combined(self):
        """After a combined analysis, /api/report should return 200."""
        self.post_json("/api/analyze/combined", {
            "face_ratio":   0.4,
            "face_emotion": "neutral",
            "voice_label":  "NORMAL",
            "voice_conf":   0.6,
        })
        response = self.client.get("/api/report")
        self.assertEqual(response.status_code, 200)

    def test_report_contains_required_fields(self):
        """Report response should contain all required fields."""
        self.post_json("/api/analyze/combined", {
            "face_ratio":   0.5,
            "face_emotion": "sad",
            "voice_label":  "STRESSED",
            "voice_conf":   0.7,
        })
        data = json.loads(self.client.get("/api/report").data)
        for field in ("face_emotion", "face_ratio", "voice_label",
                      "voice_conf", "final_score", "stress_level", "timestamp"):
            self.assertIn(field, data)

    def test_report_stress_level_is_valid(self):
        """Stress level in report should be HIGH or NORMAL."""
        self.post_json("/api/analyze/combined", {
            "face_ratio": 0.3, "face_emotion": "neutral",
            "voice_label": "NORMAL", "voice_conf": 0.5
        })
        data = json.loads(self.client.get("/api/report").data)
        self.assertIn(data["stress_level"], ("HIGH", "NORMAL"))


# ── GET /api/report/history ────────────────────────────────────────────────────

class TestReportHistoryEndpoint(EduBridgeAPITestCase):

    def test_history_returns_200(self):
        """History endpoint should always return 200."""
        response = self.client.get("/api/report/history")
        self.assertEqual(response.status_code, 200)

    def test_history_returns_reports_list(self):
        """History response should contain a 'reports' key with a list."""
        response = self.client.get("/api/report/history")
        data = json.loads(response.data)
        self.assertIn("reports", data)
        self.assertIsInstance(data["reports"], list)

    def test_history_grows_after_combined_requests(self):
        """Each combined request should add an entry to history."""
        initial = len(json.loads(self.client.get("/api/report/history").data)["reports"])

        self.post_json("/api/analyze/combined", {
            "face_ratio": 0.4, "face_emotion": "happy",
            "voice_label": "NORMAL", "voice_conf": 0.6
        })

        updated = len(json.loads(self.client.get("/api/report/history").data)["reports"])
        self.assertEqual(updated, initial + 1)

    def test_history_most_recent_first(self):
        """History should be returned most recent first."""
        self.post_json("/api/analyze/combined", {
            "face_ratio": 0.1, "face_emotion": "happy",
            "voice_label": "NORMAL", "voice_conf": 0.3
        })
        self.post_json("/api/analyze/combined", {
            "face_ratio": 0.9, "face_emotion": "angry",
            "voice_label": "STRESSED", "voice_conf": 0.9
        })
        data = json.loads(self.client.get("/api/report/history").data)
        if len(data["reports"]) >= 2:
            # Most recent should have higher stress (angry + STRESSED)
            self.assertEqual(data["reports"][0]["face_emotion"], "angry")


if __name__ == "__main__":
    unittest.main(verbosity=2)
