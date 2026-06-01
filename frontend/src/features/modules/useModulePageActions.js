import { toast } from "sonner";

import { deleteModule, updateModule, updateNoteGroupOrder } from "@/api";
import { countWords, getModuleAdditionalInstructions } from "@/lib/format";
import { dashboardPath, modulePath, subjectPath } from "@/lib/routes";

export function reorderNoteGroups(items, sourceId, targetId) {
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
}

export function useModulePageActions({
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
}) {
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
        navigate(selectedSubjectCode ? subjectPath(selectedSubjectCode) : dashboardPath);
      }
    } catch (error) {
      setSidebarError(error.message || "Failed to delete module");
    }
  };

  const handleChipFilterSelect = (options) => {
    const nextIds = options ? options.map((option) => option.value) : [];
    setChipFilterIds(nextIds);
  };

  const handleResetChipFilters = () => {
    setChipFilterIds([]);
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
    setModuleAdditionalInstructionsDraft(getModuleAdditionalInstructions(selectedModule));
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
      setModuleAdditionalInstructionsDraft(getModuleAdditionalInstructions(updated));
      if (selectedModuleId === updated.id) {
        setAutoAdditionalInstructions(getModuleAdditionalInstructions(updated));
      }
    } catch (error) {
      setModuleMetadataError(error.message || "Failed to update module");
    } finally {
      setModuleMetadataSaving(false);
    }
  };

  const navigateToModuleOverview = () => {
    navigate(
      selectedSubjectCode && selectedModuleCode
        ? modulePath(selectedSubjectCode, selectedModuleCode)
        : selectedSubjectCode
          ? subjectPath(selectedSubjectCode)
          : dashboardPath
    );
  };

  return {
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
    navigateToModuleOverview,
    openModuleMetadataModal
  };
}
