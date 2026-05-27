## Context

The current route tree already has nested route boundaries for Subject, Module, Note Group, and Concept routes. However, the rendered app shell is still produced by each route leaf through `renderAppShell`, so navigation within an active Module can recreate the shell and left Context Sidebar even when only the selected child route changes.

The user-facing symptom is that the left sidebar appears to refresh when navigating between the Module overview, Note Group pages, and Concept pages. Semantically, the sidebar is Module workspace chrome: it browses Note Groups and Concepts owned by the active Module. It should remain mounted while the route outlet beneath it changes.

The previous `own-route-page-models` change moved page model ownership toward route pages, but `StudyAppShell` still owns a large amount of shared Module workspace state, route restoration, sidebar composition, overlays, dialogs, and page content switching.

## Goals / Non-Goals

**Goals:**

- Mount Module workspace chrome once at the Module route boundary.
- Keep the Context Sidebar mounted while navigating among Module, Note Group, Concept, Study Card, Question Card, Mind Map, and create Note Group child routes inside the same Module.
- Preserve existing deep links and URL shapes.
- Preserve the route-owned page model direction: Module, Note Group, and Concept data/actions should stay close to their owning route/page hooks.
- Keep `App.jsx` thin and avoid recreating a centralized app-shell controller under a new name.
- Add browser-level verification that proves sidebar state persists across child route navigation.

**Non-Goals:**

- Redesigning the visual sidebar UI.
- Changing backend APIs or persistence.
- Renaming backend legacy `TopicChip` fields.
- Reworking global auth, admin, Review, Tutor Chat, or Reading behavior beyond the minimal ownership changes required to keep Module workspace chrome stable.
- Replacing React Router or introducing a new routing framework.

## Decisions

### 1. Promote Module workspace shell to the Module route layout

The Module route boundary should render the persistent workspace shell and an outlet for child content.

Target shape:

```text
AppRoutes
└─ AppRouteRootLayout
   └─ SubjectLayout
      └─ ModuleWorkspaceLayout
         ├─ AppShell
         │  ├─ ContextSidebar       (persistent while moduleCode is stable)
         │  ├─ PageHeader           (updates by child route state)
         │  ├─ SectionNav           (updates by child route state)
         │  └─ <OutletContent />    (Module/Note Group/Concept route content)
         └─ Global overlays/dialogs needed by the workspace
```

Alternative considered: memoize `ContextSidebar` under the current `StudyAppShell` leaf rendering model. That may reduce re-render cost, but it does not fix remounting caused by the shell living below changing route pages, and it would keep the ownership boundary confusing.

### 2. Replace leaf shell rendering with child route content rendering

Module child route pages should render route content or register route content state under a persistent Module workspace shell instead of each returning a complete `StudyAppShell`.

This likely means splitting current `StudyAppMainContent` behavior into:

- Module workspace shell/chrome assembly.
- Subject index and Subject module-list content for routes outside a selected Module.
- Module overview content.
- Note Group scope content.
- Concept scope content.
- Create Note Group content.

Alternative considered: keep a single `StudyAppMainContent` switch and mount it from the Module layout. This can be an intermediate step if it preserves behavior, but the final boundary should make the right-side route content explicit enough that route pages can change without recreating sidebar chrome.

### 3. Keep sidebar data Module-scoped, not page-scoped

The sidebar needs Module-owned data:

- active Subject and Module labels
- Note Group list and ordering state
- Concept directory options
- Note Group generation status badges
- selected Note Group or Concept highlight
- sidebar search and tab state

This data should be owned by the Module workspace shell or Module page model layer so it persists while selected Note Group or Concept changes. Page-specific data such as selected Note Group cards or Concept cards should remain in Note Group/Concept route-owned models.

Alternative considered: store sidebar state globally. That would make persistence easier but would over-scope Module-specific state and make stale Module data more likely after switching Modules.

### 4. Preserve overlays at the smallest stable owner

Overlays should stay mounted only as high as their state requires:

- Review overlay can remain Module workspace-owned because review may start from Module, Note Group, or Concept scopes and should not collapse on child navigation unless the Review scope changes intentionally.
- Tutor Chat overlay can remain Module workspace-owned but must reset by active Module/Note Group/Concept context as specified.
- Reading dialog remains Note Group-related, but if its open state is currently workspace-owned, implementation should avoid closing it merely because the route leaf re-rendered.
- Global Subject/auth/admin dialogs should stay outside Module child route content.

Alternative considered: move all overlays to app root. That would reduce remount risk but overstates their scope and makes route-context reset behavior harder to reason about.

### 5. Verify persistence by observing mount state, not just visual output

Browser tests should prove that the sidebar stays mounted across same-Module child navigation. A stable DOM marker or test-only mount counter can make this observable without relying on timing or screenshots.

Acceptable verification signals:

- A sidebar search value entered on the Module overview remains after navigating to a Note Group or Concept route in the same Module.
- The sidebar scroll position remains when navigating among child routes.
- A Playwright route-smoke test records no page errors and confirms the same sidebar instance persists across child navigation.

## Risks / Trade-offs

- **Risk: Module workspace shell becomes another large controller** -> Keep extraction tasks scoped around route layout ownership and split content into focused components/hooks as part of the implementation.
- **Risk: route-owned page models regress into workspace-owned state** -> Keep Module-owned sidebar data separate from Note Group and Concept page content data, and add tests around page model ownership.
- **Risk: deep links break during route tree reshaping** -> Preserve existing route paths and add browser smoke coverage for Module, Note Group, Concept, Study Card, and Question Card routes.
- **Risk: overlay reset behavior changes** -> Add focused tests for Tutor Chat, Review, and Reading open/reset behavior where ownership moves.
- **Risk: sidebar still re-renders even if it no longer remounts** -> Treat re-rendering as acceptable; only remounting, visible flicker, search/scroll loss, or unnecessary data reloads are failures.
- **Risk: implementation exceeds file-size guardrails** -> Continue enforcing the 1000-line frontend source guardrail and split workspace layout/chrome/content files before completion.
