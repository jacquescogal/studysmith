import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ModuleHomePage } from "@/features/modules/ModuleHomePage";
import { ModuleMindMapPage } from "@/features/modules/ModuleMindMapPage";
import { ConceptScopeContent } from "@/features/study-scope/StudyScopeContent";
import { StudyAppMainContent } from "./StudyAppMainContent";

vi.mock("@/features/modules/ModuleHomePage", () => ({
  ModuleHomePage: vi.fn(() => <section>Module overview</section>)
}));

vi.mock("@/features/modules/ModuleMindMapPage", () => ({
  ModuleMindMapPage: vi.fn(() => <section id="module-mind-map">Module Mind Map only</section>)
}));

vi.mock("@/features/study-scope/StudyScopeContent", () => ({
  ConceptScopeContent: vi.fn(() => <section>Concept scope</section>),
  NoteGroupScopeContent: vi.fn(() => <section>Note Group scope</section>)
}));

describe("StudyAppMainContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders the Module Mind Map branch by default", () => {
    const html = renderToStaticMarkup(
      <StudyAppMainContent
        model={{
          authActions: null,
          canManageSelectedSubject: true,
          canReorderNoteGroups: true,
          canUseProtectedActions: true,
          chipFilterIds: [],
          chipFilterValue: [],
          chipOptions: [],
          clearMindMapDrilldown: vi.fn(),
          dragOverNoteGroupId: "",
          draggedNoteGroupId: "",
          generationWorkflowsByNoteGroupId: {},
          handleBackToOverview: vi.fn(),
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
          mindMapDrilldown: {
            sourceKey: "",
            graph: null,
            title: "",
            loading: false,
            error: ""
          },
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
          moduleStats: null,
          moduleStatsError: "",
          moduleStatsLoading: false,
          navigateToNoteGroup: vi.fn(),
          noteGroupMode: "",
          pageBreadcrumbs: [],
          pageHeader: { title: "Module", description: "", pageType: "Module" },
          reviewCount: "10",
          reviewError: "",
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
    expect(html).not.toContain("Module overview");
    expect(html).not.toContain("Question timeline");
    expect(html).not.toContain("Note groups");
    expect(html).toContain("scope-interaction-dock");
    expect(html).not.toContain("On this page");
    expect(ModuleMindMapPage).toHaveBeenCalledOnce();
    expect(ModuleMindMapPage.mock.calls[0][0].moduleTitle).toBe("Cell biology");
    expect(ModuleMindMapPage.mock.calls[0][0].canRegenerateTopicKnowledgeNodes).toBe(true);
    expect(ModuleHomePage).not.toHaveBeenCalled();
  });

  test("renders only the Module Mind Map on Module Mind Map routes", () => {
    const html = renderToStaticMarkup(
      <StudyAppMainContent
        model={{
          authActions: null,
          canManageSelectedSubject: true,
          canReorderNoteGroups: true,
          canUseProtectedActions: true,
          chipFilterIds: [],
          chipFilterValue: [],
          chipOptions: [],
          clearMindMapDrilldown: vi.fn(),
          dragOverNoteGroupId: "",
          draggedNoteGroupId: "",
          generationWorkflowsByNoteGroupId: {},
          handleBackToOverview: vi.fn(),
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
          mindMapDrilldown: {
            sourceKey: "",
            graph: null,
            title: "",
            loading: false,
            error: ""
          },
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
          moduleStats: null,
          moduleStatsError: "",
          moduleStatsLoading: false,
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

  test("marks Mind Map as the selected dock action on Module default routes", () => {
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
          moduleStats: null,
          moduleStatsError: "",
          moduleStatsLoading: false,
          navigate: vi.fn(),
          navigateToNoteGroup: vi.fn(),
          noteGroupMode: "",
          pageBreadcrumbs: [],
          pageHeader: { title: "Module", description: "", pageType: "Module" },
          reviewCount: "10",
          reviewError: "",
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

    expect(html).toMatch(/data-variant="default"[\s\S]*?<span>Mind Map<\/span>/);
  });

  test("does not keep Mind Map selected on explicit View Cards routes", () => {
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
          editingQuestionCard: null,
          editingQuestionCardId: "",
          editingStudyCard: null,
          editingStudyCardId: "",
          generationWorkflowsByNoteGroupId: {},
          handleBackToOverview: vi.fn(),
          handleBreadcrumbHome: vi.fn(),
          handleCancelAutoJob: vi.fn(),
          handleChipFilterSelect: vi.fn(),
          handleDeleteModule: vi.fn(),
          handleDeleteQuestionCard: vi.fn(),
          handleDeleteStudyCard: vi.fn(),
          handleEditQuestionCard: vi.fn(),
          handleEditStudyCard: vi.fn(),
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
          handleSaveQuestionCard: vi.fn(),
          handleSaveStudyCard: vi.fn(),
          hasSidebar: false,
          isRestoringRoute: false,
          isReviewOverlayVisible: false,
          isReviewing: false,
          isViewCardsPage: true,
          mindMapDrilldown: { sourceKey: "", graph: null, title: "", loading: false, error: "" },
          moduleCardTable: { rows: [], unlinked_question_count: 0 },
          moduleCardTableError: "",
          moduleCardTableLoading: false,
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
          moduleStats: null,
          moduleStatsError: "",
          moduleStatsLoading: false,
          navigate: vi.fn(),
          navigateToNoteGroup: vi.fn(),
          noteGroupMode: "",
          pageBreadcrumbs: [],
          pageHeader: { title: "Module", description: "", pageType: "Module" },
          reviewCount: "10",
          reviewError: "",
          sectionNavItems: [],
          selectedModule: { id: "module-1", title: "Cell biology" },
          selectedModuleCode: "M1",
          selectedModuleId: "module-1",
          selectedNoteGroupId: "",
          selectedSubjectCode: "S1",
          selectedSubjectId: "subject-1",
          selectedTopicId: "",
          setEditingQuestionCard: vi.fn(),
          setEditingQuestionCardId: vi.fn(),
          setEditingStudyCard: vi.fn(),
          setEditingStudyCardId: vi.fn(),
          setIsChatOpen: vi.fn(),
          setReviewCount: vi.fn(),
          startReview: vi.fn(),
          topicChips: []
        }}
      />
    );

    expect(html).toMatch(/data-variant="outline"[\s\S]*?<span>Mind Map<\/span>/);
    expect(html).toMatch(/data-variant="default"[\s\S]*?<span>View Cards<\/span>/);
    expect(html).toContain("<h2>View Cards</h2>");
    expect(html).not.toContain("← Back");
  });

  test("renders scope-specific dock settings buttons", () => {
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
          moduleStats: null,
          moduleStatsError: "",
          moduleStatsLoading: false,
          navigate: vi.fn(),
          navigateToNoteGroup: vi.fn(),
          noteGroupMode: "",
          pageBreadcrumbs: [],
          pageHeader: { title: "Module", description: "", pageType: "Module" },
          reviewCount: "10",
          reviewError: "",
          sectionNavItems: [],
          selectedModule: { id: "module-1", title: "Cell biology" },
          selectedModuleCode: "M1",
          selectedModuleId: "module-1",
          selectedNoteGroupId: "",
          selectedSubjectCode: "S1",
          selectedSubjectId: "subject-1",
          selectedTopicId: "",
          setIsChatOpen: vi.fn(),
          setIsModuleMetadataOpen: vi.fn(),
          setReviewCount: vi.fn(),
          startReview: vi.fn()
        }}
      />
    );

    expect(html).toContain("aria-label=\"Module settings\"");
  });

  test("uses the full scope question count for the dock review slider max", () => {
    const questionCards = Array.from({ length: 23 }, (_, index) => ({ id: `q-${index}` }));
    const questionCardsForDisplay = questionCards.slice(0, 10);
    const html = renderToStaticMarkup(
      <StudyAppMainContent
        model={{
          authActions: null,
          autoJobActionId: "",
          canEditCurrentCards: true,
          canManageSelectedSubject: true,
          canUseProtectedActions: true,
          chipFilterIds: [],
          chipFilterValue: [],
          chipOptions: [],
          clearMindMapDrilldown: vi.fn(),
          editingQuestionCard: null,
          editingQuestionCardId: "",
          editingStudyCard: null,
          editingStudyCardId: "",
          filteredStudyCards: [],
          handleBackToOverview: vi.fn(),
          handleCancelAutoJob: vi.fn(),
          handleDeleteAutoJob: vi.fn(),
          handleDeleteNoteGroup: vi.fn(),
          handleDeleteQuestionCard: vi.fn(),
          handleDeleteStudyCard: vi.fn(),
          handleEditQuestionCard: vi.fn(),
          handleEditStudyCard: vi.fn(),
          handleGenerateNoteGroupMindMap: vi.fn(),
          handleGenerateQuestions: vi.fn(),
          handleOpenMindMapTopic: vi.fn(),
          handleRegenerateNeedsReviewKnowledgeNodes: vi.fn(),
          handleRegenerateTopicKnowledgeNodes: vi.fn(),
          handleResetChipFilters: vi.fn(),
          handleRetryAutoJob: vi.fn(),
          handleSaveQuestionCard: vi.fn(),
          handleSaveStudyCard: vi.fn(),
          hasSidebar: false,
          isGeneratingQuestions: false,
          isQuestionPage: false,
          isRestoringRoute: false,
          isReviewOverlayVisible: false,
          isReviewing: false,
          isStudyPage: false,
          isViewCardsPage: false,
          masteryFilter: "low",
          mindMapDrilldown: { sourceKey: "", graph: null, title: "", loading: false, error: "" },
          moduleGenerationWorkflowConnection: {},
          moduleGenerationWorkflowError: "",
          navigate: vi.fn(),
          navigateToTopic: vi.fn(),
          noteGroupCardTable: [],
          noteGroupCardTableError: "",
          noteGroupCardTableLoading: false,
          noteGroupChipIds: [],
          noteGroupMindMap: null,
          noteGroupMindMapError: "",
          noteGroupMindMapGenerating: false,
          noteGroupMindMapLoading: false,
          noteGroupMode: "",
          noteGroupNeedsReviewRegenerating: false,
          noteGroupProgress: null,
          noteGroupProgressError: "",
          noteGroupProgressLoading: false,
          noteGroupStats: null,
          noteGroupStatusMeta: null,
          openMetadataModal: vi.fn(),
          pageBreadcrumbs: [],
          pageHeader: { title: "Note Group", description: "", pageType: "Note Group" },
          progressRange: "week",
          questionCardError: "",
          questionCards,
          questionCardsForDisplay,
          questionJobStatus: "",
          questionTimeline: [],
          readingAvailable: false,
          reviewCount: "10",
          reviewError: "",
          sectionNavItems: [],
          selectedModuleCode: "module-a",
          selectedModuleId: "module-1",
          selectedNoteGroup: { id: "note-group-1", title: "Chapter 1" },
          selectedNoteGroupCode: "chapter-1",
          selectedNoteGroupId: "note-group-1",
          selectedSubjectCode: "subject-a",
          selectedSubjectId: "subject-1",
          selectedTopicId: "",
          setEditingQuestionCard: vi.fn(),
          setEditingQuestionCardId: vi.fn(),
          setEditingStudyCard: vi.fn(),
          setEditingStudyCardId: vi.fn(),
          setIsChatOpen: vi.fn(),
          setIsReadingOpen: vi.fn(),
          setMasteryFilter: vi.fn(),
          setProgressRange: vi.fn(),
          setReviewCount: vi.fn(),
          setTopicDescriptionDraft: vi.fn(),
          setTopicTitleDraft: vi.fn(),
          shouldHoldSelectedNoteGroupContent: false,
          studyCardError: "",
          studyCards: [],
          topicCardTableRows: [],
          topicChips: [],
          topicDescriptionDraft: "",
          topicError: "",
          topicKnowledgeNodeRegenerating: false,
          topicKnowledgeNodeRegeneratingId: "",
          topicMindMap: null,
          topicMindMapError: "",
          topicMindMapLoading: false,
          topicSaving: false,
          topicTitleDraft: "",
          topicUnlinkedQuestionCount: 0
        }}
      />
    );

    expect(html).toContain("max=\"22\"");
    expect(html).toContain("value=\"9\"");
    expect(html).toContain(">Review 10</span>");
  });

  test("renders the Concept scope branch from the selected route scope", () => {
    const html = renderToStaticMarkup(
      <StudyAppMainContent
        model={{
          authActions: null,
          autoJobActionId: "",
          canEditCurrentCards: true,
          canManageSelectedSubject: true,
          canUseProtectedActions: true,
          chipFilterIds: [],
          chipFilterValue: [],
          chipOptions: [],
          clearMindMapDrilldown: vi.fn(),
          editingQuestionCard: null,
          editingQuestionCardId: "",
          editingStudyCard: null,
          editingStudyCardId: "",
          filteredStudyCards: [],
          handleBackToOverview: vi.fn(),
          handleCancelAutoJob: vi.fn(),
          handleDeleteAutoJob: vi.fn(),
          handleDeleteNoteGroup: vi.fn(),
          handleDeleteQuestionCard: vi.fn(),
          handleDeleteStudyCard: vi.fn(),
          handleDeleteTopic: vi.fn(),
          handleEditQuestionCard: vi.fn(),
          handleEditStudyCard: vi.fn(),
          handleGenerateNoteGroupMindMap: vi.fn(),
          handleGenerateQuestions: vi.fn(),
          handleOpenMindMapTopic: vi.fn(),
          handleRegenerateNeedsReviewKnowledgeNodes: vi.fn(),
          handleRegenerateTopicKnowledgeNodes: vi.fn(),
          handleResetChipFilters: vi.fn(),
          handleRetryAutoJob: vi.fn(),
          handleSaveQuestionCard: vi.fn(),
          handleSaveStudyCard: vi.fn(),
          handleSaveTopic: vi.fn(),
          hasSidebar: false,
          isGeneratingQuestions: false,
          isQuestionPage: false,
          isRestoringRoute: false,
          isReviewOverlayVisible: false,
          isReviewing: false,
          isStudyPage: false,
          isViewCardsPage: false,
          masteryFilter: "all",
          mindMapDrilldown: { sourceKey: "", graph: null, title: "", loading: false, error: "" },
          moduleGenerationWorkflowConnection: {},
          moduleGenerationWorkflowError: "",
          navigate: vi.fn(),
          navigateToTopic: vi.fn(),
          noteGroupCardTable: [],
          noteGroupCardTableError: "",
          noteGroupCardTableLoading: false,
          noteGroupChipIds: [],
          noteGroupMindMap: null,
          noteGroupMindMapError: "",
          noteGroupMindMapGenerating: false,
          noteGroupMindMapLoading: false,
          noteGroupMode: "",
          noteGroupNeedsReviewRegenerating: false,
          noteGroupProgress: null,
          noteGroupProgressError: "",
          noteGroupProgressLoading: false,
          noteGroupStats: null,
          noteGroupStatusMeta: null,
          pageBreadcrumbs: [],
          pageHeader: { title: "Concept", description: "", pageType: "Concept" },
          progressRange: "week",
          questionCardError: "",
          questionCards: [],
          questionCardsForDisplay: [],
          questionJobStatus: "",
          questionTimeline: [],
          readingAvailable: false,
          reviewCount: "10",
          reviewError: "",
          sectionNavItems: [],
          selectedConceptCode: "concept-a",
          selectedModuleCode: "module-a",
          selectedModuleId: "module-1",
          selectedNoteGroupId: "",
          selectedSubjectCode: "subject-a",
          selectedSubjectId: "subject-1",
          selectedTopic: { id: "topic-1", label: "Concept A" },
          selectedTopicCode: "concept-a",
          selectedTopicId: "topic-1",
          setEditingQuestionCard: vi.fn(),
          setEditingQuestionCardId: vi.fn(),
          setEditingStudyCard: vi.fn(),
          setEditingStudyCardId: vi.fn(),
          setIsChatOpen: vi.fn(),
          setIsReadingOpen: vi.fn(),
          setMasteryFilter: vi.fn(),
          setProgressRange: vi.fn(),
          setReviewCount: vi.fn(),
          setTopicDescriptionDraft: vi.fn(),
          setTopicTitleDraft: vi.fn(),
          shouldHoldSelectedNoteGroupContent: false,
          studyCardError: "",
          studyCards: [],
          topicCardTableRows: [],
          topicChips: [],
          topicDescriptionDraft: "",
          topicError: "",
          topicKnowledgeNodeRegenerating: false,
          topicKnowledgeNodeRegeneratingId: "",
          topicMindMap: null,
          topicMindMapError: "",
          topicMindMapLoading: false,
          topicSaving: false,
          topicTitleDraft: "",
          topicUnlinkedQuestionCount: 0
        }}
      />
    );

    expect(html).toContain("Concept scope");
    expect(ConceptScopeContent).toHaveBeenCalledOnce();
  });
});
