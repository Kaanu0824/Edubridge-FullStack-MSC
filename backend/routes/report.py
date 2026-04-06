"""
routes/report.py — Stress report endpoints.

POST /api/analyze/combined
GET  /api/report
GET  /api/report/history
"""

import os
import json
import datetime
import logging

from flask import Blueprint, request, jsonify

logger    = logging.getLogger(__name__)
report_bp = Blueprint("report", __name__)

BASE        = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORTS_DIR = os.path.join(BASE, "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

LIMIT          = 100
_reports       = []
_latest_report = None


def load_reports():
    global _reports, _latest_report
    path = os.path.join(REPORTS_DIR, "history.json")
    if not os.path.exists(path):
        return
    try:
        with open(path) as f:
            _reports = json.load(f)
        if _reports:
            _latest_report = _reports[-1]
        logger.info("Loaded %d reports", len(_reports))
    except Exception as exc:
        logger.warning("Could not load reports: %s", exc)


def _save():
    try:
        with open(os.path.join(REPORTS_DIR, "history.json"), "w") as f:
            json.dump(_reports[-LIMIT:], f)
    except Exception as exc:
        logger.warning("Could not save reports: %s", exc)


@report_bp.route("/api/analyze/combined", methods=["POST"])
def analyze_combined():
    global _latest_report
    data         = request.get_json(silent=True) or {}
    face_ratio   = float(data.get("face_ratio",   0.0))
    face_emotion = data.get("face_emotion",        "neutral")
    voice_label  = data.get("voice_label",         "NORMAL")
    voice_conf   = float(data.get("voice_conf",    0.0))

    voice_stress = voice_conf if voice_label == "STRESSED" else 0.0
    final_score  = round((face_ratio * 0.6) + (voice_stress * 0.4), 4)

    report = {
        "face_emotion": face_emotion,
        "face_ratio":   round(face_ratio, 4),
        "voice_label":  voice_label,
        "voice_conf":   round(voice_conf, 4),
        "final_score":  final_score,
        "stress_level": "HIGH" if final_score >= 0.5 else "NORMAL",
        "timestamp":    datetime.datetime.utcnow().isoformat() + "Z",
    }

    _latest_report = report
    _reports.append(report)
    _save()
    return jsonify(report)


@report_bp.route("/api/report", methods=["GET"])
def get_latest():
    if _latest_report is None:
        return jsonify({"error": "No report yet"}), 404
    return jsonify(_latest_report)


@report_bp.route("/api/report/history", methods=["GET"])
def get_history():
    return jsonify({"reports": list(reversed(_reports))})
