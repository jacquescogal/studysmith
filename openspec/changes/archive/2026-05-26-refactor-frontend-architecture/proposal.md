## Why

The frontend concentrates too much application ownership in `frontend/src/App.jsx`: routing, route restoration, data loading, selected Subject/Module/Note Group/Concept state, Auto Workflow stream state, Review state, Chat state, modal state, handlers, and page rendering are all coupled in one file. Refactoring now reduces development context pressure, lowers regression risk, and creates clearer ownership boundaries before more frontend features are added.

## What Changes

- Replace manual top-level route parsing and render branching with React Router nested routes and `Outlet`-based layouts.
- Move page composition into focused route/page containers for Subject, Module, Note Group, and Concept views.
- Move server data loading into scoped hooks that use the existing API helpers.
- Move route-scoped workflow state into focused hooks for Auto Workflow, Review sessions, and Tutor Chat.
- Keep modal and form draft state local to the nearest page/container where practical.
- Preserve current deep links, route restoration behavior, and backend API contracts.
- Reuse existing feature components where practical instead of redesigning the UI.
- Defer Redux and other global state libraries unless implementation discovers a concrete global client-state need that cannot be handled cleanly with routes, local state, context, and hooks.

## Capabilities

### New Capabilities

- `frontend-route-architecture`: Defines the frontend route, page, layout, and route-scoped state ownership contract for Subject, Module, Note Group, and Concept views.

### Modified Capabilities

None.

## Impact

- Affected code:
  - `frontend/src/App.jsx`
  - `frontend/src/main.jsx`
  - `frontend/src/lib/routes.js`
  - `frontend/src/routes/`
  - `frontend/src/components/layout/`
  - `frontend/src/features/**`
  - New frontend route/page/hook modules.
- APIs:
  - No backend API behavior changes are expected.
  - Existing frontend API helper usage should be preserved or wrapped by focused hooks.
- Dependencies:
  - No required new runtime dependency.
  - TanStack Query may be considered in a future change, but is not required here.
- Tests:
  - Existing frontend route and feature tests should be preserved.
  - Focused tests should be added or updated for route resolution, route restoration, scoped hooks, and key page rendering.
