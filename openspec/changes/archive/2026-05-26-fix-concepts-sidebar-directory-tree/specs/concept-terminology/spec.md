## ADDED Requirements

### Requirement: Concept sidebar directory navigation
The system SHALL render the Concepts sidebar as a directory-style view of the module's single-parent Concept Tree when the sidebar is in Concepts mode and no Concept search is active.

#### Scenario: Root Concepts at module level
- **WHEN** a user opens the Concepts sidebar for a module without a selected Concept
- **THEN** the sidebar lists only root Concepts for that module

#### Scenario: Selected Concept directory level
- **WHEN** a user selects a Concept from the Concepts sidebar
- **THEN** the sidebar shows an up/back row, the selected Concept row, and that Concept's immediate child Concepts

#### Scenario: Child Concept navigation
- **WHEN** a user selects a child Concept in the Concepts sidebar
- **THEN** the sidebar enters that child Concept's directory level and lists that child's immediate child Concepts

#### Scenario: Up from child Concept
- **WHEN** a user selects the up/back row from a child Concept directory level
- **THEN** the sidebar returns to the parent Concept directory level

#### Scenario: Up from root Concept
- **WHEN** a user selects the up/back row from a root Concept directory level
- **THEN** the app navigates to the module page and keeps the sidebar in Concepts mode

#### Scenario: Active row styling
- **WHEN** the Concepts sidebar is showing an up/back row and a selected Concept row
- **THEN** only the selected Concept row is styled as active

#### Scenario: Concept search mode
- **WHEN** a user searches in the Concepts sidebar
- **THEN** the sidebar may show a flat filtered list of matching Concepts without changing the current Concept directory level

#### Scenario: Search cleared
- **WHEN** a user clears Concept search
- **THEN** the sidebar restores the directory level for the currently selected Concept, or the root Concepts if no Concept is selected
