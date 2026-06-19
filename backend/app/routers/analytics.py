"""
Analytics Router
=================
Provides advanced analytics, forecasting, and AI co-pilot endpoints for the
AI Traffic Operations Platform.

Endpoints
---------
GET  /forecast             — Congestion risk forecast for a hypothetical event
GET  /zone-risk-ranking    — Ranked zones by current risk based on active incidents
GET  /heatmap-data         — Lat/lng + severity data for frontend heatmap
POST /copilot              — AI Q&A with optional incident context
GET  /alerts               — Active high-priority alerts from DB
GET  /what-if-compare      — Compare two attendance scenarios
GET  /post-event-report/{incident_id}  — Performance report for a resolved incident
"""

import os
import json
import httpx
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.config import get_db
from app.models.incident import Incident, IncidentStatus
from app.services.forecasting_engine import compute_congestion_forecast
from app.services.impact_engine import assess_impact
from app.services.recommendation_engine import get_deterministic_recommendations

router = APIRouter(prefix="/analytics", tags=["Analytics"])

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _severity_from_score(score: float) -> str:
    if score >= 80:
        return "Critical"
    elif score >= 60:
        return "High"
    elif score >= 35:
        return "Medium"
    else:
        return "Low"


def _zone_risk_from_incidents(incidents: List[Incident]) -> float:
    """Compute an aggregate risk score (0-100) for a list of incidents in the same zone."""
    if not incidents:
        return 0.0
    severity_weights = {"Critical": 100, "High": 75, "Medium": 50, "Low": 25}
    scores = [severity_weights.get(inc.severity or "Low", 25) for inc in incidents]
    # Weighted average with a count bonus capped at 20 pts
    base = sum(scores) / len(scores)
    count_bonus = min(len(incidents) * 5, 20)
    return min(base + count_bonus, 100)


def _deterministic_copilot_answer(question: str, context: Optional[Dict[str, Any]]) -> str:
    """Rule-based fallback answer for common traffic operations questions."""
    q = question.lower()
    if "severe" in q or "severity" in q or "critical" in q:
        return (
            "Severity is determined by a combination of factors including the event cause, "
            "expected attendance, whether a road closure is required, time of day (peak hours "
            "attract higher scores), and location characteristics. High-cause events like protests, "
            "accidents, or VIP movements combined with peak hours and road closures push the "
            "impact score above 75, triggering a Critical assessment."
        )
    if "officer" in q or "staff" in q or "deploy" in q:
        return (
            "Officer deployment is scaled based on severity and expected attendance. "
            "Low severity events require 1–3 officers, Medium 3–6, High 6–10, and Critical events "
            "10+ officers. Large-attendance events (>10,000) receive an additional 15 officers."
        )
    if "barricade" in q or "barrier" in q:
        return (
            "Barricade requirements are driven by crowd size and the need for road diversion. "
            "Events with >10,000 attendees receive 20+ additional barricades on top of the "
            "severity baseline. Road closures always trigger mandatory diversion and barricading."
        )
    if "congestion" in q or "traffic" in q or "delay" in q:
        return (
            "Congestion risk is highest during morning (7–10 AM) and evening (5–9 PM) peak hours. "
            "Events during these windows receive a 30% risk multiplier. Road closures add another "
            "20% and large crowds (20k+) add 30 points to the base risk score."
        )
    if "zone" in q or "area" in q or "location" in q:
        return (
            "Zone risk is aggregated from all active incidents in that area. Zones with multiple "
            "simultaneous Critical incidents are ranked highest. The risk ranking updates in "
            "real-time as incidents are created or resolved."
        )
    if "forecast" in q or "predict" in q or "estimate" in q:
        return (
            "The forecasting engine uses a deterministic model combining the base impact score, "
            "peak-hour multipliers, weekend bonuses, road closure penalties, and attendance tiers "
            "to produce a 0-100 congestion risk score. Severity thresholds: Low <35, Medium 35-60, "
            "High 60-80, Critical >80."
        )
    if "resolve" in q or "clear" in q or "close" in q:
        return (
            "Expected clearance time is estimated as event start + delay minutes + a severity-based "
            "buffer (30 min Low, 60 min Medium, 90 min High, 120 min Critical). Actual resolution "
            "may vary based on resource availability and real-time conditions."
        )
    # Generic fallback
    return (
        "As a Traffic Operations AI assistant, I can help with questions about incident severity, "
        "resource deployment, congestion forecasting, zone risk, and operational planning. "
        "Please provide more specific details about the incident or scenario you're asking about."
    )


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CopilotRequest(BaseModel):
    question: str
    incident_id: Optional[int] = None
    context: Optional[Dict[str, Any]] = None


class CopilotResponse(BaseModel):
    answer: str
    confidence: str  # "high" | "medium" | "low"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/forecast")
async def get_forecast(
    event_type: str = Query(..., description="e.g. planned, unplanned"),
    event_cause: str = Query(..., description="e.g. concert, accident, protest"),
    zone: str = Query(..., description="Zone name"),
    start_datetime: str = Query(..., description="ISO 8601 datetime string"),
    priority: str = Query(default="Low", description="Low, Medium, High"),
    requires_road_closure: bool = Query(default=False),
    expected_attendance: Optional[int] = Query(default=None),
):
    """
    Compute a congestion risk forecast for a hypothetical event.
    No DB writes occur — purely predictive.
    """
    event_data = {
        "event_type": event_type,
        "event_cause": event_cause,
        "zone": zone,
        "start_datetime": start_datetime,
        "priority": priority,
        "requires_road_closure": requires_road_closure,
        "expected_attendance": expected_attendance,
    }
    try:
        result = compute_congestion_forecast(event_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {e}")

    return {
        "congestion_risk_score": result["congestion_risk_score"],
        "severity_prediction": result["severity_prediction"],
        "expected_clearance_time": result["expected_clearance_time"],
        "peak_congestion_window": result["peak_congestion_window"],
        "estimated_delay_mins": result["estimated_delay_mins"],
        "officers_recommended": result["officers_recommended"],
        "barricades_recommended": result["barricades_recommended"],
    }


@router.get("/zone-risk-ranking")
def get_zone_risk_ranking(db: Session = Depends(get_db)):
    """
    Returns zones ranked by aggregated risk score from active incidents.
    """
    active_incidents = (
        db.query(Incident)
        .filter(Incident.status == IncidentStatus.ACTIVE)
        .all()
    )

    # Group by zone
    zone_map: Dict[str, List[Incident]] = {}
    for inc in active_incidents:
        zone_key = inc.zone if inc.zone and str(inc.zone).lower() not in ["unknown", "none", ""] else "Unclassified Incidents"
        zone_map.setdefault(zone_key, []).append(inc)

    ranked = []
    for zone, incidents in zone_map.items():
        risk_score = _zone_risk_from_incidents(incidents)
        severity = _severity_from_score(risk_score)
        
        # Calculate new metrics
        valid_impacts = [i.impact_score for i in incidents if i.impact_score]
        avg_impact_score = sum(valid_impacts) / len(valid_impacts) if valid_impacts else risk_score
        
        valid_delays = [i.estimated_delay for i in incidents if i.estimated_delay]
        avg_resolution_time = sum(valid_delays) / len(valid_delays) / 60.0 if valid_delays else 1.5
        
        road_closures = sum(1 for i in incidents if i.requires_road_closure)

        ranked.append({
            "zone": zone,
            "risk_score": round(risk_score),
            "active_incidents": len(incidents),
            "severity": severity,
            "avg_impact_score": round(avg_impact_score),
            "avg_resolution_time_hrs": round(avg_resolution_time, 1),
            "road_closures": road_closures
        })

    ranked.sort(key=lambda x: x["risk_score"], reverse=True)
    for i, item in enumerate(ranked, start=1):
        item["rank"] = i

    return ranked


@router.get("/heatmap-data")
def get_heatmap_data(db: Session = Depends(get_db)):
    """
    Returns all active incidents with spatial and severity data for heatmap rendering.
    Only incidents with valid lat/lng are included.
    """
    active_incidents = (
        db.query(Incident)
        .filter(
            Incident.status == IncidentStatus.ACTIVE,
            Incident.latitude.isnot(None),
            Incident.longitude.isnot(None),
        )
        .all()
    )

    results = []
    for inc in active_incidents:
        results.append({
            "lat": inc.latitude,
            "lng": inc.longitude,
            "severity": inc.severity or "Unknown",
            "impact_score": inc.impact_score or 0,
            "impact_radius": inc.impact_radius or 0,
            "event_cause": inc.event_cause or "Unknown",
            "zone": inc.zone or "Unknown",
            "event_type": inc.event_type or "Unknown",
            "incident_id": inc.id,
        })

    return results


@router.post("/copilot", response_model=CopilotResponse)
async def copilot(request: CopilotRequest, db: Session = Depends(get_db)):
    """
    AI Co-pilot: Answer traffic operations questions using GPT-4o-mini via OpenRouter.
    Falls back to deterministic answers if no API key is configured.
    """
    # Optionally enrich context with incident data
    incident_context = ""
    if request.incident_id:
        incident = db.query(Incident).filter(Incident.id == request.incident_id).first()
        if incident:
            incident_context = (
                f"\nIncident #{incident.id} context:\n"
                f"  Event: {incident.event_cause} ({incident.event_type})\n"
                f"  Zone: {incident.zone}\n"
                f"  Severity: {incident.severity}, Impact Score: {incident.impact_score}\n"
                f"  Status: {incident.status}\n"
                f"  Officers Required: {incident.officers_required}, "
                f"Barricades: {incident.barricades_required}\n"
                f"  Road Closure: {incident.requires_road_closure}\n"
                f"  AI Explanation: {incident.ai_explanation or 'N/A'}\n"
            )

    extra_context = ""
    if request.context:
        try:
            extra_context = f"\nAdditional context provided:\n{json.dumps(request.context, indent=2)}\n"
        except Exception:
            extra_context = ""

    # Attempt LLM call
    if OPENROUTER_API_KEY and OPENROUTER_API_KEY not in ("", "your_openrouter_api_key_here"):
        system_prompt = (
            "You are an expert AI assistant for a city Traffic Operations Command Center. "
            "You have deep knowledge of traffic incident management, resource deployment, "
            "congestion forecasting, and emergency response protocols. "
            "Answer questions clearly, concisely, and in plain English. "
            "If you don't know something specific, say so rather than hallucinating."
        )
        user_prompt = (
            f"Question: {request.question}"
            f"{incident_context}"
            f"{extra_context}"
        )
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "openai/gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "max_tokens": 300,
                        "temperature": 0.3,
                    },
                )
                response.raise_for_status()
                data = response.json()
                answer = data["choices"][0]["message"]["content"].strip()
                return CopilotResponse(answer=answer, confidence="high")
        except Exception as e:
            print(f"Copilot LLM call failed: {e}. Using deterministic fallback.")

    # Deterministic fallback
    answer = _deterministic_copilot_answer(request.question, request.context)
    confidence = "medium" if incident_context else "low"
    return CopilotResponse(answer=answer, confidence=confidence)


@router.get("/alerts")
def get_alerts(db: Session = Depends(get_db)):
    """
    Returns active high-priority alerts: Critical severity or impact_score >= 75.
    """
    alert_incidents = (
        db.query(Incident)
        .filter(
            Incident.status == IncidentStatus.ACTIVE,
        )
        .filter(
            (Incident.severity == "Critical") |
            (Incident.impact_score >= 75)
        )
        .order_by(Incident.impact_score.desc())
        .all()
    )

    alerts = []
    for inc in alert_incidents:
        severity = inc.severity or "High"
        if severity == "Critical":
            alert_type = "CRITICAL_INCIDENT"
            msg = f"CRITICAL INCIDENT: {(inc.event_cause or 'Unknown event').title()} in {inc.zone or 'Unknown zone'}"
        else:
            alert_type = "HIGH_RISK"
            msg = f"HIGH PRIORITY EVENT: {(inc.event_cause or 'Unknown event').title()} in {inc.zone or 'Unknown zone'} (Impact Score: {inc.impact_score})"

        timestamp = inc.created_at
        if timestamp is not None:
            timestamp_str = timestamp.isoformat()
        else:
            timestamp_str = datetime.now(timezone.utc).isoformat()

        alerts.append({
            "id": inc.id,
            "type": alert_type,
            "message": msg,
            "severity": severity,
            "zone": inc.zone or "Unknown",
            "impact_score": inc.impact_score or 0,
            "timestamp": timestamp_str,
            "event_cause": inc.event_cause or "Unknown",
            "requires_road_closure": inc.requires_road_closure or False,
        })

    return alerts


@router.get("/what-if-compare")
async def what_if_compare(
    event_cause: str = Query(...),
    zone: str = Query(...),
    attendance_a: int = Query(..., description="First attendance scenario"),
    attendance_b: int = Query(..., description="Second attendance scenario"),
    start_datetime: str = Query(...),
    event_type: str = Query(default="planned"),
    priority: str = Query(default="High"),
    requires_road_closure: bool = Query(default=False),
):
    """
    Compare two attendance scenarios side-by-side.
    """
    base_event = {
        "event_type": event_type,
        "event_cause": event_cause,
        "zone": zone,
        "start_datetime": start_datetime,
        "priority": priority,
        "requires_road_closure": requires_road_closure,
    }

    async def _run_scenario(attendance: int) -> dict:
        event = {**base_event, "expected_attendance": attendance}
        try:
            forecast = compute_congestion_forecast(event)
        except Exception:
            impact = assess_impact(event)
            recs = get_deterministic_recommendations(impact.severity, event)
            forecast = {
                "congestion_risk_score": impact.impact_score,
                "severity_prediction": impact.severity,
                "officers_recommended": recs.get("officers_required", 0),
                "barricades_recommended": recs.get("barricades_required", 0),
            }
        return {
            "attendance": attendance,
            "risk_score": forecast["congestion_risk_score"],
            "severity": forecast["severity_prediction"],
            "officers": forecast.get("officers_recommended", 0),
            "barricades": forecast.get("barricades_recommended", 0),
            "estimated_delay_mins": forecast.get("estimated_delay_mins", 0),
            "expected_clearance_time": forecast.get("expected_clearance_time", "Unknown"),
            "peak_congestion_window": forecast.get("peak_congestion_window", "Unknown"),
        }

    scenario_a = await _run_scenario(attendance_a)
    scenario_b = await _run_scenario(attendance_b)

    return {
        "scenario_a": scenario_a,
        "scenario_b": scenario_b,
        "comparison": {
            "risk_delta": scenario_b["risk_score"] - scenario_a["risk_score"],
            "officer_delta": scenario_b["officers"] - scenario_a["officers"],
            "barricade_delta": scenario_b["barricades"] - scenario_a["barricades"],
            "higher_risk_scenario": "B" if scenario_b["risk_score"] >= scenario_a["risk_score"] else "A",
        },
    }


@router.get("/post-event-report/{incident_id}")
def get_post_event_report(incident_id: int, db: Session = Depends(get_db)):
    """
    Returns a performance/accuracy report for a RESOLVED incident.
    Compares predicted values with actuals derived from the stored record.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if incident.status != IncidentStatus.RESOLVED:
        raise HTTPException(
            status_code=400,
            detail=f"Incident #{incident_id} is not yet resolved (status: {incident.status}). "
                   "Post-event reports are only available for RESOLVED incidents."
        )

    # Re-run impact for the original event to get predicted values
    event_data = {
        "event_type": incident.event_type,
        "event_cause": incident.event_cause,
        "zone": incident.zone,
        "priority": incident.priority,
        "requires_road_closure": incident.requires_road_closure,
        "expected_attendance": incident.expected_attendance,
        "start_datetime": incident.start_datetime.isoformat() if incident.start_datetime else None,
        "end_datetime": incident.end_datetime.isoformat() if incident.end_datetime else None,
        "junction": incident.junction,
        "corridor": incident.corridor,
        "latitude": incident.latitude,
        "longitude": incident.longitude,
    }

    try:
        forecast = compute_congestion_forecast(event_data)
        predicted_severity = forecast["severity_prediction"]
        predicted_delay_mins = forecast["estimated_delay_mins"]
    except Exception:
        predicted_severity = incident.severity or "Unknown"
        predicted_delay_mins = incident.estimated_delay or 0

    # Compute actual duration from DB timestamps
    actual_duration_mins = None
    if incident.created_at and incident.resolved_datetime:
        delta = incident.resolved_datetime - incident.created_at
        actual_duration_mins = int(delta.total_seconds() / 60)
    elif incident.start_datetime and incident.resolved_datetime:
        delta = incident.resolved_datetime - incident.start_datetime
        actual_duration_mins = int(delta.total_seconds() / 60)

    # Duration error %
    if actual_duration_mins is not None and predicted_delay_mins > 0:
        duration_error_pct = round(
            abs(actual_duration_mins - predicted_delay_mins) / predicted_delay_mins * 100, 1
        )
    else:
        duration_error_pct = None

    # Determine resolution efficiency
    if duration_error_pct is None:
        resolution_efficiency = "N/A (insufficient data)"
    elif duration_error_pct <= 15:
        resolution_efficiency = "Excellent"
    elif duration_error_pct <= 35:
        resolution_efficiency = "Good"
    elif duration_error_pct <= 60:
        resolution_efficiency = "Fair"
    else:
        resolution_efficiency = "Poor"

    return {
        "incident_id": incident_id,
        "event_cause": incident.event_cause or "Unknown",
        "zone": incident.zone or "Unknown",
        "predicted_severity": predicted_severity,
        "actual_status": str(incident.status.value if hasattr(incident.status, "value") else incident.status),
        "predicted_delay_mins": predicted_delay_mins,
        "actual_duration_mins": actual_duration_mins,
        "duration_error_pct": duration_error_pct,
        "officers_deployed": incident.officers_required or 0,
        "barricades_deployed": incident.barricades_required or 0,
        "resolution_efficiency": resolution_efficiency,
        "created_at": incident.created_at.isoformat() if incident.created_at else None,
        "resolved_at": incident.resolved_datetime.isoformat() if incident.resolved_datetime else None,
    }
