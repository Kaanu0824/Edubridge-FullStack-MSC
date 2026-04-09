import os
import sys
import json
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.utils.class_weight import compute_class_weight

# ── Paths ──────────────────────────────────────────────────────────────────────

BASE       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAIN_DIR  = os.path.join(BASE, "dataset", "face", "train")
TEST_DIR   = os.path.join(BASE, "dataset", "face", "test")
MODELS_DIR = os.path.join(BASE, "saved_models")
os.makedirs(MODELS_DIR, exist_ok=True)

OUTPUT_MODEL = os.path.join(MODELS_DIR, "face_model.keras")
OUTPUT_INDEX = os.path.join(MODELS_DIR, "face_class_indices.json")

# ── Config ─────────────────────────────────────────────────────────────────────

IMAGE_SIZE    = (48, 48)
BATCH_SIZE    = 64
EPOCHS        = 50
LEARNING_RATE = 0.001

# ── Validate ───────────────────────────────────────────────────────────────────

print("=" * 60)
print("EduBridge — Face Emotion Model Training")
print("=" * 60)

if not os.path.exists(TRAIN_DIR):
    print(f"\nERROR: Dataset not found at: {TRAIN_DIR}")
    print("\nPlease:")
    print("  1. Download FER2013 from https://www.kaggle.com/datasets/msambare/fer2013")
    print("  2. Extract so structure is:")
    print("       backend/dataset/face/train/angry/")
    print("       backend/dataset/face/train/happy/")
    print("       backend/dataset/face/test/angry/  (optional)")
    sys.exit(1)

classes = sorted([
    c for c in os.listdir(TRAIN_DIR)
    if os.path.isdir(os.path.join(TRAIN_DIR, c))
])
n_train = sum(len(os.listdir(os.path.join(TRAIN_DIR, c))) for c in classes)
n_test  = sum(len(os.listdir(os.path.join(TEST_DIR, c))) for c in classes) if os.path.exists(TEST_DIR) else 0

print(f"\nClasses ({len(classes)}): {classes}")
print(f"Train samples  : {n_train}")
print(f"Test samples   : {n_test}")

# ── Data ───────────────────────────────────────────────────────────────────────

train_gen = ImageDataGenerator(
    rescale=1.0 / 255,
    rotation_range=15,
    width_shift_range=0.1,
    height_shift_range=0.1,
    horizontal_flip=True,
    zoom_range=0.1,
    brightness_range=[0.8, 1.2],
).flow_from_directory(
    TRAIN_DIR,
    target_size=IMAGE_SIZE,
    color_mode="rgb",
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    shuffle=True,
)

val_datagen = ImageDataGenerator(rescale=1.0 / 255)
val_source  = TEST_DIR if os.path.exists(TEST_DIR) else TRAIN_DIR
val_gen     = val_datagen.flow_from_directory(
    val_source,
    target_size=IMAGE_SIZE,
    color_mode="rgb",
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    shuffle=False,
)

n_classes = len(train_gen.class_indices)
print(f"\nClass map: {train_gen.class_indices}")

# Save class indices
with open(OUTPUT_INDEX, "w") as f:
    json.dump(train_gen.class_indices, f, indent=2)
print(f"Saved: {OUTPUT_INDEX}")

# Class weights for imbalanced data
cw = compute_class_weight(
    "balanced",
    classes=np.unique(train_gen.classes),
    y=train_gen.classes,
)
class_weight_dict = dict(enumerate(cw))
print(f"Class weights: { {k: round(v,2) for k,v in class_weight_dict.items()} }")

# ── Model — matches current face_model.keras architecture exactly ──────────────

inputs = keras.Input(shape=(48, 48, 3), name="input_layer")

# Block 1 — matches conv2d / max_pooling2d
x = layers.Conv2D(32, (3, 3), activation="relu", name="conv2d")(inputs)
x = layers.MaxPooling2D(2, 2, name="max_pooling2d")(x)

# Block 2 — matches conv2d_1 / max_pooling2d_1
x = layers.Conv2D(64, (3, 3), activation="relu", name="conv2d_1")(x)
x = layers.MaxPooling2D(2, 2, name="max_pooling2d_1")(x)

# Block 3 — matches conv2d_2 / max_pooling2d_2
x = layers.Conv2D(128, (3, 3), activation="relu", name="conv2d_2")(x)
x = layers.MaxPooling2D(2, 2, name="max_pooling2d_2")(x)

# Classifier — matches flatten / dense / dense_1
x       = layers.Flatten(name="flatten")(x)
x       = layers.Dense(128, activation="relu", name="dense")(x)
outputs = layers.Dense(n_classes, activation="softmax", name="dense_1")(x)

model = keras.Model(inputs, outputs, name="face_emotion_model")
model.summary()

model.compile(
    optimizer=keras.optimizers.Adam(LEARNING_RATE),
    loss="categorical_crossentropy",
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
        patience=10,
        restore_best_weights=True,
        verbose=1,
    ),
    keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=5,
        min_lr=1e-6,
        verbose=1,
    ),
]

print(f"\nTraining up to {EPOCHS} epochs...")
print(f"Best model auto-saved to: {OUTPUT_MODEL}\n")

history = model.fit(
    train_gen,
    validation_data=val_gen,
    epochs=EPOCHS,
    callbacks=callbacks,
    class_weight=class_weight_dict,
    verbose=1,
)

# ── Evaluate ───────────────────────────────────────────────────────────────────

loss, acc = model.evaluate(val_gen, verbose=0)
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
plot_path = os.path.join(MODELS_DIR, "face_training_curves.png")
plt.savefig(plot_path, dpi=120)
print(f"Training curves saved: {plot_path}")

print("\n" + "=" * 60)
print("TRAINING COMPLETE")
print(f"Model : {OUTPUT_MODEL}")
print(f"Accuracy : {acc:.2%}")
print("=" * 60)
print("\nNext step: restart app.py — new model loads automatically")
