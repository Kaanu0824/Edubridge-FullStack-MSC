"""
routes/voice.py — Voice stress analysis endpoint.

POST /api/analyze/voice
"""

from flask import Blueprint, request, jsonify
from models import voice as voice_model
from utils import decode_base64_audio, extract_mfcc

voice_bp = Blueprint("voice", __name__)


@voice_bp.route("/api/analyze/voice", methods=["POST"])
def analyze_voice():
    if not voice_model.is_loaded:
        return jsonify({"error": "Audio model not loaded"}), 503

    data = request.get_json(silent=True) or {}
    b64  = data.get("audio", "")
    if not b64:
        return jsonify({"error": "No audio provided"}), 400

    decoded = decode_base64_audio(b64)
    if decoded is None:
        return jsonify({"error": "Could not decode audio"}), 400

    y, sr    = decoded
    features = extract_mfcc(y, sr)
    return jsonify(voice_model.predict(features))
