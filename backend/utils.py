"""
utils.py — Shared utility functions for EduBridge backend.
"""

import os
import json
import base64
import tempfile
import logging

import cv2
import numpy as np
import librosa
import soundfile as sf

logger = logging.getLogger(__name__)

MFCC_FEATURES     = 40
AUDIO_SAMPLE_RATE = 22050


def decode_base64_image(b64: str):
    """Decode a base64 image string into a BGR numpy array."""
    try:
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        buf = np.frombuffer(base64.b64decode(b64), dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        if img is None:
            return None
        h, w = img.shape[:2]
        if w > 1280:
            img = cv2.resize(img, (1280, int(h * 1280 / w)))
        return img
    except Exception as exc:
        logger.warning("Image decode failed: %s", exc)
        return None


def decode_base64_audio(b64: str):
    """Decode a base64 audio string. Returns (samples, sr) or None."""
    try:
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        audio_bytes = base64.b64decode(b64)
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        try:
            y, sr = librosa.load(tmp_path, sr=AUDIO_SAMPLE_RATE)
        except Exception:
            data, sr = sf.read(tmp_path)
            y = data.astype("float32")
            if y.ndim > 1:
                y = y.mean(axis=1)
        finally:
            os.unlink(tmp_path)
        return y, sr
    except Exception as exc:
        logger.warning("Audio decode failed: %s", exc)
        return None


def extract_mfcc(y: np.ndarray, sr: int, n_mfcc: int = MFCC_FEATURES) -> np.ndarray:
    """Return mean MFCC feature vector of shape (n_mfcc,)."""
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)
    return np.mean(mfcc.T, axis=0)


def load_class_index(path: str) -> dict:
    """Load {label: index} JSON and return inverted {index: label} dict."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"Class index file not found: {path}")
    with open(path) as f:
        raw = json.load(f)
    return {v: k for k, v in raw.items()}
