import { toast } from "sonner";

import {
  createQuestionCard,
  createStudyCard,
  deleteNoteGroup,
  deleteQuestionCard,
  deleteStudyCard,
  generateNoteGroupMindMap,
  generateQuestionCards,
  getNoteGroupMindMap,
  listQuestionCards,
  updateNoteGroupTitle,
  updateQuestionCard,
  updateStudyCard
} from "@/api";
import { modulePath } from "@/lib/routes";

const parseOptions = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const parseIndices = (text) =>
  text
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((value) => Number.isInteger(value));

export function useNoteGroupPageActions({
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
  syncConceptStatusesFromMindMap
}) {
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

  const handleSaveMetadataTitle = async (metadataTitleDraftOverride = metadataTitleDraft) => {
    if (!canManageSelectedSubject) {
      setMetadataError(
        canUseProtectedActions ? "Maintainer access is required to edit note group metadata." : "Sign in to edit note group metadata."
      );
      return;
    }
    if (!selectedNoteGroupId) {
      return;
    }
    const trimmed = metadataTitleDraftOverride.trim();
    if (!trimmed) {
      setMetadataError("Title cannot be empty.");
      return;
    }
    setMetadataSaving(true);
    setMetadataError("");
    try {
      const updated = await updateNoteGroupTitle(selectedNoteGroupId, { title: trimmed });
      setNoteGroups((prev) => prev.map((group) => (group.id === updated.id ? updated : group)));
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
          : "/",
        { state: { sidebarScope: "concepts" } }
      );
    } catch (error) {
      setSidebarError(error.message || "Failed to delete note group");
    }
  };

  const handleRegenerateNeedsReviewKnowledgeNodes = async () => {
    if (!canManageSelectedSubject) {
      setNoteGroupMindMapError(
        canUseProtectedActions
          ? "Maintainer access is required to regenerate Knowledge Nodes."
          : "Sign in to regenerate Knowledge Nodes."
      );
      return;
    }
    if (!selectedNoteGroupId || noteGroupNeedsReviewRegenerating) {
      return;
    }
    setNoteGroupNeedsReviewRegenerating(true);
    setNoteGroupMindMapError("");
    try {
      const graph = await syncConceptStatusesFromMindMap.regenerate(selectedNoteGroupId);
      setNoteGroupMindMap(graph);
      syncConceptStatusesFromMindMap.apply(graph);
      toast.success("Needs review Knowledge Nodes regenerated.");
      setMindMapRefreshToken((prev) => prev + 1);
    } catch (error) {
      setNoteGroupMindMapError(error.message || "Failed to regenerate needs review Knowledge Nodes");
    } finally {
      setNoteGroupNeedsReviewRegenerating(false);
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
                  title: updated.title
                }
              }
            : row
        )
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
        rows: prev.rows.filter((row) => row.study_card.id !== cardId)
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
          prompt: updated.prompt
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
                : withoutUpdated
            };
          })
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
          )
        }))
      }));
      setMindMapRefreshToken((prev) => prev + 1);
      return true;
    } catch (error) {
      setQuestionCardError(error.message || "Failed to delete question card");
      return false;
    }
  };

  return {
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
  };
}
