# Stable Pinned Study Card Body Design

## Context

The Note Group Study Source Text view has a sticky pinned Study Card panel. The panel now stays bottom-centered in the internal reading viewport, but clicking previous or next Study Card can still change the panel height because short Study Card content produces a shorter body and long content expands up to the current maximum.

## Goal

Keep the pinned Study Card text body at a stable height while navigating between pinned Study Cards. Long content should scroll inside that body. Short content should not shrink the body.

## Requirements

- Only the pinned Study Card text body should get a stable height.
- The pinned panel controls, Study Card title, and Back to Derived Study Cards button should keep their natural height.
- The text body should remain vertically scrollable when content overflows.
- The text body should remain keyboard-focusable and labelled for accessibility.
- Existing Study Card pinning, source-range navigation, and sticky panel placement should remain unchanged.

## Non-Goals

- Do not fix the height of the entire pinned Study Card panel.
- Do not change the Source Text internal scroll container.
- Do not change previous/next Study Card pinning behavior.
- Do not change Study Card content rendering.

## Design

Update `.source-lookup-study-card-body` so it uses a stable fixed height instead of only `max-height`. The starting value should match the current maximum, `180px`, because that is already the established reasonable content area size.

The body keeps `overflow-y: auto`, `white-space: pre-wrap`, existing font sizing, `tabIndex={0}`, and `aria-label="Pinned Study Card content"`. This prevents layout jumping while preserving scroll access for longer Study Cards.

## Testing

Update focused frontend coverage so the CSS regression test asserts:

- `.source-lookup-study-card-body` uses `height: 180px`.
- `.source-lookup-study-card-body` keeps `overflow-y: auto`.

Existing pinned panel render and Study Card navigation tests should continue to pass.
