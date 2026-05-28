import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { StudyAppView } from "@/features/app-shell/StudyAppView";
import { StudyAppAuthActions } from "@/features/app-shell/StudyAppAuthActions";
import { appShellClasses, generationWorkflowStageLabel, generationWorkflowStatusLabel, generationWorkflowTitle, selectStyles } from "@/features/app-shell/appShellUi";
import { useAuth } from "@/auth/AuthProvider";
import { getLocalMailpitUrl } from "@/auth/supabaseClient";
import { ContextSidebar } from "@/components/layout/ContextSidebar";
import { useModulePageActions } from "@/features/modules/useModulePageActions";
import { useReviewWorkflowActions } from "@/features/review/useReviewWorkflowActions";
import { ConceptScopeContent, NoteGroupScopeContent } from "@/features/study-scope/StudyScopeContent";
import { useSubjectWorkflowState } from "@/features/subjects/useSubjectWorkflowState";
import { useStudyAppEffects } from "@/features/app-shell/useStudyAppEffects";
import { useStudyAppPageActions } from "@/features/app-shell/useStudyAppPageActions";
import { useStudyAppWorkflowActions } from "@/features/app-shell/useStudyAppWorkflowActions";
import { shouldBlockForRouteRestore, shouldClearSelectedSubject } from "@/routes/routeRestore";
import { createNoteGroupPath, matchAppRoute, modulePath, noteGroupPath, subjectPath, conceptPath } from "@/lib/routes";
import { countWords, formatAnswerLabels, formatCreatedAt, getModuleAdditionalInstructions, getNoteGroupStatusMeta, normalizeNoteGroups, normalizeTimeline } from "@/lib/format";
import { buildReviewCard, getMasteryScore, getMasteryTier } from "@/lib/review";
import { buildConceptDirectoryRows } from "@/lib/conceptDirectory";
import { getStudyPageHeader } from "@/lib/pageHeaderState";
import { useSubjectModules } from "@/hooks/useSubjectModules";
import { useSubjects } from "@/hooks/useSubjects";
import { useModuleOverview } from "@/hooks/useModuleOverview";
import { useModuleCardTable } from "@/hooks/useModuleCardTable";
import { useModuleMindMap } from "@/hooks/useModuleMindMap";
import { useModuleGenerationWorkflow } from "@/hooks/useModuleGenerationWorkflow";
import { useStudyScopeData } from "@/hooks/useStudyScopeData";
import { useNoteGroupPageData } from "@/hooks/useNoteGroupPageData";
import { useConceptPageData } from "@/hooks/useConceptPageData";
import { useIncludeDescendantStudyCards } from "@/hooks/useIncludeDescendantStudyCards";
import { useReviewSession } from "@/hooks/useReviewSession";
import { useSubjectModuleRouteResolution } from "@/routes/useSubjectModuleRouteResolution";
import { useNoteGroupRouteResolution } from "@/routes/useNoteGroupRouteResolution";
import { useConceptRouteResolution } from "@/routes/useConceptRouteResolution";
import { useRouteSelectionState } from "@/routes/useRouteSelectionState";
import { attachConcepts, autoCreateNoteGroup, checkNoteGroupSource, createModule, createSubject, createConcept, deleteQuestionCard, deleteSubject, detachConcept, getCurrentUser, getJob, getModuleQuestionTimeline, getNoteGroup, getStudyCard, getConceptMindMap, listModuleReviewQuestionCards, listReviewQuestionCards, listConcepts, listConceptReviewQuestionCards, regenerateNoteGroupNeedsReviewKnowledgeNodes, reviewQuestionCard, sendChat, sendModuleIntentChat, sendSubjectIntentChat, updateSubject } from "@/api";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const generateUniqueId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
const showFetchToast = (error, fallback) => {
  toast.error(error?.message || fallback);
};
const { panel: panelClass, primaryButton: primaryButtonClass, outlineButton: outlineButtonClass, smallOutlineButton: smallOutlineButtonClass, destructiveOutlineButton: destructiveOutlineButtonClass, smallDestructiveOutlineButton: smallDestructiveOutlineButtonClass, buttonRow: buttonRowClass, badge: badgeClass, mutedText: mutedTextClass, smallMutedText: smallMutedTextClass, errorText: errorTextClass
} = appShellClasses;
function StudyAppShell({ routePageModels }) {
  const auth = useAuth();
  const canUseProtectedActions = auth.isAuthenticated;
  const [authEmail, setAuthEmail] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authUiError, setAuthUiError] = useState("");
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [currentUserError, setCurrentUserError] = useState("");
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isSubjectManagementOpen, setIsSubjectManagementOpen] = useState(false);
  const handleSubjectsLoadError = useCallback(
    (error) => showFetchToast(error, "Failed to load subjects"), []
  );
  const handleModulesLoadError = useCallback(
    (error) => showFetchToast(error, "Failed to load modules"), []
  );
  const { subjects, setSubjects } = useSubjects({
    authLoading: auth.loading, isAuthenticated: auth.isAuthenticated, userId: auth.user?.id, onError: handleSubjectsLoadError
  });
  const { selectedSubjectId, setSelectedSubjectId, selectedModuleId, setSelectedModuleId, selectedNoteGroupId, setSelectedNoteGroupId, selectedTopicId, setSelectedTopicId, selectedSubjectIdRef, selectedModuleIdRef, selectedNoteGroupIdRef
  } = useRouteSelectionState();
  const { includeDescendantStudyCards, setIncludeDescendantStudyCards } = useIncludeDescendantStudyCards(selectedTopicId);
  const {
    newSubjectTitle,
    setNewSubjectTitle,
    newSubjectDescription,
    setNewSubjectDescription,
    isSubjectWizardOpen,
    setIsSubjectWizardOpen,
    subjectWizardMessages,
    setSubjectWizardMessages,
    subjectWizardInput,
    setSubjectWizardInput,
    subjectWizardLoading,
    setSubjectWizardLoading,
    subjectWizardTitle,
    setSubjectWizardTitle,
    subjectWizardGoal,
    setSubjectWizardGoal,
    subjectWizardScope,
    setSubjectWizardScope,
    subjectWizardError,
    setSubjectWizardError,
    subjectWizardCreating,
    setSubjectWizardCreating,
    isSubjectMetadataOpen,
    setIsSubjectMetadataOpen,
    editingSubjectId,
    setEditingSubjectId,
    subjectTitleDraft,
    setSubjectTitleDraft,
    subjectGoalDraft,
    setSubjectGoalDraft,
    subjectScopeDraft,
    setSubjectScopeDraft,
    subjectMetadataSaving,
    setSubjectMetadataSaving,
    subjectMetadataError,
    setSubjectMetadataError
  } = useSubjectWorkflowState();
  const { modules, setModules } = useSubjectModules({
    subjectId: selectedSubjectId, onError: handleModulesLoadError
  });
  const [isModuleMetadataOpen, setIsModuleMetadataOpen] = useState(false);
  const [isModuleWizardOpen, setIsModuleWizardOpen] = useState(false);
  const [moduleWizardMessages, setModuleWizardMessages] = useState([]);
  const [moduleWizardInput, setModuleWizardInput] = useState("");
  const [moduleWizardLoading, setModuleWizardLoading] = useState(false);
  const [moduleWizardTitle, setModuleWizardTitle] = useState("");
  const [moduleWizardGoal, setModuleWizardGoal] = useState("");
  const [moduleWizardScope, setModuleWizardScope] = useState("");
  const [moduleWizardError, setModuleWizardError] = useState("");
  const [moduleWizardCreating, setModuleWizardCreating] = useState(false);
  const {
    moduleTitleDraft, setModuleTitleDraft, moduleDescriptionDraft, setModuleDescriptionDraft, moduleAdditionalInstructionsDraft, setModuleAdditionalInstructionsDraft, moduleGoalDraft, setModuleGoalDraft, moduleScopeDraft, setModuleScopeDraft, moduleMetadataSaving, setModuleMetadataSaving, moduleMetadataError, setModuleMetadataError, chipFilterIds, setChipFilterIds, moduleChipLabel, setModuleChipLabel, moduleChipDescription, setModuleChipDescription, draggedNoteGroupId, setDraggedNoteGroupId, dragOverNoteGroupId, setDragOverNoteGroupId, isReorderingNoteGroups, setIsReorderingNoteGroups
  } = routePageModels.modulePageModel;
  const [moduleDueCounts, setModuleDueCounts] = useState({});
  const [sidebarScope, setSidebarScope] = useState("note-groups");
  const {
    noteGroupSource, setNoteGroupSource, sourceChecking, setSourceChecking, sourceChecked, setSourceChecked, sourceConfirmed, setSourceConfirmed, sourceDuplicateCount, setSourceDuplicateCount, sourceDuplicates, setSourceDuplicates, sourceCheckError, setSourceCheckError, noteGroupSearch, setNoteGroupSearch, noteGroupMode, setNoteGroupMode, readingMode, setReadingMode, readingHoverCardId, setReadingHoverCardId, readingPinnedCardId, setReadingPinnedCardId, activeSourceRangeIndex, setActiveSourceRangeIndex, progressRange, setProgressRange, noteGroupNeedsReviewRegenerating, setNoteGroupNeedsReviewRegenerating, isReadingOpen, setIsReadingOpen, isMetadataOpen, setIsMetadataOpen, metadataSaving, setMetadataSaving, metadataError, setMetadataError, newStudyCardTitle, setNewStudyCardTitle, newStudyCardContent, setNewStudyCardContent, newStudyCardChipIds, setNewStudyCardChipIds, isStudyCreateOpen, setIsStudyCreateOpen, editingStudyCardId, setEditingStudyCardId, editingStudyCard, setEditingStudyCard, isGeneratingQuestions, setIsGeneratingQuestions, isQuestionCreateOpen, setIsQuestionCreateOpen, newQuestionType, setNewQuestionType, newQuestionPrompt, setNewQuestionPrompt, newQuestionOptions, setNewQuestionOptions, newQuestionCorrectIndices, setNewQuestionCorrectIndices, newQuestionRefs, setNewQuestionRefs, editingQuestionCardId, setEditingQuestionCardId, editingQuestionCard, setEditingQuestionCard
  } = routePageModels.noteGroupPageModel;
  const [routeRestoreError, setRouteRestoreError] = useState("");
  const [resolvedRouteContext, setResolvedRouteContext] = useState(null);
  const [mindMapRefreshToken, setMindMapRefreshToken] = useState(0);
  const [mindMapDrilldown, setMindMapDrilldown] = useState({
    sourceKey: "", topicId: "", title: "", graph: null, loading: false, error: ""
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [topicChips, setTopicChips] = useState([]);
  const [topicSearch, setTopicSearch] = useState("");
  const {
    conceptSaving: topicSaving, setConceptSaving: setTopicSaving, conceptKnowledgeNodeRegenerating: topicKnowledgeNodeRegenerating, setConceptKnowledgeNodeRegenerating: setTopicKnowledgeNodeRegenerating, conceptKnowledgeNodeRegeneratingId: topicKnowledgeNodeRegeneratingId, setConceptKnowledgeNodeRegeneratingId: setTopicKnowledgeNodeRegeneratingId, conceptError: topicError, setConceptError: setTopicError
  } = routePageModels.conceptPageModel;
  const [isConceptSettingsOpen, setIsConceptSettingsOpen] = useState(false);
  const [autoRawText, setAutoRawText] = useState("");
  const [autoAdditionalInstructions, setAutoAdditionalInstructions] = useState("");
  const [autoCreateLoading, setAutoCreateLoading] = useState(false);
  const [autoCreateError, setAutoCreateError] = useState("");
  const [sidebarError, setSidebarError] = useState("");
  const [masteryFilter, setMasteryFilter] = useState("all");
  const [isQuestionFocusOpen, setIsQuestionFocusOpen] = useState(false);
  const [focusQuestionCardId, setFocusQuestionCardId] = useState("");
  const readingContentRef = useRef(null);
  const wizardChatRef = useRef(null);
  const confirmResolverRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState(null);
  const routeMatch = matchAppRoute(location.pathname);
  const routeSubjectPageCode = routeMatch.subjectPage ? routeMatch.subjectCode : "";
  const routeSubjectCode = routeMatch.subjectCode;
  const routeModuleCode = routeMatch.moduleCode;
  const routeNoteGroupCode = routeMatch.noteGroupCode;
  const routeTopicCode = routeMatch.topicCode;
  const routePanel = routeMatch.panel || (routeMatch.noteGroup || routeMatch.concept || routeMatch.topic ? "overview" : "");
  const routeCreateNoteGroup = routeMatch.isCreateNoteGroup;
  const hasAppRouteTarget = Boolean(routeSubjectPageCode || routeSubjectCode);
  const requestConfirm = ({ title, description, confirmLabel = "Confirm" }) =>
    new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmAction({ title, description, confirmLabel });
    });
  const resolveConfirm = (value) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(value);
      confirmResolverRef.current = null;
    }
    setConfirmAction(null);
  };
  const resolvedRouteMatches =
    resolvedRouteContext &&
    resolvedRouteContext.subject_short_code === routeSubjectCode &&
    (!routeModuleCode || resolvedRouteContext.module_short_code === routeModuleCode) &&
    (!routeNoteGroupCode ||
      resolvedRouteContext.note_group_short_code === routeNoteGroupCode) &&
    (!routeTopicCode ||
      resolvedRouteContext.concept_short_code === routeTopicCode ||
      resolvedRouteContext.topic_short_code === routeTopicCode);
  const routeSubjectId = resolvedRouteMatches ? resolvedRouteContext.subject_id : "";
  const routeModuleId = resolvedRouteMatches ? resolvedRouteContext.module_id || "" : "";
  const routeNoteGroupId = resolvedRouteMatches
    ? resolvedRouteContext.note_group_id || ""
    : "";
  const routeTopicId = resolvedRouteMatches
    ? resolvedRouteContext.concept_id || resolvedRouteContext.topic_id || ""
    : "";
  const {
    reviewQueue, setReviewQueue, reviewIndex, setReviewIndex, reviewMode, setReviewMode, reviewScope, setReviewScope, reviewCount, setReviewCount, reviewError, setReviewError, reviewAnswer, setReviewAnswer, reviewStartTime, setReviewStartTime, isReviewing, setIsReviewing, reviewFeedback, setReviewFeedback, reviewExplanationOpen, setReviewExplanationOpen, reviewDeleteStep, setReviewDeleteStep, reviewDeleteLoading, setReviewDeleteLoading, reviewStats, setReviewStats, reviewRefreshToken, setReviewRefreshToken, reviewSummary, setReviewSummary, reviewChatMessages, setReviewChatMessages, reviewChatInput, setReviewChatInput, reviewChatError, setReviewChatError, reviewChatLoading, setReviewChatLoading, reviewChatView, setReviewChatView, reviewChatCardId, setReviewChatCardId, reviewChatCardCache, setReviewChatCardCache, reviewChatCardLoading, setReviewChatCardLoading, reviewChatCardError, setReviewChatCardError, reviewChatListRef, reviewDeleteKeyRef: reviewDKeyTimeRef, currentReviewCard, reviewCardType, reviewNoteGroupId, reviewCardRefs, isReviewOverlayVisible
  } = useReviewSession({
    selectedNoteGroupId, selectedConceptId: selectedTopicId, selectedModuleId
  });
  const handleModuleOverviewError = useCallback(
    (error) => showFetchToast(error, "Failed to load note groups"), []
  );
  const {
    noteGroups, setNoteGroups, moduleNoteGroupStats, moduleStats, moduleQuestionTimeline, moduleStatsLoading, moduleStatsError
  } = useModuleOverview({
    moduleId: selectedModuleId, chipFilterIds, reviewRefreshToken, routeNoteGroupId, routeTopicId, setSelectedNoteGroupId, setSelectedTopicId, onError: handleModuleOverviewError
  });
  const isViewCardsPage = routePanel === "view-cards", isInlineStudyPage = routePanel === "study", isStudyPage = routePanel === "study-cards", isQuestionPage = routePanel === "question-cards";
  const isModuleViewCardsPage = isViewCardsPage && !routeNoteGroupId && !routeTopicId;
  const { moduleCardTable, moduleCardTableLoading, moduleCardTableError } = useModuleCardTable({ moduleId: selectedModuleId, isViewCardsPage: isModuleViewCardsPage });
  const hasUnresolvedRouteTarget = Boolean(
    (routeSubjectCode && !resolvedRouteMatches) ||
      (routeSubjectId && selectedSubjectId !== routeSubjectId) ||
      (routeModuleId && (!selectedSubjectId || selectedModuleId !== routeModuleId)) ||
      (routeNoteGroupId &&
        (!selectedSubjectId ||
          !selectedModuleId ||
          selectedNoteGroupId !== routeNoteGroupId)) ||
      (routeTopicId &&
        (!selectedSubjectId ||
          !selectedModuleId ||
          selectedTopicId !== routeTopicId))
  );
  const isRestoringRoute = shouldBlockForRouteRestore({
    hasAppRouteTarget, authLoading: auth.loading, resolvedRouteMatches, hasUnresolvedRouteTarget, routeRestoreError
  });
  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId), [subjects, selectedSubjectId]
  );
  const selectedModuleForActions = useMemo(
    () => modules.find((moduleItem) => moduleItem.id === selectedModuleId),
    [modules, selectedModuleId]
  );
  const selectedNoteGroupForActions = useMemo(
    () => noteGroups.find((noteGroup) => noteGroup.id === selectedNoteGroupId),
    [noteGroups, selectedNoteGroupId]
  );
  const selectedTopicForActions = useMemo(
    () => topicChips.find((topic) => topic.id === selectedTopicId),
    [topicChips, selectedTopicId]
  );
  const selectedSubjectCodeForActions = selectedSubject?.short_code || routeSubjectCode || "", selectedModuleCodeForActions = selectedModuleForActions?.short_code || routeModuleCode || "";
  const refreshModuleGeneratedDataRef = useRef(() => {}), refreshModuleGenerationWorkflowSnapshotRef = useRef(async () => null), nextReviewCardRef = useRef(() => {}), submitReviewAnswerRef = useRef(() => {}), toggleReviewAnswerRef = useRef(() => {});
  const isAdmin = currentUserProfile?.app_role === "admin";
  const canCreateSubjects = Boolean(
    auth.isAuthenticated && (isAdmin || currentUserProfile?.app_role === "creator")
  );
  const canMaintainSubject = (subject) =>
    Boolean(
      auth.isAuthenticated &&
        subject &&
        (isAdmin ||
          subject.current_user_access_level === "owner" ||
          subject.current_user_access_level === "maintainer")
    );
  const canDeleteSubject = (subject) =>
    Boolean(
      auth.isAuthenticated &&
        subject &&
        (isAdmin || subject.current_user_access_level === "owner")
    );
  const canManageSelectedSubject = Boolean(
    canMaintainSubject(selectedSubject)
  );
  const {
    moduleMindMap, moduleMindMapLoading, moduleMindMapError, moduleNeedsReviewRegenerating, handleRegenerateModuleNeedsReviewKnowledgeNodes
  } = useModuleMindMap({
    moduleId: selectedModuleId, selectedNoteGroupId, selectedConceptId: selectedTopicId, noteGroupMode, refreshToken: mindMapRefreshToken, canManageSelectedSubject, canUseProtectedActions, setConcepts: setTopicChips, setRefreshToken: setMindMapRefreshToken
  });
  const isSelectedSubjectPermissionHydrating = Boolean(
    auth.isAuthenticated &&
      selectedSubjectId &&
      (!selectedSubject || (!currentUserProfile && !currentUserError))
  );
  const pollJob = async (jobId, updateStatus, options = {}) => {
    const { maxAttempts = 60, intervalMs = 2000 } = options;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const job = await getJob(jobId);
      updateStatus(job.status);
      if (job.status === "completed") {
        return job;
      }
      if (job.status === "failed") {
        throw new Error(job.error || "Job failed");
      }
      if (job.status === "cancelled") {
        throw new Error("Job cancelled");
      }
      await sleep(intervalMs);
    }
    throw new Error("Job timed out");
  };
  const handleBreadcrumbHome = () => {
    setSelectedSubjectId("");
    setSelectedModuleId("");
    setSelectedNoteGroupId("");
    setSelectedTopicId("");
    setSidebarScope("note-groups");
    setNoteGroupMode("overview");
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    navigate("/");
  };
  const handleBreadcrumbSubject = () => {
    setSelectedModuleId("");
    setSelectedNoteGroupId("");
    setSelectedTopicId("");
    setSidebarScope("note-groups");
    setNoteGroupMode("overview");
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    navigate(selectedSubjectCode ? subjectPath(selectedSubjectCode) : "/");
  };
  function handleBreadcrumbModule() {
    const nextSidebarScope = selectedTopicId || sidebarScope === "concepts" ? "concepts" : "note-groups";
    setSelectedNoteGroupId("");
    setSelectedTopicId("");
    setSidebarScope(nextSidebarScope);
    setNoteGroupMode("overview");
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    navigate(
      selectedSubjectCode && selectedModuleCode
        ? modulePath(selectedSubjectCode, selectedModuleCode)
        : "/",
      { state: { sidebarScope: nextSidebarScope } }
    );
  }
  const handleBackToOverview = () => {
    setNoteGroupMode("overview");
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    navigate(
      selectedSubjectCode && selectedModuleCode && selectedTopicCode
        ? conceptPath(selectedSubjectCode, selectedModuleCode, selectedTopicCode)
        : selectedSubjectCode && selectedModuleCode && selectedNoteGroupCode
          ? noteGroupPath(selectedSubjectCode, selectedModuleCode, selectedNoteGroupCode)
        : selectedSubjectCode && selectedModuleCode
          ? modulePath(selectedSubjectCode, selectedModuleCode)
          : "/"
    );
  };
  const { autoJobActionId, autoJobsByNoteGroupId, canEditCurrentCards, canReorderNoteGroups, chatCardCache, chatCardError, chatCardId, chatCardLoading, chatError, chatInput, chatListRef, chatLoading, chatMessages, chatView, chipFilterValue, chipOptions, clearMindMapDrilldown, effectiveCleanedText, filteredNoteGroupOptions, filteredStudyCards, focusCardType, focusMasteryScore, focusMasteryTier, focusQuestionCard, formatDueAt, formatReviewAt, generationWorkflowsByNoteGroupId, getSectionAnchor, handleBackToChat, handleCancelAutoJob, handleChatKeyDown, handleChipFilterSelect, handleDeleteAutoJob, handleDeleteModule, handleNoteGroupDragEnd, handleNoteGroupDragEnter, handleNoteGroupDragOver, handleNoteGroupDragStart, handleNoteGroupDrop, handleOpenMindMapTopic, handleResetChipFilters, handleRetryAutoJob, handleSaveModuleMetadata, handleSendChat, isSourceReady, metadataTitleDraft, moduleGenerationWorkflow, moduleGenerationWorkflowConnection, moduleGenerationWorkflowError, moduleNoteGroupStatsById, moduleNoteGroupsForDisplay, noteGroupCardTable, noteGroupCardTableError, noteGroupCardTableLoading, noteGroupChipIds, noteGroupMindMap, noteGroupMindMapError, noteGroupMindMapGenerating, noteGroupMindMapLoading, noteGroupProgress, noteGroupProgressError, noteGroupProgressLoading, noteGroupStats, noteGroupStatusMeta, openChatStudyCard, openModuleMetadataModal, pinnedSourceRanges, pinnedStudyCard, questionCardError, questionCards, questionCardsForDisplay, questionJobStatus, questionTimeline, readingAvailable, readingHighlights, refreshModuleGeneratedData, refreshModuleGenerationWorkflowSnapshot, resolveNoteGroupLabel, reviewRefsMessage, sectionNavItems, selectedModule, selectedModuleCode, selectedNoteGroup, selectedNoteGroupCode, selectedNoteGroupWorkflow, selectedSubjectCode, selectedTopic, selectedTopicCode, setChatInput, setMetadataTitleDraft, setNoteGroupCardTable, setNoteGroupChipIds, setNoteGroupMindMap, setNoteGroupMindMapError, setNoteGroupMindMapGenerating, setQuestionCardError, setQuestionCards, setQuestionJobStatus, setStudyCardError, setStudyCards, setTopicDescriptionDraft, setTopicTitleDraft, shouldHoldSelectedNoteGroupContent, sidebarTopicOptions, sourceRangesByCardId, studyCardError, studyCardTitleById, studyCards, studyNoteGroups, studyNoteSections, studySourceNoteGroups, topicCardTableRows, topicDescriptionDraft, topicMindMap, topicMindMapError, topicMindMapLoading, topicTitleDraft, topicUnlinkedQuestionCount } = useStudyAppEffects({
    ConceptScopeContent,
    NoteGroupScopeContent,
    activeSourceRangeIndex,
    auth,
    buildConceptDirectoryRows,
    canManageSelectedSubject,
    canUseProtectedActions,
    chipFilterIds,
    currentReviewCard,
    dragOverNoteGroupId,
    draggedNoteGroupId,
    focusQuestionCardId,
    getConceptMindMap,
    getCurrentUser,
    getMasteryScore,
    getMasteryTier,
    getModuleAdditionalInstructions,
    getModuleQuestionTimeline,
    getNoteGroupStatusMeta,
    getStudyCard,
    hasAppRouteTarget,
    includeDescendantStudyCards,
    isChatOpen,
    isQuestionPage,
    isReadingOpen,
    isReorderingNoteGroups,
    isReviewOverlayVisible,
    isReviewing,
    isSelectedSubjectPermissionHydrating,
    isStudyPage,
    isViewCardsPage,
    listConcepts,
    location,
    masteryFilter,
    mindMapRefreshToken,
    moduleAdditionalInstructionsDraft,
    moduleDescriptionDraft,
    moduleGoalDraft,
    moduleNoteGroupStats,
    modulePath,
    moduleScopeDraft,
    moduleStatsLoading,
    moduleTitleDraft,
    moduleWizardMessages,
    modules,
    navigate,
    nextReviewCard: (...args) => nextReviewCardRef.current(...args),
    normalizeNoteGroups,
    normalizeTimeline,
    noteGroupMode,
    noteGroupSearch,
    noteGroups,
    progressRange,
    readingHoverCardId,
    readingPinnedCardId,
    requestConfirm,
    reviewAnswer,
    reviewCardRefs,
    reviewCardType,
    reviewDKeyTimeRef,
    reviewDeleteLoading,
    reviewFeedback,
    reviewIndex,
    reviewQueue,
    reviewRefreshToken,
    reviewStartTime,
    reviewSummary,
    routeCreateNoteGroup,
    routeModuleCode,
    routeNoteGroupCode,
    routeNoteGroupId,
    routePanel,
    routeSubjectCode,
    routeSubjectId,
    routeSubjectPageCode,
    routeTopicCode,
    routeTopicId,
    selectedModuleId,
    selectedModuleIdRef,
    selectedNoteGroupId,
    selectedSubject,
    selectedSubjectId,
    selectedSubjectIdRef,
    selectedTopicId,
    setAutoAdditionalInstructions,
    setAutoCreateError,
    setAutoRawText,
    setChipFilterIds,
    setCurrentUserError,
    setCurrentUserProfile,
    setDragOverNoteGroupId,
    setDraggedNoteGroupId,
    setFocusQuestionCardId,
    setIsAdminPanelOpen,
    setIsChatOpen,
    setIsMetadataOpen,
    setIsModuleMetadataOpen,
    setIsQuestionCreateOpen,
    setIsQuestionFocusOpen,
    setIsReadingOpen,
    setIsReorderingNoteGroups,
    setIsStudyCreateOpen,
    setIsSubjectManagementOpen,
    setMetadataError,
    setMindMapDrilldown,
    setMindMapRefreshToken,
    setModuleAdditionalInstructionsDraft,
    setModuleDescriptionDraft,
    setModuleDueCounts,
    setModuleGoalDraft,
    setModuleMetadataError,
    setModuleMetadataSaving,
    setModuleScopeDraft,
    setModuleTitleDraft,
    setModules,
    setNewQuestionRefs,
    setNewStudyCardChipIds,
    setNoteGroupMode,
    setNoteGroupSearch,
    setNoteGroupSource,
    setNoteGroups,
    setReadingHoverCardId,
    setReadingMode,
    setReadingPinnedCardId,
    setResolvedRouteContext,
    setReviewChatCardCache,
    setReviewRefreshToken,
    setReviewSummary,
    setRouteRestoreError,
    setSelectedModuleId,
    setSelectedNoteGroupId,
    setSelectedSubjectId,
    setSelectedTopicId,
    setSidebarError,
    setSidebarScope,
    setSourceCheckError,
    setSourceChecked,
    setSourceChecking,
    setSourceConfirmed,
    setSourceDuplicateCount,
    setSourceDuplicates,
    setTopicChips,
    setTopicSearch,
    shouldClearSelectedSubject,
    showFetchToast,
    sourceConfirmed,
    subjects,
    submitReviewAnswer: (...args) => submitReviewAnswerRef.current(...args),
    toast,
    toggleReviewAnswer: (...args) => toggleReviewAnswerRef.current(...args),
    topicChips,
    topicSearch,
    useCallback,
    useConceptPageData,
    useConceptRouteResolution,
    useEffect,
    useMemo,
    useModuleGenerationWorkflow,
    useModulePageActions,
    useNoteGroupPageData,
    useNoteGroupRouteResolution,
    useStudyScopeData,
    useSubjectModuleRouteResolution,
    wizardChatRef
  });
  refreshModuleGeneratedDataRef.current = refreshModuleGeneratedData;
  refreshModuleGenerationWorkflowSnapshotRef.current = refreshModuleGenerationWorkflowSnapshot;
  const {
    handleAutoCreateNoteGroup,
    handleCheckSource,
    handleConfirmDuplicateSource,
    handleCreateModuleFromWizard,
    handleCreateSubjectFromWizard,
    handleDeleteSubject,
    handleModuleWizardSend,
    handleOpenModuleWizard,
    handleOpenSubjectWizard,
    handleReadingModeChange,
    handleReadingNextStudyCard,
    handleReadingPreviousStudyCard,
    handleReadingSourceRangeNext,
    handleReadingSourceRangePrevious,
    handleReadingTitleClick,
    handleReadingToggleMode,
    handleReadingUnpin,
    handleReadingViewInClean,
    handleSaveSubjectMetadata,
    handleScrollNavToCard,
    handleSelectModule,
    handleSelectNoteGroup,
    handleSelectSubject,
    handleSelectTopic,
    handleSignIn,
    handleSignOut,
    handleStartAutoNoteGroup,
    handleSubjectUpdated,
    handleSubjectWizardSend,
    handleUniqueIdChange,
    handleUseGeneratedUniqueId,
    navigateToNoteGroup,
    navigateToTopic,
    openSubjectMetadataModal
  } = useStudyAppWorkflowActions({ activeSourceRangeIndex, attachConcepts, auth, authEmail, authSubmitting, autoAdditionalInstructions, autoCreateNoteGroup, autoRawText, canCreateSubjects, canDeleteSubject, canMaintainSubject, canManageSelectedSubject, canUseProtectedActions, checkNoteGroupSource, conceptPath, countWords, createConcept, createModule, createNoteGroupPath, createSubject, deleteSubject, detachConcept, generateUniqueId, getLocalMailpitUrl, getModuleAdditionalInstructions, getNoteGroup, handleBreadcrumbModule, isQuestionPage, isStudyPage, isViewCardsPage, moduleChipDescription, moduleChipLabel, modulePath, moduleWizardCreating, moduleWizardGoal, moduleWizardInput, moduleWizardLoading, moduleWizardMessages, moduleWizardScope, moduleWizardTitle, modules, navigate, newSubjectDescription, newSubjectTitle, noteGroupNeedsReviewRegenerating, noteGroupPath, noteGroupSource, noteGroups, pollJob, readingContentRef, readingHoverCardId, readingMode, readingPinnedCardId, refreshModuleGeneratedData: (...args) => refreshModuleGeneratedDataRef.current(...args), refreshModuleGenerationWorkflowSnapshot: (...args) => refreshModuleGenerationWorkflowSnapshotRef.current(...args), regenerateNoteGroupNeedsReviewKnowledgeNodes, requestConfirm, routePanel, selectedModule: selectedModuleForActions, selectedModuleCode: selectedModuleCodeForActions, selectedModuleId, selectedNoteGroup: selectedNoteGroupForActions, selectedNoteGroupId, selectedNoteGroupIdRef, selectedSubject, selectedSubjectCode: selectedSubjectCodeForActions, selectedSubjectId, selectedTopic: selectedTopicForActions, selectedTopicId, sendModuleIntentChat, sendSubjectIntentChat, setActiveSourceRangeIndex, setAuthMessage, setAuthSubmitting, setAuthUiError, setAutoAdditionalInstructions, setAutoCreateError, setAutoCreateLoading, setAutoRawText, setChipFilterIds, setCurrentUserProfile, setEditingSubjectId, setIsAdminPanelOpen, setIsChatOpen, setIsMetadataOpen, setIsModuleMetadataOpen, setIsModuleWizardOpen, setIsSubjectManagementOpen, setIsSubjectMetadataOpen, setIsSubjectWizardOpen, setMetadataError, setMetadataSaving, setMindMapRefreshToken, setModuleChipDescription, setModuleChipLabel, setModuleWizardCreating, setModuleWizardError, setModuleWizardGoal, setModuleWizardInput, setModuleWizardLoading, setModuleWizardMessages, setModuleWizardScope, setModuleWizardTitle, setModules, setNewSubjectDescription, setNewSubjectTitle, setNoteGroupMode, setNoteGroupNeedsReviewRegenerating, setNoteGroupSearch, setNoteGroupSource, setNoteGroups, setReadingHoverCardId, setReadingMode, setReadingPinnedCardId, setReviewSummary, setSelectedModuleId, setSelectedNoteGroupId, setSelectedSubjectId, setSelectedTopicId, setSidebarError, setSidebarScope, setSourceCheckError, setSourceChecked, setSourceChecking, setSourceConfirmed, setSourceDuplicateCount, setSourceDuplicates, setSubjectGoalDraft, setSubjectMetadataError, setSubjectMetadataSaving, setSubjectScopeDraft, setSubjectTitleDraft, setSubjectWizardCreating, setSubjectWizardError, setSubjectWizardGoal, setSubjectWizardInput, setSubjectWizardLoading, setSubjectWizardMessages, setSubjectWizardScope, setSubjectWizardTitle, setSubjects, setTopicChips, sourceConfirmed, studyNoteSections, subjectGoalDraft, subjectPath, subjectScopeDraft, subjectTitleDraft, subjectWizardCreating, subjectWizardGoal, subjectWizardInput, subjectWizardLoading, subjectWizardMessages, subjectWizardScope, subjectWizardTitle, subjects, toast, topicChips, updateSubject });
  const { cancelReviewDelete, closeQuestionFocus, confirmReviewDelete, endReview, executeReviewDelete, handleBackToReviewChat, handleReviewChatKeyDown, handleSendReviewChat, nextReviewCard, openQuestionFocus, openReviewStudyCard, requestReviewDelete, startReview, submitReviewAnswer, toggleReviewAnswer, toggleReviewExplanation } = useReviewWorkflowActions({ buildReviewCard, canUseProtectedActions, currentReviewCard, deleteQuestionCard, formatAnswerLabels, getStudyCard, includeDescendantStudyCards, listConceptReviewQuestionCards, listModuleReviewQuestionCards, listReviewQuestionCards, requestConfirm, reviewAnswer, reviewChatCardCache, reviewChatInput, reviewChatLoading, reviewChatMessages, reviewCount, reviewDeleteLoading, reviewFeedback, reviewIndex, reviewMode, reviewNoteGroupId, reviewQuestionCard, reviewQueue, reviewScope, reviewStartTime, reviewStats, selectedModuleId, selectedNoteGroupId, selectedTopicId, sendChat, setFocusQuestionCardId, setIsQuestionFocusOpen, setIsReviewing, setQuestionCards, setReviewAnswer, setReviewChatCardCache, setReviewChatCardError, setReviewChatCardId, setReviewChatCardLoading, setReviewChatError, setReviewChatInput, setReviewChatLoading, setReviewChatMessages, setReviewChatView, setReviewDeleteLoading, setReviewDeleteStep, setReviewError, setReviewExplanationOpen, setReviewFeedback, setReviewIndex, setReviewMode, setReviewQueue, setReviewRefreshToken, setReviewScope, setReviewStartTime, setReviewStats, setReviewSummary });
  nextReviewCardRef.current = nextReviewCard; submitReviewAnswerRef.current = submitReviewAnswer; toggleReviewAnswerRef.current = toggleReviewAnswer;
  const {
    handleCreateQuestionCard,
    handleCreateStudyCard,
    handleDeleteNoteGroup,
    handleDeleteQuestionCard,
    handleDeleteStudyCard,
    handleDeleteTopic,
    handleEditQuestionCard,
    handleEditStudyCard,
    handleGenerateNoteGroupMindMap,
    handleGenerateQuestions,
    handleRegenerateNeedsReviewKnowledgeNodes,
    handleRegenerateTopicKnowledgeNodes,
    handleSaveMetadataTitle,
    handleSaveQuestionCard,
    handleSaveStudyCard,
    handleSaveTopic,
    openMetadataModal,
    openQuestionCreateModal,
    openStudyCreateModal
  } = useStudyAppPageActions({ canManageSelectedSubject, canUseProtectedActions, editingQuestionCard, editingStudyCard, metadataTitleDraft, navigate, newQuestionCorrectIndices, newQuestionOptions, newQuestionPrompt, newQuestionRefs, newQuestionType, newStudyCardChipIds, newStudyCardContent, newStudyCardTitle, noteGroupMindMapGenerating, noteGroupNeedsReviewRegenerating, pollJob, regenerateNoteGroupNeedsReviewKnowledgeNodes, requestConfirm, selectedModuleCode, selectedModuleId, selectedNoteGroup, selectedNoteGroupId, selectedNoteGroupIdRef, selectedSubjectCode, selectedTopic, selectedTopicId, setEditingQuestionCard, setEditingQuestionCardId, setEditingStudyCard, setEditingStudyCardId, setIsChatOpen, setIsGeneratingQuestions, setIsMetadataOpen, setIsQuestionCreateOpen, setIsStudyCreateOpen, setMetadataError, setMetadataSaving, setMetadataTitleDraft, setMindMapRefreshToken, setNewQuestionCorrectIndices, setNewQuestionOptions, setNewQuestionPrompt, setNewQuestionRefs, setNewStudyCardChipIds, setNewStudyCardContent, setNewStudyCardTitle, setNoteGroupCardTable, setNoteGroupMindMap, setNoteGroupMindMapError, setNoteGroupMindMapGenerating, setNoteGroupMode, setNoteGroupNeedsReviewRegenerating, setNoteGroups, setQuestionCardError, setQuestionCards, setQuestionJobStatus, setReviewSummary, setSelectedNoteGroupId, setSelectedTopicId, setSidebarError, setSidebarScope, setStudyCardError, setStudyCards, setTopicChips, setTopicDescriptionDraft, setTopicError, setTopicKnowledgeNodeRegenerating, setTopicKnowledgeNodeRegeneratingId, setTopicSaving, setTopicTitleDraft, studyCards, topicDescriptionDraft, topicKnowledgeNodeRegenerating, topicTitleDraft });
  const hasSidebar = Boolean(selectedSubjectId && selectedModuleId);
  const pageHeader = getStudyPageHeader({
    noteGroupMode,
    selectedTopic,
    selectedNoteGroup,
    selectedModule,
    selectedSubject
  });
  const pageBreadcrumbs = [
    { label: "Subjects", onClick: handleBreadcrumbHome, current: !selectedSubject }
  ];
  if (selectedSubject) {
    pageBreadcrumbs.push({
      label: selectedSubject.title,
      onClick: handleBreadcrumbSubject,
      current: !selectedModule
    });
  }
  if (selectedModule) {
    pageBreadcrumbs.push({
      label: selectedModule.title,
      onClick: handleBreadcrumbModule,
      current: noteGroupMode !== "auto" && !selectedNoteGroup && !selectedTopic
    });
  }
  if (noteGroupMode === "auto") {
    pageBreadcrumbs.push({ label: "Create note group", current: true });
  } else if (selectedTopic) {
    pageBreadcrumbs.push({ label: selectedTopic.label || "Concept", current: true });
  } else if (selectedNoteGroup) {
    pageBreadcrumbs.push({ label: selectedNoteGroup.title || "Untitled", current: true });
  }
  const sidebarContent = hasSidebar ? (
    <ContextSidebar
      subjectTitle={selectedSubject?.title}
      moduleTitle={selectedModule?.title}
      onEditSubject={handleBreadcrumbHome}
      onEditModule={handleBreadcrumbSubject}
      scope={sidebarScope}
      onScopeChange={setSidebarScope}
      noteGroupSearch={noteGroupSearch}
      conceptSearch={topicSearch}
      onNoteGroupSearchChange={setNoteGroupSearch}
      onConceptSearchChange={setTopicSearch}
      noteGroups={filteredNoteGroupOptions.map((option) => {
        const workflow = generationWorkflowsByNoteGroupId[option.value];
        const statusMeta = getNoteGroupStatusMeta(option.status);
        const statsEntry = moduleNoteGroupStatsById.get(option.value);
        const dueCount = statsEntry?.dueCount;
        return {
          ...option,
          label: workflow ? generationWorkflowTitle(workflow) : option.label,
          description: workflow
            ? generationWorkflowStageLabel(workflow)
            : formatCreatedAt(option.createdAt),
          badge: Number.isInteger(dueCount) ? String(dueCount) : "...",
          statusLabel: workflow ? generationWorkflowStatusLabel(workflow) : statusMeta?.label || ""
        };
      })}
      concepts={sidebarTopicOptions}
      selectedNoteGroupId={selectedNoteGroupId}
      selectedConceptId={selectedTopicId}
      canCreateNoteGroup={canManageSelectedSubject}
      showCreateNoteGroup={canUseProtectedActions}
      onSelectNoteGroup={handleSelectNoteGroup}
      onSelectConcept={handleSelectTopic}
      onCreateNoteGroup={handleStartAutoNoteGroup}
      error={sidebarError}
    />
  ) : null;
  const authActions = (
    <StudyAppAuthActions auth={auth} authEmail={authEmail} authMessage={authMessage} authSubmitting={authSubmitting} authUiError={authUiError} canManageSelectedSubject={canManageSelectedSubject} currentUserError={currentUserError} handleSignIn={handleSignIn} handleSignOut={handleSignOut} isAdmin={isAdmin} isAdminPanelOpen={isAdminPanelOpen} isSubjectManagementOpen={isSubjectManagementOpen} setAuthEmail={setAuthEmail} setIsAdminPanelOpen={setIsAdminPanelOpen} setIsSubjectManagementOpen={setIsSubjectManagementOpen} />
  );
  return <StudyAppView model={{
    activeSourceRangeIndex, authActions,
    autoAdditionalInstructions,
    autoCreateError,
    autoCreateLoading,
    autoJobActionId,
    autoJobsByNoteGroupId,
    autoRawText,
    canCreateSubjects,
    canDeleteSubject,
    canEditCurrentCards,
    canMaintainSubject,
    canManageSelectedSubject,
    canReorderNoteGroups,
    canUseProtectedActions,
    cancelReviewDelete,
    chatCardCache,
    chatCardError,
    chatCardId,
    chatCardLoading,
    chatError,
    chatInput,
    chatListRef,
    chatLoading,
    chatMessages,
    chatView,
    chipFilterIds,
    chipFilterValue,
    chipOptions,
    clearMindMapDrilldown,
    closeQuestionFocus,
    confirmAction,
    confirmReviewDelete,
    currentReviewCard,
    currentUserProfile,
    dragOverNoteGroupId,
    draggedNoteGroupId,
    editingQuestionCard,
    editingQuestionCardId,
    editingStudyCard,
    editingStudyCardId,
    editingSubjectId,
    effectiveCleanedText,
    endReview,
    filteredStudyCards,
    focusCardType,
    focusMasteryScore,
    focusMasteryTier,
    focusQuestionCard,
    formatDueAt,
    formatReviewAt,
    generationWorkflowsByNoteGroupId,
    getSectionAnchor,
    handleAutoCreateNoteGroup,
    handleBackToChat,
    handleBackToOverview,
    handleBackToReviewChat,
    handleBreadcrumbHome,
    handleCancelAutoJob,
    handleChatKeyDown,
    handleCheckSource,
    handleChipFilterSelect,
    handleConfirmDuplicateSource,
    handleCreateModuleFromWizard,
    handleCreateQuestionCard,
    handleCreateStudyCard,
    handleCreateSubjectFromWizard,
    handleDeleteAutoJob,
    handleDeleteModule,
    handleDeleteNoteGroup,
    handleDeleteQuestionCard,
    handleDeleteStudyCard,
    handleDeleteSubject,
    handleDeleteTopic,
    handleEditQuestionCard,
    handleEditStudyCard,
    handleGenerateNoteGroupMindMap,
    handleGenerateQuestions,
    handleModuleWizardSend,
    handleNoteGroupDragEnd,
    handleNoteGroupDragEnter,
    handleNoteGroupDragOver,
    handleNoteGroupDragStart,
    handleNoteGroupDrop,
    handleOpenMindMapTopic,
    handleOpenModuleWizard,
    handleOpenSubjectWizard,
    handleReadingModeChange, handleReadingNextStudyCard, handleReadingPreviousStudyCard, handleReadingSourceRangeNext, handleReadingSourceRangePrevious,
    handleReadingTitleClick, handleReadingToggleMode, handleReadingUnpin, handleReadingViewInClean,
    handleRegenerateModuleNeedsReviewKnowledgeNodes,
    handleRegenerateNeedsReviewKnowledgeNodes,
    handleRegenerateTopicKnowledgeNodes,
    handleResetChipFilters,
    handleRetryAutoJob,
    handleReviewChatKeyDown,
    handleSaveMetadataTitle,
    handleSaveModuleMetadata,
    handleSaveQuestionCard,
    handleSaveStudyCard,
    handleSaveSubjectMetadata,
    handleSaveTopic,
    handleScrollNavToCard,
    handleSelectModule,
    handleSelectSubject,
    handleSendChat,
    handleSendReviewChat,
    handleSubjectUpdated,
    handleSubjectWizardSend,
    handleUniqueIdChange,
    handleUseGeneratedUniqueId,
    hasSidebar,
    includeDescendantStudyCards,
    isAdmin,
    isAdminPanelOpen,
    isChatOpen,
    isConceptSettingsOpen,
    isGeneratingQuestions,
    isMetadataOpen,
    isModuleMetadataOpen,
    isModuleWizardOpen,
    isQuestionCreateOpen,
    isQuestionFocusOpen,
    isQuestionPage, isReadingOpen, isReorderingNoteGroups, isRestoringRoute, isReviewOverlayVisible, isReviewing, isInlineStudyPage, isSourceReady, isStudyCreateOpen, isStudyPage, isSubjectManagementOpen, isSubjectMetadataOpen, isSubjectWizardOpen, isViewCardsPage,
    masteryFilter,
    metadataError,
    metadataSaving,
    metadataTitleDraft,
    mindMapDrilldown,
    moduleAdditionalInstructionsDraft,
    moduleDescriptionDraft,
    moduleDueCounts,
    moduleCardTable, moduleCardTableError, moduleCardTableLoading,
    moduleGenerationWorkflow,
    moduleGenerationWorkflowConnection,
    moduleGenerationWorkflowError,
    moduleGoalDraft,
    moduleMetadataError,
    moduleMetadataSaving,
    moduleMindMap,
    moduleMindMapError,
    moduleMindMapLoading,
    moduleNeedsReviewRegenerating,
    moduleNoteGroupStatsById,
    moduleNoteGroupsForDisplay,
    moduleQuestionTimeline,
    moduleScopeDraft,
    moduleStats,
    moduleStatsError,
    moduleStatsLoading,
    moduleTitleDraft,
    moduleWizardCreating,
    moduleWizardError,
    moduleWizardGoal,
    moduleWizardInput,
    moduleWizardLoading,
    moduleWizardMessages,
    moduleWizardScope,
    moduleWizardTitle,
    modules,
    navigate,
    navigateToNoteGroup,
    navigateToTopic,
    newQuestionCorrectIndices,
    newQuestionOptions,
    newQuestionPrompt,
    newQuestionRefs,
    newQuestionType,
    newStudyCardChipIds,
    newStudyCardContent,
    newStudyCardTitle,
    nextReviewCard,
    noteGroupCardTable,
    noteGroupCardTableError,
    noteGroupCardTableLoading,
    noteGroupChipIds,
    noteGroupMindMap,
    noteGroupMindMapError,
    noteGroupMindMapGenerating,
    noteGroupMindMapLoading,
    noteGroupMode,
    noteGroupNeedsReviewRegenerating,
    noteGroupProgress,
    noteGroupProgressError,
    noteGroupProgressLoading,
    noteGroupSource,
    noteGroupStats,
    noteGroupStatusMeta,
    openChatStudyCard,
    openMetadataModal,
    openModuleMetadataModal,
    openQuestionCreateModal,
    openQuestionFocus,
    openReviewStudyCard,
    openStudyCreateModal,
    openSubjectMetadataModal,
    pinnedSourceRanges, pinnedStudyCard,
    pageBreadcrumbs,
    pageHeader,
    progressRange,
    questionCardError,
    questionCards,
    questionCardsForDisplay,
    questionJobStatus,
    questionTimeline,
    readingAvailable, readingContentRef, readingHighlights,
    readingHoverCardId, readingMode, readingPinnedCardId,
    requestReviewDelete,
    resolveConfirm,
    resolveNoteGroupLabel,
    reviewAnswer,
    reviewCardRefs,
    reviewCardType,
    reviewChatCardCache,
    reviewChatCardError,
    reviewChatCardId,
    reviewChatCardLoading,
    reviewChatError,
    reviewChatInput,
    reviewChatListRef,
    reviewChatLoading,
    reviewChatMessages,
    reviewChatView,
    reviewCount,
    reviewDeleteLoading,
    reviewDeleteStep,
    reviewError,
    reviewExplanationOpen,
    reviewFeedback,
    reviewIndex,
    reviewMode,
    reviewNoteGroupId,
    reviewQueue,
    reviewRefsMessage,
    reviewScope,
    reviewSummary,
    routeRestoreError,
    routePanel,
    sectionNavItems,
    selectedModule,
    selectedModuleCode,
    selectedModuleId,
    selectedNoteGroup,
    selectedNoteGroupCode,
    selectedNoteGroupId,
    selectedNoteGroupWorkflow,
    selectedSubject,
    selectedSubjectCode,
    selectedSubjectId,
    selectedTopic,
    selectedTopicCode,
    selectedTopicId,
    setAutoAdditionalInstructions,
    setAutoRawText,
    setChatInput,
    setEditingQuestionCard,
    setEditingQuestionCardId,
    setEditingStudyCard,
    setEditingStudyCardId,
    setIncludeDescendantStudyCards,
    setIsAdminPanelOpen,
    setIsChatOpen,
    setIsConceptSettingsOpen,
    setIsMetadataOpen,
    setIsModuleMetadataOpen,
    setIsModuleWizardOpen,
    setIsQuestionCreateOpen,
    setIsReadingOpen,
    setIsStudyCreateOpen,
    setIsSubjectManagementOpen,
    setIsSubjectMetadataOpen,
    setIsSubjectWizardOpen,
    setMasteryFilter,
    setMetadataTitleDraft,
    setModuleAdditionalInstructionsDraft,
    setModuleDescriptionDraft,
    setModuleGoalDraft,
    setModuleScopeDraft,
    setModuleTitleDraft,
    setModuleWizardGoal,
    setModuleWizardInput,
    setModuleWizardScope,
    setModuleWizardTitle,
    setNewQuestionCorrectIndices,
    setNewQuestionOptions,
    setNewQuestionPrompt,
    setNewQuestionRefs,
    setNewQuestionType,
    setNewStudyCardChipIds,
    setNewStudyCardContent,
    setNewStudyCardTitle,
    setProgressRange,
    setReadingHoverCardId,
    setReadingPinnedCardId,
    setReviewChatInput,
    setReviewCount,
    setReviewSummary,
    setSubjectGoalDraft,
    setSubjectScopeDraft,
    setSubjectTitleDraft,
    setSubjectWizardGoal,
    setSubjectWizardInput,
    setSubjectWizardScope,
    setSubjectWizardTitle,
    setTopicDescriptionDraft,
    setTopicTitleDraft,
    shouldHoldSelectedNoteGroupContent,
    sidebarContent, sidebarError, sourceRangesByCardId,
    sourceCheckError,
    sourceChecked,
    sourceChecking,
    sourceConfirmed,
    sourceDuplicateCount,
    sourceDuplicates,
    startReview,
    studyCardError,
    studyCardTitleById,
    studyCards,
    studyNoteGroups,
    studyNoteSections,
    studySourceNoteGroups,
    subjectGoalDraft,
    subjectMetadataError,
    subjectMetadataSaving,
    subjectScopeDraft,
    subjectTitleDraft,
    subjectWizardCreating,
    subjectWizardError,
    subjectWizardGoal,
    subjectWizardInput,
    subjectWizardLoading,
    subjectWizardMessages,
    subjectWizardScope,
    subjectWizardTitle,
    subjects,
    submitReviewAnswer,
    toggleReviewAnswer,
    topicCardTableRows,
    topicChips,
    topicDescriptionDraft,
    topicError,
    topicKnowledgeNodeRegenerating,
    topicKnowledgeNodeRegeneratingId,
    topicMindMap,
    topicMindMapError,
    topicMindMapLoading,
    topicSaving,
    topicTitleDraft,
    topicUnlinkedQuestionCount,
    wizardChatRef
  }} />;
}
export { StudyAppShell };
