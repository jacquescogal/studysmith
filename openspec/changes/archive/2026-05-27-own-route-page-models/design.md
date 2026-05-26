## Context

`frontend/src/App.jsx` is now thin, but it delegates most application behavior to `frontend/src/features/app-shell/LegacyApp.jsx`. That file is 4,803 lines and still imports route resolution hooks, data hooks, API functions, page components, shell components, dialog components, formatting helpers, and workflow helpers in one place. The name `LegacyApp` also hides its current production role and makes the architecture look temporary even while it remains the main app controller.

The existing `frontend-route-architecture` spec already requires route boundaries and scoped ownership for Module, Note Group, Concept, Review, Tutor Chat, and Auto Workflow behavior. This change turns that architectural intent into a stricter implementation contract: route pages own their page models, the app shell stops constructing large page-specific props, and oversized JavaScript and JSX files are split until every maintained frontend `.js` and `.jsx` source file is at or below 1000 lines.

## Goals / Non-Goals

**Goals:**

- Rename and replace `LegacyApp.jsx` with production-appropriate app-shell modules.
- Move Module, Note Group, and Concept page model construction into route-owned page containers or hooks.
- Keep route page data, derived state, loading/error state, and actions near the route page that consumes them.
- Remove app-shell bridge props for page-specific workflows.
- Split large frontend JavaScript and JSX files so every maintained frontend `.js` and `.jsx` source file is at or below 1000 lines.
- Preserve existing route paths, deep links, user-facing UI behavior, auth behavior, admin behavior, Review behavior, Tutor Chat behavior, and Auto Workflow behavior.

**Non-Goals:**

- Redesigning the visible UI.
- Changing backend API contracts or database schema.
- Replacing React Router, existing UI primitives, or the current hook-based data flow with a global state library.
- Renaming legacy backend/API `topic` fields that are already isolated behind adapters.

## Decisions

### Route page models live with route pages

Each primary route page SHALL build its own page model through a focused page hook or route-owned container. Module pages should own Module overview data, Module Mind Map state, Note Group ordering, Module settings, Concept filters, Auto Workflow display state, and Module-level actions. Note Group pages should own Note Group details, source-reading state, Study Card state, Question Card state, metadata actions, deletion, and Question Card generation actions. Concept pages should own Concept details, Concept Study Cards, Concept Question Cards, Concept Mind Map state, metadata actions, deletion, and Knowledge Node regeneration actions.

Rationale: the active route already identifies the page scope. Building page models in the app shell duplicates route ownership and forces unrelated pages to share a single controller file.

Alternative considered: keep the app shell as a page model factory and split helper functions out by topic. That would reduce line count but retain the core prop-drilling problem.

### The app shell only owns cross-route composition

The app-shell layer should contain auth/admin shell concerns, global dialogs/toasts, shared shell layout composition, and route tree composition. It may pass small app-level dependencies such as authenticated user state or global callbacks, but it must not build Module, Note Group, or Concept page models.

Rationale: this keeps app-level concerns explicit while making feature changes land in the owning feature directory.

Alternative considered: make every route page fully independent of the shell. That would duplicate app-wide auth/admin and global dialog handling that legitimately belongs above route pages.

### Replace `LegacyApp` with descriptive modules

`LegacyApp.jsx` should disappear as a production entry point. The replacement naming should describe stable responsibilities, such as `StudyAppShell`, `AppShellRoutes`, `AuthenticatedAppShell`, or smaller feature-owned page model hooks. No new file should use "legacy" to describe active production ownership.

Rationale: names shape maintenance behavior. A file called `LegacyApp` invites future work to ignore a production-critical controller instead of completing the ownership split.

Alternative considered: rename `LegacyApp.jsx` to `StudyApp.jsx` without deeper extraction. That would satisfy naming but not page ownership or file-size requirements.

### Enforce the 1000-line JavaScript/JSX ceiling mechanically

The implementation should add a lightweight test or script check that fails when a maintained frontend `.js` or `.jsx` source file exceeds 1000 lines. Generated artifacts, build output, dependency folders, vendored files, TypeScript files, CSS files, and non-JavaScript assets should be excluded. The check should run in the existing frontend test path when practical.

Rationale: one-time cleanup without a guardrail would allow another controller file to grow back. Limiting the first guardrail to JavaScript and JSX matches the current frontend source shape and avoids making CSS or future TypeScript migration work part of this change.

Alternative considered: document the limit only in OpenSpec. Documentation alone will not catch regressions during future edits.

### Split by ownership, not by arbitrary line ranges

Extraction should follow existing feature boundaries: `features/modules`, `features/note-groups`, `features/concepts`, `features/review`, `features/chat`, `features/reading`, `features/subjects`, `features/admin`, and `components/layout`. Shared utilities should move to `lib` or focused shared hooks only when multiple owners genuinely use them.

Rationale: mechanical slicing by line count can create files under 1000 lines that are still hard to navigate. The split should make future changes predictable.

Alternative considered: place all extracted helpers under `features/app-shell`. That lowers file size but keeps ownership centralized.

### Standardize page model hook names

Primary route-owned page model hooks SHALL use `use<Scope>PageModel` names, such as `useModulePageModel`, `useNoteGroupPageModel`, and `useConceptPageModel`. Existing `use<Scope>PageState` hooks should be renamed or replaced when they become the route page's primary model. Narrower hooks that own one workflow should use the workflow name instead of the page model suffix.

Rationale: a shared naming convention makes it clear which hook assembles the route page model and which hooks are narrower support hooks.

Alternative considered: keep existing `use<Scope>PageState` names where they already exist. That reduces churn, but it leaves the ownership convention less explicit after a major extraction.

## Risks / Trade-offs

- Route behavior regressions -> Preserve existing route tests and add focused tests around representative Module, Note Group, and Concept page models.
- Prop drilling reappears through route wrapper components -> Keep route wrappers thin and have page hooks consume route context directly.
- Page hooks become new monoliths -> Split page models into workflow-specific hooks before any single JavaScript or JSX file exceeds 1000 lines.
- Duplicated data loading after extraction -> Reuse existing focused hooks and avoid creating parallel fetch paths unless the old path is removed.
- File-size test false positives -> Scope the check to maintained frontend JavaScript and JSX source files and exclude generated/build/dependency output.

## Migration Plan

1. Inventory responsibilities inside `LegacyApp.jsx` and group them by app-shell, Subject, Module, Note Group, Concept, Review, Tutor Chat, Reading, Admin, and shared utility ownership.
2. Introduce a descriptively named app-shell entry that composes providers, routes, global dialogs/toasts, and auth/admin shell behavior.
3. Extract Module page model ownership into Module route/page hooks and remove Module-specific bridge props from the app shell.
4. Extract Note Group page model ownership into Note Group route/page hooks and remove Note Group-specific bridge props from the app shell.
5. Extract Concept page model ownership into Concept route/page hooks and remove Concept-specific bridge props from the app shell.
6. Move Review, Tutor Chat, Reading, Subject, and Admin workflow state into their nearest owning modules when they are currently held only to support route pages.
7. Delete `LegacyApp.jsx` after its remaining responsibilities have moved into appropriately named files.
8. Add and run the JavaScript/JSX file-size guardrail, frontend tests, and frontend build.

Rollback strategy: keep each extraction behavior-preserving and covered by focused tests. If one route page extraction fails, restore that route's previous owner while retaining completed extractions that have already passed tests.

## Open Questions

None.
