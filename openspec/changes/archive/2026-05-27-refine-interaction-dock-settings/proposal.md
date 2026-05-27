## Why

The interaction dock is now the primary workspace action surface, but the default state and remaining management entry points still leave duplicate or misplaced controls around the Mind Map area. Scope settings should be available from the dock without turning the dock into a dense management menu.

## What Changes

- Make Mind Map the default selected dock action for Module, Note Group, and Concept workspace pages when no more specific child action is selected.
- Remove the card-style shortcut controls that still render below Mind Map content.
- Add a settings gear icon button to the interaction dock that opens a scope-specific settings modal.
- Use the existing Module settings experience as the standard Module settings modal, and add a delete Module action if it is missing from that modal.
- Add Note Group settings with rename title and delete Note Group actions.
- Restrict Concept settings to delete Concept and regenerate Concept actions only; Concept rename and description editing are no longer available from this workflow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `frontend-route-architecture`: Dock default selection, duplicate Mind Map shortcut removal, and scope settings modal behavior change on Module, Note Group, and Concept workspace pages.
- `concept-terminology`: Concept page management behavior changes so Concepts are no longer renamed or description-edited from the Concept settings workflow.

## Impact

- Affected frontend dock component, Module/Note Group/Concept page models, route content, and modal wiring.
- Affected frontend tests for dock default active state, Mind Map shortcut cleanup, and settings modal actions by scope.
- Affected project terminology/docs where Concept management behavior says Concepts can be renamed from the Concept page.
- No backend API changes are intended; existing Module, Note Group, and Concept update/delete/regeneration APIs should be reused where applicable.
