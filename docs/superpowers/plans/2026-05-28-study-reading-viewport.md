# Study Reading Viewport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Note Group Study fit inside the outlet viewport with an internal scrolling reading body and a bottom-centered pinned Study Card panel.

**Architecture:** Keep the existing Note Group Study branch in `StudyScopeContent`. Add Study-specific classes to separate the non-scrolling Study header/toggle from the scrollable reading body, then update CSS so both Source Text and Derived Study Cards use the same bounded internal scroll region. Keep all existing pinned Study Card behavior unchanged.

**Tech Stack:** React, Vite, Vitest, `renderToStaticMarkup`, existing CSS.

---

## File Structure

- Modify `frontend/src/features/study-scope/StudyScopeContent.jsx`: add Study viewport/layout classes to the inline Study section, header/toggle row, and reading body containers.
- Modify `frontend/src/features/study-scope/StudyScopeContent.test.jsx`: assert Source Text and Derived Study Cards modes render the bounded Study layout classes, and that pinned panel behavior remains present.
- Modify `frontend/src/styles.css`: add viewport-fit Study layout CSS, make inline reading content internally scrollable, center `.source-lookup-floating`, and add bottom padding for Source Text when pinned.

## Task 1: Add Bounded Study Layout Markup

**Files:**
- Modify: `frontend/src/features/study-scope/StudyScopeContent.jsx`
- Modify: `frontend/src/features/study-scope/StudyScopeContent.test.jsx`

- [ ] **Step 1: Update failing Derived Study Cards layout test**

In `frontend/src/features/study-scope/StudyScopeContent.test.jsx`, update the first inline Study test, `"renders friendly Study mode labels and derived Study Card content"`, by adding these expectations after the existing mode label assertions:

```jsx
expect(html).toContain('class="panel inline-study-panel"');
expect(html).toContain("inline-study-header");
expect(html).toContain("reading-content inline-reading-content inline-study-scroll");
```

- [ ] **Step 2: Update failing Source Text layout test**

In the `"renders highlighted Source Text with wrapped controls and pinned card preview"` test in `frontend/src/features/study-scope/StudyScopeContent.test.jsx`, add:

```jsx
expect(html).toContain('class="panel inline-study-panel"');
expect(html).toContain("inline-study-header");
expect(html).toContain("reading-content inline-reading-content inline-study-scroll");
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
cd frontend && npm run test -- StudyScopeContent.test.jsx
```

Expected: the test file fails because `inline-study-panel`, `inline-study-header`, and `inline-study-scroll` are not rendered yet.

- [ ] **Step 4: Add Study layout classes**

In `frontend/src/features/study-scope/StudyScopeContent.jsx`, change the inline Study section from:

```jsx
<section className={classes.panel} id="note-group-study">
```

to:

```jsx
<section className={`${classes.panel} inline-study-panel`} id="note-group-study">
```

Change the header/toggle wrapper from:

```jsx
<div className="flex flex-wrap items-start justify-between gap-3">
```

to:

```jsx
<div className="inline-study-header flex flex-wrap items-start justify-between gap-3">
```

Change both inline Study reading body containers from:

```jsx
<div className="reading-content inline-reading-content" ref={readingContentRef}>
```

to:

```jsx
<div className="reading-content inline-reading-content inline-study-scroll" ref={readingContentRef}>
```

This applies to both Source Text mode and Derived Study Cards mode.

- [ ] **Step 5: Run task tests**

Run:

```bash
cd frontend && npm run test -- StudyScopeContent.test.jsx
```

Expected: the test file passes.

- [ ] **Step 6: Commit**

Run:

```bash
git add frontend/src/features/study-scope/StudyScopeContent.jsx frontend/src/features/study-scope/StudyScopeContent.test.jsx
git commit -m "fix: add inline study viewport classes"
```

## Task 2: Constrain Study Reading Body and Center Pinned Panel

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/features/study-scope/StudyScopeContent.test.jsx`

- [ ] **Step 1: Add CSS regression test**

In `frontend/src/features/study-scope/StudyScopeContent.test.jsx`, import `fs` and `path` at the top:

```jsx
import fs from "node:fs";
import path from "node:path";
```

Then add this test inside the `"NoteGroupScopeContent inline Study route"` describe block:

```jsx
test("defines bounded inline Study reading layout styles", () => {
  const css = fs.readFileSync(
    path.resolve(process.cwd(), "src/styles.css"),
    "utf8"
  );

  expect(css).toContain(".inline-study-panel");
  expect(css).toContain("max-height: calc(100svh - 220px)");
  expect(css).toContain(".inline-study-header");
  expect(css).toContain(".inline-study-scroll");
  expect(css).toContain("overflow-y: auto");
  expect(css).toContain("overscroll-behavior: contain");
  expect(css).toContain(".source-lookup-floating");
  expect(css).toContain("margin-inline: auto");
  expect(css).toContain(".clean-source.has-pin");
  expect(css).toContain("padding-bottom: 240px");
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd frontend && npm run test -- StudyScopeContent.test.jsx
```

Expected: the CSS regression test fails because the new layout CSS has not been added and `.source-lookup-floating` still uses `margin-left: auto`.

- [ ] **Step 3: Add bounded Study layout CSS**

In `frontend/src/styles.css`, replace the existing inline reading content rule:

```css
.inline-reading-content {
  margin-top: 18px;
  max-height: none;
}
```

with:

```css
.inline-study-panel {
  display: flex;
  flex-direction: column;
  max-height: calc(100svh - 220px);
  min-height: min(680px, calc(100svh - 220px));
  overflow: hidden;
}

.inline-study-header {
  flex: 0 0 auto;
}

.inline-reading-content {
  margin-top: 18px;
}

.inline-study-scroll {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 8px;
}
```

- [ ] **Step 4: Center the pinned Study Card panel**

In `frontend/src/styles.css`, update `.source-lookup-floating` from:

```css
  margin-left: auto;
```

to:

```css
  margin-inline: auto;
```

Keep `position: sticky`, `bottom: 0`, and `width: min(420px, 100%)` unchanged.

- [ ] **Step 5: Add Source Text bottom padding for pinned panel**

In `frontend/src/styles.css`, add this rule after `.clean-source`:

```css
.clean-source.has-pin {
  padding-bottom: 240px;
}
```

Leave the existing `.clean-source.has-pin p`, heading, and bullet opacity rules unchanged.

- [ ] **Step 6: Run task tests**

Run:

```bash
cd frontend && npm run test -- StudyScopeContent.test.jsx
```

Expected: the test file passes.

- [ ] **Step 7: Commit**

Run:

```bash
git add frontend/src/styles.css frontend/src/features/study-scope/StudyScopeContent.test.jsx
git commit -m "fix: bound inline study reading viewport"
```

## Task 3: Final Verification

**Files:**
- Verify: frontend tests and production build.

- [ ] **Step 1: Run focused tests**

Run:

```bash
cd frontend && npm run test -- StudyScopeContent.test.jsx useReadingWorkflowActions.test.js StudyAppMainContent.test.jsx
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full frontend tests**

Run:

```bash
cd frontend && npm run test
```

Expected: all frontend tests pass.

- [ ] **Step 3: Run production build**

Run:

```bash
cd frontend && npm run build
```

Expected: the build succeeds. Existing Vite chunk-size or Node deprecation warnings are acceptable if no errors are emitted.

- [ ] **Step 4: Check git status**

Run:

```bash
git status --short
```

Expected: no uncommitted tracked files. The local `.superpowers/` visual companion directory may appear as untracked and should not be added to implementation commits.

- [ ] **Step 5: Manual browser verification**

Run the app locally if it is not already running:

```bash
cd frontend && npm run dev
```

Open a Note Group Study route, switch between Source Text and Derived Study Cards, and verify:

- The Study header and Source Text / Derived Study Cards toggle remain visible.
- The reading body scrolls internally.
- The pinned Study Card panel stays at the bottom center of the reading column.
- Last Source Text lines can scroll above the pinned panel.
