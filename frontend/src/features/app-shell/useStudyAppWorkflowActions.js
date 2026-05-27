import { toast } from "sonner";

import { getLocalMailpitUrl } from "@/auth/supabaseClient";
import { useReadingWorkflowActions } from "@/features/reading/useReadingWorkflowActions";
import { useSubjectWorkflowActions } from "@/features/subjects/useSubjectWorkflowActions";
import { conceptPath, createNoteGroupPath, modulePath, noteGroupPath, subjectPath } from "@/lib/routes";
import { countWords, getModuleAdditionalInstructions } from "@/lib/format";
import { attachConcepts, autoCreateNoteGroup, checkNoteGroupSource, createModule, createSubject, createConcept, detachConcept, getJob, getNoteGroup, regenerateNoteGroupNeedsReviewKnowledgeNodes, sendModuleIntentChat, sendSubjectIntentChat, updateSubject } from "@/api";

export function useStudyAppWorkflowActions(ctx) {
  const { activeSourceRangeIndex, attachConcepts, auth, authEmail, authSubmitting, autoAdditionalInstructions, autoCreateNoteGroup, autoRawText, canCreateSubjects, canDeleteSubject, canMaintainSubject, canManageSelectedSubject, canUseProtectedActions, checkNoteGroupSource, conceptPath, countWords, createConcept, createModule, createNoteGroupPath, createSubject, deleteSubject, detachConcept, editingQuestionCard, editingStudyCard, generateUniqueId, getLocalMailpitUrl, getModuleAdditionalInstructions, getNoteGroup, handleBreadcrumbModule, isQuestionPage, isStudyPage, isViewCardsPage, metadataTitleDraft, moduleChipDescription, moduleChipLabel, modulePath, moduleWizardCreating, moduleWizardGoal, moduleWizardInput, moduleWizardLoading, moduleWizardMessages, moduleWizardScope, moduleWizardTitle, modules, navigate, newQuestionCorrectIndices, newQuestionOptions, newQuestionPrompt, newQuestionRefs, newQuestionType, newStudyCardChipIds, newStudyCardContent, newStudyCardTitle, newSubjectDescription, newSubjectTitle, noteGroupChipIds, noteGroupMindMapGenerating, noteGroupNeedsReviewRegenerating, noteGroupPath, noteGroupSource, noteGroups, pollJob, readingContentRef, readingHoverCardId, readingMode, readingPinnedCardId, refreshModuleGeneratedData, refreshModuleGenerationWorkflowSnapshot, regenerateNoteGroupNeedsReviewKnowledgeNodes, requestConfirm, routePanel, selectedModule, selectedModuleCode, selectedModuleId, selectedNoteGroup, selectedNoteGroupId, selectedNoteGroupIdRef, selectedSubject, selectedSubjectCode, selectedSubjectId, selectedTopic, selectedTopicId, sendModuleIntentChat, sendSubjectIntentChat, setActiveSourceRangeIndex, setAuthMessage, setAuthSubmitting, setAuthUiError, setAutoAdditionalInstructions, setAutoCreateError, setAutoCreateLoading, setAutoRawText, setChipFilterIds, setCurrentUserProfile, setEditingQuestionCard, setEditingQuestionCardId, setEditingStudyCard, setEditingStudyCardId, setEditingSubjectId, setIsAdminPanelOpen, setIsChatOpen, setIsGeneratingQuestions, setIsMetadataOpen, setIsModuleMetadataOpen, setIsModuleWizardOpen, setIsQuestionCreateOpen, setIsStudyCreateOpen, setIsSubjectManagementOpen, setIsSubjectMetadataOpen, setIsSubjectWizardOpen, setMetadataError, setMetadataSaving, setMetadataTitleDraft, setMindMapRefreshToken, setModuleChipDescription, setModuleChipLabel, setModuleWizardCreating, setModuleWizardError, setModuleWizardGoal, setModuleWizardInput, setModuleWizardLoading, setModuleWizardMessages, setModuleWizardScope, setModuleWizardTitle, setModules, setNewQuestionCorrectIndices, setNewQuestionOptions, setNewQuestionPrompt, setNewQuestionRefs, setNewStudyCardChipIds, setNewStudyCardContent, setNewStudyCardTitle, setNewSubjectDescription, setNewSubjectTitle, setNoteGroupCardTable, setNoteGroupChipIds, setNoteGroupMindMap, setNoteGroupMindMapError, setNoteGroupMindMapGenerating, setNoteGroupMode, setNoteGroupNeedsReviewRegenerating, setNoteGroupSearch, setNoteGroupSource, setNoteGroups, setQuestionCardError, setQuestionCards, setQuestionJobStatus, setReadingHoverCardId, setReadingMode, setReadingPinnedCardId, setReviewSummary, setSelectedModuleId, setSelectedNoteGroupId, setSelectedSubjectId, setSelectedTopicId, setSidebarError, setSidebarScope, setSourceCheckError, setSourceChecked, setSourceChecking, setSourceConfirmed, setSourceDuplicateCount, setSourceDuplicates, setStudyCardError, setStudyCards, setSubjectGoalDraft, setSubjectMetadataError, setSubjectMetadataSaving, setSubjectScopeDraft, setSubjectTitleDraft, setSubjectWizardCreating, setSubjectWizardError, setSubjectWizardGoal, setSubjectWizardInput, setSubjectWizardLoading, setSubjectWizardMessages, setSubjectWizardScope, setSubjectWizardTitle, setSubjects, setTopicChips, setTopicDescriptionDraft, setTopicError, setTopicKnowledgeNodeRegenerating, setTopicKnowledgeNodeRegeneratingId, setTopicSaving, setTopicTitleDraft, sourceConfirmed, studyCards, studyNoteSections, subjectGoalDraft, subjectPath, subjectScopeDraft, subjectTitleDraft, subjectWizardCreating, subjectWizardGoal, subjectWizardInput, subjectWizardLoading, subjectWizardMessages, subjectWizardScope, subjectWizardTitle, subjects, toast, topicChips = [], topicDescriptionDraft, topicKnowledgeNodeRegenerating, topicTitleDraft, updateSubject, useConceptPageActions, useNoteGroupPageActions } = ctx;

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

  const {
    handleCreateSubjectFromWizard,
    handleDeleteSubject,
    handleOpenSubjectWizard,
    handleSaveSubjectMetadata,
    handleSelectSubject,
    handleSubjectUpdated,
    handleSubjectWizardSend,
    openSubjectMetadataModal
  } = useSubjectWorkflowActions(ctx);

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

  const {
    handleReadingModeChange,
    handleReadingNextStudyCard,
    handleReadingPreviousStudyCard,
    handleReadingSourceRangeNext,
    handleReadingSourceRangePrevious,
    handleReadingTitleClick,
    handleReadingToggleMode,
    handleReadingUnpin,
    handleReadingViewInClean,
    handleScrollNavToCard
  } = useReadingWorkflowActions({
    activeSourceRangeIndex,
    readingContentRef,
    readingHoverCardId,
    readingMode,
    readingPinnedCardId,
    studyNoteSections,
    setActiveSourceRangeIndex,
    setReadingHoverCardId,
    setReadingMode,
    setReadingPinnedCardId
  });

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

  return { handleAutoCreateNoteGroup, handleCheckSource, handleConfirmDuplicateSource, handleCreateModuleFromWizard, handleCreateSubjectFromWizard, handleDeleteSubject, handleModuleWizardSend, handleOpenModuleWizard, handleOpenSubjectWizard, handleReadingModeChange, handleReadingNextStudyCard, handleReadingPreviousStudyCard, handleReadingSourceRangeNext, handleReadingSourceRangePrevious, handleReadingTitleClick, handleReadingToggleMode, handleReadingUnpin, handleReadingViewInClean, handleSaveSubjectMetadata, handleScrollNavToCard, handleSelectModule, handleSelectNoteGroup, handleSelectSubject, handleSelectTopic, handleSignIn, handleSignOut, handleStartAutoNoteGroup, handleSubjectUpdated, handleSubjectWizardSend, handleUniqueIdChange, handleUseGeneratedUniqueId, navigateToNoteGroup, navigateToTopic, openSubjectMetadataModal };
}
