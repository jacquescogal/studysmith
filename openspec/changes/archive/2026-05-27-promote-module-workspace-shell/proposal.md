## Why

Navigating within a Module between the Module overview, Note Group pages, and Concept pages currently rebuilds the app shell from each route leaf, which can make the left Context Sidebar feel like it refreshes even though the active Module has not changed. The Module workspace chrome should persist across Module child routes so navigation changes only the route content that belongs to the right-hand page area.

## What Changes

- Promote the Module workspace shell boundary so it is mounted at the Module route layout rather than recreated by every Module, Note Group, or Concept route page.
- Keep the left Context Sidebar, header chrome, global dialogs, Tutor Chat overlay, Reading overlay, and Review overlay stable while the active child route content changes beneath the Module route boundary.
- Render Module overview, Note Group, Concept, Study Card, Question Card, Mind Map, and create Note Group route content through nested route outlets or route-owned page content components.
- Preserve existing deep links and route-owned page model ownership for Module, Note Group, and Concept pages.
- Preserve user-facing Concept terminology and existing Note Group terminology.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `frontend-route-architecture`: Module-scoped workspace chrome, including the left Context Sidebar, SHALL persist across Module child route navigation while only the route content changes.

## Impact

- Affected frontend routing modules: `frontend/src/App.jsx`, `frontend/src/routes/appRoutes.jsx`, `frontend/src/routes/layouts.jsx`, `frontend/src/routes/pages.jsx`, and route context/page model hooks.
- Affected app-shell modules: `frontend/src/features/app-shell/*`, especially `StudyAppShell`, `StudyAppView`, `StudyAppMainContent`, and app-shell overlay/dialog ownership.
- Affected layout/navigation components: `frontend/src/components/layout/AppShell.jsx` and `frontend/src/components/layout/ContextSidebar.jsx`.
- Verification will need browser-level navigation checks to confirm the sidebar remains mounted and does not visibly reset while moving between Module, Note Group, and Concept routes.
