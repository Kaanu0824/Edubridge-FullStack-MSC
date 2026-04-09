import os
import sys
import json
import joblib
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

BASE       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE  = os.path.join(BASE, "dataset", "chatbot", "intents.json")
MODELS_DIR = os.path.join(BASE, "saved_models")
os.makedirs(MODELS_DIR, exist_ok=True)

print("=" * 55)
print("EduBridge — Chatbot Intent Model Trainer")
print("=" * 55)

if not os.path.exists(DATA_FILE):
    print(f"\nERROR: intents.json not found at:\n  {DATA_FILE}")
    sys.exit(1)

with open(DATA_FILE) as f:
    data = json.load(f)

X, y              = [], []
intent_responses  = {}

for intent in data["intents"]:
    tag = intent["tag"]
    intent_responses[tag] = intent["responses"]
    for pattern in intent["patterns"]:
        X.append(pattern)
        y.append(tag)

print(f"\nPatterns : {len(X)}")
print(f"Intents  : {len(set(y))}")

model = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1)),
    ("clf",   LogisticRegression(max_iter=1000, C=5.0)),
])

model.fit(X, y)

scores = cross_val_score(model, X, y, cv=min(3, len(set(y))), scoring="accuracy")
print(f"Cross-val accuracy: {scores.mean():.2%} ± {scores.std():.2%}")

joblib.dump(model,            os.path.join(MODELS_DIR, "intent_model.joblib"))
joblib.dump(intent_responses, os.path.join(MODELS_DIR, "intent_data.joblib"))

print(f"\nSaved → saved_models/intent_model.joblib")
print(f"Saved → saved_models/intent_data.joblib")
print("\nRestart app.py to load the new chatbot model.")
