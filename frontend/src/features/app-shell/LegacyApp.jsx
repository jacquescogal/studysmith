import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Select from "react-select";
import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/auth/AuthProvider";
import { getLocalMailpitUrl } from "@/auth/supabaseClient";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/AppShell";
import { ContextSidebar } from "@/components/layout/ContextSidebar";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionNav } from "@/components/layout/SectionNav";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { LegacyDialog } from "@/components/common/LegacyDialog";
import { ModuleIndexPage } from "@/features/modules/ModuleIndexPage";
import { ModuleHomePage } from "@/features/modules/ModuleHomePage";
import { useModulePageActions } from "@/features/modules/useModulePageActions";
import { useModulePageState } from "@/features/modules/useModulePageState";
import { AdminPanel } from "@/features/admin/AdminPanel";
import { NoteGroupCreate } from "@/features/note-groups/NoteGroupCreate";
import { useNoteGroupPageActions } from "@/features/note-groups/useNoteGroupPageActions";
import { useNoteGroupPageState } from "@/features/note-groups/useNoteGroupPageState";
import { useConceptPageActions } from "@/features/concepts/useConceptPageActions";
import { useConceptPageState } from "@/features/concepts/useConceptPageState";
import { ReadingDialog } from "@/features/reading/ReadingDialog";
import { ReviewDialog } from "@/features/review/ReviewDialog";
import { SubjectIndexPage as SubjectIndexRouteContent } from "@/features/subjects/SubjectIndexPage";
import { SubjectManagementPanel } from "@/features/subjects/SubjectManagementPanel";
import {
  ConceptScopeContent,
  NoteGroupScopeContent
} from "@/features/study-scope/StudyScopeContent";
import { TutorChatDialog } from "@/features/chat/TutorChatDialog";
import {
  shouldBlockForRouteRestore,
  shouldClearSelectedSubject
} from "@/routes/routeRestore";
import {
  createNoteGroupPath,
  matchAppRoute,
  modulePath,
  noteGroupPath,
  subjectPath,
  conceptPath
} from "@/lib/routes";
import {
  countWords,
  formatAnswerLabels,
  formatCreatedAt,
  getModuleAdditionalInstructions,
  getNoteGroupStatusMeta,
  normalizeNoteGroups,
  normalizeTimeline
} from "@/lib/format";
import { buildReviewCard, getMasteryScore, getMasteryTier } from "@/lib/review";
import { renderCleanedMarkdown, renderMarkdownBlocks } from "@/lib/text-rendering";
import { buildConceptDirectoryRows } from "@/lib/conceptDirectory";
import { getStudyPageHeader } from "@/lib/pageHeaderState";
import { useSubjectModules } from "@/hooks/useSubjectModules";
import { useSubjects } from "@/hooks/useSubjects";
import { useModuleOverview } from "@/hooks/useModuleOverview";
import { useModuleMindMap } from "@/hooks/useModuleMindMap";
import { useModuleGenerationWorkflow } from "@/hooks/useModuleGenerationWorkflow";
import { useStudyScopeData } from "@/hooks/useStudyScopeData";
import { useNoteGroupPageData } from "@/hooks/useNoteGroupPageData";
import { useConceptPageData } from "@/hooks/useConceptPageData";
import { useTutorChat } from "@/hooks/useTutorChat";
import { useReviewSession } from "@/hooks/useReviewSession";
import { useSubjectModuleRouteResolution } from "@/routes/useSubjectModuleRouteResolution";
import { useNoteGroupRouteResolution } from "@/routes/useNoteGroupRouteResolution";
import { useConceptRouteResolution } from "@/routes/useConceptRouteResolution";
import { useRouteSelectionState } from "@/routes/useRouteSelectionState";
import {
  attachConcepts,
  autoCreateNoteGroup,
  checkNoteGroupSource,
  createModule,
  createSubject,
  createConcept,
  deleteQuestionCard,
  deleteSubject,
  detachConcept,
  getCurrentUser,
  getJob,
  getModuleQuestionTimeline,
  getNoteGroup,
  getStudyCard,
  getConceptMindMap,
  listModuleReviewQuestionCards,
  listModules,
  listReviewQuestionCards,
  listConcepts,
  listConceptReviewQuestionCards,
  regenerateNoteGroupNeedsReviewKnowledgeNodes,
  reviewQuestionCard,
  sendChat,
  sendModuleIntentChat,
  sendSubjectIntentChat,
  updateSubject
} from "@/api";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generateUniqueId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const selectStyles = {
  menuPortal: (base) => ({ ...base, zIndex: 9999 })
};

const panelClass =
  "rounded-lg border bg-card p-6 text-card-foreground shadow-sm";
const primaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50";
const outlineButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50";
const smallOutlineButtonClass =
  "inline-flex h-8 items-center justify-center gap-2 rounded-md border bg-background px-3 py-1 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50";
const destructiveOutlineButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-destructive/30 bg-background px-4 py-2 text-sm font-medium text-destructive shadow-xs transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:pointer-events-none disabled:opacity-50";
const smallDestructiveOutlineButtonClass =
  "inline-flex h-8 items-center justify-center gap-2 rounded-md border border-destructive/30 bg-background px-3 py-1 text-sm font-medium text-destructive shadow-xs transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:pointer-events-none disabled:opacity-50";
const buttonRowClass = "flex flex-wrap gap-2";
const badgeClass =
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground";
const mutedTextClass = "text-sm text-muted-foreground";
const smallMutedTextClass = "text-xs text-muted-foreground";
const errorTextClass = "text-sm font-medium text-destructive";

const showFetchToast = (error, fallback) => {
  toast.error(error?.message || fallback);
};

const generationWorkflowTitle = (workflow) =>
  workflow?.draft_title ||
  workflow?.note_group?.title ||
  (workflow?.job?.id ? `Generation ${workflow.job.id.slice(0, 8)}` : "Generating");

const generationWorkflowStageLabel = (workflow) => {
  const stage = workflow?.current_stage || workflow?.job?.current_stage || workflow?.job?.status || "";
  const labels = {
    queued: "Queued",
    title: "Title",
    cleaned_text: "Cleaned Text",
    study_cards: "Study Cards",
    embeddings: "Embeddings",
    formatted_text: "Formatted Text",
    question_cards: "Question Cards",
    mind_map_topics: "Mind Map and Concepts",
    topic_knowledge_nodes: "Concept Knowledge Nodes",
    promoting: "Publishing"
  };
  return labels[stage] || String(stage || "Generating").replace(/_/g, " ");
};

const generationWorkflowStatusLabel = (workflow) => {
  const status = workflow?.job?.status || "";
  const labels = {
    queued: "Queued",
    running: "Running",
    failed: "Failed",
    cancelled: "Cancelled",
    connected: "Connected",
    connecting: "Connecting",
    error: "Connection issue",
    idle: "Idle"
  };
  return labels[status] || String(status || "Generating").replace(/_/g, " ");
};

function LegacyApp() {
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
    (error) => showFetchToast(error, "Failed to load subjects"),
    []
  );
  const handleModulesLoadError = useCallback(
    (error) => showFetchToast(error, "Failed to load modules"),
    []
  );
  const { subjects, setSubjects } = useSubjects({
    authLoading: auth.loading,
    isAuthenticated: auth.isAuthenticated,
    userId: auth.user?.id,
    onError: handleSubjectsLoadError
  });
  const {
    selectedSubjectId,
    setSelectedSubjectId,
    selectedModuleId,
    setSelectedModuleId,
    selectedNoteGroupId,
    setSelectedNoteGroupId,
    selectedTopicId,
    setSelectedTopicId,
    selectedSubjectIdRef,
    selectedModuleIdRef,
    selectedNoteGroupIdRef
  } = useRouteSelectionState();
  const [newSubjectTitle, setNewSubjectTitle] = useState("");
  const [newSubjectDescription, setNewSubjectDescription] = useState("");
  const [isSubjectWizardOpen, setIsSubjectWizardOpen] = useState(false);
  const [subjectWizardMessages, setSubjectWizardMessages] = useState([]);
  const [subjectWizardInput, setSubjectWizardInput] = useState("");
  const [subjectWizardLoading, setSubjectWizardLoading] = useState(false);
  const [subjectWizardTitle, setSubjectWizardTitle] = useState("");
  const [subjectWizardGoal, setSubjectWizardGoal] = useState("");
  const [subjectWizardScope, setSubjectWizardScope] = useState("");
  const [subjectWizardError, setSubjectWizardError] = useState("");
  const [subjectWizardCreating, setSubjectWizardCreating] = useState(false);
  const [isSubjectMetadataOpen, setIsSubjectMetadataOpen] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [subjectTitleDraft, setSubjectTitleDraft] = useState("");
  const [subjectGoalDraft, setSubjectGoalDraft] = useState("");
  const [subjectScopeDraft, setSubjectScopeDraft] = useState("");
  const [subjectMetadataSaving, setSubjectMetadataSaving] = useState(false);
  const [subjectMetadataError, setSubjectMetadataError] = useState("");

  const { modules, setModules } = useSubjectModules({
    subjectId: selectedSubjectId,
    onError: handleModulesLoadError
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
    moduleTitleDraft,
    setModuleTitleDraft,
    moduleDescriptionDraft,
    setModuleDescriptionDraft,
    moduleAdditionalInstructionsDraft,
    setModuleAdditionalInstructionsDraft,
    moduleGoalDraft,
    setModuleGoalDraft,
    moduleScopeDraft,
    setModuleScopeDraft,
    moduleMetadataSaving,
    setModuleMetadataSaving,
    moduleMetadataError,
    setModuleMetadataError,
    chipFilterIds,
    setChipFilterIds,
    moduleChipLabel,
    setModuleChipLabel,
    moduleChipDescription,
    setModuleChipDescription,
    draggedNoteGroupId,
    setDraggedNoteGroupId,
    dragOverNoteGroupId,
    setDragOverNoteGroupId,
    isReorderingNoteGroups,
    setIsReorderingNoteGroups
  } = useModulePageState();
  const [moduleDueCounts, setModuleDueCounts] = useState({});
  const [sidebarScope, setSidebarScope] = useState("note-groups");
  const {
    noteGroupSource,
    setNoteGroupSource,
    sourceChecking,
    setSourceChecking,
    sourceChecked,
    setSourceChecked,
    sourceConfirmed,
    setSourceConfirmed,
    sourceDuplicateCount,
    setSourceDuplicateCount,
    sourceDuplicates,
    setSourceDuplicates,
    sourceCheckError,
    setSourceCheckError,
    noteGroupSearch,
    setNoteGroupSearch,
    noteGroupMode,
    setNoteGroupMode,
    readingMode,
    setReadingMode,
    readingHoverCardId,
    setReadingHoverCardId,
    readingPinnedCardId,
    setReadingPinnedCardId,
    progressRange,
    setProgressRange,
    noteGroupNeedsReviewRegenerating,
    setNoteGroupNeedsReviewRegenerating,
    isReadingOpen,
    setIsReadingOpen,
    isMetadataOpen,
    setIsMetadataOpen,
    metadataSaving,
    setMetadataSaving,
    metadataError,
    setMetadataError,
    newStudyCardTitle,
    setNewStudyCardTitle,
    newStudyCardContent,
    setNewStudyCardContent,
    newStudyCardChipIds,
    setNewStudyCardChipIds,
    isStudyCreateOpen,
    setIsStudyCreateOpen,
    editingStudyCardId,
    setEditingStudyCardId,
    editingStudyCard,
    setEditingStudyCard,
    isGeneratingQuestions,
    setIsGeneratingQuestions,
    isQuestionCreateOpen,
    setIsQuestionCreateOpen,
    newQuestionType,
    setNewQuestionType,
    newQuestionPrompt,
    setNewQuestionPrompt,
    newQuestionOptions,
    setNewQuestionOptions,
    newQuestionCorrectIndices,
    setNewQuestionCorrectIndices,
    newQuestionRefs,
    setNewQuestionRefs,
    editingQuestionCardId,
    setEditingQuestionCardId,
    editingQuestionCard,
    setEditingQuestionCard
  } = useNoteGroupPageState();
  const [routeRestoreError, setRouteRestoreError] = useState("");
  const [resolvedRouteContext, setResolvedRouteContext] = useState(null);
  const [mindMapRefreshToken, setMindMapRefreshToken] = useState(0);
  const [mindMapDrilldown, setMindMapDrilldown] = useState({
    sourceKey: "",
    topicId: "",
    title: "",
    graph: null,
    loading: false,
    error: ""
  });
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [topicChips, setTopicChips] = useState([]);
  const [topicSearch, setTopicSearch] = useState("");
  const {
    conceptSaving: topicSaving,
    setConceptSaving: setTopicSaving,
    conceptKnowledgeNodeRegenerating: topicKnowledgeNodeRegenerating,
    setConceptKnowledgeNodeRegenerating: setTopicKnowledgeNodeRegenerating,
    conceptKnowledgeNodeRegeneratingId: topicKnowledgeNodeRegeneratingId,
    setConceptKnowledgeNodeRegeneratingId: setTopicKnowledgeNodeRegeneratingId,
    conceptError: topicError,
    setConceptError: setTopicError
  } = useConceptPageState();

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
    reviewQueue,
    setReviewQueue,
    reviewIndex,
    setReviewIndex,
    reviewMode,
    setReviewMode,
    reviewScope,
    setReviewScope,
    reviewCount,
    setReviewCount,
    reviewError,
    setReviewError,
    reviewAnswer,
    setReviewAnswer,
    reviewStartTime,
    setReviewStartTime,
    isReviewing,
    setIsReviewing,
    reviewFeedback,
    setReviewFeedback,
    reviewExplanationOpen,
    setReviewExplanationOpen,
    reviewDeleteStep,
    setReviewDeleteStep,
    reviewDeleteLoading,
    setReviewDeleteLoading,
    reviewStats,
    setReviewStats,
    reviewRefreshToken,
    setReviewRefreshToken,
    reviewSummary,
    setReviewSummary,
    reviewChatMessages,
    setReviewChatMessages,
    reviewChatInput,
    setReviewChatInput,
    reviewChatError,
    setReviewChatError,
    reviewChatLoading,
    setReviewChatLoading,
    reviewChatView,
    setReviewChatView,
    reviewChatCardId,
    setReviewChatCardId,
    reviewChatCardCache,
    setReviewChatCardCache,
    reviewChatCardLoading,
    setReviewChatCardLoading,
    reviewChatCardError,
    setReviewChatCardError,
    reviewChatListRef,
    reviewDeleteKeyRef: reviewDKeyTimeRef,
    currentReviewCard,
    reviewCardType,
    reviewNoteGroupId,
    reviewCardRefs,
    isReviewOverlayVisible
  } = useReviewSession({
    selectedNoteGroupId,
    selectedConceptId: selectedTopicId,
    selectedModuleId
  });
  const handleModuleOverviewError = useCallback(
    (error) => showFetchToast(error, "Failed to load note groups"),
    []
  );
  const {
    noteGroups,
    setNoteGroups,
    moduleNoteGroupStats,
    moduleStats,
    moduleQuestionTimeline,
    moduleStatsLoading,
    moduleStatsError
  } = useModuleOverview({
    moduleId: selectedModuleId,
    chipFilterIds,
    reviewRefreshToken,
    routeNoteGroupId,
    routeTopicId,
    setSelectedNoteGroupId,
    setSelectedTopicId,
    onError: handleModuleOverviewError
  });
  const isViewCardsPage = routePanel === "view-cards";
  const isStudyPage = routePanel === "study-cards";
  const isQuestionPage = routePanel === "question-cards";
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
    hasAppRouteTarget,
    authLoading: auth.loading,
    resolvedRouteMatches,
    hasUnresolvedRouteTarget,
    routeRestoreError
  });

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );
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
    moduleMindMap,
    moduleMindMapLoading,
    moduleMindMapError,
    moduleNeedsReviewRegenerating,
    handleRegenerateModuleNeedsReviewKnowledgeNodes
  } = useModuleMindMap({
    moduleId: selectedModuleId,
    selectedNoteGroupId,
    selectedConceptId: selectedTopicId,
    noteGroupMode,
    refreshToken: mindMapRefreshToken,
    canManageSelectedSubject,
    canUseProtectedActions,
    setConcepts: setTopicChips,
    setRefreshToken: setMindMapRefreshToken
  });
  const isSelectedSubjectPermissionHydrating = Boolean(
    auth.isAuthenticated &&
      selectedSubjectId &&
      (!selectedSubject || (!currentUserProfile && !currentUserError))
  );

  useEffect(() => {
    if (
      !shouldClearSelectedSubject({
        selectedSubjectId,
        subjects,
        hasAppRouteTarget,
        routeSubjectId
      })
    ) {
      return;
    }
    setSelectedSubjectId("");
    setSelectedModuleId("");
    setSelectedNoteGroupId("");
    setSelectedTopicId("");
    setNoteGroupMode("overview");
    navigate("/");
  }, [hasAppRouteTarget, navigate, routeSubjectId, selectedSubjectId, subjects]);

  useEffect(() => {
    if (!canManageSelectedSubject) {
      setIsSubjectManagementOpen(false);
    }
  }, [canManageSelectedSubject]);

  const selectedModule = useMemo(
    () => modules.find((module) => module.id === selectedModuleId),
    [modules, selectedModuleId]
  );
  const selectedNoteGroup = useMemo(
    () => noteGroups.find((group) => group.id === selectedNoteGroupId),
    [noteGroups, selectedNoteGroupId]
  );
  const selectedTopic = useMemo(
    () => topicChips.find((topic) => topic.id === selectedTopicId),
    [topicChips, selectedTopicId]
  );
  const selectedSubjectCode = selectedSubject?.short_code || "";
  const selectedModuleCode = selectedModule?.short_code || "";
  const selectedNoteGroupCode = selectedNoteGroup?.short_code || "";
  const selectedTopicCode = selectedTopic?.short_code || "";
  const activeStudyScopeTitle = selectedTopic
    ? selectedTopic.label
    : selectedNoteGroup?.title || "Untitled note group";
  const isTopicScope = Boolean(selectedTopicId);
  const canEditCurrentCards = Boolean(
    canManageSelectedSubject && selectedNoteGroupId && !selectedTopicId
  );

  const refreshModuleGeneratedData = useCallback((moduleId) => {
    if (!moduleId || selectedModuleIdRef.current !== moduleId) {
      return;
    }
    listConcepts(moduleId)
      .then((chips) => {
        if (selectedModuleIdRef.current === moduleId) {
          setTopicChips(chips);
        }
      })
      .catch((error) => {
        if (selectedModuleIdRef.current === moduleId) {
          toast.error(error.message || "Failed to refresh generated note group.");
        }
    });
    setReviewRefreshToken((prev) => prev + 1);
    setMindMapRefreshToken((prev) => prev + 1);
  }, []);
  const {
    moduleGenerationWorkflow,
    moduleGenerationWorkflowError,
    moduleGenerationWorkflowConnection,
    moduleGenerationWorkflowChecked,
    generationWorkflowsByNoteGroupId,
    autoJobsByNoteGroupId,
    autoJobActionId,
    refreshModuleGenerationWorkflowSnapshot,
    handleCancelAutoJob,
    handleRetryAutoJob,
    handleDeleteAutoJob
  } = useModuleGenerationWorkflow({
    moduleId: selectedModuleId,
    canManageSelectedSubject,
    isSelectedSubjectPermissionHydrating,
    selectedNoteGroupTitle: selectedNoteGroup?.title,
    requestConfirm,
    onRefreshGeneratedData: refreshModuleGeneratedData,
    onRefreshReview: () => setReviewRefreshToken((prev) => prev + 1),
    onGenerationDeleted: (noteGroupId) => {
      if (noteGroupId) {
        setNoteGroups((prev) => prev.filter((group) => group.id !== noteGroupId));
      }
      if (selectedNoteGroupId === noteGroupId) {
        setSelectedNoteGroupId("");
        navigate(
          selectedSubjectCode && selectedModuleCode
            ? modulePath(selectedSubjectCode, selectedModuleCode)
            : "/"
        );
      }
    }
  });
  const selectedNoteGroupWorkflow = selectedNoteGroupId
    ? generationWorkflowsByNoteGroupId[selectedNoteGroupId] || null
    : null;
  const isSelectedNoteGroupGenerating = Boolean(selectedNoteGroupWorkflow && !selectedTopicId);
  const isWaitingForSelectedNoteGroupWorkflow =
    Boolean(selectedNoteGroupId) &&
    !selectedTopicId &&
    selectedModuleId &&
    (isSelectedSubjectPermissionHydrating ||
      (canManageSelectedSubject && !moduleGenerationWorkflowChecked));
  const shouldHoldSelectedNoteGroupContent =
    isSelectedNoteGroupGenerating || isWaitingForSelectedNoteGroupWorkflow;

  const {
    messages: chatMessages,
    input: chatInput,
    setInput: setChatInput,
    error: chatError,
    loading: chatLoading,
    view: chatView,
    cardId: chatCardId,
    cardCache: chatCardCache,
    cardLoading: chatCardLoading,
    cardError: chatCardError,
    listRef: chatListRef,
    sendMessage: handleSendChat,
    openStudyCard: openChatStudyCard,
    backToChat: handleBackToChat,
    handleKeyDown: handleChatKeyDown
  } = useTutorChat({
    moduleId: selectedModuleId,
    noteGroupId: selectedNoteGroupId,
    conceptId: selectedTopicId,
    isOpen: isChatOpen
  });

  const {
    studyCards,
    setStudyCards,
    studyCardError,
    setStudyCardError,
    questionCards,
    setQuestionCards,
    questionCardError,
    setQuestionCardError,
    questionJobStatus,
    setQuestionJobStatus,
    noteGroupConceptIds: noteGroupChipIds,
    setNoteGroupConceptIds: setNoteGroupChipIds,
    metadataTitleDraft,
    setMetadataTitleDraft,
    formattedSections,
    cleanedTextMarkdown,
    conceptTitleDraft: topicTitleDraft,
    setConceptTitleDraft: setTopicTitleDraft,
    conceptDescriptionDraft: topicDescriptionDraft,
    setConceptDescriptionDraft: setTopicDescriptionDraft
  } = useStudyScopeData({
    selectedNoteGroupId,
    selectedConceptId: selectedTopicId,
    routeNoteGroupId,
    routeConceptId: routeTopicId,
    shouldHoldContent: shouldHoldSelectedNoteGroupContent,
    selectedModuleIdRef,
    selectedSubjectIdRef,
    setSelectedSubjectId,
    setSelectedModuleId,
    setRouteRestoreError
  });

  const {
    noteGroupMindMap,
    setNoteGroupMindMap,
    noteGroupMindMapLoading,
    setNoteGroupMindMapLoading,
    noteGroupMindMapError,
    setNoteGroupMindMapError,
    noteGroupMindMapGenerating,
    setNoteGroupMindMapGenerating,
    questionTimeline: noteGroupQuestionTimeline,
    noteGroupProgress,
    noteGroupProgressLoading,
    noteGroupProgressError,
    noteGroupCardTable,
    setNoteGroupCardTable,
    noteGroupCardTableLoading,
    noteGroupCardTableError
  } = useNoteGroupPageData({
    noteGroupId: selectedNoteGroupId,
    selectedConceptId: selectedTopicId,
    chipFilterIds,
    questionCards,
    progressRange,
    reviewRefreshToken,
    mindMapRefreshToken,
    isViewCardsPage,
    shouldHoldContent: shouldHoldSelectedNoteGroupContent
  });

  const {
    conceptMindMap: topicMindMap,
    conceptMindMapLoading: topicMindMapLoading,
    conceptMindMapError: topicMindMapError,
    questionTimeline: conceptQuestionTimeline
  } = useConceptPageData({
    conceptId: selectedTopicId,
    questionCards,
    reviewRefreshToken,
    mindMapRefreshToken,
    shouldHoldContent: shouldHoldSelectedNoteGroupContent
  });

  const questionTimeline = selectedTopicId ? conceptQuestionTimeline : noteGroupQuestionTimeline;
  const focusQuestionCard = useMemo(
    () => questionCards.find((card) => card.id === focusQuestionCardId),
    [questionCards, focusQuestionCardId]
  );

  const filteredStudyCards = useMemo(() => {
    if (!chipFilterIds.length) {
      return studyCards;
    }
    return studyCards.filter((card) =>
      (card.topic_chips || []).some((chip) => chipFilterIds.includes(chip.id))
    );
  }, [studyCards, chipFilterIds]);

  const filteredQuestionCards = useMemo(() => {
    if (!chipFilterIds.length) {
      return questionCards;
    }
    const allowedStudyIds = new Set(filteredStudyCards.map((card) => card.id));
    return questionCards.filter((card) =>
      (card.study_card_refs || []).some((refId) => allowedStudyIds.has(refId))
    );
  }, [questionCards, filteredStudyCards, chipFilterIds]);

  const questionCardsForDisplay = useMemo(() => {
    const filtered =
      masteryFilter === "all"
        ? filteredQuestionCards
        : filteredQuestionCards.filter((card) => {
            const score = getMasteryScore(card);
            const tier = getMasteryTier(score);
            return tier === masteryFilter;
          });
    return [...filtered].sort((a, b) => {
      const scoreA = getMasteryScore(a);
      const scoreB = getMasteryScore(b);
      if (scoreA === null && scoreB === null) {
        return 0;
      }
      if (scoreA === null) {
        return 1;
      }
      if (scoreB === null) {
        return -1;
      }
      return scoreA - scoreB;
    });
  }, [filteredQuestionCards, masteryFilter]);

  const topicCardTable = useMemo(() => {
    if (!selectedTopicId) {
      return { rows: [], unlinkedQuestionCount: 0 };
    }
    const rowsByStudyId = new Map(
      filteredStudyCards.map((card) => [
        card.id,
        {
          study_card: {
            id: card.id,
            title: card.title || "Untitled Study Card",
            topic_chips: card.topic_chips || []
          },
          question_cards: []
        }
      ])
    );
    let unlinkedQuestionCount = 0;
    questionCards.forEach((card) => {
      const linkedStudyIds = (card.study_card_refs || []).filter((studyCardId) =>
        rowsByStudyId.has(studyCardId)
      );
      if (!linkedStudyIds.length) {
        unlinkedQuestionCount += 1;
        return;
      }
      const score = getMasteryScore(card);
      const tableQuestion = {
        id: card.id,
        prompt: card.prompt,
        mastery: score === null ? null : Number(score.toFixed(1)),
        mastery_tier: getMasteryTier(score),
        success_rate: null,
        reviews: card.reps || 0,
        median_response_time_ms: null,
        due_at: card.due_at
      };
      linkedStudyIds.forEach((studyCardId) => {
        rowsByStudyId.get(studyCardId)?.question_cards.push(tableQuestion);
      });
    });
    return {
      rows: Array.from(rowsByStudyId.values()),
      unlinkedQuestionCount
    };
  }, [filteredStudyCards, questionCards, selectedTopicId]);

  const topicCardTableRows = topicCardTable.rows;
  const topicUnlinkedQuestionCount = topicCardTable.unlinkedQuestionCount;

  const noteGroupStats = useMemo(() => {
    const staleCount = filteredQuestionCards.filter((card) => card.stale).length;
    return {
      studyCount: filteredStudyCards.length,
      questionCount: filteredQuestionCards.length,
      dueCount: questionTimeline.due,
      staleCount
    };
  }, [filteredQuestionCards, filteredStudyCards, questionTimeline.due]);

  const noteGroupStatusMeta = useMemo(
    () => getNoteGroupStatusMeta(selectedNoteGroup?.generation_status),
    [selectedNoteGroup]
  );

  const sectionNavItems = useMemo(() => {
    if (noteGroupMode === "auto") {
      return [
        { id: "step-source", label: "Unique ID" },
        { id: "create-note-group", label: "Create note group" }
      ];
    }
    if (!selectedModuleId) {
      return [];
    }
    if (shouldHoldSelectedNoteGroupContent) {
      return [{ id: "note-group-generation-workflow", label: "Generation" }];
    }
    if (!selectedNoteGroupId && !selectedTopicId) {
      return [
        { id: "module-overview", label: "Module overview" },
        { id: "module-mind-map", label: "Mind Map" },
        { id: "module-review", label: "Review queue" },
        { id: "module-timeline", label: "Question timeline" },
        { id: "module-note-groups", label: "Note groups" }
      ];
    }
    if (selectedNoteGroupId && !selectedTopicId && isViewCardsPage) {
      return [];
    }
    if (isStudyPage) {
      return [{ id: "study-list", label: "Study cards" }];
    }
    if (isQuestionPage) {
      return [
        { id: "question-review", label: "Review" },
        { id: "question-timeline", label: "Timeline" },
        { id: "question-list", label: "Question cards" },
        { id: "question-generate", label: "Generate" }
      ];
    }
    if (isTopicScope) {
      return [{ id: "topic-overview", label: "Overview" }];
    }
    return [
      { id: "note-group-overview", label: "Overview" },
      { id: "note-group-mind-map", label: "Mind Map" }
    ];
  }, [
    noteGroupMode,
    selectedModuleId,
    selectedNoteGroupId,
    selectedTopicId,
    isViewCardsPage,
    isStudyPage,
    isQuestionPage,
    isTopicScope,
    shouldHoldSelectedNoteGroupContent
  ]);

  const chipOptions = useMemo(
    () => topicChips.map((chip) => ({
      value: chip.id,
      label: chip.label,
      description: chip.description || "",
    })),
    [topicChips]
  );
  const chipFilterValue = useMemo(
    () => chipOptions.filter((option) => chipFilterIds.includes(option.value)),
    [chipOptions, chipFilterIds]
  );
  const sortedNoteGroups = useMemo(() => normalizeNoteGroups(noteGroups), [noteGroups]);
  const noteGroupOptions = useMemo(
    () =>
      sortedNoteGroups.map((group) => ({
        value: group.id,
        label: group.title || "Untitled note group",
        status: group.generation_status,
        createdAt: group.created_at
      })),
    [sortedNoteGroups]
  );
  const filteredNoteGroupOptions = useMemo(() => {
    const query = noteGroupSearch.trim().toLowerCase();
    if (!query) {
      return noteGroupOptions;
    }
    return noteGroupOptions.filter((group) => group.label.toLowerCase().includes(query));
  }, [noteGroupOptions, noteGroupSearch]);
  const topicOptions = useMemo(
    () =>
      topicChips.map((topic) => ({
        value: topic.id,
        label: topic.label,
        description: topic.description || "",
        shortCode: topic.short_code,
        parentConceptId:
          topic.parentConceptId ||
          topic.parent_concept_id ||
          topic.parentTopicId ||
          topic.parent_topic_id ||
          "",
        parentTopicId:
          topic.parentTopicId ||
          topic.parent_topic_id ||
          topic.parentConceptId ||
          topic.parent_concept_id ||
          ""
      })),
    [topicChips]
  );
  const filteredTopicOptions = useMemo(() => {
    const query = topicSearch.trim().toLowerCase();
    if (!query) {
      return topicOptions;
    }
    return topicOptions.filter((topic) => topic.label.toLowerCase().includes(query));
  }, [topicOptions, topicSearch]);
  const sidebarTopicOptions = useMemo(() => {
    if (topicSearch.trim()) {
      return filteredTopicOptions;
    }
    return buildConceptDirectoryRows(topicOptions, selectedTopicId);
  }, [filteredTopicOptions, selectedTopicId, topicOptions, topicSearch]);
  const moduleNoteGroupStatsById = useMemo(() => {
    const map = new Map();
    moduleNoteGroupStats.forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }, [moduleNoteGroupStats]);
  const moduleNoteGroupsForDisplay = useMemo(() => {
    if (!chipFilterIds.length || moduleStatsLoading) {
      return sortedNoteGroups;
    }
    return sortedNoteGroups.filter((group) => {
      const statsEntry = moduleNoteGroupStatsById.get(group.id);
      if (!statsEntry) {
        return true;
      }
      return statsEntry.studyCount > 0 || statsEntry.questionCount > 0;
    });
  }, [sortedNoteGroups, chipFilterIds, moduleNoteGroupStatsById, moduleStatsLoading]);
  const studyCardTitleById = useMemo(() => {
    const map = new Map();
    studyCards.forEach((card) => {
      map.set(card.id, card.title || card.id.slice(0, 8));
    });
    return map;
  }, [studyCards]);
  const fallbackCleanText = useMemo(() => {
    let text = "";
    const rangesByCardId = new Map();
    studyCards.forEach((card, index) => {
      const title = card.title || `Study card ${index + 1}`;
      const block = `## ${title}\n\n${card.content || ""}`.trim();
      if (text) {
        text += "\n\n";
      }
      const startIndex = text.length;
      text += block;
      rangesByCardId.set(card.id, [{ start_index: startIndex, end_index: text.length }]);
    });
    return { text, rangesByCardId };
  }, [studyCards]);
  const effectiveCleanedText = cleanedTextMarkdown || fallbackCleanText.text;
  const studyNoteSections = useMemo(() => {
    if (formattedSections.length) {
      return formattedSections;
    }
    return studyCards.map((card, index) => ({
      study_card_id: card.id,
      title: card.title || `Study card ${index + 1}`,
      content: card.content || "",
      anchor: `study-card-${card.id}`,
    }));
  }, [formattedSections, studyCards]);
  const sourceRangesByCardId = useMemo(() => {
    if (!cleanedTextMarkdown) {
      return fallbackCleanText.rangesByCardId;
    }
    const map = new Map();
    studyCards.forEach((card) => {
      map.set(card.id, Array.isArray(card.source_ranges) ? card.source_ranges : []);
    });
    return map;
  }, [cleanedTextMarkdown, fallbackCleanText, studyCards]);
  const readingHighlights = useMemo(() => {
    const highlights = [];
    const addRanges = (studyCardId, kind) => {
      if (!studyCardId) {
        return;
      }
      const ranges = sourceRangesByCardId.get(studyCardId) || [];
      ranges.forEach((range) => {
        if (
          Number.isInteger(range.start_index) &&
          Number.isInteger(range.end_index) &&
          range.end_index > range.start_index
        ) {
          highlights.push({ ...range, study_card_id: studyCardId, kind });
        }
      });
    };
    addRanges(readingHoverCardId, "hovered");
    addRanges(readingPinnedCardId, "pinned");
    return highlights;
  }, [readingHoverCardId, readingPinnedCardId, sourceRangesByCardId]);
  const readingAvailable = studyNoteSections.length > 0 || Boolean(effectiveCleanedText);
  const resolveNoteGroupLabel = (noteGroupId) => {
    if (!noteGroupId) {
      return "";
    }
    const statsEntry = moduleNoteGroupStatsById.get(noteGroupId);
    if (statsEntry) {
      return statsEntry.title;
    }
    const group = noteGroups.find((item) => item.id === noteGroupId);
    return group?.title || noteGroupId.slice(0, 8);
  };
  const getSectionAnchor = (section, index) =>
    section.anchor ||
    `section-${index + 1}-${(section.study_card_id || "note").slice(0, 8)}`;
  const reviewRefsMessage = reviewCardRefs.length
    ? "The relevant study cards are:"
    : "The relevant study cards are: no study card is linked to this question.";
  const isSourceReady = sourceConfirmed;
  const modulePageActions = useModulePageActions({
    canManageSelectedSubject,
    canUseProtectedActions,
    selectedModuleId,
    selectedModule,
    selectedSubjectCode,
    selectedModuleCode,
    chipFilterIds,
    noteGroups,
    selectedNoteGroupId,
    selectedTopicId,
    moduleStatsLoading,
    isReviewOverlayVisible,
    isReorderingNoteGroups,
    draggedNoteGroupId,
    dragOverNoteGroupId,
    moduleTitleDraft,
    moduleDescriptionDraft,
    moduleAdditionalInstructionsDraft,
    moduleGoalDraft,
    moduleScopeDraft,
    navigate,
    requestConfirm,
    setAutoAdditionalInstructions,
    setChipFilterIds,
    setDraggedNoteGroupId,
    setDragOverNoteGroupId,
    setIsChatOpen,
    setIsMetadataOpen,
    setIsModuleMetadataOpen,
    setIsReorderingNoteGroups,
    setModuleAdditionalInstructionsDraft,
    setModuleDescriptionDraft,
    setModuleGoalDraft,
    setModuleMetadataError,
    setModuleMetadataSaving,
    setModuleScopeDraft,
    setModuleTitleDraft,
    setModules,
    setNoteGroupMode,
    setNoteGroups,
    setReviewSummary,
    setSelectedModuleId,
    setSelectedNoteGroupId,
    setSidebarError
  });
  const {
    canReorderNoteGroups,
    handleChipFilterSelect,
    handleDeleteModule,
    handleNoteGroupDragEnd,
    handleNoteGroupDragEnter,
    handleNoteGroupDragOver,
    handleNoteGroupDragStart,
    handleNoteGroupDrop,
    handleResetChipFilters,
    handleSaveModuleMetadata,
    openModuleMetadataModal
  } = modulePageActions;
  const formatDueAt = (value) => {
    if (!value) {
      return "Unscheduled";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Unscheduled";
    }
    return date.toUTCString();
  };
  const formatReviewAt = (value) => {
    if (!value) {
      return "Never";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Never";
    }
    return date.toUTCString();
  };
  const focusMasteryScore = focusQuestionCard
    ? getMasteryScore(focusQuestionCard)
    : null;
  const focusMasteryTier = getMasteryTier(focusMasteryScore);
  const focusCardType =
    focusQuestionCard &&
    focusQuestionCard.type === "mcq" &&
    (focusQuestionCard.correct_option_indices || []).length > 1
      ? "multi"
      : focusQuestionCard?.type || "mcq";
  const StudyScopeRouteContent = isTopicScope ? ConceptScopeContent : NoteGroupScopeContent;
  useEffect(() => {
    if (auth.loading) {
      return;
    }
    if (!auth.isAuthenticated) {
      setCurrentUserProfile(null);
      setCurrentUserError("");
      setIsAdminPanelOpen(false);
      setIsSubjectManagementOpen(false);
      return;
    }

    let cancelled = false;
    setCurrentUserError("");
    getCurrentUser()
      .then((profile) => {
        if (!cancelled) {
          setCurrentUserProfile(profile);
          if (profile?.app_role !== "admin") {
            setIsAdminPanelOpen(false);
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCurrentUserProfile(null);
          setCurrentUserError(error.message || "Failed to load user profile");
          setIsAdminPanelOpen(false);
          setIsSubjectManagementOpen(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, auth.loading, auth.user?.id]);

  useEffect(() => {
    setResolvedRouteContext(null);
  }, [routeSubjectCode, routeModuleCode, routeNoteGroupCode, routeTopicCode, routeCreateNoteGroup]);

  const handleRouteRestoreError = useCallback((error, fallback) => {
    showFetchToast(error, fallback);
  }, []);
  useSubjectModuleRouteResolution({
    auth,
    locationState: location.state,
    routeSubjectPageCode,
    routeSubjectCode,
    routeModuleCode,
    routeNoteGroupCode,
    routeTopicCode,
    routeCreateNoteGroup,
    setResolvedRouteContext,
    setSelectedSubjectId,
    setSelectedModuleId,
    setSelectedNoteGroupId,
    setSelectedTopicId,
    setSidebarScope,
    setNoteGroupMode,
    setReviewSummary,
    setIsChatOpen,
    setIsMetadataOpen,
    setIsModuleMetadataOpen,
    setRouteRestoreError,
    onError: handleRouteRestoreError
  });

  useNoteGroupRouteResolution({
    auth,
    routeSubjectCode,
    routeModuleCode,
    routeNoteGroupCode,
    setResolvedRouteContext,
    setSelectedSubjectId,
    setSelectedModuleId,
    setSelectedNoteGroupId,
    setNoteGroupMode,
    setRouteRestoreError
  });

  useConceptRouteResolution({
    auth,
    routeSubjectCode,
    routeModuleCode,
    routeConceptCode: routeTopicCode,
    setResolvedRouteContext,
    setSelectedSubjectId,
    setSelectedModuleId,
    setSelectedNoteGroupId,
    setSelectedConceptId: setSelectedTopicId,
    setSidebarScope,
    setChipFilterIds,
    setNoteGroupMode,
    setReviewSummary,
    setIsChatOpen,
    setIsMetadataOpen,
    setIsModuleMetadataOpen,
    setRouteRestoreError,
    onError: handleRouteRestoreError
  });

  useEffect(() => {
    if (!selectedSubjectId) {
      setSelectedModuleId("");
    }
  }, [selectedSubjectId]);

  useEffect(() => {
    if (!selectedModuleId) {
      setNoteGroups([]);
      setSelectedNoteGroupId("");
      setSelectedTopicId("");
      setTopicChips([]);
      setChipFilterIds([]);
      return;
    }
    setChipFilterIds([]);
    listConcepts(selectedModuleId)
      .then((data) => {
        setTopicChips(data);
        if (!routeTopicId) {
          setSelectedTopicId((currentId) =>
            currentId && !data.some((topic) => topic.id === currentId) ? "" : currentId
          );
        }
      })
      .catch((error) => showFetchToast(error, "Failed to load concepts"));
  }, [selectedModuleId, routeTopicId]);

  useEffect(() => {
    setNoteGroupSearch("");
    setTopicSearch("");
  }, [selectedModuleId]);

  useEffect(() => {
    setNoteGroupSource("");
    setSourceChecked(false);
    setSourceConfirmed(false);
    setSourceDuplicateCount(0);
    setSourceDuplicates([]);
    setSourceCheckError("");
    setSourceChecking(false);
  }, [selectedModuleId]);

  useEffect(() => {
    if (modules.length === 0) {
      setModuleDueCounts({});
      return;
    }
    let cancelled = false;
    const loadModuleDueCounts = async () => {
      try {
        const entries = await Promise.all(
          modules.map(async (module) => {
            const response = await getModuleQuestionTimeline(module.id);
            const timeline = normalizeTimeline(response.timeline);
            return [module.id, timeline.due];
          })
        );
        if (!cancelled) {
          setModuleDueCounts(Object.fromEntries(entries));
        }
      } catch (error) {
        if (!cancelled) {
          setModuleDueCounts({});
          showFetchToast(error, "Failed to load module due counts");
        }
      }
    };
    loadModuleDueCounts();
    return () => {
      cancelled = true;
    };
  }, [modules, reviewRefreshToken]);

  useEffect(() => {
    if (!routeNoteGroupId || !selectedModuleId || selectedNoteGroupId === routeNoteGroupId) {
      return;
    }
    const routeNoteGroupRestoredFromList = noteGroups.some(
      (group) => group.id === routeNoteGroupId
    );
    if (routeNoteGroupRestoredFromList) {
      setRouteRestoreError("");
      setSelectedNoteGroupId(routeNoteGroupId);
      setSelectedTopicId("");
      setSidebarScope("note-groups");
    }
  }, [routeNoteGroupId, selectedModuleId, selectedNoteGroupId, noteGroups]);

  useEffect(() => {
    if (!routeTopicId || !selectedModuleId || selectedTopicId === routeTopicId) {
      return;
    }
    const routeTopicRestoredFromList = topicChips.some(
      (topic) => topic.id === routeTopicId
    );
    if (routeTopicRestoredFromList) {
      setRouteRestoreError("");
      setSelectedTopicId(routeTopicId);
      setSelectedNoteGroupId("");
      setSidebarScope("concepts");
      setChipFilterIds([]);
    }
  }, [routeTopicId, selectedModuleId, selectedTopicId, topicChips]);

  useEffect(() => {
    if (!isReadingOpen) {
      setReadingHoverCardId("");
      setReadingPinnedCardId("");
      setReadingMode("study");
    }
  }, [isReadingOpen]);

  useEffect(() => {
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    setIsReadingOpen(false);
    setIsQuestionFocusOpen(false);
    setFocusQuestionCardId("");
    setIsQuestionCreateOpen(false);
    setIsStudyCreateOpen(false);
    setMetadataError("");
    setModuleMetadataError("");
  }, [selectedNoteGroupId, selectedTopicId, selectedModuleId]);

  useEffect(() => {
    setNewQuestionRefs([]);
    setNewStudyCardChipIds([]);
  }, [selectedNoteGroupId, selectedTopicId]);

  useEffect(() => {
    if (wizardChatRef.current) {
      wizardChatRef.current.scrollTop = wizardChatRef.current.scrollHeight;
    }
  }, [moduleWizardMessages]);

  useEffect(() => {
    if (!reviewFeedback || !currentReviewCard) {
      return;
    }
    const refs = currentReviewCard.study_card_refs || [];
    if (!refs.length) {
      return;
    }
    refs.forEach((refId) => {
      setReviewChatCardCache((prev) => {
        if (prev[refId]) {
          return prev;
        }
        getStudyCard(refId)
          .then((card) =>
            setReviewChatCardCache((next) => ({
              ...next,
              [refId]: card
            }))
          )
          .catch(() => null);
        return prev;
      });
    });
  }, [reviewFeedback, currentReviewCard]);

  useEffect(() => {
    if (!isReviewing || reviewSummary || !currentReviewCard) {
      return;
    }
    const handleReviewEnter = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const tag = event.target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        event.target?.isContentEditable
      ) {
        return;
      }
      if (event.key !== "Enter") {
        return;
      }
      if (!reviewFeedback) {
        if (!reviewAnswer.length) {
          return;
        }
        event.preventDefault();
        submitReviewAnswer(currentReviewCard);
        return;
      }
      if (reviewIndex + 1 < reviewQueue.length) {
        event.preventDefault();
        nextReviewCard();
      }
    };
    window.addEventListener("keydown", handleReviewEnter);
    return () => window.removeEventListener("keydown", handleReviewEnter);
  }, [
    isReviewing,
    reviewSummary,
    currentReviewCard,
    reviewFeedback,
    reviewAnswer,
    reviewIndex,
    reviewQueue.length
  ]);

  useEffect(() => {
    if (!isReviewing || reviewSummary || !currentReviewCard) {
      return;
    }
    const handleReviewKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const tag = event.target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        event.target?.isContentEditable
      ) {
        return;
      }
      if (!/^[1-4]$/.test(event.key)) {
        return;
      }
      const options = currentReviewCard.reviewChoices
        ? currentReviewCard.reviewChoices.map((choice) => choice.text)
        : currentReviewCard.reviewOptions || currentReviewCard.options || [];
      const index = Number(event.key) - 1;
      if (index < 0 || index >= options.length) {
        return;
      }
      event.preventDefault();
      if (reviewFeedback) {
        toggleReviewExplanation(index);
      } else {
        toggleReviewAnswer(index, reviewCardType);
      }
    };
    window.addEventListener("keydown", handleReviewKeyDown);
    return () => window.removeEventListener("keydown", handleReviewKeyDown);
  }, [
    isReviewing,
    reviewSummary,
    currentReviewCard,
    reviewFeedback,
    reviewCardType
  ]);

  useEffect(() => {
    if (!isReviewing || reviewSummary || !currentReviewCard) {
      return;
    }
    reviewDKeyTimeRef.current = 0;
    const handleReviewDeleteKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) {
        return;
      }
      if (event.key !== "d") {
        return;
      }
      if (!reviewStartTime || Date.now() - reviewStartTime < 2000) {
        return;
      }
      const now = Date.now();
      if (reviewDKeyTimeRef.current && now - reviewDKeyTimeRef.current <= 500) {
        reviewDKeyTimeRef.current = 0;
        executeReviewDelete();
      } else {
        reviewDKeyTimeRef.current = now;
      }
    };
    window.addEventListener("keydown", handleReviewDeleteKeyDown);
    return () => {
      window.removeEventListener("keydown", handleReviewDeleteKeyDown);
      reviewDKeyTimeRef.current = 0;
    };
  }, [isReviewing, reviewSummary, currentReviewCard, reviewStartTime, reviewFeedback, reviewDeleteLoading]);

  useEffect(() => {
    if (routePanel) {
      setIsChatOpen(false);
      setIsMetadataOpen(false);
    }
  }, [routePanel]);

  const clearMindMapDrilldown = useCallback(() => {
    setMindMapDrilldown({
      sourceKey: "",
      topicId: "",
      title: "",
      graph: null,
      loading: false,
      error: ""
    });
  }, []);

  const handleOpenMindMapTopic = useCallback(async ({ topicId, title } = {}, sourceKey = "") => {
    if (!topicId || !sourceKey) {
      return;
    }
    const topicTitle = title || "Concept";
    setMindMapDrilldown({
      sourceKey,
      topicId,
      title: topicTitle,
      graph: null,
      loading: true,
      error: ""
    });
    try {
      const graph = await getConceptMindMap(topicId);
      setMindMapDrilldown((current) =>
        current.sourceKey === sourceKey && current.topicId === topicId
          ? {
              ...current,
              graph,
              loading: false,
              error: ""
            }
          : current
      );
    } catch (error) {
      setMindMapDrilldown((current) =>
        current.sourceKey === sourceKey && current.topicId === topicId
          ? {
              ...current,
              graph: null,
              loading: false,
              error: error.message || "Failed to load Concept Mind Map"
            }
          : current
      );
    }
  }, []);

  useEffect(() => {
    clearMindMapDrilldown();
  }, [clearMindMapDrilldown, selectedModuleId, selectedNoteGroupId, selectedTopicId, noteGroupMode]);

  useEffect(() => {
    setAutoRawText("");
    setAutoCreateError("");
    setSidebarError("");
    setAutoAdditionalInstructions(getModuleAdditionalInstructions(selectedModule));
  }, [selectedModuleId]);

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

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (authSubmitting) {
      return;
    }
    setAuthSubmitting(true);
    setAuthUiError("");
    setAuthMessage("");
    try {
      await auth.signInWithEmail(authEmail);
      setAuthMessage("Check your email for the sign-in link.");
      const mailpitUrl = getLocalMailpitUrl();
      if (mailpitUrl) {
        toast.info("Open Mailpit to finish local sign in.", {
          description: "Local Supabase captures magic-link emails in Mailpit.",
          action: {
            label: "Open Mailpit",
            onClick: () => window.open(mailpitUrl, "_blank", "noopener,noreferrer")
          }
        });
      }
    } catch (error) {
      setAuthUiError(error.message || "Failed to start sign in");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setAuthSubmitting(true);
    setAuthUiError("");
    setAuthMessage("");
    try {
      await auth.signOut();
      setSelectedSubjectId("");
      setSelectedModuleId("");
      setSelectedNoteGroupId("");
      setSelectedTopicId("");
      setNoteGroupMode("overview");
      setReviewSummary(null);
      setIsChatOpen(false);
      setIsMetadataOpen(false);
      setIsModuleMetadataOpen(false);
      setCurrentUserProfile(null);
      setIsAdminPanelOpen(false);
      setIsSubjectManagementOpen(false);
      navigate("/");
    } catch (error) {
      setAuthUiError(error.message || "Failed to sign out");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSubjectUpdated = (updatedSubject) => {
    setSubjects((current) =>
      current.map((subject) => (subject.id === updatedSubject.id ? updatedSubject : subject))
    );
  };

  const handleSelectSubject = (option) => {
    const nextId = option ? option.value : "";
    const subject = nextId ? subjects.find((item) => item.id === nextId) : null;
    setSelectedSubjectId(nextId);
    setSelectedModuleId("");
    setSelectedNoteGroupId("");
    setSelectedTopicId("");
    setSidebarScope("note-groups");
    setNoteGroupSearch("");
    setNoteGroupMode("overview");
    setReviewSummary(null);
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    setIsSubjectManagementOpen(false);
    navigate(subject?.short_code ? subjectPath(subject.short_code) : "/");
  };

  const handleSelectModule = (option) => {
    const nextId = option ? option.value : "";
    const module = nextId ? modules.find((item) => item.id === nextId) : null;
    setSelectedModuleId(nextId);
    setSelectedNoteGroupId("");
    setSelectedTopicId("");
    setSidebarScope("note-groups");
    setNoteGroupSearch("");
    setNoteGroupMode("overview");
    setReviewSummary(null);
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    navigate(
      nextId && selectedSubjectCode && module?.short_code
        ? modulePath(selectedSubjectCode, module.short_code)
        : selectedSubjectCode
          ? subjectPath(selectedSubjectCode)
          : "/"
    );
  };

  const handleCreateSubject = async () => {
    if (!canCreateSubjects) {
      setSidebarError(
        canUseProtectedActions ? "Creator access is required to create subjects." : "Sign in to create subjects."
      );
      return;
    }
    if (!newSubjectTitle.trim()) {
      return;
    }
    setSidebarError("");
    try {
      const subject = await createSubject({
        title: newSubjectTitle.trim(),
        description: newSubjectDescription.trim() || null
      });
      setSubjects((prev) => [subject, ...prev]);
      setSelectedSubjectId(subject.id);
      setSelectedModuleId("");
      setSelectedNoteGroupId("");
      setSelectedTopicId("");
      setSidebarScope("note-groups");
      setNoteGroupMode("overview");
      setReviewSummary(null);
      setIsChatOpen(false);
      setIsMetadataOpen(false);
      setIsModuleMetadataOpen(false);
      navigate(subject.short_code ? subjectPath(subject.short_code) : "/");
      setNewSubjectTitle("");
      setNewSubjectDescription("");
    } catch (error) {
      setSidebarError(error.message || "Failed to create subject");
    }
  };

  const handleOpenSubjectWizard = () => {
    if (!canCreateSubjects) {
      setSidebarError(
        canUseProtectedActions ? "Creator access is required to create subjects." : "Sign in to create subjects."
      );
      return;
    }
    setSubjectWizardMessages([]);
    setSubjectWizardInput("");
    setSubjectWizardTitle("");
    setSubjectWizardGoal("");
    setSubjectWizardScope("");
    setSubjectWizardError("");
    setSubjectWizardLoading(false);
    setSubjectWizardCreating(false);
    setIsSubjectWizardOpen(true);
  };

  const handleSubjectWizardSend = async () => {
    const message = subjectWizardInput.trim();
    if (!message || subjectWizardLoading) {
      return;
    }
    const userMsg = { role: "user", content: message };
    setSubjectWizardMessages((prev) => [...prev, userMsg]);
    setSubjectWizardInput("");
    setSubjectWizardLoading(true);
    setSubjectWizardError("");
    try {
      const result = await sendSubjectIntentChat({
        message,
        history: subjectWizardMessages.slice(-10),
        current_title: subjectWizardTitle || null,
        current_goal: subjectWizardGoal || null,
        current_scope: subjectWizardScope || null,
      });
      setSubjectWizardMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.assistant_message },
      ]);
      if (result.title) {
        setSubjectWizardTitle(result.title);
      }
      if (result.goal) {
        setSubjectWizardGoal(result.goal);
      }
      if (result.scope) {
        setSubjectWizardScope(result.scope);
      }
    } catch (error) {
      setSubjectWizardError(error.message || "Failed to get response");
    } finally {
      setSubjectWizardLoading(false);
    }
  };

  const handleCreateSubjectFromWizard = async () => {
    if (!canCreateSubjects) {
      setSubjectWizardError(
        canUseProtectedActions ? "Creator access is required to create subjects." : "Sign in to create subjects."
      );
      return;
    }
    if (!subjectWizardTitle.trim() || subjectWizardCreating) {
      return;
    }
    setSubjectWizardCreating(true);
    setSubjectWizardError("");
    try {
      const created = await createSubject({
        title: subjectWizardTitle.trim(),
        goal: subjectWizardGoal.trim() || null,
        scope: subjectWizardScope.trim() || null,
      });
      setSubjects((prev) => [created, ...prev]);
      setSelectedSubjectId(created.id);
      setSelectedModuleId("");
      setSelectedNoteGroupId("");
      setSelectedTopicId("");
      setSidebarScope("note-groups");
      setNoteGroupMode("overview");
      setReviewSummary(null);
      setIsChatOpen(false);
      setIsMetadataOpen(false);
      setIsModuleMetadataOpen(false);
      setIsSubjectWizardOpen(false);
      navigate(created.short_code ? subjectPath(created.short_code) : "/");
    } catch (error) {
      setSubjectWizardError(error.message || "Failed to create subject");
    } finally {
      setSubjectWizardCreating(false);
    }
  };

  const openSubjectMetadataModal = (subject) => {
    if (!subject) {
      return;
    }
    if (!canMaintainSubject(subject)) {
      setSidebarError(
        canUseProtectedActions ? "Maintainer access is required to edit subjects." : "Sign in to edit subjects."
      );
      return;
    }
    setEditingSubjectId(subject.id);
    setSubjectTitleDraft(subject.title || "");
    setSubjectGoalDraft(subject.goal || "");
    setSubjectScopeDraft(subject.scope || "");
    setSubjectMetadataError("");
    setIsSubjectMetadataOpen(true);
  };

  const handleSaveSubjectMetadata = async (subjectId) => {
    if (!canMaintainSubject(subjects.find((subject) => subject.id === subjectId))) {
      setSubjectMetadataError(
        canUseProtectedActions ? "Maintainer access is required to edit subjects." : "Sign in to edit subjects."
      );
      return;
    }
    if (!subjectId) {
      return;
    }
    const trimmedTitle = subjectTitleDraft.trim();
    if (!trimmedTitle) {
      setSubjectMetadataError("Title cannot be empty.");
      return;
    }
    setSubjectMetadataSaving(true);
    setSubjectMetadataError("");
    try {
      const updated = await updateSubject(subjectId, {
        title: trimmedTitle,
        goal: subjectGoalDraft.trim() || null,
        scope: subjectScopeDraft.trim() || null,
      });
      setSubjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setIsSubjectMetadataOpen(false);
    } catch (error) {
      setSubjectMetadataError(error.message || "Failed to save subject settings");
    } finally {
      setSubjectMetadataSaving(false);
    }
  };

  const handleDeleteSubject = async (subjectOverride) => {
    const subjectId = subjectOverride?.id || selectedSubjectId;
    if (!subjectId) {
      return;
    }
    const subject = subjectOverride || selectedSubject;
    if (!canDeleteSubject(subject)) {
      setSidebarError(
        canUseProtectedActions ? "Owner access is required to delete subjects." : "Sign in to delete subjects."
      );
      return;
    }
    const subjectLabel =
      subjectOverride?.title || selectedSubject?.title || "this subject";
    const confirmed = await requestConfirm({
      title: `Delete "${subjectLabel}"?`,
      description: "This removes all modules, note groups, and cards in it.",
      confirmLabel: "Delete subject"
    });
    if (!confirmed) {
      return;
    }
    setSidebarError("");
    try {
      await deleteSubject(subjectId);
      setSubjects((prev) => prev.filter((subject) => subject.id !== subjectId));
      if (selectedSubjectId === subjectId) {
        setSelectedSubjectId("");
        setSelectedModuleId("");
        setSelectedNoteGroupId("");
        setNoteGroupMode("overview");
        setReviewSummary(null);
        setIsChatOpen(false);
        setIsMetadataOpen(false);
        setIsModuleMetadataOpen(false);
        navigate("/");
      }
    } catch (error) {
      setSidebarError(error.message || "Failed to delete subject");
    }
  };

  const handleOpenModuleWizard = () => {
    if (!canManageSelectedSubject) {
      setSidebarError(
        canUseProtectedActions ? "Maintainer access is required to create modules." : "Sign in to create modules."
      );
      return;
    }
    setModuleWizardMessages([]);
    setModuleWizardInput("");
    setModuleWizardTitle("");
    setModuleWizardGoal("");
    setModuleWizardScope("");
    setModuleWizardError("");
    setModuleWizardLoading(false);
    setModuleWizardCreating(false);
    setIsModuleWizardOpen(true);
  };

  const handleModuleWizardSend = async () => {
    const message = moduleWizardInput.trim();
    if (!message || moduleWizardLoading) {
      return;
    }
    const userMsg = { role: "user", content: message };
    setModuleWizardMessages((prev) => [...prev, userMsg]);
    setModuleWizardInput("");
    setModuleWizardLoading(true);
    setModuleWizardError("");
    try {
      const result = await sendModuleIntentChat({
        message,
        history: moduleWizardMessages.slice(-10),
        current_title: moduleWizardTitle || null,
        current_goal: moduleWizardGoal || null,
        current_scope: moduleWizardScope || null,
        subject_title: selectedSubject?.title || null,
        subject_goal: selectedSubject?.goal || null,
        subject_scope: selectedSubject?.scope || null,
      });
      setModuleWizardMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.assistant_message },
      ]);
      if (result.title) {
        setModuleWizardTitle(result.title);
      }
      if (result.goal) {
        setModuleWizardGoal(result.goal);
      }
      if (result.scope) {
        setModuleWizardScope(result.scope);
      }
    } catch (error) {
      setModuleWizardError(error.message || "Failed to get response");
    } finally {
      setModuleWizardLoading(false);
    }
  };

  const handleCreateModuleFromWizard = async () => {
    if (!canManageSelectedSubject) {
      setModuleWizardError(
        canUseProtectedActions ? "Maintainer access is required to create modules." : "Sign in to create modules."
      );
      return;
    }
    if (!selectedSubjectId || !moduleWizardTitle.trim() || moduleWizardCreating) {
      return;
    }
    setModuleWizardCreating(true);
    setModuleWizardError("");
    try {
      const created = await createModule(selectedSubjectId, {
        title: moduleWizardTitle.trim(),
        goal: moduleWizardGoal.trim() || null,
        scope: moduleWizardScope.trim() || null,
      });
      setModules((prev) => [created, ...prev]);
      setSelectedModuleId(created.id);
      setIsModuleWizardOpen(false);
      setSelectedNoteGroupId("");
      setNoteGroupMode("overview");
      setReviewSummary(null);
      setIsChatOpen(false);
      setIsMetadataOpen(false);
      setIsModuleMetadataOpen(false);
      navigate(
        selectedSubjectCode && created.short_code
          ? modulePath(selectedSubjectCode, created.short_code)
          : "/"
      );
    } catch (error) {
      setModuleWizardError(error.message || "Failed to create module");
    } finally {
      setModuleWizardCreating(false);
    }
  };

  const navigateToNoteGroup = (noteGroupId, panelOverride = "") => {
    setSelectedNoteGroupId(noteGroupId);
    setSelectedTopicId("");
    setSidebarScope("note-groups");
    setNoteGroupMode("overview");
    setReviewSummary(null);
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    if (!noteGroupId) {
      navigate(
        selectedSubjectCode && selectedModuleCode
          ? modulePath(selectedSubjectCode, selectedModuleCode)
          : selectedSubjectCode
            ? subjectPath(selectedSubjectCode)
            : "/"
      );
      return;
    }
    const noteGroup = noteGroups.find((group) => group.id === noteGroupId);
    const nextPanel =
      panelOverride || (isViewCardsPage || isStudyPage || isQuestionPage ? routePanel : "overview");
    navigate(
      selectedSubjectCode && selectedModuleCode && noteGroup?.short_code
        ? noteGroupPath(selectedSubjectCode, selectedModuleCode, noteGroup.short_code, nextPanel)
        : "/"
    );
  };

  const navigateToTopic = (topicId, panelOverride = "") => {
    setSelectedTopicId(topicId);
    setSelectedNoteGroupId("");
    setSidebarScope("concepts");
    setChipFilterIds([]);
    setNoteGroupMode("overview");
    setReviewSummary(null);
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    if (!topicId) {
      navigate(
        selectedSubjectCode && selectedModuleCode
          ? modulePath(selectedSubjectCode, selectedModuleCode)
          : selectedSubjectCode
            ? subjectPath(selectedSubjectCode)
            : "/",
        { state: { sidebarScope: "concepts" } }
      );
      return;
    }
    const topic = topicChips.find((item) => item.id === topicId);
    const nextPanel =
      panelOverride || (isStudyPage || isQuestionPage ? routePanel : "overview");
    navigate(
      selectedSubjectCode && selectedModuleCode && topic?.short_code
        ? conceptPath(selectedSubjectCode, selectedModuleCode, topic.short_code, nextPanel)
        : "/"
    );
  };

  const handleJumpToSection = (anchor) => {
    const container = readingContentRef.current;
    if (!container || !anchor) {
      return;
    }
    const target = container.querySelector(`#${anchor}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleJumpToStudyCard = (studyCardId) => {
    const container = readingContentRef.current;
    if (!container || !studyCardId) {
      return;
    }
    const target = container.querySelector(`#reading-study-${studyCardId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleJumpToCleanSource = (studyCardId) => {
    const container = readingContentRef.current;
    if (!container || !studyCardId) {
      return;
    }
    const target = container.querySelector(`[data-clean-card-id="${studyCardId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleReadingModeChange = (nextMode) => {
    setReadingMode(nextMode);
    const targetCardId = readingPinnedCardId || readingHoverCardId;
    if (!targetCardId) {
      return;
    }
    window.setTimeout(() => {
      if (nextMode === "clean") {
        handleJumpToCleanSource(targetCardId);
      } else {
        handleJumpToStudyCard(targetCardId);
      }
    }, 0);
  };

  const handleReadingTitleClick = (studyCardId) => {
    setReadingHoverCardId(studyCardId);
    setReadingPinnedCardId((current) => (current === studyCardId ? "" : studyCardId));
    window.setTimeout(() => {
      if (readingMode === "clean") {
        handleJumpToCleanSource(studyCardId);
      } else {
        handleJumpToStudyCard(studyCardId);
      }
    }, 0);
  };

  const handleReadingToggleMode = (event, studyCardId) => {
    event.stopPropagation();
    const nextMode = readingMode === "study" ? "clean" : "study";
    setReadingMode(nextMode);
    setReadingHoverCardId(studyCardId);
    window.setTimeout(() => {
      if (nextMode === "clean") {
        handleJumpToCleanSource(studyCardId);
      } else {
        handleJumpToStudyCard(studyCardId);
      }
    }, 0);
  };

  const handleReadingViewInClean = (event, studyCardId) => {
    event.stopPropagation();
    setReadingMode("clean");
    setReadingHoverCardId(studyCardId);
    setReadingPinnedCardId(studyCardId);
    window.setTimeout(() => handleJumpToCleanSource(studyCardId), 0);
  };

  const handleScrollNavToCard = (studyCardId) => {
    const navEl = document.getElementById(`reading-nav-${studyCardId}`);
    if (navEl) {
      navEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const handleReadingPin = (event, studyCardId) => {
    event.stopPropagation();
    setReadingPinnedCardId((current) => (current === studyCardId ? "" : studyCardId));
  };

  const handleSelectNoteGroup = (option) => {
    const nextId = option ? option.value : "";
    if (nextId && nextId === selectedNoteGroupId) {
      handleBreadcrumbModule();
      return;
    }
    navigateToNoteGroup(nextId);
  };

  const handleSelectTopic = (option) => {
    const nextId = option ? option.value : "";
    if (nextId && nextId === selectedTopicId) {
      return;
    }
    navigateToTopic(nextId);
  };

  const resetSourceCheckState = () => {
    setSourceChecked(false);
    setSourceConfirmed(false);
    setSourceDuplicateCount(0);
    setSourceDuplicates([]);
    setSourceCheckError("");
    setSourceChecking(false);
  };

  const resetSourceState = () => {
    setNoteGroupSource("");
    resetSourceCheckState();
  };

  const handleUniqueIdChange = (value) => {
    setNoteGroupSource(value);
    resetSourceCheckState();
  };

  const handleUseGeneratedUniqueId = () => {
    setNoteGroupSource(generateUniqueId());
    setSourceChecked(true);
    setSourceConfirmed(true);
    setSourceDuplicateCount(0);
    setSourceDuplicates([]);
    setSourceCheckError("");
    setSourceChecking(false);
  };

  const handleCheckSource = async () => {
    const trimmed = noteGroupSource.trim();
    if (!trimmed) {
      setSourceCheckError("Unique ID is required before continuing.");
      return;
    }
    setSourceChecking(true);
    setSourceCheckError("");
    try {
      const response = await checkNoteGroupSource({ source: trimmed });
      const duplicates = response.duplicates || [];
      setSourceDuplicates(duplicates);
      setSourceDuplicateCount(duplicates.length);
      setSourceChecked(true);
      setSourceConfirmed(duplicates.length === 0);
    } catch (error) {
      setSourceCheckError(error.message || "Failed to check unique ID.");
    } finally {
      setSourceChecking(false);
    }
  };

  const handleConfirmDuplicateSource = () => {
    setSourceConfirmed(true);
  };

  const handleStartAutoNoteGroup = () => {
    if (!canManageSelectedSubject) {
      setSidebarError(
        canUseProtectedActions ? "Maintainer access is required to create note groups." : "Sign in to create note groups."
      );
      return;
    }
    setNoteGroupMode("auto");
    setSelectedNoteGroupId("");
    setSelectedTopicId("");
    setSidebarScope("note-groups");
    setReviewSummary(null);
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    setAutoCreateError("");
    navigate(
      selectedSubjectCode && selectedModuleCode
        ? createNoteGroupPath(selectedSubjectCode, selectedModuleCode)
        : "/"
    );
  };

  const handleAutoCreateNoteGroup = async () => {
    if (!canManageSelectedSubject) {
      setAutoCreateError(
        canUseProtectedActions ? "Maintainer access is required to create note groups." : "Sign in to create note groups."
      );
      return;
    }
    const trimmedSource = noteGroupSource.trim();
    if (!trimmedSource) {
      setAutoCreateError("Unique ID is required before continuing.");
      return;
    }
    if (!sourceConfirmed) {
      setAutoCreateError("Check the unique ID before continuing.");
      return;
    }
    if (countWords(autoAdditionalInstructions) > 500) {
      setAutoCreateError("Additional generation instructions must be 500 words or fewer.");
      return;
    }
    if (!selectedModuleId || !autoRawText.trim()) {
      return;
    }
    setAutoCreateLoading(true);
    setAutoCreateError("");
    try {
      const createdJob = await autoCreateNoteGroup({
        module_id: selectedModuleId,
        source: trimmedSource,
        raw_text: autoRawText.trim(),
        additional_generation_instructions: autoAdditionalInstructions.trim()
      });
      toast.info("Note group creation started.");
      const createdNoteGroupId = createdJob?.note_group_id || "";
      let createdNoteGroupCode = "";
      try {
        const snapshot = await refreshModuleGenerationWorkflowSnapshot(selectedModuleId, { notify: false });
        const createdWorkflow = (snapshot?.jobs || []).find(
          (workflow) =>
            workflow?.job?.id === createdJob?.id ||
            workflow?.job?.note_group_id === createdNoteGroupId ||
            workflow?.note_group?.id === createdNoteGroupId
        );
        createdNoteGroupCode = createdWorkflow?.note_group?.short_code || "";
      } catch {
        // Best-effort: route below can fall back to the module URL while state opens the workflow.
      }
      if (createdNoteGroupId && !createdNoteGroupCode) {
        try {
          const createdNoteGroup = await getNoteGroup(createdNoteGroupId);
          createdNoteGroupCode = createdNoteGroup?.short_code || "";
        } catch {
          // The selected workflow state is enough to show the generation page for this session.
        }
      }
      setAutoRawText("");
      setAutoAdditionalInstructions(getModuleAdditionalInstructions(selectedModule));
      setNoteGroupMode("overview");
      setSelectedNoteGroupId(createdNoteGroupId);
      setSelectedTopicId("");
      setSidebarScope("note-groups");
      setReviewSummary(null);
      setIsChatOpen(false);
      setIsMetadataOpen(false);
      setIsModuleMetadataOpen(false);
      refreshModuleGeneratedData(selectedModuleId);
      navigate(
        selectedSubjectCode && selectedModuleCode && createdNoteGroupCode
          ? noteGroupPath(selectedSubjectCode, selectedModuleCode, createdNoteGroupCode)
          : selectedSubjectCode && selectedModuleCode
            ? modulePath(selectedSubjectCode, selectedModuleCode)
            : "/"
      );
      resetSourceState();
    } catch (error) {
      setAutoCreateError(error.message || "Failed to start note group creation.");
      toast.error(error.message || "Failed to start note group creation.");
    } finally {
      setAutoCreateLoading(false);
    }
  };

  const handleCreateModuleChip = async () => {
    if (!canManageSelectedSubject) {
      setSidebarError(
        canUseProtectedActions ? "Maintainer access is required to create concepts." : "Sign in to create concepts."
      );
      return;
    }
    const trimmed = moduleChipLabel.trim();
    if (!selectedModuleId || !trimmed) {
      return;
    }
    setSidebarError("");
    try {
      const chip = await createConcept(selectedModuleId, {
        label: trimmed,
        description: moduleChipDescription.trim() || null,
      });
      setTopicChips((prev) => [...prev, chip]);
    } catch (error) {
      setSidebarError(error.message || "Failed to create concept");
    }
    setModuleChipLabel("");
    setModuleChipDescription("");
  };

  const handleToggleNoteGroupChip = async (chipId, isChecked) => {
    if (!canManageSelectedSubject) {
      setStudyCardError(
        canUseProtectedActions ? "Maintainer access is required to update concepts." : "Sign in to update concepts."
      );
      return;
    }
    if (!selectedNoteGroupId) {
      return;
    }
    try {
      const chips = isChecked
        ? await attachConcepts(selectedNoteGroupId, { concept_ids: [chipId] })
        : await detachConcept(selectedNoteGroupId, chipId);
      setNoteGroupChipIds(chips.map((chip) => chip.id));
    } catch (error) {
      setStudyCardError(error.message || "Failed to update concepts");
    }
  };

  const handleNoteGroupChipSelectChange = async (selected) => {
    if (!canManageSelectedSubject) {
      setStudyCardError(
        canUseProtectedActions ? "Maintainer access is required to update concepts." : "Sign in to update concepts."
      );
      return;
    }
    if (!selectedNoteGroupId) {
      return;
    }
    const newIds = (selected || []).map((opt) => opt.value);
    const toAdd = newIds.filter((id) => !noteGroupChipIds.includes(id));
    const toRemove = noteGroupChipIds.filter((id) => !newIds.includes(id));
    let lastChips = null;
    try {
      for (const chipId of toAdd) {
        lastChips = await attachConcepts(selectedNoteGroupId, { concept_ids: [chipId] });
      }
      for (const chipId of toRemove) {
        lastChips = await detachConcept(selectedNoteGroupId, chipId);
      }
      if (lastChips) {
        setNoteGroupChipIds(lastChips.map((chip) => chip.id));
      } else {
        setNoteGroupChipIds(newIds);
      }
    } catch (error) {
      setStudyCardError(error.message || "Failed to update concepts");
    }
  };

  const syncTopicStatusesFromMindMap = (graph) => {
    const topicNodes = Array.isArray(graph?.nodes)
      ? graph.nodes.filter((node) => node.node_type === "concept" || node.node_type === "topic")
      : [];
    if (!topicNodes.length) {
      return;
    }
    const topicStatusById = new Map(
      topicNodes.map((node) => [
        node.id,
        {
          knowledge_node_status: node.knowledge_node_status,
          knowledge_node_review_reason: node.knowledge_node_review_reason
        }
      ])
    );
    setTopicChips((prev) =>
      prev.map((topic) => {
        const status = topicStatusById.get(topic.id);
        return status ? { ...topic, ...status } : topic;
      })
    );
  };

  const conceptPageActions = useConceptPageActions({
    canManageSelectedSubject,
    canUseProtectedActions,
    conceptDescriptionDraft: topicDescriptionDraft,
    conceptKnowledgeNodeRegenerating: topicKnowledgeNodeRegenerating,
    conceptTitleDraft: topicTitleDraft,
    selectedConcept: selectedTopic,
    selectedConceptId: selectedTopicId,
    selectedModuleCode,
    selectedSubjectCode,
    navigate,
    requestConfirm,
    setConceptDescriptionDraft: setTopicDescriptionDraft,
    setConceptError: setTopicError,
    setConceptKnowledgeNodeRegenerating: setTopicKnowledgeNodeRegenerating,
    setConceptKnowledgeNodeRegeneratingId: setTopicKnowledgeNodeRegeneratingId,
    setConceptTitleDraft: setTopicTitleDraft,
    setConcepts: setTopicChips,
    setConceptSaving: setTopicSaving,
    setIsChatOpen,
    setMindMapRefreshToken,
    setNoteGroupMode,
    setReviewSummary,
    setSelectedConceptId: setSelectedTopicId,
    setSidebarError,
    setSidebarScope
  });
  const {
    handleDeleteConcept: handleDeleteTopic,
    handleRegenerateConceptKnowledgeNodes: handleRegenerateTopicKnowledgeNodes,
    handleSaveConcept: handleSaveTopic
  } = conceptPageActions;

  const noteGroupPageActions = useNoteGroupPageActions({
    canManageSelectedSubject,
    canUseProtectedActions,
    editingQuestionCard,
    editingStudyCard,
    metadataTitleDraft,
    newQuestionCorrectIndices,
    newQuestionOptions,
    newQuestionPrompt,
    newQuestionRefs,
    newQuestionType,
    newStudyCardChipIds,
    newStudyCardContent,
    newStudyCardTitle,
    noteGroupMindMapGenerating,
    noteGroupNeedsReviewRegenerating,
    selectedModuleCode,
    selectedModuleId,
    selectedNoteGroup,
    selectedNoteGroupId,
    selectedNoteGroupIdRef,
    selectedSubjectCode,
    studyCards,
    navigate,
    pollJob,
    requestConfirm,
    setEditingQuestionCard,
    setEditingQuestionCardId,
    setEditingStudyCard,
    setEditingStudyCardId,
    setIsChatOpen,
    setIsGeneratingQuestions,
    setIsMetadataOpen,
    setIsQuestionCreateOpen,
    setIsStudyCreateOpen,
    setMetadataError,
    setMetadataSaving,
    setMetadataTitleDraft,
    setMindMapRefreshToken,
    setNewQuestionCorrectIndices,
    setNewQuestionOptions,
    setNewQuestionPrompt,
    setNewQuestionRefs,
    setNewStudyCardChipIds,
    setNewStudyCardContent,
    setNewStudyCardTitle,
    setNoteGroupCardTable,
    setNoteGroupMindMap,
    setNoteGroupMindMapError,
    setNoteGroupMindMapGenerating,
    setNoteGroupMode,
    setNoteGroupNeedsReviewRegenerating,
    setNoteGroups,
    setQuestionCardError,
    setQuestionCards,
    setQuestionJobStatus,
    setReviewSummary,
    setSelectedNoteGroupId,
    setSidebarError,
    setStudyCardError,
    setStudyCards,
    syncConceptStatusesFromMindMap: {
      apply: syncTopicStatusesFromMindMap,
      regenerate: regenerateNoteGroupNeedsReviewKnowledgeNodes
    }
  });
  const {
    handleCreateQuestionCard,
    handleCreateStudyCard,
    handleDeleteNoteGroup,
    handleDeleteQuestionCard,
    handleDeleteStudyCard,
    handleEditQuestionCard,
    handleEditStudyCard,
    handleGenerateNoteGroupMindMap,
    handleGenerateQuestions,
    handleRegenerateNeedsReviewKnowledgeNodes,
    handleSaveMetadataTitle,
    handleSaveQuestionCard,
    handleSaveStudyCard,
    openMetadataModal,
    openQuestionCreateModal,
    openStudyCreateModal
  } = noteGroupPageActions;

  const startReview = async (mode, scope = "note-group") => {
    if (!canUseProtectedActions) {
      setReviewError("Sign in to review question cards.");
      return;
    }
    if (scope === "module") {
      if (!selectedModuleId) {
        return;
      }
    } else if (scope === "topic") {
      if (!selectedTopicId) {
        return;
      }
    } else if (!selectedNoteGroupId) {
      return;
    }
    setReviewError("");
    setReviewMode(mode);
    setReviewScope(scope);
    try {
      const response =
        scope === "module"
          ? await listModuleReviewQuestionCards(
              selectedModuleId,
              mode,
              mode === "queue" ? Number(reviewCount) || 10 : undefined
            )
          : scope === "topic"
            ? await listConceptReviewQuestionCards(
                selectedTopicId,
                mode,
                mode === "queue" ? Number(reviewCount) || 10 : undefined
              )
          : await listReviewQuestionCards(
              selectedNoteGroupId,
              mode,
              mode === "queue" ? Number(reviewCount) || 10 : undefined
            );
      const cards = response.question_cards || [];
      if (cards.length === 0) {
        setReviewQueue([]);
        setIsReviewing(false);
        setReviewError("No cards available for this review mode.");
        return;
      }
      const reviewCards = cards.map((card) => buildReviewCard(card));
      setReviewQueue(reviewCards);
      setReviewIndex(0);
      setReviewAnswer([]);
      setReviewStartTime(Date.now());
      setReviewFeedback(null);
      setReviewDeleteStep(0);
      setReviewDeleteLoading(false);
      setReviewSummary(null);
      setReviewStats({
        correct: 0,
        incorrect: 0,
        answered: 0,
        total: reviewCards.length,
        totalMs: 0
      });
      setIsReviewing(true);
    } catch (error) {
      setReviewError(error.message || "Failed to load review cards");
    }
  };

  const toggleReviewAnswer = (index, cardType) => {
    setReviewAnswer((prev) => {
      if (cardType === "mcq") {
        return [index];
      }
      return prev.includes(index) ? prev.filter((value) => value !== index) : [...prev, index];
    });
  };

  const toggleReviewExplanation = (index) => {
    setReviewExplanationOpen((prev) =>
      prev.includes(index) ? prev.filter((value) => value !== index) : [...prev, index]
    );
  };

  const submitReviewAnswer = async (card) => {
    if (!card) {
      return;
    }
    if (!reviewAnswer.length) {
      setReviewError("Select an answer before submitting.");
      return;
    }
    if (reviewFeedback) {
      return;
    }
    setReviewDeleteStep(0);
    const correctIndices = card.reviewCorrectIndices || card.correct_option_indices || [];
    const correct =
      correctIndices.slice().sort().join(",") === reviewAnswer.slice().sort().join(",");
    const responseTimeMs = reviewStartTime ? Date.now() - reviewStartTime : 0;
    const answerOptionIndices = reviewAnswer.map((index) => {
      const choice = card.reviewChoices?.[index];
      return Number.isInteger(choice?.originalIndex) ? choice.originalIndex : index;
    });
    try {
      const updated = await reviewQuestionCard(card.id, {
        correct,
        response_time_ms: responseTimeMs,
        answer_option_indices: answerOptionIndices
      });
      setQuestionCards((prev) =>
        prev.map((item) => (item.id === card.id ? updated : item))
      );
      setReviewFeedback({
        correct,
        correctIndices,
        responseTimeMs
      });
      setReviewStats((prev) => ({
        correct: prev.correct + (correct ? 1 : 0),
        incorrect: prev.incorrect + (correct ? 0 : 1),
        answered: prev.answered + 1,
        total: prev.total,
        totalMs: prev.totalMs + responseTimeMs
      }));
    } catch (error) {
      setReviewError(error.message || "Failed to submit review");
    }
  };

  const finalizeReview = (statsOverride = null) => {
    const stats = statsOverride || reviewStats;
    const answered = stats.answered;
    const total = stats.total;
    const totalMs = stats.totalMs;
    const accuracy = answered ? Math.round((stats.correct / answered) * 100) : 0;
    const avgSeconds = answered ? (totalMs / answered / 1000).toFixed(1) : "0.0";
    setReviewSummary({
      scope: reviewScope,
      mode: reviewMode,
      answered,
      total,
      correct: stats.correct,
      incorrect: stats.incorrect,
      remaining: Math.max(total - answered, 0),
      accuracy,
      avgSeconds
    });
    setReviewRefreshToken((prev) => prev + 1);
    setIsReviewing(false);
    setReviewQueue([]);
    setReviewIndex(0);
    setReviewAnswer([]);
    setReviewStartTime(null);
    setReviewError("");
    setReviewFeedback(null);
    setReviewDeleteStep(0);
    setReviewDeleteLoading(false);
  };

  const endReview = () => {
    finalizeReview();
  };

  const requestReviewDelete = () => {
    if (!currentReviewCard || reviewDeleteLoading) {
      return;
    }
    setReviewError("");
    setReviewDeleteStep(1);
  };

  const cancelReviewDelete = () => {
    setReviewDeleteStep(0);
  };

  const executeReviewDelete = async () => {
    if (!currentReviewCard || reviewDeleteLoading) {
      return;
    }
    setReviewDeleteLoading(true);
    setReviewError("");
    try {
      await deleteQuestionCard(currentReviewCard.id);
      setQuestionCards((prev) => prev.filter((card) => card.id !== currentReviewCard.id));
      const nextQueue = reviewQueue.filter((_, index) => index !== reviewIndex);
      let nextStats = {
        ...reviewStats,
        total: Math.max(reviewStats.total - 1, 0)
      };
      if (reviewFeedback) {
        const responseTimeMs = reviewFeedback.responseTimeMs || 0;
        nextStats = {
          ...nextStats,
          answered: Math.max(nextStats.answered - 1, 0),
          correct: Math.max(nextStats.correct - (reviewFeedback.correct ? 1 : 0), 0),
          incorrect: Math.max(nextStats.incorrect - (reviewFeedback.correct ? 0 : 1), 0),
          totalMs: Math.max(nextStats.totalMs - responseTimeMs, 0)
        };
      }
      if (nextQueue.length === 0 || reviewIndex >= nextQueue.length) {
        setReviewStats(nextStats);
        finalizeReview(nextStats);
        return;
      }
      setReviewQueue(nextQueue);
      setReviewIndex(reviewIndex);
      setReviewAnswer([]);
      setReviewStartTime(Date.now());
      setReviewFeedback(null);
      setReviewDeleteStep(0);
      setReviewStats(nextStats);
      setReviewChatMessages([]);
      setReviewChatInput("");
      setReviewChatError("");
      setReviewChatLoading(false);
      setReviewChatView("chat");
      setReviewChatCardId("");
      setReviewChatCardLoading(false);
      setReviewChatCardError("");
    } catch (error) {
      setReviewError(error.message || "Failed to delete question card");
    } finally {
      setReviewDeleteLoading(false);
    }
  };

  const confirmReviewDelete = async () => {
    if (!currentReviewCard || reviewDeleteLoading) {
      return;
    }
    const shouldDelete = await requestConfirm({
      title: "Delete this question card?",
      description: "This cannot be undone.",
      confirmLabel: "Delete question card"
    });
    if (!shouldDelete) {
      return;
    }
    await executeReviewDelete();
  };

  const nextReviewCard = () => {
    if (!reviewFeedback) {
      setReviewError("Submit your answer first.");
      return;
    }
    const nextIndex = reviewIndex + 1;
    if (nextIndex >= reviewQueue.length) {
      endReview();
      return;
    }
    setReviewIndex(nextIndex);
    setReviewAnswer([]);
    setReviewStartTime(Date.now());
    setReviewFeedback(null);
    setReviewError("");
    setReviewDeleteStep(0);
  };

  const openQuestionFocus = (cardId) => {
    setFocusQuestionCardId(cardId);
    setIsQuestionFocusOpen(true);
  };

  const closeQuestionFocus = () => {
    setIsQuestionFocusOpen(false);
    setFocusQuestionCardId("");
  };

  const handleSendReviewChat = async () => {
    if (!selectedModuleId || !reviewNoteGroupId || !reviewChatInput.trim()) {
      return;
    }
    setReviewChatLoading(true);
    setReviewChatError("");
    const message = reviewChatInput.trim();
    const history = reviewChatMessages
      .slice(-10)
      .filter((item) => item?.content)
      .map((item) => ({
        role: item.role,
        content: item.content
      }));
    setReviewChatInput("");
    setReviewChatMessages((prev) => [...prev, { role: "user", content: message }]);
    try {
      const questionPrompt = currentReviewCard?.prompt || "";
      const userAnswer = formatAnswerLabels(currentReviewCard, reviewAnswer);
      const correctAnswer = formatAnswerLabels(
        currentReviewCard,
        currentReviewCard?.reviewCorrectIndices ||
          currentReviewCard?.correct_option_indices ||
          []
      );
      const response = await sendChat({
        module_id: selectedModuleId,
        message,
        note_group_id: reviewNoteGroupId,
        question_prompt: questionPrompt,
        user_answer: userAnswer,
        correct_answer: correctAnswer,
        history
      });
      setReviewChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.answer, refs: response.study_card_refs || [] }
      ]);
      if (response.study_card_refs && response.study_card_refs.length) {
        response.study_card_refs.forEach((refId) => {
          setReviewChatCardCache((prev) => {
            if (prev[refId]) {
              return prev;
            }
            getStudyCard(refId)
              .then((card) =>
                setReviewChatCardCache((next) => ({
                  ...next,
                  [refId]: card
                }))
              )
              .catch(() => null);
            return prev;
          });
        });
      }
    } catch (error) {
      setReviewChatError(error.message || "Chat failed");
    } finally {
      setReviewChatLoading(false);
    }
  };

  const openReviewStudyCard = (studyCardId) => {
    if (!studyCardId) {
      return;
    }
    setReviewChatView("card");
    setReviewChatCardId(studyCardId);
    setReviewChatCardError("");
    if (reviewChatCardCache[studyCardId]) {
      return;
    }
    setReviewChatCardLoading(true);
    getStudyCard(studyCardId)
      .then((card) =>
        setReviewChatCardCache((prev) => ({
          ...prev,
          [studyCardId]: card
        }))
      )
      .catch((error) => setReviewChatCardError(error.message || "Failed to load study card"))
      .finally(() => setReviewChatCardLoading(false));
  };

  const handleBackToReviewChat = () => {
    setReviewChatView("chat");
    setReviewChatCardId("");
    setReviewChatCardError("");
  };

  const handleReviewChatKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (
        !reviewChatLoading &&
        selectedModuleId &&
        reviewNoteGroupId &&
        reviewChatInput.trim()
      ) {
        handleSendReviewChat();
      }
    }
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

  const handleBreadcrumbModule = () => {
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
  };

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
    <div className="flex max-w-sm flex-col items-end gap-2 text-right">
      {auth.isAuthenticated ? (
        <>
          <div className="text-xs text-muted-foreground">{auth.user?.email}</div>
          <div className="flex flex-wrap justify-end gap-2">
            {isAdmin ? (
              <Button
                type="button"
                variant={isAdminPanelOpen ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsAdminPanelOpen((open) => !open);
                  setIsSubjectManagementOpen(false);
                }}
              >
                Admin
              </Button>
            ) : null}
            {canManageSelectedSubject ? (
              <Button
                type="button"
                variant={isSubjectManagementOpen ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsSubjectManagementOpen((open) => !open);
                  setIsAdminPanelOpen(false);
                }}
              >
                Subject
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={authSubmitting}
            >
              Sign out
            </Button>
          </div>
        </>
      ) : auth.isConfigured ? (
        <form className="flex flex-wrap justify-end gap-2" onSubmit={handleSignIn}>
          <input
            className="h-9 min-w-48 rounded-md border bg-background px-3 text-sm"
            type="email"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="Email"
            disabled={auth.loading || authSubmitting}
          />
          <Button type="submit" size="sm" disabled={auth.loading || authSubmitting || !authEmail.trim()}>
            {authSubmitting ? "Sending..." : "Sign in"}
          </Button>
        </form>
      ) : (
        <p className="max-w-xs text-xs text-muted-foreground">
          Supabase env vars are required for sign in.
        </p>
      )}
      {authMessage ? <p className="text-xs text-muted-foreground">{authMessage}</p> : null}
      {authUiError || auth.error ? (
        <p className="text-xs font-medium text-destructive">{authUiError || auth.error}</p>
      ) : null}
      {currentUserError ? (
        <p className="text-xs font-medium text-destructive">{currentUserError}</p>
      ) : null}
    </div>
  );

  return (
    <>
      <ReviewDialog
        open={isReviewOverlayVisible}
        card={currentReviewCard}
        summary={reviewSummary}
        error={reviewError}
        onOpenChange={(open) => {
          if (!open) {
            endReview();
          }
        }}
      >
          <div
            className={`review-layout ${
              reviewFeedback && currentReviewCard ? "has-review-chat" : ""
            }`}
          >
            <div className="review-modal">
              {reviewSummary ? (
                <>
                  <h2>Review summary</h2>
                  <div className="review-meta">
                    <span className={badgeClass}>
                      Scope: {reviewSummary.scope === "module" ? "Module" : "Note group"}
                    </span>
                    <span className={badgeClass}>Mode: {reviewSummary.mode}</span>
                    <span className={badgeClass}>
                      Reviewed: {reviewSummary.answered} / {reviewSummary.total}
                    </span>
                    <span className={badgeClass}>Accuracy: {reviewSummary.accuracy}%</span>
                    <span className={badgeClass}>Avg time: {reviewSummary.avgSeconds}s</span>
                    {reviewSummary.remaining ? (
                      <span className={badgeClass}>Remaining: {reviewSummary.remaining}</span>
                    ) : null}
                  </div>
                  <p className={mutedTextClass}>
                    Correct: {reviewSummary.correct} · Incorrect: {reviewSummary.incorrect}
                  </p>
                  <div className={buttonRowClass}>
                    <button
                      className={primaryButtonClass}
                      type="button"
                      onClick={() => setReviewSummary(null)}
                    >
                      Close summary
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="review-meta">
                    <span className={badgeClass}>
                      Scope: {reviewScope === "module" ? "Module" : "Note group"}
                    </span>
                    <span className={badgeClass}>
                      Card {reviewIndex + 1} / {reviewQueue.length}
                    </span>
                    <span className={badgeClass}>Mode: {reviewMode}</span>
                    {reviewScope === "module" && currentReviewCard ? (
                      <span className={badgeClass}>
                        Note group: {resolveNoteGroupLabel(currentReviewCard.note_group_id)}
                      </span>
                    ) : null}
                    {currentReviewCard ? (
                      <span className={badgeClass}>Due: {formatDueAt(currentReviewCard.due_at)}</span>
                    ) : null}
                  </div>
                  {reviewError ? <p className={errorTextClass}>{reviewError}</p> : null}
                  {currentReviewCard ? (
                    <>
                      <h3>{currentReviewCard.prompt}</h3>
                      <p className={mutedTextClass}>
                        {reviewCardType === "multi"
                          ? "Select all that apply."
                          : "Select the best answer."}
                      </p>
                      <div className="review-options">
                        {(currentReviewCard.reviewChoices ||
                          (currentReviewCard.reviewOptions ||
                            currentReviewCard.options ||
                            []).map((option, index) => {
                            const fallbackExplanations =
                              currentReviewCard.reviewOptionExplanations ||
                              currentReviewCard.option_explanations ||
                              [];
                            return {
                              text: option,
                              explanation: fallbackExplanations[index] || "",
                              originalIndex: index
                            };
                          })).map((choice, optionIndex) => {
                          const explanation = choice.explanation || "";
                          const isSelected = reviewAnswer.includes(optionIndex);
                          const isCorrect = reviewFeedback?.correctIndices?.includes(optionIndex);
                          const showIncorrect =
                            reviewFeedback && isSelected && !isCorrect;
                          const showMissed =
                            reviewFeedback &&
                            reviewCardType === "multi" &&
                            isCorrect &&
                            !isSelected;
                          const showCorrect = isCorrect && !showMissed;
                          const isExplanationOpen =
                            reviewFeedback && reviewExplanationOpen.includes(optionIndex);
                          return (
                            <div key={`${currentReviewCard.id}-${optionIndex}`} className="review-option-item">
                              <button
                                type="button"
                                className={`review-option ${
                                  isSelected ? "selected" : ""
                                } ${showCorrect ? "correct" : ""} ${
                                  showIncorrect ? "incorrect" : ""
                                } ${showMissed ? "missed" : ""}`}
                                onClick={() =>
                                  reviewFeedback
                                    ? null
                                    : toggleReviewAnswer(optionIndex, reviewCardType)
                                }
                                disabled={Boolean(reviewFeedback)}
                              >
                                <span className="option-control">
                                  {reviewCardType === "multi" ? (
                                    <span className={`option-box ${isSelected ? "checked" : ""}`}>
                                      {isSelected ? "✓" : ""}
                                    </span>
                                  ) : (
                                    <span className={`option-radio ${isSelected ? "checked" : ""}`}>
                                      <span className="option-radio-dot" />
                                    </span>
                                  )}
                                </span>
                                <span className="option-text">{choice.text}</span>
                              </button>
                              {reviewFeedback && explanation ? (
                                <div
                                  className={`review-explanation-bubble${
                                    isExplanationOpen ? " open" : ""
                                  }`}
                                >
                                  {explanation}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      <div className={buttonRowClass}>
                        <button
                          className={primaryButtonClass}
                          type="button"
                          onClick={() => submitReviewAnswer(currentReviewCard)}
                          disabled={!reviewAnswer.length || Boolean(reviewFeedback)}
                        >
                          Submit answer
                        </button>
                        <button
                          className={outlineButtonClass}
                          type="button"
                          onClick={nextReviewCard}
                          disabled={!reviewFeedback}
                        >
                          {reviewIndex + 1 >= reviewQueue.length ? "Finish review" : "Next question"}
                        </button>
                        <button className={outlineButtonClass} type="button" onClick={endReview}>
                          End review
                        </button>
                        <button
                          className={destructiveOutlineButtonClass}
                          type="button"
                          onClick={requestReviewDelete}
                          disabled={reviewDeleteLoading || reviewDeleteStep === 1}
                        >
                          Delete card
                        </button>
                      </div>
                      {reviewDeleteStep === 1 ? (
                        <div className="review-delete-confirm">
                          <p>Delete this question card? This cannot be undone.</p>
                          <div className={buttonRowClass}>
                            <button
                              className={outlineButtonClass}
                              type="button"
                              onClick={cancelReviewDelete}
                              disabled={reviewDeleteLoading}
                            >
                              Keep card
                            </button>
                            <button
                              className={destructiveOutlineButtonClass}
                              type="button"
                              onClick={confirmReviewDelete}
                              disabled={reviewDeleteLoading}
                            >
                              {reviewDeleteLoading ? "Deleting..." : "Delete permanently"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className={mutedTextClass}>No review card loaded.</p>
                  )}
                </>
              )}
            </div>
            {reviewFeedback && currentReviewCard ? (
              <div className="review-chat-panel">
                {reviewChatView === "card" ? (
                  <>
                    <div className="review-chat-header">
                      <button
                        className="back-button"
                        type="button"
                        onClick={handleBackToReviewChat}
                      >
                        ← Back to chat
                      </button>
                      <p className={mutedTextClass}>
                        {reviewNoteGroupId
                          ? `Scoped to ${resolveNoteGroupLabel(reviewNoteGroupId)}.`
                          : "Scoped to current note group."}
                      </p>
                    </div>
                    {reviewChatCardLoading ? (
                      <p className={mutedTextClass}>Loading study card...</p>
                    ) : null}
                    {reviewChatCardError ? <p className={errorTextClass}>{reviewChatCardError}</p> : null}
                    {reviewChatCardId && reviewChatCardCache[reviewChatCardId] ? (
                      <div className="review-chat-card">
                        <h3>
                          {reviewChatCardCache[reviewChatCardId].title ||
                            "Untitled study card"}
                        </h3>
                        <p>{reviewChatCardCache[reviewChatCardId].content}</p>
                        {reviewChatCardCache[reviewChatCardId].topic_chips?.length ? (
                          <div className="chip-grid">
                            {reviewChatCardCache[reviewChatCardId].topic_chips.map((chip) => (
                              <span key={chip.id} className={`${badgeClass} topic-chip`}>
                                {chip.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="review-chat-header">
                      <h3>Clarify this question</h3>
                      <p className={mutedTextClass}>
                        Scoped to {resolveNoteGroupLabel(reviewNoteGroupId)}.
                      </p>
                    </div>
                    <div className="chat" ref={reviewChatListRef}>
                      {currentReviewCard ? (
                        <div className="chat-bubble assistant">
                          <p>{reviewRefsMessage}</p>
                          {reviewCardRefs.length ? (
                            <ol className="chat-refs">
                              {reviewCardRefs.map((refId) => {
                                const refCard = reviewChatCardCache[refId];
                                const title =
                                  refCard?.title || `Study card ${refId.slice(0, 8)}`;
                                return (
                                  <li key={refId}>
                                    <button
                                      className="link-button"
                                      type="button"
                                      onClick={() => openReviewStudyCard(refId)}
                                    >
                                      {title}
                                    </button>
                                  </li>
                                );
                              })}
                            </ol>
                          ) : null}
                        </div>
                      ) : null}
                      {reviewChatMessages.length === 0 ? (
                        <p className="empty">Ask for clarity about the question or its sources.</p>
                      ) : (
                        reviewChatMessages.map((message, index) => (
                          <div
                            key={`${message.role}-${index}`}
                            className={`chat-bubble ${message.role}`}
                          >
                            <p>{message.content}</p>
                            {message.refs && message.refs.length ? (
                              <ol className="chat-refs">
                                {message.refs.map((refId) => {
                                  const refCard = reviewChatCardCache[refId];
                                  const title =
                                    refCard?.title ||
                                    `Study card ${refId.slice(0, 8)}`;
                                  return (
                                    <li key={refId}>
                                      <button
                                        className="link-button"
                                        type="button"
                                        onClick={() => openReviewStudyCard(refId)}
                                      >
                                        {title}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ol>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                    {reviewChatError ? <p className={errorTextClass}>{reviewChatError}</p> : null}
                    <div className="chat-input">
                      <textarea
                        value={reviewChatInput}
                        onChange={(event) => setReviewChatInput(event.target.value)}
                        onKeyDown={handleReviewChatKeyDown}
                        placeholder="Ask about this question..."
                        rows={2}
                        disabled={!reviewNoteGroupId}
                      />
                      <button
                        className={primaryButtonClass}
                        type="button"
                        onClick={handleSendReviewChat}
                        disabled={!reviewNoteGroupId || !reviewChatInput.trim() || reviewChatLoading}
                      >
                        {reviewChatLoading ? "Sending..." : "Send"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
      </ReviewDialog>
      <TutorChatDialog open={isChatOpen} onOpenChange={setIsChatOpen}>
          <div className="chat-modal">
            <div className="chat-modal-header">
              <div>
                <h2>Chat with your notes</h2>
                <p className={mutedTextClass}>
                  {selectedNoteGroupId
                    ? "Ask about the current Note Group."
                    : "Ask about this module and its note groups."}
                </p>
              </div>
              <button className={outlineButtonClass} type="button" onClick={() => setIsChatOpen(false)}>
                Close
              </button>
            </div>
            {selectedNoteGroupId ? (
              <div className="results-meta">
                <span className={`${badgeClass} chat-scope-badge`}>
                  Scoped to current Note Group: {resolveNoteGroupLabel(selectedNoteGroupId)}
                </span>
              </div>
            ) : null}
            {chatView === "card" ? (
              <>
                <div className="review-chat-header">
                  <button className="back-button" type="button" onClick={handleBackToChat}>
                    ← Back to chat
                  </button>
                  <p className={mutedTextClass}>
                    {selectedNoteGroupId
                      ? "Scoped to current note group."
                      : "Scoped to selected module."}
                  </p>
                </div>
                {chatCardLoading ? <p className={mutedTextClass}>Loading study card...</p> : null}
                {chatCardError ? <p className={errorTextClass}>{chatCardError}</p> : null}
                {chatCardId && chatCardCache[chatCardId] ? (
                  <div className="chat-card">
                    <h3>{chatCardCache[chatCardId].title || "Untitled study card"}</h3>
                    <p>{chatCardCache[chatCardId].content}</p>
                    {chatCardCache[chatCardId].topic_chips?.length ? (
                      <div className="chip-grid">
                        {chatCardCache[chatCardId].topic_chips.map((chip) => (
                          <span key={chip.id} className={`${badgeClass} topic-chip`}>
                            {chip.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="chat" ref={chatListRef}>
                  {chatMessages.length === 0 ? (
                    <p className="empty">Ask a question to get answers from your study cards.</p>
                  ) : (
                    chatMessages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`chat-bubble ${message.role}`}
                      >
                        <p>{message.content}</p>
                        {message.refs && message.refs.length ? (
                          <ol className="chat-refs">
                            {message.refs.map((refId) => {
                              const refCard = chatCardCache[refId];
                              const title =
                                refCard?.title || `Study card ${refId.slice(0, 8)}`;
                              return (
                                <li key={refId}>
                                  <button
                                    className="link-button"
                                    type="button"
                                    onClick={() => openChatStudyCard(refId)}
                                  >
                                    {title}
                                  </button>
                                </li>
                              );
                            })}
                          </ol>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
                {chatError ? <p className={errorTextClass}>{chatError}</p> : null}
                <div className="chat-input">
                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder={
                      selectedNoteGroupId
                        ? "Ask a question about this Note Group..."
                        : "Ask a question about this module..."
                    }
                    rows={2}
                    disabled={!canUseProtectedActions || !selectedModuleId}
                  />
                  <button
                    className={primaryButtonClass}
                    type="button"
                    onClick={handleSendChat}
                    disabled={!canUseProtectedActions || !selectedModuleId || !chatInput.trim() || chatLoading}
                  >
                    {chatLoading ? "Sending..." : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
      </TutorChatDialog>
      <ReadingDialog open={isReadingOpen} onOpenChange={setIsReadingOpen} renderShell={false}>
          <div className="reading-modal">
            <div className="reading-header">
              <div>
                <h2>Clean study text</h2>
                <p className={mutedTextClass}>Switch between study notes and their cleaned source text.</p>
              </div>
              <div className="reading-actions">
                <div className="segmented-control" role="group" aria-label="Reading mode">
                  <button
                    type="button"
                    className={readingMode === "study" ? "active" : ""}
                    onClick={() => handleReadingModeChange("study")}
                  >
                    Study notes
                  </button>
                  <button
                    type="button"
                    className={readingMode === "clean" ? "active" : ""}
                    onClick={() => handleReadingModeChange("clean")}
                  >
                    Clean text
                  </button>
                </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsReadingOpen(false)}
              >
                Close
              </button>
              </div>
            </div>
            {!readingAvailable ? (
              <p className={mutedTextClass}>No formatted text available for this note group yet.</p>
            ) : (
              <div className="reading-body">
                <aside className="reading-nav">
                  <p className="label">Study cards</p>
                  {studyCards.map((card, index) => {
                    const isHovered = readingHoverCardId === card.id;
                    const isPinned = readingPinnedCardId === card.id;
                    return (
                      <div
                        key={`nav-${card.id}`}
                        id={`reading-nav-${card.id}`}
                        className={`reading-link-row ${isHovered ? "hovered" : ""} ${
                          isPinned ? "pinned" : ""
                        }`}
                        onMouseEnter={() => setReadingHoverCardId(card.id)}
                        onMouseLeave={() => setReadingHoverCardId("")}
                      >
                        <button
                          className="reading-link"
                          type="button"
                          onClick={() => handleReadingTitleClick(card.id)}
                        >
                          {card.title || `Study card ${index + 1}`}
                        </button>
                        <button
                          className="reading-toggle-mode"
                          type="button"
                          aria-label={readingMode === "study" ? "Switch to clean text" : "Switch to study notes"}
                          onClick={(event) => handleReadingToggleMode(event, card.id)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 9h16M4 9l4-4M4 9l4 4M20 15H4M20 15l-4-4M20 15l-4 4"/>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </aside>
                <div className="reading-content" ref={readingContentRef}>
                  {readingMode === "clean" ? (
                    <div className={`clean-source${readingPinnedCardId ? " has-pin" : ""}`}>
                      {renderCleanedMarkdown(effectiveCleanedText, readingHighlights)}
                    </div>
                  ) : (
                    studyNoteSections.map((section, index) => {
                      const anchor = getSectionAnchor(section, index);
                      const cardTitle = studyCardTitleById.get(section.study_card_id);
                      const isHovered = readingHoverCardId === section.study_card_id;
                      const isPinned = readingPinnedCardId === section.study_card_id;
                      return (
                        <section
                          key={anchor}
                          id={`reading-study-${section.study_card_id}`}
                          className={`reading-section ${isHovered ? "hovered" : ""} ${
                            isPinned ? "pinned" : ""
                          }`}
                          onMouseEnter={() => setReadingHoverCardId(section.study_card_id)}
                          onMouseLeave={() => setReadingHoverCardId("")}
                          onClick={() => {
                            setReadingPinnedCardId((current) => current === section.study_card_id ? "" : section.study_card_id);
                            handleScrollNavToCard(section.study_card_id);
                          }}
                        >
                          <button
                            className="reading-section-toggle"
                            type="button"
                            aria-label="View in clean text"
                            onClick={(event) => handleReadingViewInClean(event, section.study_card_id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="11" cy="11" r="8"/>
                              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                          </button>
                          <div className="reading-section-header">
                            <h3>{section.title || `Section ${index + 1}`}</h3>
                          </div>
                          <div className="reading-section-body">
                            {renderMarkdownBlocks(section.content)}
                          </div>
                        </section>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
      </ReadingDialog>
      {isQuestionFocusOpen && focusQuestionCard ? (
        <LegacyDialog
          open={isQuestionFocusOpen && Boolean(focusQuestionCard)}
          onOpenChange={(open) => {
            if (!open) {
              closeQuestionFocus();
            }
          }}
          title="Question focus"
        >
          <div className="focus-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Question focus</h2>
                <p className={mutedTextClass}>Mastery and scheduling details for this card.</p>
              </div>
              <button className={outlineButtonClass} type="button" onClick={closeQuestionFocus}>
                Close
              </button>
            </div>
            <p className={mutedTextClass}>
              {focusCardType.toUpperCase()} · {focusQuestionCard.id.slice(0, 8)}
            </p>
            <div className="stats-grid">
              <div className="stat-card">
                <p className="label">Mastery</p>
                <p className={`value mastery-value ${focusMasteryTier}`}>
                  {focusMasteryScore !== null ? focusMasteryScore.toFixed(1) : "—"}
                </p>
              </div>
              <div className="stat-card">
                <p className="label">Reps</p>
                <p className="value">{focusQuestionCard.reps ?? 0}</p>
              </div>
              <div className="stat-card">
                <p className="label">Last review</p>
                <p className="value">{formatReviewAt(focusQuestionCard.last_review_at)}</p>
              </div>
              <div className="stat-card">
                <p className="label">Due</p>
                <p className="value">{formatDueAt(focusQuestionCard.due_at)}</p>
              </div>
            </div>
            <div className="focus-question">
              <p>{focusQuestionCard.prompt}</p>
              <ul className="options">
                {focusQuestionCard.options.map((option, optionIndex) => {
                  const isCorrect =
                    focusQuestionCard.correct_option_indices.includes(optionIndex);
                  return (
                    <li key={`${focusQuestionCard.id}-${optionIndex}`} className={isCorrect ? "correct" : ""}>
                      {option}
                    </li>
                  );
                })}
              </ul>
              <p className="refs">
                Refs:{" "}
                {focusQuestionCard.study_card_refs?.length
                  ? focusQuestionCard.study_card_refs.join(", ")
                  : "—"}
              </p>
            </div>
          </div>
        </LegacyDialog>
      ) : null}
      {isStudyCreateOpen ? (
        <LegacyDialog
          open={isStudyCreateOpen}
          onOpenChange={setIsStudyCreateOpen}
          title="Create study card"
        >
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Create study card</h2>
                <p className={mutedTextClass}>Add a custom study card to this note group.</p>
              </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsStudyCreateOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="form-block">
              <input
                type="text"
                value={newStudyCardTitle}
                onChange={(event) => setNewStudyCardTitle(event.target.value)}
                placeholder="New study card title"
                disabled={!canManageSelectedSubject || !selectedNoteGroupId}
              />
              <textarea
                value={newStudyCardContent}
                onChange={(event) => setNewStudyCardContent(event.target.value)}
                placeholder="New study card content"
                rows={4}
                disabled={!canManageSelectedSubject || !selectedNoteGroupId}
              />
              {chipOptions.length > 0 ? (
                <Select
                  className="select"
                  classNamePrefix="select"
                  options={chipOptions}
                  value={chipOptions.filter((opt) => newStudyCardChipIds.includes(opt.value))}
                  onChange={(selected) =>
                    setNewStudyCardChipIds((selected || []).map((opt) => opt.value))
                  }
                  placeholder="Assign concepts"
                  isMulti
                  isClearable
                  maxMenuHeight={200}
                  menuPortalTarget={document.body}
                  styles={selectStyles}
                  formatOptionLabel={(opt) => (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span>{opt.label}</span>
                      {opt.description ? (
                        <span style={{ fontSize: "0.75em", color: "#888" }}>{opt.description}</span>
                      ) : null}
                    </div>
                  )}
                />
              ) : null}
              <div className={buttonRowClass}>
                <button
                  className={primaryButtonClass}
                  type="button"
                  onClick={handleCreateStudyCard}
                  disabled={!canManageSelectedSubject || !selectedNoteGroupId || !newStudyCardContent.trim()}
                >
                  Add study card
                </button>
                <button
                  className={outlineButtonClass}
                  type="button"
                  onClick={() => setIsStudyCreateOpen(false)}
                >
                  Cancel
                </button>
              </div>
              {studyCardError ? <p className={errorTextClass}>{studyCardError}</p> : null}
            </div>
          </div>
        </LegacyDialog>
      ) : null}
      {isQuestionCreateOpen ? (
        <LegacyDialog
          open={isQuestionCreateOpen}
          onOpenChange={setIsQuestionCreateOpen}
          title="Create question card"
        >
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Create question card</h2>
                <p className={mutedTextClass}>Build a custom question for this note group.</p>
              </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsQuestionCreateOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="form-block">
              <select
                value={newQuestionType}
                onChange={(event) => setNewQuestionType(event.target.value)}
              >
                <option value="mcq">MCQ</option>
                <option value="multi">Multi-answer</option>
              </select>
              <textarea
                value={newQuestionPrompt}
                onChange={(event) => setNewQuestionPrompt(event.target.value)}
                placeholder="Question prompt"
                rows={3}
              />
              <textarea
                value={newQuestionOptions}
                onChange={(event) => setNewQuestionOptions(event.target.value)}
                placeholder="Options (one per line)"
                rows={4}
              />
              <input
                type="text"
                value={newQuestionCorrectIndices}
                onChange={(event) => setNewQuestionCorrectIndices(event.target.value)}
                placeholder="Correct option indices (comma-separated)"
              />
              <div className="chip-grid">
                {studyCards.map((card) => (
                  <label key={card.id} className="chip-toggle">
                    <input
                      type="checkbox"
                      checked={newQuestionRefs.includes(card.id)}
                      onChange={() =>
                        setNewQuestionRefs((prev) =>
                          prev.includes(card.id)
                            ? prev.filter((id) => id !== card.id)
                            : [...prev, card.id]
                        )
                      }
                    />
                    {card.title || card.id.slice(0, 6)}
                  </label>
                ))}
              </div>
              <div className={buttonRowClass}>
                <button
                  className={primaryButtonClass}
                  type="button"
                  onClick={handleCreateQuestionCard}
                  disabled={!canManageSelectedSubject || !selectedNoteGroupId || !newQuestionPrompt.trim()}
                >
                  Add question card
                </button>
                <button
                  className={outlineButtonClass}
                  type="button"
                  onClick={() => setIsQuestionCreateOpen(false)}
                >
                  Cancel
                </button>
              </div>
              {questionCardError ? <p className={errorTextClass}>{questionCardError}</p> : null}
            </div>
          </div>
        </LegacyDialog>
      ) : null}
      {isSubjectWizardOpen ? (
        <LegacyDialog
          open={isSubjectWizardOpen}
          onOpenChange={setIsSubjectWizardOpen}
          title="Create subject"
          wide
        >
          <div className="intent-wizard">
            <div className="intent-wizard-header">
              <div>
                <h2>Create subject</h2>
                <p className={mutedTextClass}>
                  Describe what you want to study — the AI will suggest a title, goal, and scope.
                </p>
              </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsSubjectWizardOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="intent-wizard-body">
              <div className="intent-wizard-chat">
                <div className="chat">
                  {subjectWizardMessages.length === 0 ? (
                    <p className={smallMutedTextClass}>
                      Tell me what subject you want to study and why. I&apos;ll fill in the fields on the right.
                    </p>
                  ) : (
                    subjectWizardMessages.map((msg, idx) => (
                      <div key={idx} className={`chat-bubble ${msg.role}`}>
                        <p>{msg.content}</p>
                      </div>
                    ))
                  )}
                  {subjectWizardLoading ? (
                    <div className="chat-bubble assistant">
                      <p>Thinking...</p>
                    </div>
                  ) : null}
                </div>
                <div className="chat-input">
                  <textarea
                    value={subjectWizardInput}
                    onChange={(e) => setSubjectWizardInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubjectWizardSend();
                      }
                    }}
                    placeholder="Describe your learning intent..."
                    rows={2}
                    disabled={subjectWizardLoading}
                  />
                  <button
                    className={primaryButtonClass}
                    type="button"
                    onClick={handleSubjectWizardSend}
                    disabled={subjectWizardLoading || !subjectWizardInput.trim()}
                  >
                    Send
                  </button>
                </div>
              </div>
              <div className="intent-wizard-fields">
                <div className="field">
                  <label>Title</label>
                  <input
                    type="text"
                    value={subjectWizardTitle}
                    onChange={(e) => setSubjectWizardTitle(e.target.value)}
                    placeholder="Subject title"
                  />
                </div>
                <div className="field">
                  <label>Goal</label>
                  <textarea
                    value={subjectWizardGoal}
                    onChange={(e) => setSubjectWizardGoal(e.target.value)}
                    placeholder="What does success look like?"
                    rows={3}
                  />
                </div>
                <div className="field">
                  <label>Scope</label>
                  <textarea
                    value={subjectWizardScope}
                    onChange={(e) => setSubjectWizardScope(e.target.value)}
                    placeholder="Concepts and boundaries of study"
                    rows={3}
                  />
                </div>
                {subjectWizardError ? (
                  <p className={errorTextClass}>{subjectWizardError}</p>
                ) : null}
                <button
                  className={primaryButtonClass}
                  type="button"
                  onClick={handleCreateSubjectFromWizard}
                  disabled={!subjectWizardTitle.trim() || subjectWizardCreating}
                >
                  {subjectWizardCreating ? "Creating..." : "Create subject"}
                </button>
              </div>
            </div>
          </div>
        </LegacyDialog>
      ) : null}
      {isModuleWizardOpen ? (
        <LegacyDialog
          open={isModuleWizardOpen}
          onOpenChange={setIsModuleWizardOpen}
          title="Create module"
          wide
        >
          <div className="intent-wizard">
            <div className="intent-wizard-header">
              <div>
                <h2>Create module</h2>
                <p className={mutedTextClass}>
                  Describe what you want to study — the AI will suggest a title, goal, and scope.
                </p>
              </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsModuleWizardOpen(false)}
              >
                Close
              </button>
            </div>
            {selectedSubject ? (
              <div className="wizard-context-banner">
                <span className={smallMutedTextClass}>
                  Subject: <strong>{selectedSubject.title}</strong>
                  {selectedSubject.goal ? ` — ${selectedSubject.goal}` : ""}
                </span>
              </div>
            ) : null}
            <div className="intent-wizard-body">
              <div className="intent-wizard-chat">
                <div className="chat" ref={wizardChatRef}>
                  {moduleWizardMessages.length === 0 ? (
                    <p className={smallMutedTextClass}>
                      Tell me what you want to learn and why. I&apos;ll fill in the fields on the right.
                    </p>
                  ) : (
                    moduleWizardMessages.map((msg, idx) => (
                      <div key={idx} className={`chat-bubble ${msg.role}`}>
                        <p>{msg.content}</p>
                      </div>
                    ))
                  )}
                  {moduleWizardLoading ? (
                    <div className="chat-bubble assistant">
                      <p>Thinking...</p>
                    </div>
                  ) : null}
                </div>
                <div className="chat-input">
                  <textarea
                    value={moduleWizardInput}
                    onChange={(e) => setModuleWizardInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleModuleWizardSend();
                      }
                    }}
                    placeholder="Describe your learning intent..."
                    rows={2}
                    disabled={moduleWizardLoading}
                  />
                  <button
                    className={primaryButtonClass}
                    type="button"
                    onClick={handleModuleWizardSend}
                    disabled={moduleWizardLoading || !moduleWizardInput.trim()}
                  >
                    Send
                  </button>
                </div>
              </div>
              <div className="intent-wizard-fields">
                <div className="field">
                  <label>Title</label>
                  <input
                    type="text"
                    value={moduleWizardTitle}
                    onChange={(e) => setModuleWizardTitle(e.target.value)}
                    placeholder="Module title"
                  />
                </div>
                <div className="field">
                  <label>Goal</label>
                  <textarea
                    value={moduleWizardGoal}
                    onChange={(e) => setModuleWizardGoal(e.target.value)}
                    placeholder="What does success look like?"
                    rows={3}
                  />
                </div>
                <div className="field">
                  <label>Scope</label>
                  <textarea
                    value={moduleWizardScope}
                    onChange={(e) => setModuleWizardScope(e.target.value)}
                    placeholder="Concepts and boundaries of study"
                    rows={3}
                  />
                </div>
                {moduleWizardError ? (
                  <p className={errorTextClass}>{moduleWizardError}</p>
                ) : null}
                <button
                  className={primaryButtonClass}
                  type="button"
                  onClick={handleCreateModuleFromWizard}
                  disabled={!moduleWizardTitle.trim() || moduleWizardCreating || !selectedSubjectId}
                >
                  {moduleWizardCreating ? "Creating..." : "Create module"}
                </button>
              </div>
            </div>
          </div>
        </LegacyDialog>
      ) : null}
      {isSubjectMetadataOpen ? (
        <LegacyDialog
          open={isSubjectMetadataOpen}
          onOpenChange={setIsSubjectMetadataOpen}
          title="Subject settings"
        >
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Subject settings</h2>
                <p className={mutedTextClass}>Manage subject details.</p>
              </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsSubjectMetadataOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="field">
              <label htmlFor="subject-title">Subject title</label>
              <input
                id="subject-title"
                type="text"
                value={subjectTitleDraft}
                onChange={(event) => setSubjectTitleDraft(event.target.value)}
                placeholder="Enter a subject title"
              />
            </div>
            <div className="field">
              <label htmlFor="subject-goal">Learning goal</label>
              <textarea
                id="subject-goal"
                value={subjectGoalDraft}
                onChange={(event) => setSubjectGoalDraft(event.target.value)}
                placeholder="What does success look like for this subject?"
                rows={3}
              />
            </div>
            <div className="field">
              <label htmlFor="subject-scope">Scope</label>
              <textarea
                id="subject-scope"
                value={subjectScopeDraft}
                onChange={(event) => setSubjectScopeDraft(event.target.value)}
                placeholder="Concepts and boundaries of study"
                rows={3}
              />
            </div>
            <div className={buttonRowClass}>
              <button
                className={primaryButtonClass}
                type="button"
                onClick={() => handleSaveSubjectMetadata(editingSubjectId)}
                disabled={subjectMetadataSaving || !subjectTitleDraft.trim()}
              >
                {subjectMetadataSaving ? "Saving..." : "Save settings"}
              </button>
            </div>
            {subjectMetadataError ? <p className={errorTextClass}>{subjectMetadataError}</p> : null}
          </div>
        </LegacyDialog>
      ) : null}
      {isModuleMetadataOpen ? (
        <LegacyDialog
          open={isModuleMetadataOpen}
          onOpenChange={setIsModuleMetadataOpen}
          title="Module settings"
        >
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Module settings</h2>
                <p className={mutedTextClass}>Manage module details and defaults.</p>
              </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsModuleMetadataOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="field">
              <label htmlFor="module-title">Module title</label>
              <input
                id="module-title"
                type="text"
                value={moduleTitleDraft}
                onChange={(event) => setModuleTitleDraft(event.target.value)}
                placeholder="Enter a module title"
              />
            </div>
            <div className="field">
              <label htmlFor="module-description">Module description</label>
              <input
                id="module-description"
                type="text"
                value={moduleDescriptionDraft}
                onChange={(event) => setModuleDescriptionDraft(event.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="field">
              <label htmlFor="module-additional-instructions">
                Default additional generation instructions
              </label>
              <textarea
                id="module-additional-instructions"
                value={moduleAdditionalInstructionsDraft}
                onChange={(event) => setModuleAdditionalInstructionsDraft(event.target.value)}
                placeholder="Optional guidance for study and question generation"
                rows={4}
              />
              <p className={mutedTextClass}>
                Word count: {countWords(moduleAdditionalInstructionsDraft)}/500
              </p>
            </div>
            <div className="field">
              <label htmlFor="module-goal">Learning goal</label>
              <textarea
                id="module-goal"
                value={moduleGoalDraft}
                onChange={(event) => setModuleGoalDraft(event.target.value)}
                placeholder="What does success look like for this module?"
                rows={3}
              />
            </div>
            <div className="field">
              <label htmlFor="module-scope">Scope</label>
              <textarea
                id="module-scope"
                value={moduleScopeDraft}
                onChange={(event) => setModuleScopeDraft(event.target.value)}
                placeholder="Concepts and boundaries of study"
                rows={3}
              />
            </div>
            <div className={buttonRowClass}>
              <button
                className={primaryButtonClass}
                type="button"
                onClick={handleSaveModuleMetadata}
                disabled={moduleMetadataSaving || !moduleTitleDraft.trim()}
              >
                {moduleMetadataSaving ? "Saving..." : "Save settings"}
              </button>
            </div>
            {moduleMetadataError ? <p className={errorTextClass}>{moduleMetadataError}</p> : null}
          </div>
        </LegacyDialog>
      ) : null}
      {isMetadataOpen ? (
        <LegacyDialog
          open={isMetadataOpen}
          onOpenChange={setIsMetadataOpen}
          title="Edit note group metadata"
        >
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Edit note group metadata</h2>
                <p className={mutedTextClass}>
                  Update the title for this note group.
                </p>
              </div>
              <button className={outlineButtonClass} type="button" onClick={() => setIsMetadataOpen(false)}>
                Close
              </button>
            </div>
            <div className="field">
              <label htmlFor="note-group-title">Note group title</label>
              <input
                id="note-group-title"
                type="text"
                value={metadataTitleDraft}
                onChange={(event) => setMetadataTitleDraft(event.target.value)}
                placeholder="Enter a descriptive title"
              />
            </div>
            <div className={buttonRowClass}>
              <button
                className={primaryButtonClass}
                type="button"
                onClick={handleSaveMetadataTitle}
                disabled={metadataSaving || !metadataTitleDraft.trim()}
              >
                {metadataSaving ? "Saving..." : "Save title"}
              </button>
            </div>
            {metadataError ? <p className={errorTextClass}>{metadataError}</p> : null}
          </div>
        </LegacyDialog>
      ) : null}
      <AppShell
        hasSidebar={hasSidebar}
        sidebar={sidebarContent}
        header={
          <PageHeader
            title={pageHeader.title}
            description={pageHeader.description}
            pageType={pageHeader.pageType}
            tone={pageHeader.tone}
            breadcrumbs={pageBreadcrumbs}
            actions={authActions}
          />
        }
        sectionNav={sectionNavItems.length ? <SectionNav items={sectionNavItems} /> : null}
      >
        <>
            {isSubjectManagementOpen && selectedSubject && canManageSelectedSubject ? (
              <SubjectManagementPanel
                subject={selectedSubject}
                currentUser={currentUserProfile}
                isAdmin={isAdmin}
                onSubjectUpdated={handleSubjectUpdated}
                onClose={() => setIsSubjectManagementOpen(false)}
              />
            ) : isAdminPanelOpen && isAdmin ? (
              <AdminPanel
                subjects={subjects}
                selectedSubjectId={selectedSubjectId}
                onSubjectUpdated={handleSubjectUpdated}
                onClose={() => setIsAdminPanelOpen(false)}
              />
            ) : routeRestoreError ? (
              <section className={panelClass}>
                <h2>Unable to restore page</h2>
                <p className={errorTextClass}>{routeRestoreError}</p>
                <p className={mutedTextClass}>
                  The URL points to a page that could not be loaded from the API.
                </p>
              </section>
            ) : !isRestoringRoute && !selectedSubjectId ? (
              <SubjectIndexRouteContent
                subjects={subjects}
                error={sidebarError}
                canCreateSubjects={canCreateSubjects}
                canUseProtectedActions={canUseProtectedActions}
                canMaintainSubject={canMaintainSubject}
                canDeleteSubject={canDeleteSubject}
                onOpenWizard={handleOpenSubjectWizard}
                onSelectSubject={handleSelectSubject}
                onEditSubject={openSubjectMetadataModal}
                onDeleteSubject={handleDeleteSubject}
              />
            ) : isRestoringRoute ? (
              <section className={panelClass}>
                <h2>Fetching page</h2>
                <p className={mutedTextClass}>Loading the subject and module for this URL.</p>
              </section>
            ) : !selectedModuleId ? (
              <ModuleIndexPage
                modules={modules}
                dueCounts={moduleDueCounts}
                subjectDescription={selectedSubject?.description}
                error={sidebarError}
                canManageSelectedSubject={canManageSelectedSubject}
                canUseProtectedActions={canUseProtectedActions}
                onOpenWizard={handleOpenModuleWizard}
                onBack={handleBreadcrumbHome}
                onSelectModule={handleSelectModule}
                onDeleteModule={handleDeleteModule}
              />
            ) : noteGroupMode === "auto" ? (
              <NoteGroupCreate
                uniqueId={noteGroupSource}
                rawText={autoRawText}
                additionalInstructions={autoAdditionalInstructions}
                sourceChecking={sourceChecking}
                sourceConfirmed={isSourceReady}
                sourceDuplicateCount={sourceChecked && !sourceConfirmed ? sourceDuplicateCount : 0}
                sourceDuplicates={sourceDuplicates}
                sourceCheckError={sourceCheckError}
                autoCreateError={autoCreateError}
                autoCreateLoading={autoCreateLoading}
                rawTextDisabled={!selectedModuleId}
                createDisabled={
                  !canManageSelectedSubject || !selectedModuleId || !isSourceReady || !autoRawText.trim()
                }
                additionalInstructionsMeta={`Word count: ${countWords(autoAdditionalInstructions)}/500`}
                onUniqueIdChange={handleUniqueIdChange}
                onGenerateUniqueId={handleUseGeneratedUniqueId}
                onCheckSource={handleCheckSource}
                onConfirmDuplicate={handleConfirmDuplicateSource}
                onRawTextChange={setAutoRawText}
                onAdditionalInstructionsChange={setAutoAdditionalInstructions}
                onCreate={handleAutoCreateNoteGroup}
              />
            ) : (
              <>
                {!selectedNoteGroupId && !selectedTopicId ? (
                  <ModuleHomePage
                    selectedModule={selectedModule}
                    moduleMindMapProps={{
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
                      drilldownGraph:
                        mindMapDrilldown.sourceKey === "module" ? mindMapDrilldown.graph : null,
                      drilldownTitle:
                        mindMapDrilldown.sourceKey === "module"
                          ? `${mindMapDrilldown.title || "Concept"} Mind Map`
                          : "",
                      drilldownLoading:
                        mindMapDrilldown.sourceKey === "module" && mindMapDrilldown.loading,
                      drilldownError:
                        mindMapDrilldown.sourceKey === "module" ? mindMapDrilldown.error : "",
                      onBackFromDrilldown: clearMindMapDrilldown
                    }}
                    moduleStats={moduleStats}
                    moduleStatsLoading={moduleStatsLoading}
                    moduleStatsError={moduleStatsError}
                    moduleQuestionTimeline={moduleQuestionTimeline}
                    moduleNoteGroupsForDisplay={moduleNoteGroupsForDisplay}
                    moduleNoteGroupStatsById={moduleNoteGroupStatsById}
                    chipFilterIds={chipFilterIds}
                    chipOptions={chipOptions}
                    chipFilterValue={chipFilterValue}
                    selectStyles={selectStyles}
                    selectedModuleId={selectedModuleId}
                    canUseProtectedActions={canUseProtectedActions}
                    canManageSelectedSubject={canManageSelectedSubject}
                    isReviewOverlayVisible={isReviewOverlayVisible}
                    moduleGenerationWorkflow={moduleGenerationWorkflow}
                    moduleGenerationWorkflowConnection={moduleGenerationWorkflowConnection}
                    moduleGenerationWorkflowError={moduleGenerationWorkflowError}
                    generationWorkflowStatusLabel={generationWorkflowStatusLabel}
                    generationWorkflowTitle={generationWorkflowTitle}
                    generationWorkflowStageLabel={generationWorkflowStageLabel}
                    reviewCount={reviewCount}
                    isReviewing={isReviewing}
                    reviewError={reviewError}
                    canReorderNoteGroups={canReorderNoteGroups}
                    isReorderingNoteGroups={isReorderingNoteGroups}
                    draggedNoteGroupId={draggedNoteGroupId}
                    dragOverNoteGroupId={dragOverNoteGroupId}
                    generationWorkflowsByNoteGroupId={generationWorkflowsByNoteGroupId}
                    autoJobsByNoteGroupId={autoJobsByNoteGroupId}
                    autoJobActionId={autoJobActionId}
                    classes={{
                      panel: panelClass,
                      mutedText: mutedTextClass,
                      smallMutedText: smallMutedTextClass,
                      errorText: errorTextClass,
                      badge: badgeClass,
                      primaryButton: primaryButtonClass,
                      outlineButton: outlineButtonClass,
                      smallOutlineButton: smallOutlineButtonClass,
                      smallDestructiveOutlineButton: smallDestructiveOutlineButtonClass,
                      buttonRow: buttonRowClass
                    }}
                    onChipFilterSelect={handleChipFilterSelect}
                    onResetChipFilters={handleResetChipFilters}
                    onOpenChat={() => setIsChatOpen(true)}
                    onOpenModuleMetadata={openModuleMetadataModal}
                    onDeleteModule={handleDeleteModule}
                    onReviewCountChange={(event) => setReviewCount(event.target.value)}
                    onStartReview={startReview}
                    onNoteGroupDragOver={handleNoteGroupDragOver}
                    onNoteGroupDragEnter={handleNoteGroupDragEnter}
                    onNoteGroupDrop={handleNoteGroupDrop}
                    onNoteGroupDragEnd={handleNoteGroupDragEnd}
                    onNoteGroupDragStart={handleNoteGroupDragStart}
                    onCancelAutoJob={handleCancelAutoJob}
                    onRetryAutoJob={handleRetryAutoJob}
                    onNavigateToNoteGroup={navigateToNoteGroup}
                  />
                ) : (
                  <StudyScopeRouteContent
                    shouldHoldContent={shouldHoldSelectedNoteGroupContent}
                    selectedNoteGroupWorkflow={selectedNoteGroupWorkflow}
                    moduleGenerationWorkflowConnection={moduleGenerationWorkflowConnection}
                    moduleGenerationWorkflowError={moduleGenerationWorkflowError}
                    autoJobActionId={autoJobActionId}
                    canManageSelectedSubject={canManageSelectedSubject}
                    handleCancelAutoJob={handleCancelAutoJob}
                    handleRetryAutoJob={handleRetryAutoJob}
                    handleDeleteAutoJob={handleDeleteAutoJob}
                    isViewCardsPage={isViewCardsPage}
                    isStudyPage={isStudyPage}
                    isQuestionPage={isQuestionPage}
                    selectedConcept={selectedTopic}
                    selectedConceptId={selectedTopicId}
                    selectedConceptCode={selectedTopicCode}
                    selectedNoteGroup={selectedNoteGroup}
                    selectedNoteGroupId={selectedNoteGroupId}
                    selectedNoteGroupCode={selectedNoteGroupCode}
                    selectedSubjectCode={selectedSubjectCode}
                    selectedModuleCode={selectedModuleCode}
                    conceptMindMap={topicMindMap}
                    conceptMindMapLoading={topicMindMapLoading}
                    conceptMindMapError={topicMindMapError}
                    noteGroupMindMap={noteGroupMindMap}
                    noteGroupMindMapLoading={noteGroupMindMapLoading}
                    noteGroupMindMapError={noteGroupMindMapError}
                    noteGroupMindMapGenerating={noteGroupMindMapGenerating}
                    conceptKnowledgeNodeRegenerating={topicKnowledgeNodeRegenerating}
                    conceptKnowledgeNodeRegeneratingId={topicKnowledgeNodeRegeneratingId}
                    noteGroupNeedsReviewRegenerating={noteGroupNeedsReviewRegenerating}
                    mindMapDrilldown={mindMapDrilldown}
                    noteGroupStats={noteGroupStats}
                    noteGroupStatusMeta={noteGroupStatusMeta}
                    noteGroupProgress={noteGroupProgress}
                    noteGroupProgressLoading={noteGroupProgressLoading}
                    noteGroupProgressError={noteGroupProgressError}
                    progressRange={progressRange}
                    noteGroupCardTable={noteGroupCardTable}
                    noteGroupCardTableLoading={noteGroupCardTableLoading}
                    noteGroupCardTableError={noteGroupCardTableError}
                    conceptCardTableRows={topicCardTableRows}
                    conceptUnlinkedQuestionCount={topicUnlinkedQuestionCount}
                    studyCards={studyCards}
                    filteredStudyCards={filteredStudyCards}
                    questionCards={questionCards}
                    questionCardsForDisplay={questionCardsForDisplay}
                    questionTimeline={questionTimeline}
                    concepts={topicChips}
                    conceptOptions={chipOptions}
                    conceptFilterValue={chipFilterValue}
                    conceptFilterIds={chipFilterIds}
                    noteGroupConceptIds={noteGroupChipIds}
                    selectedModuleId={selectedModuleId}
                    canUseProtectedActions={canUseProtectedActions}
                    canEditCurrentCards={canEditCurrentCards}
                    isReviewing={isReviewing}
                    isReviewOverlayVisible={isReviewOverlayVisible}
                    readingAvailable={readingAvailable}
                    conceptTitleDraft={topicTitleDraft}
                    conceptDescriptionDraft={topicDescriptionDraft}
                    conceptError={topicError}
                    conceptSaving={topicSaving}
                    studyCardError={studyCardError}
                    questionCardError={questionCardError}
                    reviewError={reviewError}
                    questionJobStatus={questionJobStatus}
                    isGeneratingQuestions={isGeneratingQuestions}
                    masteryFilter={masteryFilter}
                    reviewCount={reviewCount}
                    editingStudyCardId={editingStudyCardId}
                    editingStudyCard={editingStudyCard}
                    editingQuestionCardId={editingQuestionCardId}
                    editingQuestionCard={editingQuestionCard}
                    classes={{
                      panel: panelClass,
                      mutedText: mutedTextClass,
                      primaryButton: primaryButtonClass,
                      outlineButton: outlineButtonClass,
                      smallOutlineButton: smallOutlineButtonClass,
                      destructiveOutlineButton: destructiveOutlineButtonClass,
                      buttonRow: buttonRowClass
                    }}
                    selectStyles={selectStyles}
                    navigate={navigate}
                    setIsChatOpen={setIsChatOpen}
                    setIsReadingOpen={setIsReadingOpen}
                    setProgressRange={setProgressRange}
                    setConceptTitleDraft={setTopicTitleDraft}
                    setConceptDescriptionDraft={setTopicDescriptionDraft}
                    setEditingStudyCard={setEditingStudyCard}
                    setEditingStudyCardId={setEditingStudyCardId}
                    setEditingQuestionCard={setEditingQuestionCard}
                    setEditingQuestionCardId={setEditingQuestionCardId}
                    setMasteryFilter={setMasteryFilter}
                    setReviewCount={setReviewCount}
                    handleBackToOverview={handleBackToOverview}
                    handleRegenerateConceptKnowledgeNodes={handleRegenerateTopicKnowledgeNodes}
                    handleGenerateNoteGroupMindMap={handleGenerateNoteGroupMindMap}
                    handleRegenerateNeedsReviewKnowledgeNodes={handleRegenerateNeedsReviewKnowledgeNodes}
                    handleOpenMindMapConcept={handleOpenMindMapTopic}
                    clearMindMapDrilldown={clearMindMapDrilldown}
                    navigateToConcept={navigateToTopic}
                    handleConceptFilterSelect={handleChipFilterSelect}
                    handleResetConceptFilters={handleResetChipFilters}
                    startReview={startReview}
                    openMetadataModal={openMetadataModal}
                    handleDeleteNoteGroup={handleDeleteNoteGroup}
                    handleSaveConcept={handleSaveTopic}
                    handleDeleteConcept={handleDeleteTopic}
                    openStudyCreateModal={openStudyCreateModal}
                    handleEditStudyCard={handleEditStudyCard}
                    handleSaveStudyCard={handleSaveStudyCard}
                    handleDeleteStudyCard={handleDeleteStudyCard}
                    openQuestionCreateModal={openQuestionCreateModal}
                    handleEditQuestionCard={handleEditQuestionCard}
                    handleSaveQuestionCard={handleSaveQuestionCard}
                    handleDeleteQuestionCard={handleDeleteQuestionCard}
                    openQuestionFocus={openQuestionFocus}
                    handleGenerateQuestions={handleGenerateQuestions}
                  />
                )}
              </>
            )}
        </>
      </AppShell>
      <ConfirmActionDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title || ""}
        description={confirmAction?.description || ""}
        confirmLabel={confirmAction?.confirmLabel || "Confirm"}
        onOpenChange={(open) => {
          if (!open) {
            resolveConfirm(false);
          }
        }}
        onConfirm={() => resolveConfirm(true)}
      />
      <Toaster position="bottom-right" richColors />
    </>
  );
}

export { LegacyApp };
