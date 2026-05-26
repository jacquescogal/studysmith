## 1. Lexicon and Terminology Baseline

- [x] 1.1 Update `project-lexicon.md` so `Concept` replaces `Topic` as the reusable module-owned intermediary scope.
- [x] 1.2 Update `project-lexicon.md` so `Concept Tree` replaces `Topic Tree` as the single-parent hierarchy within a module.
- [x] 1.3 Preserve `Knowledge Node` terminology and explicitly document that Knowledge Nodes are leaf nodes under Concepts.
- [x] 1.4 Search docs and README/SETUP content for user-facing Topic terminology and replace it with Concept terminology where it refers to the intermediary conceptual scope.

## 2. Backend Compatibility Layer

- [x] 2.1 Add concept-named schema types or serializer helpers that expose `concept_id`, `parent_concept_id`, and `concepts` while mapping to existing topic storage.
- [x] 2.2 Add concept-named module routes for listing and creating Concepts, backed by existing `TopicChip` storage.
- [x] 2.3 Add concept-named Concept routes for read, update, delete, mind map, study cards, question cards, review, timeline, and knowledge-node regeneration.
- [x] 2.4 Keep existing topic routes as compatibility aliases that delegate to the same backend handlers.
- [x] 2.5 Update route restore logic to support `/concepts/:conceptCode` while preserving `/topics/:topicCode` compatibility.
- [x] 2.6 Add or update backend tests proving concept routes and legacy topic routes return equivalent conceptual scope data.

## 3. Backend Generation and Mind Map Terminology

- [x] 3.1 Rename generation prompt helper language from Topic Tree and Study Card Topic links to Concept Tree and Study Card Concept links.
- [x] 3.2 Update Knowledge Node reconciliation prompts to describe selected Concept, child Concept definitions, and connected Study Cards.
- [x] 3.3 Update generation workflow stage display labels and logs from Topic terminology to Concept terminology.
- [x] 3.4 Keep persisted job stage values compatible with existing data if renaming constants would require migration.
- [x] 3.5 Update mind map service response labels and tests so intermediary nodes are Concepts and leaf nodes remain Knowledge Nodes.

## 4. Frontend API, Routes, and State

- [x] 4.1 Add concept-named API client functions and route helpers for all current topic-scoped operations.
- [x] 4.2 Update frontend navigation paths to use `/concepts/:conceptCode` for Concept pages.
- [x] 4.3 Rename topic-oriented frontend utilities to concept-oriented names where they model user-facing Concept behavior.
- [x] 4.4 Update frontend tests for concept route helpers, route restore behavior, sidebar scope, and API helper names.

## 5. Frontend UI Migration

- [x] 5.1 Rename Topic page, Topic sidebar, Topic directory, and Topic mind map visible text to Concept equivalents.
- [x] 5.2 Update buttons, menus, empty states, errors, toasts, and generation workflow copy to use Concept terminology.
- [x] 5.3 Update module, note-group, and Concept mind maps so intermediary node labels and interactions use Concept terminology.
- [x] 5.4 Ensure Knowledge Node UI text remains Knowledge Node or specific Knowledge Type terminology.
- [x] 5.5 Update frontend tests to assert no user-facing Topic terminology remains for conceptual scopes.

## 6. Cleanup and Verification

- [x] 6.1 Run focused backend tests for concept/topic route compatibility and generation workflow behavior.
- [x] 6.2 Run focused frontend tests for API helpers, route restore, sidebar, page headers, and mind maps.
- [x] 6.3 Run frontend build.
- [x] 6.4 Run repository search for remaining `Topic`/`topic` references and classify each as migrated, legacy storage compatibility, or test compatibility.
- [x] 6.5 Document any intentionally retained legacy storage names and any follow-up storage migration work.
