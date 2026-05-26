## Context

The current product model uses `Topic` for module-owned conceptual scopes in the UI and route model, while `MindMapConcept` is already used for stored Knowledge Nodes and relation endpoints. The lexicon currently warns not to use `Concept` for user-facing Knowledge Nodes, because `Topic` was the intermediary scope term. The requested change reverses that naming choice: the intermediary scope should be called `Concept`, while typed leaf nodes remain `Knowledge Nodes`.

The codebase has a large topic surface:

- Frontend route helpers, API client methods, sidebar utilities, page components, mind map layout, and tests use topic names.
- Backend routes expose `/topics` and `/topic-chips`, while SQLAlchemy still uses `TopicChip` and `topic_chips`.
- Generation uses topic terminology in workflow stages, draft tables, prompt helpers, promotion code, logs, and job progress labels.
- Existing local and production data already use topic-named tables and columns.

This is a cross-cutting terminology refactor with migration risk. The implementation should preserve behavior while moving the public product language and code-facing API toward Concept.

## Goals / Non-Goals

**Goals:**

- Make `Concept` the canonical term for reusable module-owned intermediary scopes.
- Make `Concept Tree` the canonical term for the single-parent hierarchy of Concepts.
- Preserve `Knowledge Node` as the canonical term for typed leaf knowledge under a Concept.
- Update user-facing UI text so users see Concept terminology consistently.
- Introduce concept-named frontend helpers and backend routes while keeping topic-named aliases during transition.
- Update generation prompts, stage labels, logs, and tests to use Concept terminology.
- Keep existing data readable and writable without requiring an immediate destructive table rename.

**Non-Goals:**

- Do not rename `Knowledge Node` to Concept.
- Do not redesign the mind map structure, generation workflow, permissions, or review behavior.
- Do not introduce multi-parent Concept DAGs; Concepts keep zero or one parent Concept.
- Do not require a production database table rename in the first implementation pass.
- Do not remove compatibility routes until clients and tests have fully moved to concept routes.

## Decisions

### Decision: Rename product terminology before physical storage

The implementation will update the lexicon, UI, API wrappers, route names, prompt language, and service naming first while allowing the database to keep legacy topic table names initially.

Alternative considered: rename tables such as `topic_chips` to `concepts` immediately. That would produce cleaner storage names but increases migration risk, especially with existing foreign keys, draft generation isolation, short codes, route restore, and local Supabase state. The first pass should favor compatibility and testable behavior.

### Decision: Introduce compatibility aliases

Backend concept routes should be added for the current topic behavior, for example concept-scoped reads, mind maps, study cards, question cards, knowledge-node regeneration, and module concept listing. Existing topic routes should remain as aliases until the frontend no longer depends on them and a later cleanup can remove them deliberately.

Alternative considered: one-shot route replacement. That is simpler in code but risks breaking bookmarked routes, tests, and any local data or clients still using topic URLs.

### Decision: Rename frontend files and symbols where they are product-facing

Frontend components and helpers should move from topic naming to concept naming where they represent the user-facing product concept. Examples include Topic page, topic directory, topic knowledge node helpers, topic route helpers, topic API helpers, and sidebar labels. CSS class names may be migrated when they are easy to update, but purely visual class names are lower priority than behavior and user text.

Alternative considered: only change visible strings. That would be fast but would keep the codebase semantically confusing and make future work continue to mix Topic and Concept.

### Decision: Keep legacy backend storage names behind concept-facing wrappers

The backend may temporarily retain `TopicChip`, `topic_chips`, `parent_topic_id`, and join-table names. Concept-facing route handlers and schemas can map to those models while exposing `concept_id`, `parent_concept_id`, and `concepts` in new response shapes.

Alternative considered: create duplicate Concept models mapped to the same tables. That may help naming but can confuse SQLAlchemy relationships and increase maintenance overhead. A smaller set of explicit mapping helpers is safer.

### Decision: Update prompts and generation stage language

OpenAI prompt helpers should ask for a Concept Tree and Study Card Concept links. Job stage labels should say Concept and Concept Knowledge Nodes. Existing internal stage constants may remain topic-named initially if changing them would require data migration, but displayed labels and logs should use Concept.

Alternative considered: leave prompt names as Topic because the model already works. That preserves behavior but undermines the semantic rename and keeps future generation changes confusing.

## Risks / Trade-offs

- Existing data and migrations still use topic-named tables → Mitigation: document storage names as legacy compatibility and avoid table renames in this phase.
- Mixed terminology may persist during the transition → Mitigation: define allowed legacy names and add focused search/test tasks to remove user-facing Topic language.
- Route compatibility increases maintenance temporarily → Mitigation: centralize concept handlers and have topic aliases delegate to them.
- Renaming many frontend files can create noisy diffs → Mitigation: migrate by bounded surfaces and keep behavioral edits minimal.
- Prompt terminology changes can alter LLM output shape → Mitigation: preserve JSON structure semantics, update parser tests, and keep strict validation.

## Migration Plan

1. Update `project-lexicon.md` so Concept, Concept Tree, and Knowledge Node boundaries are authoritative.
2. Add concept-named backend schemas/routes as wrappers over existing storage.
3. Move frontend API and route helpers to concept names and keep topic aliases only where needed for compatibility.
4. Rename UI components, sidebar utilities, and mind map labels from Topic to Concept.
5. Update generation labels, prompts, draft terminology where feasible, and test expectations.
6. Keep existing topic routes and storage names working.
7. After frontend and tests are stable, consider a separate cleanup change for physical database/table/column renames and compatibility removal.

Rollback strategy: because storage names remain unchanged, rollback is primarily an app-code rollback. Concept routes can be removed while topic routes continue to work.

## Resolved Implementation Choices

- Browser URLs should move to `/concepts/:conceptCode`; existing `/topics/:topicCode` paths should restore and redirect or delegate during compatibility.
- New concept routes should expose concept-named payload fields. Legacy topic routes may keep topic-named fields if needed for compatibility, but shared serializers should prefer concept names internally.
- Persisted job stage values may remain topic-named initially, but the app should expose concept-named display labels, logs, and frontend state labels. A later storage cleanup can rename persisted constants if needed.

## Legacy Names Retained

The implementation intentionally retains topic-named storage and compatibility surfaces in this change:

- SQLAlchemy/storage names: `TopicChip`, `topic_chips`, `parent_topic_id`, `note_group_topic_chips`, `study_card_topic_chips`, draft topic tables, and topic short-code tables.
- Legacy API routes and restore aliases: `/topics`, `/topic-chips`, and `/routes/.../topics/...`.
- Compatibility response fields where existing consumers still read them: `topic_id`, `topic_ids`, `parent_topic_id`, and `topic_chips`.
- Persisted job stage values such as `mind_map_topics` and `topic_knowledge_nodes`; display labels render as Concept terminology.

A future cleanup can rename tables, columns, stage constants, CSS compatibility selectors, and legacy route aliases after concept-named clients are stable.
