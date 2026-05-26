## Why

The app currently uses `Topic` for the reusable conceptual scope, while the product model has evolved toward `Concept` as the clearer term for module-owned intermediary knowledge scopes. Renaming this consistently will reduce semantic confusion between source hierarchy, mind map structure, and leaf Knowledge Nodes.

## What Changes

- Replace user-facing `Topic` terminology with `Concept` across navigation, pages, mind maps, buttons, status messages, prompts, tests, and documentation.
- Update the canonical lexicon so `Concept` is the reusable module-owned intermediary scope, and `Concept Tree` is the single-parent hierarchy of Concepts.
- Keep `Knowledge Node` as the leaf-node term; Knowledge Nodes must not be renamed to Concepts.
- Rename frontend APIs, routes helpers, components, and local utilities from topic-oriented names to concept-oriented names where feasible.
- Rename backend schemas, service functions, prompt helpers, generation workflow names, and tests from topic-oriented names to concept-oriented names where feasible.
- Preserve compatibility for existing data and routes during the migration, especially legacy database tables and columns such as `topic_chips`, `note_group_topic_chips`, `study_card_topic_chips`, and `TopicChip`.
- **BREAKING**: once compatibility aliases are removed in a later cleanup, external clients using `/topics` or `/topic-chips` route names will need to move to concept route names.

## Capabilities

### New Capabilities

- `concept-terminology`: Defines Concept terminology, Concept Tree behavior, API compatibility expectations, and rename boundaries between Concepts and Knowledge Nodes.

### Modified Capabilities

- None. There are no existing OpenSpec capability specs in this repository.

## Impact

- Affected documentation: `project-lexicon.md`, README/SETUP references, and any developer-facing terminology notes.
- Affected backend: SQLAlchemy models/schemas, route handlers, generation workflow stages/logs, OpenAI prompt helpers, mind map services, draft/promotion logic, route restore helpers, and backend tests.
- Affected frontend: API client functions, route helpers, sidebar directory, page headers, Concept page, mind map interactions, generation workflow labels, tests, and CSS class names where terminology appears.
- Database impact: existing topic-named tables/columns should remain usable initially. A database table rename should be treated as an optional later migration after app-level terminology is stable.
- API impact: concept-named routes should be introduced while topic-named routes remain as compatibility aliases during the transition.
