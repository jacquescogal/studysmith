# Module and Concept Study Pages Design

## Goal

Module and Concept routes should have Study pages that match the Note Group Study reading workflow while spanning multiple Note Groups. The page should present Derived Study Cards grouped by Note Group, and Source Text should stay in a modal that can switch between the relevant Note Group source texts.

## Scope

This design covers frontend Study page behavior for Module, Concept, and Note Group scopes. Module Study includes every Note Group in the Module that has scoped Study Cards. Concept Study uses the existing include descendant Study Cards toggle: when enabled it includes direct and descendant Concept Study Cards; when disabled it includes only direct Concept Study Cards. Concept Study Cards must be deduplicated by Study Card id before display and navigation.

## User Experience

The Study page shows Derived Study Cards as the primary inline view. Cards are grouped by Note Group with a clear group header and divider. Note Group groups follow the same ordering used in the left sidebar, and cards within each group follow the scoped Study Card order returned by the app.

Each Study Card keeps a magnifying glass action. Clicking it opens the Source Text modal for that card's Note Group, pins the card, highlights its source range, and scrolls the modal source container to the active range.

The page-level `View Source Text` button opens the modal without pinning a card. In that manual state, the modal shows a Note Group dropdown at the upper left. The dropdown contains only Note Groups that have visible Study Cards in the current Study scope. Selecting a Note Group swaps the modal source text to that Note Group.

When a Study Card is pinned, the dropdown is disabled. A pinned Study Card always determines the active Note Group source text, so the modal cannot be manually switched away from the pinned card's source context until the card is unpinned.

## Source Text Navigation

Pinned navigation uses the visible grouped Study Card order flattened into one list. Normal previous and next behavior moves among Study Cards in the active Note Group. At the first or last card of a Note Group, the boundary button turns blue to indicate that clicking will cross into the previous or next Note Group. Clicking the blue boundary button moves to the adjacent visible Study Card, switches the modal to that Study Card's Note Group source text, pins that card, and scrolls to its active source range.

The source range up/down controls remain scoped to the pinned Study Card's source ranges. They are disabled when there is no previous or next source range.

## Data Flow

Study page rendering needs a scoped Study Card list, a Note Group order list, and per-Note Group source text payloads. Existing Note Group scope already has the selected Note Group source text and source ranges. Module and Concept scopes need the same source payloads for every Note Group represented in the visible Study Cards.

Implementation should first reuse existing frontend data where available:

- Module Study Cards come from the Module scope card data or study-card data, ordered by Note Group order.
- Concept Study Cards come from the existing Concept Study Card endpoint and respect the include descendant toggle.
- Note Group labels and order come from the module Note Group list used by the sidebar.

If the frontend does not already have cleaned source text, formatted sections, and Study Card source ranges for all scoped Note Groups, add a narrow backend endpoint that returns source text payloads for a list of Note Group ids or for the current Study scope. The endpoint should reuse existing Note Group read authorization and return only the fields needed by the modal.

## Components

`StudyScopeContent` should own the scope-specific Study page composition. It should build grouped Study Card sections and pass a flattened navigation list to the Source Text modal.

The existing Source Text modal body should remain a reusable unit. It should accept:

- active Note Group id
- available Note Group options
- pinned Study Card id
- active source range index
- source text payload for the active Note Group
- flattened visible Study Card navigation order
- callbacks for selecting a Note Group, pinning a Study Card, unpinning, and moving between source ranges

The modal should preserve its current scrolling behavior: source-range scrolls affect only the modal source text container, not the outlet viewport.

## Error and Empty States

If a Module or Concept has no scoped Study Cards, the Study page should show a concise empty state and disable `View Source Text`.

If a Note Group has Study Cards but no cleaned source text payload, the modal should still open and show a clear unavailable message for that Note Group. The Study Cards remain visible inline.

If a pinned Study Card has no source ranges, the modal still shows the pinned card preview. Source range up/down controls are disabled.

## Testing

Frontend tests should cover:

- Module Study groups Study Cards by Note Group and follows Note Group order.
- Concept Study respects the include descendant toggle and deduplicates Study Cards.
- Manual Source Text modal exposes a Note Group dropdown scoped to visible Note Groups.
- The dropdown is disabled when a Study Card is pinned.
- Clicking a Study Card magnifying glass opens the modal in that card's Note Group source context.
- Boundary previous/next buttons visually distinguish cross-Note-Group movement and move through the flattened visible order.
- Source range navigation remains bounded and scrolls only the modal source container.

