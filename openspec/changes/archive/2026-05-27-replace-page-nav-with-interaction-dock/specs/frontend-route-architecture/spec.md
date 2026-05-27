## ADDED Requirements

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
The frontend SHALL remove or reduce route content cards and shortcut sections whose only purpose is to duplicate Mind Map, View Cards, Study, Review, or Tutor Chat entry points now owned by the interaction dock or floating chat bubble.

#### Scenario: Overview actions do not duplicate dock actions
- **WHEN** a Module, Note Group, or Concept overview renders with the interaction dock
- **THEN** the overview does not render duplicate primary buttons for Mind Map, View Cards, Study, Review, or Tutor Chat

#### Scenario: Existing management actions remain available
- **WHEN** shortcut surfaces are removed
- **THEN** management actions such as settings, metadata editing, deletion, generation repair, and Knowledge Node regeneration remain available in the appropriate route content area

#### Scenario: Canonical labels are preserved
- **WHEN** dock actions, floating chat UI, and route content labels render
- **THEN** they use the canonical labels Module, Note Group, Concept, Mind Map, View Cards, Study, Review, Tutor Chat, Source Text, and Derived Study Cards
