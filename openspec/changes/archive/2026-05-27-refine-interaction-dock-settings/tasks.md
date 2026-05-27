## 1. Regression Coverage

- [x] 1.1 Add dock tests that Module, Note Group, and Concept overview routes mark Mind Map as the default selected dock action.
- [x] 1.2 Add route/content tests that explicit View Cards, Study, Study Cards, or Question Cards routes override the default Mind Map dock state.
- [x] 1.3 Add dock tests for a gear icon settings button with scope-specific accessible labels and manage-permission disabled/unavailable behavior.
- [x] 1.4 Add settings modal tests for Module, Note Group, and Concept scopes, including delete Module, rename/delete Note Group, and delete/regenerate-only Concept settings.
- [x] 1.5 Add tests that Concept settings do not render Concept title or description editing controls.
- [x] 1.6 Add tests that Mind Map-adjacent content no longer renders duplicate card-style shortcuts for dock-owned actions.

## 2. Dock Default And Settings Trigger

- [x] 2.1 Update the dock action active-state model so overview routes select Mind Map by default while explicit child routes remain correctly active.
- [x] 2.2 Extend `ScopeInteractionDock` with a gear icon settings button that is visually separate from learning action rows.
- [x] 2.3 Wire Module, Note Group, and Concept dock settings buttons to their scope-specific modal open handlers.
- [x] 2.4 Add responsive styles so the settings gear remains reachable on desktop and narrow viewports without overlapping dock actions.

## 3. Scope Settings Modals

- [x] 3.1 Add delete Module to the existing Module settings modal using the existing Module delete confirmation/action flow.
- [x] 3.2 Rename and adjust the Note Group metadata modal into Note Group settings, preserving title rename and adding delete Note Group.
- [x] 3.3 Add a Concept settings modal that exposes delete Concept and regenerate Concept actions only.
- [x] 3.4 Remove Concept rename and Concept description editing controls from the Concept page/settings workflow.
- [x] 3.5 Ensure settings actions respect existing protected-action and Subject management permission checks.

## 4. Shortcut Cleanup And Documentation

- [x] 4.1 Remove or reduce card-style shortcut sections below Module Mind Map content that only duplicate dock or floating Tutor Chat actions.
- [x] 4.2 Remove or reduce card-style shortcut sections below Note Group Mind Map content that only duplicate dock or floating Tutor Chat actions.
- [x] 4.3 Remove or reduce card-style shortcut sections below Concept Mind Map content that only duplicate dock, settings, or floating Tutor Chat actions.
- [x] 4.4 Preserve stats, progress, generation state, filters, graph-specific regeneration controls, and other non-duplicate management content.
- [x] 4.5 Update `project-lexicon.md` so Concept page management no longer says users can rename Concepts from the Concept page.

## 5. Verification

- [x] 5.1 Run `npm run test` from `frontend/`.
- [x] 5.2 Run `npm run test:browser` from `frontend/`.
- [x] 5.3 Run `npm run build` from `frontend/`.
- [x] 5.4 Manually inspect Module, Note Group, and Concept pages on desktop and narrow viewports for Mind Map default selection, settings modal behavior, and shortcut cleanup.
- [x] 5.5 Confirm no maintained frontend `.js` or `.jsx` source file exceeds 1000 lines.
