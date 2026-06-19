from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class IncidentCreate(BaseModel):
    event_type: str = Field(..., description="e.g., planned, unplanned")
    event_cause: str = Field(..., description="e.g., concert, accident, protest")
    priority: str = Field(default="Low")
    zone: str = Field(default="unknown")
    junction: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    requires_road_closure: bool = False
    expected_attendance: Optional[int] = None
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    description: Optional[str] = None
    corridor: Optional[str] = None
    police_station: Optional[str] = None

class PredictRequest(IncidentCreate):
    pass

class PredictResponse(BaseModel):
    impact_score: Optional[int] = None
    severity: Optional[str] = None
    estimated_delay: Optional[int] = None
    impact_radius: Optional[int] = None
    priority_rank: Optional[str] = None
    recommendations: Optional[dict] = {}
    ai_explanation: Optional[str] = None
    similar_events: Optional[List[dict]] = []
    peak_congestion_window: Optional[str] = None
    affected_junctions: Optional[int] = None
    impact_breakdown: Optional[dict] = {}

class IncidentResponse(PredictResponse, IncidentCreate):
    id: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
