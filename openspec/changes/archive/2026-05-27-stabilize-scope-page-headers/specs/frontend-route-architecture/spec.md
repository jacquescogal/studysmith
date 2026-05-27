## ADDED Requirements

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
