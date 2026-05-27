## 1. Dock Model And Regression Coverage

- [x] 1.1 Add tests that Module, Note Group, and Concept workspace pages render an interaction dock instead of the "On this page" `SectionNav`.
- [x] 1.2 Add tests for dock action availability by scope: Module has Mind Map, View Cards, and Review; Note Group also has Study; Concept does not show Study.
- [x] 1.3 Add tests that Review dock actions display due-now counts, use the `Review Due` label, expose a 1-to-card-count slider, and start Review sessions with the correct scope.
- [x] 1.4 Add tests that dock, Study, and chat UI use canonical labels, including Concept instead of legacy Topic terminology and `Source Text` / `Derived Study Cards` for Study reading modes.

## 2. Interaction Dock Layout

- [x] 2.1 Create a reusable scope interaction dock component with action rows, icons, counts, active state, disabled state, `Review Due`, and a Review-count slider.
- [x] 2.2 Replace Module, Note Group, and Concept right-side `SectionNav` usage with the interaction dock while preserving section navigation elsewhere.
- [x] 2.3 Add desktop and narrow-viewport styles so the dock is stable, readable, and does not overlap route content.
- [x] 2.4 Wire dock active state to current routes for Mind Map, View Cards, Study, and Review destinations.

## 3. Scoped Dock Actions

- [x] 3.1 Wire Module dock Mind Map, View Cards, and Review actions to Module-scoped routes and Review handlers.
- [x] 3.2 Add a Module View Cards route so it uses the existing View Cards table experience for all cards belonging to the current Module.
- [x] 3.3 Wire Note Group dock Mind Map, View Cards, Study, and Review actions to Note Group-scoped routes and Review handlers.
- [x] 3.4 Wire Concept dock Mind Map, View Cards, and Review actions to Concept-scoped routes and Review handlers.
- [x] 3.5 Keep management actions such as settings, metadata editing, deletion, generation repair, and Knowledge Node regeneration available outside the dock.

## 4. Inline Note Group Study

- [x] 4.1 Add inline Note Group Study route content that reuses the existing Cleaned Text / Formatted Text reading derivation.
- [x] 4.2 Label the inline Study reading modes as `Source Text` and `Derived Study Cards`.
- [x] 4.3 Remove the modal-only path for opening Note Group study reading from the primary Note Group workflow.
- [x] 4.4 Disable or explain the Study dock action when Note Group study content is unavailable.
- [x] 4.5 Add tests for inline Note Group Study content rendering, friendly mode labels, and unavailable-content behavior.

## 5. Floating Tutor Chat

- [x] 5.1 Add a floating bottom-right Tutor Chat bubble for Module, Note Group, and Concept pages that opens the existing Tutor Chat modal.
- [x] 5.2 Remove Tutor Chat buttons from overview cards and shortcut sections now covered by the floating bubble.
- [x] 5.3 Preserve Tutor Chat request context for Module, Note Group, and Concept scopes.
- [x] 5.4 Add responsive styling so the floating chat bubble remains accessible without obscuring dock actions.
- [x] 5.5 Add tests for opening Tutor Chat from the floating bubble in each scope.

## 6. Shortcut Cleanup

- [x] 6.1 Remove or reduce route content sections whose only purpose is duplicate Mind Map, View Cards, Study, Review, or Tutor Chat shortcuts.
- [x] 6.2 Preserve overview stats, progress, filters, generation state, and management controls after shortcut cleanup.
- [x] 6.3 Confirm existing deep links for Module, Note Group, Concept, Mind Map, View Cards, Study Cards, and Question Cards still resolve.

## 7. Verification

- [x] 7.1 Run `npm run test` from `frontend/`.
- [x] 7.2 Run `npm run test:browser` from `frontend/`.
- [x] 7.3 Run `npm run build` from `frontend/`.
- [x] 7.4 Manually inspect Module, Note Group, and Concept pages on desktop and narrow viewports for dock placement, chat bubble placement, and duplicate shortcut removal.
- [x] 7.5 Confirm no maintained frontend `.js` or `.jsx` source file exceeds 1000 lines.
