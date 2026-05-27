## ADDED Requirements

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

## MODIFIED Requirements

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
