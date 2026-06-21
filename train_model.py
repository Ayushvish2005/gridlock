import argparse
import json
import os
import sys
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier, VotingClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import TimeSeriesSplit, cross_val_score, train_test_split
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

SEVERITY_LABELS = ["Low", "Medium", "High", "Critical"]
PRIORITY_LABELS = ["Low", "High"]

SEVERITY_MAP = {0: "Low", 1: "Medium", 2: "High", 3: "Critical"}
SEVERITY_MAP_INV = {v: k for k, v in SEVERITY_MAP.items()}

PRIORITY_MAP = {0: "Low", 1: "High"}
PRIORITY_MAP_INV = {"Low": 0, "High": 1}

# Peak hours : 7–10 AM and 5–9 PM
PEAK_HOURS = set(range(7, 11)) | set(range(17, 22))

# Categorical columns that need LabelEncoding
CATEGORICAL_COLS = ["event_type", "event_cause", "corridor", "zone"]

# Final feature list (order is preserved for inference)
FEATURE_COLUMNS = [
    "event_type_enc",
    "event_cause_enc",
    "priority_enc",
    "requires_road_closure",
    "is_peak_hour",
    "is_weekend",
    "has_junction",
    "hour",
    "dayofweek",
    "month",
    "corridor_enc",
    "zone_enc",
]


# ─────────────────────────────────────────────────────────────────────────────
# Rule Engine — Impact Score (mirrors impact_engine.py in the backend)
# ─────────────────────────────────────────────────────────────────────────────

def compute_impact_score(row: pd.Series) -> int:
    """
    Deterministic scoring engine identical to the backend's impact_engine.py.

    Returns an integer score in [0, 100].
    """
    score = 0

    # High priority: +30
    if row.get("priority_enc", 0) == 1:
        score += 30

    # Road closure: +25
    if row.get("requires_road_closure", 0) == 1:
        score += 25

    # Event cause specific boosts
    cause = str(row.get("event_cause", "")).strip().lower()
    cause_scores = {
        "protest": 25,
        "accident": 20,
        "vip_movement": 20,
        "public_event": 15,
        "procession": 15,
        "festival": 15,
        "sports": 15,
        "construction": 10,
        "road_conditions": 5,
        "congestion": 5,
    }
    score += cause_scores.get(cause, 0)

    # Peak hour: +15
    if row.get("is_peak_hour", 0) == 1:
        score += 15

    # Weekend event: +10
    if row.get("is_weekend", 0) == 1:
        score += 10

    # Near major junction: +10
    if row.get("has_junction", 0) == 1:
        score += 10

    # Planned event (typically pre-assessed): +5
    if str(row.get("event_type", "")).strip().lower() == "planned":
        score += 5

    return min(score, 100)


def impact_score_to_severity(score: int) -> int:
    """Map an impact score to a 0-indexed severity class."""
    if score <= 25:
        return 0   # Low
    elif score <= 50:
        return 1   # Medium
    elif score <= 75:
        return 2   # High
    else:
        return 3   # Critical


# ─────────────────────────────────────────────────────────────────────────────
# Data Loading & Cleaning
# ─────────────────────────────────────────────────────────────────────────────

def load_and_clean(path: str) -> pd.DataFrame:
    """Load the CSV and perform basic cleaning."""
    print(f"[1/6] Loading data from: {path}")
    df = pd.read_csv(path, low_memory=False)
    print(f"      Loaded {len(df):,} rows × {df.shape[1]} columns.")

    # ── Datetime parsing ────────────────────────────────────────────────────
    for col in ["start_datetime", "end_datetime", "closed_datetime", "resolved_datetime"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], utc=True, errors="coerce")

    # ── Normalise text columns ───────────────────────────────────────────────
    df["event_cause"] = (
        df["event_cause"]
        .fillna("unknown")
        .str.lower()
        .str.strip()
        .replace({"fog / low visibility": "fog_low_visibility", "debris": "debris"})
    )
    df["event_type"] = df["event_type"].fillna("unknown").str.lower().str.strip()
    df["corridor"] = df["corridor"].fillna("non-corridor").str.strip()
    df["zone"] = df["zone"].fillna("unknown").str.strip()

    # ── Boolean → int ────────────────────────────────────────────────────────
    df["requires_road_closure"] = (
        df["requires_road_closure"]
        .map({True: 1, False: 0, "True": 1, "False": 0})
        .fillna(0)
        .astype(int)
    )

    # ── Priority encoding ────────────────────────────────────────────────────
    df["priority"] = df["priority"].fillna("Low")
    df["priority_enc"] = df["priority"].str.strip().map(PRIORITY_MAP_INV).fillna(0).astype(int)

    # Drop the two rows where priority was genuinely null (edge case)
    df = df.dropna(subset=["priority_enc"])

    print(f"      Cleaned shape: {df.shape}")
    return df


# ─────────────────────────────────────────────────────────────────────────────
# Feature Engineering
# ─────────────────────────────────────────────────────────────────────────────

def engineer_features(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Build model-ready features from the cleaned DataFrame.

    Returns
    -------
    df          : DataFrame with all engineered columns appended
    encoders    : dict of fitted LabelEncoders keyed by original column name
    """
    print("[2/6] Engineering features …")

    # ── Temporal features ────────────────────────────────────────────────────
    df["hour"]      = df["start_datetime"].dt.hour.fillna(0).astype(int)
    df["dayofweek"] = df["start_datetime"].dt.dayofweek.fillna(0).astype(int)
    df["month"]     = df["start_datetime"].dt.month.fillna(1).astype(int)

    df["is_peak_hour"] = df["hour"].apply(lambda h: 1 if h in PEAK_HOURS else 0)
    df["is_weekend"]   = df["dayofweek"].apply(lambda d: 1 if d >= 5 else 0)

    # ── Junction proximity ───────────────────────────────────────────────────
    df["has_junction"] = df["junction"].notna().astype(int)

    # ── Label-encode categorical columns ────────────────────────────────────
    encoders: dict[str, LabelEncoder] = {}
    for col in CATEGORICAL_COLS:
        le = LabelEncoder()
        df[f"{col}_enc"] = le.fit_transform(df[col].astype(str))
        encoders[col] = le

    # ── Compute rule-based impact score and severity label ───────────────────
    df["impact_score"]  = df.apply(compute_impact_score, axis=1)
    df["severity_enc"]  = df["impact_score"].apply(impact_score_to_severity)

    print(f"      Features built: {FEATURE_COLUMNS}")
    print(f"      Severity distribution:\n{df['severity_enc'].map(SEVERITY_MAP).value_counts().to_string()}")
    print(f"      Priority distribution:\n{df['priority_enc'].map(PRIORITY_MAP).value_counts().to_string()}")

    return df, encoders


# ─────────────────────────────────────────────────────────────────────────────
# Model Training
# ─────────────────────────────────────────────────────────────────────────────

def train_model_rf(
    X: np.ndarray,
    y: np.ndarray,
    label_names: list[str],
    model_name: str,
    random_state: int = 42,
) -> tuple[VotingClassifier, str]:
    """
    Train an Ensemble classifier (LightGBM/HistGradient + RandomForest) and evaluate with Walk-Forward TimeSeriesSplit.

    Returns
    -------
    model   : fitted VotingClassifier on the full training split
    report  : formatted evaluation string
    """
    print(f"\n[Training] {model_name}")

    # 80/20 temporal split for final hold-out evaluation (since it's time series)
    split_idx = int(len(X) * 0.80)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=15,
        min_samples_split=4,
        class_weight="balanced",
        random_state=random_state,
        n_jobs=-1,
    )

    hgb_model = HistGradientBoostingClassifier(
        max_iter=100,
        max_depth=10,
        learning_rate=0.05,
        random_state=random_state,
    )

    model = VotingClassifier(
        estimators=[('rf', rf_model), ('hgb', hgb_model)],
        voting='soft'
    )

    # Walk-Forward Time-Series Split cross-validation on training split
    tscv = TimeSeriesSplit(n_splits=5)
    cv_scores = cross_val_score(model, X_train, y_train, cv=tscv, scoring="accuracy", n_jobs=-1)

    # Fit final model on all training data
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    report_lines = [
        f"{'='*60}",
        f"Model: {model_name}",
        f"{'='*60}",
        f"Cross-Validation Accuracy (5-fold, train split):  "
        f"{cv_scores.mean():.4f}  ±  {cv_scores.std():.4f}",
        f"Hold-out Test Accuracy:                           "
        f"{(y_pred == y_test).mean():.4f}",
        "",
        "Classification Report (hold-out set):",
        classification_report(y_test, y_pred, target_names=label_names, zero_division=0),
        "Confusion Matrix (rows = actual, cols = predicted):",
        f"Labels: {label_names}",
        str(confusion_matrix(y_test, y_pred)),
        "",
    ]
    report = "\n".join(report_lines)
    print(report)
    return model, report


# ─────────────────────────────────────────────────────────────────────────────
# Feature Importance
# ─────────────────────────────────────────────────────────────────────────────

def feature_importance_report(model: RandomForestClassifier, model_name: str) -> str:
    # For VotingClassifier, try to average feature importances of underlying models if possible
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
    elif hasattr(model, 'estimators_'):
        # Attempt to get feature importances from underlying estimators
        fi_list = []
        for est in model.estimators_:
            if hasattr(est, 'feature_importances_'):
                fi_list.append(est.feature_importances_)
        if fi_list:
            importances = np.mean(fi_list, axis=0)
        else:
            return f"Feature importances not available for {model_name}."
    else:
        return f"Feature importances not available for {model_name}."
    pairs = sorted(zip(FEATURE_COLUMNS, importances), key=lambda x: -x[1])
    lines = [f"\nFeature Importance — {model_name}:"]
    for feat, imp in pairs:
        bar = "█" * int(imp * 50)
        lines.append(f"  {feat:<25s}  {imp:.4f}  {bar}")
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Save Artefacts
# ─────────────────────────────────────────────────────────────────────────────

def save_artifacts(
    out_dir: str,
    severity_model: RandomForestClassifier,
    priority_model: RandomForestClassifier,
    encoders: dict,
    report: str,
) -> None:
    print(f"\n[5/6] Saving artefacts to: {out_dir}")
    Path(out_dir).mkdir(parents=True, exist_ok=True)

    joblib.dump(severity_model, os.path.join(out_dir, "severity_model.pkl"))
    joblib.dump(priority_model, os.path.join(out_dir, "priority_model.pkl"))
    joblib.dump(encoders,       os.path.join(out_dir, "label_encoders.pkl"))

    with open(os.path.join(out_dir, "feature_columns.json"), "w") as f:
        json.dump(FEATURE_COLUMNS, f, indent=2)

    with open(os.path.join(out_dir, "training_report.txt"), "w") as f:
        f.write(report)

    print("      Saved:")
    for fname in ["severity_model.pkl", "priority_model.pkl",
                  "label_encoders.pkl", "feature_columns.json", "training_report.txt"]:
        fpath = os.path.join(out_dir, fname)
        size_kb = os.path.getsize(fpath) / 1024
        print(f"        {fname:<35s}  {size_kb:>8.1f} KB")


# ─────────────────────────────────────────────────────────────────────────────
# Inference Helper (for use by the backend services)
# ─────────────────────────────────────────────────────────────────────────────

def predict(
    event: dict,
    severity_model: RandomForestClassifier,
    priority_model: RandomForestClassifier,
    encoders: dict,
) -> dict:
    """
    Run inference on a single event dictionary.

    Parameters
    ----------
    event : dict with the following optional keys:
        event_type, event_cause, priority, requires_road_closure,
        start_datetime (ISO string), zone, corridor, junction

    Returns
    -------
    dict with keys: impact_score, severity, priority, severity_enc, priority_enc
    """
    # Parse temporal features
    dt = pd.to_datetime(event.get("start_datetime"), utc=True, errors="coerce")
    hour      = dt.hour      if pd.notna(dt) else 0
    dayofweek = dt.dayofweek if pd.notna(dt) else 0
    month     = dt.month     if pd.notna(dt) else 1

    row = {
        "event_type":           str(event.get("event_type", "unplanned")).lower().strip(),
        "event_cause":          str(event.get("event_cause", "unknown")).lower().strip(),
        "corridor":             str(event.get("corridor", "non-corridor")).strip(),
        "zone":                 str(event.get("zone", "unknown")).strip(),
        "priority_enc":         PRIORITY_MAP_INV.get(str(event.get("priority", "Low")).strip(), 0),
        "requires_road_closure": int(bool(event.get("requires_road_closure", False))),
        "has_junction":          1 if event.get("junction") else 0,
        "hour":                  hour,
        "dayofweek":             dayofweek,
        "month":                 month,
        "is_peak_hour":          1 if hour in PEAK_HOURS else 0,
        "is_weekend":            1 if dayofweek >= 5 else 0,
    }

    # Encode categoricals using fitted encoders (handle unseen labels gracefully)
    for col in CATEGORICAL_COLS:
        le = encoders[col]
        val = row[col]
        if val in le.classes_:
            row[f"{col}_enc"] = int(le.transform([val])[0])
        else:
            row[f"{col}_enc"] = 0  # fallback to first class for unseen

    # Compute rule-based impact score
    impact_score = compute_impact_score(pd.Series(row))

    # Build feature vector
    X = np.array([[row[f] for f in FEATURE_COLUMNS]])

    sev_enc  = int(severity_model.predict(X)[0])
    prio_enc = int(priority_model.predict(X)[0])

    return {
        "impact_score": impact_score,
        "severity":     SEVERITY_MAP[sev_enc],
        "priority":     PRIORITY_MAP[prio_enc],
        "severity_enc": sev_enc,
        "priority_enc": prio_enc,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train severity and priority models for the AI Traffic Operations Platform."
    )
    parser.add_argument(
        "--data",
        type=str,
        required=True,
        help="Path to the event CSV file (Astram export).",
    )
    parser.add_argument(
        "--out",
        type=str,
        default="models/",
        help="Directory to write model artefacts (default: models/).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # ── Load & clean ──────────────────────────────────────────────────────────
    df = load_and_clean(args.data)

    # ── Feature engineering ───────────────────────────────────────────────────
    df, encoders = engineer_features(df)

    # ── Build feature matrix ──────────────────────────────────────────────────
    print("\n[3/6] Building feature matrix …")
    X = df[FEATURE_COLUMNS].values
    y_severity = df["severity_enc"].values
    y_priority = df["priority_enc"].values
    print(f"      X shape: {X.shape}")

    # ── Train models ──────────────────────────────────────────────────────────
    print("\n[4/6] Training models …")
    severity_model, sev_report = train_model_rf(
        X, y_severity, SEVERITY_LABELS, "Severity Classifier", args.seed
    )
    priority_model, prio_report = train_model_rf(
        X, y_priority, PRIORITY_LABELS, "Priority Classifier", args.seed
    )

    # Feature importance
    fi_sev  = feature_importance_report(severity_model, "Severity Classifier")
    fi_prio = feature_importance_report(priority_model, "Priority Classifier")
    full_report = "\n".join([sev_report, prio_report, fi_sev, fi_prio])
    print(fi_sev)
    print(fi_prio)

    # ── Save artefacts ────────────────────────────────────────────────────────
    save_artifacts(args.out, severity_model, priority_model, encoders, full_report)

    # ── Smoke-test inference ──────────────────────────────────────────────────
    print("\n[6/6] Smoke-test inference …")
    test_events = [
        {
            "event_type": "planned",
            "event_cause": "public_event",
            "priority": "High",
            "requires_road_closure": True,
            "start_datetime": "2024-03-15T19:30:00+00:00",
            "junction": "Silk Board",
            "zone": "South Zone 1",
            "corridor": "Hosur Road",
        },
        {
            "event_type": "unplanned",
            "event_cause": "accident",
            "priority": "High",
            "requires_road_closure": True,
            "start_datetime": "2024-06-10T08:15:00+00:00",
            "junction": None,
            "zone": "Central Zone 2",
            "corridor": "Bellary Road 1",
        },
        {
            "event_type": "unplanned",
            "event_cause": "vehicle_breakdown",
            "priority": "Low",
            "requires_road_closure": False,
            "start_datetime": "2024-04-20T14:00:00+00:00",
            "junction": None,
            "zone": "unknown",
            "corridor": "Non-corridor",
        },
    ]

    for i, event in enumerate(test_events, 1):
        result = predict(event, severity_model, priority_model, encoders)
        print(
            f"  Event {i}: cause={event['event_cause']:<20s} "
            f"→ impact={result['impact_score']:>3d}  "
            f"severity={result['severity']:<8s}  "
            f"priority={result['priority']}"
        )

    print("\n✅ Training complete.\n")


if __name__ == "__main__":
    main()
