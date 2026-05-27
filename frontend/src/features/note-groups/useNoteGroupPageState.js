import { useState } from "react";

export function useNoteGroupPageState() {
  const [noteGroupSource, setNoteGroupSource] = useState("");
  const [sourceChecking, setSourceChecking] = useState(false);
  const [sourceChecked, setSourceChecked] = useState(false);
  const [sourceConfirmed, setSourceConfirmed] = useState(false);
  const [sourceDuplicateCount, setSourceDuplicateCount] = useState(0);
  const [sourceDuplicates, setSourceDuplicates] = useState([]);
  const [sourceCheckError, setSourceCheckError] = useState("");
  const [noteGroupSearch, setNoteGroupSearch] = useState("");
  const [noteGroupMode, setNoteGroupMode] = useState("overview");
  const [readingMode, setReadingMode] = useState("study");
  const [readingHoverCardId, setReadingHoverCardId] = useState("");
  const [readingPinnedCardId, setReadingPinnedCardId] = useState("");
  const [activeSourceRangeIndex, setActiveSourceRangeIndex] = useState(0);
  const [progressRange, setProgressRange] = useState("30d");
  const [noteGroupNeedsReviewRegenerating, setNoteGroupNeedsReviewRegenerating] = useState(false);
  const [isReadingOpen, setIsReadingOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataError, setMetadataError] = useState("");
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
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isQuestionCreateOpen, setIsQuestionCreateOpen] = useState(false);
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

  return {
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
    activeSourceRangeIndex,
    setActiveSourceRangeIndex,
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
  };
}
