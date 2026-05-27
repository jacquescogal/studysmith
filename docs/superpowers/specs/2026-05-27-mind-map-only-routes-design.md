# Mind Map Only Routes Design

## Goal

Module, Note Group, and Concept scope pages should no longer have an Overview route. The default scope view should be the Mind Map, and Mind Map routes should render only the Mind Map surface with no cards or sections underneath.

## Terminology

This change uses the project lexicon terms: Module, Note Group, Concept, Mind Map, Study Card, and Question Card. It does not introduce new user-facing terminology.

## Route Behavior

- Module default routes resolve to the Module Mind Map view.
- Note Group default routes resolve to the Note Group Mind Map view.
- Concept default routes resolve to the Concept Mind Map view.
- Old overview-style route state should not produce an Overview screen. If existing route parsing yields an empty or overview panel, the page should behave as `mind-map`.
- Explicit non-overview routes remain available where they already exist: View Cards, Study, and Question Cards/review flows.

## Rendering Behavior

Mind Map routes are terminal views:

- Module Mind Map renders only the Module `MindMapPanel` inside its Mind Map container.
- Note Group Mind Map renders only the Note Group `MindMapPanel` inside its Mind Map container.
- Concept Mind Map renders only the Concept `MindMapPanel` inside its Mind Map container.
- No content should render underneath the Mind Map on these routes. This includes stats cards, progress cards, generation sections, Study Card lists, Question Card lists, and management or overview sections.

Non-Mind Map routes continue to render their existing route-specific content.

## Navigation Behavior

- The interaction dock should treat Mind Map as the default selected action for Module, Note Group, and Concept scopes.
- Any back or fallback navigation that previously targeted Overview should target the scope default, which is now Mind Map.
- The UI should not expose an Overview action or label for these scope pages.

## Implementation Boundaries

The implementation should prefer route-level branching over CSS hiding. Hidden content should not remain in the DOM on Mind Map routes.

The change should stay focused on scope route behavior and Mind Map rendering. It should not redesign the Mind Map itself, alter graph data, or change View Cards, Study, or Question Card workflows beyond removing Overview assumptions.

## Testing

Add or update tests to verify:

- Default Module, Note Group, and Concept routes select Mind Map.
- Mind Map routes render the appropriate Mind Map panel.
- Mind Map routes do not render downstream overview/card content below the Mind Map.
- View Cards, Study, and Question Cards routes still render their route-specific content.
- Any old overview-style route state falls back to Mind Map behavior.

