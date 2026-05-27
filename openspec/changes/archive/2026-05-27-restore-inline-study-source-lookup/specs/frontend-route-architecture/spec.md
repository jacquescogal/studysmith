## MODIFIED Requirements

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
