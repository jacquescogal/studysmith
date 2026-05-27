# View Cards and Source Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove redundant View Cards Back buttons and improve Note Group Source Text lookup with a sticky, scrollable pinned Study Card panel plus previous/next Study Card pinning.

**Architecture:** Keep route behavior unchanged. Make the visible UI changes in `StudyScopeContent`, `StudyAppMainContent`, and `styles.css`; keep Study Card pinning behavior in `useReadingWorkflowActions`; pass new handlers through the existing app shell workflow action model.

**Tech Stack:** React, Vite, Vitest, `renderToStaticMarkup`, lucide-react icons, existing CSS.

---

## File Structure

- Modify `frontend/src/features/app-shell/StudyAppMainContent.jsx`: remove the Module View Cards Back button and pass adjacent Study Card pin handlers into scope content.
- Modify `frontend/src/features/app-shell/StudyAppMainContent.test.jsx`: assert Module View Cards no longer renders the Back button.
- Modify `frontend/src/features/app-shell/StudyAppShell.jsx`: include the new adjacent Study Card pin handlers in the workflow action destructure and model.
- Modify `frontend/src/features/app-shell/useStudyAppWorkflowActions.js`: pass `studyNoteSections` into the reading hook and return the new handlers.
- Modify `frontend/src/features/reading/useReadingWorkflowActions.js`: add previous/next Study Card pinning by Derived Study Cards order.
- Modify `frontend/src/features/reading/useReadingWorkflowActions.test.js`: cover wraparound previous/next pinning and no-op empty lists.
- Modify `frontend/src/features/study-scope/StudyScopeContent.jsx`: remove scope View Cards Back buttons; replace the hover popover pinned-card preview with sticky scrollable panel content and adjacent Study Card buttons.
- Modify `frontend/src/features/study-scope/StudyScopeContent.test.jsx`: assert scope View Cards has no Back button and Source Text panel has scrollable full content plus previous/next controls.
- Modify `frontend/src/styles.css`: update `.source-lookup-floating`, remove hover popover behavior, add scrollable pinned content styles.

## Task 1: Remove View Cards Back Buttons

**Files:**
- Modify: `frontend/src/features/study-scope/StudyScopeContent.jsx`
- Modify: `frontend/src/features/study-scope/StudyScopeContent.test.jsx`
- Modify: `frontend/src/features/app-shell/StudyAppMainContent.jsx`
- Modify: `frontend/src/features/app-shell/StudyAppMainContent.test.jsx`

- [ ] **Step 1: Update failing scope View Cards test**

In `frontend/src/features/study-scope/StudyScopeContent.test.jsx`, rename the existing View Cards test and change the assertion:

```jsx
test("Note Group View Cards route renders without a local Back button", () => {
  const html = renderToStaticMarkup(
    <NoteGroupScopeContent
      shouldHoldContent={false}
      isViewCardsPage
      isMindMapPage={false}
      isInlineStudyPage={false}
      isStudyPage={false}
      isQuestionPage={false}
      isConceptScope={false}
      noteGroupCardTable={{ rows: [], unlinked_question_count: 0 }}
      noteGroupCardTableLoading={false}
      noteGroupCardTableError=""
      studyCards={[]}
      questionCards={[]}
      concepts={[]}
      canEditCurrentCards={false}
      canUseProtectedActions={false}
      editingStudyCardId=""
      editingStudyCard={{ title: "", content: "" }}
      editingQuestionCardId=""
      editingQuestionCard={{
        type: "mcq",
        prompt: "",
        optionsText: "",
        correctIndicesText: "",
        refs: []
      }}
      classes={classes}
      handleBackToOverview={vi.fn()}
      handleEditStudyCard={vi.fn()}
      setEditingStudyCard={vi.fn()}
      handleSaveStudyCard={vi.fn()}
      setEditingStudyCardId={vi.fn()}
      handleDeleteStudyCard={vi.fn()}
      handleEditQuestionCard={vi.fn()}
      setEditingQuestionCard={vi.fn()}
      handleSaveQuestionCard={vi.fn()}
      setEditingQuestionCardId={vi.fn()}
      handleDeleteQuestionCard={vi.fn()}
    />
  );

  expect(html).toContain("<h2>View Cards</h2>");
  expect(html).not.toContain("← Back");
  expect(html).not.toContain("Overview");
});
```

Add a Concept View Cards assertion in the same describe block:

```jsx
test("Concept View Cards route renders without a local Back button", () => {
  const html = renderToStaticMarkup(
    <ConceptScopeContent
      shouldHoldContent={false}
      isViewCardsPage
      isMindMapPage={false}
      isInlineStudyPage={false}
      isStudyPage={false}
      isQuestionPage={false}
      isConceptScope
      conceptCardTableRows={[]}
      studyCards={[]}
      questionCards={[]}
      concepts={[]}
      selectedConcept={{ id: "concept-1", label: "Elasticity" }}
      canEditCurrentCards={false}
      canUseProtectedActions={false}
      editingStudyCardId=""
      editingStudyCard={{ title: "", content: "" }}
      editingQuestionCardId=""
      editingQuestionCard={{
        type: "mcq",
        prompt: "",
        optionsText: "",
        correctIndicesText: "",
        refs: []
      }}
      classes={classes}
      handleBackToOverview={vi.fn()}
      handleEditStudyCard={vi.fn()}
      setEditingStudyCard={vi.fn()}
      handleSaveStudyCard={vi.fn()}
      setEditingStudyCardId={vi.fn()}
      handleDeleteStudyCard={vi.fn()}
      handleEditQuestionCard={vi.fn()}
      setEditingQuestionCard={vi.fn()}
      handleSaveQuestionCard={vi.fn()}
      setEditingQuestionCardId={vi.fn()}
      handleDeleteQuestionCard={vi.fn()}
    />
  );

  expect(html).toContain("<h2>View Cards</h2>");
  expect(html).not.toContain("← Back");
});
```

- [ ] **Step 2: Update failing Module View Cards test**

In `frontend/src/features/app-shell/StudyAppMainContent.test.jsx`, inside the existing `"does not keep Mind Map selected on explicit View Cards routes"` test, add:

```jsx
expect(html).toContain("<h2>View Cards</h2>");
expect(html).not.toContain("← Back");
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
cd frontend && npm run test -- StudyScopeContent.test.jsx StudyAppMainContent.test.jsx
```

Expected: tests fail because the View Cards branches still render `← Back`.

- [ ] **Step 4: Remove scope View Cards Back button**

In `frontend/src/features/study-scope/StudyScopeContent.jsx`, replace the `isViewCardsPage` header section with:

```jsx
<section className="flex flex-wrap items-start gap-3">
  <div>
    <h2>View Cards</h2>
    <p className={classes.mutedText}>
      Study Cards with their linked Question Cards.
    </p>
  </div>
</section>
```

Leave the following `<NoteGroupViewCards />` call unchanged.

- [ ] **Step 5: Remove Module View Cards Back button**

In `frontend/src/features/app-shell/StudyAppMainContent.jsx`, replace the Module View Cards header section with:

```jsx
<section className="flex flex-wrap items-start gap-3">
  <div>
    <h2>View Cards</h2>
    <p className={mutedTextClass}>Study Cards with their linked Question Cards across this Module.</p>
  </div>
</section>
```

Leave the following `<NoteGroupViewCards />` call unchanged.

- [ ] **Step 6: Run task tests**

Run:

```bash
cd frontend && npm run test -- StudyScopeContent.test.jsx StudyAppMainContent.test.jsx
```

Expected: both files pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add frontend/src/features/study-scope/StudyScopeContent.jsx frontend/src/features/study-scope/StudyScopeContent.test.jsx frontend/src/features/app-shell/StudyAppMainContent.jsx frontend/src/features/app-shell/StudyAppMainContent.test.jsx
git commit -m "fix: remove view cards back buttons"
```

## Task 2: Make Pinned Source Lookup Panel Sticky and Scrollable

**Files:**
- Modify: `frontend/src/features/study-scope/StudyScopeContent.jsx`
- Modify: `frontend/src/features/study-scope/StudyScopeContent.test.jsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Update failing Source Text panel test**

In `frontend/src/features/study-scope/StudyScopeContent.test.jsx`, update the pinned Source Text test content string and expectations:

```jsx
content: "Full pinned Study Card content should be visible in a scrollable panel instead of hidden behind hover."
```

Replace the hover-related expectations with:

```jsx
expect(html).toContain("source-lookup-study-card-body");
expect(html).toContain("Full pinned Study Card content should be visible in a scrollable panel instead of hidden behind hover.");
expect(html).not.toContain("pinned-study-card-popover");
```

Leave the existing `expect(html).toContain("Study Card 2 of 2");` assertion in place for this task. Task 3 changes that label from source-range count to Derived Study Cards position.

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
cd frontend && npm run test -- StudyScopeContent.test.jsx
```

Expected: the test fails because the current markup still renders `.pinned-study-card-popover` and does not render `.source-lookup-study-card-body`.

- [ ] **Step 3: Remove clipped preview helper usage**

In `frontend/src/features/study-scope/StudyScopeContent.jsx`, remove the `clipStudyCardBody` function:

```jsx
const clipStudyCardBody = (content = "") => {
  const text = content.trim();
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
};
```

- [ ] **Step 4: Replace pinned Study Card preview markup**

In `frontend/src/features/study-scope/StudyScopeContent.jsx`, replace:

```jsx
<div className="pinned-study-card-preview" tabIndex={0}>
  <p className="label">Pinned Study Card</p>
  <h3>{pinnedStudyCard.title || "Untitled Study Card"}</h3>
  <p>{clipStudyCardBody(pinnedStudyCard.content || "")}</p>
  <div className="pinned-study-card-popover" role="tooltip">
    {pinnedStudyCard.content || "No Study Card content."}
  </div>
</div>
```

with:

```jsx
<div className="pinned-study-card-preview">
  <p className="label">Pinned Study Card</p>
  <h3>{pinnedStudyCard.title || "Untitled Study Card"}</h3>
  <div className="source-lookup-study-card-body">
    {pinnedStudyCard.content || "No Study Card content."}
  </div>
</div>
```

- [ ] **Step 5: Update CSS for sticky bottom and scrollable content**

In `frontend/src/styles.css`, update the source lookup styles to:

```css
.source-lookup-floating {
  position: sticky;
  bottom: 0;
  z-index: 6;
  width: min(420px, 100%);
  margin-left: auto;
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(31, 44, 74, 0.12);
  border-radius: 10px 10px 0 0;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 -10px 28px rgba(31, 44, 74, 0.14);
}

.pinned-study-card-preview {
  border-top: 1px solid rgba(31, 44, 74, 0.08);
  padding-top: 8px;
  min-height: 0;
}

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

Remove the `.pinned-study-card-popover` block and the hover/focus rules that display it.

- [ ] **Step 6: Run task tests**

Run:

```bash
cd frontend && npm run test -- StudyScopeContent.test.jsx
```

Expected: the file passes.

- [ ] **Step 7: Commit**

Run:

```bash
git add frontend/src/features/study-scope/StudyScopeContent.jsx frontend/src/features/study-scope/StudyScopeContent.test.jsx frontend/src/styles.css
git commit -m "fix: make source lookup card panel scrollable"
```

## Task 3: Add Previous and Next Study Card Pinning

**Files:**
- Modify: `frontend/src/features/reading/useReadingWorkflowActions.js`
- Modify: `frontend/src/features/reading/useReadingWorkflowActions.test.js`
- Modify: `frontend/src/features/app-shell/useStudyAppWorkflowActions.js`
- Modify: `frontend/src/features/app-shell/StudyAppShell.jsx`
- Modify: `frontend/src/features/app-shell/StudyAppMainContent.jsx`
- Modify: `frontend/src/features/study-scope/StudyScopeContent.jsx`
- Modify: `frontend/src/features/study-scope/StudyScopeContent.test.jsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Add failing hook tests**

In `frontend/src/features/reading/useReadingWorkflowActions.test.js`, add:

```js
test("pins next and previous Study Cards by Derived Study Cards order", () => {
  const querySelector = vi.fn(() => ({ scrollIntoView: vi.fn() }));
  const setReadingPinnedCardId = vi.fn();
  const setReadingHoverCardId = vi.fn();
  const setActiveSourceRangeIndex = vi.fn();
  const originalWindow = globalThis.window;
  globalThis.window = immediateWindow();

  const actions = useReadingWorkflowActions({
    activeSourceRangeIndex: 0,
    readingContentRef: { current: { querySelector } },
    readingHoverCardId: "",
    readingMode: "clean",
    readingPinnedCardId: "card-2",
    studyNoteSections: [
      { study_card_id: "card-1" },
      { study_card_id: "card-2" },
      { study_card_id: "card-3" }
    ],
    setActiveSourceRangeIndex,
    setReadingHoverCardId,
    setReadingMode: vi.fn(),
    setReadingPinnedCardId
  });

  actions.handleReadingNextStudyCard();
  expect(setReadingPinnedCardId).toHaveBeenCalledWith("card-3");
  expect(setReadingHoverCardId).toHaveBeenCalledWith("card-3");
  expect(setActiveSourceRangeIndex).toHaveBeenCalledWith(0);
  expect(querySelector).toHaveBeenCalledWith(
    '[data-clean-card-id="card-3"][data-source-range-index="0"]'
  );

  actions.handleReadingPreviousStudyCard();
  expect(setReadingPinnedCardId).toHaveBeenCalledWith("card-1");
  expect(setReadingHoverCardId).toHaveBeenCalledWith("card-1");
  globalThis.window = originalWindow;
});

test("wraps adjacent Study Card pinning at the ends", () => {
  const querySelector = vi.fn(() => ({ scrollIntoView: vi.fn() }));
  const setReadingPinnedCardId = vi.fn();
  const originalWindow = globalThis.window;
  globalThis.window = immediateWindow();

  const actions = useReadingWorkflowActions({
    activeSourceRangeIndex: 0,
    readingContentRef: { current: { querySelector } },
    readingHoverCardId: "",
    readingMode: "clean",
    readingPinnedCardId: "card-3",
    studyNoteSections: [
      { study_card_id: "card-1" },
      { study_card_id: "card-2" },
      { study_card_id: "card-3" }
    ],
    setActiveSourceRangeIndex: vi.fn(),
    setReadingHoverCardId: vi.fn(),
    setReadingMode: vi.fn(),
    setReadingPinnedCardId
  });

  actions.handleReadingNextStudyCard();
  expect(setReadingPinnedCardId).toHaveBeenCalledWith("card-1");
  globalThis.window = originalWindow;
});

test("does not pin adjacent Study Cards when no Derived Study Cards are available", () => {
  const setReadingPinnedCardId = vi.fn();

  const actions = useReadingWorkflowActions({
    activeSourceRangeIndex: 0,
    readingContentRef: { current: { querySelector: vi.fn() } },
    readingHoverCardId: "",
    readingMode: "clean",
    readingPinnedCardId: "card-3",
    studyNoteSections: [],
    setActiveSourceRangeIndex: vi.fn(),
    setReadingHoverCardId: vi.fn(),
    setReadingMode: vi.fn(),
    setReadingPinnedCardId
  });

  actions.handleReadingNextStudyCard();
  actions.handleReadingPreviousStudyCard();
  expect(setReadingPinnedCardId).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run hook tests and verify failure**

Run:

```bash
cd frontend && npm run test -- useReadingWorkflowActions.test.js
```

Expected: tests fail because `handleReadingNextStudyCard` and `handleReadingPreviousStudyCard` are not returned.

- [ ] **Step 3: Implement adjacent pin handlers in the hook**

In `frontend/src/features/reading/useReadingWorkflowActions.js`, add `studyNoteSections = []` to the function parameters:

```js
export function useReadingWorkflowActions({
  activeSourceRangeIndex = 0,
  readingContentRef,
  readingHoverCardId,
  readingMode,
  readingPinnedCardId,
  studyNoteSections = [],
  setActiveSourceRangeIndex = () => {},
  setReadingHoverCardId,
  setReadingMode,
  setReadingPinnedCardId
}) {
```

Then add this helper and handlers before `handleReadingUnpin`:

```js
  const getAdjacentStudyCardId = (direction) => {
    const orderedIds = studyNoteSections
      .map((section) => section.study_card_id)
      .filter(Boolean);
    if (!orderedIds.length) {
      return "";
    }
    const currentIndex = orderedIds.indexOf(readingPinnedCardId);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      direction === "previous"
        ? (baseIndex - 1 + orderedIds.length) % orderedIds.length
        : (baseIndex + 1) % orderedIds.length;
    return orderedIds[nextIndex];
  };

  const pinAdjacentStudyCard = (direction) => {
    const nextStudyCardId = getAdjacentStudyCardId(direction);
    if (!nextStudyCardId) {
      return;
    }
    setReadingPinnedCardId(nextStudyCardId);
    setReadingHoverCardId(nextStudyCardId);
    setActiveSourceRangeIndex(0);
    scrollToCleanSourceRange(nextStudyCardId, 0);
  };

  const handleReadingNextStudyCard = () => {
    pinAdjacentStudyCard("next");
  };

  const handleReadingPreviousStudyCard = () => {
    pinAdjacentStudyCard("previous");
  };
```

Return the new handlers:

```js
    handleReadingNextStudyCard,
    handleReadingPreviousStudyCard,
```

- [ ] **Step 4: Run hook tests**

Run:

```bash
cd frontend && npm run test -- useReadingWorkflowActions.test.js
```

Expected: hook tests pass.

- [ ] **Step 5: Wire handlers through app workflow actions**

In `frontend/src/features/app-shell/useStudyAppWorkflowActions.js`, include the new handlers in the hook destructure:

```js
    handleReadingNextStudyCard,
    handleReadingPreviousStudyCard,
```

Pass `studyNoteSections` into `useReadingWorkflowActions`:

```js
    studyNoteSections,
```

Return the new handlers from the final return object:

```js
    handleReadingNextStudyCard,
    handleReadingPreviousStudyCard,
```

In `frontend/src/features/app-shell/StudyAppShell.jsx`, add both names wherever reading handlers are destructured from `useStudyAppWorkflowActions` and included in the model:

```jsx
handleReadingNextStudyCard,
handleReadingPreviousStudyCard,
```

In `frontend/src/features/app-shell/StudyAppMainContent.jsx`, destructure both handlers from `model` and pass them into `StudyScopeRouteContent`:

```jsx
handleReadingNextStudyCard={handleReadingNextStudyCard}
handleReadingPreviousStudyCard={handleReadingPreviousStudyCard}
```

- [ ] **Step 6: Add failing pinned panel render expectations**

In `frontend/src/features/study-scope/StudyScopeContent.test.jsx`, add these props to the pinned Source Text test:

```jsx
studyNoteSections={[
  { study_card_id: "card-1", title: "Pinned card", content: "Pinned content" },
  { study_card_id: "card-2", title: "Next card", content: "Next content" },
  { study_card_id: "card-3", title: "Final card", content: "Final content" }
]}
handleReadingPreviousStudyCard={vi.fn()}
handleReadingNextStudyCard={vi.fn()}
```

Add expectations:

```jsx
expect(html).toContain("Study Card 1 of 3");
expect(html).toContain("Source range 2 of 2");
expect(html).toContain("aria-label=\"Pin previous Study Card\"");
expect(html).toContain("aria-label=\"Pin next Study Card\"");
```

Replace the old source-range-only label assertion:

```jsx
expect(html).toContain("Study Card 2 of 2");
```

- [ ] **Step 7: Render previous and next Study Card buttons**

In `frontend/src/features/study-scope/StudyScopeContent.jsx`, update the import:

```jsx
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Search, X } from "lucide-react";
```

Add `handleReadingNextStudyCard` and `handleReadingPreviousStudyCard` to the component props near the existing source-range handlers:

```jsx
  handleReadingNextStudyCard,
  handleReadingPreviousStudyCard,
```

In `frontend/src/features/study-scope/StudyScopeContent.jsx`, add these constants near the start of the component after the `shouldHoldContent` branch is skipped and before the `isMindMapPage` branch:

```jsx
  const pinnedStudyCardOrderIndex = studyNoteSections.findIndex(
    (section) => section.study_card_id === readingPinnedCardId
  );
  const pinnedStudyCardPositionLabel =
    pinnedStudyCardOrderIndex >= 0
      ? `Study Card ${pinnedStudyCardOrderIndex + 1} of ${studyNoteSections.length}`
      : "Pinned Study Card";
  const sourceRangePositionLabel = pinnedSourceRanges.length
    ? `Source range ${Math.min(activeSourceRangeIndex + 1, pinnedSourceRanges.length)} of ${
        pinnedSourceRanges.length
      }`
    : "";
```

In `.source-lookup-nav`, replace the existing label:

```jsx
<span>
  Study Card {Math.min(activeSourceRangeIndex + 1, pinnedSourceRanges.length)} of{" "}
  {pinnedSourceRanges.length}
</span>
```

with:

```jsx
<span>
  {pinnedStudyCardPositionLabel}
  {sourceRangePositionLabel ? (
    <small className="source-range-count">{sourceRangePositionLabel}</small>
  ) : null}
</span>
```

Then place the Study Card buttons before the source-range up/down buttons:

```jsx
<button
  type="button"
  aria-label="Pin previous Study Card"
  onClick={handleReadingPreviousStudyCard}
>
  <ArrowLeft size={15} aria-hidden="true" />
</button>
<button
  type="button"
  aria-label="Pin next Study Card"
  onClick={handleReadingNextStudyCard}
>
  <ArrowRight size={15} aria-hidden="true" />
</button>
```

Keep the existing up/down source-range buttons and the `Back to Derived Study Cards` button.

In `frontend/src/styles.css`, add:

```css
.source-range-count {
  display: block;
  margin-top: 2px;
  font-size: 0.72rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--muted) 82%, #fff);
}
```

- [ ] **Step 8: Run task tests**

Run:

```bash
cd frontend && npm run test -- useReadingWorkflowActions.test.js StudyScopeContent.test.jsx StudyAppMainContent.test.jsx
```

Expected: all three files pass.

- [ ] **Step 9: Commit**

Run:

```bash
git add frontend/src/features/reading/useReadingWorkflowActions.js frontend/src/features/reading/useReadingWorkflowActions.test.js frontend/src/features/app-shell/useStudyAppWorkflowActions.js frontend/src/features/app-shell/StudyAppShell.jsx frontend/src/features/app-shell/StudyAppMainContent.jsx frontend/src/features/study-scope/StudyScopeContent.jsx frontend/src/features/study-scope/StudyScopeContent.test.jsx frontend/src/styles.css
git commit -m "fix: add source lookup study card navigation"
```

## Task 4: Final Verification

**Files:**
- Verify: frontend test suite and production build.

- [ ] **Step 1: Run focused tests**

Run:

```bash
cd frontend && npm run test -- useReadingWorkflowActions.test.js StudyScopeContent.test.jsx StudyAppMainContent.test.jsx
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

Expected: no uncommitted files. If verification produces ignored artifacts only, leave them untracked and report them.
