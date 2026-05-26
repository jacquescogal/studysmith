## 1. Route Foundation

- [x] 1.1 Add a nested React Router route tree for Subject, Module, Note Group, and Concept routes while preserving existing URL paths.
- [x] 1.2 Create thin page/layout shell modules for Subject index, Subject layout, Module layout, Note Group layout, and Concept layout.
- [x] 1.3 Move route param parsing and route matching tests from manual `App.jsx` behavior toward route tree and route helper coverage.
- [x] 1.4 Keep `App.jsx` rendering the new route tree while preserving existing providers, global dialogs, and toasts.

## 2. Subject And Module Boundaries

- [x] 2.1 Extract Subject list loading into a `useSubjects` hook using the existing authenticated/public subject API helpers.
- [x] 2.2 Move Subject index page composition out of `App.jsx` and reuse the existing `SubjectIndex` feature component.
- [x] 2.3 Extract Subject and Module Short Code resolution into route/layout logic.
- [x] 2.4 Extract Module list loading into a `useSubjectModules` hook.
- [x] 2.5 Move Module index page composition out of `App.jsx` and reuse the existing `ModuleIndex` feature component.

## 3. Module Pages

- [x] 3.1 Extract Module overview data loading into a `useModuleOverview` hook.
- [x] 3.2 Move Module overview page composition out of `App.jsx` and reuse existing Module overview, timeline, review shortcut, and Note Group list UI.
- [x] 3.3 Extract Module Mind Map data loading and regeneration handlers into Module-scoped page logic.
- [x] 3.4 Move Module Mind Map page composition out of `App.jsx`.
- [x] 3.5 Preserve Module settings, deletion, Concept filters, and Note Group reorder behavior after extraction.

## 4. Auto Workflow

- [x] 4.1 Extract Module Auto Workflow snapshot, stream connection, reconnect, notification, cancel, retry, and delete behavior into `useModuleGenerationWorkflow`.
- [x] 4.2 Scope Auto Workflow state to the active Module and clear it when the Module changes.
- [x] 4.3 Wire Module and Note Group pages to the extracted Auto Workflow hook.
- [x] 4.4 Add or update tests for Auto Workflow state reset and visible job mapping.

## 5. Note Group Pages

- [x] 5.1 Extract Note Group Short Code resolution and detail loading into Note Group route/page logic.
- [x] 5.2 Extract Note Group Study Card, Question Card, Cleaned Text, Formatted Text, progress, card table, and Mind Map loading into scoped hooks.
- [x] 5.3 Move Note Group overview page composition out of `App.jsx`.
- [x] 5.4 Move Note Group Mind Map page composition out of `App.jsx`.
- [x] 5.5 Move Note Group View Cards page composition out of `App.jsx`.
- [x] 5.6 Move Note Group Study Cards page composition out of `App.jsx`.
- [x] 5.7 Move Note Group Question Cards page composition out of `App.jsx`.
- [x] 5.8 Preserve Note Group creation, metadata editing, deletion, card editing, Question Card generation, and source reading behavior.

## 6. Concept Pages

- [x] 6.1 Extract Concept Short Code resolution and detail loading into Concept route/page logic.
- [x] 6.2 Extract Concept Study Card, Question Card, timeline, and Mind Map loading into scoped hooks.
- [x] 6.3 Move Concept overview page composition out of `App.jsx`.
- [x] 6.4 Move Concept View Cards page composition out of `App.jsx`.
- [x] 6.5 Move Concept Study Cards page composition out of `App.jsx`.
- [x] 6.6 Move Concept Question Cards page composition out of `App.jsx`.
- [x] 6.7 Keep new user-facing route/page/hook terminology aligned to Concept language while containing legacy topic field handling at adapter boundaries.

## 7. Review And Tutor Chat

- [x] 7.1 Extract Review queue, answer, feedback, summary, keyboard shortcut, deletion, and refresh behavior into a Review hook or scoped provider.
- [x] 7.2 Wire Module, Note Group, and Concept pages to the extracted Review behavior without resetting unrelated route context.
- [x] 7.3 Extract Tutor Chat messages, card lookup cache, loading, and send behavior into a hook scoped by active Module, Note Group, or Concept context.
- [x] 7.4 Wire Module, Note Group, and Concept pages to the extracted Tutor Chat behavior.
- [x] 7.5 Add or update tests for Review scope selection and Tutor Chat request context.

## 8. App Slimming And Cleanup

- [x] 8.1 Remove obsolete selected Subject, Module, Note Group, and Concept state from `App.jsx` after route/page ownership is complete.
- [x] 8.2 Remove obsolete route restoration effects from `App.jsx` after route/page ownership is complete.
- [x] 8.3 Remove obsolete page rendering branches and feature handlers from `App.jsx`.
- [x] 8.4 Keep `App.jsx` focused on providers, route tree, shell-level concerns, global dialogs, and toasts.
- [x] 8.5 Remove unused imports, helpers, and CSS hooks made obsolete by the extraction.

## 9. Verification

- [x] 9.1 Add or update route tests for Subject, Module, Module Mind Map, Note Group overview, Note Group Mind Map, View Cards, Study Cards, Question Cards, Concept overview, Concept View Cards, Concept Study Cards, and Concept Question Cards URLs.
- [x] 9.2 Add or update focused tests for extracted hooks where behavior was previously covered only through `App.jsx`.
- [x] 9.3 Run `npm run test` from `frontend/`.
- [x] 9.4 Run `npm run build` from `frontend/`.
- [x] 9.5 Manually verify representative deep links still resolve and show equivalent user-facing behavior.
