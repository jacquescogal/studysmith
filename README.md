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
  source validation, title suggestions, topic assignment, study card generation,
  question card generation, embedding, and background job recovery.
- **Grounded retrieval design**: Tutor Chat retrieves from study cards within a
  module-level RAG Boundary, can narrow to a note group or topics, and returns
  study card references used in the answer.
- **Learning-aware data model**: Subjects, modules, note groups, study cards,
  question cards, topics, source ranges, short codes, and jobs are modeled as
  explicit domain concepts instead of being folded into generic blobs.
- **Spaced repetition built in**: question cards store FSRS scheduling state,
  support due/review-next/review-all modes, and become stale when supporting
  study cards change.
- **Source provenance**: generated study cards can link back to evidence ranges
  in cleaned text, which supports a reading view aligned with the generated
  cards.
- **Production-shaped local app**: FastAPI serves the API and, after build, the
  Vite frontend from one process; Docker Compose provides a repeatable local
  runtime with persisted SQLite and ChromaDB data.

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
3. Let the background Auto Workflow generate cleaned text, topics, study cards,
   formatted sections, and question cards.
4. Review question cards by due date, queue order, or full drill mode.
5. Ask Tutor Chat questions against the selected module, note group, or topics.

## Core Features

### AI-Assisted Study Material Ingestion

- Duplicate-aware note group creation through unique IDs.
- Optional additional generation instructions at module or note group scope.
- Cleaned Text generation that preserves source meaning while normalizing
  formatting.
- Formatted Sections that map readable source sections to specific study cards.
- Topic assignment using a module-owned reusable topic pool.
- Retry, cancel, resume, and status tracking for background generation jobs.

### Study Cards And Provenance

- Study cards are atomic knowledge units and the retrieval source of truth.
- Cards can be created or edited manually after generation.
- Source ranges connect generated study cards back to evidence spans in cleaned
  text.
- Editing a study card marks dependent question cards as stale.
- Study cards are embedded in ChromaDB for similarity search.

### Question Cards And Review

- MCQ and multi-answer question cards with option explanations.
- Question cards reference the study cards that support their answers.
- FSRS scheduling fields are persisted per card.
- Review modes support due cards, upcoming queue cards, and all cards.
- Module, note group, and topic review scopes share the same scheduling model.
- Timelines summarize due, week, month, six-month, and long-term review load.

### Tutor Chat

- Retrieval-grounded answers from study card context.
- Module-level default RAG Boundary with optional note group narrowing.
- Topic filtering for focused explanations.
- Conversation history support.
- Responses return the study card references used to answer.

### Navigation And UI

- React + Vite single-page app with subject, module, note group, and topic
  routes.
- Stable short-code routes for user-facing navigation.
- Module overview with note group stats, due counts, stale counts, and review
  timeline.
- Topic pages for cross-note-group study and review.
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
SQLite domain database
       |
       +--> ChromaDB vector collection
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
- `backend/app/chroma.py`: persistent ChromaDB collection setup.
- `backend/app/fsrs_utils.py`: FSRS initialization and review transitions.
- `backend/app/source_ranges.py`: source evidence matching for generated cards.
- `backend/app/short_codes.py`: compact URL-safe route aliases.

### Frontend

- `frontend/src/App.jsx`: application state, route restoration, and workflow
  coordination.
- `frontend/src/api.js`: typed API client functions for backend routes.
- `frontend/src/features/*`: feature views for subjects, modules, note groups,
  study cards, question cards, review, reading, topics, and Tutor Chat.
- `frontend/src/components/*`: shared layout, dialog, feedback, and UI
  primitives.

## API Surface

The FastAPI app exposes routes for:

- Subjects, modules, note groups, topics, study cards, and question cards.
- Intent Chat for subject and module setup.
- Auto Workflow job creation, retry, cancel, and status polling.
- Module, note group, and topic overviews.
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
| Relational storage | SQLite |
| Vector storage | ChromaDB |
| AI generation | OpenAI Responses API |
| Embeddings | OpenAI `text-embedding-3-small` by default |
| Spaced repetition | FSRS |
| Local runtime | Docker Compose or Makefile-driven development |

Default model settings are configured in `backend/app/config.py` and can be
overridden with environment variables:

```env
OPENAI_WEAK_MODEL=gpt-5.4-mini
OPENAI_STRONG_MODEL=gpt-5.4
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

## Getting Started

### Requirements

- Docker with Compose, or Python 3.10+ and Node.js 18+
- An OpenAI API key

### Fastest Path With Docker

```bash
cp .env.example .env
# edit .env and set OPENAI_API_KEY

docker compose up --build
```

Open `http://localhost:8000`.

Docker Compose reads configuration from the repo-root `.env`, builds the
frontend, serves the API and frontend from one container, and stores SQLite plus
ChromaDB data in the named Docker volume `studysmith_study-data`.

Reset Docker data with:

```bash
docker compose down -v
```

### Manual Development

Install backend dependencies:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

Create `backend/.env`:

```env
OPENAI_API_KEY=sk-...
```

Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

Run both dev servers:

```bash
make run
```

Open `http://localhost:5173` for the Vite frontend. The backend runs on
`http://localhost:8000`.

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
module overview aggregation, topic-scoped review behavior, short-code routes,
OpenAI model routing, unique ID creation behavior, and source range matching.

There is not currently a frontend test runner configured.

## Data And Reset Notes

Manual local data lives under `backend/`:

- `backend/study.db`: SQLite database
- `backend/chroma/`: ChromaDB persistence

Docker local data lives in the `studysmith_study-data` named volume.

If schema changes produce local startup errors, delete `backend/study.db` and
`backend/chroma/`, then restart the app. For Docker, run
`docker compose down -v` and rebuild.

## Current Boundaries

- The app is designed for local single-user study workflows. It does not include
  authentication, authorization, or multi-user tenancy.
- The AI integration is OpenAI-first. Model names are configurable, but replacing
  the provider requires changing `backend/app/openai_client.py`.
- SQLite and ChromaDB are intentionally simple local storage choices, not a
  hosted production deployment strategy.
- Frontend tests have not been added yet.

## Roadmap

- [ ] Provider abstraction for OpenAI-compatible and local model backends.
- [ ] Frontend test coverage for core creation, review, and chat flows.
- [ ] Import/export support for portable study archives.
- [ ] Richer analytics on review history, mastery, and stale card resolution.
- [x] Single-process production-style local run.
- [x] Module-level review and timeline views.
- [x] Topic-scoped study and review pages.
- [x] Short-code app routes.
