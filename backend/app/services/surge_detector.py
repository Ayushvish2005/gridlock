"""
Surge Detector — Z-score anomaly detection for traffic incident spikes.
Flags when recent incident volume exceeds 2 standard deviations above the
historical hourly baseline for a given corridor/zone.
"""
import math
from typing import List, Dict, Any


def _compute_stats(values: List[float]):
    """Return (mean, std) for a list of floats."""
    n = len(values)
    if n == 0:
        return 0.0, 0.0
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / n
    return mean, math.sqrt(variance)


def check_surge(
    recent: List[Dict[str, Any]],
    historical: List[Dict[str, Any]] = None,
    threshold: float = 2.0,
) -> bool:
    """
    Determine whether the recent incident volume constitutes a surge.

    Parameters
    ----------
    recent:     List of incident dicts from the current monitoring window.
    historical: List of incident dicts used to build the baseline.
                If None or empty, falls back to a lightweight heuristic
                (≥8 incidents in the window is always a surge).
    threshold:  Number of standard deviations above the mean that triggers
                a surge flag (default 2σ).

    Returns
    -------
    bool: True if a surge is detected, False otherwise.
    """
    recent_count = len(recent)

    # Fallback heuristic when no historical baseline is available
    if not historical:
        return recent_count >= 8

    # Build per-hour bucketed counts from the historical data
    hourly_counts: Dict[str, int] = {}
    for incident in historical:
        # Support both timestamp string keys and pre-bucketed keys
        ts = incident.get("timestamp") or incident.get("hour_bucket") or ""
        # Extract YYYY-MM-DDTHH bucket key (first 13 chars)
        bucket = str(ts)[:13] if ts else "unknown"
        hourly_counts[bucket] = hourly_counts.get(bucket, 0) + 1

    baseline_values = list(hourly_counts.values())

    if not baseline_values:
        return recent_count >= 8

    mean, std = _compute_stats(baseline_values)

    # If std is 0 (perfectly flat baseline), any increase is significant
    if std == 0:
        return recent_count > mean

    z_score = (recent_count - mean) / std
    return z_score > threshold


def get_surge_details(
    recent: List[Dict[str, Any]],
    historical: List[Dict[str, Any]] = None,
    threshold: float = 2.0,
) -> Dict[str, Any]:
    """
    Return a detailed surge assessment dict with z-score and metadata.
    """
    recent_count = len(recent)

    if not historical:
        is_surge = recent_count >= 8
        return {
            "is_surge": is_surge,
            "recent_count": recent_count,
            "mean": None,
            "std": None,
            "z_score": None,
            "threshold": threshold,
            "method": "heuristic",
        }

    hourly_counts: Dict[str, int] = {}
    for incident in historical:
        ts = incident.get("timestamp") or incident.get("hour_bucket") or ""
        bucket = str(ts)[:13] if ts else "unknown"
        hourly_counts[bucket] = hourly_counts.get(bucket, 0) + 1

    baseline_values = list(hourly_counts.values())

    if not baseline_values:
        return {
            "is_surge": recent_count >= 8,
            "recent_count": recent_count,
            "mean": None,
            "std": None,
            "z_score": None,
            "threshold": threshold,
            "method": "heuristic_fallback",
        }

    mean, std = _compute_stats(baseline_values)
    z_score = (recent_count - mean) / std if std > 0 else float("inf") if recent_count > mean else 0.0
    is_surge = z_score > threshold

    return {
        "is_surge": is_surge,
        "recent_count": recent_count,
        "mean": round(mean, 2),
        "std": round(std, 2),
        "z_score": round(z_score, 2),
        "threshold": threshold,
        "method": "z_score",
    }
