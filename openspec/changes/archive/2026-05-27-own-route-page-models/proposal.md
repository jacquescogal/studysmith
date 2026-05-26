## Why

The previous shell slimming work left `frontend/src/features/app-shell/LegacyApp.jsx` as a 4,803-line compatibility controller that still owns too many route page models and page-specific workflows. This makes route pages hard to reason about, keeps prop drilling alive under a different filename, and violates the intended `frontend-route-architecture` boundary where page state should live near the route that consumes it.

## What Changes

- Replace the `LegacyApp.jsx` compatibility controller with appropriately named app-shell, route-model, and workflow modules.
- Move Module, Note Group, and Concept page models into their owning route page or page hook modules instead of assembling them in the app shell.
- Remove large app-shell-to-page prop bridges; route pages should consume route context and focused page models directly.
- Split oversized frontend JavaScript and JSX source files so no maintained `.js` or `.jsx` source file remains above 1000 lines after the change.
- Preserve existing deep links and user-facing behavior while changing ownership boundaries.
- Keep all new route, page, hook, and model naming aligned with `project-lexicon.md`, especially Subject, Module, Note Group, Concept, Study Card, Question Card, Tutor Chat, Review, and Auto Workflow terminology.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `frontend-route-architecture`: Strengthen the app-shell, route-page ownership, prop-drilling, naming, and file-size requirements.

## Impact

- Affected frontend code:
  - `frontend/src/features/app-shell/LegacyApp.jsx`
  - `frontend/src/App.jsx`
  - `frontend/src/routes/**`
  - `frontend/src/features/modules/**`
  - `frontend/src/features/note-groups/**`
  - `frontend/src/features/concepts/**`
  - shared frontend hooks and components currently imported by the legacy app shell
- No intentional backend API or schema changes.
- Tests:
  - Update route/page tests to verify page ownership still preserves existing Module, Note Group, and Concept flows.
  - Add a file-size guardrail test or script check proving maintained frontend JavaScript and JSX source files stay at or below 1000 lines.
  - Run frontend test and build verification after the extraction.
