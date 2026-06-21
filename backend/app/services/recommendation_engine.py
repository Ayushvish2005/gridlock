import os
import json
import httpx
from typing import Dict, Any
from app.database.config import SessionLocal
from app.models.incident import Incident, IncidentStatus
from sqlalchemy import func

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# ZONE ARCHETYPES — Maps areas to their "personality"
ZONE_ARCHETYPES = {
    'Central': 'CBD_COMMERCIAL',
    'Upparpet': 'CBD_RETAIL',
    'Shivajinagar': 'CBD_COMMERCIAL',
    'Malleshwaram': 'RESIDENTIAL_COMMERCIAL',
    'HAL Old Airport': 'IT_CORRIDOR',
    'City Market': 'TRANSIT_HUB',
    'South Zone 1': 'IT_CORRIDOR',
    'Central Zone 2': 'MIXED_RESIDENTIAL'
}

def get_deterministic_recommendations(severity: str, event_data: dict) -> dict:
    """Fallback deterministic rules if LLM fails or is not configured."""
    recs = {
        "officers_required": 0,
        "barricades_required": 0,
        "diversion_required": False,
        "parking_management_required": False,
        "emergency_access_corridor": False,
        "tow_vehicle_required": False,
        "crowd_control_team": False,
        "zone_archetype": "GENERAL",
        "pcu_impact_score": 0,
        "global_strategies": [],
        "spatial_spillover_warning": False,
        "nearest_poi_distance": ""
    }

    if severity == "Low":
        recs["officers_required"] = 1
    elif severity == "Medium":
        recs["officers_required"] = 3
        recs["barricades_required"] = 1
    elif severity == "High":
        recs["officers_required"] = 6
        recs["barricades_required"] = 3
        recs["diversion_required"] = True
        recs["parking_management_required"] = True
    elif severity == "Critical":
        recs["officers_required"] = 10
        recs["barricades_required"] = 5
        recs["diversion_required"] = True
        recs["parking_management_required"] = True
        recs["emergency_access_corridor"] = True
        recs["tow_vehicle_required"] = True

    cause = str(event_data.get('event_cause', '')).strip().lower()
    if event_data.get("requires_road_closure"):
        recs["diversion_required"] = True
    if "protest" in cause or "rally" in cause:
        recs["crowd_control_team"] = True
    if "accident" in cause or "breakdown" in cause:
        recs["tow_vehicle_required"] = True
    if "festival" in cause or "concert" in cause or "sports" in cause:
        recs["parking_management_required"] = True

    attendance = event_data.get("expected_attendance")
    if attendance:
        if attendance > 10000:
            recs["officers_required"] += 15
            recs["barricades_required"] += 20
        elif attendance > 5000:
            recs["officers_required"] += 8
            recs["barricades_required"] += 10
        elif attendance > 1000:
            recs["officers_required"] += 4
            recs["barricades_required"] += 5

    # Implement Zone Archetyping
    zone = str(event_data.get('zone', '')).strip()
    recs["zone_archetype"] = ZONE_ARCHETYPES.get(zone, "GENERAL")

    # Implement PCU Impact Estimation based on severity and attendance
    base_pcu = 10 if severity == "Low" else 30 if severity == "Medium" else 60 if severity == "High" else 100
    recs["pcu_impact_score"] = base_pcu + (attendance / 500 if attendance else 0)

    # Implement Global Urban Planning Strategies Engine
    strategies = []
    
    # 1. SFpark Tow Priority (High PCU)
    if recs["pcu_impact_score"] > 80:
        strategies.append("DEPLOY_TOW_TRUCK_SF_MODEL")

    # 2. Indonesia Push-Pull (IT Corridors)
    if recs["zone_archetype"] in ['IT_CORRIDOR', 'TRANSIT_HUB']:
        strategies.append("PARK_AND_RIDE_DIVERSION")

    # 3. Barcelona Superblock (Weekends / Festivals)
    if "festival" in cause or "public_event" in cause:
        strategies.append("TEMPORARY_SUPERBLOCK")

    # 4. Vietnam Model Ward (Critical severity / high priority)
    if severity == "Critical":
        strategies.append("ACTIVATE_MODEL_WARD")

    # 5. Taipei Scooter Zoning / Bangkok Win System (if accident or vehicle breakdown in tight zones)
    if "accident" in cause or "vehicle_breakdown" in cause:
        if recs["zone_archetype"] == 'CBD_COMMERCIAL':
            strategies.append("DESIGNATE_SCOOTER_ZONE")
        else:
            strategies.append("CREATE_AUTO_STAND")

    recs["global_strategies"] = strategies

    if recs["pcu_impact_score"] > 50:
        recs["spatial_spillover_warning"] = True

    # Implement Haversine Distance to mock POI (Majestic Metro Station at 12.9716, 77.5946)
    def haversine(lat1, lon1, lat2, lon2):
        import math
        R = 6371.0
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        a = math.sin(dLat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    lat = event_data.get('latitude')
    lng = event_data.get('longitude')
    if lat and lng:
        try:
            dist = haversine(float(lat), float(lng), 12.9716, 77.5946)
            recs["nearest_poi_distance"] = f"{dist:.1f} km from Central Metro"
        except:
            recs["nearest_poi_distance"] = "Unknown"

    return recs

CITY_MAX_OFFICERS = 300
CITY_MAX_BARRICADES = 400

def apply_resource_constraints(recs: dict, event_data: dict) -> dict:
    """Treat available manpower as a strict constraint. Uses a greedy approach to allocate resources."""
    db = SessionLocal()
    try:
        # Sum currently deployed resources for ACTIVE incidents
        active_incidents = db.query(Incident).filter(Incident.status == IncidentStatus.ACTIVE).all()
        deployed_officers = sum(i.officers_required for i in active_incidents if i.officers_required)
        deployed_barricades = sum(i.barricades_required for i in active_incidents if i.barricades_required)
        
        available_officers = max(0, CITY_MAX_OFFICERS - deployed_officers)
        available_barricades = max(0, CITY_MAX_BARRICADES - deployed_barricades)

        # Greedy allocation
        requested_officers = recs["officers_required"]
        requested_barricades = recs["barricades_required"]

        # If we don't have enough, we clip the allocation to what's available
        recs["officers_required"] = min(requested_officers, available_officers)
        recs["barricades_required"] = min(requested_barricades, available_barricades)
        
        # Add constraint flags for the frontend to show warnings
        recs["resource_constrained"] = (requested_officers > available_officers) or (requested_barricades > available_barricades)
        recs["original_request"] = {"officers": requested_officers, "barricades": requested_barricades}
        
    finally:
        db.close()
    return recs

async def generate_recommendations(severity: str, event_data: dict) -> Dict[str, Any]:
    """Dynamically generates operational recommendations using an LLM based on context."""
    if not OPENROUTER_API_KEY or OPENROUTER_API_KEY == "your_openrouter_api_key_here":
        print("No valid OpenRouter key, falling back to deterministic recommendations.")
        raw_recs = get_deterministic_recommendations(severity, event_data)
        return apply_resource_constraints(raw_recs, event_data)

    baseline = get_deterministic_recommendations(severity, event_data)

    prompt = f"""
    You are an expert AI Traffic Operations Manager for a major city.
    Given the following event details, determine the logistical resources required. 

    Context:
    - Event Cause: {event_data.get('event_cause')}
    - Expected Attendance: {event_data.get('expected_attendance') or 'Unknown'}
    - Road Closure Required: {event_data.get('requires_road_closure')}
    - Priority: {event_data.get('priority')}
    - Zone: {event_data.get('zone')}
    - Location Coordinates: Lat {event_data.get('latitude')}, Lng {event_data.get('longitude')}
    - ML Assessed Severity: {severity}

    STRICT GUIDELINES:
    1. Do NOT hallucinate absurd numbers. A maximum of 50 officers should be deployed for the worst critical events unless attendance is over 50,000.
    2. A standard baseline calculation suggests: {baseline['officers_required']} Officers and {baseline['barricades_required']} Barricades. 
    3. You may adjust the baseline slightly up or down based on the exact event cause and location coordinates, but stay within realistic city operational limits.

    Provide your recommendations strictly as a valid JSON object with the following keys and boolean/integer values. Do not wrap in markdown blocks:
    {{
        "officers_required": (integer, estimate based on attendance/severity),
        "barricades_required": (integer, estimate based on crowd size/severity),
        "diversion_required": (boolean),
        "parking_management_required": (boolean),
        "emergency_access_corridor": (boolean),
        "tow_vehicle_required": (boolean),
        "crowd_control_team": (boolean),
        "zone_archetype": "{baseline['zone_archetype']}",
        "pcu_impact_score": {baseline['pcu_impact_score']},
        "global_strategies": {json.dumps(baseline['global_strategies'])},
        "spatial_spillover_warning": {str(baseline['spatial_spillover_warning']).lower()},
        "nearest_poi_distance": "{baseline['nearest_poi_distance']}"
    }}
    """

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "openai/gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2
                },
                timeout=15.0
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()
            # Clean up markdown if present
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            
            recs = json.loads(content)
            
            # Ensure all required keys exist
            defaults = get_deterministic_recommendations(severity, event_data)
            for key in defaults:
                if key not in recs:
                    recs[key] = defaults[key]
                    
            return apply_resource_constraints(recs, event_data)
    except Exception as e:
        print(f"Error calling LLM for recommendations: {e}. Falling back.")
        raw_recs = get_deterministic_recommendations(severity, event_data)
        return apply_resource_constraints(raw_recs, event_data)
