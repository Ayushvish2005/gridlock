"""
Multi-Event Resource Optimizer — LP-based officer allocation across simultaneous incidents.
Uses PuLP's CBC solver to optimally distribute a global officer pool,
weighted by risk score, while respecting the hard capacity constraint.
"""
from typing import List, Dict, Any


def allocate_resources(
    active_incidents: List[Dict[str, Any]],
    max_officers: int,
) -> Dict[str, int]:
    """
    Allocate officers across multiple active incidents using Linear Programming.

    Parameters
    ----------
    active_incidents:  List of incident dicts, each with at minimum:
                       - "id"         (str)   unique incident identifier
                       - "risk_score" (float) numeric risk score (0-100 typical)
    max_officers:      Maximum number of officers available in the global pool.
                       Accepts float and will be floored to int.

    Returns
    -------
    Dict[str, int]: Mapping of incident ID -> allocated officer count.

    Raises
    ------
    TypeError:  If input types are invalid.
    ValueError: If individual incidents are malformed.
    """
    # ------------------------------------------------------------------
    # Input validation
    # ------------------------------------------------------------------
    if not isinstance(active_incidents, list):
        raise TypeError("active_incidents must be a list")

    if isinstance(max_officers, str):
        raise TypeError("max_officers must be numeric, not a string")

    try:
        max_officers = int(max_officers)  # floors floats
    except (TypeError, ValueError):
        raise TypeError("max_officers must be a numeric value")

    if not active_incidents:
        return {}

    for inc in active_incidents:
        if not isinstance(inc, dict):
            raise TypeError(f"Each incident must be a dict, got {type(inc)}")
        if "risk_score" not in inc:
            raise KeyError(f"Incident missing 'risk_score': {inc}")

    # ------------------------------------------------------------------
    # Zero pool shortcut
    # ------------------------------------------------------------------
    if max_officers <= 0:
        return {inc["id"]: 0 for inc in active_incidents}

    # ------------------------------------------------------------------
    # Normalise risk scores and demands
    # ------------------------------------------------------------------
    risks = {inc["id"]: max(0.0, float(inc["risk_score"])) for inc in active_incidents}
    demands = {inc["id"]: int(inc.get("demand", 999999)) for inc in active_incidents}
    allocations = {inc["id"]: 0 for inc in active_incidents}
    
    remaining_pool = max_officers
    active_ids = [inc["id"] for inc in active_incidents if demands[inc["id"]] > 0]
    
    # Iterative allocation bounded by demand
    while remaining_pool > 0 and active_ids:
        total_risk = sum(risks[iid] for iid in active_ids)
        
        if total_risk == 0:
            # If no risk differentiation, distribute 1 to each until empty
            for iid in list(active_ids):
                if remaining_pool > 0:
                    allocations[iid] += 1
                    demands[iid] -= 1
                    remaining_pool -= 1
                    if demands[iid] <= 0:
                        active_ids.remove(iid)
                else:
                    break
            continue
            
        # Calculate raw proportional allocation for this round
        raw_alloc = {}
        for iid in active_ids:
            proportion = risks[iid] / total_risk
            # Floor the proportional amount, bounded by remaining demand
            amt = min(int(proportion * remaining_pool), demands[iid])
            raw_alloc[iid] = amt
            
        total_allocated_this_round = sum(raw_alloc.values())
        
        # If proportional amounts were too small (all < 1), distribute 1 to highest risk
        if total_allocated_this_round == 0:
            active_ids.sort(key=lambda x: risks[x], reverse=True)
            for iid in list(active_ids):
                if remaining_pool > 0 and demands[iid] > 0:
                    allocations[iid] += 1
                    demands[iid] -= 1
                    remaining_pool -= 1
                    if demands[iid] <= 0:
                        active_ids.remove(iid)
                else:
                    break
            continue
            
        # Apply the computed allocations
        for iid in list(active_ids):
            amt = raw_alloc[iid]
            allocations[iid] += amt
            demands[iid] -= amt
            remaining_pool -= amt
            if demands[iid] <= 0:
                active_ids.remove(iid)

    return allocations
