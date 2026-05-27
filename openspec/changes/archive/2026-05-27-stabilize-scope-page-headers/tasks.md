## 1. Header Regression Coverage

- [x] 1.1 Add `PageHeader` unit coverage for long Module, Note Group, and Concept titles with right-side actions.
- [x] 1.2 Add assertions that the type chip renders in a predictable metadata row separate from the title text flow.
- [x] 1.3 Add assertions that Module, Note Group, and Concept headers expose distinct tone classes or data needed for visual differentiation.

## 2. Durable Header Layout

- [x] 2.1 Refactor `PageHeader` markup so breadcrumbs, metadata chips, title, description, and actions occupy stable layout regions.
- [x] 2.2 Update header CSS so long titles wrap or truncate within the title region without displacing right-side action controls on desktop.
- [x] 2.3 Add responsive CSS so header content stacks intentionally on narrow viewports without overlap or horizontal overflow.
- [x] 2.4 Ensure long unbroken title strings remain contained using appropriate wrapping rules.

## 3. Scope Tone Differentiation

- [x] 3.1 Strengthen Module, Note Group, and Concept header tone treatments beyond the type chip using restrained surface, border, or accent styling.
- [x] 3.2 Ensure Module, Note Group, and Concept tones are visually distinct from each other and remain accessible.
- [x] 3.3 Preserve Subject and Subjects header behavior unless shared layout changes naturally apply.
- [x] 3.4 Preserve canonical labels Module, Note Group, and Concept in header UI and tests.

## 4. Verification

- [x] 4.1 Run `npm run test` from `frontend/`.
- [x] 4.2 Run `npm run test:browser` from `frontend/`.
- [x] 4.3 Run `npm run build` from `frontend/`.
- [x] 4.4 Manually inspect Module, Note Group, and Concept headers with long titles on desktop and mobile widths.
- [x] 4.5 Confirm no maintained frontend `.js` or `.jsx` source file exceeds 1000 lines.
