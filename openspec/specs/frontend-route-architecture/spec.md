# frontend-route-architecture Specification

## Purpose
TBD - created by archiving change refactor-frontend-architecture. Update Purpose after archive.
## Requirements
### Requirement: Nested frontend route boundaries
The frontend SHALL define explicit nested route boundaries for Subject, Module, Note Group, and Concept views.

#### Scenario: Subject index route
- **WHEN** a user visits `/`
- **THEN** the frontend renders the Subject index page without requiring a selected Module, Note Group, or Concept in top-level app state

#### Scenario: Module overview route
- **WHEN** a user visits `/app/subject/:subjectCode/module/:moduleCode`
- **THEN** the frontend renders the Module overview page for the resolved Subject and Module

#### Scenario: Note Group overview route
- **WHEN** a user visits `/app/subject/:subjectCode/module/:moduleCode/note-groups/:noteGroupCode`
- **THEN** the frontend renders the Note Group overview page for the resolved Subject, Module, and Note Group

#### Scenario: Concept overview route
- **WHEN** a user visits `/app/subject/:subjectCode/module/:moduleCode/concepts/:conceptCode`
- **THEN** the frontend renders the Concept overview page for the resolved Subject, Module, and Concept

### Requirement: Existing deep links remain valid
The frontend SHALL preserve current deep-link behavior for all existing Subject, Module, Note Group, Concept, Mind Map, View Cards, Study Cards, and Question Cards URLs.

#### Scenario: Existing route resolves after refactor
- **WHEN** a user opens an existing deep link that worked before the refactor
- **THEN** the frontend resolves the route to the same user-facing page behavior after the refactor

#### Scenario: Route restore failure
- **WHEN** a deep link cannot be resolved by the API
- **THEN** the frontend displays an error state equivalent to the current route restoration failure behavior

### Requirement: Route-scoped entity resolution
The frontend SHALL resolve Short Code based Subject, Module, Note Group, and Concept route params at the nearest route/page boundary that owns the corresponding context.

#### Scenario: Module context resolves once for child pages
- **WHEN** a user visits a Module child route
- **THEN** the Module route boundary resolves the Subject and Module context for child pages to consume

#### Scenario: Note Group context resolves for Note Group pages
- **WHEN** a user visits a Note Group route
- **THEN** the Note Group route boundary resolves the Note Group context without relying on a top-level selected Note Group state machine

#### Scenario: Concept context resolves for Concept pages
- **WHEN** a user visits a Concept route
- **THEN** the Concept route boundary resolves the Concept context without relying on a top-level selected Concept state machine

### Requirement: Server state is loaded near route consumers
The frontend SHALL load server-owned data through focused hooks or page containers close to the route that consumes the data.

#### Scenario: Module overview data
- **WHEN** the Module overview page renders
- **THEN** Module overview data, Note Groups, Module statistics, and Module Question Card timeline data are loaded by Module-scoped page logic

#### Scenario: Note Group data
- **WHEN** a Note Group page renders
- **THEN** Note Group details, Study Cards, Question Cards, Cleaned Text, Formatted Text, progress, and Mind Map data are loaded by Note Group-scoped page logic as needed

#### Scenario: Concept data
- **WHEN** a Concept page renders
- **THEN** Concept details, Concept Study Cards, Concept Question Cards, and Concept Mind Map data are loaded by Concept-scoped page logic as needed

### Requirement: Auto Workflow state is Module-scoped
The frontend SHALL scope Auto Workflow stream state to the active Module.

#### Scenario: Auto Workflow stream for selected Module
- **WHEN** a maintainer opens a Module with active Note Group generation jobs
- **THEN** the frontend subscribes to Auto Workflow updates for that Module and exposes the visible generation jobs to Module and Note Group pages

#### Scenario: Auto Workflow resets on Module change
- **WHEN** the active Module route changes
- **THEN** the frontend clears the previous Module's Auto Workflow stream state and connects to the new Module context only when permitted

### Requirement: Review state is isolated from unrelated page state
The frontend SHALL isolate Review session state from Subject, Module, Note Group, Concept, and page rendering state.

#### Scenario: Start Review session
- **WHEN** a user starts a Review session from a Module, Note Group, or Concept page
- **THEN** the frontend opens the Review session using the selected Review scope without requiring unrelated page state to be reset

#### Scenario: End Review session
- **WHEN** a Review session ends
- **THEN** the frontend refreshes affected Review-related server state without resetting unrelated route context

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

### Requirement: Module workspace shell persists across child routes
The frontend SHALL mount Module workspace chrome at the Module route boundary so the left Context Sidebar and shared Module workspace overlays remain stable while navigating among child routes inside the same Module.

#### Scenario: Sidebar remains mounted across Module child navigation
- **WHEN** a user navigates from a Module overview route to a Note Group or Concept route within the same Module
- **THEN** the Context Sidebar remains mounted and only the route content region changes

#### Scenario: Sidebar local state persists within a Module
- **WHEN** a user changes sidebar-local state such as search text, selected Browse tab, or scroll position and then navigates to another child route in the same Module
- **THEN** the sidebar preserves that local state unless the user changes the active Module

#### Scenario: Module change resets Module workspace chrome
- **WHEN** a user navigates to a different Module
- **THEN** the Module workspace shell refreshes its Module-scoped data and may reset sidebar-local state for the new Module

#### Scenario: Right-side route content owns page changes
- **WHEN** a user navigates among Module overview, Note Group, Concept, Study Card, Question Card, Mind Map, and create Note Group routes inside the same Module
- **THEN** the route content region renders the new page without remounting the Module workspace sidebar

#### Scenario: Deep links render persistent workspace shell
- **WHEN** a user opens a deep link to a Note Group or Concept child route
- **THEN** the frontend renders the Module workspace shell once for the resolved Module and renders the child route content beneath it

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

### Requirement: Canonical terminology at frontend boundaries
The frontend SHALL preserve canonical project terminology while introducing new route, page, and hook modules.

#### Scenario: Concept terminology in new frontend code
- **WHEN** new route, page, hook, component, test, or user-facing text is introduced for conceptual scopes
- **THEN** it uses Concept terminology unless directly adapting a legacy backend/API `TopicChip` field

#### Scenario: Legacy API adapter boundary
- **WHEN** frontend code must consume legacy topic-named API fields
- **THEN** topic-named details are contained at the API or hook adapter boundary where practical
