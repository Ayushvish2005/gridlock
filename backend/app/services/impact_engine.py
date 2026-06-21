import os
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from pydantic import BaseModel

class ImpactAssessment(BaseModel):
    impact_score: int
    severity: str
    estimated_delay: int
    impact_radius: int
    priority_rank: str

def get_rule_based_impact(event_data: dict) -> ImpactAssessment:
    """Fallback deterministic rules if models aren't trained/loaded yet."""
    score = 0
    priority_enc = 1 if str(event_data.get('priority', 'Low')).lower() == 'high' else 0

    if priority_enc == 1: score += 30
    if event_data.get('requires_road_closure'): score += 25

    cause = str(event_data.get('event_cause', '')).strip().lower()
    cause_scores = {
        "protest": 25, "accident": 20, "vip_movement": 20, "political rally": 20,
        "festival": 15, "sports": 15, "sports event": 15, "concert": 15,
        "construction": 10, "construction activity": 10
    }
    score += cause_scores.get(cause, 0)

    dt = event_data.get('start_datetime')
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
        except:
            dt = None

    if isinstance(dt, datetime):
        hour = dt.hour
        is_peak = 1 if hour in set(range(7, 11)) | set(range(17, 22)) else 0
        is_weekend = 1 if dt.weekday() >= 5 else 0
        if is_peak: score += 15
        if is_weekend: score += 10

        # Duration rule
        end_dt = event_data.get('end_datetime')
        if end_dt:
            if isinstance(end_dt, str):
                 try:
                     end_dt = datetime.fromisoformat(end_dt.replace('Z', '+00:00'))
                 except:
                     end_dt = None
            if isinstance(end_dt, datetime) and (end_dt - dt).total_seconds() > 7200:
                score += 10

    if event_data.get('junction'): score += 10
    if str(event_data.get('event_type', '')).strip().lower() == "planned": score += 5

    # Compound Conflict Detector (Infrastructure Stress Multiplier)
    try:
        from app.database.config import SessionLocal
        from app.models.incident import Incident
        db = SessionLocal()
        construction_count = db.query(Incident).filter(
            Incident.zone == event_data.get('zone'),
            Incident.event_cause == 'construction',
            Incident.status == 'ACTIVE'
        ).count()
        db.close()
        
        # Multiply risk based on construction density
        if construction_count > 0:
            multiplier = min(1.0 + (construction_count * 0.15), 2.5) # Max 2.5x
            score = int(score * multiplier)
    except Exception as e:
        print(f"Compound conflict check failed: {e}")

    score = min(score, 100)

    # Map score to severity
    if score <= 25:
        severity = "Low"
    elif score <= 50:
        severity = "Medium"
    elif score <= 75:
        severity = "High"
    else:
        severity = "Critical"

    return ImpactAssessment(
        impact_score=score,
        severity=severity,
        estimated_delay=score // 2, # simple heuristic
        impact_radius=score * 10,  # simple heuristic
        priority_rank="P1" if severity=="Critical" else "P2" if severity=="High" else "P3" if severity=="Medium" else "P4"
    )

# Try to load models at startup
MODELS_DIR = os.getenv("MODELS_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "..", "models"))
severity_model = None
priority_model = None
encoders = None
feature_columns = None

try:
    if os.path.exists(os.path.join(MODELS_DIR, "severity_model.pkl")):
        severity_model = joblib.load(os.path.join(MODELS_DIR, "severity_model.pkl"))
        priority_model = joblib.load(os.path.join(MODELS_DIR, "priority_model.pkl"))
        encoders = joblib.load(os.path.join(MODELS_DIR, "label_encoders.pkl"))
        import json
        with open(os.path.join(MODELS_DIR, "feature_columns.json"), "r") as f:
            feature_columns = json.load(f)
        print("✅ ML Models loaded successfully.")
except Exception as e:
    print(f"⚠️ Could not load ML models, falling back to rule-based engine. Error: {e}")

def assess_impact(event_data: dict) -> ImpactAssessment:
    # If ML models are successfully loaded, use them
    if severity_model is not None and priority_model is not None and encoders is not None:
        try:
            # Replicate the ML inference logic
            SEVERITY_MAP = {0: "Low", 1: "Medium", 2: "High", 3: "Critical"}
            PRIORITY_MAP_INV = {"Low": 0, "High": 1}
            CATEGORICAL_COLS = ["event_type", "event_cause", "corridor", "zone"]
            PEAK_HOURS = set(range(7, 11)) | set(range(17, 22))

            dt = pd.to_datetime(event_data.get("start_datetime"), utc=True, errors="coerce")
            hour      = dt.hour      if pd.notna(dt) else 0
            dayofweek = dt.dayofweek if pd.notna(dt) else 0
            month     = dt.month     if pd.notna(dt) else 1

            row = {
                "event_type":           str(event_data.get("event_type", "unplanned")).lower().strip(),
                "event_cause":          str(event_data.get("event_cause", "unknown")).lower().strip(),
                "corridor":             str(event_data.get("corridor", "non-corridor")).strip(),
                "zone":                 str(event_data.get("zone", "unknown")).strip(),
                "priority_enc":         PRIORITY_MAP_INV.get(str(event_data.get("priority", "Low")).strip(), 0),
                "requires_road_closure": int(bool(event_data.get("requires_road_closure", False))),
                "has_junction":          1 if event_data.get("junction") else 0,
                "hour":                  hour,
                "dayofweek":             dayofweek,
                "month":                 month,
                "is_peak_hour":          1 if hour in PEAK_HOURS else 0,
                "is_weekend":            1 if dayofweek >= 5 else 0,
            }

            for col in CATEGORICAL_COLS:
                le = encoders[col]
                val = row[col]
                if val in le.classes_:
                    row[f"{col}_enc"] = int(le.transform([val])[0])
                else:
                    row[f"{col}_enc"] = 0

            impact_score = get_rule_based_impact(event_data).impact_score

            X = np.array([[row[f] for f in feature_columns]])
            sev_enc  = int(severity_model.predict(X)[0])
            prio_enc = int(priority_model.predict(X)[0])
            
            severity = SEVERITY_MAP[sev_enc]
            # Map ML priority enc (0=Low, 1=High) to a rank logic. 
            # If critical, it's P1. If High Priority Model says High, P2, etc.
            # Or just use the model's priority directly.
            ml_priority = "High" if prio_enc == 1 else "Low"
            
            if severity == "Critical":
                priority_rank = "P1"
            elif severity == "High" and ml_priority == "High":
                priority_rank = "P2"
            elif severity == "High" or ml_priority == "High":
                priority_rank = "P3"
            else:
                priority_rank = "P4"

            return ImpactAssessment(
                impact_score=impact_score,
                severity=severity,
                estimated_delay=impact_score // 2,
                impact_radius=impact_score * 10,
                priority_rank=priority_rank
            )
        except Exception as e:
            print(f"ML inference failed: {e}. Falling back to rules.")
            return get_rule_based_impact(event_data)

    # Default to rules if no model is loaded
    return get_rule_based_impact(event_data)
