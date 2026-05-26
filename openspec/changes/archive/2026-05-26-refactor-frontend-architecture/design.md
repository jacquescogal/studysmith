## Context

The React frontend already has useful feature and layout components under `frontend/src/features/` and `frontend/src/components/`, but `frontend/src/App.jsx` remains the owner of most application behavior. It manually interprets URL paths through `matchAppRoute`, stores selected Subject/Module/Note Group/Concept state, fetches server data, manages Auto Workflow stream state, manages Review and Tutor Chat state, controls modal state, and renders most page branches.

This creates a large coordination point where unrelated changes compete for the same file and future development requires loading thousands of lines of context. The refactor should keep current behavior while moving ownership to route, page, and hook boundaries that match the project hierarchy in `project-lexicon.md`.

## Goals / Non-Goals

**Goals:**

- Make `App.jsx` a thin app entry that owns providers, the route tree, shell-level concerns, global dialogs, and toasts.
- Represent frontend navigation with React Router nested routes and `Outlet`-based layouts.
- Resolve Short Code based routes at route/page boundaries instead of centralizing all route restoration in `App.jsx`.
- Load server state close to the page or layout that needs it.
- Isolate route-scoped workflow state for Auto Workflow, Review sessions, and Tutor Chat.
- Preserve existing URLs, backend API contracts, and user-facing behavior.
- Keep terminology aligned with `project-lexicon.md`, especially Concept terminology.

**Non-Goals:**

- Redesigning the UI.
- Changing backend models, storage, or API contracts.
- Introducing Redux as part of the initial refactor.
- Migrating legacy backend/API `TopicChip` names except where a frontend adapter boundary needs Concept-named wrappers.
- Replacing all state management with a new library in one pass.

## Decisions

### Use React Router layouts as ownership boundaries

Create nested route boundaries for Subject, Module, Note Group, and Concept contexts. Each layout should resolve its route params, provide the entity context needed by child pages, and render an `Outlet`.

Target structure:

```text
/
/app/subject/:subjectCode
/app/subject/:subjectCode/module/:moduleCode
/app/subject/:subjectCode/module/:moduleCode/mind-map
/app/subject/:subjectCode/module/:moduleCode/create-note-group
/app/subject/:subjectCode/module/:moduleCode/note-groups/:noteGroupCode
/app/subject/:subjectCode/module/:moduleCode/note-groups/:noteGroupCode/mind-map
/app/subject/:subjectCode/module/:moduleCode/note-groups/:noteGroupCode/view-cards
/app/subject/:subjectCode/module/:moduleCode/note-groups/:noteGroupCode/study-cards
/app/subject/:subjectCode/module/:moduleCode/note-groups/:noteGroupCode/question-cards
/app/subject/:subjectCode/module/:moduleCode/concepts/:conceptCode
/app/subject/:subjectCode/module/:moduleCode/concepts/:conceptCode/view-cards
/app/subject/:subjectCode/module/:moduleCode/concepts/:conceptCode/study-cards
/app/subject/:subjectCode/module/:moduleCode/concepts/:conceptCode/question-cards
```

Rationale: the URL already contains the active Subject, Module, Note Group, Concept, and panel. Letting the router own those boundaries removes duplicated selected-ID state and makes route-specific data loading easier to test.

Alternatives considered:

- Keep manual route parsing and only split components. This would reduce file size but preserve the central controller problem.
- Move all state into a global store. This would move complexity rather than clarify route ownership.

### Keep server state in focused hooks first

Create focused hooks around existing API helpers, such as `useSubjects`, `useSubjectModules`, `useModuleOverview`, `useNoteGroupScope`, and `useConceptScope`. Hooks should expose data, loading state, errors, and explicit refresh/invalidation callbacks where needed.

Rationale: most complex state in this app is backend-owned data that changes with the current route. Focused hooks improve ownership without committing the project to a new dependency.

Alternatives considered:

- Add Redux. Redux does not solve loading, caching, refetching, or invalidation by itself and would add boilerplate before the boundaries are clear.
- Add TanStack Query immediately. It may be a good follow-up, but this refactor can first create page and hook boundaries with existing dependencies.

### Scope workflows to the context that owns them

Move Auto Workflow stream state into a Module-scoped hook, Review session state into a Review hook/provider, and Tutor Chat state into a hook scoped by the active Module, Note Group, or Concept context.

Rationale: these workflows are not global application state. They depend on the active route context and should reset or refresh when that context changes.

Alternatives considered:

- Leave workflows in `App.jsx` while extracting pages. This would leave the largest behavioral knots in place.
- Put all workflow state in one global context. That would couple independent workflows and make reset behavior harder to reason about.

### Preserve existing feature components where practical

Use the current feature components as presentation and interaction surfaces, adding page containers around them rather than rewriting them.

Rationale: the goal is architectural maintainability, not UI change. Reusing existing components reduces visual and behavioral regression risk.

Alternatives considered:

- Rewrite pages from scratch. This increases risk and mixes architecture work with UI redesign.

## Risks / Trade-offs

- Route restoration regressions -> Preserve existing deep-link test coverage and add route/page tests for Subject, Module, Note Group, Concept, Mind Map, View Cards, Study Cards, and Question Cards paths.
- Duplicate fetching during migration -> Extract one route scope at a time and remove the corresponding `App.jsx` effects after the new page owns the data.
- Context/provider sprawl -> Prefer route layout context only when multiple child pages need the same resolved entity data; otherwise keep state local to the page hook.
- Legacy Topic API fields leaking into UI -> Keep adapter logic near API/hook boundaries and expose Concept-named values to page code where practical.
- Large refactor review size -> Implement incrementally by route scope and keep each task behavior-preserving.

## Migration Plan

1. Introduce the nested route tree and page/layout shell while keeping existing feature components and route helpers.
2. Move Subject and Module route resolution into layout/page hooks.
3. Move Module overview and Module Mind Map data ownership out of `App.jsx`.
4. Move Auto Workflow stream state into `useModuleGenerationWorkflow`.
5. Move Note Group and Concept scope data ownership into route/page hooks.
6. Move Review and Tutor Chat workflow state into scoped hooks.
7. Remove obsolete selected-ID, route restoration, workflow, and render-branch logic from `App.jsx`.
8. Verify existing URLs and frontend tests after each major extraction.

Rollback strategy: because the change is incremental and frontend-only, each extraction should be reversible by restoring the previous `App.jsx` ownership for that scope if tests or manual verification uncover regressions.

## Open Questions

- Should a future change adopt TanStack Query after route/page boundaries are established?
- Should legacy `topic` route compatibility remain only in `matchAppRoute`, or should explicit route redirects be added for any remaining topic paths?
- Which Review state should persist across route changes, if any, after it is extracted from `App.jsx`?
