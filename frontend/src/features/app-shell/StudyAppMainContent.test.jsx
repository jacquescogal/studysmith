import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { selectStyles } from "@/features/app-shell/appShellUi";
import { ModuleHomePage } from "@/features/modules/ModuleHomePage";
import { ConceptScopeContent } from "@/features/study-scope/StudyScopeContent";
import { StudyAppMainContent } from "./StudyAppMainContent";

vi.mock("@/features/modules/ModuleHomePage", () => ({
  ModuleHomePage: vi.fn(() => <section>Module overview</section>)
}));

vi.mock("@/features/study-scope/StudyScopeContent", () => ({
  ConceptScopeContent: vi.fn(() => <section>Concept scope</section>),
  NoteGroupScopeContent: vi.fn(() => <section>Note Group scope</section>)
}));

describe("StudyAppMainContent", () => {
  test("renders the Module overview branch with shared select and class props", () => {
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
          selectedModuleId: "module-1",
          selectedNoteGroupId: "",
          selectedSubjectId: "subject-1",
          selectedTopicId: "",
          setIsChatOpen: vi.fn(),
          setReviewCount: vi.fn()
        }}
      />
    );

    expect(html).toContain("Module overview");
    expect(ModuleHomePage).toHaveBeenCalledOnce();
    expect(ModuleHomePage.mock.calls[0][0].selectStyles).toBe(selectStyles);
    expect(ModuleHomePage.mock.calls[0][0].classes.smallMutedText).toBeTruthy();
    expect(ModuleHomePage.mock.calls[0][0].classes.smallOutlineButton).toBeTruthy();
    expect(ModuleHomePage.mock.calls[0][0].classes.smallDestructiveOutlineButton).toBeTruthy();
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
