import { useConceptPageActions } from "@/features/concepts/useConceptPageActions";
import { useNoteGroupPageActions } from "@/features/note-groups/useNoteGroupPageActions";

export function useStudyAppPageActions(ctx) {
  const {
    canManageSelectedSubject,
    canUseProtectedActions,
    editingQuestionCard,
    editingStudyCard,
    metadataTitleDraft,
    navigate,
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
    pollJob,
    regenerateNoteGroupNeedsReviewKnowledgeNodes,
    requestConfirm,
    selectedModuleCode,
    selectedModuleId,
    selectedNoteGroup,
    selectedNoteGroupId,
    selectedNoteGroupIdRef,
    selectedSubjectCode,
    selectedTopic,
    selectedTopicId,
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
    setSelectedTopicId,
    setSidebarError,
    setSidebarScope,
    setStudyCardError,
    setStudyCards,
    setTopicChips,
    setTopicDescriptionDraft,
    setTopicError,
    setTopicKnowledgeNodeRegenerating,
    setTopicKnowledgeNodeRegeneratingId,
    setTopicSaving,
    setTopicTitleDraft,
    studyCards,
    topicDescriptionDraft,
    topicKnowledgeNodeRegenerating,
    topicTitleDraft
  } = ctx;

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

  return {
    handleDeleteTopic: conceptPageActions.handleDeleteConcept,
    handleRegenerateTopicKnowledgeNodes:
      conceptPageActions.handleRegenerateConceptKnowledgeNodes,
    handleSaveTopic: conceptPageActions.handleSaveConcept,
    ...noteGroupPageActions
  };
}
