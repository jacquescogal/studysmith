## Context

The Concept Tree is now the canonical module-owned hierarchy for intermediary learning scopes. The sidebar already has a Concepts tab and helper code for building directory rows, but the current behavior can still degrade into a flat list or incorrect navigation state depending on route state, search state, selected Concept state, and legacy `topics` compatibility names.

The desired product behavior is directory-style browsing:

- module Concepts root view lists root Concepts.
- selecting a root Concept enters that Concept directory level.
- the current level shows an up/back row, the current Concept row, and immediate children.
- selecting a child enters that child level.
- selecting up from a root returns to the module page while keeping the sidebar in Concepts mode.

The implementation should preserve existing Concept routes and storage compatibility. This is a frontend behavior fix, not a Concept data model change.

## Goals / Non-Goals

**Goals:**

- Make the Concepts sidebar render the Concept Tree as a directory-style hierarchy.
- Ensure sidebar row generation consistently uses `parentConceptId`, `parent_concept_id`, `parentTopicId`, or `parent_topic_id` while storage compatibility remains in place.
- Ensure the active row is the current Concept row, not the up/back row.
- Ensure root navigation returns to the module page with the sidebar still on Concepts.
- Keep search behavior useful without corrupting directory state.
- Add focused tests around directory row building, sidebar rendering, and navigation state.

**Non-Goals:**

- Do not change backend Concept storage or Concept APIs.
- Do not introduce multi-parent Concept navigation.
- Do not redesign the sidebar layout beyond what is needed to make directory behavior clear.
- Do not remove legacy `topic` compatibility aliases in this fix.

## Decisions

### Decision: Treat directory rows as a frontend projection of the Concept Tree

The sidebar should not need a backend-specific directory endpoint. It can derive rows from the module's loaded Concepts because each Concept already carries its parent Concept identifier.

Alternative considered: add a backend endpoint that returns directory rows. That would centralize logic but adds unnecessary API surface for a deterministic UI projection.

### Decision: Keep compatibility field normalization at the directory boundary

The directory helper should normalize both concept-named and legacy topic-named parent fields. This keeps the sidebar robust while backend storage names are still transitional.

Alternative considered: normalize every Concept object at API boundaries only. That is cleaner long term, but this bug is specifically about sidebar behavior and should remain tightly scoped.

### Decision: Preserve search as a flat filtered mode

When the user searches Concepts, results can remain a flat filtered list because search is a lookup mode, not directory browsing. Clearing search should restore the directory level for the current selected Concept.

Alternative considered: search only within the current directory level. That is more restrictive and makes it harder to find Concepts across a module.

### Decision: Keep the sidebar tab state explicit

When navigating up from a root Concept to the module page, navigation state should preserve the Concepts tab. This avoids the regression where returning to the module page silently flips the sidebar back to Note Groups.

Alternative considered: infer the sidebar tab from the route only. That fails for the module page because the module page can validly show either Note Groups or Concepts.

## Risks / Trade-offs

- Legacy topic names still exist in state variables and compatibility helpers -> Mitigation: tests should assert user-visible Concept behavior instead of requiring a large naming cleanup in this fix.
- Search behavior differs from directory behavior -> Mitigation: document and test that search is flat while non-search is directory-level.
- Current selected Concept may disappear after deletion or refresh -> Mitigation: directory row builder should fall back to root Concepts when the current Concept is not present.
- Navigation state can be lost on refresh -> Mitigation: route restoration and module navigation tests should cover Concepts sidebar state where feasible.
