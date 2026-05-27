## 1. Baseline and Regression Tests

- [x] 1.1 Add a focused route/layout test that demonstrates the current Module child route navigation remounts or recreates the Module workspace shell/sidebar.
- [x] 1.2 Add a Playwright sidebar persistence test that enters sidebar search text on a Module route, navigates to a Note Group or Concept child route in the same Module, and expects the search text to remain.
- [x] 1.3 Extend browser route smoke coverage, if needed, so Module overview, Note Group overview, Concept overview, Study Card, Question Card, Mind Map, and create Note Group routes still mount without page errors.

## 2. Route Boundary Restructure

- [x] 2.1 Introduce a Module workspace route layout that renders the persistent app shell chrome and a child route outlet/content slot.
- [x] 2.2 Update `frontend/src/routes/appRoutes.jsx` so Module child routes render beneath the Module workspace shell instead of each route leaf rendering a full `StudyAppShell`.
- [x] 2.3 Keep Subject index and Subject module-list routes outside the Module workspace shell while preserving their current app-shell behavior.
- [x] 2.4 Preserve existing route paths and legacy `topics/:conceptCode` compatibility paths.

## 3. Shell and Content Ownership

- [x] 3.1 Split the current app-shell rendering so Context Sidebar, Page Header, Section Nav, and shared overlays remain mounted at the Module workspace boundary.
- [x] 3.2 Move Module overview, Note Group scope, Concept scope, create Note Group, Mind Map, Study Card, and Question Card rendering into child route content components or route-owned content hooks.
- [x] 3.3 Keep Module-owned sidebar data and sidebar-local state scoped to the Module workspace shell so it persists across same-Module child routes.
- [x] 3.4 Keep Note Group and Concept page model data/actions owned by their nearest route/page hooks rather than moving page-specific content state into the workspace shell.
- [x] 3.5 Preserve Tutor Chat, Review, Reading, auth/admin, and global dialog behavior while moving only the ownership boundaries required for sidebar persistence.

## 4. User Experience and State Behavior

- [x] 4.1 Ensure sidebar selected item highlighting updates correctly when navigating to Module overview, Note Group routes, and Concept routes.
- [x] 4.2 Ensure sidebar search text, selected Browse tab, and scroll position are not reset by same-Module child route navigation.
- [x] 4.3 Ensure switching to a different Module refreshes Module-scoped sidebar data and may reset sidebar-local state for the new Module.
- [x] 4.4 Ensure unresolved deep links still display the existing route restoration failure state.

## 5. Verification

- [x] 5.1 Run `npm run test` from `frontend/`.
- [x] 5.2 Run `npm run test:browser` from `frontend/`.
- [x] 5.3 Run `npm run build` from `frontend/`.
- [x] 5.4 Confirm the frontend file-size guardrail passes and no maintained frontend `.js` or `.jsx` source file exceeds 1000 lines.
- [x] 5.5 Manually verify navigation among Module overview, Note Group overview, Concept overview, Study Card, Question Card, Mind Map, and create Note Group routes without visible sidebar refresh.
