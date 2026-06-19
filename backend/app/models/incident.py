from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, Enum
from sqlalchemy.sql import func
from app.database.config import Base
import enum

class IncidentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)

    # Core Data
    event_type = Column(String, index=True)
    event_cause = Column(String, index=True)
    priority = Column(String)
    zone = Column(String, index=True)
    junction = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    requires_road_closure = Column(Boolean, default=False)
    expected_attendance = Column(Integer, nullable=True)
    start_datetime = Column(DateTime(timezone=True))
    end_datetime = Column(DateTime(timezone=True), nullable=True)
    description = Column(Text, nullable=True)
    corridor = Column(String, nullable=True)
    police_station = Column(String, nullable=True)

    # Assessed Metrics
    impact_score = Column(Integer, nullable=True)
    severity = Column(String, nullable=True)
    estimated_delay = Column(Integer, nullable=True) # minutes
    impact_radius = Column(Integer, nullable=True) # meters
    priority_rank = Column(String, nullable=True)

    # Recommendations
    officers_required = Column(Integer, default=0)
    barricades_required = Column(Integer, default=0)
    diversion_required = Column(Boolean, default=False)
    parking_management_required = Column(Boolean, default=False)
    emergency_access_corridor = Column(Boolean, default=False)
    tow_vehicle_required = Column(Boolean, default=False)
    crowd_control_team = Column(Boolean, default=False)

    # Meta
    ai_explanation = Column(Text, nullable=True)
    status = Column(Enum(IncidentStatus), default=IncidentStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_datetime = Column(DateTime(timezone=True), nullable=True)
