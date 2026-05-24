import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { ModuleIndex } from "@/features/modules/ModuleIndex";
import { AdminPanel } from "@/features/admin/AdminPanel";
import { ModuleOverview } from "@/features/modules/ModuleOverview";
import { MindMapPanel } from "@/features/mind-map/MindMapPanel";
import { NoteGroupCreate } from "@/features/note-groups/NoteGroupCreate";
import { NoteGroupOverview } from "@/features/note-groups/NoteGroupOverview";
import { NoteGroupProgress } from "@/features/note-groups/NoteGroupProgress";
import { NoteGroupViewCards } from "@/features/note-groups/NoteGroupViewCards";
import { QuestionCardList } from "@/features/question-cards/QuestionCardList";
import { ReadingDialog } from "@/features/reading/ReadingDialog";
import { ReviewDialog } from "@/features/review/ReviewDialog";
import { SubjectIndex } from "@/features/subjects/SubjectIndex";
import { SubjectManagementPanel } from "@/features/subjects/SubjectManagementPanel";
import { StudyCardList } from "@/features/study-cards/StudyCardList";
import { TopicOverview } from "@/features/topics/TopicOverview";
import { TutorChatDialog } from "@/features/chat/TutorChatDialog";
import { isAuthReadyForRouteRestore } from "@/routes/routeRestore";
import {
  createNoteGroupPath,
  matchAppRoute,
  modulePath,
  noteGroupPath,
  subjectPath,
  topicPath
} from "@/lib/routes";
import {
  countWords,
  formatAnswerLabels,
  formatCreatedAt,
  getModuleAdditionalInstructions,
  getNoteGroupStatusMeta,
  normalizeNoteGroupProgress,
  normalizeNoteGroups,
  normalizeTimeline
} from "@/lib/format";
import { buildReviewCard, getMasteryScore, getMasteryTier } from "@/lib/review";
import { renderCleanedMarkdown, renderMarkdownBlocks } from "@/lib/text-rendering";
import {
  attachTopicChips,
  autoCreateNoteGroup,
  cancelJob,
  checkNoteGroupSource,
  createModule,
  createQuestionCard,
  createStudyCard,
  createSubject,
  createTopicChip,
  deleteModule,
  deleteNoteGroup,
  deleteQuestionCard,
  deleteStudyCard,
  deleteSubject,
  deleteTopic,
  detachTopicChip,
  generateNoteGroupMindMap,
  generateQuestionCards,
  getCurrentUser,
  getNoteGroupCardTable,
  getJob,
  getModule,
  getModuleMindMap,
  getModuleOverview,
  getModuleQuestionTimeline,
  getNoteGroupMindMap,
  getNoteGroupProgress,
  getNoteGroupQuestionTimeline,
  getNoteGroup,
  getStudyCard,
  getTopic,
  getTopicQuestionTimeline,
  listJobs,
  listAllModules,
  listModuleReviewQuestionCards,
  listModules,
  listPublicSubjects,
  listQuestionCards,
  listReviewQuestionCards,
  listStudyCards,
  listSubjects,
  listTopicChips,
  listTopicQuestionCards,
  listTopicReviewQuestionCards,
  listTopicStudyCards,
  retryAutoJob,
  resolveAppModuleRoute,
  resolveAppNoteGroupRoute,
  resolveAppSubjectRoute,
  resolveAppTopicRoute,
  reviewQuestionCard,
  sendChat,
  sendModuleIntentChat,
  sendSubjectIntentChat,
  updateNoteGroupOrder,
  updateNoteGroupTitle,
  updateQuestionCard,
  updateStudyCard,
  updateModule,
  updateSubject,
  updateTopic
} from "./api";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generateUniqueId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const parseOptions = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const parseIndices = (text) =>
  text
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 0);

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

const withRouteRestoreTimeout = (promise, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out`)), 8000);
    })
  ]);

const resolveModuleForRouteRestore = async (moduleId) => {
  try {
    return await withRouteRestoreTimeout(getModule(moduleId), "Module restore");
  } catch (error) {
    const modules = await withRouteRestoreTimeout(listAllModules(), "Module list restore");
    const module = modules.find((item) => item.id === moduleId);
    if (!module) {
      throw error;
    }
    return module;
  }
};

const showFetchToast = (error, fallback) => {
  toast.error(error?.message || fallback);
};

export default function App() {
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

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
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

  const [modules, setModules] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
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
  const [moduleTitleDraft, setModuleTitleDraft] = useState("");
  const [moduleDescriptionDraft, setModuleDescriptionDraft] = useState("");
  const [moduleAdditionalInstructionsDraft, setModuleAdditionalInstructionsDraft] = useState("");
  const [moduleGoalDraft, setModuleGoalDraft] = useState("");
  const [moduleScopeDraft, setModuleScopeDraft] = useState("");
  const [moduleMetadataSaving, setModuleMetadataSaving] = useState(false);
  const [moduleMetadataError, setModuleMetadataError] = useState("");
  const [moduleDueCounts, setModuleDueCounts] = useState({});
  const [noteGroups, setNoteGroups] = useState([]);
  const [moduleNoteGroupStats, setModuleNoteGroupStats] = useState([]);
  const [moduleStats, setModuleStats] = useState({
    studyCount: 0,
    questionCount: 0,
    dueCount: 0,
    staleCount: 0
  });
  const [moduleQuestionTimeline, setModuleQuestionTimeline] = useState({
    due: 0,
    week: 0,
    month: 0,
    sixMonths: 0,
    longTerm: 0
  });
  const [moduleStatsLoading, setModuleStatsLoading] = useState(false);
  const [moduleStatsError, setModuleStatsError] = useState("");
  const [moduleMindMap, setModuleMindMap] = useState(null);
  const [moduleMindMapLoading, setModuleMindMapLoading] = useState(false);
  const [moduleMindMapError, setModuleMindMapError] = useState("");
  const [selectedNoteGroupId, setSelectedNoteGroupId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [sidebarScope, setSidebarScope] = useState("note-groups");
  const [noteGroupSource, setNoteGroupSource] = useState("");
  const [sourceChecking, setSourceChecking] = useState(false);
  const [sourceChecked, setSourceChecked] = useState(false);
  const [sourceConfirmed, setSourceConfirmed] = useState(false);
  const [sourceDuplicateCount, setSourceDuplicateCount] = useState(0);
  const [sourceDuplicates, setSourceDuplicates] = useState([]);
  const [sourceCheckError, setSourceCheckError] = useState("");
  const [noteGroupSearch, setNoteGroupSearch] = useState("");
  const [noteGroupMode, setNoteGroupMode] = useState("overview");
  const [routeRestoreError, setRouteRestoreError] = useState("");
  const [resolvedRouteContext, setResolvedRouteContext] = useState(null);
  const [formattedSections, setFormattedSections] = useState([]);
  const [cleanedTextMarkdown, setCleanedTextMarkdown] = useState("");
  const [readingMode, setReadingMode] = useState("study");
  const [readingHoverCardId, setReadingHoverCardId] = useState("");
  const [readingPinnedCardId, setReadingPinnedCardId] = useState("");
  const [questionTimeline, setQuestionTimeline] = useState({
    due: 0,
    week: 0,
    month: 0,
    sixMonths: 0,
    longTerm: 0
  });
  const [progressRange, setProgressRange] = useState("30d");
  const [noteGroupProgress, setNoteGroupProgress] = useState(normalizeNoteGroupProgress());
  const [noteGroupProgressLoading, setNoteGroupProgressLoading] = useState(false);
  const [noteGroupProgressError, setNoteGroupProgressError] = useState("");
  const [noteGroupCardTable, setNoteGroupCardTable] = useState({
    rows: [],
    unlinked_question_count: 0,
  });
  const [noteGroupCardTableLoading, setNoteGroupCardTableLoading] = useState(false);
  const [noteGroupCardTableError, setNoteGroupCardTableError] = useState("");
  const [noteGroupMindMap, setNoteGroupMindMap] = useState(null);
  const [noteGroupMindMapLoading, setNoteGroupMindMapLoading] = useState(false);
  const [noteGroupMindMapError, setNoteGroupMindMapError] = useState("");
  const [noteGroupMindMapGenerating, setNoteGroupMindMapGenerating] = useState(false);
  const [mindMapRefreshToken, setMindMapRefreshToken] = useState(0);
  const [isReadingOpen, setIsReadingOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [metadataTitleDraft, setMetadataTitleDraft] = useState("");
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataError, setMetadataError] = useState("");

  const [topicChips, setTopicChips] = useState([]);
  const [topicSearch, setTopicSearch] = useState("");
  const [topicTitleDraft, setTopicTitleDraft] = useState("");
  const [topicDescriptionDraft, setTopicDescriptionDraft] = useState("");
  const [topicSaving, setTopicSaving] = useState(false);
  const [topicError, setTopicError] = useState("");
  const [chipFilterIds, setChipFilterIds] = useState([]);
  const [noteGroupChipIds, setNoteGroupChipIds] = useState([]);
  const [moduleChipLabel, setModuleChipLabel] = useState("");
  const [moduleChipDescription, setModuleChipDescription] = useState("");

  const [autoRawText, setAutoRawText] = useState("");
  const [autoAdditionalInstructions, setAutoAdditionalInstructions] = useState("");
  const [autoCreateLoading, setAutoCreateLoading] = useState(false);
  const [autoCreateError, setAutoCreateError] = useState("");
  const [sidebarError, setSidebarError] = useState("");
  const [draggedNoteGroupId, setDraggedNoteGroupId] = useState("");
  const [dragOverNoteGroupId, setDragOverNoteGroupId] = useState("");
  const [isReorderingNoteGroups, setIsReorderingNoteGroups] = useState(false);
  const [autoJobsByNoteGroupId, setAutoJobsByNoteGroupId] = useState({});
  const [autoJobActionId, setAutoJobActionId] = useState("");

  const [studyCards, setStudyCards] = useState([]);
  const [studyCardError, setStudyCardError] = useState("");
  const [newStudyCardTitle, setNewStudyCardTitle] = useState("");
  const [newStudyCardContent, setNewStudyCardContent] = useState("");
  const [newStudyCardChipIds, setNewStudyCardChipIds] = useState([]);
  const [isStudyCreateOpen, setIsStudyCreateOpen] = useState(false);
  const [editingStudyCardId, setEditingStudyCardId] = useState("");
  const [editingStudyCard, setEditingStudyCard] = useState({
    title: "",
    content: "",
    chipIds: []
  });

  const [questionCards, setQuestionCards] = useState([]);
  const [questionCardError, setQuestionCardError] = useState("");
  const [questionJobStatus, setQuestionJobStatus] = useState("idle");
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isQuestionCreateOpen, setIsQuestionCreateOpen] = useState(false);
  const [masteryFilter, setMasteryFilter] = useState("all");
  const [isQuestionFocusOpen, setIsQuestionFocusOpen] = useState(false);
  const [focusQuestionCardId, setFocusQuestionCardId] = useState("");
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState("due");
  const [reviewScope, setReviewScope] = useState("note-group");
  const [reviewCount, setReviewCount] = useState(10);
  const [reviewError, setReviewError] = useState("");
  const [reviewAnswer, setReviewAnswer] = useState([]);
  const [reviewStartTime, setReviewStartTime] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState(null);
  const [reviewExplanationOpen, setReviewExplanationOpen] = useState([]);
  const [reviewDeleteStep, setReviewDeleteStep] = useState(0);
  const [reviewDeleteLoading, setReviewDeleteLoading] = useState(false);
  const [reviewStats, setReviewStats] = useState({
    correct: 0,
    incorrect: 0,
    answered: 0,
    total: 0,
    totalMs: 0
  });
  const [reviewRefreshToken, setReviewRefreshToken] = useState(0);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviewChatMessages, setReviewChatMessages] = useState([]);
  const [reviewChatInput, setReviewChatInput] = useState("");
  const [reviewChatError, setReviewChatError] = useState("");
  const [reviewChatLoading, setReviewChatLoading] = useState(false);
  const [reviewChatView, setReviewChatView] = useState("chat");
  const [reviewChatCardId, setReviewChatCardId] = useState("");
  const [reviewChatCardCache, setReviewChatCardCache] = useState({});
  const [reviewChatCardLoading, setReviewChatCardLoading] = useState(false);
  const [reviewChatCardError, setReviewChatCardError] = useState("");
  const [newQuestionType, setNewQuestionType] = useState("mcq");
  const [newQuestionPrompt, setNewQuestionPrompt] = useState("");
  const [newQuestionOptions, setNewQuestionOptions] = useState("");
  const [newQuestionCorrectIndices, setNewQuestionCorrectIndices] = useState("");
  const [newQuestionRefs, setNewQuestionRefs] = useState([]);
  const [editingQuestionCardId, setEditingQuestionCardId] = useState("");
  const [editingQuestionCard, setEditingQuestionCard] = useState({
    type: "mcq",
    prompt: "",
    optionsText: "",
    correctIndicesText: "",
    refs: []
  });

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatView, setChatView] = useState("chat");
  const [chatCardId, setChatCardId] = useState("");
  const [chatCardCache, setChatCardCache] = useState({});
  const [chatCardLoading, setChatCardLoading] = useState(false);
  const [chatCardError, setChatCardError] = useState("");
  const readingContentRef = useRef(null);
  const chatListRef = useRef(null);
  const reviewChatListRef = useRef(null);
  const wizardChatRef = useRef(null);
  const confirmResolverRef = useRef(null);
  const selectedSubjectIdRef = useRef(selectedSubjectId);
  const selectedModuleIdRef = useRef(selectedModuleId);
  const selectedNoteGroupIdRef = useRef(selectedNoteGroupId);
  const activeAutoJobsRef = useRef(new Set());
  const reviewDKeyTimeRef = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState(null);
  const routeMatch = matchAppRoute(location.pathname);
  const routeSubjectPageCode = routeMatch.subjectPage ? routeMatch.subjectCode : "";
  const routeSubjectCode = routeMatch.subjectCode;
  const routeModuleCode = routeMatch.moduleCode;
  const routeNoteGroupCode = routeMatch.noteGroupCode;
  const routeTopicCode = routeMatch.topicCode;
  const routePanel = routeMatch.panel || (routeMatch.noteGroup || routeMatch.topic ? "overview" : "");
  const routeCreateNoteGroup = routeMatch.isCreateNoteGroup;
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
    (!routeTopicCode || resolvedRouteContext.topic_short_code === routeTopicCode);
  const routeSubjectId = resolvedRouteMatches ? resolvedRouteContext.subject_id : "";
  const routeModuleId = resolvedRouteMatches ? resolvedRouteContext.module_id || "" : "";
  const routeNoteGroupId = resolvedRouteMatches
    ? resolvedRouteContext.note_group_id || ""
    : "";
  const routeTopicId = resolvedRouteMatches ? resolvedRouteContext.topic_id || "" : "";
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
  const isRestoringRoute = hasUnresolvedRouteTarget && !routeRestoreError;

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

  useEffect(() => {
    if (!selectedSubjectId || subjects.some((subject) => subject.id === selectedSubjectId)) {
      return;
    }
    setSelectedSubjectId("");
    setSelectedModuleId("");
    setSelectedNoteGroupId("");
    setSelectedTopicId("");
    setNoteGroupMode("overview");
    navigate("/");
  }, [navigate, selectedSubjectId, subjects]);

  useEffect(() => {
    if (!canManageSelectedSubject) {
      setIsSubjectManagementOpen(false);
      setAutoJobsByNoteGroupId({});
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
    isTopicScope
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
        shortCode: topic.short_code
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
  const currentReviewCard = reviewQueue[reviewIndex];
  const reviewCardType = useMemo(() => {
    if (!currentReviewCard) {
      return "mcq";
    }
    const correctIndices =
      currentReviewCard.reviewCorrectIndices ||
      currentReviewCard.correct_option_indices ||
      [];
    if (currentReviewCard.type === "mcq" && correctIndices.length > 1) {
      return "multi";
    }
    return currentReviewCard.type || "mcq";
  }, [currentReviewCard]);
  const reviewNoteGroupId =
    reviewScope === "module" || reviewScope === "topic"
      ? currentReviewCard?.note_group_id
      : selectedNoteGroupId;
  const reviewCardRefs = currentReviewCard?.study_card_refs || [];
  const reviewRefsMessage = reviewCardRefs.length
    ? "The relevant study cards are:"
    : "The relevant study cards are: no study card is linked to this question.";
  const isReviewOverlayVisible = isReviewing || Boolean(reviewSummary);
  const isSourceReady = sourceConfirmed;
  const canReorderNoteGroups = Boolean(
    selectedModuleId &&
      canManageSelectedSubject &&
      !selectedNoteGroupId &&
      !selectedTopicId &&
      !chipFilterIds.length &&
      !moduleStatsLoading &&
      !isReviewOverlayVisible &&
      !isReorderingNoteGroups
  );
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
    if (auth.loading) {
      return;
    }
    let cancelled = false;
    const loadSubjects = auth.isAuthenticated ? listSubjects : listPublicSubjects;
    loadSubjects()
      .then((data) => {
        if (!cancelled) {
          setSubjects(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          showFetchToast(error, "Failed to load subjects");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, auth.loading, auth.user?.id]);

  useEffect(() => {
    setResolvedRouteContext(null);
  }, [routeSubjectCode, routeModuleCode, routeNoteGroupCode, routeTopicCode, routeCreateNoteGroup]);

  useEffect(() => {
    if (!isAuthReadyForRouteRestore(auth)) {
      return;
    }
    if (!routeSubjectPageCode) {
      return;
    }
    let cancelled = false;
    setRouteRestoreError("");
    const restoreSubjectRoute = async () => {
      try {
        const context = await withRouteRestoreTimeout(
          resolveAppSubjectRoute(routeSubjectPageCode),
          "Subject route restore"
        );
        if (cancelled) {
          return;
        }
        setResolvedRouteContext(context);
        setSelectedSubjectId(context.subject_id);
        setSelectedModuleId("");
        setSelectedNoteGroupId("");
        setSelectedTopicId("");
        setSidebarScope("note-groups");
        setNoteGroupMode("overview");
        setReviewSummary(null);
        setIsChatOpen(false);
        setIsMetadataOpen(false);
        setIsModuleMetadataOpen(false);
      } catch (error) {
        if (!cancelled) {
          setRouteRestoreError(error.message || "Unable to restore subject page");
          showFetchToast(error, "Failed to restore subject page");
        }
      }
    };
    restoreSubjectRoute();
    return () => {
      cancelled = true;
    };
  }, [auth.loading, routeSubjectPageCode]);

  useEffect(() => {
    if (!isAuthReadyForRouteRestore(auth)) {
      return;
    }
    if (!routeModuleCode || routeNoteGroupCode || routeTopicCode) {
      return;
    }
    let cancelled = false;
    setRouteRestoreError("");
    const restoreModuleRoute = async () => {
      try {
        const context = await withRouteRestoreTimeout(
          resolveAppModuleRoute(routeSubjectCode, routeModuleCode),
          "Module route restore"
        );
        if (cancelled) {
          return;
        }
        setResolvedRouteContext(context);
        setSelectedSubjectId(context.subject_id);
        setSelectedModuleId(context.module_id);
        setSelectedNoteGroupId("");
        setSelectedTopicId("");
        setSidebarScope("note-groups");
        setNoteGroupMode(routeCreateNoteGroup ? "auto" : "overview");
        setReviewSummary(null);
        setIsChatOpen(false);
        setIsMetadataOpen(false);
        setIsModuleMetadataOpen(false);
      } catch (error) {
        if (!cancelled) {
          setRouteRestoreError(error.message || "Unable to restore module page");
          showFetchToast(error, "Failed to restore module page");
        }
      }
    };
    restoreModuleRoute();
    return () => {
      cancelled = true;
    };
  }, [
    auth.loading,
    routeSubjectCode,
    routeModuleCode,
    routeNoteGroupCode,
    routeTopicCode,
    routeCreateNoteGroup
  ]);

  useEffect(() => {
    if (!isAuthReadyForRouteRestore(auth)) {
      return;
    }
    if (!routeTopicCode) {
      return;
    }
    let cancelled = false;
    setRouteRestoreError("");
    const restoreTopicRoute = async () => {
      try {
        const context = await withRouteRestoreTimeout(
          resolveAppTopicRoute(routeSubjectCode, routeModuleCode, routeTopicCode),
          "Topic route restore"
        );
        if (cancelled) {
          return;
        }
        setResolvedRouteContext(context);
        setSelectedSubjectId(context.subject_id);
        setSelectedModuleId(context.module_id);
        setSelectedNoteGroupId("");
        setSelectedTopicId(context.topic_id);
        setSidebarScope("topics");
        setChipFilterIds([]);
        setNoteGroupMode("overview");
        setReviewSummary(null);
        setIsChatOpen(false);
        setIsMetadataOpen(false);
        setIsModuleMetadataOpen(false);
      } catch (error) {
        if (!cancelled) {
          setRouteRestoreError(error.message || "Unable to restore topic page");
          showFetchToast(error, "Failed to restore topic page");
        }
      }
    };
    restoreTopicRoute();
    return () => {
      cancelled = true;
    };
  }, [auth.loading, routeSubjectCode, routeModuleCode, routeTopicCode]);

  useEffect(() => {
    if (!selectedSubjectId) {
      setModules([]);
      setSelectedModuleId("");
      return;
    }
    listModules(selectedSubjectId)
      .then((data) => {
        setModules(data);
      })
      .catch((error) => showFetchToast(error, "Failed to load modules"));
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
    listTopicChips(selectedModuleId)
      .then((data) => {
        setTopicChips(data);
        if (!routeTopicId) {
          setSelectedTopicId((currentId) =>
            currentId && !data.some((topic) => topic.id === currentId) ? "" : currentId
          );
        }
      })
      .catch((error) => showFetchToast(error, "Failed to load topics"));
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
    if (!selectedModuleId) {
      setNoteGroups([]);
      if (!routeNoteGroupId) {
        setSelectedNoteGroupId("");
      }
      if (!routeTopicId) {
        setSelectedTopicId("");
      }
      setModuleNoteGroupStats([]);
      setModuleStats({
        studyCount: 0,
        questionCount: 0,
        dueCount: 0,
        staleCount: 0
      });
      setModuleQuestionTimeline({
        due: 0,
        week: 0,
        month: 0,
        sixMonths: 0,
        longTerm: 0
      });
      setModuleStatsError("");
      setModuleStatsLoading(false);
      return;
    }
    let cancelled = false;
    const loadModuleOverview = async () => {
      setModuleStatsLoading(true);
      setModuleStatsError("");
      try {
        const data = await getModuleOverview(selectedModuleId, chipFilterIds);
        if (cancelled) {
          return;
        }
        const groups = normalizeNoteGroups(data.note_groups || []);
        const stats = (data.note_group_stats || []).map((group) => {
          const timeline = normalizeTimeline(group.timeline);
          return {
            id: group.id,
            title: group.title || "Untitled note group",
            studyCount: group.study_count || 0,
            questionCount: group.question_count || 0,
            dueCount: group.due_count || timeline.due,
            staleCount: group.stale_count || 0,
            timeline
          };
        });
        const moduleOverviewStats = data.module_stats || {};
        setNoteGroups(groups);
        setSelectedNoteGroupId((currentId) => {
          if (!routeNoteGroupId && currentId && !groups.some((group) => group.id === currentId)) {
            return "";
          }
          return currentId;
        });
        setModuleNoteGroupStats(stats);
        setModuleStats({
          studyCount: moduleOverviewStats.study_count || 0,
          questionCount: moduleOverviewStats.question_count || 0,
          dueCount: moduleOverviewStats.due_count || 0,
          staleCount: moduleOverviewStats.stale_count || 0
        });
        setModuleQuestionTimeline(normalizeTimeline(data.module_timeline));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setNoteGroups([]);
        setModuleNoteGroupStats([]);
        setModuleStats({
          studyCount: 0,
          questionCount: 0,
          dueCount: 0,
          staleCount: 0
        });
        setModuleQuestionTimeline({
          due: 0,
          week: 0,
          month: 0,
          sixMonths: 0,
          longTerm: 0
        });
        setModuleStatsError(error.message || "Failed to load module overview");
        showFetchToast(error, "Failed to load note groups");
      } finally {
        if (!cancelled) {
          setModuleStatsLoading(false);
        }
      }
    };
    loadModuleOverview();
    return () => {
      cancelled = true;
    };
  }, [selectedModuleId, chipFilterIds, reviewRefreshToken]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedModuleId || selectedNoteGroupId || selectedTopicId || noteGroupMode === "auto") {
      setModuleMindMap(null);
      setModuleMindMapError("");
      setModuleMindMapLoading(false);
      return () => {
        cancelled = true;
      };
    }
    const loadModuleMindMap = async () => {
      setModuleMindMapLoading(true);
      setModuleMindMapError("");
      try {
        const data = await getModuleMindMap(selectedModuleId);
        if (!cancelled) {
          setModuleMindMap(data);
        }
      } catch (error) {
        if (!cancelled) {
          setModuleMindMap(null);
          setModuleMindMapError(error.message || "Failed to load module Mind Map");
        }
      } finally {
        if (!cancelled) {
          setModuleMindMapLoading(false);
        }
      }
    };
    loadModuleMindMap();
    return () => {
      cancelled = true;
    };
  }, [selectedModuleId, selectedNoteGroupId, selectedTopicId, noteGroupMode, mindMapRefreshToken]);

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
      setSidebarScope("topics");
      setChipFilterIds([]);
    }
  }, [routeTopicId, selectedModuleId, selectedTopicId, topicChips]);

  useEffect(() => {
    if (!selectedModuleId || !canManageSelectedSubject) {
      return;
    }
    loadAutoJobs(selectedModuleId).catch((error) => {
      if (error.message === "Not Found") {
        return;
      }
      toast.error(error.message || "Failed to check note group creation jobs.");
    });
  }, [selectedModuleId, canManageSelectedSubject]);

  useEffect(() => {
    if (!selectedNoteGroupId && !selectedTopicId) {
      setStudyCards([]);
      setQuestionCards([]);
      setNoteGroupChipIds([]);
      setMetadataTitleDraft("");
      setTopicTitleDraft("");
      setTopicDescriptionDraft("");
      setFormattedSections([]);
      setCleanedTextMarkdown("");
      return;
    }
    setStudyCardError("");
    setQuestionCardError("");
    setQuestionJobStatus("idle");
    let cancelled = false;
    const loadScope = async () => {
      try {
        if (selectedTopicId) {
          const topic = await withRouteRestoreTimeout(
            getTopic(selectedTopicId),
            "Topic restore"
          );
          if (cancelled) {
            return;
          }
          setTopicTitleDraft(topic.label || "");
          setTopicDescriptionDraft(topic.description || "");
          setFormattedSections([]);
          setCleanedTextMarkdown("");
          setNoteGroupChipIds([]);
        } else {
          const data = await withRouteRestoreTimeout(
            getNoteGroup(selectedNoteGroupId),
            "Note group restore"
          );
          if (cancelled) {
            return;
          }
          setNoteGroupChipIds((data.topic_chips || []).map((chip) => chip.id));
          setMetadataTitleDraft(data.title || "");
          setFormattedSections(data.formatted_sections || []);
          setCleanedTextMarkdown(data.cleaned_text_markdown || "");
          if (data.subject_id && data.module_id) {
            setSelectedSubjectId(data.subject_id);
            setSelectedModuleId(data.module_id);
            setRouteRestoreError("");
            return;
          }
          if (
            data.module_id &&
            (selectedModuleIdRef.current !== data.module_id || !selectedSubjectIdRef.current)
          ) {
            const module = await resolveModuleForRouteRestore(data.module_id);
            if (cancelled) {
              return;
            }
            setSelectedSubjectId(module.subject_id);
            setSelectedModuleId(module.id);
            setRouteRestoreError("");
          }
        }
      } catch (error) {
        if (!cancelled) {
          if (routeNoteGroupId === selectedNoteGroupId) {
            setRouteRestoreError(error.message || "Unable to restore note group page");
          } else if (routeTopicId === selectedTopicId) {
            setRouteRestoreError(error.message || "Unable to restore topic page");
          }
          setStudyCardError(error.message);
        }
      }
    };
    loadScope();
    const studyRequest = selectedTopicId
      ? listTopicStudyCards(selectedTopicId)
      : listStudyCards(selectedNoteGroupId);
    studyRequest
      .then((data) => setStudyCards(data.study_cards || []))
      .catch((error) => setStudyCardError(error.message));
    const questionRequest = selectedTopicId
      ? listTopicQuestionCards(selectedTopicId)
      : listQuestionCards(selectedNoteGroupId);
    questionRequest
      .then((data) => setQuestionCards(data.question_cards || []))
      .catch((error) => setQuestionCardError(error.message));
    return () => {
      cancelled = true;
    };
  }, [selectedNoteGroupId, selectedTopicId, routeNoteGroupId, routeTopicId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedNoteGroupId || selectedTopicId) {
      setNoteGroupMindMap(null);
      setNoteGroupMindMapError("");
      setNoteGroupMindMapLoading(false);
      setNoteGroupMindMapGenerating(false);
      return () => {
        cancelled = true;
      };
    }
    const loadNoteGroupMindMap = async () => {
      setNoteGroupMindMapLoading(true);
      setNoteGroupMindMapError("");
      try {
        const data = await getNoteGroupMindMap(selectedNoteGroupId);
        if (!cancelled) {
          setNoteGroupMindMap(data);
        }
      } catch (error) {
        if (!cancelled) {
          setNoteGroupMindMap(null);
          setNoteGroupMindMapError(error.message || "Failed to load Note Group Mind Map");
        }
      } finally {
        if (!cancelled) {
          setNoteGroupMindMapLoading(false);
        }
      }
    };
    loadNoteGroupMindMap();
    return () => {
      cancelled = true;
    };
  }, [selectedNoteGroupId, selectedTopicId, mindMapRefreshToken]);

  useEffect(() => {
    if (!isReadingOpen) {
      setReadingHoverCardId("");
      setReadingPinnedCardId("");
      setReadingMode("study");
    }
  }, [isReadingOpen]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedNoteGroupId && !selectedTopicId) {
      setQuestionTimeline({
        due: 0,
        week: 0,
        month: 0,
        sixMonths: 0,
        longTerm: 0
      });
      return () => {
        cancelled = true;
      };
    }
    const loadTimeline = async () => {
      try {
        const data = selectedTopicId
          ? await getTopicQuestionTimeline(selectedTopicId)
          : await getNoteGroupQuestionTimeline(selectedNoteGroupId, chipFilterIds);
        if (cancelled) {
          return;
        }
        setQuestionTimeline(normalizeTimeline(data.timeline));
      } catch (error) {
        if (!cancelled) {
          setQuestionTimeline({
            due: 0,
            week: 0,
            month: 0,
            sixMonths: 0,
            longTerm: 0
          });
        }
      }
    };
    loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [selectedNoteGroupId, selectedTopicId, chipFilterIds, questionCards, reviewRefreshToken]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedNoteGroupId || selectedTopicId) {
      setNoteGroupProgress(normalizeNoteGroupProgress());
      setNoteGroupProgressError("");
      setNoteGroupProgressLoading(false);
      return () => {
        cancelled = true;
      };
    }
    const loadProgress = async () => {
      setNoteGroupProgressLoading(true);
      setNoteGroupProgressError("");
      try {
        const data = await getNoteGroupProgress(selectedNoteGroupId, progressRange, chipFilterIds);
        if (!cancelled) {
          setNoteGroupProgress(normalizeNoteGroupProgress(data));
        }
      } catch (error) {
        if (!cancelled) {
          setNoteGroupProgress(normalizeNoteGroupProgress());
          setNoteGroupProgressError(error.message || "Failed to load progress");
        }
      } finally {
        if (!cancelled) {
          setNoteGroupProgressLoading(false);
        }
      }
    };
    loadProgress();
    return () => {
      cancelled = true;
    };
  }, [selectedNoteGroupId, selectedTopicId, progressRange, chipFilterIds, reviewRefreshToken]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedNoteGroupId || selectedTopicId || !isViewCardsPage) {
      setNoteGroupCardTable({ rows: [], unlinked_question_count: 0 });
      setNoteGroupCardTableError("");
      setNoteGroupCardTableLoading(false);
      return () => {
        cancelled = true;
      };
    }
    const loadCardTable = async () => {
      setNoteGroupCardTableLoading(true);
      setNoteGroupCardTableError("");
      try {
        const data = await getNoteGroupCardTable(selectedNoteGroupId);
        if (!cancelled) {
          setNoteGroupCardTable({
            rows: data.rows || [],
            unlinked_question_count: data.unlinked_question_count || 0,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setNoteGroupCardTable({ rows: [], unlinked_question_count: 0 });
          setNoteGroupCardTableError(error.message || "Failed to load View Cards");
        }
      } finally {
        if (!cancelled) {
          setNoteGroupCardTableLoading(false);
        }
      }
    };
    loadCardTable();
    return () => {
      cancelled = true;
    };
  }, [selectedNoteGroupId, selectedTopicId, isViewCardsPage]);

  useEffect(() => {
    setChatMessages([]);
    setChatError("");
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
    setReviewQueue([]);
    setReviewIndex(0);
    setReviewError("");
    setReviewAnswer([]);
    setReviewExplanationOpen([]);
    setReviewStartTime(null);
    setIsReviewing(false);
    setReviewFeedback(null);
    setReviewSummary(null);
    setReviewScope(selectedTopicId ? "topic" : "note-group");
    setReviewDeleteStep(0);
    setReviewDeleteLoading(false);
  }, [selectedNoteGroupId, selectedTopicId, selectedModuleId]);

  useEffect(() => {
    setReviewChatMessages([]);
    setReviewChatInput("");
    setReviewChatError("");
    setReviewChatLoading(false);
    setReviewChatView("chat");
    setReviewChatCardId("");
    setReviewChatCardLoading(false);
    setReviewChatCardError("");
    setReviewDeleteStep(0);
    setReviewDeleteLoading(false);
    setReviewExplanationOpen([]);
  }, [reviewIndex, reviewSummary, selectedNoteGroupId, selectedTopicId, selectedModuleId]);

  useEffect(() => {
    if (!isChatOpen) {
      return;
    }
    const container = chatListRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [chatMessages, isChatOpen]);

  useEffect(() => {
    if (!isChatOpen) {
      return;
    }
    setChatView("chat");
    setChatCardId("");
    setChatCardLoading(false);
    setChatCardError("");
  }, [isChatOpen]);

  useEffect(() => {
    if (reviewChatView !== "chat") {
      return;
    }
    const container = reviewChatListRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [reviewChatMessages, reviewChatView]);

  useEffect(() => {
    if (wizardChatRef.current) {
      wizardChatRef.current.scrollTop = wizardChatRef.current.scrollHeight;
    }
  }, [moduleWizardMessages]);

  useEffect(() => {
    selectedSubjectIdRef.current = selectedSubjectId;
  }, [selectedSubjectId]);

  useEffect(() => {
    selectedModuleIdRef.current = selectedModuleId;
  }, [selectedModuleId]);

  useEffect(() => {
    selectedNoteGroupIdRef.current = selectedNoteGroupId;
  }, [selectedNoteGroupId]);

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
    if (!isAuthReadyForRouteRestore(auth)) {
      return;
    }
    if (!routeNoteGroupCode) {
      return;
    }
    let cancelled = false;
    setRouteRestoreError("");
    setNoteGroupMode("overview");
    const restoreNoteGroupRoute = async () => {
      try {
        const context = await withRouteRestoreTimeout(
          resolveAppNoteGroupRoute(routeSubjectCode, routeModuleCode, routeNoteGroupCode),
          "Note group route restore"
        );
        if (cancelled) {
          return;
        }
        setResolvedRouteContext(context);
        setSelectedSubjectId(context.subject_id);
        setSelectedModuleId(context.module_id);
        setSelectedNoteGroupId(context.note_group_id);
      } catch (error) {
        if (!cancelled) {
          setRouteRestoreError(error.message || "Unable to restore note group page");
        }
      }
    };
    restoreNoteGroupRoute();
    return () => {
      cancelled = true;
    };
  }, [auth.loading, routeSubjectCode, routeModuleCode, routeNoteGroupCode]);

  useEffect(() => {
    if (routePanel) {
      setIsChatOpen(false);
      setIsMetadataOpen(false);
    }
  }, [routePanel]);

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

  const handleGenerateNoteGroupMindMap = async () => {
    if (!canManageSelectedSubject) {
      setNoteGroupMindMapError(
        canUseProtectedActions ? "Maintainer access is required to generate a Mind Map." : "Sign in to generate a Mind Map."
      );
      return;
    }
    if (!selectedNoteGroupId || noteGroupMindMapGenerating) {
      return;
    }
    const noteGroupId = selectedNoteGroupId;
    setNoteGroupMindMapGenerating(true);
    setNoteGroupMindMapError("");
    try {
      const job = await generateNoteGroupMindMap(noteGroupId);
      setNoteGroupMindMap((prev) => ({
        ...(prev || {
          scope: "note_group",
          module_id: selectedModuleId,
          note_group_id: noteGroupId,
          nodes: [],
          edges: [],
          study_cards: [],
          question_cards: [],
          note_groups: selectedNoteGroup ? [{ id: noteGroupId, title: selectedNoteGroup.title }] : []
        }),
        status: job.status === "completed" ? prev?.status || "complete" : "queued",
        stale: false
      }));
      await pollJob(job.id, () => null, { maxAttempts: 120, intervalMs: 2000 });
      const graph = await getNoteGroupMindMap(noteGroupId);
      if (selectedNoteGroupIdRef.current === noteGroupId) {
        setNoteGroupMindMap(graph);
        setMindMapRefreshToken((prev) => prev + 1);
      }
      toast.success("Mind Map generated.");
    } catch (error) {
      if (selectedNoteGroupIdRef.current === noteGroupId) {
        setNoteGroupMindMapError(error.message || "Mind Map generation failed");
      }
    } finally {
      if (selectedNoteGroupIdRef.current === noteGroupId) {
        setNoteGroupMindMapGenerating(false);
      }
    }
  };

  const trackAutoNoteGroupJob = (jobId, moduleId) => {
    if (activeAutoJobsRef.current.has(jobId)) {
      return;
    }
    activeAutoJobsRef.current.add(jobId);
    pollJob(jobId, () => null, { maxAttempts: 180, intervalMs: 2000 })
      .then(async (job) => {
        let toastLabel = "Note group ready.";
        let resolvedModuleId = moduleId;
        if (job.note_group_id) {
          try {
            const noteGroup = await getNoteGroup(job.note_group_id);
            if (noteGroup?.title) {
              toastLabel = `Note group ready: ${noteGroup.title}`;
            }
            if (noteGroup?.module_id) {
              resolvedModuleId = noteGroup.module_id;
            }
          } catch (error) {
            // Fallback to generic success toast.
          }
        }
        toast.success(toastLabel);
        if (resolvedModuleId && selectedModuleIdRef.current === resolvedModuleId) {
          try {
            const chips = await listTopicChips(resolvedModuleId);
            setTopicChips(chips);
          } catch (error) {
            toast.error(error.message || "Failed to refresh generated note group.");
          }
        }
        setReviewRefreshToken((prev) => prev + 1);
        setMindMapRefreshToken((prev) => prev + 1);
        if (resolvedModuleId) {
          loadAutoJobs(resolvedModuleId).catch(() => null);
        }
      })
      .catch((error) => {
        if (error.message === "Job cancelled") {
          toast.info("Note group creation cancelled.");
        } else {
          toast.error(error.message || "Note group creation failed.");
        }
        if (moduleId) {
          loadAutoJobs(moduleId).catch(() => null);
        }
      })
      .finally(() => {
        activeAutoJobsRef.current.delete(jobId);
      });
  };

  const loadAutoJobs = async (moduleId) => {
    const jobs = await listJobs({
      type: "NOTE_GROUP_AUTO_GENERATION",
      status: "queued,running,failed,cancelled",
      moduleId
    });
    const nextMap = {};
    (jobs || []).forEach((job) => {
      if (!job.note_group_id) {
        return;
      }
      if (!nextMap[job.note_group_id]) {
        nextMap[job.note_group_id] = job;
      }
      if (job.status === "queued" || job.status === "running") {
        trackAutoNoteGroupJob(job.id, moduleId);
      }
    });
    setAutoJobsByNoteGroupId(nextMap);
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

  const handleDeleteModule = async (moduleOverride) => {
    if (!canManageSelectedSubject) {
      setSidebarError(
        canUseProtectedActions ? "Maintainer access is required to delete modules." : "Sign in to delete modules."
      );
      return;
    }
    const moduleId = moduleOverride?.id || selectedModuleId;
    if (!moduleId) {
      return;
    }
    const moduleLabel = moduleOverride?.title || selectedModule?.title || "this module";
    const confirmed = await requestConfirm({
      title: `Delete "${moduleLabel}"?`,
      description: "This removes all note groups and cards in it.",
      confirmLabel: "Delete module"
    });
    if (!confirmed) {
      return;
    }
    setSidebarError("");
    try {
      await deleteModule(moduleId);
      setModules((prev) => prev.filter((module) => module.id !== moduleId));
      if (selectedModuleId === moduleId) {
        setSelectedModuleId("");
        setSelectedNoteGroupId("");
        setNoteGroupMode("overview");
        setReviewSummary(null);
        setIsChatOpen(false);
        setIsMetadataOpen(false);
        setIsModuleMetadataOpen(false);
        navigate(selectedSubjectCode ? subjectPath(selectedSubjectCode) : "/");
      }
    } catch (error) {
      setSidebarError(error.message || "Failed to delete module");
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
    setSidebarScope("topics");
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
            : "/"
      );
      return;
    }
    const topic = topicChips.find((item) => item.id === topicId);
    const nextPanel =
      panelOverride || (isStudyPage || isQuestionPage ? routePanel : "overview");
    navigate(
      selectedSubjectCode && selectedModuleCode && topic?.short_code
        ? topicPath(selectedSubjectCode, selectedModuleCode, topic.short_code, nextPanel)
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
      handleBreadcrumbModule();
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
      const job = await autoCreateNoteGroup({
        module_id: selectedModuleId,
        source: trimmedSource,
        raw_text: autoRawText.trim(),
        additional_generation_instructions: autoAdditionalInstructions.trim()
      });
      toast.info("Note group creation started.");
      setAutoRawText("");
      setAutoAdditionalInstructions(getModuleAdditionalInstructions(selectedModule));
      setNoteGroupMode("overview");
      setReviewSummary(null);
      setIsChatOpen(false);
      setIsMetadataOpen(false);
      setIsModuleMetadataOpen(false);
      trackAutoNoteGroupJob(job.id, selectedModuleId);
      loadAutoJobs(selectedModuleId).catch(() => null);
      navigate(
        selectedSubjectCode && selectedModuleCode
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
        canUseProtectedActions ? "Maintainer access is required to create topics." : "Sign in to create topics."
      );
      return;
    }
    const trimmed = moduleChipLabel.trim();
    if (!selectedModuleId || !trimmed) {
      return;
    }
    setSidebarError("");
    try {
      const chip = await createTopicChip(selectedModuleId, {
        label: trimmed,
        description: moduleChipDescription.trim() || null,
      });
      setTopicChips((prev) => [...prev, chip]);
    } catch (error) {
      setSidebarError(error.message || "Failed to create topic");
    }
    setModuleChipLabel("");
    setModuleChipDescription("");
  };

  const handleChipFilterSelect = (options) => {
    const nextIds = options ? options.map((option) => option.value) : [];
    setChipFilterIds(nextIds);
  };
  const handleResetChipFilters = () => {
    setChipFilterIds([]);
  };

  const handleToggleNoteGroupChip = async (chipId, isChecked) => {
    if (!canManageSelectedSubject) {
      setStudyCardError(
        canUseProtectedActions ? "Maintainer access is required to update topics." : "Sign in to update topics."
      );
      return;
    }
    if (!selectedNoteGroupId) {
      return;
    }
    try {
      const chips = isChecked
        ? await attachTopicChips(selectedNoteGroupId, { chip_ids: [chipId] })
        : await detachTopicChip(selectedNoteGroupId, chipId);
      setNoteGroupChipIds(chips.map((chip) => chip.id));
    } catch (error) {
      setStudyCardError(error.message || "Failed to update topics");
    }
  };

  const handleNoteGroupChipSelectChange = async (selected) => {
    if (!canManageSelectedSubject) {
      setStudyCardError(
        canUseProtectedActions ? "Maintainer access is required to update topics." : "Sign in to update topics."
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
        lastChips = await attachTopicChips(selectedNoteGroupId, { chip_ids: [chipId] });
      }
      for (const chipId of toRemove) {
        lastChips = await detachTopicChip(selectedNoteGroupId, chipId);
      }
      if (lastChips) {
        setNoteGroupChipIds(lastChips.map((chip) => chip.id));
      } else {
        setNoteGroupChipIds(newIds);
      }
    } catch (error) {
      setStudyCardError(error.message || "Failed to update topics");
    }
  };

  const reorderNoteGroups = (items, sourceId, targetId) => {
    if (sourceId === targetId) {
      return items;
    }
    const sourceIndex = items.findIndex((item) => item.id === sourceId);
    const targetIndex = items.findIndex((item) => item.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) {
      return items;
    }
    const next = [...items];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    return next;
  };

  const handleNoteGroupDragStart = (event, groupId) => {
    if (!canReorderNoteGroups) {
      return;
    }
    setDraggedNoteGroupId(groupId);
    setDragOverNoteGroupId(groupId);
    if (event.dataTransfer) {
      event.dataTransfer.setData("text/plain", groupId);
      event.dataTransfer.effectAllowed = "move";
    }
  };

  const handleNoteGroupDragOver = (event) => {
    if (!canReorderNoteGroups || !draggedNoteGroupId) {
      return;
    }
    event.preventDefault();
  };

  const handleNoteGroupDragEnter = (groupId) => {
    if (!canReorderNoteGroups || !draggedNoteGroupId) {
      return;
    }
    if (groupId !== dragOverNoteGroupId) {
      setDragOverNoteGroupId(groupId);
    }
  };

  const handleNoteGroupDrop = async (event, groupId) => {
    event.preventDefault();
    if (!canReorderNoteGroups || !draggedNoteGroupId) {
      return;
    }
    const nextOrder = reorderNoteGroups(noteGroups, draggedNoteGroupId, groupId);
    if (nextOrder === noteGroups) {
      setDraggedNoteGroupId("");
      setDragOverNoteGroupId("");
      return;
    }
    const previous = noteGroups;
    setNoteGroups(nextOrder);
    setDraggedNoteGroupId("");
    setDragOverNoteGroupId("");
    setIsReorderingNoteGroups(true);
    try {
      await updateNoteGroupOrder(
        selectedModuleId,
        nextOrder.map((item) => item.id)
      );
    } catch (error) {
      setNoteGroups(previous);
      setSidebarError(error.message || "Failed to reorder note groups");
      toast.error(error.message || "Failed to reorder. Restored previous order.");
    } finally {
      setIsReorderingNoteGroups(false);
    }
  };

  const handleNoteGroupDragEnd = () => {
    setDraggedNoteGroupId("");
    setDragOverNoteGroupId("");
  };

  const handleCancelAutoJob = async (jobId) => {
    if (!canManageSelectedSubject) {
      toast.error("Maintainer access is required to manage note group creation jobs.");
      return;
    }
    if (!jobId) {
      return;
    }
    setAutoJobActionId(jobId);
    try {
      await cancelJob(jobId);
      toast.info("Note group creation job cancelled.");
      if (selectedModuleId) {
        setReviewRefreshToken((prev) => prev + 1);
        await loadAutoJobs(selectedModuleId);
      }
    } catch (error) {
      toast.error(error.message || "Failed to cancel note group creation job.");
    } finally {
      setAutoJobActionId("");
    }
  };

  const handleRetryAutoJob = async (jobId) => {
    if (!canManageSelectedSubject) {
      toast.error("Maintainer access is required to manage note group creation jobs.");
      return;
    }
    if (!jobId) {
      return;
    }
    setAutoJobActionId(jobId);
    try {
      const newJob = await retryAutoJob(jobId);
      toast.info("Retrying note group creation.");
      if (selectedModuleId) {
        setReviewRefreshToken((prev) => prev + 1);
        await loadAutoJobs(selectedModuleId);
      }
      if (newJob?.id) {
        trackAutoNoteGroupJob(newJob.id, selectedModuleId);
      }
    } catch (error) {
      toast.error(error.message || "Failed to retry note group creation job.");
    } finally {
      setAutoJobActionId("");
    }
  };

  const openModuleMetadataModal = () => {
    if (!canManageSelectedSubject) {
      setModuleMetadataError(
        canUseProtectedActions ? "Maintainer access is required to edit module settings." : "Sign in to edit module settings."
      );
      return;
    }
    if (!selectedModuleId) {
      return;
    }
    setModuleTitleDraft(selectedModule?.title || "");
    setModuleDescriptionDraft(selectedModule?.description || "");
    setModuleAdditionalInstructionsDraft(
      getModuleAdditionalInstructions(selectedModule)
    );
    setModuleGoalDraft(selectedModule?.goal || "");
    setModuleScopeDraft(selectedModule?.scope || "");
    setModuleMetadataError("");
    setIsModuleMetadataOpen(true);
  };

  const handleSaveModuleMetadata = async () => {
    if (!canManageSelectedSubject) {
      setModuleMetadataError(
        canUseProtectedActions ? "Maintainer access is required to edit module settings." : "Sign in to edit module settings."
      );
      return;
    }
    if (!selectedModuleId) {
      return;
    }
    const trimmedTitle = moduleTitleDraft.trim();
    if (!trimmedTitle) {
      setModuleMetadataError("Title cannot be empty.");
      return;
    }
    const instructionsWordCount = countWords(moduleAdditionalInstructionsDraft);
    if (instructionsWordCount > 500) {
      setModuleMetadataError("Default instructions must be 500 words or fewer.");
      return;
    }
    setModuleMetadataSaving(true);
    setModuleMetadataError("");
    try {
      const updated = await updateModule(selectedModuleId, {
        title: trimmedTitle,
        description: moduleDescriptionDraft.trim() || null,
        goal: moduleGoalDraft.trim() || null,
        scope: moduleScopeDraft.trim() || null,
        settings: {
          additional_generation_instructions: moduleAdditionalInstructionsDraft.trim()
        }
      });
      setModules((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setModuleTitleDraft(updated.title || "");
      setModuleDescriptionDraft(updated.description || "");
      setModuleAdditionalInstructionsDraft(
        getModuleAdditionalInstructions(updated)
      );
      if (selectedModuleId === updated.id) {
        setAutoAdditionalInstructions(getModuleAdditionalInstructions(updated));
      }
    } catch (error) {
      setModuleMetadataError(error.message || "Failed to update module");
    } finally {
      setModuleMetadataSaving(false);
    }
  };

  const openMetadataModal = () => {
    if (!canManageSelectedSubject) {
      setMetadataError(
        canUseProtectedActions ? "Maintainer access is required to edit note group metadata." : "Sign in to edit note group metadata."
      );
      return;
    }
    if (!selectedNoteGroupId) {
      return;
    }
    setMetadataTitleDraft(selectedNoteGroup?.title || "");
    setMetadataError("");
    setIsMetadataOpen(true);
  };

  const handleSaveMetadataTitle = async () => {
    if (!canManageSelectedSubject) {
      setMetadataError(
        canUseProtectedActions ? "Maintainer access is required to edit note group metadata." : "Sign in to edit note group metadata."
      );
      return;
    }
    if (!selectedNoteGroupId) {
      return;
    }
    const trimmed = metadataTitleDraft.trim();
    if (!trimmed) {
      setMetadataError("Title cannot be empty.");
      return;
    }
    setMetadataSaving(true);
    setMetadataError("");
    try {
      const updated = await updateNoteGroupTitle(selectedNoteGroupId, { title: trimmed });
      setNoteGroups((prev) =>
        prev.map((group) => (group.id === updated.id ? updated : group))
      );
      setMetadataTitleDraft(updated.title || "");
    } catch (error) {
      setMetadataError(error.message || "Failed to update note group title");
    } finally {
      setMetadataSaving(false);
    }
  };

  const handleDeleteNoteGroup = async () => {
    if (!canManageSelectedSubject) {
      setSidebarError(
        canUseProtectedActions ? "Maintainer access is required to delete note groups." : "Sign in to delete note groups."
      );
      return;
    }
    if (!selectedNoteGroupId) {
      return;
    }
    const noteGroupLabel = selectedNoteGroup?.title || "this note group";
    const confirmed = await requestConfirm({
      title: `Delete "${noteGroupLabel}"?`,
      description: "This removes its study and question cards.",
      confirmLabel: "Delete note group"
    });
    if (!confirmed) {
      return;
    }
    setSidebarError("");
    try {
      await deleteNoteGroup(selectedNoteGroupId);
      setNoteGroups((prev) => prev.filter((group) => group.id !== selectedNoteGroupId));
      setSelectedNoteGroupId("");
      setNoteGroupMode("overview");
      setReviewSummary(null);
      setIsChatOpen(false);
      setIsMetadataOpen(false);
      navigate(
        selectedSubjectCode && selectedModuleCode
          ? modulePath(selectedSubjectCode, selectedModuleCode)
          : "/"
      );
    } catch (error) {
      setSidebarError(error.message || "Failed to delete note group");
    }
  };

  const handleSaveTopic = async () => {
    if (!canManageSelectedSubject) {
      setTopicError(
        canUseProtectedActions ? "Maintainer access is required to edit topics." : "Sign in to edit topics."
      );
      return;
    }
    if (!selectedTopicId) {
      return;
    }
    const trimmed = topicTitleDraft.trim();
    if (!trimmed) {
      setTopicError("Topic name cannot be empty.");
      return;
    }
    setTopicSaving(true);
    setTopicError("");
    try {
      const updated = await updateTopic(selectedTopicId, {
        label: trimmed,
        description: topicDescriptionDraft.trim() || null
      });
      setTopicChips((prev) =>
        prev.map((topic) => (topic.id === updated.id ? updated : topic))
      );
      setTopicTitleDraft(updated.label || "");
      setTopicDescriptionDraft(updated.description || "");
    } catch (error) {
      setTopicError(error.message || "Failed to update topic");
    } finally {
      setTopicSaving(false);
    }
  };

  const handleDeleteTopic = async () => {
    if (!canManageSelectedSubject) {
      setSidebarError(
        canUseProtectedActions ? "Maintainer access is required to delete topics." : "Sign in to delete topics."
      );
      return;
    }
    if (!selectedTopicId) {
      return;
    }
    const topicLabel = selectedTopic?.label || "this topic";
    const confirmed = await requestConfirm({
      title: `Delete "${topicLabel}"?`,
      description: "This removes the topic from cards but keeps the cards.",
      confirmLabel: "Delete topic"
    });
    if (!confirmed) {
      return;
    }
    setSidebarError("");
    try {
      await deleteTopic(selectedTopicId);
      setTopicChips((prev) => prev.filter((topic) => topic.id !== selectedTopicId));
      setSelectedTopicId("");
      setSidebarScope("topics");
      setNoteGroupMode("overview");
      setReviewSummary(null);
      setIsChatOpen(false);
      navigate(
        selectedSubjectCode && selectedModuleCode
          ? modulePath(selectedSubjectCode, selectedModuleCode)
          : "/"
      );
    } catch (error) {
      setSidebarError(error.message || "Failed to delete topic");
    }
  };

  const handleCreateStudyCard = async () => {
    if (!canManageSelectedSubject) {
      setStudyCardError(
        canUseProtectedActions ? "Maintainer access is required to create study cards." : "Sign in to create study cards."
      );
      return;
    }
    if (!selectedNoteGroupId || !newStudyCardContent.trim()) {
      return;
    }
    setStudyCardError("");
    try {
      const card = await createStudyCard(selectedNoteGroupId, {
        title: newStudyCardTitle.trim() || null,
        content: newStudyCardContent.trim(),
        chip_ids: newStudyCardChipIds
      });
      setStudyCards((prev) => [...prev, card]);
      setNewStudyCardTitle("");
      setNewStudyCardContent("");
      setNewStudyCardChipIds([]);
      setIsStudyCreateOpen(false);
      setMindMapRefreshToken((prev) => prev + 1);
    } catch (error) {
      setStudyCardError(error.message || "Failed to create study card");
    }
  };

  const openStudyCreateModal = () => {
    if (!canManageSelectedSubject) {
      setStudyCardError(
        canUseProtectedActions ? "Maintainer access is required to create study cards." : "Sign in to create study cards."
      );
      return;
    }
    setStudyCardError("");
    setIsStudyCreateOpen(true);
  };

  const handleEditStudyCard = (card) => {
    if (!canManageSelectedSubject) {
      setStudyCardError(
        canUseProtectedActions ? "Maintainer access is required to edit study cards." : "Sign in to edit study cards."
      );
      return;
    }
    setEditingStudyCardId(card.id);
    setEditingStudyCard({
      title: card.title || "",
      content: card.content,
      chipIds: (card.topic_chips || []).map((chip) => chip.id)
    });
  };

  const handleSaveStudyCard = async (cardId) => {
    if (!canManageSelectedSubject) {
      setStudyCardError(
        canUseProtectedActions ? "Maintainer access is required to edit study cards." : "Sign in to edit study cards."
      );
      return false;
    }
    setStudyCardError("");
    try {
      const updated = await updateStudyCard(cardId, {
        title: editingStudyCard.title,
        content: editingStudyCard.content,
        chip_ids: editingStudyCard.chipIds
      });
      setStudyCards((prev) => prev.map((card) => (card.id === cardId ? updated : card)));
      setNoteGroupCardTable((prev) => ({
        ...prev,
        rows: prev.rows.map((row) =>
          row.study_card.id === cardId
            ? {
                ...row,
                study_card: {
                  ...row.study_card,
                  title: updated.title,
                },
              }
            : row
        ),
      }));
      setEditingStudyCardId("");
      setMindMapRefreshToken((prev) => prev + 1);
      return true;
    } catch (error) {
      setStudyCardError(error.message || "Failed to update study card");
      return false;
    }
  };

  const handleDeleteStudyCard = async (cardId) => {
    if (!canManageSelectedSubject) {
      setStudyCardError(
        canUseProtectedActions ? "Maintainer access is required to delete study cards." : "Sign in to delete study cards."
      );
      return false;
    }
    const confirmed = await requestConfirm({
      title: "Delete this study card?",
      description: "This removes the study card from the current note group.",
      confirmLabel: "Delete study card"
    });
    if (!confirmed) {
      return false;
    }
    setStudyCardError("");
    try {
      await deleteStudyCard(cardId);
      setStudyCards((prev) => prev.filter((card) => card.id !== cardId));
      setNoteGroupCardTable((prev) => ({
        ...prev,
        rows: prev.rows.filter((row) => row.study_card.id !== cardId),
      }));
      setMindMapRefreshToken((prev) => prev + 1);
      return true;
    } catch (error) {
      setStudyCardError(error.message || "Failed to delete study card");
      return false;
    }
  };

  const handleGenerateQuestions = async () => {
    if (!canManageSelectedSubject) {
      setQuestionCardError(
        canUseProtectedActions ? "Maintainer access is required to generate question cards." : "Sign in to generate question cards."
      );
      return;
    }
    if (!selectedNoteGroupId || studyCards.length === 0) {
      return;
    }
    setIsGeneratingQuestions(true);
    setQuestionCardError("");
    setQuestionJobStatus("queued");
    try {
      const job = await generateQuestionCards(selectedNoteGroupId, {
        difficulty: "mixed"
      });
      await pollJob(job.id, setQuestionJobStatus);
      const response = await listQuestionCards(selectedNoteGroupId);
      setQuestionCards(response.question_cards || []);
      setQuestionJobStatus("completed");
      setMindMapRefreshToken((prev) => prev + 1);
    } catch (error) {
      setQuestionCardError(error.message || "Question generation failed");
      setQuestionJobStatus("failed");
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

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
            ? await listTopicReviewQuestionCards(
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

  const handleCreateQuestionCard = async () => {
    if (!canManageSelectedSubject) {
      setQuestionCardError(
        canUseProtectedActions ? "Maintainer access is required to create question cards." : "Sign in to create question cards."
      );
      return;
    }
    if (!selectedNoteGroupId || !newQuestionPrompt.trim()) {
      return;
    }
    const options = parseOptions(newQuestionOptions);
    const indices = parseIndices(newQuestionCorrectIndices);
    if (options.length < 2 || indices.length === 0 || newQuestionRefs.length === 0) {
      setQuestionCardError("Provide options, correct indices, and study card refs.");
      return;
    }
    setQuestionCardError("");
    try {
      const card = await createQuestionCard(selectedNoteGroupId, {
        type: newQuestionType,
        prompt: newQuestionPrompt.trim(),
        options,
        correct_option_indices: indices,
        study_card_refs: newQuestionRefs
      });
      setQuestionCards((prev) => [...prev, card]);
      setNewQuestionPrompt("");
      setNewQuestionOptions("");
      setNewQuestionCorrectIndices("");
      setNewQuestionRefs([]);
      setIsQuestionCreateOpen(false);
      setMindMapRefreshToken((prev) => prev + 1);
    } catch (error) {
      setQuestionCardError(error.message || "Failed to create question card");
    }
  };

  const openQuestionCreateModal = () => {
    if (!canManageSelectedSubject) {
      setQuestionCardError(
        canUseProtectedActions ? "Maintainer access is required to create question cards." : "Sign in to create question cards."
      );
      return;
    }
    setQuestionCardError("");
    setIsQuestionCreateOpen(true);
  };

  const handleEditQuestionCard = (card) => {
    if (!canManageSelectedSubject) {
      setQuestionCardError(
        canUseProtectedActions ? "Maintainer access is required to edit question cards." : "Sign in to edit question cards."
      );
      return;
    }
    setEditingQuestionCardId(card.id);
    setEditingQuestionCard({
      type: card.type,
      prompt: card.prompt,
      optionsText: (card.options || []).join("\n"),
      correctIndicesText: (card.correct_option_indices || []).join(", "),
      refs: card.study_card_refs || []
    });
  };

  const handleSaveQuestionCard = async (cardId) => {
    if (!canManageSelectedSubject) {
      setQuestionCardError(
        canUseProtectedActions ? "Maintainer access is required to edit question cards." : "Sign in to edit question cards."
      );
      return false;
    }
    const options = parseOptions(editingQuestionCard.optionsText);
    const indices = parseIndices(editingQuestionCard.correctIndicesText);
    if (options.length < 2 || indices.length === 0 || editingQuestionCard.refs.length === 0) {
      setQuestionCardError("Provide options, correct indices, and study card refs.");
      return false;
    }
    setQuestionCardError("");
    try {
      const updated = await updateQuestionCard(cardId, {
        type: editingQuestionCard.type,
        prompt: editingQuestionCard.prompt,
        options,
        correct_option_indices: indices,
        study_card_refs: editingQuestionCard.refs
      });
      setQuestionCards((prev) => prev.map((card) => (card.id === cardId ? updated : card)));
      setNoteGroupCardTable((prev) => {
        const refs = new Set(updated.study_card_refs || []);
        const existingMetricRow = prev.rows
          .flatMap((row) => row.question_cards || [])
          .find((question) => question.id === cardId);
        const nextQuestionRow = {
          ...existingMetricRow,
          id: updated.id,
          prompt: updated.prompt,
        };
        return {
          ...prev,
          rows: prev.rows.map((row) => {
            const withoutUpdated = (row.question_cards || []).filter(
              (question) => question.id !== cardId
            );
            return {
              ...row,
              question_cards: refs.has(row.study_card.id)
                ? [...withoutUpdated, nextQuestionRow]
                : withoutUpdated,
            };
          }),
        };
      });
      setEditingQuestionCardId("");
      setMindMapRefreshToken((prev) => prev + 1);
      return true;
    } catch (error) {
      setQuestionCardError(error.message || "Failed to update question card");
      return false;
    }
  };

  const handleDeleteQuestionCard = async (cardId) => {
    if (!canManageSelectedSubject) {
      setQuestionCardError(
        canUseProtectedActions ? "Maintainer access is required to delete question cards." : "Sign in to delete question cards."
      );
      return false;
    }
    const confirmed = await requestConfirm({
      title: "Delete this question card?",
      description: "This cannot be undone.",
      confirmLabel: "Delete question card"
    });
    if (!confirmed) {
      return false;
    }
    setQuestionCardError("");
    try {
      await deleteQuestionCard(cardId);
      setQuestionCards((prev) => prev.filter((card) => card.id !== cardId));
      setNoteGroupCardTable((prev) => ({
        ...prev,
        rows: prev.rows.map((row) => ({
          ...row,
          question_cards: (row.question_cards || []).filter(
            (question) => question.id !== cardId
          ),
        })),
      }));
      setMindMapRefreshToken((prev) => prev + 1);
      return true;
    } catch (error) {
      setQuestionCardError(error.message || "Failed to delete question card");
      return false;
    }
  };

  const openQuestionFocus = (cardId) => {
    setFocusQuestionCardId(cardId);
    setIsQuestionFocusOpen(true);
  };

  const closeQuestionFocus = () => {
    setIsQuestionFocusOpen(false);
    setFocusQuestionCardId("");
  };

  const handleSendChat = async () => {
    if (!selectedModuleId || !chatInput.trim()) {
      return;
    }
    setChatLoading(true);
    setChatError("");
    const message = chatInput.trim();
    const history = chatMessages
      .slice(-10)
      .filter((item) => item?.content)
      .map((item) => ({
        role: item.role,
        content: item.content
      }));
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    try {
      const response = await sendChat({
        module_id: selectedModuleId,
        message,
        note_group_id: selectedNoteGroupId || null,
        history
      });
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.answer, refs: response.study_card_refs || [] }
      ]);
      if (response.study_card_refs && response.study_card_refs.length) {
        response.study_card_refs.forEach((refId) => {
          setChatCardCache((prev) => {
            if (prev[refId]) {
              return prev;
            }
            getStudyCard(refId)
              .then((card) =>
                setChatCardCache((next) => ({
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
      setChatError(error.message || "Chat failed");
    } finally {
      setChatLoading(false);
    }
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

  const openChatStudyCard = (studyCardId) => {
    if (!studyCardId) {
      return;
    }
    setChatView("card");
    setChatCardId(studyCardId);
    setChatCardError("");
    if (chatCardCache[studyCardId]) {
      return;
    }
    setChatCardLoading(true);
    getStudyCard(studyCardId)
      .then((card) =>
        setChatCardCache((prev) => ({
          ...prev,
          [studyCardId]: card
        }))
      )
      .catch((error) => setChatCardError(error.message || "Failed to load study card"))
      .finally(() => setChatCardLoading(false));
  };

  const handleBackToChat = () => {
    setChatView("chat");
    setChatCardId("");
    setChatCardError("");
  };

  const handleChatKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!chatLoading && selectedModuleId && chatInput.trim()) {
        handleSendChat();
      }
    }
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
    setSelectedNoteGroupId("");
    setSelectedTopicId("");
    setSidebarScope("note-groups");
    setNoteGroupMode("overview");
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    navigate(
      selectedSubjectCode && selectedModuleCode
        ? modulePath(selectedSubjectCode, selectedModuleCode)
        : "/"
    );
  };

  const handleBackToOverview = () => {
    setNoteGroupMode("overview");
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    navigate(
      selectedSubjectCode && selectedModuleCode && selectedTopicCode
        ? topicPath(selectedSubjectCode, selectedModuleCode, selectedTopicCode)
        : selectedSubjectCode && selectedModuleCode && selectedNoteGroupCode
          ? noteGroupPath(selectedSubjectCode, selectedModuleCode, selectedNoteGroupCode)
        : selectedSubjectCode && selectedModuleCode
          ? modulePath(selectedSubjectCode, selectedModuleCode)
          : "/"
    );
  };

  const hasSidebar = Boolean(selectedSubjectId && selectedModuleId);
  const pageDescription =
    noteGroupMode === "auto"
      ? "Paste raw text and we will create a note group and questions in the background."
      : selectedTopicId
        ? "Review study and question cards for this topic."
        : selectedNoteGroupId
          ? "Manage your note group, review questions, and chat with your study cards."
          : selectedModuleId
            ? "Review question cards across note groups, edit module settings, and chat with your module study cards."
            : selectedSubjectId
              ? "Pick a module to get started."
              : "Choose a subject to get started.";
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
    pageBreadcrumbs.push({ label: selectedTopic.label || "Topic", current: true });
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
      topicSearch={topicSearch}
      onNoteGroupSearchChange={setNoteGroupSearch}
      onTopicSearchChange={setTopicSearch}
      noteGroups={filteredNoteGroupOptions.map((option) => {
        const statusMeta = getNoteGroupStatusMeta(option.status);
        const statsEntry = moduleNoteGroupStatsById.get(option.value);
        const dueCount = statsEntry?.dueCount;
        return {
          ...option,
          description: formatCreatedAt(option.createdAt),
          badge: Number.isInteger(dueCount) ? String(dueCount) : "...",
          statusLabel: statusMeta?.label || ""
        };
      })}
      topics={filteredTopicOptions}
      selectedNoteGroupId={selectedNoteGroupId}
      selectedTopicId={selectedTopicId}
      canCreateNoteGroup={canManageSelectedSubject}
      showCreateNoteGroup={canUseProtectedActions}
      onSelectNoteGroup={handleSelectNoteGroup}
      onSelectTopic={handleSelectTopic}
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
                  placeholder="Assign topics"
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
                    placeholder="Topics and boundaries of study"
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
                    placeholder="Topics and boundaries of study"
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
                placeholder="Topics and boundaries of study"
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
                placeholder="Topics and boundaries of study"
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
            title="Build structured notes from raw text."
            description={pageDescription}
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
              <SubjectIndex
                subjects={subjects}
                error={sidebarError}
                canCreate={canCreateSubjects}
                showCreate={canUseProtectedActions}
                showEditControls={canUseProtectedActions}
                canEditSubject={canMaintainSubject}
                canDeleteSubject={canDeleteSubject}
                onOpenWizard={handleOpenSubjectWizard}
                onSelect={(subject) =>
                  handleSelectSubject({
                    value: subject.id,
                    label: subject.title
                  })
                }
                onEdit={openSubjectMetadataModal}
                onDelete={handleDeleteSubject}
              />
            ) : isRestoringRoute ? (
              <section className={panelClass}>
                <h2>Fetching page</h2>
                <p className={mutedTextClass}>Loading the subject and module for this URL.</p>
              </section>
            ) : !selectedModuleId ? (
              <ModuleIndex
                modules={modules}
                dueCounts={moduleDueCounts}
                subjectDescription={selectedSubject?.description}
                error={sidebarError}
                canCreate={canManageSelectedSubject}
                showCreate={canUseProtectedActions}
                canEdit={canManageSelectedSubject}
                showEditControls={canUseProtectedActions}
                onOpenWizard={handleOpenModuleWizard}
                onBack={handleBreadcrumbHome}
                onSelect={(module) =>
                  handleSelectModule({
                    value: module.id,
                    label: module.title
                  })
                }
                onDelete={handleDeleteModule}
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
                  <div className="space-y-6">
                    <ModuleOverview
                      title={selectedModule?.title}
                      description={
                        selectedModule?.description ||
                        "Review across note groups and manage module details."
                      }
                      noteGroupCount={moduleNoteGroupsForDisplay.length}
                      stats={moduleStats}
                      loading={moduleStatsLoading}
                      error={moduleStatsError}
                      filterControls={
                        <div className="filter-row">
                          <div className="filter-label">
                            <span>Filter note groups</span>
                            {chipFilterIds.length ? (
                              <span className="filter-badge">{chipFilterIds.length}</span>
                            ) : null}
                          </div>
                          <div className="filter-controls">
                            <Select
                              className="select"
                              classNamePrefix="select"
                              options={chipOptions}
                              value={chipFilterValue}
                              onChange={handleChipFilterSelect}
                              placeholder="Search topics"
                              isMulti
                              isClearable
                              isDisabled={!selectedModuleId || chipOptions.length === 0}
                              maxMenuHeight={220}
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
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleResetChipFilters}
                              disabled={!chipFilterIds.length}
                            >
                              Reset
                            </Button>
                          </div>
                        </div>
                      }
                      actions={
                        <>
                          <Button
                            type="button"
                            onClick={() => setIsChatOpen(true)}
                            disabled={!canUseProtectedActions || !selectedModuleId || isReviewOverlayVisible}
                          >
                            Open chat
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={openModuleMetadataModal}
                            disabled={!canManageSelectedSubject || !selectedModuleId || isReviewOverlayVisible}
                          >
                            Module settings
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDeleteModule}
                            disabled={!canManageSelectedSubject || !selectedModuleId || isReviewOverlayVisible}
                          >
                            Delete module
                          </Button>
                        </>
                      }
                    />
                      <section id="module-mind-map">
                        <MindMapPanel
                          graph={moduleMindMap}
                          title={`${selectedModule?.title || "Module"} Mind Map`}
                          description="Concepts across generated Note Group Mind Maps in this module."
                          loading={moduleMindMapLoading}
                          error={moduleMindMapError}
                        />
                      </section>
                      <section className={panelClass} id="module-review">
                        <h2>Review question cards</h2>
                        <div className="results-meta">
                          <div className="field inline">
                            <label htmlFor="module-review-count">Count</label>
                            <input
                              id="module-review-count"
                              type="number"
                              min="1"
                              max="200"
                              value={reviewCount}
                              onChange={(event) => setReviewCount(event.target.value)}
                              disabled={isReviewing}
                            />
                          </div>
                          <button
                            className={primaryButtonClass}
                            type="button"
                            onClick={() => startReview("due", "module")}
                            disabled={!canUseProtectedActions || !selectedModuleId || isReviewing}
                          >
                            Review due
                          </button>
                          <button
                            className={primaryButtonClass}
                            type="button"
                            onClick={() => startReview("queue", "module")}
                            disabled={!canUseProtectedActions || !selectedModuleId || isReviewing}
                          >
                            Review next
                          </button>
                          <button
                            className={outlineButtonClass}
                            type="button"
                            onClick={() => startReview("all", "module")}
                            disabled={!canUseProtectedActions || !selectedModuleId || isReviewing}
                          >
                            Review all
                          </button>
                        </div>
                        {reviewError ? <p className={errorTextClass}>{reviewError}</p> : null}
                        <p className={mutedTextClass}>
                          Review sessions open in a modal so you can stay focused.
                        </p>
                      </section>
                      <section className={panelClass} id="module-timeline">
                        <h2>Question timeline</h2>
                        <div className="stats-grid">
                          <div className="stat-card">
                            <p className="label">Due</p>
                            <p className="value">
                              {moduleStatsLoading ? "..." : moduleQuestionTimeline.due}
                            </p>
                          </div>
                          <div className="stat-card">
                            <p className="label">&lt; 1 week</p>
                            <p className="value">
                              {moduleStatsLoading ? "..." : moduleQuestionTimeline.week}
                            </p>
                          </div>
                          <div className="stat-card">
                            <p className="label">&lt; 1 month</p>
                            <p className="value">
                              {moduleStatsLoading ? "..." : moduleQuestionTimeline.month}
                            </p>
                          </div>
                          <div className="stat-card">
                            <p className="label">&lt; 6 months</p>
                            <p className="value">
                              {moduleStatsLoading ? "..." : moduleQuestionTimeline.sixMonths}
                            </p>
                          </div>
                          <div className="stat-card">
                            <p className="label">&gt; 6 months</p>
                            <p className="value">
                              {moduleStatsLoading ? "..." : moduleQuestionTimeline.longTerm}
                            </p>
                          </div>
                        </div>
                        <p className={mutedTextClass}>
                          Due includes anything scheduled within the next 6 hours.
                        </p>
                      </section>
                      <section className={panelClass} id="module-note-groups">
                        <h2>Note groups in this module</h2>
                        {chipFilterIds.length ? (
                          <p className={mutedTextClass}>Filtered by selected topics.</p>
                        ) : null}
                        {canReorderNoteGroups ? (
                          <p className={mutedTextClass}>
                            Drag and drop note groups to reorder.
                            {isReorderingNoteGroups ? " Saving order..." : ""}
                          </p>
                        ) : null}
                        {moduleNoteGroupsForDisplay.length === 0 ? (
                          <p className={mutedTextClass}>
                            {chipFilterIds.length
                              ? "No note groups match the selected topics."
                              : "No note groups yet."}
                          </p>
                        ) : (
                          <div className="grid gap-4">
                            {moduleNoteGroupsForDisplay.map((group) => {
                              const stats = moduleNoteGroupStatsById.get(group.id);
                              const statusMeta = getNoteGroupStatusMeta(group.generation_status);
                              const autoJob = autoJobsByNoteGroupId[group.id];
                              const canCancelAuto =
                                autoJob &&
                                (autoJob.status === "queued" || autoJob.status === "running");
                              const canRetryAuto =
                                autoJob &&
                                (autoJob.status === "failed" || autoJob.status === "cancelled");
                              return (
                                <article
                                  key={group.id}
                                  className={`rounded-lg border bg-card p-4 text-card-foreground shadow-sm ${
                                    draggedNoteGroupId === group.id ? "dragging" : ""
                                  } ${dragOverNoteGroupId === group.id ? "drag-over" : ""}`}
                                  onDragOver={handleNoteGroupDragOver}
                                  onDragEnter={() => handleNoteGroupDragEnter(group.id)}
                                  onDrop={(event) => handleNoteGroupDrop(event, group.id)}
                                  onDragEnd={handleNoteGroupDragEnd}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    {canReorderNoteGroups ? (
                                      <button
                                        type="button"
                                        className="drag-handle"
                                        aria-label="Drag to reorder note groups"
                                        draggable
                                        onDragStart={(event) =>
                                          handleNoteGroupDragStart(event, group.id)
                                        }
                                        onDragEnd={handleNoteGroupDragEnd}
                                      >
                                        ::
                                      </button>
                                    ) : null}
                                    <div className="note-group-title-stack">
                                      <h3>{group.title || "Untitled note group"}</h3>
                                      <span className="note-group-date">
                                        {formatCreatedAt(group.created_at)}
                                      </span>
                                    </div>
                                      {statusMeta ? (
                                        <span className={`${badgeClass} ${statusMeta.className}`}>
                                          {statusMeta.label}
                                        </span>
                                      ) : null}
                                    </div>
                                    <span className="mono">{group.id.slice(0, 8)}</span>
                                  </div>
                                  <div className="review-meta">
                                    <span className={badgeClass}>
                                      Study cards: {stats ? stats.studyCount : "—"}
                                    </span>
                                    <span className={badgeClass}>
                                      Questions: {stats ? stats.questionCount : "—"}
                                    </span>
                                    <span className={badgeClass}>
                                      Due: {stats ? stats.dueCount : "—"}
                                    </span>
                                    {stats ? (
                                      <span className={badgeClass}>
                                        Stale: {stats.staleCount}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className={buttonRowClass}>
                                    {canCancelAuto ? (
                                      <button
                                        className={smallDestructiveOutlineButtonClass}
                                        type="button"
                                        onClick={() => handleCancelAutoJob(autoJob.id)}
                                        disabled={
                                          autoJobActionId === autoJob.id || isReviewOverlayVisible
                                        }
                                      >
                                        {autoJobActionId === autoJob.id
                                          ? "Cancelling..."
                                          : "Cancel auto"}
                                      </button>
                                    ) : null}
                                    {canRetryAuto ? (
                                      <button
                                        className={smallOutlineButtonClass}
                                        type="button"
                                        onClick={() => handleRetryAutoJob(autoJob.id)}
                                        disabled={
                                          autoJobActionId === autoJob.id || isReviewOverlayVisible
                                        }
                                      >
                                        {autoJobActionId === autoJob.id
                                          ? "Retrying..."
                                          : "Retry auto"}
                                      </button>
                                    ) : null}
                                    <button
                                      className={outlineButtonClass}
                                      type="button"
                                      onClick={() => navigateToNoteGroup(group.id)}
                                    >
                                      Open overview
                                    </button>
                                    <button
                                      className={outlineButtonClass}
                                      type="button"
                                      onClick={() =>
                                        navigateToNoteGroup(group.id, "study-cards")
                                      }
                                    >
                                      Study cards
                                    </button>
                                    <button
                                      className={outlineButtonClass}
                                      type="button"
                                      onClick={() =>
                                        navigateToNoteGroup(group.id, "question-cards")
                                      }
                                    >
                                      Question cards
                                    </button>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}
                    </section>
                  </div>
                ) : (
                  <>
                    {!isViewCardsPage && !isStudyPage && !isQuestionPage ? (
                      <div className="space-y-6">
                        {isTopicScope ? (
                          <TopicOverview
                            topic={selectedTopic}
                            stats={noteGroupStats}
                            actions={
                              <>
                                <button
                                  className={primaryButtonClass}
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      topicPath(
                                        selectedSubjectCode,
                                        selectedModuleCode,
                                        selectedTopicCode,
                                        "view-cards"
                                      )
                                    )
                                  }
                                >
                                  View cards
                                </button>
                                <button
                                  className={outlineButtonClass}
                                  type="button"
                                  onClick={() => setIsChatOpen(true)}
                                  disabled={!canUseProtectedActions || !selectedModuleId || isReviewOverlayVisible}
                                >
                                  Open chat
                                </button>
                              </>
                            }
                            error={topicError}
                          >
                            <div className="form-block">
                              <h3>Topic management</h3>
                              <input
                                type="text"
                                value={topicTitleDraft}
                                onChange={(event) => setTopicTitleDraft(event.target.value)}
                                placeholder="Topic name"
                              />
                              <input
                                type="text"
                                value={topicDescriptionDraft}
                                onChange={(event) => setTopicDescriptionDraft(event.target.value)}
                                placeholder="Description (optional)"
                              />
                              <div className={buttonRowClass}>
                                <button
                                  className={primaryButtonClass}
                                  type="button"
                                  onClick={handleSaveTopic}
                                  disabled={!canManageSelectedSubject || topicSaving || !topicTitleDraft.trim()}
                                >
                                  {topicSaving ? "Saving..." : "Rename topic"}
                                </button>
                                <button
                                  className={destructiveOutlineButtonClass}
                                  type="button"
                                  onClick={handleDeleteTopic}
                                  disabled={!canManageSelectedSubject || topicSaving || isReviewOverlayVisible}
                                >
                                  Delete topic
                                </button>
                              </div>
                            </div>
                          </TopicOverview>
                        ) : (
                          <>
                            <NoteGroupOverview
                              noteGroup={selectedNoteGroup}
                              statusMeta={noteGroupStatusMeta}
                              stats={noteGroupStats}
                              topics={topicChips.filter((topic) => noteGroupChipIds.includes(topic.id))}
                              filterControls={
                                <div className="filter-row">
                                  <div className="filter-label">
                                    <span>Filter note groups</span>
                                    {chipFilterIds.length ? (
                                      <span className="filter-badge">{chipFilterIds.length}</span>
                                    ) : null}
                                  </div>
                                  <div className="filter-controls">
                                    <Select
                                      className="select"
                                      classNamePrefix="select"
                                      options={chipOptions}
                                      value={chipFilterValue}
                                      onChange={handleChipFilterSelect}
                                      placeholder="Search topics"
                                      isMulti
                                      isClearable
                                      isDisabled={!selectedModuleId || chipOptions.length === 0}
                                      maxMenuHeight={220}
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
                                    <button
                                      className={smallOutlineButtonClass}
                                      type="button"
                                      onClick={handleResetChipFilters}
                                      disabled={!chipFilterIds.length}
                                    >
                                      Reset
                                    </button>
                                  </div>
                                </div>
                              }
                              actions={
                                <>
                                  <button
                                    className={primaryButtonClass}
                                    type="button"
                                    onClick={() => startReview("due", "note-group")}
                                    disabled={!canUseProtectedActions || !selectedNoteGroupId || isReviewing}
                                  >
                                    Review Due
                                    <span className="rounded-md bg-primary-foreground/20 px-2 py-0.5 text-xs">
                                      {noteGroupStats.dueCount}
                                    </span>
                                  </button>
                                  <button
                                    className={outlineButtonClass}
                                    type="button"
                                    onClick={() => setIsChatOpen(true)}
                                    disabled={!canUseProtectedActions || !selectedModuleId || isReviewOverlayVisible}
                                  >
                                    Chat
                                  </button>
                                  <button
                                    className={outlineButtonClass}
                                    type="button"
                                    onClick={openMetadataModal}
                                    disabled={!canManageSelectedSubject || !selectedNoteGroupId || isReviewOverlayVisible}
                                  >
                                    Edit metadata
                                  </button>
                                  <button
                                    className={destructiveOutlineButtonClass}
                                    type="button"
                                    onClick={handleDeleteNoteGroup}
                                    disabled={!canManageSelectedSubject || !selectedNoteGroupId || isReviewOverlayVisible}
                                  >
                                    Delete note group
                                  </button>
                                </>
                              }
                            />
                            <section id="note-group-mind-map">
                              <MindMapPanel
                                graph={noteGroupMindMap}
                                title={`${selectedNoteGroup?.title || "Note Group"} Mind Map`}
                                description="Concepts and relationships extracted from this Note Group."
                                loading={noteGroupMindMapLoading}
                                error={noteGroupMindMapError}
                                canGenerate={canManageSelectedSubject}
                                generating={noteGroupMindMapGenerating}
                                onGenerate={handleGenerateNoteGroupMindMap}
                              />
                            </section>
                            <section className={panelClass} id="note-group-content">
                              <div className="mb-4">
                                <h3 className="text-base font-semibold">Content</h3>
                                <p className={mutedTextClass}>
                                  Open the cards table or source for this Note Group.
                                </p>
                              </div>
                              <div className={buttonRowClass}>
                                <button
                                  className={primaryButtonClass}
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      noteGroupPath(
                                        selectedSubjectCode,
                                        selectedModuleCode,
                                        selectedNoteGroupCode,
                                        "view-cards"
                                      )
                                    )
                                  }
                                >
                                  View Cards
                                </button>
                                <button
                                  className={outlineButtonClass}
                                  type="button"
                                  onClick={() => setIsReadingOpen(true)}
                                  disabled={!readingAvailable}
                                >
                                  View Source
                                </button>
                              </div>
                            </section>
                            <NoteGroupProgress
                              progress={noteGroupProgress}
                              range={progressRange}
                              loading={noteGroupProgressLoading}
                              error={noteGroupProgressError}
                              onRangeChange={setProgressRange}
                              onOpenPerformance={() =>
                                navigate(
                                  noteGroupPath(
                                    selectedSubjectCode,
                                    selectedModuleCode,
                                    selectedNoteGroupCode,
                                    "view-cards"
                                  )
                                )
                              }
                            />
                          </>
                        )}
                        {isTopicScope ? (
                          <section
                            className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
                            id="note-group-shortcuts"
                          >
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h3 className="text-base font-semibold">Shortcuts</h3>
                                <p className={mutedTextClass}>Quick actions for this topic.</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => startReview("due", "topic")}
                                disabled={!canUseProtectedActions || !selectedTopicId || isReviewing}
                              >
                                Review due
                                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  {noteGroupStats.dueCount}
                                </span>
                              </Button>
                            </div>
                          </section>
                        ) : null}
                      </div>
                    ) : null}

                    {isViewCardsPage ? (
                      <>
                        <section className="flex flex-wrap items-start gap-3">
                          <button className="back-button" type="button" onClick={handleBackToOverview}>
                            ← Back
                          </button>
                          <div>
                            <h2>View Cards</h2>
                            <p className={mutedTextClass}>
                              Study Cards with their linked Question Cards.
                            </p>
                          </div>
                        </section>
                        <NoteGroupViewCards
                          rows={isTopicScope ? topicCardTableRows : noteGroupCardTable.rows}
                          studyCards={studyCards}
                          questionCards={questionCards}
                          topicChips={topicChips}
                          canEdit={canEditCurrentCards}
                          showEditControls={canUseProtectedActions}
                          editingStudyCardId={editingStudyCardId}
                          editingStudyCard={editingStudyCard}
                          editingQuestionCardId={editingQuestionCardId}
                          editingQuestionCard={editingQuestionCard}
                          fixedTopicFilter={isTopicScope ? selectedTopic : null}
                          unlinkedQuestionCount={
                            isTopicScope
                              ? topicUnlinkedQuestionCount
                              : noteGroupCardTable.unlinked_question_count
                          }
                          loading={isTopicScope ? false : noteGroupCardTableLoading}
                          error={isTopicScope ? studyCardError || questionCardError : noteGroupCardTableError}
                          onEditStudyCard={handleEditStudyCard}
                          onEditingStudyCardChange={setEditingStudyCard}
                          onSaveStudyCard={handleSaveStudyCard}
                          onCancelStudyCardEdit={() => setEditingStudyCardId("")}
                          onDeleteStudyCard={handleDeleteStudyCard}
                          onEditQuestionCard={handleEditQuestionCard}
                          onEditingQuestionCardChange={setEditingQuestionCard}
                          onSaveQuestionCard={handleSaveQuestionCard}
                          onCancelQuestionCardEdit={() => setEditingQuestionCardId("")}
                          onDeleteQuestionCard={handleDeleteQuestionCard}
                        />
                      </>
                    ) : null}

                    {isStudyPage ? (
                      <>
                        <section className={` flex flex-wrap items-start gap-3`}>
                          <button className="back-button" type="button" onClick={handleBackToOverview}>
                            ← Back
                          </button>
                          <div>
                            <h2>Study cards</h2>
                            <p className={mutedTextClass}>
                              {isTopicScope
                                ? "Read study cards for this topic."
                                : "Manage study cards for this note group."}
                            </p>
                          </div>
                        </section>
                      <StudyCardList
                          cards={filteredStudyCards}
                          canEdit={canEditCurrentCards}
                          showEditControls={canUseProtectedActions}
                          topicChips={topicChips}
                          editingStudyCardId={editingStudyCardId}
                          editingStudyCard={editingStudyCard}
                          error={studyCardError}
                          onCreate={openStudyCreateModal}
                          onEdit={handleEditStudyCard}
                          onEditingChange={setEditingStudyCard}
                          onSave={handleSaveStudyCard}
                          onCancelEdit={() => setEditingStudyCardId("")}
                          onDelete={handleDeleteStudyCard}
                          onToggleTopic={(topicId) =>
                            setEditingStudyCard((prev) => ({
                              ...prev,
                              chipIds: prev.chipIds.includes(topicId)
                                ? prev.chipIds.filter((id) => id !== topicId)
                                : [...prev.chipIds, topicId]
                            }))
                          }
                        />
                      </>
                    ) : null}

                    {isQuestionPage ? (
                      <>
                        <section className={` flex flex-wrap items-start gap-3`}>
                          <button className="back-button" type="button" onClick={handleBackToOverview}>
                            ← Back
                          </button>
                          <div>
                            <h2>Question cards</h2>
                            <p className={mutedTextClass}>
                              {isTopicScope
                                ? "Review question cards for this topic."
                                : "Review, generate, and edit question cards."}
                            </p>
                          </div>
                        </section>
                        <section className={panelClass} id="question-timeline">
                          <h2>Question timeline</h2>
                          <div className="stats-grid">
                            <div className="stat-card">
                              <p className="label">Due</p>
                              <p className="value">{questionTimeline.due}</p>
                            </div>
                            <div className="stat-card">
                              <p className="label">&lt; 1 week</p>
                              <p className="value">{questionTimeline.week}</p>
                            </div>
                            <div className="stat-card">
                              <p className="label">&lt; 1 month</p>
                              <p className="value">{questionTimeline.month}</p>
                            </div>
                            <div className="stat-card">
                              <p className="label">&lt; 6 months</p>
                              <p className="value">{questionTimeline.sixMonths}</p>
                            </div>
                            <div className="stat-card">
                              <p className="label">&gt; 6 months</p>
                              <p className="value">{questionTimeline.longTerm}</p>
                            </div>
                          </div>
                          <p className={mutedTextClass}>
                            Due includes anything scheduled within the next 6 hours.
                          </p>
                        </section>

                      <QuestionCardList
                          cards={questionCardsForDisplay}
                          masteryFilter={masteryFilter}
                          reviewCount={reviewCount}
                          generationStatus={questionJobStatus}
                          generating={isGeneratingQuestions}
                          canEdit={canEditCurrentCards}
                          showEditControls={canUseProtectedActions}
                          canReview={canUseProtectedActions}
                          editingQuestionCardId={editingQuestionCardId}
                          editingQuestionCard={editingQuestionCard}
                          studyCards={studyCards}
                          error={questionCardError || reviewError}
                          onMasteryFilterChange={setMasteryFilter}
                          onReviewCountChange={setReviewCount}
                          onStartReviewDue={() => startReview("due", isTopicScope ? "topic" : "note-group")}
                          onStartReviewNext={() => startReview("queue", isTopicScope ? "topic" : "note-group")}
                          onStartReviewAll={() => startReview("all", isTopicScope ? "topic" : "note-group")}
                          onCreate={openQuestionCreateModal}
                          onEdit={handleEditQuestionCard}
                          onEditingChange={setEditingQuestionCard}
                          onSave={handleSaveQuestionCard}
                          onCancelEdit={() => setEditingQuestionCardId("")}
                          onDelete={handleDeleteQuestionCard}
                          onFocus={openQuestionFocus}
                          onGenerate={handleGenerateQuestions}
                          onCancelGeneration={() => {}}
                          onToggleReference={(studyCardId) =>
                            setEditingQuestionCard((prev) => ({
                              ...prev,
                              refs: prev.refs.includes(studyCardId)
                                ? prev.refs.filter((id) => id !== studyCardId)
                                : [...prev.refs, studyCardId]
                            }))
                          }
                        />
                      </>
                    ) : null}
                  </>
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
