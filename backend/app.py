import os
import logging

import tensorflow as tf
from flask import Flask, jsonify
from flask_cors import CORS

from utils import load_class_index
from models import face as face_model
from models import voice as voice_model
from models import chatbot as chatbot_model
from routes.face    import face_bp
from routes.voice   import voice_bp
from routes.chatbot import chatbot_bp
from routes.report  import report_bp, load_reports

# ── Logging ────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ────────────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ── Blueprints ─────────────────────────────────────────────────────────────────

app.register_blueprint(face_bp)
app.register_blueprint(voice_bp)
app.register_blueprint(chatbot_bp)
app.register_blueprint(report_bp)

# ── Health ─────────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "models": {
            "face":    face_model.is_loaded,
            "audio":   voice_model.is_loaded,
            "chatbot": chatbot_model.is_loaded,
        },
        "tensorflow": tf.__version__,
    })

# ── Startup ────────────────────────────────────────────────────────────────────

BASE        = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR  = os.path.join(BASE, "saved_models")

load_reports()

face_model.load(load_class_index(os.path.join(MODELS_DIR, "face_class_indices.json")))
voice_model.load(load_class_index(os.path.join(MODELS_DIR, "audio_class_indices.json")))
chatbot_model.load(MODELS_DIR)

# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 8000))
    debug = os.environ.get("FLASK_ENV", "production") == "development"
    logger.info("EduBridge API → http://0.0.0.0:%d", port)
    app.run(host="0.0.0.0", port=port, debug=debug)
