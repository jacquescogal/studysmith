## Context

`PageHeader` currently renders breadcrumbs, a type badge, title, optional current badge, description, and right-side actions in a responsive flex layout. Module, Note Group, and Concept pages already provide page type and tone values through `getStudyPageHeader`, and CSS variables define tone colors for the type badge and bottom border.

The reported problem is layout instability with long titles: the type chip and right-side action controls can wrap or shift in ways that make the page header feel rearranged. The visual differentiation between Module, Note Group, and Concept pages is also too subtle because most of the distinction lives in the type chip.

## Goals / Non-Goals

**Goals:**

- Keep the type chip, title, breadcrumbs, and right-side actions in predictable regions when titles are long.
- Let long titles wrap or truncate gracefully without pushing action controls out of alignment.
- Add stronger but restrained tone treatments for Module, Note Group, and Concept headers beyond the type chip.
- Preserve responsive behavior on narrow screens without overlapping text or controls.
- Preserve canonical labels: Module, Note Group, and Concept.

**Non-Goals:**

- Redesigning the entire app shell or route hierarchy.
- Changing page header data ownership.
- Changing backend API names or legacy topic-named adapter fields.
- Adding a new design system or dependency.
- Reworking Subject and Subjects headers beyond shared durability improvements.

## Decisions

### 1. Use a stable header grid/flex structure with dedicated action space

The header should reserve a predictable area for actions on desktop while keeping text in a min-width-constrained content area. The title region should be allowed to wrap within its own column, but actions should remain aligned and should not be pushed below the title by ordinary long titles on desktop.

Alternative considered: keep the current broad flex-wrap behavior and only reduce title font size. That would not solve the action rearrangement problem and would make long-title behavior dependent on content length rather than layout constraints.

### 2. Separate the type chip row from the title text flow

The type chip should remain visually associated with the title, but the title text should not need to share the same wrapping line with the chip. A durable structure is:

```text
Header
├─ eyebrow
├─ breadcrumbs
├─ title block
│  ├─ type chip / optional badge row
│  └─ title
├─ description
└─ actions
```

This keeps the type chip from being pushed into unpredictable positions by long title text.

Alternative considered: leave the chip inline with the title. This is compact for short titles, but it is the source of the reported rearrangement for long titles.

### 3. Strengthen tone through header surface accents, not heavy color blocks

Module, Note Group, and Concept headers should get distinct accent treatments such as a subtle tinted surface, left/top accent rule, or scoped background wash derived from existing tone variables. This should be visible beyond the chip while remaining quiet enough for repeated app use.

The tones should be differentiated by hue and role:

- Module: structured blue or indigo tone.
- Note Group: source/provenance green tone.
- Concept: conceptual map teal/cyan tone.

Alternative considered: large saturated header backgrounds. That would differentiate scopes, but it would make the operational UI feel heavier and could compete with page content.

### 4. Test layout through markup and browser behavior

Unit tests should verify the durable header structure and tone classes. Browser or DOM-level tests should cover long Module, Note Group, and Concept title cases enough to catch wrapping regressions, action displacement, and text overflow.

## Risks / Trade-offs

- **Risk: Header becomes visually too loud** -> Use restrained surface/accent treatments and keep body background neutral.
- **Risk: Actions still wrap on medium widths** -> Reserve action space on desktop and allow intentional stacking only at responsive breakpoints.
- **Risk: Long unbroken words overflow** -> Use CSS such as `overflow-wrap: anywhere` or equivalent on title text.
- **Risk: Tone colors become inaccessible** -> Keep sufficient contrast for type chip text, accent marks, and actions; avoid relying on color alone for page type.
- **Risk: Existing tests are too shallow** -> Add tests for long-title header structure and all three scope tones.
