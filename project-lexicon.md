# Project Lexicon

## Purpose

This document is the semantic source of truth for the Flashcard Study project.
Use it when naming models, API fields, UI text, prompts, tests, and docs. Its
purpose is to reduce drift: the same product concept should keep the same name,
meaning, and boundary across the codebase.

When adding a new concept, prefer extending this lexicon before introducing a
new term in code or UI.

## Canonical Model

The core learning hierarchy is:

```text
Subject
`-- Module
    `-- Note Group
        |-- Study Cards
        `-- Question Cards
```

`Subject`, `Module`, and `Note Group` are hierarchy levels. `Study Card` and
`Question Card` are content artifacts under a note group. `Topic Chip` is a
module-owned tag, not another hierarchy level.

## Learning Hierarchy

### Subject

A broad, long-lived learning objective or study area. A subject contains modules
and defines high-level learning intent through its title, goal, and scope.

Examples: a certification exam, a course, a textbook, or a major knowledge area.

### Module

A scoped learning unit within a subject. A module contains note groups and owns
the reusable topic chip pool for those note groups and their study cards.

A module is the primary review and retrieval boundary. Tutor chat searches study
cards within a module by default, and module-level review can span multiple note
groups.

### Note Group

One ingested source chunk or study session under a module. A note group usually
starts from pasted raw text and becomes the container for generated study cards
and question cards.

A note group can optionally narrow retrieval, review, filtering, and chat within
its parent module.

## Content Artifacts

### Raw Text

The actual study material pasted or supplied by the user. Raw text is the input
for cleaning, title suggestion, topic chip suggestion, study card generation,
and question card generation.

Raw text should not be treated as a citation label. Use `Source` for origin or
provenance labels.

### Source

The user-provided citation or origin label for a note group. It is used for
provenance and duplicate detection.

`Source` is separate from `Raw Text`: source names where the material came from;
raw text is the material itself.

### Cleaned Text

An AI-formatted markdown version of raw text that preserves the original content
and meaning. Cleaning may fix spacing, headings, bullets, and line breaks, but
must not summarize, omit, add, or scope-filter facts.

### Formatted Text

A study-card-aligned reading view created after study cards exist. Formatted
text is derived from formatted sections and is intended for readable display.

Formatted text is not the same as cleaned text. Cleaned text preserves the
source; formatted text organizes material around generated study cards.

### Formatted Sections

Structured reading sections where each section maps to exactly one study card.
Formatted sections power the study-note reading view and support navigation
between a source-like view and study card artifacts.

### Study Card

The atomic knowledge unit and retrieval source of truth. A study card captures a
coherent concept or fact set that should stand alone for learning and retrieval.

Study cards are embedded in the vector store and are the grounding context for
tutor chat and generated question cards.

### Question Card

An assessment and scheduling artifact derived from one or more study cards. A
question card contains a prompt, answer options, correct option indices,
optional option explanations, and references to supporting study cards.

Question cards are not the source of truth for knowledge. If a study card
changes, dependent question cards may become stale.

### Study Card References

The list of study card IDs that support a question card or tutor chat answer.
References connect assessment and chat output back to the knowledge source of
truth.

## Classification

### Topic Chip

A reusable concept tag owned by a module. Topic chips attach to note groups and
individual study cards.

Topic chips are used to filter note groups, study cards, question cards, review
sessions, and retrieval. They are not hierarchy levels and should remain broad,
reusable labels rather than highly specific source titles.

## Generation Workflows

### Wizard Workflow

The user-guided note group generation path. The user supplies source and raw
text, reviews or chooses title suggestions, selects existing or new topic chips,
and then finalizes the note group to generate study cards.

Use this term only for note group generation unless the workflow is explicitly
expanded.

### Auto Workflow

The background note group generation path. The user supplies source and raw
text, and the system chooses a title, attaches or creates topic chips, generates
study cards, and generates question cards with minimal intervention.

Use this term only for note group generation unless the workflow is explicitly
expanded.

### Finalize Note Group

The commit point in the wizard workflow. Finalizing persists the selected
source, raw text, title, and topic chip choices, then generates study cards.

This does not mean a general "mark finished" state.

### Additional Generation Instructions

Optional user guidance that constrains or steers AI generation within the
subject and module scope. These instructions should not override source truth,
cause invented facts, or expand generation beyond the defined scope.

### Generation Status

The note group's generation lifecycle state. Current states include `created`,
`queued`, `generating`, `complete`, `failed`, and `cancelled`.

Use generation status for note group content generation state, not for review
state or study progress.

## Review And Scheduling

### FSRS

The spaced repetition scheduler used for question cards. FSRS stores scheduling
state such as due date, difficulty, stability, elapsed days, scheduled days,
reps, lapses, state, and step.

### Due

A question card is due when it is scheduled for review now or within the next
six hours. The six-hour window is intentional and appears in timeline and review
behavior.

### Review Due

A review session containing only due question cards in the selected scope.

### Review Next / Queue

A review session containing upcoming question cards ordered by schedule and
capped by the requested count.

`Queue` is the backend/API mode; `Review Next` is the current user-facing label.

### Review All

A review session containing all question cards in the selected scope regardless
of schedule.

### Stale Question Card

A question card whose supporting study card was edited. The question may no
longer be trustworthy and should be regenerated or manually reviewed.

Staleness belongs to question cards because question cards depend on study card
content.

### Mastery

A user-facing approximation derived from FSRS difficulty. Current UI behavior
calculates mastery as `10 - difficulty` and groups it into low, medium, high, or
unknown tiers.

Mastery is not a separate stored learning model and should not be presented as
an authoritative proficiency score.

## Retrieval And Chat

### RAG Boundary

The scope limit used when retrieving study card context for tutor chat. The
module is the default retrieval boundary. Retrieval can optionally narrow to a
specific note group and/or selected topic chips.

### Tutor Chat

Retrieval-grounded chat for answering study questions. Tutor chat answers only
from retrieved study card context and cites the study card references it used.

Tutor chat is distinct from intent chat.

### Intent Chat

The setup assistant flow that extracts structured `title`, `goal`, and `scope`
for subjects or modules.

Intent chat shapes learning intent. It is not the tutor chat experience and
should not be used to answer study questions from retrieved cards.

## Provenance

### Source Range / Evidence Range

A character span in cleaned text that supports a generated study card. Source
ranges connect study cards back to the cleaned source and support highlighting
between the reading view and the card.

Use this concept for provenance of generated study cards, not for question card
references.

## Implementation Terms

### Job

A backend-tracked background operation for AI generation. Jobs have types and
statuses and are used to track work such as auto note group generation or
question card generation.

`Job` is primarily an implementation term. Prefer user-facing workflow language
such as "auto workflow", "generation", "queued", or "retry" in the UI unless the
technical object is specifically being exposed.

### Job Status

The lifecycle state of a job. Current states include `queued`, `running`,
`completed`, `failed`, and `cancelled`.

Job status describes background operation state, not the semantic completeness
of a note group.

### Embedding

A vector representation of study card content used for similarity search.
Embeddings are implementation details that support retrieval-grounded tutor
chat.

### Chroma Collection

The local vector database collection that stores study card embeddings,
documents, and metadata for retrieval.

This is an infrastructure term, not product vocabulary.

## Naming Rules

- Use `Subject`, `Module`, and `Note Group` only for hierarchy levels.
- Use `Study Card` for atomic knowledge and retrieval truth.
- Use `Question Card` for assessment and spaced repetition.
- Use `Topic Chip` for reusable module-owned tags; do not call chips categories,
  folders, groups, or modules.
- Use `Source` for origin labels and `Raw Text` for pasted material.
- Use `Cleaned Text` for source-preserving markdown and `Formatted Text` for
  study-card-aligned display output.
- Use `Tutor Chat` for retrieval-grounded study answers and `Intent Chat` for
  title, goal, and scope extraction.
- Treat `Job`, `Embedding`, and `Chroma Collection` as implementation terms
  unless the user needs to reason about technical internals.
- When introducing a new term, define its owner, scope, lifecycle, and how it
  differs from nearby concepts before using it widely.
