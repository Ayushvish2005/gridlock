"""
Congestion Risk Forecasting Engine
===================================
Deterministic model that computes a congestion_risk_score (0-100) and
related predictions for a given event_data dict.
"""

from datetime import datetime, timedelta
from typing import Optional

from app.services.impact_engine import assess_impact
from app.services.recommendation_engine import get_deterministic_recommendations


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_dt(value) -> Optional[datetime]:
    """Safely parse a datetime value (str or datetime) into a timezone-naive datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        # Strip timezone info so arithmetic is consistent
        return value.replace(tzinfo=None)
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt.replace(tzinfo=None)
        except Exception:
            return None
    return None


def _severity_from_score(score: float) -> str:
    if score >= 80:
        return "Critical"
    elif score >= 60:
        return "High"
    elif score >= 35:
        return "Medium"
    else:
        return "Low"


def _fmt_window(start: datetime, end: datetime) -> str:
    """Format a time window as 'HH:MM - HH:MM'."""
    return f"{start.strftime('%H:%M')} - {end.strftime('%H:%M')}"


# ---------------------------------------------------------------------------
# Core forecast function
# ---------------------------------------------------------------------------

def compute_congestion_forecast(event_data: dict) -> dict:
    """
    Compute congestion risk forecast for a given event.

    Parameters
    ----------
    event_data : dict
        Same shape as PredictRequest / IncidentCreate.

    Returns
    -------
    dict with keys:
        congestion_risk_score      int   0-100
        severity_prediction        str   Low/Medium/High/Critical
        expected_clearance_time    str   "HH:MM - HH:MM"
        peak_congestion_window     str   "HH:MM - HH:MM"
        estimated_delay_mins       int
        officers_recommended       int
        barricades_recommended     int
    """
    # 1. Base impact score (0-100)
    impact = assess_impact(event_data)
    base_score = float(impact.impact_score)

    # 2. Peak hour multiplier
    start_dt = _parse_dt(event_data.get("start_datetime"))
    peak_multiplier = 1.0
    is_weekend_bonus = 0
    if start_dt:
        hour = start_dt.hour
        is_peak = (7 <= hour <= 10) or (17 <= hour <= 21)
        if is_peak:
            peak_multiplier = 1.3
        if start_dt.weekday() >= 5:
            is_weekend_bonus = 10

    # 3. Road closure multiplier
    road_closure_multiplier = 1.2 if event_data.get("requires_road_closure") else 1.0

    # 4. Attendance tier bonus
    attendance = event_data.get("expected_attendance")
    attendance_bonus = 0
    if attendance is not None:
        try:
            attendance = int(attendance)
            # Make attendance highly continuous and sensitive
            attendance_bonus = min(int((attendance / 1000) * 8), 40)
            if attendance < 100:
                attendance_bonus = -10 # Substantially reduce impact for tiny events
        except (TypeError, ValueError):
            attendance_bonus = 0

    # 5. Assemble final score
    raw_score = (base_score * peak_multiplier * road_closure_multiplier) + is_weekend_bonus + attendance_bonus
    congestion_risk_score = int(min(round(raw_score), 100))

    # 6. Severity prediction
    severity_prediction = _severity_from_score(congestion_risk_score)

    # 7. Estimated delay — use ML model if available, else deterministic
    estimated_delay_mins = None
    try:
        import os, joblib, pandas as pd
        model_path = os.path.join(os.path.dirname(__file__), "duration_model.pkl")
        if os.path.exists(model_path):
            model = joblib.load(model_path)
            df_input = pd.DataFrame([{
                'event_cause': event_data.get('event_cause', 'unknown'),
                'zone': event_data.get('zone', 'unknown'),
                'priority': event_data.get('priority', 'Low'),
                'hour_of_day': start_dt.hour if start_dt else 12,
                'is_weekend': start_dt.weekday() >= 5 if start_dt else False,
                'requires_road_closure': bool(event_data.get('requires_road_closure', False))
            }])
            ml_pred = model.predict(df_input)[0]
            estimated_delay_mins = int(ml_pred)
    except Exception as e:
        print(f"ML Model failed: {e}")
        
    if estimated_delay_mins is None:
        boost_ratio = congestion_risk_score / max(impact.impact_score, 1)
        estimated_delay_mins = int(min(impact.estimated_delay * boost_ratio, 240))

    # 8. Expected clearance window: start + estimated_delay → start + estimated_delay + buffer
    if start_dt:
        clearance_start = start_dt + timedelta(minutes=estimated_delay_mins)
        # Buffer: 30 mins for Low, 60 for Medium, 90 for High, 120 for Critical
        buffer_map = {"Low": 30, "Medium": 60, "High": 90, "Critical": 120}
        buffer = buffer_map.get(severity_prediction, 60)
        clearance_end = clearance_start + timedelta(minutes=buffer)
        expected_clearance_time = _fmt_window(clearance_start, clearance_end)
    else:
        expected_clearance_time = "Unknown"

    # 9. Peak congestion window: start + 1h → start + duration OR start + 3h
    if start_dt:
        peak_start = start_dt + timedelta(hours=1)
        end_dt = _parse_dt(event_data.get("end_datetime"))
        if end_dt and end_dt > start_dt:
            peak_end = end_dt
        else:
            peak_end = start_dt + timedelta(hours=3)
        peak_congestion_window = _fmt_window(peak_start, peak_end)
    else:
        peak_congestion_window = "Unknown"
        
    # 10. Resource recommendations (deterministic)
    recs = get_deterministic_recommendations(severity_prediction, event_data)

    # 11. Build Impact Breakdown for explainability
    impact_breakdown = {
        "Base Event Risk": f"{int(base_score)}",
        "Peak Hour Multiplier": f"x{peak_multiplier}" if peak_multiplier > 1.0 else None,
        "Weekend Bonus": f"+{is_weekend_bonus}" if is_weekend_bonus > 0 else None,
        "Road Closure": f"x{road_closure_multiplier}" if road_closure_multiplier > 1.0 else None,
        "Attendance Factor": f"+{attendance_bonus}" if attendance_bonus > 0 else None,
        "Total Impact Score": f"{congestion_risk_score}"
    }
    # Remove Nones
    impact_breakdown = {k: v for k, v in impact_breakdown.items() if v is not None}

    return {
        "congestion_risk_score": congestion_risk_score,
        "severity_prediction": severity_prediction,
        "expected_clearance_time": expected_clearance_time,
        "peak_congestion_window": peak_congestion_window,
        "estimated_delay_mins": estimated_delay_mins,
        "officers_recommended": recs.get("officers_required", 0),
        "barricades_recommended": recs.get("barricades_required", 0),
        "diversion_required": recs.get("diversion_required", False),
        "tow_vehicle_required": recs.get("tow_vehicle_required", False),
        "impact_radius_km": round((congestion_risk_score * 10) / 1000.0, 1) + 0.5 + min(float(attendance or 0) / 3000.0, 2.0),
        "affected_junctions": int(congestion_risk_score / 15) + int(float(attendance or 0) / 500),
        "impact_breakdown": impact_breakdown
    }
