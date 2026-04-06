"""
train_audio_model.py — Retrain EduBridge audio stress model.

Matches the EXACT architecture of the current audio_model.keras:
    Input:  (40,)  — 40 MFCC features
    Dense(128, relu) → Dense(64, relu) → Dense(n_classes, softmax)

Dataset: RAVDESS (recommended)
    Download: https://www.kaggle.com/datasets/uwrfkaggler/ravdess-emotional-speech-audio

    After downloading, sort .wav files into:
        dataset/audio/normal/    ← calm, neutral, happy audio
        dataset/audio/stressed/  ← angry, fearful, sad audio

    RAVDESS emotion code guide (filename: 03-01-XX-...):
        01 = neutral  → normal/
        02 = calm     → normal/
        03 = happy    → normal/
        04 = sad      → stressed/
        05 = angry    → stressed/
        06 = fearful  → stressed/
        07 = disgust  → stressed/
        08 = surprised→ normal/

Run from backend/:
    python training/train_audio_model.py

Output:
    saved_models/audio_model.keras
    saved_models/audio_class_indices.json
"""

import os
import sys
import json
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import librosa
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight

# ── Paths ──────────────────────────────────────────────────────────────────────

BASE       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR   = os.path.join(BASE, "dataset", "audio")
MODELS_DIR = os.path.join(BASE, "saved_models")
os.makedirs(MODELS_DIR, exist_ok=True)

OUTPUT_MODEL = os.path.join(MODELS_DIR, "audio_model.keras")
OUTPUT_INDEX = os.path.join(MODELS_DIR, "audio_class_indices.json")

# ── Config ─────────────────────────────────────────────────────────────────────

SAMPLE_RATE = 22050
N_MFCC      = 40          # must match app — do not change
DURATION    = 3.0         # seconds to load per file
EPOCHS      = 100
BATCH_SIZE  = 32

# ── Validate ───────────────────────────────────────────────────────────────────

print("=" * 60)
print("EduBridge — Audio Stress Model Training")
print("=" * 60)

if not os.path.exists(DATA_DIR):
    print(f"\nERROR: Dataset not found at: {DATA_DIR}")
    print("\nPlease:")
    print("  1. Download RAVDESS from https://www.kaggle.com/datasets/uwrfkaggler/ravdess-emotional-speech-audio")
    print("  2. Sort files into:")
    print("       backend/dataset/audio/normal/   ← calm, neutral, happy")
    print("       backend/dataset/audio/stressed/ ← angry, fearful, sad")
    sys.exit(1)

classes = sorted([
    c for c in os.listdir(DATA_DIR)
    if os.path.isdir(os.path.join(DATA_DIR, c))
])

if len(classes) == 0:
    print(f"\nERROR: No class folders found in {DATA_DIR}")
    print("Create folders: normal/ and stressed/")
    sys.exit(1)

print(f"\nClasses ({len(classes)}): {classes}")

# ── Feature extraction ─────────────────────────────────────────────────────────

def extract_mfcc(file_path: str) -> np.ndarray:
    """Extract 40-dimensional mean MFCC vector from audio file."""
    try:
        y, sr = librosa.load(file_path, sr=SAMPLE_RATE, duration=DURATION)
        if len(y) == 0:
            return None
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC)
        return np.mean(mfcc.T, axis=0).astype("float32")
    except Exception as e:
        print(f"  Warning: could not process {os.path.basename(file_path)}: {e}")
        return None


label_map = {cls: idx for idx, cls in enumerate(classes)}

print(f"\nLabel map: {label_map}")
print("\nExtracting MFCC features...")

X, y_labels = [], []

for cls in classes:
    cls_dir = os.path.join(DATA_DIR, cls)
    files   = [
        f for f in os.listdir(cls_dir)
        if f.lower().endswith((".wav", ".mp3", ".flac", ".ogg"))
    ]
    print(f"  {cls}: {len(files)} files")

    for fname in files:
        feat = extract_mfcc(os.path.join(cls_dir, fname))
        if feat is not None:
            X.append(feat)
            y_labels.append(label_map[cls])

X        = np.array(X,        dtype="float32")
y_labels = np.array(y_labels, dtype="int32")

print(f"\nTotal valid samples: {len(X)}")
print(f"Feature shape: {X.shape}")

if len(X) < 10:
    print("\nERROR: Not enough audio samples. Need at least 10.")
    sys.exit(1)

# ── Save class index ───────────────────────────────────────────────────────────

with open(OUTPUT_INDEX, "w") as f:
    json.dump(label_map, f, indent=2)
print(f"Saved: {OUTPUT_INDEX}")

# ── Split ──────────────────────────────────────────────────────────────────────

X_train, X_val, y_train, y_val = train_test_split(
    X, y_labels,
    test_size=0.2,
    random_state=42,
    stratify=y_labels,
)

print(f"\nTrain: {len(X_train)}  Val: {len(X_val)}")

cw = compute_class_weight("balanced", classes=np.unique(y_train), y=y_train)
class_weight_dict = dict(enumerate(cw))
print(f"Class weights: { {k: round(v,2) for k,v in class_weight_dict.items()} }")

# ── Model — matches current audio_model.keras architecture exactly ─────────────

n_classes = len(classes)

inputs  = keras.Input(shape=(N_MFCC,), name="input_layer")

# Matches dense / dense_1 / dense_2
x       = layers.Dense(128, activation="relu", name="dense")(inputs)
x       = layers.Dense(64,  activation="relu", name="dense_1")(x)
outputs = layers.Dense(n_classes, activation="softmax", name="dense_2")(x)

model = keras.Model(inputs, outputs, name="audio_stress_model")
model.summary()

model.compile(
    optimizer=keras.optimizers.Adam(0.001),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

# ── Train ──────────────────────────────────────────────────────────────────────

callbacks = [
    keras.callbacks.ModelCheckpoint(
        OUTPUT_MODEL,
        monitor="val_accuracy",
        save_best_only=True,
        verbose=1,
    ),
    keras.callbacks.EarlyStopping(
        monitor="val_accuracy",
        patience=15,
        restore_best_weights=True,
        verbose=1,
    ),
    keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=7,
        min_lr=1e-6,
        verbose=1,
    ),
]

print(f"\nTraining up to {EPOCHS} epochs...")
print(f"Best model auto-saved to: {OUTPUT_MODEL}\n")

history = model.fit(
    X_train, y_train,
    validation_data=(X_val, y_val),
    epochs=EPOCHS,
    batch_size=BATCH_SIZE,
    callbacks=callbacks,
    class_weight=class_weight_dict,
    verbose=1,
)

# ── Evaluate ───────────────────────────────────────────────────────────────────

loss, acc = model.evaluate(X_val, y_val, verbose=0)
print(f"\nValidation Accuracy : {acc:.2%}")
print(f"Validation Loss     : {loss:.4f}")

# ── Plot ───────────────────────────────────────────────────────────────────────

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
ax1.plot(history.history["accuracy"],     label="Train")
ax1.plot(history.history["val_accuracy"], label="Validation")
ax1.set_title("Accuracy"); ax1.set_xlabel("Epoch"); ax1.legend(); ax1.grid(alpha=0.3)
ax2.plot(history.history["loss"],     label="Train")
ax2.plot(history.history["val_loss"], label="Validation")
ax2.set_title("Loss"); ax2.set_xlabel("Epoch"); ax2.legend(); ax2.grid(alpha=0.3)
plt.tight_layout()
plot_path = os.path.join(MODELS_DIR, "audio_training_curves.png")
plt.savefig(plot_path, dpi=120)
print(f"Training curves saved: {plot_path}")

print("\n" + "=" * 60)
print("TRAINING COMPLETE")
print(f"Model    : {OUTPUT_MODEL}")
print(f"Accuracy : {acc:.2%}")
print("=" * 60)
print("\nNext step: restart app.py — new model loads automatically")
