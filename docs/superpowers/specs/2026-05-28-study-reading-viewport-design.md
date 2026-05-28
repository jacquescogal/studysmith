# Study Reading Viewport Design

## Context

Note Group Study has two reading modes: Source Text and Derived Study Cards. The Source Text pinned Study Card panel is sticky inside the reading content, but the reading content currently grows with the full source text instead of becoming its own scroll container. In practice, the outlet viewport scrolls while the panel can sit below the visible area.

## Goal

Make the Note Group Study reading surface fit within the outlet viewport so the reading body scrolls internally. Keep the Study header and Source Text / Derived Study Cards toggle visible while the user scrolls either reading mode.

## Requirements

- The Note Group Study section should behave like a bounded reading surface within the outlet.
- The Study header and reading mode toggle should remain visible at the top of the Study surface.
- The Source Text body should scroll vertically inside the Study surface.
- The Derived Study Cards body should scroll vertically inside the same Study surface pattern.
- The pinned Study Card panel should remain sticky at the bottom of the internal Source Text scroll area.
- The pinned Study Card panel should be horizontally centered in the reading column.
- Source Text should include enough bottom padding so final text is not hidden behind the sticky pinned panel.
- Existing pinned Study Card behavior remains unchanged: previous/next Study Card, previous/next source range, unpin, Back to Derived Study Cards, scrollable Study Card body, and support for pinned cards without source ranges.

## Non-Goals

- Do not change Note Group Study routes.
- Do not change Study Card pinning behavior.
- Do not change Source Text highlighting or source-range calculation.
- Do not redesign the full app outlet, sidebar, or interaction dock.

## Design

Use the existing inline Study branch in `StudyScopeContent`. Add a Study-specific layout class to the Note Group Study section so it can be constrained against the outlet viewport. The section should use a column layout with a non-scrolling header/toggle row and a scrollable body below it.

The existing `.reading-content.inline-reading-content` container should become the internal scroll region for both Source Text and Derived Study Cards in this inline Study context. The pinned panel should stay inside that scroll region and keep `position: sticky; bottom: 0`, but should use centered inline margins instead of side-biased margins.

The height constraint should use viewport-relative sizing with a safe minimum, for example a `max-height` or `height` based on `100svh` minus the surrounding app chrome. The implementation should avoid hard-coding exact page heights unless the existing app shell already exposes a better local sizing primitive.

## Testing

Add focused frontend coverage around the inline Study markup and CSS classes:

- Source Text mode renders the bounded Study surface class.
- Source Text mode keeps the pinned panel class and centered/sticky CSS behavior.
- Derived Study Cards mode uses the same bounded scroll container class.
- Existing pinned panel behavior tests continue to pass.

Manual/browser verification should confirm that scrolling happens inside the reading body and the pinned panel stays bottom center of the reading column.
