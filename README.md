# Flashcard Study

An application that allows for quick creation of flashcards and delegates checking to objective agent tutors.

Paste in raw study text — lecture notes, textbook excerpts, articles — and the system generates structured study cards and quiz questions automatically. A built-in spaced repetition scheduler surfaces the right questions at the right time, and a RAG-powered chat lets you query your own notes like a tutor.

---

## Setup

### Requirements
- Docker path: Docker with Compose, plus an OpenAI API key
- Manual path: Python 3.10+, Node.js 18+, plus an OpenAI API key

### Fastest path with Docker

For users who already have Docker, this is the simplest setup:

```bash
cp .env.example .env
# edit .env and set OPENAI_API_KEY

docker compose up --build
```

Open [http://localhost:8000](http://localhost:8000).

Docker Compose reads configuration from the repo-root `.env`, then runs the built frontend and API in one container. SQLite and ChromaDB data are stored in the named Docker volume `flashcard_study_study-data`. To reset local Docker data, run `docker compose down -v`.

### Manual install

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..

# Frontend
cd frontend && npm install && cd ..
```

Create `backend/.env`:

```env
OPENAI_API_KEY=sk-...
```

### Run manually (production — one process)

```bash
make build      # build the frontend once (or after frontend changes)
make run-prod   # open http://localhost:8000
```

### Run manually (development — hot reload)

```bash
make run        # backend on :8000, frontend dev server on :5173
```

Open [http://localhost:5173](http://localhost:5173) in dev mode.

---

## Concept

Content is organised in layers. Each layer narrows the retrieval scope for AI search (RAG), so answers are always grounded in the relevant slice of your material.

```
Subject
└── Module          ← RAG boundary: search scoped to this module's cards
    └── Note Group  ← RAG boundary: optionally narrowed to this note group
        ├── Study Cards   ← atomic facts, embedded in ChromaDB
        └── Question Cards ← MCQ / multi-answer, FSRS-scheduled
```

**Topic Chips** are reusable concept tags that live at the module level and attach to note groups and individual study cards. They can be renamed or merged, and are used to filter retrieval and review sessions.

---

## Features

### Card Creation
- **Wizard workflow** — paste text, get AI title suggestions, pick topic chips, review generated study cards before committing
- **Auto workflow** — paste text and walk away; study cards and question cards are generated as a background job, with retry support
- **Manual** — create or edit study cards by hand at any time

### Study & Review
- **FSRS spaced repetition** — question cards are scheduled using the Free Spaced Repetition Scheduler algorithm
- **Due / queue / all modes** — review only what's due, preview upcoming cards, or drill everything
- **Stale detection** — editing a study card automatically marks dependent question cards as stale and queues regeneration

### AI Tutor Chat
- Ask questions scoped to a module or a specific note group
- Answers are grounded in your own study cards via vector similarity search
- Response cites which study cards were used

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Python, FastAPI |
| Relational DB | SQLite |
| Vector DB | ChromaDB (on-disk) |
| Embeddings | OpenAI `text-embedding-ada-002` |
| Generation | OpenAI GPT (chat completions) |
| Scheduling | FSRS |

---

## Current State & Limitations

- **OpenAI only.** The backend is currently hardwired to the OpenAI SDK. Swapping providers requires editing `backend/app/openai_client.py` directly.
- **Local only.** There is no auth, multi-user support, or cloud deployment path yet.
- **Manual setup.** Running the app requires setting up a Python venv and Node environment separately (see below).

---

### Schema changes

If you have a database from an older version and see errors, delete `backend/study.db` and `backend/chroma/` then restart. The schema is recreated on startup.

---

## Roadmap

- [ ] **Model-agnostic provider** — abstract the AI client so any OpenAI-compatible endpoint (Anthropic, Gemini, Ollama, etc.) can be configured via env vars without code changes
- [x] **Single executable** — `make build` then `make run-prod` serves both frontend and API from one uvicorn process on port 8000
- [x] Module-level review page with cross-note-group scheduling
- [x] Due-count badge per note group in the sidebar
- [x] Dropdown search for topic chip selection (replaces toggle list for large chip pools)

---