import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Select from "react-select";
import {
  attachTopicChips,
  createModule,
  createQuestionCard,
  createStudyCard,
  createSubject,
  createTopicChip,
  deleteQuestionCard,
  deleteStudyCard,
  detachTopicChip,
  finalizeNoteGroup,
  generateQuestionCards,
  getJob,
  getNoteGroup,
  getStudyCard,
  getTitleSuggestions,
  listModuleReviewQuestionCards,
  listModules,
  listNoteGroups,
  listQuestionCards,
  listReviewQuestionCards,
  listStudyCards,
  listSubjects,
  listTopicChips,
  reviewQuestionCard,
  sendChat,
  suggestTopicChips,
  updateNoteGroupTitle,
  updateQuestionCard,
  updateStudyCard,
  updateModule
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

const DUE_WINDOW_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const SIX_MONTHS_MS = 182 * 24 * 60 * 60 * 1000;
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

const selectStyles = {
  menuPortal: (base) => ({ ...base, zIndex: 9999 })
};

export default function App() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [newSubjectTitle, setNewSubjectTitle] = useState("");
  const [newSubjectDescription, setNewSubjectDescription] = useState("");

  const [modules, setModules] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleDescription, setNewModuleDescription] = useState("");
  const [isModuleMetadataOpen, setIsModuleMetadataOpen] = useState(false);
  const [moduleTitleDraft, setModuleTitleDraft] = useState("");
  const [moduleDescriptionDraft, setModuleDescriptionDraft] = useState("");
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
  const [noteGroupMode, setNoteGroupMode] = useState("overview");
  const [formattedSections, setFormattedSections] = useState([]);
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

  const [rawTextDraft, setRawTextDraft] = useState("");
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
  const [sidebarError, setSidebarError] = useState("");

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
  const [questionCount, setQuestionCount] = useState(6);
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

  const getDueCount = (cards, now = Date.now()) =>
    cards.filter((card) => {
      if (!card.due_at) {
        return true;
      }
      const dueTime = new Date(card.due_at).getTime();
      return Number.isNaN(dueTime) ? true : dueTime <= now + DUE_WINDOW_MS;
    }).length;

  const buildTimeline = (cards, now) =>
    cards.reduce(
      (acc, card) => {
        if (!card.due_at) {
          acc.due += 1;
          return acc;
        }
        const dueTime = new Date(card.due_at).getTime();
        if (Number.isNaN(dueTime)) {
          acc.due += 1;
          return acc;
        }
        const diff = dueTime - now;
        if (diff <= DUE_WINDOW_MS) {
          acc.due += 1;
        } else if (diff <= WEEK_MS) {
          acc.week += 1;
        } else if (diff <= MONTH_MS) {
          acc.month += 1;
        } else if (diff <= SIX_MONTHS_MS) {
          acc.sixMonths += 1;
        } else {
          acc.longTerm += 1;
        }
        return acc;
      },
      {
        due: 0,
        week: 0,
        month: 0,
        sixMonths: 0,
        longTerm: 0
      }
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

  const questionTimeline = useMemo(() => {
    const now = Date.now();
    return buildTimeline(filteredQuestionCards, now);
  }, [filteredQuestionCards]);

  const noteGroupStats = useMemo(() => {
    const now = Date.now();
    const dueCount = getDueCount(filteredQuestionCards, now);
    const staleCount = filteredQuestionCards.filter((card) => card.stale).length;
    return {
      studyCount: filteredStudyCards.length,
      questionCount: filteredQuestionCards.length,
      dueCount,
      staleCount
    };
  }, [filteredQuestionCards, filteredStudyCards]);

  const sectionNavItems = useMemo(() => {
    if (noteGroupMode === "create") {
      return [
        { id: "step-raw", label: "Paste raw text" },
        { id: "step-title", label: "Choose a title" },
        { id: "step-chips", label: "Select topic chips" },
        { id: "step-finalize", label: "Generate study cards" }
      ];
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

  const subjectOptions = useMemo(
    () => subjects.map((subject) => ({ value: subject.id, label: subject.title })),
    [subjects]
  );
  const moduleOptions = useMemo(
    () => modules.map((module) => ({ value: module.id, label: module.title })),
    [modules]
  );
  const chipOptions = useMemo(
    () => topicChips.map((chip) => ({ value: chip.id, label: chip.label })),
    [topicChips]
  );
  const chipFilterValue = useMemo(
    () => chipOptions.filter((option) => chipFilterIds.includes(option.value)),
    [chipOptions, chipFilterIds]
  );
  const noteGroupOptions = useMemo(
    () =>
      noteGroups.map((group) => ({
        value: group.id,
        label: group.title || "Untitled note group"
      })),
    [noteGroups]
  );
  const moduleNoteGroupStatsById = useMemo(() => {
    const map = new Map();
    moduleNoteGroupStats.forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }, [moduleNoteGroupStats]);
  const moduleNoteGroupsForDisplay = useMemo(() => {
    if (!chipFilterIds.length || moduleStatsLoading) {
      return noteGroups;
    }
    return noteGroups.filter((group) => {
      const statsEntry = moduleNoteGroupStatsById.get(group.id);
      if (!statsEntry) {
        return true;
      }
      return statsEntry.studyCount > 0 || statsEntry.questionCount > 0;
    });
  }, [noteGroups, chipFilterIds, moduleNoteGroupStatsById, moduleStatsLoading]);
  const studyCardTitleById = useMemo(() => {
    const map = new Map();
    studyCards.forEach((card) => {
      map.set(card.id, card.title || card.id.slice(0, 8));
    });
    return map;
  }, [studyCards]);
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
  const formatNoteGroupOptionLabel = (option, { context }) => {
    if (context === "value") {
      return option.label;
    }
    const statsEntry = moduleNoteGroupStatsById.get(option.value);
    const dueCount = statsEntry?.dueCount;
    return (
      <div className="select-option">
        <span>{option.label}</span>
        {Number.isInteger(dueCount) && dueCount > 0 ? (
          <span className="select-badge">{dueCount}</span>
        ) : null}
      </div>
    );
  };
  const formatModuleOptionLabel = (option, { context }) => {
    const dueCount = moduleDueCounts[option.value];
    if (context === "value" && !(Number.isInteger(dueCount) && dueCount > 0)) {
      return option.label;
    }
    return (
      <div className="select-option">
        <span>{option.label}</span>
        {Number.isInteger(dueCount) && dueCount > 0 ? (
          <span className="select-badge">{dueCount}</span>
        ) : null}
      </div>
    );
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
        if (!data.some((module) => module.id === selectedModuleId)) {
          setSelectedModuleId(data[0]?.id || "");
        }
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
    if (modules.length === 0) {
      setModuleDueCounts({});
      return;
    }
    let cancelled = false;
    const loadModuleCounts = async () => {
      const now = Date.now();
      try {
        const entries = await Promise.all(
          modules.map(async (module) => {
            const groups = await listNoteGroups(module.id);
            if (!groups.length) {
              return [module.id, 0];
            }
            const dueCounts = await Promise.all(
              groups.map(async (group) => {
                const response = await listQuestionCards(group.id);
                return getDueCount(response.question_cards || [], now);
              })
            );
            const totalDue = dueCounts.reduce((sum, count) => sum + count, 0);
            return [module.id, totalDue];
          })
        );
        if (!cancelled) {
          setModuleDueCounts(Object.fromEntries(entries));
        }
      } catch (error) {
        if (!cancelled) {
          setModuleDueCounts({});
          setSidebarError(error.message || "Failed to load module badge counts");
        }
      }
    };
    loadModuleCounts();
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
        setNoteGroups(data);
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
    if (noteGroups.length === 0) {
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
    const loadStats = async () => {
      setModuleStatsLoading(true);
      setModuleStatsError("");
      const now = Date.now();
      try {
        const stats = await Promise.all(
          noteGroups.map(async (group) => {
            const [studyResponse, questionResponse] = await Promise.all([
              listStudyCards(group.id),
              listQuestionCards(group.id)
            ]);
            const studyCardsList = studyResponse.study_cards || [];
            const questionList = questionResponse.question_cards || [];
            let filteredStudyCardsList = studyCardsList;
            let filteredQuestionList = questionList;
            if (chipFilterIds.length) {
              filteredStudyCardsList = studyCardsList.filter((card) =>
                (card.topic_chips || []).some((chip) => chipFilterIds.includes(chip.id))
              );
              const allowedStudyIds = new Set(
                filteredStudyCardsList.map((card) => card.id)
              );
              filteredQuestionList = questionList.filter((card) =>
                (card.study_card_refs || []).some((refId) => allowedStudyIds.has(refId))
              );
            }
            const timeline = buildTimeline(filteredQuestionList, now);
            return {
              id: group.id,
              title: group.title || "Untitled note group",
              studyCount: filteredStudyCardsList.length,
              questionCount: filteredQuestionList.length,
              dueCount: getDueCount(filteredQuestionList, now),
              staleCount: filteredQuestionList.filter((card) => card.stale).length,
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
        setModuleQuestionTimeline(
          stats.reduce(
            (acc, group) => ({
              due: acc.due + group.timeline.due,
              week: acc.week + group.timeline.week,
              month: acc.month + group.timeline.month,
              sixMonths: acc.sixMonths + group.timeline.sixMonths,
              longTerm: acc.longTerm + group.timeline.longTerm
            }),
            {
              due: 0,
              week: 0,
              month: 0,
              sixMonths: 0,
              longTerm: 0
            }
          )
        );
      } catch (error) {
        if (!cancelled) {
          setModuleStatsError(error.message || "Failed to load module stats");
          setModuleQuestionTimeline({
            due: 0,
            week: 0,
            month: 0,
            sixMonths: 0,
            longTerm: 0
          });
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
    if (!selectedNoteGroupId) {
      setStudyCards([]);
      setQuestionCards([]);
      setNoteGroupChipIds([]);
      setMetadataTitleDraft("");
      setFormattedSections([]);
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
    setReviewStartTime(null);
    setIsReviewing(false);
    setReviewFeedback(null);
    setReviewSummary(null);
    setReviewScope("note-group");
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
    setSidebarError("");
  }, [selectedModuleId]);

  useEffect(() => {
    if (!selectedNoteGroupId) {
      setScopeToNoteGroup(false);
    }
  }, [selectedNoteGroupId]);

  const pollJob = async (jobId, updateStatus) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const job = await getJob(jobId);
      updateStatus(job.status);
      if (job.status === "completed") {
        return job;
      }
      if (job.status === "failed") {
        throw new Error(job.error || "Job failed");
      }
      await sleep(2000);
    }
    throw new Error("Job timed out");
  };

  const handleSelectSubject = (option) => {
    const nextId = option ? option.value : "";
    setSelectedSubjectId(nextId);
    setSelectedModuleId("");
    setSelectedNoteGroupId("");
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

  const handleCreateModule = async () => {
    if (!selectedSubjectId || !newModuleTitle.trim()) {
      return;
    }
    setSidebarError("");
    try {
      const module = await createModule(selectedSubjectId, {
        title: newModuleTitle.trim(),
        description: newModuleDescription.trim() || null
      });
      setModules((prev) => [module, ...prev]);
      setSelectedModuleId(module.id);
      setSelectedNoteGroupId("");
      setNoteGroupMode("overview");
      setReviewSummary(null);
      setIsChatOpen(false);
      setIsMetadataOpen(false);
      setIsModuleMetadataOpen(false);
      navigate("/");
      setNewModuleTitle("");
      setNewModuleDescription("");
    } catch (error) {
      setSidebarError(error.message || "Failed to create module");
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

  const handleSelectNoteGroup = (option) => {
    const nextId = option ? option.value : "";
    navigateToNoteGroup(nextId);
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
    if (!selectedModuleId || !rawTextDraft.trim() || !finalTitle) {
      setFinalizeError("Provide raw text and select a title first.");
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
        raw_text: rawTextDraft.trim(),
        title: finalTitle,
        existing_chip_ids: selectedExistingChipIds,
        new_chip_labels: selectedNewChipLabels
      });
      const createdNoteGroup = response.note_group;
      setSelectedNoteGroupId(createdNoteGroup.id);
      setNoteGroupChipIds((createdNoteGroup.topic_chips || []).map((chip) => chip.id));
      setFormattedSections(createdNoteGroup.formatted_sections || []);
      setStudyCards(response.study_cards || []);
      const groups = await listNoteGroups(selectedModuleId);
      setNoteGroups(groups);
      const chips = await listTopicChips(selectedModuleId);
      setTopicChips(chips);
      setNoteGroupMode("overview");
      navigate(`/note-groups/${createdNoteGroup.id}/study-cards`);
      setRawTextDraft("");
      setTitleSuggestions([]);
      setSelectedTitleSuggestion("");
      setCustomTitle("");
      setHasTitleSuggestions(false);
      setChipSuggestionIds([]);
      setChipSuggestionNew([]);
      setSelectedExistingChipIds([]);
      setSelectedNewChipLabels([]);
      setHasChipSuggestions(false);
    } catch (error) {
      setFinalizeError(error.message || "Failed to finalize note group");
    } finally {
      setFinalizeLoading(false);
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
    await handleCreateChip(moduleChipLabel);
    setModuleChipLabel("");
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

  const openModuleMetadataModal = () => {
    if (!selectedModuleId) {
      return;
    }
    setModuleTitleDraft(selectedModule?.title || "");
    setModuleDescriptionDraft(selectedModule?.description || "");
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
    setModuleMetadataSaving(true);
    setModuleMetadataError("");
    try {
      const updated = await updateModule(selectedModuleId, {
        title: trimmedTitle,
        description: moduleDescriptionDraft.trim() || null
      });
      setModules((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setModuleTitleDraft(updated.title || "");
      setModuleDescriptionDraft(updated.description || "");
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
        count: Number(questionCount) || 6,
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
        correctIndices
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

  const endReview = () => {
    const answered = reviewStats.answered;
    const total = reviewStats.total;
    const totalMs = reviewStats.totalMs;
    const accuracy = answered ? Math.round((reviewStats.correct / answered) * 100) : 0;
    const avgSeconds = answered ? (totalMs / answered / 1000).toFixed(1) : "0.0";
    setReviewSummary({
      scope: reviewScope,
      mode: reviewMode,
      answered,
      total,
      correct: reviewStats.correct,
      incorrect: reviewStats.incorrect,
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

  return (
    <div className="app">
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
                              explanation: fallbackExplanations[index] || ""
                            };
                          })).map((choice, optionIndex) => {
                          const explanation = choice.explanation;
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
                                <div className="review-explanation-bubble">
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
                      </div>
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
                <h2>Formatted notes</h2>
                <p className="muted">Read-only source text mapped to your study cards.</p>
              </div>
              <button
                className="button ghost"
                type="button"
                onClick={() => setIsReadingOpen(false)}
              >
                Close
              </button>
            </div>
            {formattedSections.length === 0 ? (
              <p className="muted">No formatted text available for this note group yet.</p>
            ) : (
              <div className="reading-body">
                <aside className="reading-nav">
                  <p className="label">Sections</p>
                  {formattedSections.map((section, index) => {
                    const anchor = getSectionAnchor(section, index);
                    return (
                      <button
                        key={`nav-${anchor}`}
                        className="reading-link"
                        type="button"
                        onClick={() => handleJumpToSection(anchor)}
                      >
                        {section.title || `Section ${index + 1}`}
                      </button>
                    );
                  })}
                </aside>
                <div className="reading-content" ref={readingContentRef}>
                  {formattedSections.map((section, index) => {
                    const anchor = getSectionAnchor(section, index);
                    const cardTitle = studyCardTitleById.get(section.study_card_id);
                    return (
                      <section key={anchor} id={anchor} className="reading-section">
                        <div className="reading-section-header">
                          <h3>{section.title || `Section ${index + 1}`}</h3>
                          <span className="pill">
                            Study card:{" "}
                            {cardTitle ||
                              (section.study_card_id ? section.study_card_id.slice(0, 8) : "—")}
                          </span>
                        </div>
                        <div className="reading-section-body">
                          {renderMarkdownBlocks(section.content)}
                        </div>
                      </section>
                    );
                  })}
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
              <div className="chip-grid">
                {topicChips.map((chip) => (
                  <label key={chip.id} className="chip-toggle">
                    <input
                      type="checkbox"
                      checked={newStudyCardChipIds.includes(chip.id)}
                      onChange={() =>
                        setNewStudyCardChipIds((prev) =>
                          prev.includes(chip.id)
                            ? prev.filter((id) => id !== chip.id)
                            : [...prev, chip.id]
                        )
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
      {isModuleMetadataOpen ? (
        <div className="meta-overlay">
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Edit module metadata</h2>
                <p className="muted">Update the module title and description.</p>
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
            <div className="button-row">
              <button
                className="button primary"
                type="button"
                onClick={handleSaveModuleMetadata}
                disabled={moduleMetadataSaving || !moduleTitleDraft.trim()}
              >
                {moduleMetadataSaving ? "Saving..." : "Save module"}
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
            <div className="chip-grid">
              {topicChips.length === 0 ? (
                <p className="muted">Create chips to tag and filter note groups.</p>
              ) : (
                topicChips.map((chip) => (
                  <label key={chip.id} className="chip-toggle">
                    <input
                      type="checkbox"
                      checked={noteGroupChipIds.includes(chip.id)}
                      onChange={(event) =>
                        handleToggleNoteGroupChip(chip.id, event.target.checked)
                      }
                    />
                    {chip.label}
                  </label>
                ))
              )}
            </div>
            <div className="form-inline">
              <input
                type="text"
                value={moduleChipLabel}
                onChange={(event) => setModuleChipLabel(event.target.value)}
                placeholder="New topic chip"
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
      <aside className="sidebar">
        <div className="sidebar-section">
          <h3>Subjects</h3>
          <Select
            className="select"
            classNamePrefix="select"
            options={subjectOptions}
            value={subjectOptions.find((option) => option.value === selectedSubjectId) || null}
            onChange={handleSelectSubject}
            placeholder="Search subjects"
            isClearable
            maxMenuHeight={220}
            menuPortalTarget={document.body}
            styles={selectStyles}
          />
          <div className="form-block">
            <input
              type="text"
              value={newSubjectTitle}
              onChange={(event) => setNewSubjectTitle(event.target.value)}
              placeholder="New subject title"
            />
            <input
              type="text"
              value={newSubjectDescription}
              onChange={(event) => setNewSubjectDescription(event.target.value)}
              placeholder="Optional description"
            />
            <button
              className="button ghost"
              type="button"
              onClick={handleCreateSubject}
              disabled={!newSubjectTitle.trim()}
            >
              Add subject
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Modules</h3>
          <Select
            className="select"
            classNamePrefix="select"
            options={moduleOptions}
            value={moduleOptions.find((option) => option.value === selectedModuleId) || null}
            onChange={handleSelectModule}
            formatOptionLabel={formatModuleOptionLabel}
            placeholder={selectedSubjectId ? "Search modules" : "Select a subject"}
            isDisabled={!selectedSubjectId}
            isClearable
            maxMenuHeight={220}
            noOptionsMessage={() =>
              selectedSubjectId ? "No modules yet." : "Pick a subject to view modules."
            }
            menuPortalTarget={document.body}
            styles={selectStyles}
          />
          <div className="form-block">
            <input
              type="text"
              value={newModuleTitle}
              onChange={(event) => setNewModuleTitle(event.target.value)}
              placeholder="New module title"
              disabled={!selectedSubjectId}
            />
            <input
              type="text"
              value={newModuleDescription}
              onChange={(event) => setNewModuleDescription(event.target.value)}
              placeholder="Optional description"
              disabled={!selectedSubjectId}
            />
            <button
              className="button ghost"
              type="button"
              onClick={handleCreateModule}
              disabled={!selectedSubjectId || !newModuleTitle.trim()}
            >
              Add module
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Note groups</h3>
          <Select
            className="select"
            classNamePrefix="select"
            options={noteGroupOptions}
            value={noteGroupOptions.find((option) => option.value === selectedNoteGroupId) || null}
            onChange={handleSelectNoteGroup}
            formatOptionLabel={formatNoteGroupOptionLabel}
            placeholder={selectedModuleId ? "Search note groups" : "Select a module"}
            isDisabled={!selectedModuleId}
            isClearable
            maxMenuHeight={220}
            noOptionsMessage={() =>
              selectedModuleId ? "No note groups match." : "Pick a module to view note groups."
            }
            menuPortalTarget={document.body}
            styles={selectStyles}
          />
          <button
            className={`button ghost ${noteGroupMode === "create" ? "active" : ""}`}
            type="button"
            onClick={handleStartCreateNoteGroup}
            disabled={!selectedModuleId}
          >
            Create new note group
          </button>
        </div>
        {sidebarError ? <p className="error">{sidebarError}</p> : null}
      </aside>

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
                : selectedNoteGroupId
                  ? "Manage your note group, review questions, and chat with your study cards."
                  : selectedModuleId
                    ? "Review question cards across note groups, edit module metadata, and chat with your module study cards."
                    : "Pick a subject and module to get started."}
            </p>
          </div>
        </header>
        <div className="content-layout">
          <div className="content-main">
            {noteGroupMode === "create" ? (
              <>
            <section className="panel" id="step-raw">
              <h2>1. Paste raw text</h2>
              <div className="field">
                <label htmlFor="raw-text">Raw text</label>
                <textarea
                  id="raw-text"
                  value={rawTextDraft}
                  onChange={(event) => setRawTextDraft(event.target.value)}
                  placeholder="Paste lecture notes or a chapter excerpt..."
                  rows={8}
                  disabled={!selectedModuleId}
                />
              </div>
              <button
                className="button primary"
                type="button"
                onClick={handleGenerateTitleSuggestions}
                disabled={!selectedModuleId || !rawTextDraft.trim() || titleLoading}
              >
                {titleLoading ? "Generating titles..." : "Generate title suggestions"}
              </button>
              {titleError ? <p className="error">{titleError}</p> : null}
            </section>

            <section className="panel" id="step-title">
              <h2>2. Choose a title</h2>
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
                  disabled={!selectedModuleId}
                />
              </div>
            </section>

            <section className="panel" id="step-chips">
              <h2>3. Select topic chips</h2>
              <button
                className="button ghost"
                type="button"
                onClick={handleGenerateChipSuggestions}
                disabled={
                  !selectedModuleId ||
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
                    disabled={!wizardChipLabel.trim()}
                  >
                    Add new chip
                  </button>
                  <button
                    className="button ghost"
                    type="button"
                    onClick={handleCreateWizardChip}
                    disabled={!selectedModuleId || !wizardChipLabel.trim()}
                  >
                    Save to module pool
                  </button>
                </div>
              </div>
            </section>

            <section className="panel" id="step-finalize">
              <h2>4. Generate study cards</h2>
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
            ) : (
              <>
                {!selectedNoteGroupId ? (
                  !selectedModuleId ? (
                    <section className="panel">
                      <h2>Select a module</h2>
                      <p className="muted">
                        Choose a module to see its note groups, review cards, and chat with your notes.
                      </p>
                    </section>
                  ) : (
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
                            Edit module metadata
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
                          Due includes anything scheduled within the next 24 hours.
                        </p>
                      </section>
                      <section className="panel" id="module-note-groups">
                        <h2>Note groups in this module</h2>
                        {chipFilterIds.length ? (
                          <p className="muted">Filtered by selected topic chips.</p>
                        ) : null}
                        {moduleNoteGroupsForDisplay.length === 0 ? (
                          <p className="muted">
                            {chipFilterIds.length
                              ? "No note groups match the selected topic chips."
                              : "No note groups yet."}
                          </p>
                        ) : (
                          <div className="cards">
                            {moduleNoteGroupsForDisplay.map((group) => {
                              const stats = moduleNoteGroupStatsById.get(group.id);
                              return (
                                <article key={group.id} className="card">
                                  <div className="card-header">
                                    <h3>{group.title || "Untitled note group"}</h3>
                                    <span className="mono">{group.id.slice(0, 8)}</span>
                                  </div>
                                  <div className="review-meta">
                                    <span className="pill">
                                      Study cards: {stats ? stats.studyCount : "—"}
                                    </span>
                                    <span className="pill">
                                      Questions: {stats ? stats.questionCount : "—"}
                                    </span>
                                    <span className="pill">
                                      Due: {stats ? stats.dueCount : "—"}
                                    </span>
                                    {stats ? (
                                      <span className="pill stale">
                                        Stale: {stats.staleCount}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="button-row">
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
                  )
                ) : (
                  <>
                    {!isStudyPage && !isQuestionPage ? (
                      <section className="panel" id="note-group-overview">
                        <h2>{selectedNoteGroup?.title || "Untitled note group"}</h2>
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
                            disabled={!formattedSections.length}
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
                        </div>
                      </section>
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
                            Due includes anything scheduled within the next 24 hours.
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
                              <div className="field inline">
                                <label htmlFor="question-count">Count</label>
                                <input
                                  id="question-count"
                                  type="number"
                                  min="1"
                                  max="20"
                                  value={questionCount}
                                  onChange={(event) => setQuestionCount(event.target.value)}
                                />
                              </div>
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
    </div>
  );
}
