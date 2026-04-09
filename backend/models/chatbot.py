import os
import json
import random
import logging
import numpy as np
import joblib

logger    = logging.getLogger(__name__)
BASE      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE, "saved_models")
DATA_DIR   = os.path.join(BASE, "dataset", "chatbot")

FALLBACK = "I'm here with you. Can you tell me more about how you're feeling?"

_model            = None
_intents          = None
_intent_responses = {}
is_loaded         = False


def load(models_dir: str = None) -> bool:
    global _model, _intents, _intent_responses, is_loaded

    mdir = models_dir or MODELS_DIR
    try:
        _model            = joblib.load(os.path.join(mdir, "intent_model.joblib"))
        _intent_responses = joblib.load(os.path.join(mdir, "intent_data.joblib"))
        with open(os.path.join(DATA_DIR, "intents.json")) as f:
            _intents = json.load(f)
        is_loaded = True
        n = len(_intents.get("intents", []))
        logger.info("Chatbot model loaded (%d intents)", n)
        return True
    except Exception as exc:
        logger.warning("Chatbot model failed: %s", exc)
        return False


def predict(message: str) -> dict:
    if _model is None:
        raise RuntimeError("Chatbot model not loaded")
    proba   = _model.predict_proba([message])[0]
    classes = _model.classes_
    top_tag = str(classes[int(np.argmax(proba))])
    return {
        "tag":        top_tag,
        "response":   _get_response(top_tag),
        "confidence": float(max(proba)),
        "scores":     {str(c): float(p) for c, p in zip(classes, proba)},
    }


def _get_response(tag: str) -> str:
    responses = _intent_responses.get(tag)
    if not responses and _intents:
        for intent in _intents.get("intents", []):
            if intent["tag"] == tag:
                responses = intent["responses"]
                break
    return random.choice(responses) if responses else FALLBACK
