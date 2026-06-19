import os
import pandas as pd
import numpy as np

DATASET_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv"
)

_df = None

def get_similarity_engine_df():
    global _df
    if _df is None:
        if os.path.exists(DATASET_PATH):
            try:
                _df = pd.read_csv(
                    DATASET_PATH,
                    usecols=[
                        "id", "event_type", "event_cause", "latitude", "longitude",
                        "priority", "start_datetime", "resolved_datetime", "zone",
                        "description", "police_station", "requires_road_closure"
                    ],
                    low_memory=False
                )

                _df['start'] = pd.to_datetime(_df['start_datetime'], errors='coerce', utc=True)
                _df['end'] = pd.to_datetime(_df['resolved_datetime'], errors='coerce', utc=True)
                _df['duration_mins'] = (_df['end'] - _df['start']).dt.total_seconds() / 60.0

                # Estimate officers/barricades from priority (no officer_deployed column in dataset)
                priority_officers = {"high": 10, "medium": 5, "low": 2}
                priority_barricades = {"high": 5, "medium": 2, "low": 1}
                _df['est_officers'] = _df['priority'].astype(str).str.lower().map(
                    lambda p: priority_officers.get(p, 3)
                )
                _df['est_barricades'] = _df['priority'].astype(str).str.lower().map(
                    lambda p: priority_barricades.get(p, 2)
                )

                _df = _df.dropna(subset=['latitude', 'longitude'])
            except Exception as e:
                print(f"Error loading similarity dataset: {e}")
                _df = pd.DataFrame()
        else:
            print("Dataset not found at:", DATASET_PATH)
            _df = pd.DataFrame()
    return _df


def _compute_similarity_score(row, t_cause: str, t_priority: str, t_lat, t_lng) -> float:
    """Compute a 0-100 similarity score for a dataset row vs. the target event."""
    score = 0.0

    # Cause match (40 pts max)
    if str(row['event_cause']).lower().strip() == t_cause:
        score += 40.0

    # Priority match (20 pts max)
    if str(row['priority']).lower().strip() == t_priority:
        score += 20.0

    # Geographic proximity (40 pts max) — only if coordinates provided
    if t_lat is not None and t_lng is not None:
        dist_sq = (row['latitude'] - t_lat) ** 2 + (row['longitude'] - t_lng) ** 2
        # exp decay: 1 degree ≈ 111km; 0.01 deg ≈ 1.1km. Scale so <0.5km ≈ full score
        geo_score = 40.0 * float(np.exp(-2000.0 * dist_sq))
        score += geo_score

    return min(score, 100.0)


def find_similar_events(target_event: dict, top_k: int = 3):
    df = get_similarity_engine_df()
    if df.empty:
        return []

    t_lat = target_event.get('latitude')
    t_lng = target_event.get('longitude')
    t_cause = str(target_event.get('event_cause', '')).lower().strip()
    t_priority = str(target_event.get('priority', '')).lower().strip()

    # -----------------------------------------------------------------------
    # Score every row
    # -----------------------------------------------------------------------
    if t_lat is None or t_lng is None:
        raw_scores = df.apply(
            lambda row: (
                (1 if str(row['event_cause']).lower() == t_cause else 0) +
                (0.5 if str(row['priority']).lower() == t_priority else 0)
            ),
            axis=1
        )
        top_indices = raw_scores.nlargest(top_k).index
        # Map raw 0-1.5 range → 0-100 for similar events block
        similarity_scores = (raw_scores / 1.5 * 100).clip(0, 100)
    else:
        dist_sq = (df['latitude'] - t_lat) ** 2 + (df['longitude'] - t_lng) ** 2
        cause_match = (df['event_cause'].astype(str).str.lower() == t_cause).astype(float)
        prio_match = (df['priority'].astype(str).str.lower() == t_priority).astype(float)
        dist_score = np.exp(-50 * dist_sq)
        final_score = (cause_match * 5) + dist_score + (prio_match * 1)
        top_indices = final_score.nlargest(top_k).index

        # Convert to 0-100 scale
        similarity_scores = (final_score / 7.0 * 100).clip(0, 100)

    # -----------------------------------------------------------------------
    # Compute aggregate stats from ALL matching-cause events (for avg fields)
    # -----------------------------------------------------------------------
    cause_mask = df['event_cause'].astype(str).str.lower() == t_cause
    cause_df = df[cause_mask] if cause_mask.any() else df

    valid_durations = cause_df['duration_mins'].dropna()
    valid_durations = valid_durations[valid_durations >= 0]
    avg_duration_hrs = round(float(valid_durations.mean() / 60.0), 2) if len(valid_durations) > 0 else 1.0

    avg_officers_deployed = round(float(cause_df['est_officers'].mean()), 1)
    avg_barricades_used = round(float(cause_df['est_barricades'].mean()), 1)

    # -----------------------------------------------------------------------
    # Build result list
    # -----------------------------------------------------------------------
    results = []
    for idx in top_indices:
        row = df.loc[idx]
        dur = row['duration_mins']
        if pd.isna(dur) or dur < 0:
            dur_str = "Unknown"
        elif dur > 60:
            dur_str = f"{int(dur // 60)}h {int(dur % 60)}m"
        else:
            dur_str = f"{int(dur)} mins"

        sim_score = round(float(similarity_scores.loc[idx]), 1)

        results.append({
            "id": str(row['id']),
            "event_cause": str(row['event_cause']).title(),
            "priority": str(row['priority']).title() if pd.notna(row['priority']) else "Unknown",
            "zone": str(row['zone']) if pd.notna(row['zone']) else "Unknown",
            "duration": dur_str,
            "description": str(row['description']) if pd.notna(row['description']) else "No description",
            "police_station": str(row['police_station']) if pd.notna(row['police_station']) else "Unknown",
            # Enhanced fields
            "similarity_score": sim_score,
            "avg_duration_hrs": avg_duration_hrs,
            "avg_officers_deployed": avg_officers_deployed,
            "avg_barricades_used": avg_barricades_used,
        })

    return results
