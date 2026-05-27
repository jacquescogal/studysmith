# View Cards and Source Lookup Design

## Context

The app now treats Mind Map as the default scope route, with View Cards available as an explicit route. View Cards still renders local Back buttons that no longer match the route model. Note Group Study also has a Source Text lookup flow: clicking the magnifying glass on a Derived Study Card switches to Source Text, pins the Study Card, and highlights the linked source range.

## Goals

- Remove the local Back button from View Cards pages.
- Keep the existing magnifying-glass flow from Derived Study Cards to Source Text.
- Make the pinned Study Card panel sticky to the bottom of the Source Text scroll area.
- Replace hover-to-reveal Study Card content with an always available, vertically scrollable content area.
- Add previous and next Study Card controls that pin adjacent cards in Derived Study Cards order.

## Non-Goals

- Do not change route paths or route matching.
- Do not redesign the full Study page.
- Do not change the meaning of Source Text ranges or Study Card references.
- Do not replace the existing source-range up/down navigation.

## View Cards Behavior

Module, Note Group, and Concept View Cards should render their title, description, filters, and table without a local `Back` button. Users can still navigate through the app shell, sidebar, dock actions, browser history, or direct routes.

## Source Lookup Behavior

In Note Group Study, clicking a Derived Study Card magnifying glass should continue to:

1. Switch the reading mode to `Source Text`.
2. Pin the clicked Study Card.
3. Set the active source range to the clicked range, usually `0`.
4. Scroll the Source Text view to the highlighted range.

When a Study Card is pinned in Source Text, the pinned-card controls should appear as a sticky bottom panel inside the Source Text scroll container. The panel should not be fixed to the full viewport.

## Sticky Pinned Study Card Panel

The sticky panel should show:

- The current Study Card's position in Derived Study Cards order.
- Previous and next Study Card icon buttons.
- Existing previous and next source-range controls for the pinned Study Card.
- An unpin button.
- A button to return to Derived Study Cards.
- The pinned Study Card title.
- The full pinned Study Card content in a vertically scrollable area.

The old hover/focus popover for full Study Card content should be removed. Long Study Card content should scroll inside the panel instead of expanding over the Source Text.

## Previous and Next Study Card Navigation

Previous and next Study Card controls should follow the visible order in `studyNoteSections`, which is the Derived Study Cards order. Navigation should wrap at the ends:

- Previous from the first Study Card pins the last Study Card.
- Next from the last Study Card pins the first Study Card.

When the pinned Study Card changes through these controls, the app should reset `activeSourceRangeIndex` to `0` and scroll to that card's first linked Source Text range. If the adjacent Study Card has no valid Source Text range, it should still become pinned if it appears in Derived Study Cards order, but source scrolling should be a no-op.

## Component Boundaries

Keep the first implementation within the existing reading flow:

- `StudyScopeContent` renders the View Cards header and Source Text pinned panel.
- `useReadingWorkflowActions` owns reading-mode transitions, pinning, range navigation, and adjacent Study Card pinning.
- Existing route helpers and route definitions remain unchanged.

A separate pinned panel component is not required unless implementation makes `StudyScopeContent` noticeably harder to read.

## Testing

Update focused frontend tests to cover:

- Module View Cards renders without a Back button.
- Note Group and Concept View Cards render without a Back button.
- Source Text pinned panel renders full Study Card content without the hover popover markup.
- The pinned panel includes previous and next Study Card controls.
- Previous and next pinning follows Derived Study Cards order and wraps at the ends.
- Existing source-range previous and next behavior remains covered.
