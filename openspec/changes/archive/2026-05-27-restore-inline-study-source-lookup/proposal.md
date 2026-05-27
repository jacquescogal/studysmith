## Why

Inline Note Group Study replaced the older reading modal/sidebar flow, but the Source Text mode no longer preserves the source lookup behavior users need from Derived Study Cards. Users need to move from a specific Derived Study Card to its supporting Source Text ranges without relying on the removed reading navigation sidebar.

## What Changes

- Add a per-Derived Study Card source lookup control using a magnifying-glass icon.
- Selecting the source lookup control switches inline Study to Source Text, pins the selected Study Card, scrolls to a matching source range, and highlights all matching source ranges.
- Add floating Source Text navigation controls that show the current match position as `x of n` and let users move up/down through multiple source ranges for the pinned Study Card.
- Render the active source range in blue, other source ranges for the same pinned Study Card in green, and keep surrounding Source Text visually de-emphasized.
- Show the pinned Study Card in a floating bottom-right panel beside the source navigation controls.
- Keep source lookup independent of the removed reading navigation sidebar.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `frontend-route-architecture`: Inline Note Group Study source lookup, highlighting, and multi-range navigation behavior changes.

## Impact

- Frontend inline Study route content in `frontend/src/features/study-scope/StudyScopeContent.jsx`.
- Reading workflow state/actions in `frontend/src/features/reading/` and app-shell wiring.
- Source Text highlighting in `frontend/src/lib/text-rendering.jsx` and related styles.
- Frontend tests for inline Study behavior and reading workflow navigation.
