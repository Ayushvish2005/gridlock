from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from app.database.config import SessionLocal
from app.models.incident import Incident
import random
from contextlib import asynccontextmanager

from app.database.config import engine, Base
from app.routers import incidents
from app.routers import analytics
from dotenv import load_dotenv
import os
import threading
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from seed_db import seed_data

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting AI Traffic Operations Platform Backend...")
    # Create tables on startup to avoid import-time database connection errors
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables created/verified.")
    except Exception as e:
        print(f"Warning: Could not connect to database on startup: {e}")
    yield
    print("Shutting down...")

app = FastAPI(
    title="AI Traffic Operations Platform",
    description="API for the AI-Assisted Traffic Command Center",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False, # Must be False if allow_origins is ["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(incidents.router)
app.include_router(analytics.router)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "AI Traffic Operations Platform API is running"}

@app.get("/seed")
def seed_database():
    try:
        # Run in a separate thread so it doesn't block the async loop
        thread = threading.Thread(target=seed_data)
        thread.start()
        return {"message": "Seeding started in the background. It may take a minute to complete."}
    except Exception as e:
        return {"error": str(e)}

@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket client connected to live stream.")
    try:
        while True:
            # Simulate high-performance telemetry by aggressively pushing events
            await asyncio.sleep(random.uniform(15, 30))
            db = SessionLocal()
            try:
                # Get a random historic incident to simulate real-time telemetry
                count = db.query(Incident).count()
                if count > 0:
                    random_idx = random.randint(0, count - 1)
                    incident = db.query(Incident).offset(random_idx).first()
                    
                    data = {
                        "id": incident.id,
                        "event_type": incident.event_type,
                        "severity": incident.severity,
                        "zone": incident.zone,
                        "latitude": incident.latitude,
                        "longitude": incident.longitude,
                        "timestamp": incident.start_datetime.isoformat() if incident.start_datetime else None,
                        "message": f"🔴 LIVE ALERT: New {incident.severity.upper()} {incident.event_type} detected in {incident.zone}!"
                    }
                    await websocket.send_json(data)
            finally:
                db.close()
    except WebSocketDisconnect:
        print("WebSocket client disconnected.")
    except Exception as e:
        print(f"WebSocket error: {e}")
