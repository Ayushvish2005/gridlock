def generate_recommendations(severity: str, event_data: dict) -> dict:
    """Deterministic operational recommendations based on severity."""
    recs = {
        "officers_required": 0,
        "barricades_required": 0,
        "diversion_required": False,
        "parking_management_required": False,
        "emergency_access_corridor": False,
        "tow_vehicle_required": False,
        "crowd_control_team": False
    }

    # Severity based actions
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

    # Additional rules
    cause = str(event_data.get('event_cause', '')).strip().lower()

    if event_data.get("requires_road_closure"):
        recs["diversion_required"] = True

    if "protest" in cause or "rally" in cause:
        recs["crowd_control_team"] = True

    if "accident" in cause or "breakdown" in cause:
        recs["tow_vehicle_required"] = True

    if "festival" in cause or "concert" in cause or "sports" in cause:
        recs["parking_management_required"] = True

    return recs
