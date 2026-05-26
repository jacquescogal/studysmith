# StudySmith

StudySmith is a local-first learning workspace that turns raw study material
into structured study cards, scheduled question cards, and retrieval-grounded
Tutor Chat.

Paste lecture notes, textbook excerpts, articles, or exam material into a note
group. The app cleans the source text, derives atomic study cards, generates
assessment questions, embeds the cards for retrieval, and schedules review with
FSRS. The result is a study system that keeps generation, provenance, review,
  and chat tied to the same source-of-truth knowledge objects.

## Why This Project Is Interesting

- **End-to-end AI workflow orchestration**: a single Auto Workflow handles
  source validation, title suggestions, Concept assignment, study card generation,
  question card generation, embedding, and background job recovery.
- **Grounded retrieval design**: Tutor Chat retrieves from study cards within a
  module-level RAG Boundary, can narrow to a note group or Concepts, and returns
  study card references used in the answer.
- **Learning-aware data model**: Subjects, modules, note groups, study cards,
  question cards, Concepts, source ranges, short codes, and jobs are modeled as
  explicit domain concepts instead of being folded into generic blobs.
- **Spaced repetition built in**: question cards store FSRS scheduling state,
  support due/review-next/review-all modes, and become stale when supporting
  study cards change.
- **Source provenance**: generated study cards can link back to evidence ranges
  in cleaned text, which supports a reading view aligned with the generated
  cards.
- **Production-shaped local app**: FastAPI serves the API and, after build, the
  Vite frontend from one process; Supabase local development provides Postgres,
  Auth, and pgvector through Docker.

## Product Flow

```text
Subject
`-- Module                         default RAG Boundary and review scope
    `-- Note Group                  one source chunk or study session
        |-- Cleaned Text            markdown-preserved source material
        |-- Formatted Sections      reading view mapped to study cards
        |-- Study Cards             atomic retrieval source of truth
        `-- Question Cards          FSRS-scheduled assessment artifacts
```

1. Create a subject and module, optionally using Intent Chat to shape the title,
   goal, and scope.
2. Create a note group from raw text and a unique ID.
3. Let the background Auto Workflow generate cleaned text, Concepts, study cards,
   formatted sections, and question cards.
4. Review question cards by due date, queue order, or full drill mode.
5. Ask Tutor Chat questions against the selected module, note group, or Concepts.

## Core Features

### AI-Assisted Study Material Ingestion

- Duplicate-aware note group creation through unique IDs.
- Optional additional generation instructions at module or note group scope.
- Cleaned Text generation that preserves source meaning while normalizing
  formatting.
- Formatted Sections that map readable source sections to specific study cards.
- Concept assignment using a module-owned reusable Concept pool.
- Retry, cancel, resume, and status tracking for background generation jobs.

### Study Cards And Provenance

- Study cards are atomic knowledge units and the retrieval source of truth.
- Cards can be created or edited manually after generation.
- Source ranges connect generated study cards back to evidence spans in cleaned
  text.
- Editing a study card marks dependent question cards as stale.
- Study cards are embedded in pgvector for similarity search.

### Question Cards And Review

- MCQ and multi-answer question cards with option explanations.
- Question cards reference the study cards that support their answers.
- FSRS scheduling fields are persisted per card.
- Review modes support due cards, upcoming queue cards, and all cards.
- Module, note group, and Concept review scopes share the same scheduling model.
- Timelines summarize due, week, month, six-month, and long-term review load.

### Tutor Chat

- Retrieval-grounded answers from study card context.
- Module-level default RAG Boundary with optional note group narrowing.
- Concept filtering for focused explanations.
- Conversation history support.
- Responses return the study card references used to answer.

### Navigation And UI

- React + Vite single-page app with subject, module, note group, and Concept
  routes.
- Stable short-code routes for user-facing navigation.
- Module overview with note group stats, due counts, stale counts, and review
  timeline.
- Concept pages for cross-note-group study and review.
- Reading dialog aligned to generated study cards.

## Architecture

```text
React + Vite SPA
       |
       | REST JSON
       v
FastAPI application
       |
       | SQLAlchemy ORM
       v
Supabase Postgres domain database
       |
       +--> Postgres pgvector embeddings
       |
       +--> OpenAI Responses API and embeddings
       |
       +--> Background auto-generation worker
```

### Backend

- `backend/app/main.py`: FastAPI routes, review queries, route resolution, and
  static frontend serving.
- `backend/app/models.py`: SQLAlchemy domain models and relationships.
- `backend/app/schemas.py`: Pydantic request/response contracts.
- `backend/app/jobs.py`: Auto Workflow and question generation job execution.
- `backend/app/openai_client.py`: OpenAI prompt orchestration, JSON response
  parsing, generation, chat, and embeddings.
- `backend/app/vector_store.py`: pgvector-backed embedding persistence and similarity search.
- `backend/app/fsrs_utils.py`: FSRS initialization and review transitions.
- `backend/app/source_ranges.py`: source evidence matching for generated cards.
- `backend/app/short_codes.py`: compact URL-safe route aliases.

### Frontend

- `frontend/src/App.jsx`: application state, route restoration, and workflow
  coordination.
- `frontend/src/api.js`: typed API client functions for backend routes.
- `frontend/src/features/*`: feature views for subjects, modules, note groups,
  study cards, question cards, review, reading, Concepts, and Tutor Chat.
- `frontend/src/components/*`: shared layout, dialog, feedback, and UI
  primitives.

## API Surface

The FastAPI app exposes routes for:

- Subjects, modules, note groups, Concepts, study cards, and question cards.
- Intent Chat for subject and module setup.
- Auto Workflow job creation, retry, cancel, and status polling.
- Module, note group, and Concept overviews.
- Review queues and question timelines.
- Stable app route resolution through short codes.
- Tutor Chat over retrieved study card context.

OpenAPI docs are available from a running backend at
`http://localhost:8000/docs`.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, React Router, shadcn-style UI primitives, Tailwind CSS |
| Backend | Python, FastAPI, SQLAlchemy, Pydantic |
| Relational storage | Supabase Postgres |
| Vector storage | pgvector |
| AI generation | OpenAI Responses API |
| Embeddings | OpenAI `text-embedding-3-small` by default |
| Spaced repetition | FSRS |
| Local runtime | Supabase local stack plus Makefile-driven development |

Default model settings are configured in `backend/app/config.py` and can be
overridden with environment variables:

```env
OPENAI_WEAK_MODEL=gpt-5.4-mini
OPENAI_STRONG_MODEL=gpt-5.4
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

## Getting Started

### Requirements

- Docker Desktop, Python 3.10+, and Node.js 18+
- An OpenAI API key

### Local Environment Files

Environment variable names are mostly the same in local and production, but the
values are different.

| File | Purpose |
| --- | --- |
| `.env.local.example` | Template for local development with the Supabase Docker stack |
| `.env.prod.example` | Checklist for Render and the remote Supabase project |
| `.env` | Your ignored local config, read by both backend and frontend dev servers |

Create your local config first:

```bash
cp .env.local.example .env
```

Then edit `.env` and set:

- `OPENAI_API_KEY`
- `ADMIN_EMAILS`
- the local Supabase publishable and secret keys from `make supabase-status`

### Local Supabase

Local Supabase is a Docker stack managed by the Supabase CLI. It provides:

- Postgres database
- Supabase Auth
- Mailpit inbox for local magic-link emails
- Supabase Studio

Start it after Docker Desktop is running:

```bash
make supabase-start
```

Print the local URLs and keys:

```bash
make supabase-status
```

Use that output to fill these `.env` values:

```env
SUPABASE_SECRET_KEY=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Local magic-link emails are captured in Mailpit, not sent to a real inbox:

```text
http://127.0.0.1:54324
```

Open Supabase Studio at:

```text
http://127.0.0.1:54323
```

Reset local Supabase data with:

```bash
npx supabase@latest db reset
```

### Local App Servers

`make run` does not start Supabase. It starts only the application servers:

- FastAPI backend on `http://localhost:8000`
- Vite frontend on `http://localhost:5173`

Run this after `make supabase-start`:

```bash
make run
```

Open:

```text
http://localhost:5173
```

The local development shape is:

```text
Browser -> Vite frontend :5173
Browser -> local Supabase Auth :54321
FastAPI backend :8000 -> local Supabase Postgres :54322
```

### Local Command Summary

| Command | What it does |
| --- | --- |
| `make supabase-start` | Starts the local Supabase Docker stack |
| `make supabase-status` | Prints local Supabase URLs, database URL, publishable key, and secret key |
| `make supabase-stop` | Stops the local Supabase Docker stack |
| `make run` | Starts the local FastAPI and Vite app servers |
| `make stop` | Stops app servers listening on ports `8000` and `5173` |

### Manual Dependency Setup

Install backend dependencies:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

### Docker App Container

```bash
make supabase-start
docker compose up --build
```

Open `http://localhost:8000`. The container connects to the local Supabase
database through `host.docker.internal` unless `DOCKER_DATABASE_URL` is set.

### Production-Style Local Run

```bash
make build
make run-prod
```

Open `http://localhost:8000`. The backend serves the built frontend and API from
one uvicorn process.

## Testing

Run backend tests from `backend/`:

```bash
python -m pytest tests
```

The current test suite covers route exposure, note group creation constraints,
module overview aggregation, Concept-scoped review behavior, short-code routes,
OpenAI model routing, unique ID creation behavior, and source range matching.

Run frontend tests from `frontend/`:

```bash
npm test -- --run
```

## Data And Reset Notes

Local app data lives in the Supabase Docker stack. Reset it with:

```bash
npx supabase@latest db reset
```

## Current Boundaries

- The app uses Supabase Auth plus FastAPI authorization. The frontend does not
  query app tables directly.
- The AI integration is OpenAI-first. Model names are configurable, but replacing
  the provider requires changing `backend/app/openai_client.py`.
- Supabase migrations are the source of truth for Postgres schema changes.

## Roadmap

- [ ] Provider abstraction for OpenAI-compatible and local model backends.
- [ ] Frontend test coverage for core creation, review, and chat flows.
- [ ] Import/export support for portable study archives.
- [ ] Richer analytics on review history, mastery, and stale card resolution.
- [x] Single-process production-style local run.
- [x] Module-level review and timeline views.
- [x] Concept-scoped study and review pages.
- [x] Short-code app routes.
