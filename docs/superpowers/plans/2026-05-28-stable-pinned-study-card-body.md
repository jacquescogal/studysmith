# Stable Pinned Study Card Body Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the pinned Study Card text body at a stable height while allowing overflowing content to scroll.

**Architecture:** Keep the existing pinned Study Card panel structure in `StudyScopeContent`. Change only the CSS for `.source-lookup-study-card-body` and strengthen the existing CSS regression test so it verifies stable body height and scroll behavior.

**Tech Stack:** React, Vite, Vitest, CSS.

---

## File Structure

- Modify `frontend/src/styles.css`: change `.source-lookup-study-card-body` from `max-height: 180px` to a stable `height: 180px`, keeping overflow and accessibility-related behavior intact.
- Modify `frontend/src/features/study-scope/StudyScopeContent.test.jsx`: extend the existing CSS regression test to assert the stable body height and continued vertical scrolling.

## Task 1: Stabilize Pinned Study Card Body Height

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/features/study-scope/StudyScopeContent.test.jsx`

- [ ] **Step 1: Update failing CSS regression test**

In `frontend/src/features/study-scope/StudyScopeContent.test.jsx`, inside the existing `"defines bounded inline Study reading layout styles"` test, add these assertions after the existing source lookup assertions:

```jsx
expect(css).toContain(".source-lookup-study-card-body");
expect(css).toContain("height: 180px");
expect(css).toContain("overflow-y: auto");
```

Also remove any assertion that would require `.source-lookup-study-card-body` to use `max-height: 180px` if such an assertion exists. At the time this plan was written, no such assertion exists.

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
cd frontend && npm run test -- StudyScopeContent.test.jsx
```

Expected: the CSS regression test fails because `.source-lookup-study-card-body` still uses `max-height: 180px`, not `height: 180px`.

- [ ] **Step 3: Update pinned Study Card body CSS**

In `frontend/src/styles.css`, change:

```css
.source-lookup-study-card-body {
  max-height: 180px;
  overflow-y: auto;
  padding-right: 6px;
  white-space: pre-wrap;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--muted);
}
```

to:

```css
.source-lookup-study-card-body {
  height: 180px;
  overflow-y: auto;
  padding-right: 6px;
  white-space: pre-wrap;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--muted);
}
```

Do not change the `tabIndex={0}` or `aria-label="Pinned Study Card content"` markup in `StudyScopeContent.jsx`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd frontend && npm run test -- StudyScopeContent.test.jsx
```

Expected: the test file passes.

- [ ] **Step 5: Commit**

Run:

```bash
git add frontend/src/styles.css frontend/src/features/study-scope/StudyScopeContent.test.jsx
git commit -m "fix: stabilize pinned study card body height"
```

## Task 2: Final Verification

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

Expected: build succeeds. Existing Vite chunk-size or Node deprecation warnings are acceptable if no errors are emitted.

- [ ] **Step 4: Check git status**

Run:

```bash
git status --short
```

Expected: no uncommitted tracked files. The local `.superpowers/` visual companion directory may appear as untracked and should not be added to implementation commits.

- [ ] **Step 5: Manual browser verification**

Open a Note Group Study route with a pinned Study Card. Click previous and next between short and long Study Cards and verify:

- The pinned Study Card text body height stays stable.
- Long Study Card content scrolls inside the body.
- The surrounding controls, title, and Back to Derived Study Cards button keep their natural height.
