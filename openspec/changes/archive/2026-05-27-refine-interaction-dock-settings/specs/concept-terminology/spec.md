## ADDED Requirements

### Requirement: Concept settings omit rename and description editing
The system SHALL keep Concept settings focused on delete and regeneration actions and SHALL NOT expose Concept rename or Concept description editing from the Concept page settings workflow.

#### Scenario: Concept settings actions
- **WHEN** a user opens settings for a Concept page
- **THEN** the settings workflow exposes delete Concept and regenerate Concept actions

#### Scenario: Concept rename is not offered in settings
- **WHEN** a user opens settings for a Concept page
- **THEN** the settings workflow does not offer a Concept rename action

#### Scenario: Concept description editing is not offered in settings
- **WHEN** a user opens settings for a Concept page
- **THEN** the settings workflow does not offer Concept description editing

#### Scenario: Concept terminology remains canonical
- **WHEN** Concept settings labels, confirmations, or errors render
- **THEN** they use Concept terminology instead of Topic terminology
