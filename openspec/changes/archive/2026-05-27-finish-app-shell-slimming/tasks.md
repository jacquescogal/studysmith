## 1. Route Context Ownership

- [x] 1.1 Introduce route context hooks/providers for active Subject, Module, Note Group, and Concept scopes.
- [x] 1.2 Move Subject and Module selected entity state ownership out of `App.jsx` into route layout/page logic.
- [x] 1.3 Move Note Group selected entity state ownership out of `App.jsx` into Note Group route/page logic.
- [x] 1.4 Move Concept selected entity state ownership out of `App.jsx` into Concept route/page logic.
- [x] 1.5 Preserve route restoration error handling and deep-link behavior after selected state ownership moves.

## 2. Page Workflow Ownership

- [x] 2.1 Move Module settings, deletion, Concept filter, Note Group reorder, and Module Mind Map action handlers into Module page/hooks.
- [x] 2.2 Split `StudyScopeContent` into Note Group and Concept page containers or equivalent route-owned page modules.
- [x] 2.3 Move Note Group metadata, deletion, source reading, Study Card editing, Question Card editing, and Question Card generation handlers into Note Group page/hooks.
- [x] 2.4 Move Concept metadata, deletion, Knowledge Node regeneration, Concept Study Cards, and Concept Question Cards handlers into Concept page/hooks.
- [x] 2.5 Keep modal and form draft state local to the nearest owning page/container where practical.

## 3. Tutor Chat Concept Context

- [x] 3.1 Update frontend Tutor Chat request building to include `concept_id` when chat is opened from a Concept page.
- [x] 3.2 Update frontend API helper tests for Module, Note Group, and Concept Tutor Chat request context.
- [x] 3.3 Update backend chat request schema/handler to accept Concept context or explicitly document and spec a Module-scoped fallback if Concept chat is intentionally not server-scoped.
- [x] 3.4 Add or update backend tests proving Concept chat context is applied or intentionally rejected according to the final contract.
- [x] 3.5 Preserve existing Module and Note Group Tutor Chat behavior.

## 4. App Shell Cleanup

- [x] 4.1 Remove obsolete selected entity state, refs, and route restoration effects from `App.jsx`.
- [x] 4.2 Remove obsolete feature handlers from `App.jsx` after page/hooks own them.
- [x] 4.3 Remove large page-specific bridge prop objects from `App.jsx`.
- [x] 4.4 Remove unused imports, helper functions, and compatibility aliases made obsolete by the extraction.
- [x] 4.5 Confirm `App.jsx` is limited to providers, route tree composition, global dialogs/toasts, auth/admin shell concerns, and minimal compatibility glue.

## 5. Verification

- [x] 5.1 Add or update route/page/hook tests for route-context ownership and page action ownership.
- [x] 5.2 Add or update Tutor Chat tests for Module, Note Group, and Concept contexts.
- [x] 5.3 Run `npm run test` from `frontend/`.
- [x] 5.4 Run `npm run build` from `frontend/`.
- [x] 5.5 Run focused backend tests for Tutor Chat Concept context if backend chat behavior changes.
- [x] 5.6 Manually verify representative Module, Note Group, Concept, Review, Tutor Chat, View Cards, Study Cards, and Question Cards flows.
