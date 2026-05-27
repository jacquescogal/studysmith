## Why

Module, Note Group, and Concept pages currently spend the right rail on an "On this page" navigation sidebar while the primary study actions are spread across cards and page sections. Replacing that rail with a compact interaction dock makes the page-level actions easier to find and keeps in-page navigation focused on the current scope.

## What Changes

- Remove the "On this page" navigational sidebar from Module, Note Group, and Concept pages.
- Introduce a right-side interaction dock for in-page navigation and scope actions.
- Move Mind Map entry points and card-table entry points into the dock instead of using separate action cards below the Mind Map area.
- Add dock actions for:
  - Mind Map, navigating by route for the current Module, Note Group, or Concept.
  - View Cards, navigating by route and scoped to the current Module, Note Group, or Concept using the existing View Cards table experience.
  - Study, only for Note Group pages for now, showing source/study reading inline on the page instead of in a modal.
  - Review, showing the due-now count, a `Review Due` action, and a slider for choosing the Review count from 1 through the available card count.
- Replace the current chat dialog entry with a floating bottom-right chat bubble that opens the existing Tutor Chat modal.
- Keep Tutor Chat context scoped to the current page: Module chat searches Module cards, Note Group chat searches Note Group cards, and Concept chat searches directly associated Concept cards.
- Preserve canonical user-facing terminology: Module, Note Group, Concept, Mind Map, View Cards, Study, Review, and Tutor Chat. Within the Note Group Study page, use user-facing labels `Source Text` and `Derived Study Cards` for the existing source and generated-study reading modes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `frontend-route-architecture`: Route pages change their right-side page chrome from section navigation to an interaction dock, move key route actions into that dock, render Note Group study content inline, and expose Tutor Chat through a floating scoped chat bubble.

## Impact

- Affected frontend route/page components for Module, Note Group, and Concept pages.
- Affected shared layout components currently rendering the right-side "On this page" sidebar.
- Affected route page models/actions for Mind Map, View Cards, Study, Review, and Tutor Chat entry points.
- Affected tests for route rendering, scope-specific View Cards routing, Review entry behavior, Note Group study content rendering, and scoped Tutor Chat behavior.
- No backend API changes are intended; existing Mind Map, card table, Review, Cleaned Text / Formatted Text, and Tutor Chat APIs should be reused where possible.
