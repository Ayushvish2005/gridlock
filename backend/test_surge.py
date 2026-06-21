import sys
import os
from datetime import datetime, timezone
import pytest

# Ensure both backend package and app package are discoverable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from backend.app.services.surge_detector import check_surge

# Tier 1 Dataset Configuration
mock_history_tier1 = [
    # Day 1: 2026-06-15 (4 incidents in hour 9, 1 in hour 10 to check isolation)
    {"timestamp": "2026-06-15T09:05:00Z"},
    {"timestamp": "2026-06-15T09:20:00Z"},
    {"timestamp": "2026-06-15T09:35:00Z"},
    {"timestamp": "2026-06-15T09:50:00Z"},
    {"timestamp": "2026-06-15T10:00:00Z"}, # Ignored
    # Day 2: 2026-06-16 (5 incidents in hour 9)
    {"timestamp": "2026-06-16T09:10:00Z"},
    {"timestamp": "2026-06-16T09:15:00Z"},
    {"timestamp": "2026-06-16T09:30:00Z"},
    {"timestamp": "2026-06-16T09:40:00Z"},
    {"timestamp": "2026-06-16T09:55:00Z"},
    # Day 3: 2026-06-17 (3 incidents in hour 9, 1 in hour 11 to check isolation)
    {"timestamp": "2026-06-17T09:00:00Z"},
    {"timestamp": "2026-06-17T09:25:00Z"},
    {"timestamp": "2026-06-17T09:45:00Z"},
    {"timestamp": "2026-06-17T11:15:00Z"}, # Ignored
    # Day 4: 2026-06-18 (6 incidents in hour 9)
    {"timestamp": "2026-06-18T09:02:00Z"},
    {"timestamp": "2026-06-18T09:12:00Z"},
    {"timestamp": "2026-06-18T09:22:00Z"},
    {"timestamp": "2026-06-18T09:32:00Z"},
    {"timestamp": "2026-06-18T09:42:00Z"},
    {"timestamp": "2026-06-18T09:52:00Z"},
    # Day 5: 2026-06-19 (2 incidents in hour 9)
    {"timestamp": "2026-06-19T09:08:00Z"},
    {"timestamp": "2026-06-19T09:44:00Z"},
]

# ==========================================
# TIER 1: Feature Coverage (Core Functionality)
# ==========================================

def test_surge_detected_standard():
    # 8 incidents in hour 9
    recent = [{"timestamp": f"2026-06-21T09:{i*5:02d}:00Z"} for i in range(8)]
    assert check_surge(recent, mock_history_tier1) is True

def test_no_surge_detected_standard():
    # 4 incidents in hour 9
    recent = [{"timestamp": f"2026-06-21T09:{i*10:02d}:00Z"} for i in range(4)]
    assert check_surge(recent, mock_history_tier1) is False

def test_surge_borderline_below():
    # 7 incidents in hour 9. Threshold is ~7.162 (under sample std dev)
    recent = [{"timestamp": f"2026-06-21T09:{i*5:02d}:00Z"} for i in range(7)]
    assert check_surge(recent, mock_history_tier1) is False

def test_surge_borderline_above():
    # 8 incidents in hour 9. Threshold is ~7.162 (under sample std dev)
    recent = [{"timestamp": f"2026-06-21T09:{i*5:02d}:00Z"} for i in range(8)]
    assert check_surge(recent, mock_history_tier1) is True


# ==========================================
# TIER 2: Boundary and Corner Cases
# ==========================================

def test_empty_recent_incidents():
    # Empty list must return False directly
    assert check_surge([], mock_history_tier1) is False

def test_empty_or_none_historical_incidents():
    # Raises ValueError when history is empty or None
    recent = [{"timestamp": "2026-06-21T09:00:00Z"}]
    with pytest.raises(ValueError, match="Historical incidents cannot be empty or None"):
        check_surge(recent, [])
    with pytest.raises(ValueError, match="Historical incidents cannot be empty or None"):
        check_surge(recent, None)

def test_historical_std_dev_zero():
    # 5 days with exactly 5 incidents in hour 9. Mean = 5.0, Std Dev = 0.0.
    hist = []
    for day in range(15, 20):
        for _ in range(5):
            hist.append({"timestamp": f"2026-06-{day}T09:00:00Z"})
    
    # Case A: 5 incidents (x <= 5.0 + 2*0 -> False)
    recent_a = [{"timestamp": f"2026-06-21T09:{i*5:02d}:00Z"} for i in range(5)]
    assert check_surge(recent_a, hist) is False
    
    # Case B: 6 incidents (x > 5.0 + 2*0 -> True)
    recent_b = [{"timestamp": f"2026-06-21T09:{i*5:02d}:00Z"} for i in range(6)]
    assert check_surge(recent_b, hist) is True

def test_historical_single_day():
    # Standard deviation requires N >= 2 unique days. Single day raises ValueError.
    recent = [{"timestamp": "2026-06-21T09:00:00Z"}]
    hist = [{"timestamp": f"2026-06-15T09:{i*5:02d}:00Z"} for i in range(5)]
    with pytest.raises(ValueError, match="at least 2 unique days"):
        check_surge(recent, hist)

def test_very_small_std_dev():
    # Baseline: 5 days with 5 incidents, 1 day with 6 incidents in hour 9
    # Mean = 31/6 = 5.166667. Sample Std Dev = 0.408248. Threshold = 5.98316
    hist = []
    for day in range(15, 20):
        for _ in range(5):
            hist.append({"timestamp": f"2026-06-{day}T09:00:00Z"})
    for _ in range(6):
        hist.append({"timestamp": "2026-06-20T09:00:00Z"})
        
    recent = [{"timestamp": f"2026-06-21T09:{i*5:02d}:00Z"} for i in range(6)]
    assert check_surge(recent, hist) is True

def test_invalid_timestamp_formats():
    # Invalid timestamp string or non-string timestamp should raise ValueError
    with pytest.raises(ValueError):
        check_surge([{"timestamp": "invalid_date_string"}], mock_history_tier1)
    with pytest.raises(ValueError):
        check_surge([{"timestamp": None}], mock_history_tier1)
    with pytest.raises(ValueError):
        check_surge([{"timestamp": 12345}], mock_history_tier1)

def test_missing_timestamp_key():
    # Missing 'timestamp' key should raise KeyError or ValueError
    with pytest.raises((KeyError, ValueError)):
        check_surge([{"id": 1}], mock_history_tier1)


# ==========================================
# TIER 3: Cross-Feature Combinations
# ==========================================

def test_target_hour_isolation():
    # Target hour derived from recent_incidents first element.
    # We verify isolation by setting target hour to 14.
    # Hour 14: Mean = 0.5, Std Dev = 0.5477, Threshold = 1.5954. Volume 2 -> True.
    # Hour 9: Mean = 10.0. Volume 2 -> False.
    hist = []
    # Hour 9 incidents (on days 15, 16, 17, 18)
    for _ in range(15): hist.append({"timestamp": "2026-06-15T09:00:00Z"})
    for _ in range(16): hist.append({"timestamp": "2026-06-16T09:00:00Z"})
    for _ in range(14): hist.append({"timestamp": "2026-06-17T09:00:00Z"})
    for _ in range(15): hist.append({"timestamp": "2026-06-18T09:00:00Z"})
    # Hour 14 incidents (on days 15, 17, 19)
    hist.append({"timestamp": "2026-06-15T14:00:00Z"})
    hist.append({"timestamp": "2026-06-17T14:00:00Z"})
    hist.append({"timestamp": "2026-06-19T14:00:00Z"})
    # Day 20 has incident at Hour 10 to ensure total days = 6
    hist.append({"timestamp": "2026-06-20T10:00:00Z"})
    
    # Recent: 2 incidents at Hour 14
    recent = [
        {"timestamp": "2026-06-21T14:05:00Z"},
        {"timestamp": "2026-06-21T14:15:00Z"}
    ]
    assert check_surge(recent, hist) is True

def test_timezone_offset_alignment():
    # Timezone offset: recent incident is in +05:30 (Hour 14:30 local -> Hour 9 UTC)
    # Historical data is in UTC (Hour 9).
    recent = [{"timestamp": f"2026-06-21T14:{30+i:02d}:00+05:30"} for i in range(8)]
    assert check_surge(recent, mock_history_tier1) is True

def test_historical_empty_hours_counted_as_zero():
    # Historical data spans 5 unique days, but Hour 9 only has incidents on Day 4 (10 incidents).
    # Counts = [0, 0, 0, 10, 0]. Mean = 2.0, Std Dev = 4.4721. Threshold = 10.944.
    hist = [
        {"timestamp": "2026-06-15T10:00:00Z"},
        {"timestamp": "2026-06-16T10:00:00Z"},
        {"timestamp": "2026-06-17T10:00:00Z"},
        # Day 4: 10 incidents in hour 9
        *([{"timestamp": "2026-06-18T09:00:00Z"}] * 10),
        {"timestamp": "2026-06-19T10:00:00Z"}
    ]
    # Case A: 10 incidents (<= 10.944 -> False)
    recent_a = [{"timestamp": f"2026-06-21T09:{i*5:02d}:00Z"} for i in range(10)]
    assert check_surge(recent_a, hist) is False
    
    # Case B: 11 incidents (> 10.944 -> True)
    recent_b = [{"timestamp": f"2026-06-21T09:{i*5:02d}:00Z"} for i in range(11)]
    assert check_surge(recent_b, hist) is True


# ==========================================
# TIER 4: Real-World Application Scenarios
# ==========================================

def test_24_hour_traffic_cycle_simulation():
    # 30 days traffic simulation
    # Night (Hour 2): counts range from 1 to 3. Mean = 2.0, Std Dev = 0.830, Threshold = 3.66
    # Rush Hour (Hour 8): counts range from 18 to 22. Mean = 20.0, Std Dev = 1.286, Threshold = 22.57
    hist = []
    hour2_counts = [1]*10 + [2]*10 + [3]*10
    hour8_counts = [18]*6 + [20]*18 + [22]*6
    for day in range(1, 31):
        date_str = f"2026-05-{day:02d}"
        h2 = hour2_counts[day-1]
        h8 = hour8_counts[day-1]
        for _ in range(h2):
            hist.append({"timestamp": f"{date_str}T02:00:00Z"})
        for _ in range(h8):
            hist.append({"timestamp": f"{date_str}T08:00:00Z"})
            
    # Sub-test A: Night Surge (6 incidents in Hour 2 -> True)
    recent_night = [{"timestamp": f"2026-06-21T02:{i*5:02d}:00Z"} for i in range(6)]
    assert check_surge(recent_night, hist) is True
    
    # Sub-test B: Rush Hour Normal (22 incidents in Hour 8 -> False)
    recent_rush_normal = [{"timestamp": f"2026-06-21T08:{i*2:02d}:00Z"} for i in range(22)]
    assert check_surge(recent_rush_normal, hist) is False
    
    # Sub-test C: Rush Hour Surge (25 incidents in Hour 8 -> True)
    recent_rush_surge = [{"timestamp": f"2026-06-21T08:{i*2:02d}:00Z"} for i in range(25)]
    assert check_surge(recent_rush_surge, hist) is True

def test_adversarial_high_historical_noise():
    # Historical counts: [1, 50, 2, 48, 1, 49]. Highly noisy.
    # Mean = 25.17, Std Dev = 26.12. Threshold = 77.40
    # Volume 60 is below threshold -> False
    hist = []
    counts = [1, 50, 2, 48, 1, 49]
    for idx, count in enumerate(counts):
        date_str = f"2026-06-{15+idx:02d}"
        for _ in range(count):
            hist.append({"timestamp": f"{date_str}T09:00:00Z"})
            
    recent = [{"timestamp": f"2026-06-21T09:{i:02d}:00Z"} for i in range(60)]
    assert check_surge(recent, hist) is False
