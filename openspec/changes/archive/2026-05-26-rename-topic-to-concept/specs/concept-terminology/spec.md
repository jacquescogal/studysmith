## ADDED Requirements

### Requirement: Canonical Concept terminology
The system SHALL use `Concept` as the canonical user-facing term for reusable module-owned intermediary knowledge scopes.

#### Scenario: Lexicon defines Concept
- **WHEN** a developer reads the project lexicon
- **THEN** the lexicon defines Concept as the reusable module-owned intermediary scope that can contain child Concepts, Knowledge Nodes, and Study Cards

#### Scenario: UI uses Concept language
- **WHEN** a user views navigation, page headers, mind maps, generation workflow text, buttons, menus, or errors for conceptual scopes
- **THEN** the UI uses Concept or Concepts instead of Topic or Topics

### Requirement: Concept Tree hierarchy
The system SHALL model concept hierarchy as a single-parent Concept Tree within each module.

#### Scenario: Root Concept
- **WHEN** a Concept has no parent Concept
- **THEN** the system treats it as a root Concept in that module's Concept Tree

#### Scenario: Child Concept
- **WHEN** a Concept has a parent Concept
- **THEN** the system treats it as a child of exactly one strongest parent Concept

#### Scenario: No Concept DAG
- **WHEN** a Concept relates to another Concept outside its parent chain
- **THEN** the system represents that as a graph relationship rather than a second parent

### Requirement: Knowledge Nodes remain leaf nodes
The system SHALL keep `Knowledge Node` as the canonical term for typed leaf knowledge under a Concept.

#### Scenario: Knowledge Node under Concept
- **WHEN** a Concept has definition, mechanism, rule, or fact knowledge
- **THEN** the system represents that knowledge as Knowledge Nodes under the Concept

#### Scenario: Knowledge Node is not renamed to Concept
- **WHEN** UI, prompts, schemas, or tests refer to typed leaf knowledge
- **THEN** they use Knowledge Node or the specific Knowledge Type rather than Concept

### Requirement: Study Cards attach to Concepts
The system SHALL attach Study Cards primarily to the deepest relevant Concept.

#### Scenario: Study Card Concept link
- **WHEN** a Study Card is generated or promoted from a generation draft
- **THEN** the system links it to at least one Concept, preferring the deepest relevant Concept

#### Scenario: Concept review scope
- **WHEN** a user opens a Concept page or Concept review scope
- **THEN** the system lists Study Cards and Question Cards associated with that Concept across the module

### Requirement: Concept routes and API compatibility
The system SHALL provide Concept-named API and frontend route helpers while preserving legacy topic routes during the transition.

#### Scenario: Concept route works
- **WHEN** a client requests Concept-scoped resources through a Concept-named route
- **THEN** the system returns the same conceptual scope data previously returned by the equivalent topic route

#### Scenario: Legacy topic route remains available
- **WHEN** a client requests the existing topic route during the compatibility window
- **THEN** the system serves the request without changing existing data semantics

#### Scenario: Frontend uses Concept helpers
- **WHEN** frontend code navigates to, fetches, updates, deletes, or regenerates knowledge for conceptual scopes
- **THEN** it uses Concept-named helper functions in new code

### Requirement: Existing storage remains compatible
The system SHALL continue to read and write existing topic-named database tables and columns until a separate storage migration is implemented.

#### Scenario: Existing data remains readable
- **WHEN** the app starts with data stored in legacy topic-named tables
- **THEN** Concept pages, Concept sidebars, Concept mind maps, and generation workflows continue to load that data

#### Scenario: Existing data remains writable
- **WHEN** the system creates, updates, links, or deletes Concepts during this transition
- **THEN** it persists changes to the existing storage without requiring a table rename

### Requirement: Generation uses Concept language
The system SHALL use Concept terminology in generation prompts, stage labels, logs, and status messages.

#### Scenario: Concept Tree generation prompt
- **WHEN** the system asks the LLM to derive conceptual scopes from Study Cards
- **THEN** the prompt asks for a Concept Tree and Study Card Concept links

#### Scenario: Concept Knowledge Node generation prompt
- **WHEN** the system asks the LLM to reconcile Knowledge Nodes
- **THEN** the prompt describes the selected Concept, child Concept definitions, and connected Study Cards

#### Scenario: Generation status labels
- **WHEN** a user views note group generation progress
- **THEN** stages and logs use Concept terminology instead of Topic terminology

### Requirement: Mind maps use Concept terminology
The system SHALL render module, note-group, and Concept-focused mind maps with Concept terminology for intermediary nodes.

#### Scenario: Module mind map
- **WHEN** a user views a module mind map
- **THEN** the root is the Module and intermediary nodes are Concepts

#### Scenario: Note-group mind map
- **WHEN** a user views a note-group mind map
- **THEN** the root is the Note Group and visible Concept Tree is filtered to Concepts supported by that Note Group

#### Scenario: Concept mind map
- **WHEN** a user views a Concept-focused mind map
- **THEN** the current Concept is the center scope, parent and child Concept cards use Concept behavior, Knowledge Nodes remain leaf knowledge, and Study Cards remain content artifacts
