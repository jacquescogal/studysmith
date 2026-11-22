Run Instructions

Guided Setup (recommended)
1) Install uv (brew install uv), Node.js 18+, and Docker Desktop
2) make setup   (or ./setup.sh)
   Creates .env, asks for your OpenAI key and admin email, starts local Supabase,
   copies the Supabase keys into .env, installs backend and frontend dependencies,
   then runs both app servers. Safe to re-run; finished steps are skipped.
   Flags: --yes (accept defaults), --no-run (set up only).

Manual Setup

Configuration
1) cp .env.local.example .env, then edit .env and set OPENAI_API_KEY, ADMIN_EMAILS, and the local Supabase keys from `make supabase-status`

Local Supabase
1) Start Docker Desktop
2) make supabase-start

Open Supabase Studio at http://127.0.0.1:54323

Backend (uses uv; Python 3.12 is pinned in backend/.python-version and installed by uv if missing)
1) cd backend
2) uv sync
3) uv run uvicorn app.main:app --reload --port 8000

Backend tests: make test (or cd backend && uv run pytest). Most route tests need local Supabase running.
Dependencies: uv add <package> (or uv add --dev <package>), then commit pyproject.toml and uv.lock.

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
- Reset local Supabase data with make supabase-reset.
- The Supabase CLI version is pinned by SUPABASE_CLI_VERSION in the Makefile (setup.sh uses the same value).
