## Context

The workspace interaction dock now owns high-frequency learning actions for Module, Note Group, and Concept pages. Mind Map is the first action in that dock and the primary visual context for each scope, but overview routes still behave like a separate default surface and some management actions remain embedded in overview content below Mind Map cards.

Existing app code already has a reusable `ScopeInteractionDock`, Module settings modal state, Note Group metadata modal state, Concept delete/regenerate handlers, and confirmation flows. This change should compose those existing pieces into a standard dock settings entry point rather than introducing new backend contracts.

## Goals / Non-Goals

**Goals:**

- Make Mind Map the default selected dock state for Module, Note Group, and Concept overview routes.
- Remove duplicate card-style shortcuts below Mind Map content, especially cards that only repeat Mind Map, View Cards, Study, Review, Tutor Chat, or settings actions.
- Add a dock settings gear button that opens the correct scope settings modal.
- Standardize Module settings on the existing Module settings modal and include delete Module there.
- Provide Note Group settings for title rename and delete Note Group.
- Provide Concept settings for delete Concept and regenerate Concept only.
- Stop exposing Concept rename and Concept description editing in the Concept page/settings workflow.

**Non-Goals:**

- Changing backend API shapes, delete semantics, regeneration job semantics, or permission models.
- Adding settings routes; settings remains modal-driven.
- Moving Study Card or Question Card editing into dock settings.
- Redesigning Subject settings or the left Context Sidebar.

## Decisions

### 1. Treat overview routes as Mind Map-selected dock state

On Module, Note Group, and Concept overview routes, the dock should mark Mind Map as active. Explicit child routes such as View Cards, Study, Study Cards, Question Cards, and Review behavior should continue to override the active dock state where applicable.

Alternative considered: redirect overview routes to `/mind-map`. That would disturb existing deep links and route expectations. Keeping the route stable while selecting Mind Map in the dock gives the intended default without a URL migration.

### 2. Add settings as dock chrome, not a learning action row

The settings entry should be a gear icon button in the dock header or footer with an accessible label such as `Module settings`, `Note Group settings`, or `Concept settings`. It should open a modal and should not appear as another large learning action row next to Mind Map, View Cards, Study, and Review.

Alternative considered: adding `Settings` as a normal dock action. That makes settings look like route navigation and dilutes the learning-action list.

### 3. Reuse existing modal and action handlers

Module settings should reuse the existing Module settings modal and save handler. The delete Module action should be added to that modal, using the existing confirmation and delete handler.

Note Group settings should reuse the existing metadata modal path for title rename and include the existing delete Note Group handler. The modal title and copy should say `Note Group settings` rather than `Edit note group metadata`.

Concept settings should be a narrow modal or settings panel that invokes existing delete Concept and regenerate Concept handlers. It should not render title or description inputs and should not call the Concept update API from this workflow.

Alternative considered: create one generic settings modal component that dynamically renders all scopes. That may be worthwhile later, but the current code already has scope-specific handlers and state. A small shared trigger contract in the dock is lower risk.

### 4. Preserve management availability while removing duplicate shortcuts

Overview content may keep stats, generation state, progress, filters, and management details, but cards or action sections whose only purpose is to duplicate dock/floating-bubble actions should be removed or reduced. Mind Map panels may keep graph-specific controls such as Knowledge Node regeneration when they operate on graph content directly.

Alternative considered: move every management control into settings. That would hide contextual graph controls that are useful beside the graph and expands the scope beyond the requested settings modal.

### 5. Update Concept behavior documentation

The project lexicon currently describes Concept rename/delete availability from the Concept page. This change makes delete and regeneration the only Concept settings actions, so the lexicon and OpenSpec concept behavior should be updated to avoid stale instructions.

Alternative considered: leave docs unchanged because backend update endpoints may still exist. That would conflict with the user-facing workflow and increase the chance rename fields are reintroduced.

## Risks / Trade-offs

- Settings modal overlap with existing metadata dialogs -> Reuse existing modal state where possible and add tests for one modal per scope.
- Concept update API remains available internally -> Keep the scope of this change to frontend workflow and docs; do not remove backend compatibility unless a later backend cleanup is requested.
- Removing shortcut cards could remove useful status content accidentally -> Tests should assert management/status content remains while duplicate action-only surfaces are gone.
- Mind Map active state may conflict with explicit child routes -> Centralize the active-state rule so overview means Mind Map and explicit child routes win.
