# Project Lexicon

## Purpose

This document is the semantic source of truth for the StudySmith project.
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
`Question Card` are content artifacts under a note group. `Concept` is a
module-owned conceptual scope, not another source hierarchy level.

The conceptual map hierarchy is separate from the source hierarchy:

```text
Context Root
`-- Concept
    `-- Concept
        |-- Knowledge Nodes
        `-- Study Cards
```

`Context Root` is the current view root: a Module on module mind maps, a Note
Group on note-group mind maps, or a Concept on concept-focused views. Concepts are
the first-class intermediary nodes. Knowledge Nodes are leaf nodes. Study Cards
attach primarily to the deepest relevant Concept.

## Learning Hierarchy

### Subject

A broad, long-lived learning objective or study area. A subject contains modules
and defines high-level learning intent through its title, goal, and scope.

Examples: a certification exam, a course, a textbook, or a major knowledge area.

### Module

A scoped learning unit within a subject. A module contains note groups and owns
the reusable Concept pool for those note groups and their study cards.

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
for cleaning, title suggestion, Concept suggestion, study card generation, and
question card generation.

Raw text should not be treated as an identifier. Use `Unique ID` for duplicate
detection and note group provenance labels.

### Unique ID

The user-provided or generated identifier for a note group. It is used for
duplicate detection and can also carry provenance when the user supplies a
meaningful citation or origin label.

`Unique ID` is separate from `Raw Text`: unique ID identifies the note group;
raw text is the study material itself. The backend still stores this value in
the legacy `source` field.

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

### Concept

A reusable conceptual scope owned by a module. Concepts are first-class
intermediary nodes for browsing, filtering, review, retrieval, and mind maps.
Concepts can contain child Concepts, Knowledge Nodes, and Study Cards.

A Concept has zero or one parent Concept within its module. A Concept with no
parent is a root Concept. The parent is the strongest conceptual parent; do not
model Concept lineage as a DAG. If a Concept relates to another Concept outside
its parent chain, represent that as a graph relationship, not as a second parent.

Concepts are not leaf nodes. A leaf idea under a Concept is a Knowledge Node.
Study Cards attach primarily to the deepest relevant Concept.
Study Cards may also reference the Knowledge Nodes they teach.

Concepts are used to browse, filter, review, and retrieve study cards and
question cards across a module. A Concept page is scoped by study cards tagged
with that Concept, regardless of the note group that owns each study card.

Concept pages are read/review scopes for cards. Users can rename or delete the
Concept from the Concept page. Deleting a Concept deletes the concept row and removes
note-group and study-card associations, but does not delete study cards or
question cards.

The backend may still use the legacy `TopicChip` model and `topic_chips` table
names while this model is being migrated. User-facing UI must say `Concept` or
`Concepts`, not `Topic`, `Topics`, or `Topic Chip`.

### Concept Tree

The single-parent hierarchy of Concepts within a module. The Concept Tree is
the primary conceptual structure for module-level mind maps. It is generated
from source material and can later be curated by owners or maintainers.

The Concept Tree is not the source hierarchy. Note Groups are provenance and
filter contexts, not intermediary conceptual nodes in module-level mind maps.

### Knowledge Node

A typed leaf knowledge item under a Concept. Knowledge Nodes represent the
specific pieces of understanding inside a Concept, such as a definition,
mechanism, rule, or fact.

Knowledge Nodes do not contain child Concepts or child Knowledge Nodes. They can
relate to other Knowledge Nodes or Concepts through graph relationships, but
those relationships do not make them intermediary scope nodes.

Knowledge Nodes support mind map structure, retrieval diagnostics, and future
learning analytics. They are not the primary user-facing review scope; Concepts
and Study Cards remain the main review and navigation surfaces.

The backend may still use `MindMapConcept`, `mind_map_concepts`, or `concept`
field names for Knowledge Node storage while this model is being migrated.
User-facing UI should prefer `Knowledge Node` or specific Knowledge Type labels
for leaf nodes, not `Concept`.

### Knowledge Type

The role of a Knowledge Node. Initial Knowledge Types are:

- `definition`: explains what something is.
- `mechanism`: explains how something works or unfolds.
- `rule`: explains a constraint, condition, invariant, formula, or required
  relationship.
- `fact`: records a standalone detail worth remembering.

`definition` is the baseline Knowledge Type. When a Concept introduces a named
idea, the generator should prefer at least one Definition Knowledge Node when
the source material supports it.

Avoid using `topic`, `subtopic`, `term`, `process`, `principle`, `example`, or
`detail` as user-facing Knowledge Types. Concept nesting is a scope position in
the Concept Tree, not a leaf Knowledge Type.

### Mind Map

A visual and stored graph of a context root, its relevant Concept Tree, leaf
Knowledge Nodes, Study Cards, and graph relationships.

For module-level mind maps, the root is the Module and the intermediary nodes
are Concepts. Note Groups should appear as provenance metadata or filters, not as
main intermediary nodes.

For note-group-level mind maps, the root is the Note Group and the visible
Concept Tree is filtered to Concepts, Knowledge Nodes, and Study Cards supported
by that Note Group. These are still module-owned Concepts; the Note Group does
not own a separate Concept vocabulary.

## Generation Workflows

### Auto Workflow

The canonical note group generation path. The user supplies or generates a
unique ID and supplies raw text. The system then derives or updates the Concept
Tree and Knowledge Nodes, attaches or creates the deepest relevant Concepts,
generates Study Cards, attaches Study Cards to Concepts, and generates Question
Cards in the background.

The user-facing action should be `Create note group`; `Auto Workflow` names the
underlying generation behavior.

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

### Review History

The stored event trail of submitted Question Card reviews. Each Review History
event records the answer result, timing, selected answer, FSRS rating, and the
before/after scheduling state for the Question Card.

Review History belongs to Question Cards and can be aggregated by Note Group,
Module, or Concept for progress analytics. Review History is not a scheduling
model; FSRS remains the scheduling model.

## Retrieval And Chat

### RAG Boundary

The scope limit used when retrieving study card context for tutor chat. The
module is the default retrieval boundary. Retrieval can optionally narrow to a
specific note group and/or selected Concepts.

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

### Short Code

A compact, URL-safe route alias for a subject, module, note group, or Concept.
Short codes use the `[a-zA-Z0-9_-]` character set and are case-sensitive.

Short codes are URL plumbing only. They are not the internal ID, not a
user-facing label, and not a replacement for the UUID primary keys used by
backend domain operations.

### Module Overview

A compound read model for the module overview screen. It returns the module's
note groups, note group stats, module stats, and module-level question timeline
in one response.

Module overview is an API and UI aggregation boundary. It does not create a new
domain hierarchy level and should not replace `Module`, `Note Group`, `Study
Card`, `Question Card`, or `Concept` as model terms.

### Job

A backend-tracked background operation for AI generation. Jobs have types and
statuses and are used to track work such as note group generation or
question card generation.

`Job` is primarily an implementation term. Prefer user-facing workflow language
such as "create", "generation", "queued", or "retry" in the UI unless the
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

### Pgvector Embedding Store

The Postgres pgvector-backed storage for study card embeddings, documents, and
metadata used for retrieval.

This is an infrastructure term, not product vocabulary.

## Access And Sharing

### User

A signed-in person authenticated by the configured identity provider. A user can
own Subjects, receive Subject Access grants, and have personal Learning State
for shared Question Cards.

### App Role

A global permission level for app-wide capabilities. Initial roles are `reader`,
`creator`, and `admin`. Readers can study available content, creators can
create Subjects, and admins can manage app-wide settings and access. New users
start as `reader`.

### Subject Access

An explicit grant that gives a user `reader`, `maintainer`, or `owner` access
to a specific Subject. Readers can read and study. Maintainers can manage
Subject content and sharing, but cannot delete the Subject or transfer owner
status. Owners have full Subject authority, including Subject deletion and
owner transfer. Subject Access applies to resources inside the Subject:
Modules, Note Groups, Study Cards, Question Cards, Concepts, Review History
views, and Tutor Chat.

### Subject Visibility

The public publishing state of a Subject. Initial values are `private`,
`public_requested`, and `public`. Public visibility grants read access, never
edit access.

### Learning State

Per-user learning data for shared Question Cards. Learning State includes FSRS
schedule, FSRS scheduling fields used to derive Mastery, Due state, Review
History, and disabled-card status. Learning State is separate from shared
Question Card content.

## Naming Rules

- Use `Subject`, `Module`, and `Note Group` only for hierarchy levels.
- Use `Study Card` for atomic knowledge and retrieval truth.
- Use `Question Card` for assessment and spaced repetition.
- Use `Concept` for reusable module-owned conceptual scopes and intermediary
  mind map nodes in user-facing language. `TopicChip` is a legacy
  implementation name only.
- Use `Concept Tree` for the single-parent Concept hierarchy within a module.
- Use `Knowledge Node` for typed leaf knowledge items under Concepts. Avoid
  using `Concept` when referring to these leaf nodes.
- Use `Knowledge Type` for leaf node roles such as `definition`, `mechanism`,
  `rule`, and `fact`.
- Use `Mind Map` for the visual/stored graph rooted at a Module, Note Group, or
  Concept.
- Use `Unique ID` for note group identifiers and duplicate detection; use `Raw
  Text` for pasted material.
- Use `Cleaned Text` for source-preserving markdown and `Formatted Text` for
  study-card-aligned display output.
- Use `Tutor Chat` for retrieval-grounded study answers and `Intent Chat` for
  title, goal, and scope extraction.
- Treat `Job`, `Embedding`, and `Pgvector Embedding Store` as implementation terms
  unless the user needs to reason about technical internals.
- When introducing a new term, define its owner, scope, lifecycle, and how it
  differs from nearby concepts before using it widely.
