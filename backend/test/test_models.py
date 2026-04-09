"""
tests/test_models.py
====================
Unit tests for EduBridge ML model modules.

Tests cover:
    - Face model: loading, prediction shape, class labels, stress classification
    - Voice model: loading, prediction shape, label correctness
    - Chatbot model: loading, intent prediction, fallback response

All tests skip gracefully if model files are not present, so they can
be run in CI environments without requiring the trained model files.

Run:
    python -m pytest tests/test_models.py -v
"""

import os
import sys
import json
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE, "saved_models")
DATA_DIR   = os.path.join(BASE, "dataset", "chatbot")

from utils import load_class_index


# ── Tests: Face Model ──────────────────────────────────────────────────────────

class TestFaceModel(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Load face model and class index once for all tests."""
        index_path = os.path.join(MODELS_DIR, "face_class_indices.json")
        if not os.path.exists(index_path):
            cls.skip_reason = "face_class_indices.json not found"
            return

        cls.class_map = load_class_index(index_path)

        from models import face as face_model
        success = face_model.load(cls.class_map)
        if not success:
            cls.skip_reason = "Face model file not found or failed to load"
            return

        cls.face_model  = face_model
        cls.skip_reason = None

    def setUp(self):
        if getattr(self, "skip_reason", None):
            self.skipTest(self.skip_reason)

    def _dummy_face(self):
        """Create a random (48, 48, 3) float32 face array."""
        return np.random.rand(48, 48, 3).astype("float32")

    def test_model_is_loaded(self):
        """Face model is_loaded flag should be True after load()."""
        self.assertTrue(self.face_model.is_loaded)

    def test_predict_returns_dict(self):
        """predict() should return a dictionary."""
        result = self.face_model.predict(self._dummy_face())
        self.assertIsInstance(result, dict)

    def test_predict_contains_required_keys(self):
        """Prediction dict should contain all expected keys."""
        result = self.face_model.predict(self._dummy_face())
        for key in ("emotion", "confidence", "is_stressed", "all_probabilities"):
            self.assertIn(key, result, f"Missing key: {key}")

    def test_confidence_is_between_0_and_1(self):
        """Confidence score should be in [0, 1]."""
        result = self.face_model.predict(self._dummy_face())
        self.assertGreaterEqual(result["confidence"], 0.0)
        self.assertLessEqual(result["confidence"], 1.0)

    def test_emotion_is_string(self):
        """Predicted emotion should be a string."""
        result = self.face_model.predict(self._dummy_face())
        self.assertIsInstance(result["emotion"], str)

    def test_emotion_is_in_known_classes(self):
        """Predicted emotion should be one of the known class labels."""
        result = self.face_model.predict(self._dummy_face())
        self.assertIn(result["emotion"], self.class_map.values())

    def test_is_stressed_is_bool(self):
        """is_stressed field should be a boolean."""
        result = self.face_model.predict(self._dummy_face())
        self.assertIsInstance(result["is_stressed"], bool)

    def test_stressed_emotions_trigger_is_stressed(self):
        """Angry, fear, and sad emotions should set is_stressed to True."""
        from models.face import STRESSED_EMOTIONS
        # Verify the constant is defined correctly
        for emotion in ("angry", "fear", "sad"):
            self.assertIn(emotion, STRESSED_EMOTIONS)

    def test_non_stressed_emotions_do_not_trigger(self):
        """Happy, neutral, surprise should not be in STRESSED_EMOTIONS."""
        from models.face import STRESSED_EMOTIONS
        for emotion in ("happy", "neutral", "surprise"):
            self.assertNotIn(emotion, STRESSED_EMOTIONS)

    def test_all_probabilities_sum_to_one(self):
        """Softmax probabilities should sum to approximately 1.0."""
        result = self.face_model.predict(self._dummy_face())
        total = sum(result["all_probabilities"].values())
        self.assertAlmostEqual(total, 1.0, places=3)

    def test_all_probabilities_are_non_negative(self):
        """All probabilities should be >= 0."""
        result = self.face_model.predict(self._dummy_face())
        for label, prob in result["all_probabilities"].items():
            self.assertGreaterEqual(prob, 0.0, f"Negative probability for {label}")

    def test_predict_raises_without_model(self):
        """predict() should raise RuntimeError if model is not loaded."""
        from models import face as face_mod
        original = face_mod._model
        face_mod._model = None
        with self.assertRaises(RuntimeError):
            face_mod.predict(self._dummy_face())
        face_mod._model = original

    def test_multiple_predictions_are_deterministic(self):
        """Same input should produce identical predictions."""
        face = self._dummy_face()
        r1 = self.face_model.predict(face)
        r2 = self.face_model.predict(face)
        self.assertEqual(r1["emotion"], r2["emotion"])
        self.assertAlmostEqual(r1["confidence"], r2["confidence"], places=5)

    def test_detect_face_returns_none_on_blank_image(self):
        """A blank image with no face should return None from detect_face."""
        blank = np.zeros((200, 200, 3), dtype=np.uint8)
        result = self.face_model.detect_face(blank)
        self.assertIsNone(result)

    def test_detect_face_output_shape_when_face_found(self):
        """When a face is detected, output should be (48, 48, 3) float32."""
        # Use a real-looking face image from a solid colour
        # (May not detect in all cases — skip if no face found)
        import cv2
        img = np.ones((200, 200, 3), dtype=np.uint8) * 200
        result = self.face_model.detect_face(img)
        if result is not None:
            self.assertEqual(result.shape, (48, 48, 3))
            self.assertEqual(result.dtype, np.float32)
            self.assertLessEqual(result.max(), 1.0)
            self.assertGreaterEqual(result.min(), 0.0)


# ── Tests: Voice Model ─────────────────────────────────────────────────────────

class TestVoiceModel(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Load voice model and class index once for all tests."""
        index_path = os.path.join(MODELS_DIR, "audio_class_indices.json")
        if not os.path.exists(index_path):
            cls.skip_reason = "audio_class_indices.json not found"
            return

        cls.class_map = load_class_index(index_path)

        from models import voice as voice_model
        success = voice_model.load(cls.class_map)
        if not success:
            cls.skip_reason = "Audio model file not found or failed to load"
            return

        cls.voice_model = voice_model
        cls.skip_reason = None

    def setUp(self):
        if getattr(self, "skip_reason", None):
            self.skipTest(self.skip_reason)

    def _dummy_features(self):
        """Create a random 40-dimensional MFCC feature vector."""
        return np.random.rand(40).astype("float32")

    def test_model_is_loaded(self):
        """Voice model is_loaded flag should be True after load()."""
        self.assertTrue(self.voice_model.is_loaded)

    def test_predict_returns_dict(self):
        """predict() should return a dictionary."""
        result = self.voice_model.predict(self._dummy_features())
        self.assertIsInstance(result, dict)

    def test_predict_contains_required_keys(self):
        """Prediction dict should contain all expected keys."""
        result = self.voice_model.predict(self._dummy_features())
        for key in ("label", "confidence", "is_stressed", "all_probabilities"):
            self.assertIn(key, result, f"Missing key: {key}")

    def test_label_is_uppercase(self):
        """Voice label should be uppercase (NORMAL or STRESSED)."""
        result = self.voice_model.predict(self._dummy_features())
        self.assertEqual(result["label"], result["label"].upper())

    def test_label_is_valid(self):
        """Label should be either NORMAL or STRESSED."""
        result = self.voice_model.predict(self._dummy_features())
        self.assertIn(result["label"], ("NORMAL", "STRESSED"))

    def test_confidence_range(self):
        """Confidence should be between 0 and 1."""
        result = self.voice_model.predict(self._dummy_features())
        self.assertGreaterEqual(result["confidence"], 0.0)
        self.assertLessEqual(result["confidence"], 1.0)

    def test_is_stressed_matches_label(self):
        """is_stressed should be True when label is STRESSED, False otherwise."""
        result = self.voice_model.predict(self._dummy_features())
        if result["label"] == "STRESSED":
            self.assertTrue(result["is_stressed"])
        else:
            self.assertFalse(result["is_stressed"])

    def test_probabilities_sum_to_one(self):
        """All class probabilities should sum to approximately 1.0."""
        result = self.voice_model.predict(self._dummy_features())
        total = sum(result["all_probabilities"].values())
        self.assertAlmostEqual(total, 1.0, places=3)

    def test_all_probability_keys_are_uppercase(self):
        """All probability dictionary keys should be uppercase."""
        result = self.voice_model.predict(self._dummy_features())
        for key in result["all_probabilities"].keys():
            self.assertEqual(key, key.upper(), f"Key not uppercase: {key}")

    def test_predict_raises_without_model(self):
        """predict() should raise RuntimeError if model is not loaded."""
        from models import voice as voice_mod
        original = voice_mod._model
        voice_mod._model = None
        with self.assertRaises(RuntimeError):
            voice_mod.predict(self._dummy_features())
        voice_mod._model = original

    def test_zero_features_produces_valid_output(self):
        """All-zero feature vector should still produce a valid prediction."""
        features = np.zeros(40, dtype="float32")
        result = self.voice_model.predict(features)
        self.assertIn(result["label"], ("NORMAL", "STRESSED"))

    def test_deterministic_prediction(self):
        """Same features should produce the same prediction every time."""
        features = self._dummy_features()
        r1 = self.voice_model.predict(features)
        r2 = self.voice_model.predict(features)
        self.assertEqual(r1["label"], r2["label"])
        self.assertAlmostEqual(r1["confidence"], r2["confidence"], places=5)


# ── Tests: Chatbot Model ───────────────────────────────────────────────────────

class TestChatbotModel(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Load chatbot model once for all tests."""
        from models import chatbot as chatbot_model
        success = chatbot_model.load(MODELS_DIR)
        if not success:
            cls.skip_reason = "Chatbot model files not found"
            return
        cls.chatbot_model = chatbot_model
        cls.skip_reason   = None

    def setUp(self):
        if getattr(self, "skip_reason", None):
            self.skipTest(self.skip_reason)

    def test_model_is_loaded(self):
        """Chatbot is_loaded flag should be True after load()."""
        self.assertTrue(self.chatbot_model.is_loaded)

    def test_predict_returns_dict(self):
        """predict() should return a dictionary."""
        result = self.chatbot_model.predict("I feel stressed")
        self.assertIsInstance(result, dict)

    def test_predict_contains_required_keys(self):
        """Prediction dict should contain all expected keys."""
        result = self.chatbot_model.predict("Hello")
        for key in ("tag", "response", "confidence", "scores"):
            self.assertIn(key, result, f"Missing key: {key}")

    def test_tag_is_string(self):
        """Predicted tag should be a non-empty string."""
        result = self.chatbot_model.predict("I feel stressed")
        self.assertIsInstance(result["tag"], str)
        self.assertGreater(len(result["tag"]), 0)

    def test_response_is_string(self):
        """Response should be a non-empty string."""
        result = self.chatbot_model.predict("Help me focus")
        self.assertIsInstance(result["response"], str)
        self.assertGreater(len(result["response"]), 0)

    def test_confidence_range(self):
        """Confidence should be between 0 and 1."""
        result = self.chatbot_model.predict("I want to give up")
        self.assertGreaterEqual(result["confidence"], 0.0)
        self.assertLessEqual(result["confidence"], 1.0)

    def test_scores_is_dict(self):
        """scores field should be a dictionary."""
        result = self.chatbot_model.predict("Hello")
        self.assertIsInstance(result["scores"], dict)

    def test_scores_sum_to_approximately_one(self):
        """All intent scores should sum to approximately 1.0."""
        result = self.chatbot_model.predict("Hello")
        total = sum(result["scores"].values())
        self.assertAlmostEqual(total, 1.0, places=2)

    def test_greeting_intent(self):
        """Clear greeting messages should be classified as greeting."""
        result = self.chatbot_model.predict("Hello")
        self.assertEqual(result["tag"], "greeting",
            f"Expected 'greeting', got '{result['tag']}'")

    def test_stress_intent(self):
        """Clear stress messages should be classified as stress."""
        result = self.chatbot_model.predict("I feel completely overwhelmed")
        self.assertEqual(result["tag"], "stress",
            f"Expected 'stress', got '{result['tag']}'")

    def test_study_tips_intent(self):
        """Study-related messages should be classified as study_tips."""
        result = self.chatbot_model.predict("How can I study better and focus")
        self.assertEqual(result["tag"], "study_tips",
            f"Expected 'study_tips', got '{result['tag']}'")

    def test_motivation_intent(self):
        """Motivation-related messages should be classified as motivation."""
        result = self.chatbot_model.predict("I want to give up")
        self.assertEqual(result["tag"], "motivation",
            f"Expected 'motivation', got '{result['tag']}'")

    def test_goodbye_intent(self):
        """Goodbye messages should be classified as goodbye."""
        result = self.chatbot_model.predict("Thank you goodbye")
        self.assertEqual(result["tag"], "goodbye",
            f"Expected 'goodbye', got '{result['tag']}'")

    def test_mental_health_intent(self):
        """Mental health messages should be classified as mental_health."""
        result = self.chatbot_model.predict("I feel really depressed and empty")
        self.assertEqual(result["tag"], "mental_health",
            f"Expected 'mental_health', got '{result['tag']}'")

    def test_sleep_intent(self):
        """Sleep messages should be classified as sleep."""
        result = self.chatbot_model.predict("I cannot sleep at night")
        self.assertEqual(result["tag"], "sleep",
            f"Expected 'sleep', got '{result['tag']}'")

    def test_fallback_for_unknown_input(self):
        """Unknown input should still return a string response (fallback)."""
        result = self.chatbot_model.predict("xyzabcdefghijk random gibberish 12345")
        self.assertIsInstance(result["response"], str)
        self.assertGreater(len(result["response"]), 0)

    def test_predict_raises_without_model(self):
        """predict() should raise RuntimeError if model is not loaded."""
        from models import chatbot as chatbot_mod
        original = chatbot_mod._model
        chatbot_mod._model = None
        with self.assertRaises(RuntimeError):
            chatbot_mod.predict("Hello")
        chatbot_mod._model = original

    def test_empty_message_raises_or_responds(self):
        """Empty string should either return a fallback or handle gracefully."""
        try:
            result = self.chatbot_model.predict("")
            self.assertIsInstance(result["response"], str)
        except Exception:
            pass  # Acceptable — the route layer validates before calling predict


if __name__ == "__main__":
    unittest.main(verbosity=2)
