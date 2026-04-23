# Flashcard Study

An application that allows for quick creation of flashcards and delegates checking to objective agent tutors.

Paste in raw study text — lecture notes, textbook excerpts, articles — and the system generates structured study cards and quiz questions automatically. A built-in spaced repetition scheduler surfaces the right questions at the right time, and a RAG-powered chat lets you query your own notes like a tutor.

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

## Setup

### Requirements
- Python 3.10+
- Node.js 18+
- An OpenAI API key

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
OPENAI_API_KEY=sk-...
```

Start the API:

```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

> The frontend talks to `http://localhost:8000` by default. Override with `VITE_API_BASE_URL` in a `frontend/.env` file if needed.

### Schema changes

If you have a database from an older version and see errors, delete `backend/study.db` and `backend/chroma/` then restart. The schema is recreated on startup.

---

## Roadmap

- [ ] **Model-agnostic provider** — abstract the AI client so any OpenAI-compatible endpoint (Anthropic, Gemini, Ollama, etc.) can be configured via env vars without code changes
- [ ] **Single executable** — bundle backend and frontend into one runnable binary so setup is just "provide key, double-click, open browser"
- [x] Module-level review page with cross-note-group scheduling
- [x] Due-count badge per note group in the sidebar
- [x] Dropdown search for topic chip selection (replaces toggle list for large chip pools)

---

## Contributing

Pull requests welcome. There is no test suite yet — if you add one, place backend tests in `backend/tests/` and frontend tests in `frontend/src/__tests__/`.

---

## Implementation Reference

Domain Model
Subject

Top-level container for a broad area of study.

Contains: Modules

Module

Coherent subdivision of a Subject (e.g. chapter/theme).

Contains: Note Groups

Owns: Topic Chip pool

Primary scoping boundary for retrieval

Note Group

A group of related study content created from a single paste of raw study text (one ingestion event).

Belongs to: Module

Contains: Study Cards

Attached: Topic Chips

Stores: Raw study text (provenance)

Topic Chip

Reusable tag representing a concept/theme.

Stored at: Module level (chip pool)

Attached to: Note Groups (not individual Study Cards)

User-editable: rename and merge supported

Study Card

Atomic, coherent unit derived from raw study text.

Belongs to: Note Group

Stored in: Vector DB (ChromaDB on disk) as embeddings

Embedded with: OpenAI embeddings

Can be: AI-generated or manually created

Edit behaviour:

re-embed on change

impacts dependent question cards

Question Card

Assessment item derived from raw text and/or Study Cards.

Types: MCQ (single correct) or multi-answer (multiple correct)

References: one or more Study Cards required to answer it

Lifecycle:

becomes stale when referenced Study Cards change

auto-regenerates in background

Behavioural Rules
Study Card Size

Prefer Study Cards that can be embedded and used directly without secondary chunking.

If content is too large, split by concept into multiple coherent Study Cards.

Retrieval Scoping

Chatbot retrieval must pre-filter Study Cards by:

Module

Note Group (when the user is in a specific note group context; otherwise module-only)

Then perform vector similarity search on the scoped Study Cards.

Study Card Edits → Question Card Updates

On Study Card create/update/delete:

Re-embed affected Study Card(s).

Mark dependent Question Cards as stale=true immediately.

Queue background regeneration of impacted Question Cards.

When regeneration completes, replace question content (last-write-wins) and set stale=false.

Topic Chip Governance

Topic Chips are user-editable.

Users can rename Topic Chips.

Users can merge Topic Chips:

All attachments from source chips move to the target chip.

Source chips are removed or archived (implementation choice).

Versioning

Last-write-wins only.

No historical versions for Study Cards or Question Cards.

API Contracts (Conceptual)
Subjects & Modules

List Subjects

GET /subjects

Returns: [ { subjectId, title, createdAt, updatedAt } ]

Get Subject

GET /subjects/{subjectId}

Returns: { subjectId, title, modules: [...] }

Create Module

POST /subjects/{subjectId}/modules

Body: { title, description? }

Returns: { moduleId, ... }

List Modules

GET /subjects/{subjectId}/modules

Returns: [ { moduleId, title, ... } ]

Note Groups

Create Note Group

POST /modules/{moduleId}/note-groups

Body: { rawText, title? }

Returns: { noteGroupId, status }

Get Note Group

GET /note-groups/{noteGroupId}

Returns: { noteGroupId, moduleId, title, topicChips, generationStatus, ... }

Trigger Generation

POST /note-groups/{noteGroupId}/generate

Body: { mode?: "full" | "notes-only" | "quiz-only" }

Returns: { jobId, status }

Get Job Status

GET /jobs/{jobId}

Returns: { jobId, type, status, progress?, errors? }

Study Cards

List Study Cards

GET /note-groups/{noteGroupId}/study-cards

Returns: [ { studyCardId, title?, content, updatedAt } ]

Create Study Card (manual)

POST /note-groups/{noteGroupId}/study-cards

Body: { title?, content }

Returns: { studyCardId, ... }

Side effects: embed

Update Study Card

PUT /study-cards/{studyCardId}

Body: { title?, content }

Returns: { studyCardId, ... }

Side effects: re-embed, stale + regenerate dependent Question Cards

Delete Study Card

DELETE /study-cards/{studyCardId}

Side effects: remove embedding, stale + regenerate dependent Question Cards (or cleanup)

Question Cards

List Question Cards

GET /note-groups/{noteGroupId}/question-cards

Returns: [ { questionCardId, type, prompt, options, stale, references: [studyCardId...] } ]

Generate Question Cards from a Study Card

POST /study-cards/{studyCardId}/question-cards/generate

Body: { count?: number, difficulty?: "easy" | "mixed" | "hard" }

Returns: { jobId }

Regenerate Question Card

POST /question-cards/{questionCardId}/regenerate

Returns: { jobId }

Topic Chips

List Topic Chips

GET /modules/{moduleId}/topic-chips

Returns: [ { chipId, label } ]

Rename Topic Chip

PUT /topic-chips/{chipId}

Body: { label }

Merge Topic Chips

POST /modules/{moduleId}/topic-chips/merge

Body: { sourceChipIds: [...], targetChipId }

Attach Chips to Note Group

POST /note-groups/{noteGroupId}/topic-chips

Body: { chipIds: [...] }

Detach Chip from Note Group

DELETE /note-groups/{noteGroupId}/topic-chips/{chipId}

Background Job Architecture (Conceptual)
Job Types

NOTE_GROUP_GENERATION

Input: noteGroupId (raw text)

Output:

Note Group title

Study Cards (persist + embed)

Topic chip attachments (and optionally new chips)

Question Cards with Study Card references

STUDY_CARD_EMBEDDING

Input: studyCardId

Output: upsert embedding into ChromaDB

QUESTION_CARD_REGENERATION

Input: questionCardId (+ referenced Study Cards)

Output: updated question content, clear stale flag

STUDY_CARD_TO_QUIZ_GENERATION

Input: studyCardId

Output: N new Question Cards referencing relevant Study Cards

Triggers

NoteGroupGenerateRequested → enqueue NOTE_GROUP_GENERATION

StudyCardCreated/Updated → enqueue:

STUDY_CARD_EMBEDDING

QUESTION_CARD_REGENERATION (for all dependent question cards)

StudyCardDeleted → enqueue:

dependent question regeneration or cleanup (implementation choice)

Failure Handling

Jobs should be retryable.

If regeneration fails:

Question Card remains stale=true

Error is recorded

User can manually retry

AI Prompt Templates
Note Group → Study Cards

System

Convert raw study text into atomic study cards for effective learning and retrieval.

Do not invent facts.

Split by concept; each card must be coherent alone.

Ensure collective coverage of key information.

User

Module context: {moduleTitle, optionalModuleDescription}

Raw text: {rawText}

Output: list of Study Cards with { title?, content, key_terms? }

Output Shape

{
  "study_cards": [
    { "title": "...", "content": "...", "key_terms": ["..."] }
  ]
}

Study Cards → Question Cards

System

Generate assessment questions answerable using the provided Study Cards only.

Every question must reference which Study Cards support the answer.

Create MCQ or multi-answer questions.

Avoid ambiguity; test understanding.

User

Study cards: [ {studyCardId, title, content}, ... ]

Desired count: {N}

Difficulty: {easy|mixed|hard}

Output Shape

{
  "question_cards": [
    {
      "type": "mcq",
      "prompt": "...",
      "options": ["...", "...", "...", "..."],
      "correct_option_indices": [1],
      "study_card_refs": ["studyCardId1", "studyCardId3"]
    }
  ]
}

Note Group Title Generation

System

Generate a concise, descriptive chapter-style title reflecting the input content.

User

Module: {moduleTitle}

Raw text: {rawText}

Output Shape

{ "title": "..." }

Topic Chip Assignment

System

Assign relevant topic chips from the module pool.

Propose new chips only when an important concept is missing.

Chips should be short noun phrases.

User

Module chip pool: [ {chipId, label}, ... ]

Content: {rawText or study card titles/keywords}

Output Shape

{
  "attach_chip_ids": ["chip1", "chip9"],
  "new_chips": ["..."]
}

Question Card Regeneration

System

Update an existing question so it remains valid with the latest Study Card content.

Preserve intent where possible.

Ensure the answer remains derivable.

Update references if needed.

User

Existing question card: {prompt, options, correct_indices, refs}

Updated study cards: [ {studyCardId, title, content}, ... ]

Output Shape

{
  "type": "mcq",
  "prompt": "...",
  "options": ["...", "...", "...", "..."],
  "correct_option_indices": [1],
  "study_card_refs": ["studyCardId1"]
}
