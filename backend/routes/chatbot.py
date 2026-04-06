"""
routes/chatbot.py — Chatbot endpoint.

POST /api/chat
"""

import datetime
from flask import Blueprint, request, jsonify
from models import chatbot as chatbot_model

chatbot_bp = Blueprint("chatbot", __name__)


@chatbot_bp.route("/api/chat", methods=["POST"])
def chat():
    if not chatbot_model.is_loaded:
        return jsonify({"error": "Chatbot model not loaded"}), 503

    data    = request.get_json(silent=True) or {}
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"error": "No message provided"}), 400

    result = chatbot_model.predict(message)
    return jsonify({**result, "timestamp": datetime.datetime.utcnow().isoformat() + "Z"})
