## 1. Inventory and Guardrails

- [x] 1.1 Inventory `frontend/src/features/app-shell/LegacyApp.jsx` responsibilities and map each block to app-shell, Subject, Module, Note Group, Concept, Review, Tutor Chat, Reading, Admin, or shared utility ownership.
- [x] 1.2 Add a frontend file-size guardrail test or script that fails when maintained `frontend/src` `.js` or `.jsx` source files exceed 1000 lines, excluding generated/build/dependency output.
- [x] 1.3 Run the new guardrail once to confirm it reports the existing oversized app-shell file before extraction.

## 2. App Shell Replacement

- [x] 2.1 Create descriptively named app-shell modules for provider composition, authenticated shell behavior, route composition, global dialogs/toasts, and auth/admin shell concerns.
- [x] 2.2 Move app-level auth, admin, toast, shell layout, and route composition behavior out of `LegacyApp.jsx` into the new app-shell modules.
- [x] 2.3 Keep `frontend/src/App.jsx` as a thin entry that renders providers and the new app-shell entry without page-specific state or bridge props.

## 3. Module Page Model Ownership

- [x] 3.1 Move Module route context consumption, Module overview data, Module Mind Map state, Note Group ordering, Module settings, Concept filters, Auto Workflow display state, and Module actions into Module-owned route/page hooks, with the primary page model hook named `useModulePageModel`.
- [x] 3.2 Update Module route pages to consume the Module-owned page model directly instead of receiving a page-specific model from the app shell.
- [x] 3.3 Add or update focused Module route/page tests proving the Module page still renders and owns its state through Module route/page logic.

## 4. Note Group Page Model Ownership

- [x] 4.1 Move Note Group route context consumption, Note Group details, source-reading state, Study Card state, Question Card state, metadata actions, deletion, and Question Card generation actions into Note Group-owned route/page hooks, with the primary page model hook named `useNoteGroupPageModel`.
- [x] 4.2 Update Note Group route pages to consume the Note Group-owned page model directly instead of receiving a page-specific model from the app shell.
- [x] 4.3 Add or update focused Note Group route/page tests proving the Note Group page still renders and owns its state through Note Group route/page logic.

## 5. Concept Page Model Ownership

- [x] 5.1 Move Concept route context consumption, Concept details, Concept Study Cards, Concept Question Cards, Concept Mind Map state, metadata actions, deletion, and Knowledge Node regeneration actions into Concept-owned route/page hooks, with the primary page model hook named `useConceptPageModel`.
- [x] 5.2 Update Concept route pages to consume the Concept-owned page model directly instead of receiving a page-specific model from the app shell.
- [x] 5.3 Add or update focused Concept route/page tests proving the Concept page still renders and owns its state through Concept route/page logic.

## 6. Remaining Workflow Extraction

- [x] 6.1 Move Review workflow state and actions currently held by the app shell into Review-owned hooks or dialogs unless they are genuinely global.
- [x] 6.2 Move Tutor Chat state and actions currently held by the app shell into Tutor Chat-owned hooks or dialogs while preserving Module, Note Group, and Concept context behavior.
- [x] 6.3 Move Reading workflow state and actions currently held by the app shell into Reading or Note Group-owned modules.
- [x] 6.4 Move Subject management state and actions currently held by the app shell into Subject-owned modules.
- [x] 6.5 Move remaining shared formatting, route, and workflow helpers from the app shell into focused `lib`, hook, or feature modules only when they have more than one owner.

## 7. Delete Legacy Controller

- [x] 7.1 Remove all remaining page-specific bridge prop objects from the app-shell layer.
- [x] 7.2 Delete `frontend/src/features/app-shell/LegacyApp.jsx` after its responsibilities have moved into appropriately named files.
- [x] 7.3 Remove obsolete imports, compatibility aliases, selected entity state, refs, and route restoration effects made unnecessary by route-owned page models.
- [x] 7.4 Run the file-size guardrail and split any replacement app-shell, route page, page model, or workflow `.js` or `.jsx` file that exceeds 1000 lines.

## 8. Verification

- [x] 8.1 Run `npm run test` from `frontend/`.
- [x] 8.2 Run `npm run build` from `frontend/`.
- [x] 8.3 Manually verify representative Subject index, Module overview, Note Group overview, Concept overview, Review, Tutor Chat, Reading, Study Card, and Question Card flows.
- [x] 8.4 Confirm no maintained frontend `.js` or `.jsx` source file exceeds 1000 lines and `LegacyApp.jsx` no longer exists.
