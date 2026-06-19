from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from sqlalchemy import func

from app.database.config import get_db
from app.models.incident import Incident, IncidentStatus
from app.schemas.incident import IncidentCreate, IncidentResponse, PredictRequest, PredictResponse
from app.services.impact_engine import assess_impact
from app.services.recommendation_engine import generate_recommendations
from app.services.ai_explainer import generate_explanation
from app.services.similarity_engine import find_similar_events

router = APIRouter()

@router.post("/predict", response_model=PredictResponse)
async def predict_incident_impact(request: PredictRequest):
    event_data = request.model_dump()

    # 1. Assess Impact
    impact = assess_impact(event_data)

    # 2. Generate Recommendations
    recs = await generate_recommendations(impact.severity, event_data)

    # 3. Get AI Explanation
    explanation = await generate_explanation(impact.model_dump(), recs, event_data)

    # 4. Find Similar Events
    similar = find_similar_events(event_data, top_k=5)
    
    # 5. Get detailed forecast metrics
    from app.services.forecasting_engine import compute_congestion_forecast
    forecast = compute_congestion_forecast(event_data)

    return PredictResponse(
        impact_score=forecast["congestion_risk_score"],
        severity=forecast["severity_prediction"],
        estimated_delay=forecast["estimated_delay_mins"],
        impact_radius=forecast.get("impact_radius_km", 1.0) * 1000, # Convert km to meters approx
        priority_rank="P1" if forecast["severity_prediction"]=="Critical" else "P2",
        recommendations=recs,
        ai_explanation=explanation,
        similar_events=similar,
        peak_congestion_window=forecast.get("peak_congestion_window"),
        affected_junctions=forecast.get("affected_junctions", 0),
        impact_breakdown=forecast.get("impact_breakdown", {})
    )

@router.post("/incident", response_model=IncidentResponse)
async def create_incident(request: IncidentCreate, db: Session = Depends(get_db)):
    event_data = request.model_dump()

    # Run prediction flow
    impact = assess_impact(event_data)
    recs = await generate_recommendations(impact.severity, event_data)
    explanation = await generate_explanation(impact.model_dump(), recs, event_data)

    # Create DB model
    db_incident = Incident(
        **event_data,
        impact_score=impact.impact_score,
        severity=impact.severity,
        estimated_delay=impact.estimated_delay,
        impact_radius=impact.impact_radius,
        priority_rank=impact.priority_rank,
        **recs,
        ai_explanation=explanation,
        status=IncidentStatus.ACTIVE
    )

    db.add(db_incident)
    db.commit()
    db.refresh(db_incident)

    # Construct response
    res = IncidentResponse.model_validate(db_incident)
    res.recommendations = {
        "officers_required": db_incident.officers_required,
        "barricades_required": db_incident.barricades_required,
        "diversion_required": db_incident.diversion_required,
        "parking_management_required": db_incident.parking_management_required,
        "emergency_access_corridor": db_incident.emergency_access_corridor,
        "tow_vehicle_required": db_incident.tow_vehicle_required,
        "crowd_control_team": db_incident.crowd_control_team
    }
    return res

@router.get("/incidents", response_model=List[IncidentResponse])
def get_incidents(db: Session = Depends(get_db), status: str = None):
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)

    incidents = query.order_by(Incident.created_at.desc()).all()

    responses = []
    for inc in incidents:
        res = IncidentResponse.model_validate(inc)
        res.recommendations = {
            "officers_required": inc.officers_required,
            "barricades_required": inc.barricades_required,
            "diversion_required": inc.diversion_required,
            "parking_management_required": inc.parking_management_required,
            "emergency_access_corridor": inc.emergency_access_corridor,
            "tow_vehicle_required": inc.tow_vehicle_required,
            "crowd_control_team": inc.crowd_control_team
        }
        responses.append(res)

    return responses

@router.get("/incidents/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    res = IncidentResponse.model_validate(incident)
    res.recommendations = {
        "officers_required": incident.officers_required,
        "barricades_required": incident.barricades_required,
        "diversion_required": incident.diversion_required,
        "parking_management_required": incident.parking_management_required,
        "emergency_access_corridor": incident.emergency_access_corridor,
        "tow_vehicle_required": incident.tow_vehicle_required,
        "crowd_control_team": incident.crowd_control_team
    }
    return res

@router.put("/incidents/{incident_id}/resolve")
def resolve_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident.status = IncidentStatus.RESOLVED
    incident.resolved_datetime = func.now()
    db.commit()
    return {"message": "Incident resolved successfully"}

@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    # Basic analytics for dashboard
    total_active = db.query(Incident).filter(Incident.status == IncidentStatus.ACTIVE).count()
    critical_active = db.query(Incident).filter(Incident.status == IncidentStatus.ACTIVE, Incident.severity == 'Critical').count()

    total_officers = db.query(func.sum(Incident.officers_required)).filter(Incident.status == IncidentStatus.ACTIVE).scalar() or 0
    total_barricades = db.query(func.sum(Incident.barricades_required)).filter(Incident.status == IncidentStatus.ACTIVE).scalar() or 0
    total_closures = db.query(Incident).filter(Incident.status == IncidentStatus.ACTIVE, Incident.requires_road_closure == True).count()

    events_by_type = db.query(Incident.event_type, func.count(Incident.id)).group_by(Incident.event_type).all()
    incidents_by_zone = db.query(Incident.zone, func.count(Incident.id)).group_by(Incident.zone).all()
    severity_dist = db.query(Incident.severity, func.count(Incident.id)).group_by(Incident.severity).all()

    return {
        "summary": {
            "active_incidents": total_active,
            "critical_incidents": critical_active,
            "officers_required": int(total_officers),
            "barricades_required": int(total_barricades),
            "road_closures": total_closures
        },
        "charts": {
            "events_by_type": [{"name": t, "value": c} for t, c in events_by_type if t],
            "incidents_by_zone": [{"name": z, "value": c} for z, c in incidents_by_zone if z],
            "severity_distribution": [{"name": s, "value": c} for s, c in severity_dist if s]
        }
    }
