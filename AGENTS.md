# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: FastAPI app, SQLAlchemy models, ChromaDB embeddings, and OpenAI integrations.
  - `backend/app/`: application code (API routes, models, jobs, OpenAI helpers).
  - `backend/.env`: local configuration (not committed). See `backend/.env.example`.
- `frontend/`: React + Vite UI.
  - `frontend/src/`: React components, API client, and styles.
  - `frontend/index.html`: base HTML + fonts.
- `SETUP.md`: local run instructions.

## Build, Test, and Development Commands
Backend (from `backend/`):
- `python -m venv .venv` and `source .venv/bin/activate` to create/activate a venv.
- `pip install -r requirements.txt` to install dependencies.
- `uvicorn app.main:app --reload --port 8000` to run the API.

Frontend (from `frontend/`):
- `npm install` to install dependencies.
- `npm run dev` to run the UI on `http://localhost:5173`.
- `npm run build` to create a production build.

## Coding Style & Naming Conventions
- Python: 4-space indentation, `snake_case` for functions and files.
- React/JS: 2-space indentation, `camelCase` for variables, `PascalCase` for components.
- Keep API responses JSON-serializable; avoid non-ASCII unless required.

## Testing Guidelines
- No test framework is set up yet.
- If you add tests, place them alongside their feature (e.g., `backend/tests/`, `frontend/src/__tests__/`).

## Commit & Pull Request Guidelines
- This repository is not a git repo yet, so no commit conventions are established.
- If you initialize git, prefer clear, scoped messages (e.g., `feat: add note-group wizard`).
- PRs should include a concise summary, manual test steps, and screenshots for UI changes.

## Security & Configuration Tips
- Set `OPENAI_API_KEY` in `backend/.env`.
- If you change the schema, delete `backend/study.db` and `backend/chroma` before restarting.
