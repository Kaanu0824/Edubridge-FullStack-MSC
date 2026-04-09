import logging
import cv2
from flask import Blueprint, request, jsonify
from models import face as face_model
from utils import decode_base64_image

logger  = logging.getLogger(__name__)
face_bp = Blueprint("face", __name__)


@face_bp.route("/api/analyze/face", methods=["POST"])
def analyze_face():
    if not face_model.is_loaded:
        return jsonify({"error": "Face model not loaded"}), 503

    data = request.get_json(silent=True) or {}
    b64  = data.get("image", "")
    if not b64:
        return jsonify({"error": "No image provided"}), 400

    img = decode_base64_image(b64)
    if img is None:
        return jsonify({"error": "Could not decode image"}), 400

    # Enhance contrast for low-light webcam frames
    img      = _enhance(img)
    face_arr = face_model.detect_face(img)

    if face_arr is None:
        return jsonify({
            "has_face":          False,
            "emotion":           None,
            "confidence":        0.0,
            "is_stressed":       False,
            "all_probabilities": {},
        })

    result = face_model.predict(face_arr)
    return jsonify({"has_face": True, **result})


def _enhance(img):
    """CLAHE contrast enhancement for better face detection."""
    lab              = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b          = cv2.split(lab)
    clahe            = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced         = cv2.merge((clahe.apply(l), a, b))
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
