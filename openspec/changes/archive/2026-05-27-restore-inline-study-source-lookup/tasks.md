## 1. Reading State And Navigation

- [x] 1.1 Extend reading workflow state/actions to track the active source range index for the pinned Study Card.
- [x] 1.2 Add ordered source range derivation for the pinned Study Card, preserving existing valid-range filtering.
- [x] 1.3 Update source scrolling so inline Study can scroll to a specific source range, not only the first range for a Study Card.
- [x] 1.4 Add wrapping previous/next source range navigation for the pinned Study Card.
- [x] 1.5 Add an unpin action that clears the pinned Study Card, source highlights, and active source range index.
- [x] 1.6 Keep existing reading modal behavior working with the shared reading workflow helpers.

## 2. Inline Study Source Lookup UI

- [x] 2.1 Wire inline Study mode buttons through reading workflow handlers instead of raw reading mode setters.
- [x] 2.2 Add a magnifying-glass icon button to each Derived Study Card section with an accessible source lookup label.
- [x] 2.3 Disable the magnifying-glass source lookup button when a Derived Study Card has no valid Source Text ranges.
- [x] 2.4 Make the magnifying-glass action switch to Source Text, pin the selected Study Card, scroll to a matching source range, and highlight all matching ranges.
- [x] 2.5 Render inline Source Text with reading highlights instead of an empty highlight list.
- [x] 2.6 Add a back control from Source Text source lookup to Derived Study Cards.

## 3. Floating Source Controls

- [x] 3.1 Add floating Source Text navigation controls showing `Study Card x of n` for the pinned Study Card.
- [x] 3.2 Add up and down controls that wrap through the pinned Study Card's source ranges and scroll to the active range.
- [x] 3.3 Add an unpin button in the floating source controls.
- [x] 3.4 Add a bottom-right pinned Study Card panel beside the source navigation controls with title and clipped body.
- [x] 3.5 Add a hover popover that shows the full pinned Study Card content.
- [x] 3.6 Style active source range highlights blue, related pinned Study Card ranges green, and outside Source Text translucent.
- [x] 3.7 Ensure the floating source controls avoid overlap with the floating Tutor Chat bubble on desktop and narrow viewports.

## 4. Tests And Verification

- [x] 4.1 Add or update reading workflow tests for active source range navigation and specific-range scrolling.
- [x] 4.2 Add inline Study component tests for the magnifying-glass source lookup control and highlighted Source Text rendering.
- [x] 4.3 Add tests for wrapping multi-range `x of n` source navigation and pinned Study Card panel rendering.
- [x] 4.4 Add tests for unpin clearing highlights, back returning to Derived Study Cards, hover popover content, and disabled source lookup without valid ranges.
- [x] 4.5 Run `npm run test` from `frontend/`.
- [x] 4.6 Run `npm run test:browser` from `frontend/`.
- [x] 4.7 Run `npm run build` from `frontend/`.
