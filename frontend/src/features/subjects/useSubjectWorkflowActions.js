export function useSubjectWorkflowActions(ctx) {
  const {
    canCreateSubjects,
    canDeleteSubject,
    canMaintainSubject,
    canUseProtectedActions,
    createSubject,
    deleteSubject,
    navigate,
    newSubjectDescription,
    newSubjectTitle,
    requestConfirm,
    selectedSubject,
    selectedSubjectId,
    sendSubjectIntentChat,
    setIsChatOpen,
    setIsMetadataOpen,
    setIsModuleMetadataOpen,
    setIsSubjectManagementOpen,
    setIsSubjectMetadataOpen,
    setIsSubjectWizardOpen,
    setNewSubjectDescription,
    setNewSubjectTitle,
    setNoteGroupMode,
    setNoteGroupSearch,
    setReviewSummary,
    setSelectedModuleId,
    setSelectedNoteGroupId,
    setSelectedSubjectId,
    setSelectedTopicId,
    setSidebarError,
    setSidebarScope,
    setSubjectGoalDraft,
    setSubjectMetadataError,
    setSubjectMetadataSaving,
    setSubjectScopeDraft,
    setSubjectTitleDraft,
    setSubjectWizardCreating,
    setSubjectWizardError,
    setSubjectWizardGoal,
    setSubjectWizardInput,
    setSubjectWizardLoading,
    setSubjectWizardMessages,
    setSubjectWizardScope,
    setSubjectWizardTitle,
    setSubjects,
    dashboardPath,
    subjectGoalDraft,
    subjectPath,
    subjectScopeDraft,
    subjectTitleDraft,
    subjectWizardCreating,
    subjectWizardGoal,
    subjectWizardInput,
    subjectWizardLoading,
    subjectWizardMessages,
    subjectWizardScope,
    subjectWizardTitle,
    subjects,
    updateSubject
  } = ctx;

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
    navigate(subject?.short_code ? subjectPath(subject.short_code) : dashboardPath);
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
      navigate(subject.short_code ? subjectPath(subject.short_code) : dashboardPath);
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
        current_scope: subjectWizardScope || null
      });
      setSubjectWizardMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.assistant_message }
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
        scope: subjectWizardScope.trim() || null
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
      navigate(created.short_code ? subjectPath(created.short_code) : dashboardPath);
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
    ctx.setEditingSubjectId(subject.id);
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
        scope: subjectScopeDraft.trim() || null
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
        navigate(dashboardPath);
      }
    } catch (error) {
      setSidebarError(error.message || "Failed to delete subject");
    }
  };

  return {
    handleCreateSubject,
    handleCreateSubjectFromWizard,
    handleDeleteSubject,
    handleOpenSubjectWizard,
    handleSaveSubjectMetadata,
    handleSelectSubject,
    handleSubjectUpdated,
    handleSubjectWizardSend,
    openSubjectMetadataModal
  };
}
