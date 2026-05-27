# Mind Map Only Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Overview as a Module, Note Group, and Concept route, make Mind Map the default scope view, and ensure Mind Map screens render no content underneath the Mind Map.

**Architecture:** Normalize route helpers and route matching so empty or legacy overview panels resolve to `mind-map`. Then update the app route tree and app-shell rendering branches so Mind Map routes render only Mind Map components while View Cards, Study, and Question Cards routes keep their existing content. Tests drive each route/rendering boundary before implementation.

**Tech Stack:** React, React Router, Vite, Vitest, existing StudySmith frontend components.

---

## File Structure

- Modify `frontend/src/lib/routes.js`: default path helpers to Mind Map and normalize legacy overview route state.
- Modify `frontend/src/lib/routes.test.js`: cover default and legacy overview route matching.
- Modify `frontend/src/routes/appRoutes.jsx`: remove Overview page route concepts from Module, Note Group, and Concept children; index children render Mind Map page wrappers.
- Modify `frontend/src/routes/appRoutes.test.jsx`: assert default scope paths map to Mind Map default route IDs and explicit Mind Map paths still work.
- Modify `frontend/src/routes/pages.jsx`: remove Overview page wrapper exports.
- Modify `frontend/src/routes/pages.test.jsx`: remove Overview page wrapper smoke tests and imports.
- Modify `frontend/src/features/app-shell/StudyAppMainContent.jsx`: render Module Mind Map alone on Module Mind Map/default routes; keep View Cards branch separate; pass an explicit `isMindMapPage` prop to scope content.
- Modify `frontend/src/features/study-scope/StudyScopeContent.jsx`: split Mind Map rendering from the old overview branch and return only the Mind Map card for Note Group and Concept Mind Map routes.
- Modify `frontend/src/features/app-shell/StudyAppMainContent.test.jsx`: verify Module Mind Map/default routes do not render downstream ModuleHomePage content.
- Modify `frontend/src/features/study-scope/StudyScopeContent.test.jsx`: verify Note Group and Concept Mind Map routes do not render overview/progress cards below the Mind Map.
- Modify `frontend/src/features/app-shell/useStudyAppEffects.js`: remove Overview labels from section navigation and default empty route behavior.

## Task 1: Route Helpers Normalize Defaults to Mind Map

**Files:**
- Modify: `frontend/src/lib/routes.js`
- Test: `frontend/src/lib/routes.test.js`

- [ ] **Step 1: Write failing route helper tests**

Add these tests to `frontend/src/lib/routes.test.js` inside `describe("mind map routes", () => { ... })`:

```js
  test("defaults Note Group and Concept paths to Mind Map", () => {
    expect(noteGroupPath("S1", "M1", "N1")).toBe(
      "/app/subject/S1/module/M1/note-groups/N1/mind-map"
    );
    expect(conceptPath("S1", "M1", "C1")).toBe(
      "/app/subject/S1/module/M1/concepts/C1/mind-map"
    );
  });

  test("normalizes empty and legacy overview panels to Mind Map", () => {
    expect(matchAppRoute("/app/subject/S1/module/M1").panel).toBe("mind-map");
    expect(matchAppRoute("/app/subject/S1/module/M1/note-groups/N1").panel).toBe("mind-map");
    expect(matchAppRoute("/app/subject/S1/module/M1/note-groups/N1/overview").panel).toBe("mind-map");
    expect(matchAppRoute("/app/subject/S1/module/M1/concepts/C1").panel).toBe("mind-map");
    expect(matchAppRoute("/app/subject/S1/module/M1/concepts/C1/overview").panel).toBe("mind-map");
  });
```

Also update the import list at the top of `frontend/src/lib/routes.test.js` so `noteGroupPath` is imported:

```js
import {
  conceptPath,
  matchAppRoute,
  moduleMindMapPath,
  moduleViewCardsPath,
  noteGroupMindMapPath,
  noteGroupPath
} from "./routes";
```

- [ ] **Step 2: Run route helper tests and verify failure**

Run:

```bash
cd frontend
npm run test -- routes.test.js
```

Expected: failure showing `noteGroupPath(...)` or `conceptPath(...)` returns the base path, or `matchAppRoute(...).panel` is `""`/`"overview"` instead of `"mind-map"`.

- [ ] **Step 3: Implement route helper normalization**

In `frontend/src/lib/routes.js`, change `noteGroupPath` and `conceptPath` defaults to `mind-map`, and map legacy `overview` callers to the explicit Mind Map route. Use this exact implementation shape:

```js
export const noteGroupPath = (subjectCode, moduleCode, noteGroupCode, panel = "mind-map") => {
  const basePath = `/app/subject/${subjectCode}/module/${moduleCode}/note-groups/${noteGroupCode}`;
  return panel ? `${basePath}/${panel === "overview" ? "mind-map" : panel}` : `${basePath}/mind-map`;
};

export const noteGroupMindMapPath = (subjectCode, moduleCode, noteGroupCode) =>
  noteGroupPath(subjectCode, moduleCode, noteGroupCode, "mind-map");

export const conceptPath = (subjectCode, moduleCode, conceptCode, panel = "mind-map") => {
  const basePath = `/app/subject/${subjectCode}/module/${moduleCode}/concepts/${conceptCode}`;
  return panel ? `${basePath}/${panel === "overview" ? "mind-map" : panel}` : `${basePath}/mind-map`;
};
```

Then introduce a helper near `matchAppRoute`:

```js
const normalizePanel = (panel = "") => (!panel || panel === "overview" ? "mind-map" : panel);
```

Update the `panel` field in the returned object:

```js
    panel: moduleMindMap
      ? "mind-map"
      : moduleViewCards
        ? "view-cards"
        : normalizePanel(noteGroup?.[4] || topic?.[4] || (modulePage ? "mind-map" : "")),
```

- [ ] **Step 4: Run route helper tests and verify pass**

Run:

```bash
cd frontend
npm run test -- routes.test.js
```

Expected: all tests in `routes.test.js` pass.

- [ ] **Step 5: Commit route helper changes**

```bash
git add frontend/src/lib/routes.js frontend/src/lib/routes.test.js
git commit -m "fix: default scope routes to mind map"
```

## Task 2: React Router Tree Removes Overview Route Concepts

**Files:**
- Modify: `frontend/src/routes/appRoutes.jsx`
- Modify: `frontend/src/routes/pages.jsx`
- Modify: `frontend/src/routes/pages.test.jsx`
- Test: `frontend/src/routes/appRoutes.test.jsx`

- [ ] **Step 1: Write failing route tree tests**

In `frontend/src/routes/appRoutes.test.jsx`, update the route expectations for default scope paths:

```js
    ["/app/subject/S1/module/M1", "module-default-mind-map"],
```

```js
    [
      "/app/subject/S1/module/M1/note-groups/N1",
      "note-group-default-mind-map"
    ],
```

```js
    [
      "/app/subject/S1/module/M1/concepts/C1",
      "concept-default-mind-map"
    ],
```

Add this test after the `test.each` block:

```js
  test("does not expose Overview route ids for scope defaults", () => {
    expect(findRouteById(createAppRouteObjects(), "module-overview")).toBeNull();
    expect(findRouteById(createAppRouteObjects(), "note-group-overview")).toBeNull();
    expect(findRouteById(createAppRouteObjects(), "concept-overview")).toBeNull();
  });
```

- [ ] **Step 2: Run app route tests and verify failure**

Run:

```bash
cd frontend
npm run test -- appRoutes.test.jsx
```

Expected: failures showing default paths still map to `*-overview` route IDs and overview route IDs still exist.

- [ ] **Step 3: Update app route tree**

In `frontend/src/routes/appRoutes.jsx`, remove these imports:

```js
  ConceptOverviewPage,
  ModuleOverviewPage,
  NoteGroupOverviewPage,
```

Update `conceptChildren` index route:

```jsx
  {
    index: true,
    id: "concept-default-mind-map",
    element: page(ConceptMindMapPage, renderAppShell)
  },
```

Update the Module index child:

```jsx
                {
                  index: true,
                  id: "module-default-mind-map",
                  element: page(ModuleMindMapPage, renderAppShell)
                },
```

Update the Note Group index child:

```jsx
                    {
                      index: true,
                      id: "note-group-default-mind-map",
                      element: page(NoteGroupMindMapPage, renderAppShell)
                    },
```

Keep explicit `path: "mind-map"` route entries unchanged.

- [ ] **Step 4: Remove Overview page wrapper exports and tests**

In `frontend/src/routes/pages.jsx`, remove these exported wrappers:

```jsx
export function ModuleOverviewPage(props) {
  return <AppShellRoutePage {...props} />;
}
```

```jsx
export function NoteGroupOverviewPage(props) {
  return <AppShellRoutePage {...props} />;
}
```

```jsx
export function ConceptOverviewPage(props) {
  return <AppShellRoutePage {...props} />;
}
```

In `frontend/src/routes/pages.test.jsx`, remove these imports from the top-level import list:

```js
  ConceptOverviewPage,
  ModuleOverviewPage,
  NoteGroupOverviewPage
```

Remove the smoke tests that render those three wrapper components:

```jsx
  test("ModuleOverviewPage renders app shell page content", () => {
    const html = renderToStaticMarkup(
      <ModuleOverviewPage
        params={{ subjectCode: "S1", moduleCode: "M1" }}
        routeId="module-overview"
      />
    );

    expect(html).toContain("module-overview");
  });

  test("NoteGroupOverviewPage renders app shell page content", () => {
    const html = renderToStaticMarkup(
      <NoteGroupOverviewPage
        params={{ subjectCode: "S1", moduleCode: "M1", noteGroupCode: "N1" }}
        routeId="note-group-overview"
      />
    );

    expect(html).toContain("note-group-overview");
  });

  test("ConceptOverviewPage renders app shell page content", () => {
    const html = renderToStaticMarkup(
      <ConceptOverviewPage
        params={{ subjectCode: "S1", moduleCode: "M1", conceptCode: "C1" }}
        routeId="concept-overview"
      />
    );

    expect(html).toContain("concept-overview");
  });
```

- [ ] **Step 5: Run app route tests and verify pass**

Run:

```bash
cd frontend
npm run test -- appRoutes.test.jsx
```

Expected: all app route tests pass.

- [ ] **Step 6: Commit route tree changes**

```bash
git add frontend/src/routes/appRoutes.jsx frontend/src/routes/pages.jsx frontend/src/routes/pages.test.jsx frontend/src/routes/appRoutes.test.jsx
git commit -m "fix: remove overview route entries"
```

## Task 3: Module Mind Map Renders Alone

**Files:**
- Modify: `frontend/src/features/app-shell/StudyAppMainContent.jsx`
- Test: `frontend/src/features/app-shell/StudyAppMainContent.test.jsx`

- [ ] **Step 1: Write failing Module render tests**

In `frontend/src/features/app-shell/StudyAppMainContent.test.jsx`, add a mock for the feature Module Mind Map component near existing mocks:

```js
vi.mock("@/features/modules/ModuleMindMapPage", () => ({
  ModuleMindMapPage: vi.fn(() => <section id="module-mind-map">Module Mind Map only</section>)
}));
```

Update the imports:

```js
import { ModuleMindMapPage } from "@/features/modules/ModuleMindMapPage";
```

Add this test:

```jsx
  test("renders only the Module Mind Map for default Module routes", () => {
    const html = renderToStaticMarkup(
      <StudyAppMainContent
        model={{
          authActions: null,
          canManageSelectedSubject: true,
          canUseProtectedActions: true,
          chipFilterIds: [],
          chipFilterValue: [],
          chipOptions: [],
          clearMindMapDrilldown: vi.fn(),
          generationWorkflowsByNoteGroupId: {},
          handleBreadcrumbHome: vi.fn(),
          handleCancelAutoJob: vi.fn(),
          handleChipFilterSelect: vi.fn(),
          handleDeleteModule: vi.fn(),
          handleNoteGroupDragEnd: vi.fn(),
          handleNoteGroupDragEnter: vi.fn(),
          handleNoteGroupDragOver: vi.fn(),
          handleNoteGroupDragStart: vi.fn(),
          handleNoteGroupDrop: vi.fn(),
          handleOpenMindMapTopic: vi.fn(),
          handleRegenerateModuleNeedsReviewKnowledgeNodes: vi.fn(),
          handleRegenerateTopicKnowledgeNodes: vi.fn(),
          handleResetChipFilters: vi.fn(),
          handleRetryAutoJob: vi.fn(),
          hasSidebar: false,
          isRestoringRoute: false,
          isReviewOverlayVisible: false,
          isReviewing: false,
          isViewCardsPage: false,
          mindMapDrilldown: { sourceKey: "", graph: null, title: "", loading: false, error: "" },
          moduleDueCounts: {},
          moduleGenerationWorkflowConnection: {},
          moduleGenerationWorkflowError: "",
          moduleMindMap: null,
          moduleMindMapError: "",
          moduleMindMapLoading: false,
          moduleNeedsReviewRegenerating: false,
          moduleNoteGroupStatsById: {},
          moduleNoteGroupsForDisplay: [],
          moduleQuestionTimeline: [],
          moduleStats: { studyCount: 3, questionCount: 4, dueCount: 1, staleCount: 0 },
          moduleStatsError: "",
          moduleStatsLoading: false,
          navigate: vi.fn(),
          navigateToNoteGroup: vi.fn(),
          noteGroupMode: "",
          pageBreadcrumbs: [],
          pageHeader: { title: "Module", description: "", pageType: "Module" },
          reviewCount: "10",
          reviewError: "",
          routePanel: "mind-map",
          sectionNavItems: [],
          selectedModule: { id: "module-1", title: "Cell biology" },
          selectedModuleCode: "M1",
          selectedModuleId: "module-1",
          selectedNoteGroupId: "",
          selectedSubjectCode: "S1",
          selectedSubjectId: "subject-1",
          selectedTopicId: "",
          setIsChatOpen: vi.fn(),
          setReviewCount: vi.fn(),
          startReview: vi.fn()
        }}
      />
    );

    expect(html).toContain("Module Mind Map only");
    expect(html).not.toContain("Question timeline");
    expect(html).not.toContain("Note groups");
    expect(ModuleMindMapPage).toHaveBeenCalledOnce();
    expect(ModuleHomePage).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
cd frontend
npm run test -- StudyAppMainContent.test.jsx
```

Expected: failure because `ModuleHomePage` is still called and downstream content is still rendered for the default Module branch.

- [ ] **Step 3: Implement Module Mind Map-only branch**

In `frontend/src/features/app-shell/StudyAppMainContent.jsx`, keep the existing import:

```js
import { ModuleMindMapPage } from "@/features/modules/ModuleMindMapPage";
```

Create a local `moduleMindMapProps` constant before `return`:

```js
  const moduleMindMapProps = {
    moduleTitle: selectedModule?.title,
    graph: moduleMindMap,
    loading: moduleMindMapLoading,
    error: moduleMindMapError,
    canRegenerateTopicKnowledgeNodes: canManageSelectedSubject,
    regeneratingTopicId: topicKnowledgeNodeRegeneratingId,
    onRegenerateTopicKnowledgeNodes: handleRegenerateTopicKnowledgeNodes,
    canRegenerateNeedsReview: canManageSelectedSubject,
    regeneratingNeedsReview: moduleNeedsReviewRegenerating,
    onRegenerateNeedsReview: handleRegenerateModuleNeedsReviewKnowledgeNodes,
    onTopicNodeClick: (topic) => handleOpenMindMapTopic(topic, "module"),
    drilldownGraph: mindMapDrilldown.sourceKey === "module" ? mindMapDrilldown.graph : null,
    drilldownTitle:
      mindMapDrilldown.sourceKey === "module"
        ? `${mindMapDrilldown.title || "Concept"} Mind Map`
        : "",
    drilldownLoading: mindMapDrilldown.sourceKey === "module" && mindMapDrilldown.loading,
    drilldownError: mindMapDrilldown.sourceKey === "module" ? mindMapDrilldown.error : "",
    onBackFromDrilldown: clearMindMapDrilldown
  };
```

Then replace the non-View Cards Module branch:

```jsx
                  ) : (
                    <ModuleMindMapPage {...moduleMindMapProps} />
                  )
```

Do not render `ModuleHomePage` for this branch. Leave the explicit View Cards branch unchanged.

- [ ] **Step 4: Run Module render tests and verify pass**

Run:

```bash
cd frontend
npm run test -- StudyAppMainContent.test.jsx
```

Expected: all `StudyAppMainContent` tests pass.

- [ ] **Step 5: Commit Module render change**

```bash
git add frontend/src/features/app-shell/StudyAppMainContent.jsx frontend/src/features/app-shell/StudyAppMainContent.test.jsx
git commit -m "fix: render module mind map without overview content"
```

## Task 4: Note Group and Concept Mind Maps Render Alone

**Files:**
- Modify: `frontend/src/features/app-shell/StudyAppMainContent.jsx`
- Modify: `frontend/src/features/study-scope/StudyScopeContent.jsx`
- Test: `frontend/src/features/study-scope/StudyScopeContent.test.jsx`

- [ ] **Step 1: Write failing scope content tests**

In `frontend/src/features/study-scope/StudyScopeContent.test.jsx`, add:

```jsx
  test("Concept Mind Map route renders no overview content under the Mind Map", () => {
    const html = renderToStaticMarkup(
      <ConceptScopeContent
        shouldHoldContent={false}
        isMindMapPage
        isViewCardsPage={false}
        isInlineStudyPage={false}
        isStudyPage={false}
        isQuestionPage={false}
        selectedConcept={{ id: "concept-1", label: "Elasticity", knowledge_node_status: "complete" }}
        selectedConceptId="concept-1"
        conceptMindMap={null}
        conceptMindMapLoading={false}
        conceptMindMapError=""
        mindMapDrilldown={{ sourceKey: "", graph: null, title: "", loading: false, error: "" }}
        noteGroupStats={{ studyCount: 3, questionCount: 4, dueCount: 1, staleCount: 0 }}
        canManageSelectedSubject
        conceptKnowledgeNodeRegeneratingId=""
        classes={classes}
        handleRegenerateConceptKnowledgeNodes={vi.fn()}
        navigateToConcept={vi.fn()}
      />
    );

    expect(html).toContain("Elasticity Mind Map");
    expect(html).not.toContain("Knowledge Nodes ready");
    expect(html).not.toContain("Concept management");
  });

  test("Note Group Mind Map route renders no overview or progress content under the Mind Map", () => {
    globalThis.document = { body: {} };
    const html = renderToStaticMarkup(
      <NoteGroupScopeContent
        shouldHoldContent={false}
        isMindMapPage
        isViewCardsPage={false}
        isInlineStudyPage={false}
        isStudyPage={false}
        isQuestionPage={false}
        selectedNoteGroup={{ id: "note-group-1", title: "Photosynthesis" }}
        selectedNoteGroupId="note-group-1"
        noteGroupMindMap={null}
        noteGroupMindMapLoading={false}
        noteGroupMindMapError=""
        noteGroupMindMapGenerating={false}
        noteGroupNeedsReviewRegenerating={false}
        mindMapDrilldown={{ sourceKey: "", graph: null, title: "", loading: false, error: "" }}
        noteGroupStats={{ studyCount: 3, questionCount: 4, dueCount: 1, staleCount: 0 }}
        noteGroupStatusMeta={null}
        noteGroupProgress={{
          summary: {
            successRate: 0,
            masteryPercentage: 0,
            medianResponseTimeMs: 0
          }
        }}
        noteGroupProgressLoading={false}
        noteGroupProgressError=""
        progressRange="week"
        concepts={[]}
        conceptOptions={[]}
        conceptFilterValue={[]}
        conceptFilterIds={[]}
        noteGroupConceptIds={[]}
        selectedModuleId="module-1"
        selectedSubjectCode="S1"
        selectedModuleCode="M1"
        selectedNoteGroupCode="N1"
        canManageSelectedSubject
        conceptKnowledgeNodeRegeneratingId=""
        classes={{ ...classes, smallOutlineButton: "small-outline" }}
        selectStyles={{}}
        navigate={vi.fn()}
        setProgressRange={vi.fn()}
        handleGenerateNoteGroupMindMap={vi.fn()}
        handleRegenerateConceptKnowledgeNodes={vi.fn()}
        handleRegenerateNeedsReviewKnowledgeNodes={vi.fn()}
        handleOpenMindMapConcept={vi.fn()}
        clearMindMapDrilldown={vi.fn()}
        handleConceptFilterSelect={vi.fn()}
        handleResetConceptFilters={vi.fn()}
      />
    );

    expect(html).toContain("Photosynthesis Mind Map");
    expect(html).not.toContain("Progress");
    expect(html).not.toContain("Filter note groups");
    expect(html).not.toContain("Study Cards");
    expect(html).not.toContain("Question Cards");
  });
```

- [ ] **Step 2: Run scope content tests and verify failure**

Run:

```bash
cd frontend
npm run test -- StudyScopeContent.test.jsx
```

Expected: tests fail because the current non-card branch still renders `ConceptOverview`, `NoteGroupOverview`, or `NoteGroupProgress` below the Mind Map.

- [ ] **Step 3: Pass explicit Mind Map route state into scope content**

In `frontend/src/features/app-shell/StudyAppMainContent.jsx`, compute:

```js
  const isMindMapPage = currentPanel === "mind-map" || (!isExplicitDockRoute && (!currentPanel || currentPanel === "overview"));
```

Then pass it to `StudyScopeRouteContent`:

```jsx
                    isMindMapPage={isMindMapPage}
```

- [ ] **Step 4: Split Mind Map-only rendering in scope content**

In `frontend/src/features/study-scope/StudyScopeContent.jsx`, add `isMindMapPage` to the destructured props near the existing page flags:

```js
  isMindMapPage,
  isViewCardsPage,
  isInlineStudyPage,
  isStudyPage,
  isQuestionPage,
```

Replace the condition:

```js
  if (!isViewCardsPage && !isInlineStudyPage && !isStudyPage && !isQuestionPage) {
```

with:

```js
  if (isMindMapPage || (!isViewCardsPage && !isInlineStudyPage && !isStudyPage && !isQuestionPage)) {
```

Inside that branch, remove the `ConceptOverview`, `NoteGroupOverview`, and `NoteGroupProgress` rendering. The Concept branch should return only:

```jsx
        {isConceptScope ? (
          <PageMindMapCard id="topic-mind-map">
            <MindMapPanel
              embedded
              graph={conceptMindMap}
              title={`${selectedConcept?.label || "Concept"} Mind Map`}
              description="Knowledge Nodes, child Concepts, parent Concept, and Study Cards for this Concept."
              loading={conceptMindMapLoading}
              error={conceptMindMapError}
              canRegenerateTopicKnowledgeNodes={canManageSelectedSubject}
              regeneratingTopicId={conceptKnowledgeNodeRegeneratingId}
              onRegenerateTopicKnowledgeNodes={handleRegenerateConceptKnowledgeNodes}
              onTopicNodeClick={(concept) => navigateToConcept(concept.topicId)}
            />
          </PageMindMapCard>
        ) : (
```

The Note Group branch should return only the existing `PageMindMapCard id="note-group-mind-map"` and its `MindMapPanel`.

- [ ] **Step 5: Run scope content tests and verify pass**

Run:

```bash
cd frontend
npm run test -- StudyScopeContent.test.jsx
```

Expected: all `StudyScopeContent` tests pass.

- [ ] **Step 6: Commit scope Mind Map-only rendering**

```bash
git add frontend/src/features/app-shell/StudyAppMainContent.jsx frontend/src/features/study-scope/StudyScopeContent.jsx frontend/src/features/study-scope/StudyScopeContent.test.jsx
git commit -m "fix: render scope mind maps without overview content"
```

## Task 5: Remove Overview Navigation Assumptions

**Files:**
- Modify: `frontend/src/features/app-shell/useStudyAppEffects.js`
- Modify: `frontend/src/features/study-scope/StudyScopeContent.jsx`
- Test: `frontend/src/features/study-scope/StudyScopeContent.test.jsx`
- Test: `frontend/src/features/app-shell/StudyAppMainContent.test.jsx`

- [ ] **Step 1: Write failing navigation tests**

In `frontend/src/features/app-shell/StudyAppMainContent.test.jsx`, add an assertion to the Module default Mind Map test from Task 3:

```js
    expect(html).not.toContain("Module overview");
```

In `frontend/src/features/study-scope/StudyScopeContent.test.jsx`, add this View Cards route test:

```jsx
  test("View Cards back button does not mention Overview", () => {
    const html = renderToStaticMarkup(
      <NoteGroupScopeContent
        shouldHoldContent={false}
        isMindMapPage={false}
        isViewCardsPage
        isInlineStudyPage={false}
        isStudyPage={false}
        isQuestionPage={false}
        selectedNoteGroup={{ id: "note-group-1", title: "Photosynthesis" }}
        noteGroupCardTable={{ rows: [], unlinked_question_count: 0 }}
        studyCards={[]}
        questionCards={[]}
        concepts={[]}
        canEditCurrentCards={false}
        canUseProtectedActions={false}
        editingStudyCardId=""
        editingStudyCard={null}
        editingQuestionCardId=""
        editingQuestionCard={null}
        classes={classes}
        handleBackToOverview={vi.fn()}
        setEditingStudyCard={vi.fn()}
        setEditingStudyCardId={vi.fn()}
        setEditingQuestionCard={vi.fn()}
        setEditingQuestionCardId={vi.fn()}
        handleEditStudyCard={vi.fn()}
        handleSaveStudyCard={vi.fn()}
        handleDeleteStudyCard={vi.fn()}
        handleEditQuestionCard={vi.fn()}
        handleSaveQuestionCard={vi.fn()}
        handleDeleteQuestionCard={vi.fn()}
      />
    );

    expect(html).toContain("&larr; Back");
    expect(html).not.toContain("Overview");
  });
```

- [ ] **Step 2: Run navigation-related tests and verify failure**

Run:

```bash
cd frontend
npm run test -- StudyAppMainContent.test.jsx StudyScopeContent.test.jsx
```

Expected: failure because rendered output or section navigation still contains Overview labels on default Mind Map routes.

- [ ] **Step 3: Remove Overview section nav labels**

In `frontend/src/features/app-shell/useStudyAppEffects.js`, update section nav logic:

```js
    if (!selectedNoteGroupId && !selectedTopicId) {
      return isViewCardsPage
        ? []
        : [{ id: "module-mind-map", label: "Mind Map" }];
    }
```

Replace:

```js
    if (isTopicScope) {
      return [{ id: "topic-overview", label: "Overview" }];
    }
    return [
      { id: "note-group-overview", label: "Overview" },
      { id: "note-group-mind-map", label: "Mind Map" }
    ];
```

with:

```js
    if (isTopicScope) {
      return [{ id: "topic-mind-map", label: "Mind Map" }];
    }
    return [{ id: "note-group-mind-map", label: "Mind Map" }];
```

- [ ] **Step 4: Keep internal callback names and visible back labels**

Keep `handleBackToOverview` as an internal function/prop name. The visible back buttons in `frontend/src/features/study-scope/StudyScopeContent.jsx` already render `&larr; Back`; leave those labels unchanged.

- [ ] **Step 5: Run navigation-related tests and verify pass**

Run:

```bash
cd frontend
npm run test -- StudyAppMainContent.test.jsx StudyScopeContent.test.jsx
```

Expected: all tests pass and no rendered output contains unwanted Overview text on scope pages.

- [ ] **Step 6: Commit navigation cleanup**

```bash
git add frontend/src/features/app-shell/useStudyAppEffects.js frontend/src/features/study-scope/StudyScopeContent.jsx frontend/src/features/study-scope/StudyScopeContent.test.jsx frontend/src/features/app-shell/StudyAppMainContent.test.jsx
git commit -m "fix: remove overview navigation assumptions"
```

## Task 6: Full Verification

**Files:**
- Verify only; no planned source edits.

- [ ] **Step 1: Run focused route and rendering tests**

Run:

```bash
cd frontend
npm run test -- routes.test.js appRoutes.test.jsx pages.test.jsx StudyAppMainContent.test.jsx StudyScopeContent.test.jsx
```

Expected: all focused test files pass.

- [ ] **Step 2: Run full frontend test suite**

Run:

```bash
cd frontend
npm run test
```

Expected: all frontend tests pass.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: only intentional route/render/test changes remain relative to the last implementation commit. Existing unrelated dirty files may remain; do not stage them.

- [ ] **Step 4: Commit any remaining verification fixes**

After Task 6, run the following commit command only when verification changed one or more of the listed files. Stage only intentional route/render/test fixes:

```bash
git add frontend/src/lib/routes.js frontend/src/lib/routes.test.js frontend/src/routes/appRoutes.jsx frontend/src/routes/pages.jsx frontend/src/routes/pages.test.jsx frontend/src/routes/appRoutes.test.jsx frontend/src/features/app-shell/StudyAppMainContent.jsx frontend/src/features/app-shell/StudyAppMainContent.test.jsx frontend/src/features/study-scope/StudyScopeContent.jsx frontend/src/features/study-scope/StudyScopeContent.test.jsx frontend/src/features/app-shell/useStudyAppEffects.js
git commit -m "test: verify mind map only routes"
```

Skip this commit if no files changed after Task 5.
