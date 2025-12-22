import React, { useEffect, useMemo, useState } from "react";
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
  getTitleSuggestions,
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
  updateStudyCard
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

  const [noteGroups, setNoteGroups] = useState([]);
  const [selectedNoteGroupId, setSelectedNoteGroupId] = useState("");
  const [noteGroupMode, setNoteGroupMode] = useState("overview");
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
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState("due");
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
  const [reviewSummary, setReviewSummary] = useState(null);
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

  const noteGroupStats = useMemo(() => {
    const now = Date.now();
    const dueCount = questionCards.filter((card) => {
      if (!card.due_at) {
        return true;
      }
      const dueTime = new Date(card.due_at).getTime();
      return Number.isNaN(dueTime) ? true : dueTime <= now;
    }).length;
    const staleCount = questionCards.filter((card) => card.stale).length;
    return {
      studyCount: studyCards.length,
      questionCount: questionCards.length,
      dueCount,
      staleCount
    };
  }, [questionCards, studyCards]);

  const subjectOptions = useMemo(
    () => subjects.map((subject) => ({ value: subject.id, label: subject.title })),
    [subjects]
  );
  const moduleOptions = useMemo(
    () => modules.map((module) => ({ value: module.id, label: module.title })),
    [modules]
  );
  const noteGroupOptions = useMemo(
    () =>
      noteGroups.map((group) => ({
        value: group.id,
        label: group.title || "Untitled note group"
      })),
    [noteGroups]
  );

  const newChipDisplay = useMemo(() => {
    const merged = [...chipSuggestionNew, ...selectedNewChipLabels];
    return Array.from(new Set(merged));
  }, [chipSuggestionNew, selectedNewChipLabels]);

  const currentReviewCard = reviewQueue[reviewIndex];
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
    listTopicChips(selectedModuleId)
      .then((data) => setTopicChips(data))
      .catch((error) => setSidebarError(error.message));
  }, [selectedModuleId]);

  useEffect(() => {
    if (!selectedModuleId) {
      setNoteGroups([]);
      setSelectedNoteGroupId("");
      return;
    }
    listNoteGroups(selectedModuleId, chipFilterIds)
      .then((data) => {
        setNoteGroups(data);
        if (!routeNoteGroupId) {
          if (!data.some((group) => group.id === selectedNoteGroupId)) {
            setSelectedNoteGroupId(data[0]?.id || "");
          }
        }
      })
      .catch((error) => setSidebarError(error.message));
  }, [selectedModuleId, chipFilterIds, routeNoteGroupId, selectedNoteGroupId]);

  useEffect(() => {
    if (!selectedNoteGroupId) {
      setStudyCards([]);
      setQuestionCards([]);
      setNoteGroupChipIds([]);
      setMetadataTitleDraft("");
      return;
    }
    setStudyCardError("");
    setQuestionCardError("");
    setQuestionJobStatus("idle");
    getNoteGroup(selectedNoteGroupId)
      .then((data) => {
        setNoteGroupChipIds((data.topic_chips || []).map((chip) => chip.id));
        setMetadataTitleDraft(data.title || "");
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
    setMetadataError("");
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
  }, [selectedNoteGroupId]);

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
      setNewModuleTitle("");
      setNewModuleDescription("");
    } catch (error) {
      setSidebarError(error.message || "Failed to create module");
    }
  };

  const handleSelectNoteGroup = (option) => {
    const nextId = option ? option.value : "";
    setSelectedNoteGroupId(nextId);
    setNoteGroupMode("overview");
    setReviewSummary(null);
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    if (!nextId) {
      navigate("/");
      return;
    }
    if (routePanel) {
      navigate(`/note-groups/${nextId}/${routePanel}`);
      return;
    }
    navigate("/");
  };

  const handleStartCreateNoteGroup = () => {
    setNoteGroupMode("create");
    setSelectedNoteGroupId("");
    setReviewSummary(null);
    setIsChatOpen(false);
    setIsMetadataOpen(false);
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
      setStudyCards(response.study_cards || []);
      const groups = await listNoteGroups(selectedModuleId, chipFilterIds);
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

  const handleToggleFilterChip = (chipId) => {
    setChipFilterIds((prev) =>
      prev.includes(chipId) ? prev.filter((id) => id !== chipId) : [...prev, chipId]
    );
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
    } catch (error) {
      setStudyCardError(error.message || "Failed to create study card");
    }
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

  const startReview = async (mode) => {
    if (!selectedNoteGroupId) {
      return;
    }
    setReviewError("");
    setReviewMode(mode);
    try {
      const response = await listReviewQuestionCards(
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
      setReviewQueue(cards);
      setReviewIndex(0);
      setReviewAnswer([]);
      setReviewStartTime(Date.now());
      setReviewFeedback(null);
      setReviewSummary(null);
      setReviewStats({
        correct: 0,
        incorrect: 0,
        answered: 0,
        total: cards.length,
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
    const correct = card.correct_option_indices.slice().sort().join(",") ===
      reviewAnswer.slice().sort().join(",");
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
        correctIndices: card.correct_option_indices || []
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
      mode: reviewMode,
      answered,
      total,
      correct: reviewStats.correct,
      incorrect: reviewStats.incorrect,
      remaining: Math.max(total - answered, 0),
      accuracy,
      avgSeconds
    });
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
    } catch (error) {
      setQuestionCardError(error.message || "Failed to create question card");
    }
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

  const handleSendChat = async () => {
    if (!selectedModuleId || !chatInput.trim()) {
      return;
    }
    setChatLoading(true);
    setChatError("");
    const message = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    try {
      const response = await sendChat({
        module_id: selectedModuleId,
        message,
        note_group_id: scopeToNoteGroup ? selectedNoteGroupId || null : null
      });
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.answer, refs: response.study_card_refs || [] }
      ]);
    } catch (error) {
      setChatError(error.message || "Chat failed");
    } finally {
      setChatLoading(false);
    }
  };

  const handleBreadcrumbHome = () => {
    setSelectedSubjectId("");
    setSelectedModuleId("");
    setSelectedNoteGroupId("");
    setNoteGroupMode("overview");
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    navigate("/");
  };

  const handleBreadcrumbSubject = () => {
    setSelectedModuleId("");
    setSelectedNoteGroupId("");
    setNoteGroupMode("overview");
    setIsChatOpen(false);
    setIsMetadataOpen(false);
    navigate("/");
  };

  const handleBreadcrumbModule = () => {
    setSelectedNoteGroupId("");
    setNoteGroupMode("overview");
    setIsChatOpen(false);
    setIsMetadataOpen(false);
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
          <div className="review-modal">
            {reviewSummary ? (
              <>
                <h2>Review summary</h2>
                <div className="review-meta">
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
                    Card {reviewIndex + 1} / {reviewQueue.length}
                  </span>
                  <span className="pill">Mode: {reviewMode}</span>
                  {currentReviewCard ? (
                    <span className="pill">Due: {formatDueAt(currentReviewCard.due_at)}</span>
                  ) : null}
                </div>
                {reviewError ? <p className="error">{reviewError}</p> : null}
                {currentReviewCard ? (
                  <>
                    <h3>{currentReviewCard.prompt}</h3>
                    <p className="muted">
                      {currentReviewCard.type === "multi"
                        ? "Select all that apply."
                        : "Select the best answer."}
                    </p>
                    <div className="review-options">
                      {currentReviewCard.options.map((option, optionIndex) => {
                        const isSelected = reviewAnswer.includes(optionIndex);
                        const isCorrect = reviewFeedback?.correctIndices?.includes(optionIndex);
                        const showIncorrect =
                          reviewFeedback && isSelected && !isCorrect;
                        return (
                          <button
                            key={`${currentReviewCard.id}-${optionIndex}`}
                            type="button"
                            className={`review-option ${
                              isSelected ? "selected" : ""
                            } ${isCorrect ? "correct" : ""} ${
                              showIncorrect ? "incorrect" : ""
                            }`}
                            onClick={() =>
                              reviewFeedback
                                ? null
                                : toggleReviewAnswer(optionIndex, currentReviewCard.type)
                            }
                            disabled={Boolean(reviewFeedback)}
                          >
                            {option}
                          </button>
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
        </div>
      ) : null}
      {isChatOpen ? (
        <div className="chat-overlay">
          <div className="chat-modal">
            <div className="chat-modal-header">
              <div>
                <h2>Chat with your notes</h2>
                <p className="muted">Ask about this module or the current note group.</p>
              </div>
              <button className="button ghost" type="button" onClick={() => setIsChatOpen(false)}>
                Close
              </button>
            </div>
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
            <div className="chat">
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
                      <p className="refs">Refs: {message.refs.join(", ")}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
            {chatError ? <p className="error">{chatError}</p> : null}
            <div className="chat-input">
              <input
                type="text"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask a question about this module or note group..."
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
            onChange={(option) => setSelectedSubjectId(option ? option.value : "")}
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
            onChange={(option) => setSelectedModuleId(option ? option.value : "")}
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
          <div className="chip-filter">
            {topicChips.length === 0 ? (
              <span className="muted">No topic chips yet.</span>
            ) : (
              topicChips.map((chip) => (
                <label key={chip.id} className="chip-toggle">
                  <input
                    type="checkbox"
                    checked={chipFilterIds.includes(chip.id)}
                    onChange={() => handleToggleFilterChip(chip.id)}
                  />
                  {chip.label}
                </label>
              ))
            )}
          </div>
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
                : "Manage your note group, review questions, and chat with your study cards."}
            </p>
          </div>
          <div className="status-card">
            <div>
              <p className="label">Subject</p>
              <p className="value">{selectedSubject ? selectedSubject.title : "None"}</p>
            </div>
            <div>
              <p className="label">Module</p>
              <p className="value">{selectedModule ? selectedModule.title : "None"}</p>
            </div>
            <div>
              <p className="label">Note Group</p>
              <p className="value">
                {noteGroupMode === "create"
                  ? "Creating..."
                  : selectedNoteGroup
                    ? selectedNoteGroup.title || "Untitled"
                    : "None"}
              </p>
            </div>
          </div>
        </header>

        {noteGroupMode === "create" ? (
          <>
            <section className="panel">
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

            <section className="panel">
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

            <section className="panel">
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

            <section className="panel">
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
              <section className="panel">
                <h2>Select a note group</h2>
                <p className="muted">
                  Pick a note group from the sidebar or create a new one to get started.
                </p>
              </section>
            ) : (
              <>
                {!isStudyPage && !isQuestionPage ? (
                  <section className="panel">
                    <h2>{selectedNoteGroup?.title || "Untitled note group"}</h2>
                    <p className="muted">Snapshot of your current note group.</p>
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
                      </div>
                    {studyCardError ? <p className="error">{studyCardError}</p> : null}
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
                      <button
                        className="button primary"
                        type="button"
                        onClick={handleCreateStudyCard}
                        disabled={!selectedNoteGroupId || !newStudyCardContent.trim()}
                      >
                        Add study card
                      </button>
                    </div>
                    <div className="cards">
                      {studyCards.length === 0 ? (
                        <p className="empty">No study cards yet.</p>
                      ) : (
                        studyCards.map((card) => (
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
                    <section className="panel">
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

                    <section className="results">
                      <div className="results-header">
                        <h2>Question cards</h2>
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
                          {questionJobStatus !== "idle" ? (
                            <span className={`pill status-${questionJobStatus}`}>
                              {questionJobStatus}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {questionCardError ? (
                        <p className="error">{questionCardError}</p>
                      ) : null}
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
                        <button
                          className="button ghost"
                          type="button"
                          onClick={handleCreateQuestionCard}
                          disabled={!selectedNoteGroupId || !newQuestionPrompt.trim()}
                        >
                          Add question card
                        </button>
                      </div>
                      <div className="cards">
                        {questionCards.length === 0 ? (
                          <p className="empty">No questions yet.</p>
                        ) : (
                          questionCards.map((card, index) => (
                            <article key={card.id} className="card">
                              <div className="card-header">
                                <h3>
                                  Q{index + 1}. {card.type.toUpperCase()}
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
                                      onClick={() => handleSaveQuestionCard(card.id)}
                                    >
                                      Save
                                    </button>
                                    <button
                                      className="button ghost"
                                      type="button"
                                      onClick={() => setEditingQuestionCardId("")}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p>{card.prompt}</p>
                                  {card.stale ? <span className="pill stale">Stale</span> : null}
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
                                      onClick={() => handleEditQuestionCard(card)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="button ghost"
                                      type="button"
                                      onClick={() => handleDeleteQuestionCard(card.id)}
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
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
