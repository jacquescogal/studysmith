Run Instructions

Docker
1) cp .env.example .env, then edit .env and set OPENAI_API_KEY
2) docker compose up --build

Open http://localhost:8000

Backend
1) cd backend
2) python -m venv .venv
3) source .venv/bin/activate
4) pip install -r requirements.txt
5) Edit backend/.env and set OPENAI_API_KEY
6) uvicorn app.main:app --reload --port 8000

Frontend
1) cd frontend
2) npm install
3) npm run dev

Notes
- The API base URL defaults to http://localhost:8000. Override with VITE_API_BASE_URL if needed.
- SQLite DB file and ChromaDB embeddings are stored under backend/.
- Docker stores SQLite and ChromaDB data in the study-data named volume. Reset it with docker compose down -v.
- If you ran earlier versions, delete backend/study.db and backend/chroma to pick up the new schema.
