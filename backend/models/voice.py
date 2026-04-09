import os
import logging
import numpy as np

logger    = logging.getLogger(__name__)
BASE      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE, "saved_models")

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

    for fname in ("audio_model.keras", "audio_model.h5"):
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
                logger.info("Audio model loaded (%s via %s)", fname, tag)
                return True
            except Exception as exc:
                logger.warning("Audio model failed (%s via %s): %s", fname, tag, exc)

    logger.error("Audio model not found in saved_models/")
    return False


def predict(features: np.ndarray) -> dict:
    if _model is None:
        raise RuntimeError("Audio model not loaded")
    preds      = _model.predict(np.expand_dims(features, 0), verbose=0)[0]
    top_idx    = int(np.argmax(preds))
    label      = _classes.get(top_idx, "unknown").upper()
    confidence = float(preds[top_idx])
    return {
        "label":             label,
        "confidence":        confidence,
        "is_stressed":       label == "STRESSED",
        "all_probabilities": {_classes.get(i, str(i)).upper(): float(preds[i]) for i in range(len(preds))},
    }
