import os
import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)

BASE              = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR        = os.path.join(BASE, "saved_models")
STRESSED_EMOTIONS = {"angry", "fear", "sad"}

_model    = None
_classes  = {}
is_loaded = False


def load(class_map: dict) -> bool:
    global _model, _classes, is_loaded
    _classes = class_map

    try:
        import keras
        import tensorflow as tf
    except ImportError as e:
        logger.error("Import error: %s", e)
        return False

    for fname in ("face_model.keras", "face_model.h5"):
        path = os.path.join(MODELS_DIR, fname)
        if not os.path.exists(path):
            continue
        for loader, tag in [
            (lambda p: keras.models.load_model(p, compile=False), "keras3"),
            (lambda p: tf.keras.models.load_model(p, compile=False), "tf.keras"),
        ]:
            try:
                _model    = loader(path)
                is_loaded = True
                logger.info("Face model loaded (%s via %s)", fname, tag)
                logger.info("Input: %s  Output: %s", _model.input_shape, _model.output_shape)
                return True
            except Exception as exc:
                logger.warning("Face model failed (%s via %s): %s", fname, tag, exc)

    logger.error("Face model not found in saved_models/")
    return False


def detect_face(img: np.ndarray):
    """Detect and preprocess face. Returns (48,48,3) float32 or None."""
    gray         = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    cascade      = cv2.CascadeClassifier(cascade_path)

    if cascade.empty():
        logger.error("Haar cascade failed to load")
        return None

    faces = []
    for cfg in [
        {"scaleFactor": 1.1,  "minNeighbors": 5, "minSize": (30, 30)},
        {"scaleFactor": 1.05, "minNeighbors": 3, "minSize": (20, 20)},
        {"scaleFactor": 1.3,  "minNeighbors": 3, "minSize": (20, 20)},
    ]:
        faces = cascade.detectMultiScale(gray, **cfg)
        if len(faces) > 0:
            break

    if len(faces) == 0:
        return None

    x, y, w, h  = max(faces, key=lambda f: f[2] * f[3])
    pad          = int(min(w, h) * 0.1)
    ih, iw       = img.shape[:2]
    x1, y1       = max(0, x - pad), max(0, y - pad)
    x2, y2       = min(iw, x + w + pad), min(ih, y + h + pad)
    roi          = cv2.cvtColor(img[y1:y2, x1:x2], cv2.COLOR_BGR2RGB)
    return cv2.resize(roi, (48, 48)).astype("float32") / 255.0


def predict(face_arr: np.ndarray) -> dict:
    if _model is None:
        raise RuntimeError("Face model not loaded")
    preds      = _model.predict(np.expand_dims(face_arr, 0), verbose=0)[0]
    top_idx    = int(np.argmax(preds))
    emotion    = _classes.get(top_idx, "unknown")
    confidence = float(preds[top_idx])
    logger.info("Face: %s (%.1f%%)", emotion, confidence * 100)
    return {
        "emotion":           emotion,
        "confidence":        confidence,
        "is_stressed":       emotion in STRESSED_EMOTIONS,
        "all_probabilities": {_classes.get(i, str(i)): float(preds[i]) for i in range(len(preds))},
    }
