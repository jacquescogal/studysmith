## Context

The older reading modal contains source lookup behavior: Derived Study Card sections can switch to clean source text, pin the selected Study Card, scroll to its source range, and render source highlights. Inline Note Group Study now owns the primary reading experience, but it currently switches modes with raw reading mode state and renders Source Text without reading highlights. The removed reading navigation sidebar can no longer be the source lookup surface.

Source Text ranges can be split across multiple source spans for a single Study Card. The inline experience needs a lightweight way to move among those spans while keeping the selected Study Card visible.

## Goals / Non-Goals

**Goals:**

- Reuse existing reading state where practical: reading mode, pinned Study Card, hover state, source ranges, and highlight rendering.
- Add a magnifying-glass source lookup control to each Derived Study Card section.
- Switch to Source Text, pin the selected Study Card, scroll to the first or selected matching source range, and highlight all ranges for that Study Card.
- Add floating controls that show the active source match as `x of n` and provide up/down navigation through multiple ranges.
- Show the pinned Study Card in a bottom-right floating panel beside the source navigation controls.
- Allow users to unpin the Study Card, which returns Source Text to an unhighlighted regular reading state.
- Provide a back control from Source Text source lookup to Derived Study Cards.
- Keep Source Text readable while de-emphasizing text outside the pinned Study Card's ranges.

**Non-Goals:**

- Reintroducing the reading navigation sidebar.
- Changing backend source range generation or Study Card data contracts.
- Adding source lookup to Module or Concept routes.
- Reworking the older reading modal beyond preserving compatibility with shared reading helpers.

## Decisions

1. Inline Study will use the same reading workflow intent as the modal instead of raw `setReadingMode`.

   The inline route should receive or compose handlers equivalent to `handleReadingModeChange` and `handleReadingViewInClean`. This keeps mode switching, pinning, and scroll behavior consistent across reading surfaces. Alternative considered: duplicate inline-only handlers in `StudyScopeContent`; this would make the two reading experiences diverge again.

2. Source matches will be modeled as ordered ranges for the pinned Study Card.

   The frontend already derives `sourceRangesByCardId` from `studyCards[*].source_ranges` or fallback generated ranges. The inline route can derive an ordered list from the pinned Study Card's ranges and track the active range index. Alternative considered: scroll to the first highlighted DOM node only; this fails when one Study Card has multiple source ranges.

3. Highlight kind will distinguish active and related source ranges.

   The active range for the pinned Study Card should render blue. Other ranges for the same pinned Study Card should render green. Hovered ranges can continue using the existing green treatment where it does not conflict with pinned navigation. Alternative considered: mark every pinned range blue; this makes `x of n` navigation less visible.

4. Floating controls will replace sidebar navigation for source lookup.

   Source Text mode should render a compact bottom-right overlay with the pinned Study Card summary plus `Study Card x of n`, up, down, unpin, and back-to-Derived Study Cards controls. Up/down navigation should wrap from the last source range to the first and from the first to the last. Unpin clears the pinned Study Card and all Source Text highlights, leaving regular Source Text visible. The overlay should avoid the floating Tutor Chat bubble and remain usable on narrow viewports. Alternative considered: put controls in the top segmented-control row; this is less connected to the pinned Study Card and can be missed while reading lower source text.

5. Existing text de-emphasis behavior remains pinned-state driven.

   Source Text outside pinned ranges should keep the current translucent treatment when a Study Card is pinned. The active and related highlighted lines should remain fully readable.

6. The pinned Study Card panel will show a compact preview with full content on hover.

   The floating panel should show the Study Card title and a short clipped body so it stays compact. Hovering the panel should reveal the full Study Card content in a popover. Alternative considered: always show the full body; this risks covering too much Source Text.

7. Source lookup controls require at least one valid source range.

   Derived Study Card magnifying-glass controls should be disabled when the Study Card has no valid source ranges. This avoids switching users into Source Text with no target range to show.

## Risks / Trade-offs

- Source range offsets may not align with rendered markdown splits -> preserve existing range validation and only render controls for valid ranges.
- Multiple highlights can overlap or sit in the same rendered line -> anchor navigation to generated highlight elements with stable range metadata rather than only card id.
- Floating controls may overlap Tutor Chat or mobile content -> add responsive positioning and test narrow viewports.
- Existing modal behavior could regress if shared helpers change -> keep focused tests for both inline Study and reading workflow helpers.
