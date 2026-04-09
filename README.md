# EduBridge — Student Wellbeing AI

> A multimodal AI system for real-time student stress detection using face emotion recognition, voice stress analysis, and an NLP-powered support chatbot.


## Overview

EduBridge is a full-stack research application developed as a University MSc project. It combines computer vision, audio processing, and natural language processing to detect and respond to student stress in real time.

### Key Features

- **Face Emotion Recognition** — CNN-based real-time detection of 6 emotions via webcam using Haar cascade face localisation
- **Voice Stress Detection** — MFCC feature extraction (40 coefficients) with a Dense neural network classifier
- **Support Chatbot** — Intent classification using TF-IDF + Logistic Regression across 14 student wellbeing categories
- **Stress Reports** — Combined face + voice fusion scoring with session history and downloadable reports
- **Analytics Dashboard** — Trend charts, emotion frequency analysis, and stress distribution visualisations

---

## Screenshots

| Dashboard | Face Analysis | Chatbot |
|---|---|---|
| Real-time stress index | Live webcam emotion detection | 14-intent support bot |

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Python 3.12 | Runtime |
| Flask 3.0 | REST API framework |
| TensorFlow 2.21 / Keras | Deep learning models |
| OpenCV | Face detection (Haar cascade) |
| Librosa | Audio feature extraction (MFCC) |
| scikit-learn | Intent classifier (TF-IDF + LR) |
| Flask-CORS | Cross-origin resource sharing |
| Gunicorn | Production WSGI server |

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| React Router v6 | Client-side routing |
| Axios | HTTP client |
| Recharts | Analytics charts |
| Framer Motion | Animations |
| react-webcam | Webcam capture |
| Lucide React | Icons |

---

## Project Structure

```
Edubridge-Full Stack/
├── backend/
│   ├── app.py                      # Flask entry point
│   ├── utils.py                    # Shared helpers
│   ├── requirements.txt
│   ├── Dockerfile
│   │
│   ├── models/
│   │   ├── face.py                 # Face model loader + inference
│   │   ├── voice.py                # Audio model loader + inference
│   │   └── chatbot.py              # Chatbot model loader + inference
│   │
│   ├── routes/
│   │   ├── face.py                 # POST /api/analyze/face
│   │   ├── voice.py                # POST /api/analyze/voice
│   │   ├── chatbot.py              # POST /api/chat
│   │   └── report.py               # GET/POST /api/report
│   │
│   ├── training/
│   │   ├── train_face_model.py     # Train CNN on FER2013
│   │   ├── train_audio_model.py    # Train Dense net on RAVDESS
│   │   └── train_chatbot.py        # Train intent classifier
│   │
│   ├── dataset/
│   │   ├── face/                   # FER2013 dataset (train/test)
│   │   ├── audio/                  # RAVDESS audio files
│   │   └── chatbot/
│   │       └── intents.json        # 14 intent categories
│   │
│   ├── saved_models/               # .keras and .joblib model files
│   └── reports/                    # Generated stress reports
│
└── frontend/
    ├── src/
    │   ├── App.js
    │   ├── index.css
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── FaceAnalysis.jsx
    │   │   ├── VoiceAnalysis.jsx
    │   │   ├── Chatbot.jsx
    │   │   ├── Reports.jsx
    │   │   └── Analytics.jsx
    │   ├── components/
    │   │   ├── Sidebar.jsx
    │   │   ├── StressGauge.jsx
    │   │   └── ToastContainer.jsx
    │   ├── hooks/
    │   │   └── useToast.js
    │   └── utils/
    │       └── api.js
    ├── package.json
    └── Dockerfile
```

---

## Getting Started

### Prerequisites

- Python 3.12
- Node.js 18+
- npm

### Backend Setup

```bash
# 1. Navigate to backend
cd "Edubridge-Full Stack/backend"

# 2. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate        # Mac/Linux


# 3. Install dependencies
pip install -r requirements.txt
pip install tf_keras scikit-learn --upgrade
pip install matplotlib
pip install pytest


# 4. Train chatbot model
python training/train_face_model.py
python training/train_audio_model.py
python training/train_chatbot.py

# 5. Start the API
python app.py
```

The backend will be available at `http://localhost:8000`.

### Frontend Setup

```bash
# 1. Navigate to frontend
cd "Edubridge-Full Stack/frontend"

# 2. Install dependencies
npm install --legacy-peer-deps
npm install ajv@^8 --legacy-peer-deps

# 3. Start development server
npm start
```

The app will be available at `http://localhost:3001`.

---

### Test Case

```bash

# 1. Run everything
python run_tests.py

# 2.Run with detail
python run_tests.py --verbose

# 3.Run one suite only
python run_tests.py --suite fusion
python run_tests.py --suite api


## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check backend and model status |
| POST | `/api/analyze/face` | Analyse face emotion from base64 image |
| POST | `/api/analyze/voice` | Analyse voice stress from base64 audio |
| POST | `/api/analyze/combined` | Fuse face + voice into stress report |
| POST | `/api/chat` | Send message to chatbot |
| GET | `/api/report` | Get latest stress report |
| GET | `/api/report/history` | Get all stored reports |


