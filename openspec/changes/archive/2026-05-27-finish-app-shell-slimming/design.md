## Context

The archived `refactor-frontend-architecture` change introduced nested routes, route-resolution hooks, scoped server-state hooks, Auto Workflow extraction, Review/Tutor Chat hooks, and a `StudyScopeContent` page component. That work reduced `App.jsx`, but `App.jsx` still acts as a compatibility bridge: it owns selected Subject/Module/Note Group/Concept state, builds many derived route values, wires many feature handlers, and passes a large prop surface into route pages.

The current Tutor Chat hook resets when the active Concept changes, but the request sent to the chat API only carries Module and optional Note Group context. The `frontend-route-architecture` spec requires Tutor Chat to be scoped to active Module, Note Group, or Concept context, so this follow-up closes that gap.

## Goals / Non-Goals

**Goals:**

- Make `App.jsx` a true app shell: providers, `AppRoutes`, global dialogs/toasts, auth/admin shell concerns, and small compatibility glue only where unavoidable.
- Move selected entity ownership and route-param resolution into route layout/page containers.
- Move feature handlers and modal/form draft state into the nearest page/hook that uses them.
- Reduce route page prop drilling by exposing route/page hooks that return cohesive page models and actions.
- Make Tutor Chat requests include explicit Concept context when opened from a Concept page, while preserving Module and Note Group chat behavior.
- Preserve existing deep links and user-facing behavior.

**Non-Goals:**

- Redesigning the UI.
- Replacing existing hooks with Redux or another global state library.
- Renaming legacy backend `topic` storage fields.
- Changing unrelated backend behavior beyond the Concept chat context needed by Tutor Chat.
- Removing all legacy compatibility aliases in one pass.

## Decisions

### Route layouts own selected entity context

Subject, Module, Note Group, and Concept route layouts SHALL own the resolved route params and expose route context to child pages. `App.jsx` should not be the source of truth for `selectedSubjectId`, `selectedModuleId`, `selectedNoteGroupId`, or selected Concept state once the corresponding route layout owns that scope.

Rationale: the URL already carries the active route scope. Keeping selected entity state in `App.jsx` duplicates router state and forces unrelated workflows through one file.

Alternative considered: keep selected IDs in `App.jsx` but hide them behind custom hooks. This lowers file size but preserves the central controller problem.

### Page hooks own page workflows and action handlers

Module, Note Group, and Concept pages should use page-level hooks such as `useModulePage`, `useNoteGroupPage`, and `useConceptPage` or smaller scoped hooks for actions. These hooks should return data, loading/error state, and actions that page components need. Modal/form state should live beside the page or dialog that uses it unless it is truly global.

Rationale: this reduces bridge props and makes future feature changes target the owning page/hook instead of editing `App.jsx`.

Alternative considered: one large `useStudyScopePage` hook for every page. That would reduce prop drilling but risks recreating a smaller monolith.

### Tutor Chat request context is explicit

Tutor Chat SHALL send:

- Module context for Module chat.
- Module plus Note Group context for Note Group chat.
- Module plus Concept context for Concept chat.

If the backend still retrieves Concept cards through module-owned data, the request contract should still carry `concept_id` so the backend can apply or evolve Concept-specific retrieval without inferring it from client state.

Rationale: reset behavior alone does not satisfy Concept-scoped chat. The server needs explicit context to retrieve or constrain the answer.

Alternative considered: leave Concept chat Module-scoped and only reset client state by Concept. That contradicts the current spec unless the spec is intentionally revised.

### Keep route behavior stable while moving ownership

Each extraction should keep route helpers, path shapes, route restoration failures, and user-facing behavior equivalent. Tests should move with the owning hook/page.

Rationale: this is architecture work, not a product redesign.

## Risks / Trade-offs

- Route ownership regressions -> Preserve route tests and add focused layout/page tests for selected entity resolution.
- Over-large page hooks -> Split hooks by workflow when a hook starts owning unrelated behavior.
- Backend chat contract ambiguity -> Add explicit tests for chat request payloads and backend handling of Concept context.
- Prop drilling moves rather than disappears -> Track `App.jsx` prop count and ensure route pages get data from route/page hooks directly.
- Legacy topic names leaking -> Keep topic-named fields at API adapter boundaries and expose Concept-named values in new hooks/pages where practical.

## Migration Plan

1. Introduce route context providers or route hook APIs for Subject, Module, Note Group, and Concept layouts.
2. Move selected entity state and route restoration ownership from `App.jsx` into those route boundaries.
3. Split `StudyScopeContent` into route-owned Note Group and Concept page containers, backed by scoped hooks.
4. Move remaining feature handlers and modal/form draft state into owning pages/hooks.
5. Update Tutor Chat frontend request building to include `concept_id` for Concept pages.
6. Update backend chat request schema/handler to accept and apply Concept context, or explicitly revise spec if Concept chat remains Module-scoped.
7. Remove obsolete bridge props, imports, and compatibility effects from `App.jsx`.
8. Run focused hook/page tests, `npm run test`, and `npm run build`.

Rollback strategy: this is frontend-first and incremental. If a page extraction fails, restore that page's previous bridge ownership while keeping completed route/hook extractions.

## Open Questions

- Should the backend chat endpoint filter retrieval strictly to Concept-linked Study Cards, or use Concept as a weighting/context hint while still searching the Module?
- Should Review chat also accept explicit Concept context, or is Review chat sufficiently scoped through the current Review card's Note Group and Study Card references?
