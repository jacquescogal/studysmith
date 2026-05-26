## MODIFIED Requirements

### Requirement: App entry remains thin
The frontend SHALL keep `App.jsx` and the app-shell entry limited to app-level composition after the refactor.

#### Scenario: App entry responsibilities
- **WHEN** a developer opens `frontend/src/App.jsx` or the app-shell entry module it renders
- **THEN** the file primarily defines providers, the route tree, shell-level concerns, global dialogs, toasts, and auth/admin app-shell concerns

#### Scenario: Feature ownership outside App
- **WHEN** a developer changes Module, Note Group, Concept, Review, Tutor Chat, Auto Workflow, card editing, metadata editing, or source-reading behavior
- **THEN** the primary implementation lives in focused route, page, hook, or feature modules instead of `frontend/src/App.jsx` or a centralized app-shell controller

#### Scenario: Route state ownership outside App
- **WHEN** a route page needs the active Subject, Module, Note Group, or Concept
- **THEN** the route layout or route page resolves and owns that entity context without requiring top-level selected entity state in `frontend/src/App.jsx` or a centralized app-shell controller

### Requirement: Route pages own workflow actions
The frontend SHALL keep route-scoped workflow actions in the nearest owning page, layout, or hook instead of passing large bridge prop surfaces from `App.jsx` or an app-shell controller.

#### Scenario: Note Group workflow actions
- **WHEN** a developer changes Note Group metadata editing, deletion, source reading, Study Card editing, Question Card editing, or Question Card generation
- **THEN** the primary state and action handlers live in Note Group page or hook modules

#### Scenario: Concept workflow actions
- **WHEN** a developer changes Concept metadata editing, deletion, Knowledge Node regeneration, Concept Study Cards, or Concept Question Cards
- **THEN** the primary state and action handlers live in Concept page or hook modules

#### Scenario: Module workflow actions
- **WHEN** a developer changes Module settings, deletion, Concept filters, Note Group ordering, Module Mind Map, or Auto Workflow display
- **THEN** the primary state and action handlers live in Module page or hook modules

#### Scenario: App bridge props removed
- **WHEN** route pages render after this change
- **THEN** `App.jsx` and the app-shell entry do not construct large page-specific prop objects for Module, Note Group, or Concept pages

## ADDED Requirements

### Requirement: Route pages own page models
The frontend SHALL build Module, Note Group, and Concept page models inside the nearest owning route page, route layout, or page hook.

#### Scenario: Module page model ownership
- **WHEN** a Module page renders
- **THEN** Module page data, loading state, error state, derived view state, and Module actions are assembled by Module-owned route/page logic rather than by the app shell

#### Scenario: Note Group page model ownership
- **WHEN** a Note Group page renders
- **THEN** Note Group page data, loading state, error state, derived view state, and Note Group actions are assembled by Note Group-owned route/page logic rather than by the app shell

#### Scenario: Concept page model ownership
- **WHEN** a Concept page renders
- **THEN** Concept page data, loading state, error state, derived view state, and Concept actions are assembled by Concept-owned route/page logic rather than by the app shell

#### Scenario: Route context consumption
- **WHEN** a route page needs active Subject, Module, Note Group, or Concept context for its page model
- **THEN** it consumes the nearest route context or route-owned hook directly instead of receiving that context through an app-shell bridge prop

#### Scenario: Page model hook naming
- **WHEN** a route page model hook is introduced or replaces an existing page state hook
- **THEN** the hook uses the `use<Scope>PageModel` naming pattern for Module, Note Group, and Concept page models

### Requirement: Active app-shell modules use descriptive names
The frontend SHALL use descriptive production names for active app-shell modules and MUST NOT keep `LegacyApp.jsx` as the production app-shell implementation.

#### Scenario: Legacy app file removed
- **WHEN** the app-shell extraction is complete
- **THEN** `frontend/src/features/app-shell/LegacyApp.jsx` no longer exists as an active production module

#### Scenario: Replacement names describe ownership
- **WHEN** a developer opens the replacement app-shell files
- **THEN** their filenames describe stable responsibilities such as app-shell composition, authenticated shell behavior, route composition, or global dialogs

### Requirement: Frontend JavaScript and JSX source files stay under size ceiling
The frontend SHALL keep maintained frontend `.js` and `.jsx` source files at or below 1000 lines.

#### Scenario: Source file size guardrail
- **WHEN** frontend verification runs
- **THEN** it fails if a maintained frontend `.js` or `.jsx` source file exceeds 1000 lines

#### Scenario: Legacy app size eliminated
- **WHEN** `frontend/src/features/app-shell/LegacyApp.jsx` has been removed or replaced
- **THEN** no replacement app-shell, route page, page model, or workflow `.js` or `.jsx` module exceeds 1000 lines
