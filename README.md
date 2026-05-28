# StudySmith

StudySmith is an AI-assisted learning workspace that turns raw study material
into structured Study Cards, source-grounded Question Cards, review schedules,
Concept maps, and Tutor Chat.

The product goal is simple: paste serious source material once, then study,
review, inspect provenance, and ask questions from the same knowledge objects.

## What It Does

- Cleans raw notes into readable source-preserving markdown.
- Generates atomic Study Cards and linked Question Cards.
- Schedules review with FSRS.
- Embeds Study Cards in pgvector for semantic retrieval.
- Builds module and Concept mind maps from generated knowledge.
- Lets users inspect the source text behind generated cards.
- Answers Tutor Chat questions using retrieved Study Card context.
- Supports public read-only study pages and authenticated creator workflows.

## Product Shape

```text
Subject
`-- Module                         review and retrieval boundary
    `-- Note Group                  one source chunk or study session
        |-- Cleaned Text            preserved source material
        |-- Formatted Sections      source reading view aligned to Study Cards
        |-- Study Cards             retrieval source of truth
        `-- Question Cards          FSRS-scheduled assessment artifacts
```

## Why This Project Is Interesting

StudySmith is not a thin wrapper around a chat box. It has a domain model, a
background generation workflow, provenance tracking, spaced repetition, and a
retrieval layer that all point back to the same Study Card objects.

The engineering work is mostly in the coordination:

- keeping generated artifacts inspectable and editable;
- avoiding vague "AI output" blobs by modeling Subjects, Modules, Note Groups,
  Concepts, Study Cards, Question Cards, source ranges, review state, and jobs;
- handling long-running AI generation as resumable background workflow stages;
- making Tutor Chat retrieval scoped to a Module, Note Group, or Concept;
- preserving public read access while keeping creator actions authenticated.

## Screenshots To Add

<example image: StudySmith module page showing Note Groups, Mind Map, Review dock, and Tutor Chat entry point>

<example image: Auto Workflow status showing cleaned source text, generated Study Cards, and generated Question Cards>

<example image: Source Text modal with a pinned Study Card and highlighted source ranges>

<example image: Concept Mind Map showing Concept nodes, Knowledge Nodes, and descendant Study Card counts>

<example image: Review session showing a Question Card, answer feedback, and linked Study Card context>

### Tool-Use Demo Screenshots

<example image: search tool use showing an exact keyword lookup returning matching source sections and Study Cards>

<example image: semantic_search tool use showing vector retrieval of related Study Cards with source-backed references>

<example image: crawl tool use showing external/source material ingestion before it becomes a Note Group>

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
Supabase Postgres
       |
       +-- pgvector Study Card embeddings
       +-- Supabase Auth
       +-- OpenAI generation, chat, and embeddings
       +-- Background Auto Workflow worker
```

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, React Router, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Database | Supabase Postgres |
| Vector search | pgvector |
| AI | OpenAI Responses API and embeddings |
| Review scheduling | FSRS |
| Deployment | Docker image served as one Render Web Service |

## Key Workflows

### Auto Workflow

1. User creates a Note Group from raw text.
2. The backend checks source uniqueness and starts a background job.
3. OpenAI cleans the text, proposes Concepts, generates Study Cards, and creates
   Question Cards.
4. Study Cards are embedded into pgvector.
5. The UI polls workflow state and renders generated material as it becomes
   available.

<example sequence diagram: PlantUML diagram for Note Group Auto Workflow>

```plantuml
@startuml
title StudySmith - Note Group Auto Workflow

actor User
participant "React App" as UI
participant "FastAPI API" as API
participant "Auto Workflow Worker" as Worker
database "Supabase Postgres" as DB
participant "OpenAI Responses API" as OpenAI
database "pgvector" as Vector

User -> UI: Paste raw text + Unique ID
UI -> API: POST /modules/{module_id}/note-groups/auto
API -> DB: Check Unique ID and create Note Group
API -> DB: Create Job and workflow stages
API --> UI: Job accepted

loop Poll workflow
  UI -> API: GET /modules/{module_id}/generation-workflow
  API -> DB: Read stage status
  API --> UI: Workflow snapshot
end

Worker -> DB: Load pending Job and Note Group
Worker -> OpenAI: Clean source text
OpenAI --> Worker: Cleaned Text
Worker -> DB: Save Cleaned Text

Worker -> OpenAI: Suggest title and Concepts
OpenAI --> Worker: Title + Concept candidates
Worker -> DB: Upsert Concepts

Worker -> OpenAI: Generate Study Cards
OpenAI --> Worker: Study Card payloads
Worker -> DB: Save Study Cards and source ranges
Worker -> OpenAI: Embed Study Cards
OpenAI --> Worker: Embedding vectors
Worker -> Vector: Upsert embeddings

Worker -> OpenAI: Generate Question Cards
OpenAI --> Worker: Question Card payloads
Worker -> DB: Save Question Cards and FSRS defaults
Worker -> DB: Mark Job completed
UI -> API: Refresh Module / Note Group data
API --> UI: Generated study experience

@enduml
```

### Tutor Chat And Retrieval

Tutor Chat answers from Study Cards, not directly from a free-form prompt. The
retrieval boundary defaults to the Module and can narrow to a Note Group or
Concept.

<example sequence diagram: PlantUML diagram for Tutor Chat retrieval flow>

```plantuml
@startuml
title StudySmith - Tutor Chat Retrieval Flow

actor User
participant "React App" as UI
participant "FastAPI API" as API
database "Supabase Postgres" as DB
participant "OpenAI Embeddings" as Embed
database "pgvector" as Vector
participant "OpenAI Chat" as Chat

User -> UI: Ask a question in Tutor Chat
UI -> API: POST /chat
API -> DB: Resolve Module / Note Group / Concept scope
API -> Embed: Embed user question
Embed --> API: Query vector
API -> Vector: semantic_search within scope
Vector --> API: Ranked Study Cards
API -> DB: Load Study Card details and references
API -> Chat: Answer using retrieved context only
Chat --> API: Grounded answer + referenced Study Card IDs
API --> UI: Answer with Study Card references
UI --> User: Show response and linked context

@enduml
```

### Search, Semantic Search, And Crawl Tool Flow

This diagram is for the portfolio demo screenshots above. It frames the expected
tool-use story: exact search finds known terms, semantic search finds related
knowledge, and crawl/import turns external material into a Note Group that can
join the same workflow.

<example sequence diagram: PlantUML diagram for search, semantic_search, and crawl tool flow>

```plantuml
@startuml
title StudySmith - Tool Use Demo Flow

actor User
participant "React App" as UI
participant "FastAPI API" as API
participant "Tool Router" as Tools
database "Supabase Postgres" as DB
database "pgvector" as Vector
participant "Crawler / Importer" as Crawl
participant "OpenAI" as OpenAI

User -> UI: Ask for an explanation or source-backed answer
UI -> API: Submit query with selected scope
API -> Tools: Decide retrieval tools

alt Exact source lookup
  Tools -> DB: search(keyword, scope)
  DB --> Tools: Matching source sections and cards
else Conceptual retrieval
  Tools -> OpenAI: Embed query
  OpenAI --> Tools: Query vector
  Tools -> Vector: semantic_search(vector, scope)
  Vector --> Tools: Related Study Cards
else New source import
  Tools -> Crawl: crawl(url or document)
  Crawl --> Tools: Extracted source text
  Tools -> DB: Create Note Group candidate
end

Tools --> API: Retrieved evidence and candidate context
API -> OpenAI: Synthesize answer with citations/references
OpenAI --> API: Grounded response
API --> UI: Answer + referenced Study Cards / source sections
UI --> User: Inspect answer, cards, and source evidence

@enduml
```

## Repository Map

```text
backend/
  app/
    main.py              FastAPI routes and static frontend serving
    models.py            SQLAlchemy domain models
    jobs.py              Auto Workflow execution
    openai_client.py     OpenAI generation, chat, and embeddings
    vector_store.py      pgvector persistence and retrieval
    fsrs_utils.py        review scheduling transitions
  tests/

frontend/
  src/
    features/            product areas and route content
    hooks/               data loading and workflow state
    api.js               API client

supabase/
  migrations/            Postgres schema source of truth
```

## Local Development

Requirements:

- Docker Desktop
- Python 3.10+
- Node.js 18+
- OpenAI API key

Create local configuration:

```bash
cp .env.local.example .env
```

Start Supabase locally:

```bash
make supabase-start
make supabase-status
```

Set the local Supabase keys and `OPENAI_API_KEY` in `.env`, then run:

```bash
make run
```

Open:

```text
http://localhost:5173
```

## Production

The Dockerfile builds the Vite frontend and copies it into the FastAPI image, so
the deployed app runs as one Render Web Service.

Core production environment variables:

```env
OPENAI_API_KEY=
OPENAI_WEAK_MODEL=gpt-5.4-mini
OPENAI_STRONG_MODEL=gpt-5.4
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<pooler-host>:6543/postgres

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=
SUPABASE_JWKS_URL=https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_ISSUER=https://<project-ref>.supabase.co/auth/v1
SUPABASE_JWT_AUDIENCE=authenticated

VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=

ADMIN_EMAILS=
```

`VITE_API_BASE_URL` should be blank when the frontend and API are served from
the same Render service.

## Testing

Backend:

```bash
cd backend
python -m pytest tests
```

Frontend:

```bash
cd frontend
npm test
```

Production Docker frontend stage:

```bash
docker build --target frontend-build --progress=plain .
```

## Current Boundaries

- The frontend uses Supabase only for Auth; app data access goes through FastAPI.
- The AI provider is OpenAI-first.
- Postgres migrations in `supabase/migrations` are the schema source of truth.
- Review state is stored per user, while Study Cards and Question Cards remain
  shared study artifacts.
