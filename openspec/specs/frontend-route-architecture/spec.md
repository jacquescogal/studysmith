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

### Requirement: Scope page headers remain durable and visually distinct
The frontend SHALL render Module, Note Group, and Concept page headers with stable layout regions and distinct scope tone treatments that remain durable when titles are long.

#### Scenario: Long title does not displace actions
- **WHEN** a Module, Note Group, or Concept page header renders with a long title and right-side actions
- **THEN** the title wraps or truncates within the title region without pushing the action controls out of their intended region

#### Scenario: Type chip stays predictably positioned
- **WHEN** a Module, Note Group, or Concept title wraps across multiple lines
- **THEN** the page type chip remains in a predictable metadata row rather than being rearranged by title wrapping

#### Scenario: Scope tones differentiate headers beyond chip
- **WHEN** a user navigates between Module, Note Group, and Concept pages
- **THEN** each scope header displays a distinct tone treatment beyond the type chip alone

#### Scenario: Responsive header remains readable
- **WHEN** the page header renders on narrow viewports
- **THEN** breadcrumbs, type chip, title, and actions remain readable without overlapping or overflowing their container

#### Scenario: Canonical scope labels are preserved
- **WHEN** scope header labels are rendered
- **THEN** they use the canonical labels Module, Note Group, and Concept

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

### Requirement: Module workspace pages use an interaction dock instead of section navigation
The frontend SHALL replace the right-side "On this page" navigation sidebar with a scope-aware interaction dock on Module, Note Group, and Concept workspace pages.

#### Scenario: Module page renders interaction dock
- **WHEN** a user opens a Module overview page
- **THEN** the right-side page chrome renders an interaction dock instead of an "On this page" navigation sidebar

#### Scenario: Note Group page renders interaction dock
- **WHEN** a user opens a Note Group page
- **THEN** the right-side page chrome renders an interaction dock instead of an "On this page" navigation sidebar

#### Scenario: Concept page renders interaction dock
- **WHEN** a user opens a Concept page
- **THEN** the right-side page chrome renders an interaction dock instead of an "On this page" navigation sidebar

#### Scenario: Non-workspace pages keep existing section navigation where applicable
- **WHEN** a user opens pages outside the Module, Note Group, and Concept workspace scopes
- **THEN** the frontend does not require those pages to use the interaction dock

### Requirement: Interaction dock exposes scope learning actions
The frontend SHALL expose Mind Map, View Cards, Study where applicable, and Review actions through the interaction dock using the current Module, Note Group, or Concept scope.

#### Scenario: Module dock actions
- **WHEN** a user opens a Module page
- **THEN** the dock provides Mind Map, View Cards, and Review actions scoped to the current Module

#### Scenario: Note Group dock actions
- **WHEN** a user opens a Note Group page
- **THEN** the dock provides Mind Map, View Cards, Study, and Review actions scoped to the current Note Group

#### Scenario: Concept dock actions
- **WHEN** a user opens a Concept page
- **THEN** the dock provides Mind Map, View Cards, and Review actions scoped to the current Concept

#### Scenario: Study omitted outside Note Group scope
- **WHEN** a user opens a Module or Concept page
- **THEN** the dock does not render a Study action

#### Scenario: Review dock shows due count and review options
- **WHEN** the dock renders a Review action for a Module, Note Group, or Concept
- **THEN** it displays the due-now count, provides a `Review Due` action, and provides a slider for choosing a Review count from 1 through the available card count

#### Scenario: Mind Map dock action uses routes
- **WHEN** a user selects Mind Map from a Module, Note Group, or Concept dock
- **THEN** the frontend navigates to the current scope's Mind Map route

### Requirement: Interaction dock defaults to Mind Map on scope overview routes
The frontend SHALL treat Mind Map as the default selected interaction dock action for Module, Note Group, and Concept overview routes.

#### Scenario: Module overview defaults to Mind Map
- **WHEN** a user opens a Module overview route without a more specific child route selected
- **THEN** the Module interaction dock marks Mind Map as the selected action

#### Scenario: Note Group overview defaults to Mind Map
- **WHEN** a user opens a Note Group overview route without a more specific child route selected
- **THEN** the Note Group interaction dock marks Mind Map as the selected action

#### Scenario: Concept overview defaults to Mind Map
- **WHEN** a user opens a Concept overview route without a more specific child route selected
- **THEN** the Concept interaction dock marks Mind Map as the selected action

#### Scenario: Explicit dock routes override default
- **WHEN** a user opens View Cards, Study, Study Cards, or Question Cards route content for a scope
- **THEN** the interaction dock does not keep Mind Map selected merely because Mind Map is the default overview action

### Requirement: Interaction dock exposes scope settings
The frontend SHALL expose scope settings from a gear icon button in the interaction dock for Module, Note Group, and Concept workspace pages.

#### Scenario: Module settings opens from dock
- **WHEN** a user selects the settings gear from a Module interaction dock
- **THEN** the frontend opens the Module settings modal for the current Module

#### Scenario: Note Group settings opens from dock
- **WHEN** a user selects the settings gear from a Note Group interaction dock
- **THEN** the frontend opens the Note Group settings modal for the current Note Group

#### Scenario: Concept settings opens from dock
- **WHEN** a user selects the settings gear from a Concept interaction dock
- **THEN** the frontend opens the Concept settings modal for the current Concept

#### Scenario: Settings uses icon button treatment
- **WHEN** the interaction dock renders a settings entry
- **THEN** the settings entry is a gear icon button with an accessible scope-specific settings label rather than a full learning-action row

#### Scenario: Settings respects manage permissions
- **WHEN** the current user cannot manage the selected Subject or cannot use protected actions
- **THEN** scope settings actions are disabled or unavailable consistently with existing management controls

### Requirement: Scope settings modals expose permitted management actions
The frontend SHALL render scope-specific settings modals with only the management actions allowed for the current Module, Note Group, or Concept workflow.

#### Scenario: Module settings includes delete Module
- **WHEN** a user opens Module settings from the dock
- **THEN** the existing Module settings modal includes the standard Module metadata controls and a delete Module action

#### Scenario: Note Group settings includes title rename and delete
- **WHEN** a user opens Note Group settings from the dock
- **THEN** the modal lets the user rename the Note Group title and delete the Note Group

#### Scenario: Concept settings includes delete and regenerate only
- **WHEN** a user opens Concept settings from the dock
- **THEN** the modal offers delete Concept and regenerate Concept actions only

#### Scenario: Concept settings omits rename and description editing
- **WHEN** a user opens Concept settings from the dock
- **THEN** the modal does not render Concept title or Concept description editing controls

### Requirement: View Cards dock action opens scoped card table
The frontend SHALL make the dock View Cards action navigate to the existing View Cards table experience for the active scope.

#### Scenario: Module View Cards scope
- **WHEN** a user selects View Cards from a Module dock
- **THEN** the frontend navigates to a Module-scoped View Cards route that shows the View Cards table for all cards belonging to the current Module

#### Scenario: Note Group View Cards scope
- **WHEN** a user selects View Cards from a Note Group dock
- **THEN** the frontend navigates to the Note Group View Cards route and shows the View Cards table for cards belonging to the current Note Group

#### Scenario: Concept View Cards scope
- **WHEN** a user selects View Cards from a Concept dock
- **THEN** the frontend navigates to the Concept View Cards route and shows the View Cards table for cards directly associated with the current Concept

#### Scenario: View Cards table preserves editing behavior
- **WHEN** the scoped View Cards table renders from a dock action
- **THEN** existing card viewing and permitted editing behavior remains available for that scope

### Requirement: Note Group Study renders inline
The frontend SHALL render Note Group Study content inline in the route content when selected from the dock instead of opening the study reading content in a modal.

#### Scenario: Note Group Study action opens inline content
- **WHEN** a user selects Study from a Note Group dock
- **THEN** the route content displays the Note Group study content inline on the page

#### Scenario: Study content uses available reading source
- **WHEN** a Note Group has Cleaned Text or Formatted Text available
- **THEN** the inline Study page renders the available study reading content using the existing content derivation rules

#### Scenario: Study page uses friendly reading labels
- **WHEN** the inline Study page renders source-preserving content or study-card-derived formatted content
- **THEN** the UI labels those modes as `Source Text` and `Derived Study Cards`

#### Scenario: Study action disabled when content is unavailable
- **WHEN** a Note Group does not have study reading content available
- **THEN** the dock Study action is disabled or communicates that Study content is unavailable

#### Scenario: Derived Study Card source lookup opens Source Text
- **WHEN** a user selects the magnifying-glass source lookup control on a Derived Study Card section
- **THEN** the inline Study page switches to Source Text, pins that Study Card, scrolls to a source range for that Study Card, and highlights its source ranges

#### Scenario: Source lookup is disabled without ranges
- **WHEN** a Derived Study Card has no valid Source Text ranges
- **THEN** its magnifying-glass source lookup control is disabled

#### Scenario: Inline Source Text reuses reading highlights
- **WHEN** Source Text renders in inline Note Group Study with a pinned Study Card
- **THEN** Source Text uses the existing reading highlight state instead of rendering without highlights

#### Scenario: Multiple source ranges are navigable
- **WHEN** the pinned Study Card has multiple source ranges in Source Text
- **THEN** the inline Study page displays floating controls showing the current source range as `x of n` and lets the user move up and down through the ranges with wrapping navigation

#### Scenario: Active and related source ranges are visually distinct
- **WHEN** Source Text displays source ranges for a pinned Study Card
- **THEN** the active source range is highlighted blue, other ranges for the same pinned Study Card are highlighted green, and outside Source Text remains visually de-emphasized

#### Scenario: Pinned Study Card remains visible during source lookup
- **WHEN** a Study Card is pinned from Derived Study Cards or Source Text source navigation
- **THEN** a floating bottom-right panel displays the pinned Study Card title and a short clipped body beside the source navigation controls

#### Scenario: Full pinned Study Card content is available
- **WHEN** a user hovers over the pinned Study Card floating panel
- **THEN** the inline Study page shows the full pinned Study Card content in a popover

#### Scenario: Unpin clears Source Text highlighting
- **WHEN** a user selects the unpin control for the pinned Study Card
- **THEN** the inline Study page clears the pinned Study Card, removes Source Text highlights, and displays regular Source Text

#### Scenario: Back returns to Derived Study Cards
- **WHEN** a user selects the back control during Source Text source lookup
- **THEN** the inline Study page switches back to Derived Study Cards

#### Scenario: Source lookup does not require removed reading sidebar
- **WHEN** a user navigates from a Derived Study Card to Source Text in inline Study
- **THEN** the workflow completes without requiring the removed reading navigation sidebar

### Requirement: Tutor Chat uses a floating scoped bubble
The frontend SHALL expose Tutor Chat through a floating bottom-right bubble on Module, Note Group, and Concept pages instead of page-card action buttons, and opening the bubble SHALL display the existing Tutor Chat modal.

#### Scenario: Floating chat bubble opens Tutor Chat
- **WHEN** a user clicks the floating Tutor Chat bubble
- **THEN** the frontend opens the Tutor Chat modal for the current page scope

#### Scenario: Module Tutor Chat scope
- **WHEN** a user opens Tutor Chat from a Module page
- **THEN** Tutor Chat uses Module context and can retrieve cards across the current Module

#### Scenario: Note Group Tutor Chat scope
- **WHEN** a user opens Tutor Chat from a Note Group page
- **THEN** Tutor Chat uses Note Group context and can retrieve cards for the current Note Group

#### Scenario: Concept Tutor Chat scope
- **WHEN** a user opens Tutor Chat from a Concept page
- **THEN** Tutor Chat uses Concept context and can retrieve cards directly associated with the current Concept

#### Scenario: Floating chat avoids dock overlap
- **WHEN** the floating Tutor Chat bubble renders with the interaction dock on desktop or narrow viewports
- **THEN** the chat bubble remains accessible without obscuring dock actions

### Requirement: Dock migration removes duplicate shortcut surfaces
The frontend SHALL remove or reduce route content cards and shortcut sections whose only purpose is to duplicate Mind Map, View Cards, Study, Review, Tutor Chat, or scope settings entry points now owned by the interaction dock or floating chat bubble.

#### Scenario: Overview actions do not duplicate dock actions
- **WHEN** a Module, Note Group, or Concept overview renders with the interaction dock
- **THEN** the overview does not render duplicate primary buttons for Mind Map, View Cards, Study, Review, Tutor Chat, or settings

#### Scenario: Cards below Mind Map do not duplicate dock actions
- **WHEN** Mind Map content renders for a Module, Note Group, or Concept scope
- **THEN** card-style shortcut sections below the Mind Map do not duplicate actions already available in the dock or floating Tutor Chat bubble

#### Scenario: Existing management actions remain available
- **WHEN** shortcut surfaces are removed
- **THEN** management actions such as Module settings, Note Group title rename, deletion, generation repair, and Knowledge Node regeneration remain available in the appropriate dock settings modal or route content area

#### Scenario: Canonical labels are preserved
- **WHEN** dock actions, floating chat UI, settings modal UI, and route content labels render
- **THEN** they use the canonical labels Module, Note Group, Concept, Mind Map, View Cards, Study, Review, Tutor Chat, Source Text, and Derived Study Cards
