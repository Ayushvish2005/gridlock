from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database.config import engine, Base
from app.routers import incidents

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
    allow_origins=["*"], # For MVP, allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(incidents.router)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "AI Traffic Operations Platform API is running"}
