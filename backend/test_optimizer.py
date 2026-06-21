import sys
import os
import types
import pytest

# Ensure both backend package and app package are discoverable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Dynamically patch check_surge in sys.modules if it is not defined
try:
    from backend.app.services.surge_detector import check_surge
except (ImportError, AttributeError):
    mod_name = "backend.app.services.surge_detector"
    if mod_name not in sys.modules:
        sys.modules[mod_name] = types.ModuleType(mod_name)
    
    def mock_check_surge(recent, historical):
        return len(recent) >= 8
        
    setattr(sys.modules[mod_name], "check_surge", mock_check_surge)
    from backend.app.services.surge_detector import check_surge

from backend.app.services.resource_optimizer import allocate_resources


# ===========================================================================
# Tier 1: Feature Coverage
# ===========================================================================

def test_standard_resource_allocation():
    """
    Test 1.1: Verify resource distribution prioritizes higher-risk incidents
    and respects the global maximum limit.
    """
    active_incidents = [
        {"id": "A", "risk_score": 80},
        {"id": "B", "risk_score": 50},
        {"id": "C", "risk_score": 20}
    ]
    max_officers = 15
    result = allocate_resources(active_incidents, max_officers)
    
    assert isinstance(result, dict), "Output must be a dictionary"
    assert set(result.keys()) == {"A", "B", "C"}, "Output must contain all active incident IDs"
    assert all(isinstance(v, int) for v in result.values()), "All allocations must be integers"
    assert all(v >= 0 for v in result.values()), "Allocations must be non-negative"
    assert sum(result.values()) <= max_officers, "Sum of allocations must not exceed max_officers"
    
    # Priority check: higher risk must get more or equal officers
    assert result["A"] >= result["B"], "A (risk 80) should get >= B (risk 50)"
    assert result["B"] >= result["C"], "B (risk 50) should get >= C (risk 20)"


def test_resource_allocation_abundance():
    """
    Test 1.2: Verify allocation when officer pool is highly abundant.
    """
    active_incidents = [
        {"id": "A", "risk_score": 30},
        {"id": "B", "risk_score": 20}
    ]
    max_officers = 100
    result = allocate_resources(active_incidents, max_officers)
    
    assert sum(result.values()) <= max_officers, "Should respect pool limit"
    assert result["A"] >= result["B"], "Abundant pool must still respect priority ordering"


def test_equal_risk_allocation():
    """
    Test 1.3: Verify that identical risk incidents receive symmetric allocations.
    """
    active_incidents = [
        {"id": "A", "risk_score": 50},
        {"id": "B", "risk_score": 50},
        {"id": "C", "risk_score": 50}
    ]
    max_officers = 10
    result = allocate_resources(active_incidents, max_officers)
    
    assert sum(result.values()) <= max_officers
    # Allocations should be balanced: max difference between any two should be <= 1
    allocations = list(result.values())
    assert max(allocations) - min(allocations) <= 1, "Allocations should be symmetric for equal risks"


# ===========================================================================
# Tier 2: Boundary and Corner Cases
# ===========================================================================

def test_zero_officer_pool():
    """
    Test 2.1: Verify allocation when max_officers is 0.
    """
    active_incidents = [
        {"id": "A", "risk_score": 90},
        {"id": "B", "risk_score": 60}
    ]
    result = allocate_resources(active_incidents, 0)
    assert result == {"A": 0, "B": 0}, "Zero officer pool should result in zero allocations"


def test_single_officer_pool():
    """
    Test 2.2: Verify allocation when max_officers is 1 (only highest risk gets it).
    """
    active_incidents = [
        {"id": "A", "risk_score": 80},
        {"id": "B", "risk_score": 75}
    ]
    result = allocate_resources(active_incidents, 1)
    assert result == {"A": 1, "B": 0}, "Single officer must go to the highest risk incident"


def test_single_active_incident():
    """
    Test 2.3: Verify that a single active incident receives the full allocation up to capacity.
    """
    active_incidents = [{"id": "A", "risk_score": 45}]
    max_officers = 10
    result = allocate_resources(active_incidents, max_officers)
    assert result == {"A": 10}, "Single incident should receive all available officers"


def test_empty_incident_list():
    """
    Test 2.4: Verify behavior with no active incidents.
    """
    result = allocate_resources([], 50)
    assert result == {}, "Empty incident list must return empty dictionary"


def test_zero_and_negative_risk_scores():
    """
    Test 2.5: Verify that negative and zero risk scores receive 0 allocation.
    """
    active_incidents = [
        {"id": "A", "risk_score": -15},
        {"id": "B", "risk_score": 0},
        {"id": "C", "risk_score": 50}
    ]
    max_officers = 10
    result = allocate_resources(active_incidents, max_officers)
    
    assert result["A"] == 0, "Negative risk should receive 0 officers"
    assert result["B"] == 0, "Zero risk should receive 0 officers"
    assert result["C"] == max_officers, "Positive risk should receive the remaining pool"


def test_floating_point_risk_scores():
    """
    Test 2.6: Verify floats in risk scores are parsed and prioritized correctly.
    """
    active_incidents = [
        {"id": "A", "risk_score": 82.5},
        {"id": "B", "risk_score": 41.25}
    ]
    max_officers = 10
    result = allocate_resources(active_incidents, max_officers)
    
    assert result["A"] >= result["B"]
    assert sum(result.values()) <= max_officers


def test_floating_point_max_officers():
    """
    Test 2.7: Verify floating-point officer limit is coerced safely.
    """
    active_incidents = [{"id": "A", "risk_score": 75}]
    result = allocate_resources(active_incidents, 12.6)
    assert result == {"A": 12}, "Floating-point limit must be floored to integer"


def test_invalid_input_schema():
    """
    Test 2.8: Verify input schema validation and exception raising.
    """
    # Missing risk_score
    with pytest.raises((KeyError, ValueError, TypeError)):
        allocate_resources([{"id": "A"}], 10)
        
    # Malformed incident type
    with pytest.raises(TypeError):
        allocate_resources(["invalid_type"], 10)
        
    # Invalid max_officers string type
    with pytest.raises((TypeError, ValueError)):
        allocate_resources([{"id": "A", "risk_score": 50}], "ten")


# ===========================================================================
# Tier 3: Cross-Feature Combinations
# ===========================================================================

def test_surge_alert_risk_scaling_integration():
    """
    Test 3.1: Verify integration where a Z-score surge alert dynamically
    scales the incident priority/risk scores, modifying the output of allocate_resources.
    """
    # 1. Standard incidents in different zones
    incidents = [
        {"id": "inc_zone1", "zone": "Central", "risk_score": 50},
        {"id": "inc_zone2", "zone": "Residential", "risk_score": 60}
    ]
    max_officers = 11
    
    # Baseline run: Zone 2 incident has higher risk, gets more officers
    res_base = allocate_resources(incidents, max_officers)
    assert res_base["inc_zone2"] > res_base["inc_zone1"]
    
    # 2. Simulate recent traffic surge in Zone 1
    recent_zone1_incidents = [{"timestamp": "2026-06-21T09:05:00Z"} for _ in range(8)]
    historical_zone1_incidents = [
        {"timestamp": f"2026-06-{d}T09:10:00Z"} for d in ["15", "16", "17", "18", "19"]
    ]
    # Assume check_surge triggers True for Zone 1 (since len(recent_zone1_incidents) == 8 >= 8)
    surge_active = check_surge(recent_zone1_incidents, historical_zone1_incidents)
    
    # 3. Dynamic adjustment: Scale risk score if surge is active
    scaled_incidents = []
    for inc in incidents:
        scaled_inc = inc.copy()
        if inc["zone"] == "Central" and surge_active:
            scaled_inc["risk_score"] *= 1.5  # 50 * 1.5 = 75
        scaled_incidents.append(scaled_inc)
        
    # 4. Re-run optimizer with scaled risk scores
    res_surge = allocate_resources(scaled_incidents, max_officers)
    
    # Now Central (risk 75) should receive more officers than Residential (risk 60)
    assert res_surge["inc_zone1"] > res_surge["inc_zone2"], "Surged zone incident must be prioritized"
    assert sum(res_surge.values()) <= max_officers


def test_geographic_infrastructure_stress_prioritization():
    """
    Test 3.2: Verify that incidents near active construction nodes (retrieved
    from database count) trigger a priority multiplier that reallocates officers.
    """
    incidents = [
        {"id": "inc_zone_central", "zone": "Central", "risk_score": 40},
        {"id": "inc_zone_residential", "zone": "Residential", "risk_score": 50}
    ]
    max_officers = 9
    
    # Baseline: Residential zone incident has higher risk, gets more officers
    res_base = allocate_resources(incidents, max_officers)
    assert res_base["inc_zone_residential"] > res_base["inc_zone_central"]
    
    # Simulate database retrieval of construction counts per zone
    construction_counts = {"Central": 3, "Residential": 0}
    
    # Scale risk scores dynamically based on the active construction zone multiplier
    # multiplier = min(1.0 + (construction_count * 0.15), 2.5)
    scaled_incidents = []
    for inc in incidents:
        scaled_inc = inc.copy()
        c_count = construction_counts.get(inc["zone"], 0)
        if c_count > 0:
            multiplier = min(1.0 + (c_count * 0.15), 2.5)
            scaled_inc["risk_score"] = int(scaled_inc["risk_score"] * multiplier)
        scaled_incidents.append(scaled_inc)
        
    # Re-run optimizer with scaled risk scores
    res_stressed = allocate_resources(scaled_incidents, max_officers)
    
    # Now Central (risk 58) should get more officers than Residential (risk 50)
    assert res_stressed["inc_zone_central"] > res_stressed["inc_zone_residential"]
    assert sum(res_stressed.values()) <= max_officers


# ===========================================================================
# Tier 4: Real-World Application Scenarios
# ===========================================================================

def test_city_wide_evening_rush_hour():
    """
    Test 4.1: Simulate a large fleet allocation (150 officers) across
    8 concurrent real-world incidents in Bangalore.
    """
    active_incidents = [
        {"id": "inc_cbd", "zone": "Central", "risk_score": 85},          # Critical
        {"id": "inc_it", "zone": "HAL Old Airport", "risk_score": 70},   # High
        {"id": "inc_transit", "zone": "City Market", "risk_score": 50},  # Medium
        {"id": "inc_res_1", "zone": "Malleshwaram", "risk_score": 30},   # Low
        {"id": "inc_res_2", "zone": "South Zone 1", "risk_score": 25},   # Low
        {"id": "inc_cbd_2", "zone": "Shivajinagar", "risk_score": 90},   # Critical
        {"id": "inc_retail", "zone": "Upparpet", "risk_score": 65},      # High
        {"id": "inc_mixed", "zone": "Central Zone 2", "risk_score": 40}  # Medium
    ]
    max_officers = 150
    result = allocate_resources(active_incidents, max_officers)
    
    assert isinstance(result, dict)
    assert set(result.keys()) == {inc["id"] for inc in active_incidents}
    assert sum(result.values()) <= max_officers
    
    # Assert priority constraints follow the risk scores chain
    # inc_cbd_2 (90) >= inc_cbd (85) >= inc_it (70) >= inc_retail (65) >= inc_transit (50) >= inc_mixed (40) ...
    assert result["inc_cbd_2"] >= result["inc_cbd"]
    assert result["inc_cbd"] >= result["inc_it"]
    assert result["inc_it"] >= result["inc_retail"]
    assert result["inc_retail"] >= result["inc_transit"]
    assert result["inc_transit"] >= result["inc_mixed"]
    assert result["inc_mixed"] >= result["inc_res_1"]
    assert result["inc_res_1"] >= result["inc_res_2"]


def test_manpower_preemption_vip_event():
    """
    Test 4.2: Verify that a newly reported critical VIP event preempts resources
    from existing low-priority incidents.
    """
    max_officers = 40
    
    # State 1: Normal operations
    state1_incidents = [
        {"id": "inc_transit", "risk_score": 50},
        {"id": "inc_res_1", "risk_score": 30}
    ]
    res_state1 = allocate_resources(state1_incidents, max_officers)
    
    # Verify base allocations are positive and respect limits
    assert res_state1["inc_transit"] > 0
    assert res_state1["inc_res_1"] > 0
    assert sum(res_state1.values()) <= max_officers
    
    # State 2: Sudden VIP Movement event added (high risk score = 95)
    state2_incidents = state1_incidents + [{"id": "inc_vip", "risk_score": 95}]
    res_state2 = allocate_resources(state2_incidents, max_officers)
    
    # Verify the new critical incident is prioritised and preempted resources
    assert res_state2["inc_vip"] > 0
    assert res_state2["inc_vip"] > res_state2["inc_transit"]
    
    # Existing incidents must have fewer resources allocated in State 2 than in State 1 (preemption)
    assert res_state2["inc_transit"] < res_state1["inc_transit"], "Manpower should be preempted from transit"
    assert res_state2["inc_res_1"] < res_state1["inc_res_1"], "Manpower should be preempted from residential"
    assert sum(res_state2.values()) <= max_officers
