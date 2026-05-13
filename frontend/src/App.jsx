import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Select from "react-select";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
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
  detachTopicChip,
  finalizeNoteGroup,
  generateQuestionCards,
  getJob,
  getModuleQuestionTimeline,
  getNoteGroupQuestionTimeline,
  getNoteGroup,
  getStudyCard,
  getTitleSuggestions,
  listJobs,
  listModuleReviewQuestionCards,
  listModules,
  listNoteGroups,
  listQuestionCards,
  listReviewQuestionCards,
  listStudyCards,
  listSubjects,
  listTopicChips,
  retryAutoJob,
  reviewQuestionCard,
  sendChat,
  sendModuleIntentChat,
  sendSubjectIntentChat,
  updateNoteGroupOrder,
  suggestTopicChips,
  updateNoteGroupTitle,
  updateQuestionCard,
  updateStudyCard,
  updateModule,
  updateSubject
} from "./api";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const formatCreatedAt = (value) => {
  if (!value) {
    return "Created: —";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Created: —";
  }
  return `Created: ${date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  })}`;
};

const normalizeNoteGroups = (groups) => {
  if (!Array.isArray(groups)) {
    return [];
  }
  const hasCustomOrder = groups.some(
    (group) => group.sort_order !== null && group.sort_order !== undefined
  );
  if (hasCustomOrder) {
    return groups;
  }
  return [...groups].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : Number.POSITIVE_INFINITY;
    const safeATime = Number.isNaN(aTime) ? Number.POSITIVE_INFINITY : aTime;
    const safeBTime = Number.isNaN(bTime) ? Number.POSITIVE_INFINITY : bTime;
    return safeATime - safeBTime;
  });
};


const getModuleAdditionalInstructions = (module) => {
  const value = module?.settings?.additional_generation_instructions;
  if (typeof value === "string") {
    return value;
  }
  return "";
};

const countWords = (value) => {
  if (!value) {
    return 0;
  }
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
};

const normalizeTimeline = (timeline = {}) => ({
  due: Number.isInteger(timeline.due) ? timeline.due : 0,
  week: Number.isInteger(timeline.week) ? timeline.week : 0,
  month: Number.isInteger(timeline.month) ? timeline.month : 0,
  sixMonths: Number.isInteger(timeline.six_months)
    ? timeline.six_months
    : Number.isInteger(timeline.sixMonths)
      ? timeline.sixMonths
      : 0,
  longTerm: Number.isInteger(timeline.long_term)
    ? timeline.long_term
    : Number.isInteger(timeline.longTerm)
      ? timeline.longTerm
      : 0
});

const MASTERY_MAX = 10;
const MASTERY_LOW_MAX = 3;
const MASTERY_MEDIUM_MAX = 6;

const renderInlineText = (text) => {
  const segments = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  let keyIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }
    segments.push(
      <strong key={`strong-${keyIndex}`}>{match[1]}</strong>
    );
    keyIndex += 1;
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }
  return segments;
};

const renderMarkdownBlocks = (content) => {
  if (!content) {
    return null;
  }
  const elements = [];
  const lines = content.split("\n");
  let paragraphLines = [];
  let listItems = [];
  let blockIndex = 0;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }
    const text = paragraphLines.join(" ").trim();
    elements.push(
      <p key={`paragraph-${blockIndex}`}>{renderInlineText(text)}</p>
    );
    blockIndex += 1;
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    elements.push(
      <ul key={`list-${blockIndex}`}>
        {listItems.map((item, index) => (
          <li key={`list-item-${blockIndex}-${index}`}>{renderInlineText(item)}</li>
        ))}
      </ul>
    );
    blockIndex += 1;
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    if (trimmed.startsWith("- ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2).trim());
      return;
    }
    flushList();
    paragraphLines.push(trimmed);
  });

  flushParagraph();
  flushList();
  return elements;
};

const getOverlappingHighlights = (start, end, highlights) =>
  highlights.filter((highlight) => start < highlight.end_index && end > highlight.start_index);

const renderInlineMarkdown = (text, keyPrefix) => {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-b${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={`${keyPrefix}-e${i}`}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

const renderHighlightedText = (text, baseIndex, highlights) => {
  if (!text) {
    return null;
  }
  const boundaries = new Set([0, text.length]);
  highlights.forEach((highlight) => {
    const start = Math.max(0, highlight.start_index - baseIndex);
    const end = Math.min(text.length, highlight.end_index - baseIndex);
    if (start < end) {
      boundaries.add(start);
      boundaries.add(end);
    }
  });
  const sorted = [...boundaries].sort((a, b) => a - b);
  return sorted.slice(0, -1).map((start, index) => {
    const end = sorted[index + 1];
    const segment = text.slice(start, end);
    const overlapping = getOverlappingHighlights(baseIndex + start, baseIndex + end, highlights);
    const pinned = overlapping.find((highlight) => highlight.kind === "pinned");
    const hovered = overlapping.find((highlight) => highlight.kind === "hovered");
    const active = pinned || hovered;
    if (!active) {
      return renderInlineMarkdown(segment, `seg-${baseIndex}-${start}`);
    }
    return (
      <mark
        key={`highlight-${baseIndex}-${start}-${end}`}
        className={`source-highlight ${active.kind}`}
        data-clean-card-id={active.study_card_id}
      >
        {renderInlineMarkdown(segment, `mark-${baseIndex}-${start}`)}
      </mark>
    );
  });
};

const renderCleanedMarkdown = (content, highlights) => {
  if (!content) {
    return null;
  }
  const lines = content.split("\n");
  let offset = 0;
  return lines.map((line, index) => {
    const lineStart = offset;
    offset += line.length + 1;
    if (!line.trim()) {
      return <div key={`clean-line-${index}`} className="clean-line-break" />;
    }
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const markerLength = headingMatch[1].length + 1;
      const text = headingMatch[2];
      const Tag = headingMatch[1].length === 1 ? "h2" : "h3";
      return (
        <Tag key={`clean-line-${index}`}>
          {renderHighlightedText(text, lineStart + markerLength, highlights)}
        </Tag>
      );
    }
    if (line.trimStart().startsWith("- ")) {
      const leading = line.length - line.trimStart().length;
      const textStart = lineStart + leading + 2;
      const text = line.trimStart().slice(2);
      return (
        <p key={`clean-line-${index}`} className="clean-bullet">
          {renderHighlightedText(text, textStart, highlights)}
        </p>
      );
    }
    return (
      <p key={`clean-line-${index}`}>
        {renderHighlightedText(line, lineStart, highlights)}
      </p>
    );
  });
};

const formatAnswerLabels = (card, indices) => {
  if (!card || !Array.isArray(indices) || indices.length === 0) {
    return "No answer";
  }
  const options = card.reviewChoices
    ? card.reviewChoices.map((choice) => choice.text)
    : card.reviewOptions || card.options || [];
  const labels = indices
    .map((index) => options?.[index])
    .filter((option) => Boolean(option));
  return labels.length ? labels.join(", ") : "No answer";
};

const getNoteGroupStatusMeta = (status) => {
  if (!status || status === "complete") {
    return null;
  }
  if (status === "queued") {
    return { label: "Queued", className: "status-queued" };
  }
  if (status === "generating") {
    return { label: "Generating", className: "status-running" };
  }
  if (status === "failed") {
    return { label: "Failed", className: "status-failed" };
  }
  if (status === "cancelled") {
    return { label: "Cancelled", className: "status-failed" };
  }
  if (status === "created") {
    return { label: "Draft", className: "status-queued" };
  }
  return { label: status, className: "status-queued" };
};

const selectStyles = {
  menuPortal: (base) => ({ ...base, zIndex: 9999 })
};

export default function App() {
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
  const [selectedNoteGroupId, setSelectedNoteGroupId] = useState("");
  const [noteGroupSource, setNoteGroupSource] = useState("");
  const [sourceChecking, setSourceChecking] = useState(false);
  const [sourceChecked, setSourceChecked] = useState(false);
  const [sourceConfirmed, setSourceConfirmed] = useState(false);
  const [sourceDuplicateCount, setSourceDuplicateCount] = useState(0);
  const [sourceDuplicates, setSourceDuplicates] = useState([]);
  const [sourceCheckError, setSourceCheckError] = useState("");
  const [noteGroupSearch, setNoteGroupSearch] = useState("");
  const [noteGroupMode, setNoteGroupMode] = useState("overview");
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
  const [isReadingOpen, setIsReadingOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [metadataTitleDraft, setMetadataTitleDraft] = useState("");
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataError, setMetadataError] = useState("");

  const [topicChips, setTopicChips] = useState([]);
  const [chipFilterIds, setChipFilterIds] = useState([]);
  const [noteGroupChipIds, setNoteGroupChipIds] = useState([]);
  const [wizardChipLabel, setWizardChipLabel] = useState("");
  const [moduleChipLabel, setModuleChipLabel] = useState("");
  const [moduleChipDescription, setModuleChipDescription] = useState("");

  const [rawTextDraft, setRawTextDraft] = useState("");
  const [additionalInstructionsDraft, setAdditionalInstructionsDraft] = useState("");
  const [autoRawText, setAutoRawText] = useState("");
  const [autoAdditionalInstructions, setAutoAdditionalInstructions] = useState("");
  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const [selectedTitleSuggestion, setSelectedTitleSuggestion] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [hasTitleSuggestions, setHasTitleSuggestions] = useState(false);
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleError, setTitleError] = useState("");

  const [chipSuggestionIds, setChipSuggestionIds] = useState([]);
  const [chipSuggestionNew, setChipSuggestionNew] = useState([]);
  const [selectedExistingChipIds, setSelectedExistingChipIds] = useState([]);
  const [selectedNewChipLabels, setSelectedNewChipLabels] = useState([]);
  const [hasChipSuggestions, setHasChipSuggestions] = useState(false);
  const [chipLoading, setChipLoading] = useState(false);
  const [chipError, setChipError] = useState("");

  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [finalizeError, setFinalizeError] = useState("");
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
  const [scopeToNoteGroup, setScopeToNoteGroup] = useState(false);
  const [chatView, setChatView] = useState("chat");
  const [chatCardId, setChatCardId] = useState("");
  const [chatCardCache, setChatCardCache] = useState({});
  const [chatCardLoading, setChatCardLoading] = useState(false);
  const [chatCardError, setChatCardError] = useState("");
  const readingContentRef = useRef(null);
  const chatListRef = useRef(null);
  const reviewChatListRef = useRef(null);
  const wizardChatRef = useRef(null);
  const selectedModuleIdRef = useRef(selectedModuleId);
  const activeAutoJobsRef = useRef(new Set());
  const reviewDKeyTimeRef = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();
  const routeMatch = location.pathname.match(/^\/note-groups\/([^/]+)\/(study-cards|question-cards)$/);
  const routeNoteGroupId = routeMatch ? routeMatch[1] : "";
  const routePanel = routeMatch ? routeMatch[2] : "";
  const isStudyPage = routePanel === "study-cards";
  const isQuestionPage = routePanel === "question-cards";

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );
  const selectedModule = useMemo(
    () => modules.find((module) => module.id === selectedModuleId),
    [modules, selectedModuleId]
  );
  const selectedNoteGroup = useMemo(
    () => noteGroups.find((group) => group.id === selectedNoteGroupId),
    [noteGroups, selectedNoteGroupId]
  );
  const focusQuestionCard = useMemo(
    () => questionCards.find((card) => card.id === focusQuestionCardId),
    [questionCards, focusQuestionCardId]
  );

  const buildReviewCard = (card) => {
    const options = Array.isArray(card.options) ? card.options : [];
    const explanations = Array.isArray(card.option_explanations)
      ? card.option_explanations
      : [];
    if (!options.length) {
      return {
        ...card,
        reviewOptions: options,
        reviewCorrectIndices: card.correct_option_indices || [],
        reviewOptionExplanations: explanations,
        reviewChoices: []
      };
    }
    const indices = options.map((_, idx) => idx);
    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const newIndexByOld = new Map();
    indices.forEach((oldIndex, newIndex) => {
      newIndexByOld.set(oldIndex, newIndex);
    });
    const reviewChoices = indices.map((idx) => ({
      text: options[idx],
      explanation: explanations[idx] || "",
      originalIndex: idx
    }));
    const reviewOptions = reviewChoices.map((choice) => choice.text);
    const reviewOptionExplanations = reviewChoices.map((choice) => choice.explanation);
    const reviewCorrectIndices = (card.correct_option_indices || [])
      .map((idx) => newIndexByOld.get(idx))
      .filter((idx) => Number.isInteger(idx));
    return {
      ...card,
      reviewOptions,
      reviewCorrectIndices,
      reviewOptionExplanations,
      reviewChoices
    };
  };

  const getMasteryScore = (card) => {
    const difficulty = Number(card?.difficulty);
    if (!Number.isFinite(difficulty) || difficulty <= 0) {
      return null;
    }
    const score = MASTERY_MAX - difficulty;
    return Math.max(0, Math.min(MASTERY_MAX, score));
  };

  const getMasteryTier = (score) => {
    if (score === null) {
      return "unknown";
    }
    if (score <= MASTERY_LOW_MAX) {
      return "low";
    }
    if (score <= MASTERY_MEDIUM_MAX) {
      return "medium";
    }
    return "high";
  };

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
    if (noteGroupMode === "create") {
      return [
        { id: "step-source", label: "Source" },
        { id: "step-raw", label: "Paste raw text" },
        { id: "step-title", label: "Choose a title" },
        { id: "step-chips", label: "Select topic chips" },
        { id: "step-finalize", label: "Generate study cards" }
      ];
    }
    if (noteGroupMode === "auto") {
      return [{ id: "auto-note-group", label: "Auto-create" }];
    }
    if (!selectedModuleId) {
      return [];
    }
    if (!selectedNoteGroupId) {
      return [
        { id: "module-overview", label: "Module overview" },
        { id: "module-review", label: "Review queue" },
        { id: "module-timeline", label: "Question timeline" },
        { id: "module-note-groups", label: "Note groups" }
      ];
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
    return [{ id: "note-group-overview", label: "Overview" }];
  }, [noteGroupMode, selectedModuleId, selectedNoteGroupId, isStudyPage, isQuestionPage]);

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
  const newChipDisplay = useMemo(() => {
    const merged = [...chipSuggestionNew, ...selectedNewChipLabels];
    return Array.from(new Set(merged));
  }, [chipSuggestionNew, selectedNewChipLabels]);

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
    reviewScope === "module" ? currentReviewCard?.note_group_id : selectedNoteGroupId;
  const reviewCardRefs = currentReviewCard?.study_card_refs || [];
  const reviewRefsMessage = reviewCardRefs.length
    ? "The relevant study cards are:"
    : "The relevant study cards are: no study card is linked to this question.";
  const isReviewOverlayVisible = isReviewing || Boolean(reviewSummary);
  const isSourceReady = sourceConfirmed;
  const canReorderNoteGroups = Boolean(
    selectedModuleId &&
      !selectedNoteGroupId &&
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
    listSubjects()
      .then((data) => setSubjects(data))
      .catch((error) => setSidebarError(error.message));
  }, []);

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
      .catch((error) => setSidebarError(error.message));
  }, [selectedSubjectId]);

  useEffect(() => {
    if (!selectedModuleId) {
      setNoteGroups([]);
      setSelectedNoteGroupId("");
      setTopicChips([]);
      setChipFilterIds([]);
      return;
    }
    setChipFilterIds([]);
    listTopicChips(selectedModuleId)
      .then((data) => setTopicChips(data))
      .catch((error) => setSidebarError(error.message));
  }, [selectedModuleId]);

  useEffect(() => {
    setNoteGroupSearch("");
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
    setSourceChecked(false);
    setSourceConfirmed(false);
    setSourceDuplicateCount(0);
    setSourceDuplicates([]);
    setSourceCheckError("");
    setSourceChecking(false);
  }, [noteGroupSource]);

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
          setSidebarError(error.message || "Failed to load module due counts");
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
      setSelectedNoteGroupId("");
      return;
    }
    listNoteGroups(selectedModuleId)
      .then((data) => {
        setNoteGroups(normalizeNoteGroups(data));
        if (
          !routeNoteGroupId &&
          selectedNoteGroupId &&
          !data.some((group) => group.id === selectedNoteGroupId)
        ) {
          setSelectedNoteGroupId("");
        }
      })
      .catch((error) => setSidebarError(error.message));
  }, [selectedModuleId, routeNoteGroupId, selectedNoteGroupId]);

  useEffect(() => {
    if (!selectedModuleId) {
      return;
    }
    loadAutoJobs(selectedModuleId).catch((error) => {
      if (error.message === "Not Found") {
        return;
      }
      toast.error(error.message || "Failed to check auto note group jobs.");
    });
  }, [selectedModuleId]);

  useEffect(() => {
    if (!selectedModuleId) {
      setModuleNoteGroupStats([]);
      setModuleStats({
        studyCount: 0,
        questionCount: 0,
        dueCount: 0,
        staleCount: 0
      });
      setModuleStatsError("");
      setModuleStatsLoading(false);
      return;
    }
    if (noteGroups.length === 0) {
      setModuleNoteGroupStats([]);
      setModuleStats({
        studyCount: 0,
        questionCount: 0,
        dueCount: 0,
        staleCount: 0
      });
      setModuleStatsError("");
      setModuleStatsLoading(false);
      return;
    }
    let cancelled = false;
    const loadStats = async () => {
      setModuleStatsLoading(true);
      setModuleStatsError("");
      try {
        const stats = await Promise.all(
          noteGroups.map(async (group) => {
            const [studyResponse, timelineResponse] = await Promise.all([
              listStudyCards(group.id),
              getNoteGroupQuestionTimeline(group.id, chipFilterIds)
            ]);
            const studyCardsList = studyResponse.study_cards || [];
            let filteredStudyCardsList = studyCardsList;
            if (chipFilterIds.length) {
              filteredStudyCardsList = studyCardsList.filter((card) =>
                (card.topic_chips || []).some((chip) => chipFilterIds.includes(chip.id))
              );
            }
            const timeline = normalizeTimeline(timelineResponse.timeline);
            return {
              id: group.id,
              title: group.title || "Untitled note group",
              studyCount: filteredStudyCardsList.length,
              questionCount: timelineResponse.question_count || 0,
              dueCount: timeline.due,
              staleCount: timelineResponse.stale_count || 0,
              timeline
            };
          })
        );
        if (cancelled) {
          return;
        }
        setModuleNoteGroupStats(stats);
        setModuleStats(
          stats.reduce(
            (acc, group) => ({
              studyCount: acc.studyCount + group.studyCount,
              questionCount: acc.questionCount + group.questionCount,
              dueCount: acc.dueCount + group.dueCount,
              staleCount: acc.staleCount + group.staleCount
            }),
            { studyCount: 0, questionCount: 0, dueCount: 0, staleCount: 0 }
          )
        );
      } catch (error) {
        if (!cancelled) {
          setModuleStatsError(error.message || "Failed to load module stats");
        }
      } finally {
        if (!cancelled) {
          setModuleStatsLoading(false);
        }
      }
    };

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [selectedModuleId, noteGroups, chipFilterIds, reviewRefreshToken]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedModuleId) {
      setModuleQuestionTimeline({
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
        const data = await getModuleQuestionTimeline(selectedModuleId, chipFilterIds);
        if (cancelled) {
          return;
        }
        setModuleQuestionTimeline(normalizeTimeline(data.timeline));
      } catch (error) {
        if (!cancelled) {
          setModuleQuestionTimeline({
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
  }, [selectedModuleId, chipFilterIds, noteGroups, reviewRefreshToken]);

  useEffect(() => {
    if (!selectedNoteGroupId) {
      setStudyCards([]);
      setQuestionCards([]);
      setNoteGroupChipIds([]);
      setMetadataTitleDraft("");
      setFormattedSections([]);
      setCleanedTextMarkdown("");
      return;
    }
    setStudyCardError("");
    setQuestionCardError("");
    setQuestionJobStatus("idle");
    getNoteGroup(selectedNoteGroupId)
      .then((data) => {
        setNoteGroupChipIds((data.topic_chips || []).map((chip) => chip.id));
        setMetadataTitleDraft(data.title || "");
        setFormattedSections(data.formatted_sections || []);
        setCleanedTextMarkdown(data.cleaned_text_markdown || "");
        if (data.module_id && data.module_id !== selectedModuleId) {
          setSelectedModuleId(data.module_id);
        }
      })
      .catch((error) => setStudyCardError(error.message));
    listStudyCards(selectedNoteGroupId)
      .then((data) => setStudyCards(data.study_cards || []))
      .catch((error) => setStudyCardError(error.message));
    listQuestionCards(selectedNoteGroupId)
      .then((data) => setQuestionCards(data.question_cards || []))
      .catch((error) => setQuestionCardError(error.message));
  }, [selectedNoteGroupId]);

  useEffect(() => {
    if (!isReadingOpen) {
      setReadingHoverCardId("");
      setReadingPinnedCardId("");
      setReadingMode("study");
    }
  }, [isReadingOpen]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedNoteGroupId) {
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
        const data = await getNoteGroupQuestionTimeline(
          selectedNoteGroupId,
          chipFilterIds
        );
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
  }, [selectedNoteGroupId, chipFilterIds, questionCards, reviewRefreshToken]);

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
  }, [selectedNoteGroupId, selectedModuleId]);

  useEffect(() => {
    setNewQuestionRefs([]);
    setNewStudyCardChipIds([]);
  }, [selectedNoteGroupId]);

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
    setReviewScope("note-group");
    setReviewDeleteStep(0);
    setReviewDeleteLoading(false);
  }, [selectedNoteGroupId, selectedModuleId]);

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
  }, [reviewIndex, reviewSummary, selectedNoteGroupId, selectedModuleId]);

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
    selectedModuleIdRef.current = selectedModuleId;
  }, [selectedModuleId]);

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
    if (routeNoteGroupId && routeNoteGroupId !== selectedNoteGroupId) {
      setSelectedNoteGroupId(routeNoteGroupId);
    }
    if (routeNoteGroupId) {
      setNoteGroupMode("overview");
    }
  }, [routeNoteGroupId]);

  useEffect(() => {
    if (routePanel) {
      setIsChatOpen(false);
      setIsMetadataOpen(false);
    }
  }, [routePanel]);

  useEffect(() => {
    setRawTextDraft("");
    setAutoRawText("");
    setTitleSuggestions([]);
    setSelectedTitleSuggestion("");
    setCustomTitle("");
    setHasTitleSuggestions(false);
    setTitleError("");
    setChipSuggestionIds([]);
    setChipSuggestionNew([]);
    setSelectedExistingChipIds([]);
    setSelectedNewChipLabels([]);
    setHasChipSuggestions(false);
    setChipError("");
    setAutoCreateError("");
    setSidebarError("");
    setAdditionalInstructionsDraft(getModuleAdditionalInstructions(selectedModule));
    setAutoAdditionalInstructions(getModuleAdditionalInstructions(selectedModule));
  }, [selectedModuleId]);

  useEffect(() => {
    if (!selectedNoteGroupId) {
      setScopeToNoteGroup(false);
    }
  }, [selectedNoteGroupId]);

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

  const trackAutoNoteGroupJob = (jobId, moduleId) => {
    if (activeAutoJobsRef.current.has(jobId)) {
      return;
    }
    activeAutoJobsRef.current.add(jobId);
    pollJob(jobId, () => null, { maxAttempts: 180, intervalMs: 2000 })
      .then(async (job) => {
        let toastLabel = "Auto note group ready.";
        let resolvedModuleId = moduleId;
        if (job.note_group_id) {
          try {
            const noteGroup = await getNoteGroup(job.note_group_id);
            if (noteGroup?.title) {
              toastLabel = `Auto note group ready: ${noteGroup.title}`;
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
            const [groups, chips] = await Promise.all([
              listNoteGroups(resolvedModuleId),
              listTopicChips(resolvedModuleId)
            ]);
            setNoteGroups(normalizeNoteGroups(groups));
            setTopicChips(chips);
          } catch (error) {
            toast.error(error.message || "Failed to refresh auto-generated note group.");
          }
        }
        setReviewRefreshToken((prev) => prev + 1);
        if (resolvedModuleId) {
          loadAutoJobs(resolvedModuleId).catch(() => null);
        }
      })
      .catch((error) => {
        if (error.message === "Job cancelled") {
          toast.info("Auto note group cancelled.");
        } else {
          toast.error(error.message || "Auto note group generation failed.");
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

  const handleSelectSubject = (option) => {
    const nextId = option ? option.value : "";
    setSelectedSubjectId(nextId);
    setSelectedModuleId("");
    setSelectedNoteGroupId("");
    setNoteGroupSearch("");
    setNoteGroupMode("overview");
    setReviewSummary(null);
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    navigate("/");
  };

  const handleSelectModule = (option) => {
    const nextId = option ? option.value : "";
    setSelectedModuleId(nextId);
    setSelectedNoteGroupId("");
    setNoteGroupSearch("");
    setNoteGroupMode("overview");
    setReviewSummary(null);
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    navigate("/");
  };

  const handleCreateSubject = async () => {
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
      setNoteGroupMode("overview");
      setReviewSummary(null);
      setIsChatOpen(false);
      setIsMetadataOpen(false);
      setIsModuleMetadataOpen(false);
      navigate("/");
      setNewSubjectTitle("");
      setNewSubjectDescription("");
    } catch (error) {
      setSidebarError(error.message || "Failed to create subject");
    }
  };

  const handleOpenSubjectWizard = () => {
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
      setNoteGroupMode("overview");
      setReviewSummary(null);
      setIsChatOpen(false);
      setIsMetadataOpen(false);
      setIsModuleMetadataOpen(false);
      setIsSubjectWizardOpen(false);
      navigate("/");
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
    setEditingSubjectId(subject.id);
    setSubjectTitleDraft(subject.title || "");
    setSubjectGoalDraft(subject.goal || "");
    setSubjectScopeDraft(subject.scope || "");
    setSubjectMetadataError("");
    setIsSubjectMetadataOpen(true);
  };

  const handleSaveSubjectMetadata = async (subjectId) => {
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
    const subjectLabel =
      subjectOverride?.title || selectedSubject?.title || "this subject";
    const confirmed = window.confirm(
      `Delete "${subjectLabel}"? This removes all modules, note groups, and cards in it.`
    );
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
      navigate("/");
    } catch (error) {
      setModuleWizardError(error.message || "Failed to create module");
    } finally {
      setModuleWizardCreating(false);
    }
  };

  const handleDeleteModule = async (moduleOverride) => {
    const moduleId = moduleOverride?.id || selectedModuleId;
    if (!moduleId) {
      return;
    }
    const moduleLabel = moduleOverride?.title || selectedModule?.title || "this module";
    const confirmed = window.confirm(
      `Delete "${moduleLabel}"? This removes all note groups and cards in it.`
    );
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
        navigate("/");
      }
    } catch (error) {
      setSidebarError(error.message || "Failed to delete module");
    }
  };

  const navigateToNoteGroup = (noteGroupId, panelOverride = "") => {
    setSelectedNoteGroupId(noteGroupId);
    setNoteGroupMode("overview");
    setReviewSummary(null);
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    if (!noteGroupId) {
      navigate("/");
      return;
    }
    const nextPanel = panelOverride || routePanel;
    if (nextPanel) {
      navigate(`/note-groups/${noteGroupId}/${nextPanel}`);
      return;
    }
    navigate("/");
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

  const resetSourceState = () => {
    setNoteGroupSource("");
    setSourceChecked(false);
    setSourceConfirmed(false);
    setSourceDuplicateCount(0);
    setSourceDuplicates([]);
    setSourceCheckError("");
    setSourceChecking(false);
  };

  const handleCheckSource = async () => {
    const trimmed = noteGroupSource.trim();
    if (!trimmed) {
      setSourceCheckError("Source is required before continuing.");
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
      setSourceCheckError(error.message || "Failed to check source.");
    } finally {
      setSourceChecking(false);
    }
  };

  const handleConfirmDuplicateSource = () => {
    setSourceConfirmed(true);
  };

  const handleStartCreateNoteGroup = () => {
    setNoteGroupMode("create");
    setSelectedNoteGroupId("");
    setReviewSummary(null);
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    navigate("/");
  };

  const handleStartAutoNoteGroup = () => {
    setNoteGroupMode("auto");
    setSelectedNoteGroupId("");
    setReviewSummary(null);
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    setAutoCreateError("");
    navigate("/");
  };

  const handleGenerateTitleSuggestions = async () => {
    if (!selectedModuleId || !rawTextDraft.trim()) {
      return;
    }
    setTitleLoading(true);
    setTitleError("");
    try {
      const response = await getTitleSuggestions({
        module_id: selectedModuleId,
        raw_text: rawTextDraft.trim()
      });
      const suggestions = response.titles || [];
      setTitleSuggestions(suggestions);
      if (suggestions.length > 0) {
        setSelectedTitleSuggestion(suggestions[0]);
        setCustomTitle(suggestions[0]);
      }
      setHasTitleSuggestions(true);
    } catch (error) {
      setTitleError(error.message || "Failed to generate titles");
    } finally {
      setTitleLoading(false);
    }
  };

  const handleSelectTitleSuggestion = (title) => {
    setSelectedTitleSuggestion(title);
    setCustomTitle(title);
  };

  const handleGenerateChipSuggestions = async () => {
    if (!selectedModuleId || !rawTextDraft.trim()) {
      return;
    }
    setChipLoading(true);
    setChipError("");
    try {
      const response = await suggestTopicChips({
        module_id: selectedModuleId,
        raw_text: rawTextDraft.trim()
      });
      const suggestedExisting = response.suggested_existing_ids || [];
      const newChips = response.new_chips || [];
      setChipSuggestionIds(suggestedExisting);
      setChipSuggestionNew(newChips);
      setSelectedExistingChipIds(suggestedExisting);
      setSelectedNewChipLabels(newChips);
      setHasChipSuggestions(true);
    } catch (error) {
      setChipError(error.message || "Failed to generate topic chips");
    } finally {
      setChipLoading(false);
    }
  };

  const handleToggleExistingChip = (chipId) => {
    setSelectedExistingChipIds((prev) =>
      prev.includes(chipId) ? prev.filter((id) => id !== chipId) : [...prev, chipId]
    );
  };

  const handleToggleNewChip = (chipLabel) => {
    setSelectedNewChipLabels((prev) =>
      prev.includes(chipLabel)
        ? prev.filter((label) => label !== chipLabel)
        : [...prev, chipLabel]
    );
  };

  const handleAddNewChipLabel = () => {
    const label = wizardChipLabel.trim();
    if (!label) {
      return;
    }
    setSelectedNewChipLabels((prev) =>
      prev.includes(label) ? prev : [...prev, label]
    );
    setWizardChipLabel("");
  };

  const handleFinalizeNoteGroup = async () => {
    const finalTitle = customTitle.trim() || selectedTitleSuggestion.trim();
    const trimmedSource = noteGroupSource.trim();
    if (!trimmedSource) {
      setFinalizeError("Source is required before continuing.");
      return;
    }
    if (!sourceConfirmed) {
      setFinalizeError("Check the source before continuing.");
      return;
    }
    if (!selectedModuleId || !rawTextDraft.trim() || !finalTitle) {
      setFinalizeError("Provide raw text and select a title first.");
      return;
    }
    if (countWords(additionalInstructionsDraft) > 500) {
      setFinalizeError("Additional generation instructions must be 500 words or fewer.");
      return;
    }
    if (!hasTitleSuggestions || !hasChipSuggestions) {
      setFinalizeError("Generate title and topic chip suggestions before finalizing.");
      return;
    }
    setFinalizeLoading(true);
    setSidebarError("");
    try {
      const response = await finalizeNoteGroup({
        module_id: selectedModuleId,
        source: trimmedSource,
        raw_text: rawTextDraft.trim(),
        title: finalTitle,
        additional_generation_instructions: additionalInstructionsDraft.trim(),
        existing_chip_ids: selectedExistingChipIds,
        new_chip_labels: selectedNewChipLabels
      });
      const createdNoteGroup = response.note_group;
      setSelectedNoteGroupId(createdNoteGroup.id);
      setNoteGroupChipIds((createdNoteGroup.topic_chips || []).map((chip) => chip.id));
      setFormattedSections(createdNoteGroup.formatted_sections || []);
      setCleanedTextMarkdown(createdNoteGroup.cleaned_text_markdown || "");
      setStudyCards(response.study_cards || []);
      const groups = await listNoteGroups(selectedModuleId);
      setNoteGroups(normalizeNoteGroups(groups));
      const chips = await listTopicChips(selectedModuleId);
      setTopicChips(chips);
      setNoteGroupMode("overview");
      navigate(`/note-groups/${createdNoteGroup.id}/study-cards`);
      setRawTextDraft("");
      setAdditionalInstructionsDraft(getModuleAdditionalInstructions(selectedModule));
      setTitleSuggestions([]);
      setSelectedTitleSuggestion("");
      setCustomTitle("");
      setHasTitleSuggestions(false);
      setChipSuggestionIds([]);
      setChipSuggestionNew([]);
      setSelectedExistingChipIds([]);
      setSelectedNewChipLabels([]);
      setHasChipSuggestions(false);
      resetSourceState();
    } catch (error) {
      setFinalizeError(error.message || "Failed to finalize note group");
    } finally {
      setFinalizeLoading(false);
    }
  };

  const handleAutoCreateNoteGroup = async () => {
    const trimmedSource = noteGroupSource.trim();
    if (!trimmedSource) {
      setAutoCreateError("Source is required before continuing.");
      return;
    }
    if (!sourceConfirmed) {
      setAutoCreateError("Check the source before continuing.");
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
      toast.info("Auto note group generation started.");
      setAutoRawText("");
      setAutoAdditionalInstructions(getModuleAdditionalInstructions(selectedModule));
      setNoteGroupMode("overview");
      setReviewSummary(null);
      setIsChatOpen(false);
      setIsMetadataOpen(false);
      setIsModuleMetadataOpen(false);
      trackAutoNoteGroupJob(job.id, selectedModuleId);
      loadAutoJobs(selectedModuleId).catch(() => null);
      navigate("/");
      resetSourceState();
    } catch (error) {
      setAutoCreateError(error.message || "Failed to start auto note group.");
      toast.error(error.message || "Failed to start auto note group.");
    } finally {
      setAutoCreateLoading(false);
    }
  };

  const handleCreateChip = async (label) => {
    const trimmed = label.trim();
    if (!selectedModuleId || !trimmed) {
      return;
    }
    setFinalizeError("");
    try {
      const chip = await createTopicChip(selectedModuleId, { label: trimmed });
      setTopicChips((prev) => [...prev, chip]);
    } catch (error) {
      setSidebarError(error.message || "Failed to create topic chip");
    }
  };

  const handleCreateWizardChip = async () => {
    await handleCreateChip(wizardChipLabel);
    setWizardChipLabel("");
  };

  const handleCreateModuleChip = async () => {
    const trimmed = moduleChipLabel.trim();
    if (!selectedModuleId || !trimmed) {
      return;
    }
    setFinalizeError("");
    try {
      const chip = await createTopicChip(selectedModuleId, {
        label: trimmed,
        description: moduleChipDescription.trim() || null,
      });
      setTopicChips((prev) => [...prev, chip]);
    } catch (error) {
      setSidebarError(error.message || "Failed to create topic chip");
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
    if (!selectedNoteGroupId) {
      return;
    }
    try {
      const chips = isChecked
        ? await attachTopicChips(selectedNoteGroupId, { chip_ids: [chipId] })
        : await detachTopicChip(selectedNoteGroupId, chipId);
      setNoteGroupChipIds(chips.map((chip) => chip.id));
    } catch (error) {
      setStudyCardError(error.message || "Failed to update topic chips");
    }
  };

  const handleNoteGroupChipSelectChange = async (selected) => {
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
      setStudyCardError(error.message || "Failed to update topic chips");
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
    if (!jobId) {
      return;
    }
    setAutoJobActionId(jobId);
    try {
      await cancelJob(jobId);
      toast.info("Auto note group job cancelled.");
      if (selectedModuleId) {
        const groups = await listNoteGroups(selectedModuleId);
        setNoteGroups(normalizeNoteGroups(groups));
        await loadAutoJobs(selectedModuleId);
      }
    } catch (error) {
      toast.error(error.message || "Failed to cancel auto note group job.");
    } finally {
      setAutoJobActionId("");
    }
  };

  const handleRetryAutoJob = async (jobId) => {
    if (!jobId) {
      return;
    }
    setAutoJobActionId(jobId);
    try {
      const newJob = await retryAutoJob(jobId);
      toast.info("Retrying auto note group generation.");
      if (selectedModuleId) {
        const groups = await listNoteGroups(selectedModuleId);
        setNoteGroups(normalizeNoteGroups(groups));
        await loadAutoJobs(selectedModuleId);
      }
      if (newJob?.id) {
        trackAutoNoteGroupJob(newJob.id, selectedModuleId);
      }
    } catch (error) {
      toast.error(error.message || "Failed to retry auto note group job.");
    } finally {
      setAutoJobActionId("");
    }
  };

  const openModuleMetadataModal = () => {
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
        setAdditionalInstructionsDraft(getModuleAdditionalInstructions(updated));
        setAutoAdditionalInstructions(getModuleAdditionalInstructions(updated));
      }
    } catch (error) {
      setModuleMetadataError(error.message || "Failed to update module");
    } finally {
      setModuleMetadataSaving(false);
    }
  };

  const openMetadataModal = () => {
    if (!selectedNoteGroupId) {
      return;
    }
    setMetadataTitleDraft(selectedNoteGroup?.title || "");
    setMetadataError("");
    setIsMetadataOpen(true);
  };

  const handleSaveMetadataTitle = async () => {
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
    if (!selectedNoteGroupId) {
      return;
    }
    const noteGroupLabel = selectedNoteGroup?.title || "this note group";
    const confirmed = window.confirm(
      `Delete "${noteGroupLabel}"? This removes its study and question cards.`
    );
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
      navigate("/");
    } catch (error) {
      setSidebarError(error.message || "Failed to delete note group");
    }
  };

  const handleCreateStudyCard = async () => {
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
    } catch (error) {
      setStudyCardError(error.message || "Failed to create study card");
    }
  };

  const openStudyCreateModal = () => {
    setStudyCardError("");
    setIsStudyCreateOpen(true);
  };

  const handleEditStudyCard = (card) => {
    setEditingStudyCardId(card.id);
    setEditingStudyCard({
      title: card.title || "",
      content: card.content,
      chipIds: (card.topic_chips || []).map((chip) => chip.id)
    });
  };

  const handleSaveStudyCard = async (cardId) => {
    setStudyCardError("");
    try {
      const updated = await updateStudyCard(cardId, {
        title: editingStudyCard.title,
        content: editingStudyCard.content,
        chip_ids: editingStudyCard.chipIds
      });
      setStudyCards((prev) => prev.map((card) => (card.id === cardId ? updated : card)));
      setEditingStudyCardId("");
    } catch (error) {
      setStudyCardError(error.message || "Failed to update study card");
    }
  };

  const handleDeleteStudyCard = async (cardId) => {
    setStudyCardError("");
    try {
      await deleteStudyCard(cardId);
      setStudyCards((prev) => prev.filter((card) => card.id !== cardId));
    } catch (error) {
      setStudyCardError(error.message || "Failed to delete study card");
    }
  };

  const handleGenerateQuestions = async () => {
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
    } catch (error) {
      setQuestionCardError(error.message || "Question generation failed");
      setQuestionJobStatus("failed");
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const startReview = async (mode, scope = "note-group") => {
    if (scope === "module") {
      if (!selectedModuleId) {
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
    try {
      const updated = await reviewQuestionCard(card.id, {
        correct,
        response_time_ms: responseTimeMs
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
    const shouldDelete = window.confirm(
      "Delete this question card? This cannot be undone."
    );
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
    } catch (error) {
      setQuestionCardError(error.message || "Failed to create question card");
    }
  };

  const openQuestionCreateModal = () => {
    setQuestionCardError("");
    setIsQuestionCreateOpen(true);
  };

  const handleEditQuestionCard = (card) => {
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
    const options = parseOptions(editingQuestionCard.optionsText);
    const indices = parseIndices(editingQuestionCard.correctIndicesText);
    if (options.length < 2 || indices.length === 0 || editingQuestionCard.refs.length === 0) {
      setQuestionCardError("Provide options, correct indices, and study card refs.");
      return;
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
      setEditingQuestionCardId("");
    } catch (error) {
      setQuestionCardError(error.message || "Failed to update question card");
    }
  };

  const handleDeleteQuestionCard = async (cardId) => {
    setQuestionCardError("");
    try {
      await deleteQuestionCard(cardId);
      setQuestionCards((prev) => prev.filter((card) => card.id !== cardId));
    } catch (error) {
      setQuestionCardError(error.message || "Failed to delete question card");
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
        note_group_id: scopeToNoteGroup ? selectedNoteGroupId || null : null,
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
    setNoteGroupMode("overview");
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    navigate("/");
  };

  const handleBreadcrumbSubject = () => {
    setSelectedModuleId("");
    setSelectedNoteGroupId("");
    setNoteGroupMode("overview");
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    navigate("/");
  };

  const handleBreadcrumbModule = () => {
    setSelectedNoteGroupId("");
    setNoteGroupMode("overview");
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    setIsModuleMetadataOpen(false);
    navigate("/");
  };

  const handleBackToOverview = () => {
    setNoteGroupMode("overview");
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    navigate("/");
  };

  const hasSidebar = Boolean(selectedSubjectId && selectedModuleId);
  const sourcePanel = (
    <section className="panel" id="step-source">
      <h2>1. Source</h2>
      <p className="muted">Add the source before continuing.</p>
      <div className="field">
        <label htmlFor="note-group-source">Source</label>
        <input
          id="note-group-source"
          type="text"
          value={noteGroupSource}
          onChange={(event) => setNoteGroupSource(event.target.value)}
          placeholder="e.g., BIO101 lecture 3, 2023-09-14"
        />
      </div>
      <div className="button-row">
        <button
          className="button ghost"
          type="button"
          onClick={handleCheckSource}
          disabled={!noteGroupSource.trim() || sourceChecking}
        >
          {sourceChecking ? "Checking..." : sourceChecked ? "Re-check source" : "Check source"}
        </button>
        {isSourceReady ? <span className="pill status-completed">Verified</span> : null}
      </div>
      {sourceCheckError ? <p className="error">{sourceCheckError}</p> : null}
      {!isSourceReady ? (
        <p className="muted">Check the source to unlock the rest of the form.</p>
      ) : null}
      {sourceChecked && sourceDuplicateCount > 0 && !sourceConfirmed ? (
        <div className="warning-block">
          <p className="warning">
            Source already used in {sourceDuplicateCount} note group
            {sourceDuplicateCount === 1 ? "" : "s"}. Continue anyway?
          </p>
          <ul className="warning-list">
            {sourceDuplicates.map((group) => (
              <li key={group.id}>
                {group.title || "Untitled note group"}
              </li>
            ))}
          </ul>
          <button
            className="button ghost small"
            type="button"
            onClick={handleConfirmDuplicateSource}
          >
            Continue anyway
          </button>
        </div>
      ) : null}
    </section>
  );

  return (
    <div className={`app${hasSidebar ? " has-sidebar" : ""}`}>
      {isReviewOverlayVisible ? (
        <div className="review-overlay">
          <div className="review-layout">
            <div className="review-modal">
              {reviewSummary ? (
                <>
                  <h2>Review summary</h2>
                  <div className="review-meta">
                    <span className="pill">
                      Scope: {reviewSummary.scope === "module" ? "Module" : "Note group"}
                    </span>
                    <span className="pill">Mode: {reviewSummary.mode}</span>
                    <span className="pill">
                      Reviewed: {reviewSummary.answered} / {reviewSummary.total}
                    </span>
                    <span className="pill">Accuracy: {reviewSummary.accuracy}%</span>
                    <span className="pill">Avg time: {reviewSummary.avgSeconds}s</span>
                    {reviewSummary.remaining ? (
                      <span className="pill">Remaining: {reviewSummary.remaining}</span>
                    ) : null}
                  </div>
                  <p className="muted">
                    Correct: {reviewSummary.correct} · Incorrect: {reviewSummary.incorrect}
                  </p>
                  <div className="button-row">
                    <button
                      className="button primary"
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
                    <span className="pill">
                      Scope: {reviewScope === "module" ? "Module" : "Note group"}
                    </span>
                    <span className="pill">
                      Card {reviewIndex + 1} / {reviewQueue.length}
                    </span>
                    <span className="pill">Mode: {reviewMode}</span>
                    {reviewScope === "module" && currentReviewCard ? (
                      <span className="pill">
                        Note group: {resolveNoteGroupLabel(currentReviewCard.note_group_id)}
                      </span>
                    ) : null}
                    {currentReviewCard ? (
                      <span className="pill">Due: {formatDueAt(currentReviewCard.due_at)}</span>
                    ) : null}
                  </div>
                  {reviewError ? <p className="error">{reviewError}</p> : null}
                  {currentReviewCard ? (
                    <>
                      <h3>{currentReviewCard.prompt}</h3>
                      <p className="muted">
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
                      {reviewFeedback ? (
                        <p className={`review-feedback ${reviewFeedback.correct ? "ok" : "bad"}`}>
                          {reviewFeedback.correct ? "Correct ✅" : "Incorrect ❌"}
                        </p>
                      ) : null}
                      <div className="button-row">
                        <button
                          className="button primary"
                          type="button"
                          onClick={() => submitReviewAnswer(currentReviewCard)}
                          disabled={!reviewAnswer.length || Boolean(reviewFeedback)}
                        >
                          Submit answer
                        </button>
                        <button
                          className="button ghost"
                          type="button"
                          onClick={nextReviewCard}
                          disabled={!reviewFeedback}
                        >
                          {reviewIndex + 1 >= reviewQueue.length ? "Finish review" : "Next question"}
                        </button>
                        <button className="button ghost" type="button" onClick={endReview}>
                          End review
                        </button>
                        <button
                          className="button ghost danger"
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
                          <div className="button-row">
                            <button
                              className="button ghost"
                              type="button"
                              onClick={cancelReviewDelete}
                              disabled={reviewDeleteLoading}
                            >
                              Keep card
                            </button>
                            <button
                              className="button ghost danger"
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
                    <p className="muted">No review card loaded.</p>
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
                      <p className="muted">
                        {reviewNoteGroupId
                          ? `Scoped to ${resolveNoteGroupLabel(reviewNoteGroupId)}.`
                          : "Scoped to current note group."}
                      </p>
                    </div>
                    {reviewChatCardLoading ? (
                      <p className="muted">Loading study card...</p>
                    ) : null}
                    {reviewChatCardError ? <p className="error">{reviewChatCardError}</p> : null}
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
                              <span key={chip.id} className="pill">
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
                      <p className="muted">
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
                    {reviewChatError ? <p className="error">{reviewChatError}</p> : null}
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
                        className="button primary"
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
        </div>
      ) : null}
      {isChatOpen ? (
        <div className="chat-overlay">
          <div className="chat-modal">
            <div className="chat-modal-header">
              <div>
                <h2>Chat with your notes</h2>
                <p className="muted">
                  {selectedNoteGroupId
                    ? "Ask about this module or the current note group."
                    : "Ask about this module and its note groups."}
                </p>
              </div>
              <button className="button ghost" type="button" onClick={() => setIsChatOpen(false)}>
                Close
              </button>
            </div>
            {selectedNoteGroupId ? (
              <div className="results-meta">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={scopeToNoteGroup && Boolean(selectedNoteGroupId)}
                    onChange={(event) => setScopeToNoteGroup(event.target.checked)}
                    disabled={!selectedNoteGroupId}
                  />
                  Scope to current note group
                </label>
              </div>
            ) : null}
            {chatView === "card" ? (
              <>
                <div className="review-chat-header">
                  <button className="back-button" type="button" onClick={handleBackToChat}>
                    ← Back to chat
                  </button>
                  <p className="muted">
                    {selectedNoteGroupId
                      ? "Scoped to current note group."
                      : "Scoped to selected module."}
                  </p>
                </div>
                {chatCardLoading ? <p className="muted">Loading study card...</p> : null}
                {chatCardError ? <p className="error">{chatCardError}</p> : null}
                {chatCardId && chatCardCache[chatCardId] ? (
                  <div className="chat-card">
                    <h3>{chatCardCache[chatCardId].title || "Untitled study card"}</h3>
                    <p>{chatCardCache[chatCardId].content}</p>
                    {chatCardCache[chatCardId].topic_chips?.length ? (
                      <div className="chip-grid">
                        {chatCardCache[chatCardId].topic_chips.map((chip) => (
                          <span key={chip.id} className="pill">
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
                {chatError ? <p className="error">{chatError}</p> : null}
                <div className="chat-input">
                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder={
                      selectedNoteGroupId
                        ? "Ask a question about this module or note group..."
                        : "Ask a question about this module..."
                    }
                    rows={2}
                    disabled={!selectedModuleId}
                  />
                  <button
                    className="button primary"
                    type="button"
                    onClick={handleSendChat}
                    disabled={!selectedModuleId || !chatInput.trim() || chatLoading}
                  >
                    {chatLoading ? "Sending..." : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
      {isReadingOpen ? (
        <div className="reading-overlay">
          <div className="reading-modal">
            <div className="reading-header">
              <div>
                <h2>Clean study text</h2>
                <p className="muted">Switch between study notes and their cleaned source text.</p>
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
                className="button ghost"
                type="button"
                onClick={() => setIsReadingOpen(false)}
              >
                Close
              </button>
              </div>
            </div>
            {!readingAvailable ? (
              <p className="muted">No formatted text available for this note group yet.</p>
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
        </div>
      ) : null}
      {isQuestionFocusOpen && focusQuestionCard ? (
        <div className="focus-overlay">
          <div className="focus-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Question focus</h2>
                <p className="muted">Mastery and scheduling details for this card.</p>
              </div>
              <button className="button ghost" type="button" onClick={closeQuestionFocus}>
                Close
              </button>
            </div>
            <p className="muted">
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
        </div>
      ) : null}
      {isStudyCreateOpen ? (
        <div className="meta-overlay">
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Create study card</h2>
                <p className="muted">Add a custom study card to this note group.</p>
              </div>
              <button
                className="button ghost"
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
                disabled={!selectedNoteGroupId}
              />
              <textarea
                value={newStudyCardContent}
                onChange={(event) => setNewStudyCardContent(event.target.value)}
                placeholder="New study card content"
                rows={4}
                disabled={!selectedNoteGroupId}
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
                  placeholder="Assign topic chips"
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
              <div className="button-row">
                <button
                  className="button primary"
                  type="button"
                  onClick={handleCreateStudyCard}
                  disabled={!selectedNoteGroupId || !newStudyCardContent.trim()}
                >
                  Add study card
                </button>
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => setIsStudyCreateOpen(false)}
                >
                  Cancel
                </button>
              </div>
              {studyCardError ? <p className="error">{studyCardError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
      {isQuestionCreateOpen ? (
        <div className="meta-overlay">
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Create question card</h2>
                <p className="muted">Build a custom question for this note group.</p>
              </div>
              <button
                className="button ghost"
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
              <div className="button-row">
                <button
                  className="button primary"
                  type="button"
                  onClick={handleCreateQuestionCard}
                  disabled={!selectedNoteGroupId || !newQuestionPrompt.trim()}
                >
                  Add question card
                </button>
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => setIsQuestionCreateOpen(false)}
                >
                  Cancel
                </button>
              </div>
              {questionCardError ? <p className="error">{questionCardError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
      {isSubjectWizardOpen ? (
        <div className="meta-overlay">
          <div className="intent-wizard">
            <div className="intent-wizard-header">
              <div>
                <h2>Create subject</h2>
                <p className="muted">
                  Describe what you want to study — the AI will suggest a title, goal, and scope.
                </p>
              </div>
              <button
                className="button ghost"
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
                    <p className="muted small">
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
                    className="button primary"
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
                  <p className="error">{subjectWizardError}</p>
                ) : null}
                <button
                  className="button primary"
                  type="button"
                  onClick={handleCreateSubjectFromWizard}
                  disabled={!subjectWizardTitle.trim() || subjectWizardCreating}
                >
                  {subjectWizardCreating ? "Creating..." : "Create subject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {isModuleWizardOpen ? (
        <div className="meta-overlay">
          <div className="intent-wizard">
            <div className="intent-wizard-header">
              <div>
                <h2>Create module</h2>
                <p className="muted">
                  Describe what you want to study — the AI will suggest a title, goal, and scope.
                </p>
              </div>
              <button
                className="button ghost"
                type="button"
                onClick={() => setIsModuleWizardOpen(false)}
              >
                Close
              </button>
            </div>
            {selectedSubject ? (
              <div className="wizard-context-banner">
                <span className="muted small">
                  Subject: <strong>{selectedSubject.title}</strong>
                  {selectedSubject.goal ? ` — ${selectedSubject.goal}` : ""}
                </span>
              </div>
            ) : null}
            <div className="intent-wizard-body">
              <div className="intent-wizard-chat">
                <div className="chat" ref={wizardChatRef}>
                  {moduleWizardMessages.length === 0 ? (
                    <p className="muted small">
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
                    className="button primary"
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
                  <p className="error">{moduleWizardError}</p>
                ) : null}
                <button
                  className="button primary"
                  type="button"
                  onClick={handleCreateModuleFromWizard}
                  disabled={!moduleWizardTitle.trim() || moduleWizardCreating || !selectedSubjectId}
                >
                  {moduleWizardCreating ? "Creating..." : "Create module"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {isSubjectMetadataOpen ? (
        <div className="meta-overlay">
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Subject settings</h2>
                <p className="muted">Manage subject details.</p>
              </div>
              <button
                className="button ghost"
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
            <div className="button-row">
              <button
                className="button primary"
                type="button"
                onClick={() => handleSaveSubjectMetadata(editingSubjectId)}
                disabled={subjectMetadataSaving || !subjectTitleDraft.trim()}
              >
                {subjectMetadataSaving ? "Saving..." : "Save settings"}
              </button>
            </div>
            {subjectMetadataError ? <p className="error">{subjectMetadataError}</p> : null}
          </div>
        </div>
      ) : null}
      {isModuleMetadataOpen ? (
        <div className="meta-overlay">
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Module settings</h2>
                <p className="muted">Manage module details and defaults.</p>
              </div>
              <button
                className="button ghost"
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
              <p className="muted">
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
            <div className="button-row">
              <button
                className="button primary"
                type="button"
                onClick={handleSaveModuleMetadata}
                disabled={moduleMetadataSaving || !moduleTitleDraft.trim()}
              >
                {moduleMetadataSaving ? "Saving..." : "Save settings"}
              </button>
            </div>
            {moduleMetadataError ? <p className="error">{moduleMetadataError}</p> : null}
          </div>
        </div>
      ) : null}
      {isMetadataOpen ? (
        <div className="meta-overlay">
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Edit note group metadata</h2>
                <p className="muted">
                  Update the title and adjust topic chips for this note group.
                </p>
              </div>
              <button className="button ghost" type="button" onClick={() => setIsMetadataOpen(false)}>
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
            <div className="button-row">
              <button
                className="button primary"
                type="button"
                onClick={handleSaveMetadataTitle}
                disabled={metadataSaving || !metadataTitleDraft.trim()}
              >
                {metadataSaving ? "Saving..." : "Save title"}
              </button>
            </div>
            {metadataError ? <p className="error">{metadataError}</p> : null}
            <div className="divider">Topic chips</div>
            {topicChips.length === 0 ? (
              <p className="muted">Create chips to tag and filter note groups.</p>
            ) : (
              <Select
                className="select"
                classNamePrefix="select"
                options={chipOptions}
                value={chipOptions.filter((opt) => noteGroupChipIds.includes(opt.value))}
                onChange={handleNoteGroupChipSelectChange}
                placeholder="Search and assign topic chips"
                isMulti
                isClearable
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
            )}
            <div className="form-inline">
              <input
                type="text"
                value={moduleChipLabel}
                onChange={(event) => setModuleChipLabel(event.target.value)}
                placeholder="New topic chip"
                disabled={!selectedModuleId}
              />
              <input
                type="text"
                value={moduleChipDescription}
                onChange={(event) => setModuleChipDescription(event.target.value)}
                placeholder="Chip description (optional)"
                disabled={!selectedModuleId}
              />
              <button
                className="button ghost"
                type="button"
                onClick={handleCreateModuleChip}
                disabled={!selectedModuleId || !moduleChipLabel.trim()}
              >
                Add chip
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {selectedSubjectId && selectedModuleId ? (
        <aside className="sidebar">
          <div className="sidebar-section context">
            <div className="context-row subject">
              <div>
                <p className="label">Subject</p>
                <p className="context-title">{selectedSubject?.title || "Subject"}</p>
              </div>
              <button
                className="button ghost small"
                type="button"
                onClick={handleBreadcrumbHome}
              >
                Change
              </button>
            </div>
            <div className="context-row module">
              <div>
                <p className="label">Module</p>
                <p className="context-title">{selectedModule?.title || "Module"}</p>
              </div>
              <button
                className="button ghost small"
                type="button"
                onClick={handleBreadcrumbSubject}
              >
                Change
              </button>
            </div>
          </div>
          <div className="sidebar-section note-groups">
            <h3>Note groups</h3>
            <div className="note-group-search">
              <input
                type="text"
                value={noteGroupSearch}
                onChange={(event) => setNoteGroupSearch(event.target.value)}
                placeholder="Search note groups"
              />
            </div>
            <div className="note-group-list">
              {filteredNoteGroupOptions.length === 0 ? (
                <p className="muted">
                  {noteGroupSearch.trim()
                    ? "No note groups match."
                    : "No note groups yet."}
                </p>
              ) : (
                filteredNoteGroupOptions.map((option) => {
                  const statusMeta = getNoteGroupStatusMeta(option.status);
                  const statsEntry = moduleNoteGroupStatsById.get(option.value);
                  const dueCount = statsEntry?.dueCount;
                  const dueLabel = Number.isInteger(dueCount) ? String(dueCount) : "...";
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`note-group-item ${
                        option.value === selectedNoteGroupId ? "active" : ""
                      }`}
                      onClick={() => handleSelectNoteGroup(option)}
                    >
                      <span className="note-group-info">
                        <span className="note-group-title">{option.label}</span>
                        <span className="note-group-date">
                          {formatCreatedAt(option.createdAt)}
                        </span>
                      </span>
                      <span className="note-group-meta">
                        <span className="note-group-badge">{dueLabel}</span>
                        {statusMeta ? (
                          <span className={`pill ${statusMeta.className}`}>{statusMeta.label}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="form-block">
              <button
                className={`button ghost ${noteGroupMode === "create" ? "active" : ""}`}
                type="button"
                onClick={handleStartCreateNoteGroup}
                disabled={!selectedModuleId}
              >
                Create new note group
              </button>
              <button
                className={`button ghost ${noteGroupMode === "auto" ? "active" : ""}`}
                type="button"
                onClick={handleStartAutoNoteGroup}
                disabled={!selectedModuleId}
              >
                Auto-create note group
              </button>
            </div>
          </div>
          {sidebarError ? <p className="error">{sidebarError}</p> : null}
        </aside>
      ) : null}

      <main className="content">
        <header className="hero">
          <div>
            <p className="eyebrow">Study System</p>
            <h1>Build structured notes from raw text.</h1>
            <div className="breadcrumbs">
              <button type="button" onClick={handleBreadcrumbHome}>
                Subjects
              </button>
              {selectedSubject ? (
                <>
                  <span>/</span>
                  <button type="button" onClick={handleBreadcrumbSubject}>
                    {selectedSubject.title}
                  </button>
                </>
              ) : null}
              {selectedModule ? (
                <>
                  <span>/</span>
                  <button type="button" onClick={handleBreadcrumbModule}>
                    {selectedModule.title}
                  </button>
                </>
              ) : null}
              {noteGroupMode === "create" ? (
                <>
                  <span>/</span>
                  <span className="current">New note group</span>
                </>
              ) : noteGroupMode === "auto" ? (
                <>
                  <span>/</span>
                  <span className="current">Auto note group</span>
                </>
              ) : selectedNoteGroup ? (
                <>
                  <span>/</span>
                  <span className="current">{selectedNoteGroup.title || "Untitled"}</span>
                </>
              ) : null}
            </div>
            <p className="subhead">
              {noteGroupMode === "create"
                ? "Paste raw text, pick a title, select topic chips, then generate study cards in one workflow."
                : noteGroupMode === "auto"
                  ? "Paste raw text and we will auto-generate a note group and questions in the background."
                : selectedNoteGroupId
                  ? "Manage your note group, review questions, and chat with your study cards."
                  : selectedModuleId
                    ? "Review question cards across note groups, edit module settings, and chat with your module study cards."
                    : selectedSubjectId
                      ? "Pick a module to get started."
                      : "Choose a subject to get started."}
            </p>
          </div>
        </header>
        <div className="content-layout">
          <div className="content-main">
            {!selectedSubjectId ? (
              <section className="panel subject-page">
                <div className="subject-page-header">
                  <div>
                    <span className="level-tag subject">Subject selection</span>
                    <h2>Subjects</h2>
                    <p className="muted">
                      Choose a subject to explore modules, or create a new one.
                    </p>
                  </div>
                  <span className="pill">
                    {subjects.length} subject{subjects.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="subject-create">
                  <div className="form-block">
                    <button
                      className="button ghost"
                      type="button"
                      onClick={handleOpenSubjectWizard}
                    >
                      Create new subject
                    </button>
                  </div>
                </div>
                {subjects.length === 0 ? (
                  <p className="muted subject-empty">
                    No subjects yet. Create one to get started.
                  </p>
                ) : (
                  <div className="subject-grid">
                    {subjects.map((subject) => (
                      <article key={subject.id} className="subject-card">
                        <div>
                          <h3>{subject.title}</h3>
                          {subject.goal ? (
                            <p className="muted">{subject.goal}</p>
                          ) : null}
                        </div>
                        <div className="button-row">
                          <button
                            className="button primary"
                            type="button"
                            onClick={() =>
                              handleSelectSubject({
                                value: subject.id,
                                label: subject.title
                              })
                            }
                          >
                            Open subject
                          </button>
                          <button
                            className="button ghost"
                            type="button"
                            onClick={() => openSubjectMetadataModal(subject)}
                          >
                            Edit
                          </button>
                          <button
                            className="button ghost danger"
                            type="button"
                            onClick={() => handleDeleteSubject(subject)}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {sidebarError ? <p className="error">{sidebarError}</p> : null}
              </section>
            ) : !selectedModuleId ? (
              <section className="panel module-page">
                <div className="module-page-header">
                  <div>
                    <span className="level-tag module">Module selection</span>
                    <h2>Modules</h2>
                    <p className="muted">
                      {selectedSubject?.description ||
                        "Choose a module to see its note groups, review cards, and chat with your notes."}
                    </p>
                  </div>
                  <div className="page-actions">
                    <span className="pill">
                      {modules.length} module{modules.length === 1 ? "" : "s"}
                    </span>
                    <button
                      className="button ghost small"
                      type="button"
                      onClick={handleBreadcrumbHome}
                    >
                      Back to subjects
                    </button>
                  </div>
                </div>
                <div className="module-create">
                  <div className="form-block">
                    <button
                      className="button ghost"
                      type="button"
                      onClick={handleOpenModuleWizard}
                      disabled={!selectedSubjectId}
                    >
                      Create new module
                    </button>
                  </div>
                </div>
                {modules.length === 0 ? (
                  <p className="muted module-empty">
                    No modules yet. Create one to get started.
                  </p>
                ) : (
                  <div className="module-grid">
                    {modules.map((module) => {
                      const dueCount = moduleDueCounts[module.id];
                      return (
                        <article key={module.id} className="module-card">
                          <div>
                            <h3>{module.title}</h3>
                            <p className="muted">
                              {module.description || "No description yet."}
                            </p>
                          </div>
                          <div className="module-card-meta">
                            <span className="pill">
                              Due now: {Number.isInteger(dueCount) ? dueCount : "..."}
                            </span>
                          </div>
                          <div className="button-row">
                            <button
                              className="button primary"
                              type="button"
                              onClick={() =>
                                handleSelectModule({
                                  value: module.id,
                                  label: module.title
                                })
                              }
                            >
                              Open module
                            </button>
                            <button
                              className="button ghost danger"
                              type="button"
                              onClick={() => handleDeleteModule(module)}
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
                {sidebarError ? <p className="error">{sidebarError}</p> : null}
              </section>
            ) : noteGroupMode === "create" ? (
              <>
                {sourcePanel}
                <section className="panel" id="step-raw">
                  <h2>2. Paste raw text</h2>
                  <div className="field">
                    <label htmlFor="additional-instructions">
                      Additional generation instructions (optional)
                    </label>
                    <textarea
                      id="additional-instructions"
                      value={additionalInstructionsDraft}
                      onChange={(event) => setAdditionalInstructionsDraft(event.target.value)}
                      placeholder="Optional guidance for study and question generation"
                      rows={3}
                      disabled={!selectedModuleId || !isSourceReady}
                    />
                    <p className="muted">
                      Word count: {countWords(additionalInstructionsDraft)}/500
                    </p>
                  </div>
                  <div className="field">
                    <label htmlFor="raw-text">Raw text</label>
                    <textarea
                      id="raw-text"
                      value={rawTextDraft}
                      onChange={(event) => setRawTextDraft(event.target.value)}
                      placeholder="Paste lecture notes or a chapter excerpt..."
                      rows={8}
                      disabled={!selectedModuleId || !isSourceReady}
                    />
                  </div>
                  <button
                    className="button primary"
                    type="button"
                    onClick={handleGenerateTitleSuggestions}
                    disabled={
                      !selectedModuleId ||
                      !isSourceReady ||
                      !rawTextDraft.trim() ||
                      titleLoading
                    }
                  >
                    {titleLoading ? "Generating titles..." : "Generate title suggestions"}
                  </button>
                  {titleError ? <p className="error">{titleError}</p> : null}
                </section>

                <section className="panel" id="step-title">
                  <h2>3. Choose a title</h2>
                  {titleSuggestions.length > 0 ? (
                    <div className="suggestions">
                      {titleSuggestions.map((title) => (
                        <button
                          key={title}
                          type="button"
                          className={`button ghost ${
                            title === selectedTitleSuggestion ? "active" : ""
                          }`}
                          onClick={() => handleSelectTitleSuggestion(title)}
                          disabled={!isSourceReady}
                        >
                          {title}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Generate title suggestions first.</p>
                  )}
                  <div className="form-inline">
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(event) => setCustomTitle(event.target.value)}
                      placeholder="Edit or enter a custom title"
                      disabled={!selectedModuleId || !isSourceReady}
                    />
                  </div>
                </section>

                <section className="panel" id="step-chips">
                  <h2>4. Select topic chips</h2>
                  <button
                    className="button ghost"
                    type="button"
                    onClick={handleGenerateChipSuggestions}
                    disabled={
                      !selectedModuleId ||
                      !isSourceReady ||
                      !rawTextDraft.trim() ||
                      chipLoading ||
                      !hasTitleSuggestions
                    }
                  >
                    {chipLoading ? "Generating chips..." : "Generate topic chip suggestions"}
                  </button>
                  {chipError ? <p className="error">{chipError}</p> : null}
                  <div className="chip-section">
                    <h3>Existing chips (module pool)</h3>
                    <div className="chip-grid">
                      {topicChips.length === 0 ? (
                        <p className="muted">No topic chips yet.</p>
                      ) : (
                        topicChips.map((chip) => (
                          <label
                            key={chip.id}
                            className={`chip-toggle ${
                              chipSuggestionIds.includes(chip.id) ? "suggested" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedExistingChipIds.includes(chip.id)}
                              onChange={() => handleToggleExistingChip(chip.id)}
                              disabled={!isSourceReady}
                            />
                            {chip.label}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="chip-section">
                    <h3>New chip suggestions</h3>
                    <div className="chip-grid">
                      {newChipDisplay.length === 0 ? (
                        <p className="muted">No new chip suggestions yet.</p>
                      ) : (
                        newChipDisplay.map((label) => (
                          <label key={label} className="chip-toggle suggested">
                            <input
                              type="checkbox"
                              checked={selectedNewChipLabels.includes(label)}
                              onChange={() => handleToggleNewChip(label)}
                              disabled={!isSourceReady}
                            />
                            {label}
                          </label>
                        ))
                      )}
                    </div>
                    <div className="form-inline">
                      <input
                        type="text"
                        value={wizardChipLabel}
                        onChange={(event) => setWizardChipLabel(event.target.value)}
                        placeholder="Add a new chip label"
                        disabled={!selectedModuleId}
                      />
                      <button
                        className="button ghost"
                        type="button"
                        onClick={handleAddNewChipLabel}
                        disabled={!isSourceReady || !wizardChipLabel.trim()}
                      >
                        Add new chip
                      </button>
                      <button
                        className="button ghost"
                        type="button"
                        onClick={handleCreateWizardChip}
                        disabled={!selectedModuleId || !isSourceReady || !wizardChipLabel.trim()}
                      >
                        Save to module pool
                      </button>
                    </div>
                  </div>
                </section>

                <section className="panel" id="step-finalize">
                  <h2>5. Generate study cards</h2>
                  <div className="summary">
                    <p>
                      <strong>Title:</strong>{" "}
                      {customTitle.trim() || selectedTitleSuggestion || "—"}
                    </p>
                    <p>
                      <strong>Selected chips:</strong>{" "}
                      {[
                        ...topicChips
                          .filter((chip) => selectedExistingChipIds.includes(chip.id))
                          .map((chip) => chip.label),
                        ...selectedNewChipLabels
                      ].join(", ") || "None"}
                    </p>
                  </div>
                  <button
                    className="button primary"
                    type="button"
                    onClick={handleFinalizeNoteGroup}
                    disabled={
                      !isSourceReady ||
                      !selectedModuleId ||
                      !rawTextDraft.trim() ||
                      finalizeLoading ||
                      !hasTitleSuggestions ||
                      !hasChipSuggestions ||
                      !(customTitle.trim() || selectedTitleSuggestion)
                    }
                  >
                    {finalizeLoading ? "Finalizing..." : "Generate study cards"}
                  </button>
                  {finalizeError ? <p className="error">{finalizeError}</p> : null}
                </section>
              </>
            ) : noteGroupMode === "auto" ? (
              <>
                {sourcePanel}
                <section className="panel" id="auto-note-group">
                  <h2>Auto-create note group</h2>
                  <p className="muted">
                    Paste raw text and we will select a title, attach topic chips, generate study
                    cards, and generate question cards in the background.
                  </p>
                  <div className="field">
                    <label htmlFor="auto-additional-instructions">
                      Additional generation instructions (optional)
                    </label>
                    <textarea
                      id="auto-additional-instructions"
                      value={autoAdditionalInstructions}
                      onChange={(event) => setAutoAdditionalInstructions(event.target.value)}
                      placeholder="Optional guidance for study and question generation"
                      rows={3}
                      disabled={!selectedModuleId || !isSourceReady}
                    />
                    <p className="muted">
                      Word count: {countWords(autoAdditionalInstructions)}/500
                    </p>
                  </div>
                  <div className="field">
                    <label htmlFor="auto-raw-text">Raw text</label>
                    <textarea
                      id="auto-raw-text"
                      value={autoRawText}
                      onChange={(event) => setAutoRawText(event.target.value)}
                      placeholder="Paste lecture notes or a chapter excerpt..."
                      rows={10}
                      disabled={!selectedModuleId || !isSourceReady}
                    />
                  </div>
                  <button
                    className="button primary"
                    type="button"
                    onClick={handleAutoCreateNoteGroup}
                    disabled={
                      !selectedModuleId || !isSourceReady || !autoRawText.trim() || autoCreateLoading
                    }
                  >
                    {autoCreateLoading ? "Starting..." : "Run auto workflow"}
                  </button>
                  {autoCreateError ? <p className="error">{autoCreateError}</p> : null}
                </section>
              </>
            ) : (
              <>
                {!selectedNoteGroupId ? (
                  <>
                    <section className="panel" id="module-overview">
                      <h2>{selectedModule?.title || "Module overview"}</h2>
                      <p className="muted">
                        {selectedModule?.description ||
                          "Review across note groups and manage module details."}
                      </p>
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
                              placeholder="Search topic chips"
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
                              className="button ghost small"
                              type="button"
                              onClick={handleResetChipFilters}
                              disabled={!chipFilterIds.length}
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                        <div className="stats-grid">
                          <div className="stat-card">
                            <p className="label">Note groups</p>
                            <p className="value">{moduleNoteGroupsForDisplay.length}</p>
                          </div>
                          <div className="stat-card">
                            <p className="label">Study cards</p>
                            <p className="value">
                              {moduleStatsLoading ? "..." : moduleStats.studyCount}
                            </p>
                          </div>
                          <div className="stat-card">
                            <p className="label">Question cards</p>
                            <p className="value">
                              {moduleStatsLoading ? "..." : moduleStats.questionCount}
                            </p>
                          </div>
                          <div className="stat-card">
                            <p className="label">Due now</p>
                            <p className="value">
                              {moduleStatsLoading ? "..." : moduleStats.dueCount}
                            </p>
                          </div>
                        </div>
                        {moduleStatsLoading ? (
                          <p className="muted">Loading module stats...</p>
                        ) : null}
                        {moduleStatsError ? <p className="error">{moduleStatsError}</p> : null}
                        <div className="button-row">
                          <button
                            className="button primary"
                            type="button"
                            onClick={() => setIsChatOpen(true)}
                            disabled={!selectedModuleId || isReviewOverlayVisible}
                          >
                            Open chat
                          </button>
                          <button
                            className="button ghost"
                            type="button"
                            onClick={openModuleMetadataModal}
                            disabled={!selectedModuleId || isReviewOverlayVisible}
                          >
                            Module settings
                          </button>
                          <button
                            className="button ghost danger"
                            type="button"
                            onClick={handleDeleteModule}
                            disabled={!selectedModuleId || isReviewOverlayVisible}
                          >
                            Delete module
                          </button>
                        </div>
                      </section>
                      <section className="panel" id="module-review">
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
                            className="button primary"
                            type="button"
                            onClick={() => startReview("due", "module")}
                            disabled={!selectedModuleId || isReviewing}
                          >
                            Review due
                          </button>
                          <button
                            className="button primary"
                            type="button"
                            onClick={() => startReview("queue", "module")}
                            disabled={!selectedModuleId || isReviewing}
                          >
                            Review next
                          </button>
                          <button
                            className="button ghost"
                            type="button"
                            onClick={() => startReview("all", "module")}
                            disabled={!selectedModuleId || isReviewing}
                          >
                            Review all
                          </button>
                        </div>
                        {reviewError ? <p className="error">{reviewError}</p> : null}
                        <p className="muted">
                          Review sessions open in a modal so you can stay focused.
                        </p>
                      </section>
                      <section className="panel" id="module-timeline">
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
                        <p className="muted">
                          Due includes anything scheduled within the next 6 hours.
                        </p>
                      </section>
                      <section className="panel" id="module-note-groups">
                        <h2>Note groups in this module</h2>
                        {chipFilterIds.length ? (
                          <p className="muted">Filtered by selected topic chips.</p>
                        ) : null}
                        {canReorderNoteGroups ? (
                          <p className="muted">
                            Drag and drop note groups to reorder.
                            {isReorderingNoteGroups ? " Saving order..." : ""}
                          </p>
                        ) : null}
                        {moduleNoteGroupsForDisplay.length === 0 ? (
                          <p className="muted">
                            {chipFilterIds.length
                              ? "No note groups match the selected topic chips."
                              : "No note groups yet."}
                          </p>
                        ) : (
                          <div className="cards module-note-groups">
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
                                  className={`card ${
                                    draggedNoteGroupId === group.id ? "dragging" : ""
                                  } ${dragOverNoteGroupId === group.id ? "drag-over" : ""}`}
                                  onDragOver={handleNoteGroupDragOver}
                                  onDragEnter={() => handleNoteGroupDragEnter(group.id)}
                                  onDrop={(event) => handleNoteGroupDrop(event, group.id)}
                                  onDragEnd={handleNoteGroupDragEnd}
                                >
                                  <div className="card-header">
                                  <div className="card-title">
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
                                        <span className={`pill ${statusMeta.className}`}>
                                          {statusMeta.label}
                                        </span>
                                      ) : null}
                                    </div>
                                    <span className="mono">{group.id.slice(0, 8)}</span>
                                  </div>
                                  <div className="review-meta">
                                    <span className="pill">
                                      Study cards: {stats ? stats.studyCount : "—"}
                                    </span>
                                    <span className="pill">
                                      Questions: {stats ? stats.questionCount : "—"}
                                    </span>
                                    <span className="pill due">
                                      Due: {stats ? stats.dueCount : "—"}
                                    </span>
                                    {stats ? (
                                      <span className="pill stale">
                                        Stale: {stats.staleCount}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="button-row">
                                    {canCancelAuto ? (
                                      <button
                                        className="button ghost danger small"
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
                                        className="button ghost small"
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
                                      className="button ghost"
                                      type="button"
                                      onClick={() => navigateToNoteGroup(group.id)}
                                    >
                                      Open overview
                                    </button>
                                    <button
                                      className="button ghost"
                                      type="button"
                                      onClick={() =>
                                        navigateToNoteGroup(group.id, "study-cards")
                                      }
                                    >
                                      Study cards
                                    </button>
                                    <button
                                      className="button ghost"
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
                  </>
                ) : (
                  <>
                    {!isStudyPage && !isQuestionPage ? (
                      <>
                        <section className="panel" id="note-group-overview">
                        <div className="panel-title">
                          <h2>{selectedNoteGroup?.title || "Untitled note group"}</h2>
                          {noteGroupStatusMeta ? (
                            <span className={`pill ${noteGroupStatusMeta.className}`}>
                              {noteGroupStatusMeta.label}
                            </span>
                          ) : null}
                        </div>
                        <p className="muted">Snapshot of your current note group.</p>
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
                              placeholder="Search topic chips"
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
                              className="button ghost small"
                              type="button"
                              onClick={handleResetChipFilters}
                              disabled={!chipFilterIds.length}
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                        <div className="stats-grid">
                          <div className="stat-card">
                            <p className="label">Study cards</p>
                            <p className="value">{noteGroupStats.studyCount}</p>
                          </div>
                          <div className="stat-card">
                            <p className="label">Question cards</p>
                            <p className="value">{noteGroupStats.questionCount}</p>
                          </div>
                          <div className="stat-card">
                            <p className="label">Due now</p>
                            <p className="value">{noteGroupStats.dueCount}</p>
                          </div>
                          <div className="stat-card">
                            <p className="label">Stale questions</p>
                            <p className="value">{noteGroupStats.staleCount}</p>
                          </div>
                        </div>
                        <div className="button-row">
                          <button
                            className="button primary"
                            type="button"
                            onClick={() =>
                              navigate(`/note-groups/${selectedNoteGroupId}/study-cards`)
                            }
                          >
                            View study cards
                          </button>
                          <button
                            className="button ghost"
                            type="button"
                            onClick={() =>
                              navigate(`/note-groups/${selectedNoteGroupId}/question-cards`)
                            }
                          >
                            View question cards
                          </button>
                          <button
                            className="button ghost"
                            type="button"
                            onClick={() => setIsReadingOpen(true)}
                            disabled={!readingAvailable}
                          >
                            Read clean text
                          </button>
                        <button
                          className="button ghost"
                          type="button"
                          onClick={openMetadataModal}
                          disabled={!selectedNoteGroupId || isReviewOverlayVisible}
                        >
                          Edit metadata
                        </button>
                          <button
                            className="button ghost"
                            type="button"
                            onClick={() => setIsChatOpen(true)}
                            disabled={!selectedModuleId || isReviewOverlayVisible}
                          >
                            Open chat
                          </button>
                          <button
                            className="button ghost danger"
                            type="button"
                            onClick={handleDeleteNoteGroup}
                            disabled={!selectedNoteGroupId || isReviewOverlayVisible}
                          >
                            Delete note group
                          </button>
                        </div>
                        </section>
                        <section className="panel shortcuts-panel" id="note-group-shortcuts">
                          <div className="shortcuts-header">
                            <h3>Shortcuts</h3>
                            <p className="muted">Quick actions for this note group.</p>
                          </div>
                          <div className="shortcuts-grid">
                            <button
                              className="shortcut-card"
                              type="button"
                              onClick={() => startReview("due")}
                              disabled={!selectedNoteGroupId || isReviewing}
                            >
                              <span className="label">Review due</span>
                              <span className="value">{noteGroupStats.dueCount}</span>
                            </button>
                          </div>
                        </section>
                      </>
                    ) : null}

                    {isStudyPage ? (
                      <>
                        <section className="panel page-header">
                          <button className="back-button" type="button" onClick={handleBackToOverview}>
                            ← Back
                          </button>
                          <div>
                            <h2>Study cards</h2>
                            <p className="muted">Manage study cards for this note group.</p>
                          </div>
                        </section>
                        <section className="results">
                          <div className="results-header">
                            <h2>Study cards</h2>
                            <div className="results-meta">
                              <button
                                className="button primary"
                                type="button"
                                onClick={openStudyCreateModal}
                                disabled={!selectedNoteGroupId}
                              >
                                Create study card
                              </button>
                            </div>
                          </div>
                        {studyCardError ? <p className="error">{studyCardError}</p> : null}
                        <div className="cards" id="study-list">
                          {filteredStudyCards.length === 0 ? (
                              <p className="empty">
                                {chipFilterIds.length
                                  ? "No study cards match the filter."
                                  : "No study cards yet."}
                              </p>
                          ) : (
                            filteredStudyCards.map((card) => (
                              <article key={card.id} className="card">
                                <div className="card-header">
                                  <h3>{card.title || "Untitled card"}</h3>
                                  <span className="mono">{card.id.slice(0, 8)}</span>
                                </div>
                                {editingStudyCardId === card.id ? (
                                  <div className="form-block">
                                    <input
                                      type="text"
                                      value={editingStudyCard.title}
                                      onChange={(event) =>
                                        setEditingStudyCard((prev) => ({
                                          ...prev,
                                          title: event.target.value
                                        }))
                                      }
                                    />
                                    <textarea
                                      value={editingStudyCard.content}
                                      onChange={(event) =>
                                        setEditingStudyCard((prev) => ({
                                          ...prev,
                                          content: event.target.value
                                        }))
                                      }
                                      rows={4}
                                    />
                                    <div className="chip-grid">
                                      {topicChips.map((chip) => (
                                        <label key={chip.id} className="chip-toggle">
                                          <input
                                            type="checkbox"
                                            checked={editingStudyCard.chipIds.includes(chip.id)}
                                            onChange={() =>
                                              setEditingStudyCard((prev) => ({
                                                ...prev,
                                                chipIds: prev.chipIds.includes(chip.id)
                                                  ? prev.chipIds.filter((id) => id !== chip.id)
                                                  : [...prev.chipIds, chip.id]
                                              }))
                                            }
                                          />
                                          {chip.label}
                                        </label>
                                      ))}
                                    </div>
                                    <div className="button-row">
                                      <button
                                        className="button primary"
                                        type="button"
                                        onClick={() => handleSaveStudyCard(card.id)}
                                      >
                                        Save
                                      </button>
                                      <button
                                        className="button ghost"
                                        type="button"
                                        onClick={() => setEditingStudyCardId("")}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p>{card.content}</p>
                                    <div className="chip-grid">
                                      {(card.topic_chips || []).map((chip) => (
                                        <span key={chip.id} className="pill">
                                          {chip.label}
                                        </span>
                                      ))}
                                    </div>
                                    <div className="button-row">
                                      <button
                                        className="button ghost"
                                        type="button"
                                        onClick={() => handleEditStudyCard(card)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        className="button ghost"
                                        type="button"
                                        onClick={() => handleDeleteStudyCard(card.id)}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </>
                                )}
                              </article>
                            ))
                          )}
                        </div>
                        </section>
                      </>
                    ) : null}

                    {isQuestionPage ? (
                      <>
                        <section className="panel page-header">
                          <button className="back-button" type="button" onClick={handleBackToOverview}>
                            ← Back
                          </button>
                          <div>
                            <h2>Question cards</h2>
                            <p className="muted">Review, generate, and edit question cards.</p>
                          </div>
                        </section>
                        <section className="panel" id="question-review">
                          <h2>Review question cards</h2>
                          <div className="results-meta">
                            <div className="field inline">
                              <label htmlFor="review-count">Count</label>
                              <input
                                id="review-count"
                                type="number"
                                min="1"
                                max="200"
                                value={reviewCount}
                                onChange={(event) => setReviewCount(event.target.value)}
                                disabled={isReviewing}
                              />
                            </div>
                            <button
                              className="button primary"
                              type="button"
                              onClick={() => startReview("due")}
                              disabled={!selectedNoteGroupId || isReviewing}
                            >
                              Review due
                            </button>
                            <button
                              className="button primary"
                              type="button"
                              onClick={() => startReview("queue")}
                              disabled={!selectedNoteGroupId || isReviewing}
                            >
                              Review next
                            </button>
                            <button
                              className="button ghost"
                              type="button"
                              onClick={() => startReview("all")}
                              disabled={!selectedNoteGroupId || isReviewing}
                            >
                              Review all
                            </button>
                          </div>
                          {reviewError ? <p className="error">{reviewError}</p> : null}
                          <p className="muted">
                            Review sessions open in a modal so you can stay focused.
                          </p>
                        </section>
                        <section className="panel" id="question-timeline">
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
                          <p className="muted">
                            Due includes anything scheduled within the next 6 hours.
                          </p>
                        </section>

                        <section className="results" id="question-list">
                          <div className="results-header">
                            <h2>Question cards</h2>
                            <div className="results-meta">
                              <div className="field inline">
                                <label htmlFor="mastery-filter">Mastery</label>
                                <select
                                  id="mastery-filter"
                                  value={masteryFilter}
                                  onChange={(event) => setMasteryFilter(event.target.value)}
                                >
                                  <option value="all">All</option>
                                  <option value="low">Low mastery</option>
                                  <option value="medium">Medium mastery</option>
                                  <option value="high">High mastery</option>
                                </select>
                              </div>
                            </div>
                          </div>
                          <div className="cards">
                            {questionCardsForDisplay.length === 0 ? (
                              <p className="empty">
                                {chipFilterIds.length || masteryFilter !== "all"
                                  ? "No question cards match the filter."
                                  : "No questions yet."}
                              </p>
                            ) : (
                              questionCardsForDisplay.map((card, index) => {
                                const masteryScore = getMasteryScore(card);
                                const masteryTier = getMasteryTier(masteryScore);
                                const displayType =
                                  card.type === "mcq" &&
                                  (card.correct_option_indices || []).length > 1
                                    ? "multi"
                                    : card.type;
                                return (
                                  <article
                                    key={card.id}
                                    className="card question-card"
                                    onClick={() => {
                                      if (editingQuestionCardId !== card.id) {
                                        openQuestionFocus(card.id);
                                      }
                                    }}
                                    onKeyDown={(event) => {
                                      if (
                                        (event.key === "Enter" || event.key === " ") &&
                                        editingQuestionCardId !== card.id
                                      ) {
                                        event.preventDefault();
                                        openQuestionFocus(card.id);
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                  >
                                  <div className="card-header">
                                    <h3>
                                      Q{index + 1}. {displayType.toUpperCase()}
                                    </h3>
                                    <span className="mono">{card.id.slice(0, 8)}</span>
                                  </div>
                                  {editingQuestionCardId === card.id ? (
                                    <div className="form-block">
                                      <select
                                        value={editingQuestionCard.type}
                                        onChange={(event) =>
                                          setEditingQuestionCard((prev) => ({
                                            ...prev,
                                            type: event.target.value
                                          }))
                                        }
                                      >
                                        <option value="mcq">MCQ</option>
                                        <option value="multi">Multi-answer</option>
                                      </select>
                                      <textarea
                                        value={editingQuestionCard.prompt}
                                        onChange={(event) =>
                                          setEditingQuestionCard((prev) => ({
                                            ...prev,
                                            prompt: event.target.value
                                          }))
                                        }
                                        rows={3}
                                      />
                                      <textarea
                                        value={editingQuestionCard.optionsText}
                                        onChange={(event) =>
                                          setEditingQuestionCard((prev) => ({
                                            ...prev,
                                            optionsText: event.target.value
                                          }))
                                        }
                                        rows={4}
                                      />
                                      <input
                                        type="text"
                                        value={editingQuestionCard.correctIndicesText}
                                        onChange={(event) =>
                                          setEditingQuestionCard((prev) => ({
                                            ...prev,
                                            correctIndicesText: event.target.value
                                          }))
                                        }
                                      />
                                      <div className="chip-grid">
                                        {studyCards.map((studyCard) => (
                                          <label key={studyCard.id} className="chip-toggle">
                                            <input
                                              type="checkbox"
                                              checked={editingQuestionCard.refs.includes(studyCard.id)}
                                              onChange={() =>
                                                setEditingQuestionCard((prev) => ({
                                                  ...prev,
                                                  refs: prev.refs.includes(studyCard.id)
                                                    ? prev.refs.filter((id) => id !== studyCard.id)
                                                    : [...prev.refs, studyCard.id]
                                                }))
                                              }
                                            />
                                            {studyCard.title || studyCard.id.slice(0, 6)}
                                          </label>
                                        ))}
                                      </div>
                                      <div className="button-row">
                                        <button
                                          className="button primary"
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleSaveQuestionCard(card.id);
                                          }}
                                        >
                                          Save
                                        </button>
                                        <button
                                          className="button ghost"
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setEditingQuestionCardId("");
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <p>{card.prompt}</p>
                                      <div className="question-meta">
                                        {card.stale ? (
                                          <span className="pill stale">Stale</span>
                                        ) : null}
                                        {masteryScore !== null ? (
                                          <span
                                            className={`pill mastery ${masteryTier}`}
                                          >
                                            Mastery: {masteryScore.toFixed(1)}
                                          </span>
                                        ) : (
                                          <span className="pill mastery unknown">Mastery: —</span>
                                        )}
                                      </div>
                                      <ul className="options">
                                        {card.options.map((option, optionIndex) => {
                                          const isCorrect =
                                            card.correct_option_indices.includes(optionIndex);
                                          return (
                                            <li
                                              key={`${card.id}-${optionIndex}`}
                                              className={isCorrect ? "correct" : ""}
                                            >
                                              {option}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                      <p className="refs">Refs: {card.study_card_refs.join(", ")}</p>
                                      <div className="button-row">
                                        <button
                                          className="button ghost"
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleEditQuestionCard(card);
                                          }}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          className="button ghost"
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleDeleteQuestionCard(card.id);
                                          }}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </article>
                              );
                              })
                            )}
                          </div>
                          <div className="form-block" id="question-generate">
                            <h3>Generate question cards</h3>
                            <div className="results-meta">
                              <button
                                className="button primary"
                                type="button"
                                onClick={handleGenerateQuestions}
                                disabled={studyCards.length === 0 || isGeneratingQuestions}
                              >
                                {isGeneratingQuestions ? "Generating..." : "Generate questions"}
                              </button>
                              <button
                                className="button ghost"
                                type="button"
                                onClick={openQuestionCreateModal}
                                disabled={!selectedNoteGroupId}
                              >
                                Create question card
                              </button>
                              {questionJobStatus !== "idle" ? (
                                <span className={`pill status-${questionJobStatus}`}>
                                  {questionJobStatus}
                                </span>
                              ) : null}
                            </div>
                            {questionCardError ? (
                              <p className="error">{questionCardError}</p>
                            ) : null}
                          </div>
                        </section>
                      </>
                    ) : null}
                  </>
                )}
              </>
            )}
          </div>
          {sectionNavItems.length ? (
            <aside className="content-nav">
              <div className="content-nav-inner">
                <p className="label">On this page</p>
                <nav className="content-nav-links">
                  {sectionNavItems.map((item) => (
                    <a key={item.id} href={`#${item.id}`} className="content-nav-link">
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          ) : null}
        </div>
      </main>
      <ToastContainer position="bottom-right" autoClose={4000} />
    </div>
  );
}
