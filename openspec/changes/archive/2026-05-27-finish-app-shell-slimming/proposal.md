## Why

The previous frontend architecture refactor established route boundaries and scoped hooks, but `frontend/src/App.jsx` still owns too much selected entity state, feature-handler wiring, and bridge props for route pages. Tutor Chat also resets by Concept context but does not include Concept context in the chat request, leaving one requirement only partially satisfied.

## What Changes

- Move remaining selected Subject, Module, Note Group, and Concept ownership from `App.jsx` into route/layout/page containers where practical.
- Move remaining feature handlers for Module, Note Group, Concept, Review, Tutor Chat, card editing, metadata, and source-reading workflows into focused hooks or page containers.
- Reduce `App.jsx` to providers, route tree composition, global dialogs/toasts, and truly app-level auth/admin shell concerns.
- Reduce bridge props passed from `App.jsx` into `StudyScopeContent` and other route pages by giving pages direct route-scope hooks.
- Resolve Tutor Chat Concept context:
  - Prefer passing Concept context through frontend request and backend chat handling when a Concept page opens Tutor Chat.
  - If implementation proves backend Concept chat should remain Module-scoped, update the spec language and frontend behavior to make that explicit.
- Preserve current deep links, backend behavior except for the intentional chat context contract, and user-facing UI behavior.
- Keep all new route/page/hook naming aligned with `project-lexicon.md`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `frontend-route-architecture`: Tighten the App-entry ownership contract and clarify/complete Tutor Chat Concept context behavior.

## Impact

- Affected frontend code:
  - `frontend/src/App.jsx`
  - `frontend/src/routes/**`
  - `frontend/src/hooks/**`
  - `frontend/src/features/**`
  - `frontend/src/api.js`
- Potentially affected backend code if Concept-scoped Tutor Chat is implemented:
  - `backend/app/main.py`
  - `backend/app/openai_client.py`
  - related chat request schemas/tests
- Tests:
  - Add or update focused route/page/hook tests for route-scope ownership.
  - Add or update Tutor Chat tests for Module, Note Group, and Concept request context.
  - Preserve existing frontend route and build verification.
