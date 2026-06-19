import os
import json
import httpx
from typing import Dict, Any

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

def get_deterministic_recommendations(severity: str, event_data: dict) -> dict:
    """Fallback deterministic rules if LLM fails or is not configured."""
    recs = {
        "officers_required": 0,
        "barricades_required": 0,
        "diversion_required": False,
        "parking_management_required": False,
        "emergency_access_corridor": False,
        "tow_vehicle_required": False,
        "crowd_control_team": False
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

    return recs

async def generate_recommendations(severity: str, event_data: dict) -> Dict[str, Any]:
    """Dynamically generates operational recommendations using an LLM based on context."""
    if not OPENROUTER_API_KEY or OPENROUTER_API_KEY == "your_openrouter_api_key_here":
        print("No valid OpenRouter key, falling back to deterministic recommendations.")
        return get_deterministic_recommendations(severity, event_data)

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
        "crowd_control_team": (boolean)
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
                    
            return recs
    except Exception as e:
        print(f"Error calling LLM for recommendations: {e}. Falling back.")
        return get_deterministic_recommendations(severity, event_data)
