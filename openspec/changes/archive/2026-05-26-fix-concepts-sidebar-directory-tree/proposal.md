## Why

The Concepts sidebar is supposed to behave like a directory over the module's single-parent Concept Tree, but it currently does not reliably present Concepts as a navigable tree. This breaks the mental model established by the Concept rename and makes parent/child Concept browsing harder than the mind map structure implies.

## What Changes

- Fix the Concepts sidebar so it renders the current directory level from the Concept Tree instead of a flat or incorrect list.
- Preserve the expected directory navigation behavior:
  - root level shows root Concepts only.
  - selecting a Concept enters that Concept's level and shows its immediate child Concepts.
  - a back/up control returns to the parent level.
  - returning above a root Concept navigates to the module page while keeping the sidebar in Concepts mode.
- Ensure the active/highlight state marks the current Concept row, not the back/up control.
- Keep visual treatment aligned with the existing sidebar and Concept terminology.
- Add focused frontend tests for Concept directory rows and sidebar state behavior.
- No backend schema or API changes are expected.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `concept-terminology`: Clarify that Concept sidebar navigation must expose the module Concept Tree as a directory-style hierarchy.

## Impact

- Affected frontend: Concept sidebar state, directory row building, route/navigation handling, and sidebar tests.
- Affected specs: `concept-terminology`.
- Backend/API impact: none expected; existing Concept payloads with `parent_concept_id`/legacy `parent_topic_id` should be sufficient.
