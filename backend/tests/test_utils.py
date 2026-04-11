import os
import sys
import json
import base64
import tempfile
import unittest

import numpy as np
import cv2

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils import (
    decode_base64_image,
    decode_base64_audio,
    extract_mfcc,
    load_class_index,
)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_base64_image(width=100, height=100, channels=3):
    """Create a synthetic BGR image and encode it as base64 JPEG."""
    img = np.random.randint(0, 255, (height, width, channels), dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    return base64.b64encode(buf).decode("utf-8")


def make_base64_image_with_prefix(width=100, height=100):
    """Create a base64 image with a data URI prefix."""
    raw = make_base64_image(width, height)
    return f"data:image/jpeg;base64,{raw}"


def make_silent_audio(duration=3.0, sr=22050):
    """Create a silent audio signal as a numpy array."""
    return np.zeros(int(sr * duration), dtype=np.float32), sr


def make_tone_audio(freq=440, duration=3.0, sr=22050):
    """Create a simple sine wave audio signal."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    return (0.5 * np.sin(2 * np.pi * freq * t)).astype(np.float32), sr


# ── Tests: decode_base64_image ─────────────────────────────────────────────────

class TestDecodeBase64Image(unittest.TestCase):

    def test_decode_valid_jpeg(self):
        """A valid base64 JPEG string should decode to a numpy array."""
        b64 = make_base64_image(100, 100)
        img = decode_base64_image(b64)
        self.assertIsNotNone(img)
        self.assertIsInstance(img, np.ndarray)

    def test_decode_correct_shape(self):
        """Decoded image should have 3 channels (BGR)."""
        b64 = make_base64_image(200, 150)
        img = decode_base64_image(b64)
        self.assertEqual(len(img.shape), 3)
        self.assertEqual(img.shape[2], 3)

    def test_decode_with_data_uri_prefix(self):
        """Base64 string with data:image/jpeg;base64, prefix should still decode."""
        b64 = make_base64_image_with_prefix(100, 100)
        img = decode_base64_image(b64)
        self.assertIsNotNone(img)
        self.assertIsInstance(img, np.ndarray)

    def test_decode_invalid_string_returns_none(self):
        """An invalid base64 string should return None without raising."""
        result = decode_base64_image("this_is_not_valid_base64!!!")
        self.assertIsNone(result)

    def test_decode_empty_string_returns_none(self):
        """An empty string should return None."""
        result = decode_base64_image("")
        self.assertIsNone(result)

    def test_decode_large_image_is_resized(self):
        """Images wider than 1280px should be resized down."""
        b64 = make_base64_image(2000, 1000)
        img = decode_base64_image(b64)
        self.assertIsNotNone(img)
        self.assertLessEqual(img.shape[1], 1280)

    def test_decode_small_image_is_not_resized(self):
        """Images smaller than 1280px should not be resized."""
        b64 = make_base64_image(640, 480)
        img = decode_base64_image(b64)
        self.assertIsNotNone(img)
        self.assertEqual(img.shape[1], 640)

    def test_decode_returns_uint8(self):
        """Decoded image pixel values should be uint8."""
        b64 = make_base64_image(100, 100)
        img = decode_base64_image(b64)
        self.assertEqual(img.dtype, np.uint8)


# ── Tests: extract_mfcc ────────────────────────────────────────────────────────

class TestExtractMFCC(unittest.TestCase):

    def test_output_shape_default(self):
        """MFCC output should be a 1D array of length 40 by default."""
        y, sr = make_tone_audio()
        features = extract_mfcc(y, sr)
        self.assertEqual(features.shape, (40,))

    def test_output_shape_custom_n_mfcc(self):
        """MFCC output length should match the n_mfcc parameter."""
        y, sr = make_tone_audio()
        for n in [20, 40, 60]:
            features = extract_mfcc(y, sr, n_mfcc=n)
            self.assertEqual(features.shape, (n,), f"Expected shape ({n},), got {features.shape}")

    def test_output_is_float(self):
        """MFCC features should be floating-point values."""
        y, sr = make_tone_audio()
        features = extract_mfcc(y, sr)
        self.assertTrue(np.issubdtype(features.dtype, np.floating))

    def test_silent_audio_produces_finite_values(self):
        """Silent audio (all zeros) should still produce finite MFCC values."""
        y, sr = make_silent_audio()
        features = extract_mfcc(y, sr)
        self.assertTrue(np.all(np.isfinite(features)))

    def test_different_signals_produce_different_features(self):
        """Two different audio signals should produce different MFCC vectors."""
        y1, sr = make_tone_audio(freq=440)
        y2, sr = make_tone_audio(freq=880)
        f1 = extract_mfcc(y1, sr)
        f2 = extract_mfcc(y2, sr)
        self.assertFalse(np.allclose(f1, f2),
            "Different audio signals produced identical MFCC features")

    def test_same_signal_produces_same_features(self):
        """The same audio signal should always produce the same MFCC vector."""
        y, sr = make_tone_audio(freq=440)
        f1 = extract_mfcc(y, sr)
        f2 = extract_mfcc(y, sr)
        np.testing.assert_array_equal(f1, f2)


# ── Tests: load_class_index ────────────────────────────────────────────────────

class TestLoadClassIndex(unittest.TestCase):

    def setUp(self):
        """Create a temporary class index JSON file for testing."""
        self.tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        )
        json.dump({"angry": 0, "fear": 1, "happy": 2, "neutral": 3}, self.tmp)
        self.tmp.close()

    def tearDown(self):
        os.unlink(self.tmp.name)

    def test_returns_dict(self):
        """load_class_index should return a dictionary."""
        result = load_class_index(self.tmp.name)
        self.assertIsInstance(result, dict)

    def test_inverts_mapping(self):
        """load_class_index should invert {label: index} to {index: label}."""
        result = load_class_index(self.tmp.name)
        self.assertEqual(result[0], "angry")
        self.assertEqual(result[1], "fear")
        self.assertEqual(result[2], "happy")
        self.assertEqual(result[3], "neutral")

    def test_correct_number_of_classes(self):
        """Result should have the same number of entries as the input file."""
        result = load_class_index(self.tmp.name)
        self.assertEqual(len(result), 4)

    def test_missing_file_raises_error(self):
        """A missing file should raise FileNotFoundError."""
        with self.assertRaises(FileNotFoundError):
            load_class_index("/nonexistent/path/classes.json")

    def test_real_face_class_index(self):
        """Test with the actual face_class_indices.json if it exists."""
        path = os.path.join(BASE, "saved_models", "face_class_indices.json")
        if not os.path.exists(path):
            self.skipTest("face_class_indices.json not found in saved_models/")
        result = load_class_index(path)
        self.assertIsInstance(result, dict)
        self.assertGreater(len(result), 0)
        # All keys should be integers
        for key in result.keys():
            self.assertIsInstance(key, int)
        # All values should be strings
        for val in result.values():
            self.assertIsInstance(val, str)

    def test_real_audio_class_index(self):
        """Test with the actual audio_class_indices.json if it exists."""
        path = os.path.join(BASE, "saved_models", "audio_class_indices.json")
        if not os.path.exists(path):
            self.skipTest("audio_class_indices.json not found in saved_models/")
        result = load_class_index(path)
        self.assertIn(0, result)
        self.assertIn(1, result)


if __name__ == "__main__":
    unittest.main(verbosity=2)
