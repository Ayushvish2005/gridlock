# AI Traffic Operations Platform MVP

AI-Assisted Traffic Command Center for Planned and Unplanned Event Management.
Built for the Hackathon.

## Features
- **Deterministic Traffic Impact Assessment:** Fast, rule-based engine mapping event features to impact scores and severity.
- **Incident Prioritization Engine:** Ranks incidents (P1 to P4).
- **Recommendation Engine:** Rule-based generation of operational tasks (deploy officers, barricades, diversions).
- **AI Explanation Service:** Uses OpenRouter LLMs to generate human-readable operational context.
- **Next.js Traffic Command Center Dashboard:** Dark-mode dashboard visualizing metrics, incidents via an interactive map (Leaflet), and a scenario simulator.

## Tech Stack
- **Frontend:** Next.js 15, React, TailwindCSS, Recharts, React Leaflet.
- **Backend:** Python 3.12, FastAPI, SQLAlchemy, scikit-learn (for future/optional ML).
- **Database:** PostgreSQL.
- **AI Integration:** OpenRouter (`openai/gpt-4o-mini`).

---

## Local Setup & Development

### 1. Database
We provide a `docker-compose.yml` for quick local development.
```bash
docker-compose up -d
```
*This starts a PostgreSQL instance on port 5432 with db `traffic_ops`, user `postgres`, password `password`.*

### 2. Backend (FastAPI)
Navigate to the `backend` directory:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Set up your `.env` file in the `backend/` directory (optional but needed for AI explanations):
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/traffic_ops
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

Run the backend server:
```bash
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend (Next.js)
Navigate to the `frontend` directory:
```bash
cd frontend
npm install
npm run dev &
```
The dashboard will be available at `http://localhost:3000`.

---

## Machine Learning Models (Optional MVP Enhancement)

While the MVP strictly uses the deterministic rule-based engine (as per specs), we have included a robust training script (`scripts/train_model.py`) that learns the exact business logic from your historical Astram CSV dataset using Random Forest Classifiers.

To train the models:
```bash
python scripts/train_model.py --data path/to/your/astram_events.csv --out models/
```

If the `models/` directory contains the generated `.pkl` files, the FastAPI application will attempt to load them on startup, proving the architecture is "ML Ready" for future congestion forecasting upgrades (CatBoost/LightGBM). If the models are not found, the backend safely falls back to the deterministic rule engine.

---

## Deployment Guidelines

### Database (Neon PostgreSQL Free Tier)
1. Create a project on [Neon.tech](https://neon.tech).
2. Copy the connection string provided.
3. Add it as the `DATABASE_URL` environment variable on your backend hosting provider.

### Backend (Render Free Tier / Railway)
1. Connect your GitHub repository to Render/Railway.
2. Root directory: `backend`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add `DATABASE_URL` and `OPENROUTER_API_KEY` to the Environment Variables.

### Frontend (Vercel Free Tier)
1. Import your GitHub repository into Vercel.
2. Set the Root Directory to `frontend`.
3. Vercel will automatically detect Next.js and apply the correct build settings (`npm run build`).
4. Add any required environment variables (e.g., `NEXT_PUBLIC_API_URL` if you change the backend hosting URL from localhost).

---
*Built for the Hackathon MVP.*
