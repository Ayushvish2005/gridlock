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
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    description: Optional[str] = None
    corridor: Optional[str] = None
    police_station: Optional[str] = None

class PredictRequest(IncidentCreate):
    pass

class PredictResponse(BaseModel):
    impact_score: int
    severity: str
    estimated_delay: int
    impact_radius: int
    priority_rank: str
    recommendations: dict
    ai_explanation: Optional[str] = None

class IncidentResponse(PredictResponse, IncidentCreate):
    id: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
