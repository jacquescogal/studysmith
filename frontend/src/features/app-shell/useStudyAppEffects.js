import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { getConceptMindMap, getCurrentUser, getModuleQuestionTimeline, getStudyCard, listConcepts } from "@/api";
import { getModuleAdditionalInstructions, normalizeTimeline } from "@/lib/format";
import { modulePath } from "@/lib/routes";
import { shouldClearSelectedSubject } from "@/routes/routeRestore";
import { useConceptRouteResolution } from "@/routes/useConceptRouteResolution";
import { useNoteGroupRouteResolution } from "@/routes/useNoteGroupRouteResolution";
import { useSubjectModuleRouteResolution } from "@/routes/useSubjectModuleRouteResolution";
const showFetchToast = (error, fallback) => {
  toast.error(error?.message || fallback);
};
export function useStudyAppEffects(ctx) {
  const { ConceptScopeContent, NoteGroupScopeContent, activeSourceRangeIndex = 0, auth, buildConceptDirectoryRows, canManageSelectedSubject, canUseProtectedActions, chipFilterIds, currentReviewCard, executeReviewDelete, dragOverNoteGroupId, draggedNoteGroupId, focusQuestionCardId, getConceptMindMap, getCurrentUser, getMasteryScore, getMasteryTier, getModuleAdditionalInstructions, getModuleQuestionTimeline, getNoteGroupStatusMeta, getStudyCard, hasAppRouteTarget, includeDescendantStudyCards = true, isChatOpen, isQuestionPage, isReadingOpen, isReorderingNoteGroups, isReviewOverlayVisible, isReviewing, isSelectedSubjectPermissionHydrating, isStudyPage, isViewCardsPage, listConcepts, location, masteryFilter, mindMapRefreshToken, moduleAdditionalInstructionsDraft, moduleDescriptionDraft, moduleGoalDraft, moduleNoteGroupStats, modulePath, moduleScopeDraft, moduleStatsLoading, moduleTitleDraft, moduleWizardMessages, modules, navigate, nextReviewCard, normalizeNoteGroups, normalizeTimeline, noteGroupMode, noteGroupSearch, noteGroups, progressRange, readingHoverCardId, readingPinnedCardId, requestConfirm, reviewAnswer, reviewCardRefs, reviewCardType, reviewDKeyTimeRef, reviewDeleteLoading, reviewFeedback, reviewIndex, reviewQueue, reviewRefreshToken, reviewStartTime, reviewSummary, routeCreateNoteGroup, routeModuleCode, routeNoteGroupCode, routeNoteGroupId, routePanel, routeSubjectCode, routeSubjectId, routeSubjectPageCode, routeTopicCode, routeTopicId, selectedModuleId, selectedModuleIdRef, selectedNoteGroupId, selectedSubject, selectedSubjectId, selectedSubjectIdRef, selectedTopicId, setAutoAdditionalInstructions, setAutoCreateError, setAutoRawText, setChipFilterIds, setCurrentUserError, setCurrentUserProfile, setDragOverNoteGroupId, setDraggedNoteGroupId, setFocusQuestionCardId, setIsAdminPanelOpen, setIsChatOpen, setIsMetadataOpen, setIsModuleMetadataOpen, setIsQuestionCreateOpen, setIsQuestionFocusOpen, setIsReadingOpen, setIsReorderingNoteGroups, setIsStudyCreateOpen, setIsSubjectManagementOpen, setMetadataError, setMindMapDrilldown, setMindMapRefreshToken, setModuleAdditionalInstructionsDraft, setModuleDescriptionDraft, setModuleDueCounts, setModuleGoalDraft, setModuleMetadataError, setModuleMetadataSaving, setModuleScopeDraft, setModuleTitleDraft, setModules, setNewQuestionRefs, setNewStudyCardChipIds, setNoteGroupMode, setNoteGroupSearch, setNoteGroupSource, setNoteGroups, setReadingHoverCardId, setReadingMode, setReadingPinnedCardId, setResolvedRouteContext, setReviewChatCardCache, setReviewRefreshToken, setReviewSummary, setRouteRestoreError, setSelectedModuleId, setSelectedNoteGroupId, setSelectedSubjectId, setSelectedTopicId, setSidebarError, setSidebarScope, setSourceCheckError, setSourceChecked, setSourceChecking, setSourceConfirmed, setSourceDuplicateCount, setSourceDuplicates, setTopicChips, setTopicSearch, shouldClearSelectedSubject, showFetchToast, sourceConfirmed, subjects, submitReviewAnswer, toast, toggleReviewAnswer, toggleReviewExplanation, topicChips, topicSearch, useCallback, useConceptPageData, useConceptRouteResolution, useEffect, useMemo, useModuleGenerationWorkflow, useModulePageActions, useNoteGroupPageData, useNoteGroupRouteResolution, useStudyScopeData, useSubjectModuleRouteResolution, wizardChatRef } = ctx;
useEffect(() => {
    if (
      !shouldClearSelectedSubject({
        selectedSubjectId,
        subjects,
        hasAppRouteTarget,
        routeSubjectId
      })
    ) {
      return;
    }
    setSelectedSubjectId("");
    setSelectedModuleId("");
    setSelectedNoteGroupId("");
    setSelectedTopicId("");
    setNoteGroupMode("overview");
    navigate("/");
  }, [hasAppRouteTarget, navigate, routeSubjectId, selectedSubjectId, subjects]);
  useEffect(() => {
    if (!canManageSelectedSubject) {
      setIsSubjectManagementOpen(false);
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
  const refreshModuleGeneratedData = useCallback((moduleId) => {
    if (!moduleId || selectedModuleIdRef.current !== moduleId) {
      return;
    }
    listConcepts(moduleId)
      .then((chips) => {
        if (selectedModuleIdRef.current === moduleId) {
          setTopicChips(chips);
        }
      })
      .catch((error) => {
        if (selectedModuleIdRef.current === moduleId) {
          toast.error(error.message || "Failed to refresh generated note group.");
        }
    });
    setReviewRefreshToken((prev) => prev + 1);
    setMindMapRefreshToken((prev) => prev + 1);
  }, []);
  const { moduleGenerationWorkflow, moduleGenerationWorkflowError, moduleGenerationWorkflowConnection, moduleGenerationWorkflowChecked, generationWorkflowsByNoteGroupId, autoJobsByNoteGroupId, autoJobActionId, refreshModuleGenerationWorkflowSnapshot, handleCancelAutoJob, handleRetryAutoJob, handleDeleteAutoJob } = useModuleGenerationWorkflow({
    moduleId: selectedModuleId,
    canManageSelectedSubject,
    isSelectedSubjectPermissionHydrating,
    selectedNoteGroupTitle: selectedNoteGroup?.title,
    requestConfirm,
    onRefreshGeneratedData: refreshModuleGeneratedData,
    onRefreshReview: () => setReviewRefreshToken((prev) => prev + 1),
    onGenerationDeleted: (noteGroupId) => {
      if (noteGroupId) {
        setNoteGroups((prev) => prev.filter((group) => group.id !== noteGroupId));
      }
      if (selectedNoteGroupId === noteGroupId) {
        setSelectedNoteGroupId("");
        navigate(
          selectedSubjectCode && selectedModuleCode
            ? modulePath(selectedSubjectCode, selectedModuleCode)
            : "/"
        );
      }
    }
  });
  const selectedNoteGroupWorkflow = selectedNoteGroupId
    ? generationWorkflowsByNoteGroupId[selectedNoteGroupId] || null
    : null;
  const isSelectedNoteGroupGenerating = Boolean(selectedNoteGroupWorkflow && !selectedTopicId);
  const isWaitingForSelectedNoteGroupWorkflow =
    Boolean(selectedNoteGroupId) &&
    !selectedTopicId &&
    selectedModuleId &&
    (isSelectedSubjectPermissionHydrating ||
      (canManageSelectedSubject && !moduleGenerationWorkflowChecked));
  const shouldHoldSelectedNoteGroupContent =
    isSelectedNoteGroupGenerating || isWaitingForSelectedNoteGroupWorkflow;
  const { studyCards, setStudyCards, studySourceNoteGroups, studyCardError, setStudyCardError, questionCards, setQuestionCards, questionCardError, setQuestionCardError, questionJobStatus, setQuestionJobStatus, noteGroupConceptIds: noteGroupChipIds, setNoteGroupConceptIds: setNoteGroupChipIds, metadataTitleDraft, setMetadataTitleDraft, formattedSections, cleanedTextMarkdown, conceptTitleDraft: topicTitleDraft, setConceptTitleDraft: setTopicTitleDraft, conceptDescriptionDraft: topicDescriptionDraft, setConceptDescriptionDraft: setTopicDescriptionDraft } = useStudyScopeData({
    selectedModuleId,
    selectedNoteGroupId,
    selectedConceptId: selectedTopicId,
    isStudyPage,
    includeDescendantStudyCards,
    routeNoteGroupId,
    routeConceptId: routeTopicId,
    shouldHoldContent: shouldHoldSelectedNoteGroupContent,
    selectedModuleIdRef,
    selectedSubjectIdRef,
    setSelectedSubjectId,
    setSelectedModuleId,
    setRouteRestoreError
  });
  const { noteGroupMindMap, setNoteGroupMindMap, noteGroupMindMapLoading, setNoteGroupMindMapLoading, noteGroupMindMapError, setNoteGroupMindMapError, noteGroupMindMapGenerating, setNoteGroupMindMapGenerating, questionTimeline: noteGroupQuestionTimeline, noteGroupProgress, noteGroupProgressLoading, noteGroupProgressError, noteGroupCardTable, setNoteGroupCardTable, noteGroupCardTableLoading, noteGroupCardTableError } = useNoteGroupPageData({
    noteGroupId: selectedNoteGroupId,
    selectedConceptId: selectedTopicId,
    chipFilterIds,
    questionCards,
    progressRange,
    reviewRefreshToken,
    mindMapRefreshToken,
    isViewCardsPage,
    shouldHoldContent: shouldHoldSelectedNoteGroupContent
  });
  const { conceptMindMap: topicMindMap, conceptMindMapLoading: topicMindMapLoading, conceptMindMapError: topicMindMapError, questionTimeline: conceptQuestionTimeline } = useConceptPageData({
    conceptId: selectedTopicId,
    questionCards,
    includeDescendantStudyCards,
    reviewRefreshToken,
    mindMapRefreshToken,
    shouldHoldContent: shouldHoldSelectedNoteGroupContent
  });
  const questionTimeline = selectedTopicId ? conceptQuestionTimeline : noteGroupQuestionTimeline;
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
    if (shouldHoldSelectedNoteGroupContent) {
      return [{ id: "note-group-generation-workflow", label: "Generation" }];
    }
    if (!selectedNoteGroupId && !selectedTopicId) {
      return isViewCardsPage ? [] : [{ id: "module-mind-map", label: "Mind Map" }];
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
      return [{ id: "topic-mind-map", label: "Mind Map" }];
    }
    return [{ id: "note-group-mind-map", label: "Mind Map" }];
  }, [
    noteGroupMode,
    selectedModuleId,
    selectedNoteGroupId,
    selectedTopicId,
    isViewCardsPage,
    isStudyPage,
    isQuestionPage,
    isTopicScope,
    shouldHoldSelectedNoteGroupContent
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
        shortCode: topic.short_code,
        parentConceptId:
          topic.parentConceptId ||
          topic.parent_concept_id ||
          topic.parentTopicId ||
          topic.parent_topic_id ||
          "",
        parentTopicId:
          topic.parentTopicId ||
          topic.parent_topic_id ||
          topic.parentConceptId ||
          topic.parent_concept_id ||
          ""
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
  const sidebarTopicOptions = useMemo(() => {
    if (topicSearch.trim()) {
      return filteredTopicOptions;
    }
    return buildConceptDirectoryRows(topicOptions, selectedTopicId);
  }, [filteredTopicOptions, selectedTopicId, topicOptions, topicSearch]);
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
  const scopedSourceContent = useMemo(() => {
    let text = "";
    const sections = [];
    const rangesByCardId = new Map();

    studySourceNoteGroups.forEach((group, groupIndex) => {
      const groupText = group.cleaned_text_markdown || "";
      if (text && groupText) {
        text += "\n\n";
      }
      const groupTextOffset = text.length;
      text += groupText;

      const noteGroupTitle = group.title || `Note Group ${groupIndex + 1}`;
      const formattedSourceSections = Array.isArray(group.formatted_sections)
        ? group.formatted_sections
        : [];
      const sourceCards = Array.isArray(group.study_cards) ? group.study_cards : [];
      const sourceCardIds = new Set(sourceCards.map((card) => card.id));
      const scopedFormattedSections = sourceCardIds.size
        ? formattedSourceSections.filter((section) => sourceCardIds.has(section.study_card_id))
        : formattedSourceSections;

      if (scopedFormattedSections.length) {
        scopedFormattedSections.forEach((section, sectionIndex) => {
          sections.push({
            ...section,
            source_note_group_id: group.id,
            source_note_group_title: noteGroupTitle,
            anchor:
              section.anchor ||
              `source-${group.id}-${section.study_card_id || sectionIndex + 1}`
          });
        });
      } else {
        sourceCards.forEach((card, cardIndex) => {
          sections.push({
            study_card_id: card.id,
            title: card.front || card.title || `Study card ${cardIndex + 1}`,
            content: card.back || card.content || "",
            anchor: `source-${group.id}-${card.id}`,
            source_note_group_id: group.id,
            source_note_group_title: noteGroupTitle
          });
        });
      }

      sourceCards.forEach((card) => {
        const sourceRanges = Array.isArray(card.source_ranges) ? card.source_ranges : [];
        rangesByCardId.set(
          card.id,
          sourceRanges.map((range) => ({
            ...range,
            start_index: range.start_index + groupTextOffset,
            end_index: range.end_index + groupTextOffset
          }))
        );
      });
    });

    return { text, sections, rangesByCardId };
  }, [studySourceNoteGroups]);
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
  const shouldUseScopedSourceContent =
    isStudyPage && (Boolean(selectedTopicId) || Boolean(selectedModuleId && !selectedNoteGroupId));
  const effectiveCleanedText = shouldUseScopedSourceContent
    ? scopedSourceContent.text
    : cleanedTextMarkdown || fallbackCleanText.text;
  const studyNoteSections = useMemo(() => {
    if (shouldUseScopedSourceContent) {
      return scopedSourceContent.sections;
    }
    if (formattedSections.length) {
      return formattedSections;
    }
    return studyCards.map((card, index) => ({
      study_card_id: card.id,
      title: card.title || `Study card ${index + 1}`,
      content: card.content || "",
      anchor: `study-card-${card.id}`,
    }));
  }, [formattedSections, scopedSourceContent.sections, shouldUseScopedSourceContent, studyCards]);
  const sourceRangesByCardId = useMemo(() => {
    if (shouldUseScopedSourceContent) {
      return scopedSourceContent.rangesByCardId;
    }
    if (!cleanedTextMarkdown) {
      return fallbackCleanText.rangesByCardId;
    }
    const map = new Map();
    studyCards.forEach((card) => {
      map.set(card.id, Array.isArray(card.source_ranges) ? card.source_ranges : []);
    });
    return map;
  }, [
    cleanedTextMarkdown,
    fallbackCleanText,
    scopedSourceContent.rangesByCardId,
    shouldUseScopedSourceContent,
    studyCards
  ]);
  const getValidSourceRanges = useCallback((studyCardId) => {
    const ranges = sourceRangesByCardId.get(studyCardId) || [];
    return ranges.filter((range) => Number.isInteger(range.start_index) && Number.isInteger(range.end_index) && range.end_index > range.start_index);
  }, [sourceRangesByCardId]);
  const pinnedSourceRanges = useMemo(() => getValidSourceRanges(readingPinnedCardId), [getValidSourceRanges, readingPinnedCardId]);
  const pinnedStudyCard = useMemo(() => studyCards.find((card) => card.id === readingPinnedCardId) || null, [readingPinnedCardId, studyCards]);
  const readingHighlights = useMemo(() => {
    const highlights = [];
    const addRanges = (studyCardId, kind, activeIndex = -1) => {
      if (!studyCardId) {
        return;
      }
      const ranges = getValidSourceRanges(studyCardId);
      ranges.forEach((range, index) => {
        highlights.push({ ...range, study_card_id: studyCardId, kind: activeIndex === index ? "active" : kind, range_index: index });
      });
    };
    addRanges(readingHoverCardId, "hovered");
    addRanges(readingPinnedCardId, "related", activeSourceRangeIndex);
    return highlights;
  }, [activeSourceRangeIndex, getValidSourceRanges, readingHoverCardId, readingPinnedCardId]);
  const resolveNoteGroupLabel = useCallback((noteGroupId) => {
    if (!noteGroupId) {
      return "";
    }
    const statsEntry = moduleNoteGroupStatsById.get(noteGroupId);
    if (statsEntry) {
      return statsEntry.title;
    }
    const group = noteGroups.find((item) => item.id === noteGroupId);
    return group?.title || noteGroupId.slice(0, 8);
  }, [moduleNoteGroupStatsById, noteGroups]);
  const studyNoteGroups = useMemo(() => {
    const sourceGroupsById = new Map(
      (studySourceNoteGroups || []).map((group) => [group.id, group])
    );
    const orderIndexByNoteGroupId = new Map(
      moduleNoteGroupsForDisplay.map((group, index) => [group.id, index])
    );
    const cardsByGroup = new Map();

    filteredStudyCards.forEach((card) => {
      const groupId = card.note_group_id || selectedNoteGroupId || "";
      if (!groupId) {
        return;
      }
      if (!cardsByGroup.has(groupId)) {
        cardsByGroup.set(groupId, []);
      }
      if (!cardsByGroup.get(groupId).some((item) => item.id === card.id)) {
        cardsByGroup.get(groupId).push(card);
      }
    });

    return Array.from(cardsByGroup.entries())
      .map(([groupId, cards]) => {
        const sourceGroup = sourceGroupsById.get(groupId);
        return {
          id: groupId,
          title: sourceGroup?.title || resolveNoteGroupLabel(groupId) || "Untitled Note Group",
          orderIndex: orderIndexByNoteGroupId.get(groupId) ?? Number.POSITIVE_INFINITY,
          studyCards: cards
        };
      })
      .sort((a, b) => a.orderIndex - b.orderIndex || a.title.localeCompare(b.title));
  }, [
    filteredStudyCards,
    moduleNoteGroupsForDisplay,
    resolveNoteGroupLabel,
    selectedNoteGroupId,
    studySourceNoteGroups
  ]);
  const readingAvailable =
    studyNoteSections.length > 0 ||
    studyNoteGroups.some((group) => group.studyCards?.length) ||
    Boolean(effectiveCleanedText);
  const getSectionAnchor = (section, index) =>
    section.anchor ||
    `section-${index + 1}-${(section.study_card_id || "note").slice(0, 8)}`;
  const reviewRefsMessage = reviewCardRefs.length
    ? "The relevant study cards are:"
    : "The relevant study cards are: no study card is linked to this question.";
  const isSourceReady = sourceConfirmed;
  const modulePageActions = useModulePageActions({
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
  });
  const {
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
    openModuleMetadataModal
  } = modulePageActions;
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
  const StudyScopeRouteContent = isTopicScope ? ConceptScopeContent : NoteGroupScopeContent;
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
    setResolvedRouteContext(null);
  }, [routeSubjectCode, routeModuleCode, routeNoteGroupCode, routeTopicCode, routeCreateNoteGroup]);
  const handleRouteRestoreError = useCallback((error, fallback) => {
    showFetchToast(error, fallback);
  }, []);
  useSubjectModuleRouteResolution({
    auth,
    locationState: location.state,
    routeSubjectPageCode,
    routeSubjectCode,
    routeModuleCode,
    routeNoteGroupCode,
    routeTopicCode,
    routeCreateNoteGroup,
    setResolvedRouteContext,
    setSelectedSubjectId,
    setSelectedModuleId,
    setSelectedNoteGroupId,
    setSelectedTopicId,
    setSidebarScope,
    setNoteGroupMode,
    setReviewSummary,
    setIsChatOpen,
    setIsMetadataOpen,
    setIsModuleMetadataOpen,
    setRouteRestoreError,
    onError: handleRouteRestoreError
  });
  useNoteGroupRouteResolution({
    auth,
    routeSubjectCode,
    routeModuleCode,
    routeNoteGroupCode,
    setResolvedRouteContext,
    setSelectedSubjectId,
    setSelectedModuleId,
    setSelectedNoteGroupId,
    setNoteGroupMode,
    setRouteRestoreError
  });
  useConceptRouteResolution({
    auth,
    routeSubjectCode,
    routeModuleCode,
    routeConceptCode: routeTopicCode,
    setResolvedRouteContext,
    setSelectedSubjectId,
    setSelectedModuleId,
    setSelectedNoteGroupId,
    setSelectedConceptId: setSelectedTopicId,
    setSidebarScope,
    setChipFilterIds,
    setNoteGroupMode,
    setReviewSummary,
    setIsChatOpen,
    setIsMetadataOpen,
    setIsModuleMetadataOpen,
    setRouteRestoreError,
    onError: handleRouteRestoreError
  });
  useEffect(() => {
    if (!selectedSubjectId) {
      setSelectedModuleId("");
    }
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
    listConcepts(selectedModuleId)
      .then((data) => {
        setTopicChips(data);
        if (!routeTopicId) {
          setSelectedTopicId((currentId) =>
            currentId && !data.some((topic) => topic.id === currentId) ? "" : currentId
          );
        }
      })
      .catch((error) => showFetchToast(error, "Failed to load concepts"));
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
      setSidebarScope("concepts");
      setChipFilterIds([]);
    }
  }, [routeTopicId, selectedModuleId, selectedTopicId, topicChips]);
  useEffect(() => {
    if (!isReadingOpen) {
      setReadingHoverCardId("");
      setReadingPinnedCardId("");
      setReadingMode("study");
    }
  }, [isReadingOpen]);
  useEffect(() => {
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
    if (wizardChatRef.current) {
      wizardChatRef.current.scrollTop = wizardChatRef.current.scrollHeight;
    }
  }, [moduleWizardMessages]);
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
    if (routePanel) {
      setIsChatOpen(false);
      setIsMetadataOpen(false);
    }
  }, [routePanel]);
  const clearMindMapDrilldown = useCallback(() => {
    setMindMapDrilldown({
      sourceKey: "",
      topicId: "",
      title: "",
      graph: null,
      loading: false,
      error: ""
    });
  }, []);
  const handleOpenMindMapTopic = useCallback(async ({ topicId, title } = {}, sourceKey = "") => {
    if (!topicId || !sourceKey) {
      return;
    }
    const topicTitle = title || "Concept";
    setMindMapDrilldown({
      sourceKey,
      topicId,
      title: topicTitle,
      graph: null,
      loading: true,
      error: ""
    });
    try {
      const graph = await getConceptMindMap(topicId);
      setMindMapDrilldown((current) =>
        current.sourceKey === sourceKey && current.topicId === topicId
          ? {
              ...current,
              graph,
              loading: false,
              error: ""
            }
          : current
      );
    } catch (error) {
      setMindMapDrilldown((current) =>
        current.sourceKey === sourceKey && current.topicId === topicId
          ? {
              ...current,
              graph: null,
              loading: false,
              error: error.message || "Failed to load Concept Mind Map"
            }
          : current
      );
    }
  }, []);
  useEffect(() => {
    clearMindMapDrilldown();
  }, [clearMindMapDrilldown, selectedModuleId, selectedNoteGroupId, selectedTopicId, noteGroupMode]);
  useEffect(() => {
    setAutoRawText("");
    setAutoCreateError("");
    setSidebarError("");
    setNoteGroupSearch("");
    setTopicSearch("");
    setAutoAdditionalInstructions(getModuleAdditionalInstructions(selectedModule));
  }, [selectedModuleId]);
  return { autoJobActionId, autoJobsByNoteGroupId, canEditCurrentCards, canReorderNoteGroups, chipFilterValue, chipOptions, clearMindMapDrilldown, effectiveCleanedText, filteredNoteGroupOptions, filteredStudyCards, focusCardType, focusMasteryScore, focusMasteryTier, focusQuestionCard, formatDueAt, formatReviewAt, generationWorkflowsByNoteGroupId, getSectionAnchor, handleCancelAutoJob, handleChipFilterSelect, handleDeleteAutoJob, handleDeleteModule, handleNoteGroupDragEnd, handleNoteGroupDragEnter, handleNoteGroupDragOver, handleNoteGroupDragStart, handleNoteGroupDrop, handleOpenMindMapTopic, handleResetChipFilters, handleRetryAutoJob, handleSaveModuleMetadata, isSourceReady, metadataTitleDraft, moduleGenerationWorkflow, moduleGenerationWorkflowConnection, moduleGenerationWorkflowError, moduleNoteGroupStatsById, moduleNoteGroupsForDisplay, noteGroupCardTable, noteGroupCardTableError, noteGroupCardTableLoading, noteGroupChipIds, noteGroupMindMap, noteGroupMindMapError, noteGroupMindMapGenerating, noteGroupMindMapLoading, noteGroupProgress, noteGroupProgressError, noteGroupProgressLoading, noteGroupStats, noteGroupStatusMeta, openModuleMetadataModal, pinnedSourceRanges, pinnedStudyCard, questionCardError, questionCards, questionCardsForDisplay, questionJobStatus, questionTimeline, readingAvailable, readingHighlights, refreshModuleGeneratedData, refreshModuleGenerationWorkflowSnapshot, resolveNoteGroupLabel, reviewRefsMessage, sectionNavItems, selectedModule, selectedModuleCode, selectedNoteGroup, selectedNoteGroupCode, selectedNoteGroupWorkflow, selectedSubjectCode, selectedTopic, selectedTopicCode, setMetadataTitleDraft, setNoteGroupCardTable, setNoteGroupChipIds, setNoteGroupMindMap, setNoteGroupMindMapError, setNoteGroupMindMapGenerating, setQuestionCardError, setQuestionCards, setQuestionJobStatus, setStudyCardError, setStudyCards, setTopicDescriptionDraft, setTopicTitleDraft, shouldHoldSelectedNoteGroupContent, sidebarTopicOptions, sourceRangesByCardId, studyCardError, studyCardTitleById, studyCards, studyNoteGroups, studyNoteSections, studySourceNoteGroups, topicCardTableRows, topicDescriptionDraft, topicMindMap, topicMindMapError, topicMindMapLoading, topicTitleDraft, topicUnlinkedQuestionCount };
}
