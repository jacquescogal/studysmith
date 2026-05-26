## MODIFIED Requirements

### Requirement: Tutor Chat state is scoped to active context
The frontend SHALL scope Tutor Chat messages, card lookups, and request context to the active Module, Note Group, or Concept context.

#### Scenario: Open Tutor Chat in Module context
- **WHEN** a user opens Tutor Chat from a Module page
- **THEN** the chat request includes Module context and does not include Note Group or Concept context

#### Scenario: Open Tutor Chat in Note Group context
- **WHEN** a user opens Tutor Chat from a Note Group page
- **THEN** the chat request includes Module and Note Group context

#### Scenario: Open Tutor Chat in Concept context
- **WHEN** a user opens Tutor Chat from a Concept page
- **THEN** the chat request includes Module and Concept context

#### Scenario: Tutor Chat context changes
- **WHEN** the active Module, Note Group, or Concept route context changes
- **THEN** Tutor Chat messages, card lookup state, loading state, and errors reset for the new active context

### Requirement: App entry remains thin
The frontend SHALL keep `App.jsx` limited to app-level composition after the refactor.

#### Scenario: App entry responsibilities
- **WHEN** a developer opens `frontend/src/App.jsx`
- **THEN** the file primarily defines providers, the route tree, shell-level concerns, global dialogs, toasts, and auth/admin app-shell concerns

#### Scenario: Feature ownership outside App
- **WHEN** a developer changes Module, Note Group, Concept, Review, Tutor Chat, Auto Workflow, card editing, metadata editing, or source-reading behavior
- **THEN** the primary implementation lives in focused route, page, or hook modules instead of `frontend/src/App.jsx`

#### Scenario: Route state ownership outside App
- **WHEN** a route page needs the active Subject, Module, Note Group, or Concept
- **THEN** the route layout or route page resolves and owns that entity context without requiring top-level selected entity state in `frontend/src/App.jsx`

## ADDED Requirements

### Requirement: Route pages own workflow actions
The frontend SHALL keep route-scoped workflow actions in the nearest owning page, layout, or hook instead of passing large bridge prop surfaces from `App.jsx`.

#### Scenario: Note Group workflow actions
- **WHEN** a developer changes Note Group metadata editing, deletion, source reading, Study Card editing, Question Card editing, or Question Card generation
- **THEN** the primary state and action handlers live in Note Group page or hook modules

#### Scenario: Concept workflow actions
- **WHEN** a developer changes Concept metadata editing, deletion, Knowledge Node regeneration, Concept Study Cards, or Concept Question Cards
- **THEN** the primary state and action handlers live in Concept page or hook modules

#### Scenario: Module workflow actions
- **WHEN** a developer changes Module settings, deletion, Concept filters, Note Group ordering, Module Mind Map, or Auto Workflow display
- **THEN** the primary state and action handlers live in Module page or hook modules

#### Scenario: App bridge props reduced
- **WHEN** route pages render after this change
- **THEN** `App.jsx` does not construct large page-specific prop objects for Module, Note Group, or Concept pages
