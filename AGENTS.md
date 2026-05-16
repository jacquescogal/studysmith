# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: FastAPI app, SQLAlchemy models, ChromaDB embeddings, and OpenAI integrations.
  - `backend/app/`: application code (API routes, models, jobs, OpenAI helpers).
  - `backend/tests/`: pytest tests for backend behavior.
  - `backend/.env`: local configuration (not committed). See `backend/.env.example`.
- `frontend/`: React + Vite UI.
  - `frontend/src/`: React components, API client, and styles.
  - `frontend/index.html`: base HTML + fonts.
- `project-lexicon.md`: canonical terminology and semantic source of truth.
- `SETUP.md`: local run instructions.

## Project Instructions
- Treat `project-lexicon.md` as the canonical semantic source for domain terminology, naming, workflow states, and architectural language.
- Before introducing new terminology:
  1. Check `project-lexicon.md`.
  2. Reuse existing terms.
  3. Do not invent synonyms for defined concepts.
- When generating class names, DTOs, Kafka topic names, event names, documentation, APIs, comments, or diagrams, always align terminology with `project-lexicon.md`.

## Build, Test, and Development Commands
Repo root:
- `make run` to run backend on `http://localhost:8000` and frontend on `http://localhost:5173`.
- `make build` to build the frontend for production.
- `make run-prod` to serve the built frontend and API from one backend process on `http://localhost:8000`.
- `docker compose up --build` to run the Docker setup using repo-root `.env`.

Backend (from `backend/`):
- `python -m venv .venv` and `source .venv/bin/activate` to create/activate a venv.
- `pip install -r requirements.txt` to install dependencies.
- `uvicorn app.main:app --reload --port 8000` to run the API.
- `python -m pytest tests` to run backend tests, if `pytest` is installed in the active environment.

Frontend (from `frontend/`):
- `npm install` to install dependencies.
- `npm run dev` to run the UI on `http://localhost:5173`.
- `npm run build` to create a production build.

## Coding Style & Naming Conventions
- Python: 4-space indentation, `snake_case` for functions and files.
- React/JS: 2-space indentation, `camelCase` for variables, `PascalCase` for components.
- Keep API responses JSON-serializable; avoid non-ASCII unless required.

## Testing Guidelines
- Backend pytest tests exist under `backend/tests/`.
- No frontend test framework is currently configured.
- If you add frontend tests, place them alongside their feature (for example, `frontend/src/__tests__/`) and document the new command.

## Commit & Pull Request Guidelines
- Use clear, scoped commit messages (for example, `feat: add note-group wizard`).
- PRs should include a concise summary, manual test steps, and screenshots for UI changes.

## Security & Configuration Tips
- Set `OPENAI_API_KEY` in repo-root `.env` for Docker, or in `backend/.env` for manual backend runs.
- If you change the schema, delete `backend/study.db` and `backend/chroma` before restarting.
