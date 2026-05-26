Run Instructions

Configuration
1) cp .env.local.example .env, then edit .env and set OPENAI_API_KEY, ADMIN_EMAILS, and the local Supabase keys from `make supabase-status`

Local Supabase
1) Start Docker Desktop
2) make supabase-start

Open Supabase Studio at http://127.0.0.1:54323

Backend
1) cd backend
2) python -m venv .venv
3) source .venv/bin/activate
4) pip install -r requirements.txt
5) uvicorn app.main:app --reload --port 8000

Frontend
1) cd frontend
2) npm install
3) npm run dev

Run Both App Servers
1) make run
2) Open http://localhost:5173

Docker App Container
1) make supabase-start
2) docker compose up --build
3) Open http://localhost:8000

Notes
- The repo-root .env is the canonical local configuration file.
- Use .env.local.example for local development and .env.prod.example for deployment values.
- Local app data is stored in the Supabase Docker stack.
- The API base URL defaults to http://localhost:8000. Override with VITE_API_BASE_URL if needed.
- Reset local Supabase data with npx supabase@latest db reset.
