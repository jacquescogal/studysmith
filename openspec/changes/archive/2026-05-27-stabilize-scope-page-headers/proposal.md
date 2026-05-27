## Why

Long Module, Note Group, and Concept titles can cause the page header type chip and right-side action controls to wrap or rearrange in ways that make the header feel unstable. These scope headers also rely too heavily on the type chip for differentiation, so users need stronger visual cues when moving between Module, Note Group, and Concept pages.

## What Changes

- Make page header layout durable for long titles by keeping the type chip, title, breadcrumbs, and action controls in predictable regions.
- Ensure long titles wrap or truncate within their allotted content area without pushing action buttons out of alignment.
- Add stronger, appropriate tone treatments for Module, Note Group, and Concept headers beyond the type chip alone.
- Preserve existing canonical terminology: Module, Note Group, and Concept.
- Preserve current Page Header behavior for Subject and Subjects pages unless shared layout improvements naturally apply.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `frontend-route-architecture`: Scope page headers SHALL remain layout-stable with long titles and provide distinct visual treatments for Module, Note Group, and Concept scopes.

## Impact

- Affected components: `frontend/src/components/layout/PageHeader.jsx` and related tests.
- Affected styles: `frontend/src/styles.css` page header tone and layout rules.
- Affected state helpers: `frontend/src/lib/pageHeaderState.js` only if tone or page type mapping needs adjustment.
- Verification should include long-title rendering tests and responsive checks for Module, Note Group, and Concept headers.
