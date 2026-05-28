import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Search, X } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageMindMapCard } from "@/features/mind-map/PageMindMapCard";
import { MindMapPanel } from "@/features/mind-map/MindMapPanel";
import { NoteGroupGenerationWorkflow } from "@/features/note-groups/NoteGroupGenerationWorkflow";
import { NoteGroupViewCards } from "@/features/note-groups/NoteGroupViewCards";
import { QuestionCardList } from "@/features/question-cards/QuestionCardList";
import { StudyCardList } from "@/features/study-cards/StudyCardList";
import { renderCleanedMarkdown, renderMarkdownBlocks } from "@/lib/text-rendering";

const getValidSourceRanges = (sourceRangesByCardId, studyCardId) => {
  const ranges = sourceRangesByCardId?.get?.(studyCardId) || [];
  return ranges.filter(
    (range) =>
      Number.isInteger(range.start_index) &&
      Number.isInteger(range.end_index) &&
      range.end_index > range.start_index
  );
};

const getSourceGroupRangesByCardId = (sourceGroup) => {
  const map = new Map();
  (sourceGroup?.study_cards || []).forEach((card) => {
    map.set(card.id, Array.isArray(card.source_ranges) ? card.source_ranges : []);
  });
  return map;
};

const normalizePinnedStudyCard = (card, noteGroupId = "") =>
  card
    ? {
        ...card,
        title: card.title || card.front || "Untitled Study Card",
        content: card.content || card.back || "",
        note_group_id: card.note_group_id || noteGroupId
      }
    : null;

export const resolvePinnedStudyCardForModal = ({
  pinnedStudyCard,
  readingPinnedCardId = "",
  studyNoteGroups = [],
  studySourceNoteGroups = []
} = {}) => {
  if (!readingPinnedCardId) {
    return null;
  }
  if (pinnedStudyCard) {
    return normalizePinnedStudyCard(pinnedStudyCard);
  }
  for (const group of studyNoteGroups || []) {
    const card = (group.studyCards || []).find((item) => item.id === readingPinnedCardId);
    if (card) {
      return normalizePinnedStudyCard(card, group.id);
    }
  }
  for (const group of studySourceNoteGroups || []) {
    const card = (group.study_cards || []).find((item) => item.id === readingPinnedCardId);
    if (card) {
      return normalizePinnedStudyCard(card, group.id);
    }
  }
  return null;
};

export const resolveSourceTextModalPayload = ({
  activeSourceGroup,
  activeSourceRangeIndex = 0,
  effectiveCleanedText = "",
  hasScopedSourceGroups = false,
  pinnedSourceRanges = [],
  readingAvailable = false,
  readingHighlights = [],
  readingPinnedCardId = "",
  sourceRangesByCardId
}) => {
  const activeSourceRangesByCardId = getSourceGroupRangesByCardId(activeSourceGroup);
  const getModalValidSourceRanges = (studyCardId) => {
    if (!hasScopedSourceGroups) {
      return getValidSourceRanges(sourceRangesByCardId, studyCardId);
    }
    const scopedRanges = getValidSourceRanges(activeSourceRangesByCardId, studyCardId);
    if (scopedRanges.length) {
      return scopedRanges;
    }
    return getValidSourceRanges(sourceRangesByCardId, studyCardId);
  };
  const modalEffectiveCleanedText = hasScopedSourceGroups
    ? activeSourceGroup?.cleaned_text_markdown || ""
    : effectiveCleanedText;
  const modalPinnedSourceRanges = hasScopedSourceGroups
    ? getModalValidSourceRanges(readingPinnedCardId)
    : pinnedSourceRanges;
  const modalReadingHighlights = hasScopedSourceGroups
    ? readingPinnedCardId
      ? getModalValidSourceRanges(readingPinnedCardId).map((range, index) => ({
          ...range,
          study_card_id: readingPinnedCardId,
          kind: activeSourceRangeIndex === index ? "active" : "related",
          range_index: index
        }))
      : []
    : readingHighlights;

  return {
    modalEffectiveCleanedText,
    modalPinnedSourceRanges,
    modalReadingAvailable: readingAvailable || Boolean(modalEffectiveCleanedText),
    modalReadingHighlights
  };
};

function QuestionTimelinePanel({ panelClass, mutedTextClass, questionTimeline }) {
  return (
    <section className={panelClass} id="question-timeline">
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
      <p className={mutedTextClass}>
        Due includes anything scheduled within the next 6 hours.
      </p>
    </section>
  );
}

export function SourceTextContainer({
  activeSourceRangeIndex = 0,
  activeSourceNoteGroupId = "",
  classes,
  effectiveCleanedText,
  hasNextSourceRange,
  hasNextStudyCard,
  hasPreviousSourceRange,
  hasPreviousStudyCard,
  nextStudyCardCrossesNoteGroup,
  noteGroupOptions = [],
  onBackToStudyCards,
  onSourceNoteGroupChange,
  previousStudyCardCrossesNoteGroup,
  handleReadingNextStudyCard,
  handleReadingPreviousStudyCard,
  handleReadingSourceRangeNext,
  handleReadingSourceRangePrevious,
  handleReadingUnpin,
  pinnedSourceRanges = [],
  pinnedStudyCard,
  pinnedStudyCardPositionLabel,
  readingAvailable,
  readingContentRef,
  readingHighlights = [],
  readingPinnedCardId = "",
  sourceRangePositionLabel
}) {
  if (!readingAvailable) {
    return <p className={classes.mutedText}>Study content is unavailable for this Note Group.</p>;
  }

  return (
    <div className="reading-content source-text-modal-content inline-study-scroll" ref={readingContentRef}>
      {noteGroupOptions?.length ? (
        <label className="source-note-group-picker">
          <span>Note Group</span>
          <select
            aria-label="Select source Note Group"
            value={activeSourceNoteGroupId}
            onChange={(event) => onSourceNoteGroupChange?.(event.target.value)}
            disabled={Boolean(readingPinnedCardId)}
          >
            {noteGroupOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className={`clean-source${readingPinnedCardId ? " has-pin" : ""}`}>
        {renderCleanedMarkdown(effectiveCleanedText || "", readingHighlights)}
      </div>
      {readingPinnedCardId && pinnedStudyCard ? (
        <div className="source-lookup-floating" aria-label="Pinned Study Card source controls">
          <div className="source-lookup-nav">
            <span>
              {pinnedStudyCardPositionLabel}
              {sourceRangePositionLabel ? (
                <small className="source-range-count">{sourceRangePositionLabel}</small>
              ) : null}
            </span>
            <button
              type="button"
              aria-label="Pin previous Study Card"
              className={previousStudyCardCrossesNoteGroup ? "source-lookup-boundary" : ""}
              disabled={!hasPreviousStudyCard}
              onClick={handleReadingPreviousStudyCard}
            >
              <ArrowLeft size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Pin next Study Card"
              className={nextStudyCardCrossesNoteGroup ? "source-lookup-boundary" : ""}
              disabled={!hasNextStudyCard}
              onClick={handleReadingNextStudyCard}
            >
              <ArrowRight size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Previous source range"
              disabled={!hasPreviousSourceRange}
              onClick={() => handleReadingSourceRangePrevious?.(pinnedSourceRanges.length)}
            >
              <ArrowUp size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next source range"
              disabled={!hasNextSourceRange}
              onClick={() => handleReadingSourceRangeNext?.(pinnedSourceRanges.length)}
            >
              <ArrowDown size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Unpin Study Card"
              onClick={handleReadingUnpin}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          <button
            className="source-lookup-back"
            type="button"
            onClick={onBackToStudyCards}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Back to Derived Study Cards
          </button>
          <div className="pinned-study-card-preview">
            <p className="label">Pinned Study Card</p>
            <div
              className="source-lookup-study-card-scroll"
              tabIndex={0}
              aria-label="Pinned Study Card title and content"
            >
              <h3>{pinnedStudyCard.title || "Untitled Study Card"}</h3>
              <div className="source-lookup-study-card-body">
                {pinnedStudyCard.content || "No Study Card content."}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StudyScopeContent({
  shouldHoldContent,
  selectedNoteGroupWorkflow,
  moduleGenerationWorkflowConnection,
  moduleGenerationWorkflowError,
  autoJobActionId,
  canManageSelectedSubject,
  handleCancelAutoJob,
  handleRetryAutoJob,
  handleDeleteAutoJob,
  isViewCardsPage,
  isMindMapPage,
  isInlineStudyPage,
  isStudyPage,
  isQuestionPage,
  isConceptScope,
  selectedConcept,
  selectedConceptId,
  selectedConceptCode,
  selectedNoteGroup,
  selectedNoteGroupId,
  selectedNoteGroupCode,
  selectedSubjectCode,
  selectedModuleCode,
  conceptMindMap,
  conceptMindMapLoading,
  conceptMindMapError,
  noteGroupMindMap,
  noteGroupMindMapLoading,
  noteGroupMindMapError,
  noteGroupMindMapGenerating,
  conceptKnowledgeNodeRegenerating,
  conceptKnowledgeNodeRegeneratingId,
  noteGroupNeedsReviewRegenerating,
  mindMapDrilldown,
  noteGroupStats,
  noteGroupStatusMeta,
  noteGroupProgress,
  noteGroupProgressLoading,
  noteGroupProgressError,
  progressRange,
  noteGroupCardTable,
  noteGroupCardTableLoading,
  noteGroupCardTableError,
  conceptCardTableRows,
  conceptUnlinkedQuestionCount,
  studyCards,
  filteredStudyCards,
  questionCards,
  questionCardsForDisplay,
  questionTimeline,
  concepts,
  conceptOptions,
  conceptFilterValue,
  conceptFilterIds,
  noteGroupConceptIds,
  selectedModuleId,
  canUseProtectedActions,
  canEditCurrentCards,
  isReviewing,
  isReviewOverlayVisible,
  readingAvailable,
  readingMode,
  activeSourceRangeIndex = 0,
  effectiveCleanedText,
  readingContentRef,
  readingHighlights = [],
  readingPinnedCardId = "",
  includeDescendantStudyCards = true,
  sourceRangesByCardId,
  pinnedSourceRanges = [],
  pinnedStudyCard,
  studyNoteSections = [],
  studyNoteGroups = [],
  studySourceNoteGroups = [],
  visibleStudyCardOrder = [],
  conceptTitleDraft,
  conceptDescriptionDraft,
  conceptError,
  conceptSaving,
  studyCardError,
  questionCardError,
  reviewError,
  questionJobStatus,
  isGeneratingQuestions,
  masteryFilter,
  reviewCount,
  editingStudyCardId,
  editingStudyCard,
  editingQuestionCardId,
  editingQuestionCard,
  classes,
  selectStyles,
  navigate,
  setIsChatOpen,
  setIsReadingOpen,
  setProgressRange,
  setReadingMode,
  setConceptTitleDraft,
  setConceptDescriptionDraft,
  setEditingStudyCard,
  setEditingStudyCardId,
  setEditingQuestionCard,
  setEditingQuestionCardId,
  setMasteryFilter,
  setReviewCount,
  handleBackToOverview,
  handleRegenerateConceptKnowledgeNodes,
  handleGenerateNoteGroupMindMap,
  handleRegenerateNeedsReviewKnowledgeNodes,
  handleOpenMindMapConcept,
  clearMindMapDrilldown,
  navigateToConcept,
  handleConceptFilterSelect,
  handleResetConceptFilters,
  startReview,
  openMetadataModal,
  handleDeleteNoteGroup,
  handleSaveConcept,
  handleDeleteConcept,
  openStudyCreateModal,
  handleEditStudyCard,
  handleSaveStudyCard,
  handleDeleteStudyCard,
  openQuestionCreateModal,
  handleEditQuestionCard,
  handleSaveQuestionCard,
  handleDeleteQuestionCard,
  openQuestionFocus,
  handleGenerateQuestions,
  handleReadingModeChange,
  handleReadingNextStudyCard,
  handleReadingPreviousStudyCard,
  handleReadingSourceRangeNext,
  handleReadingSourceRangePrevious,
  handleReadingUnpin,
  handleReadingViewInClean
}) {
  const [sourceTextOpen, setSourceTextOpen] = useState(readingMode === "clean");
  const [activeSourceNoteGroupId, setActiveSourceNoteGroupId] = useState("");
  const sourceGroupsById = useMemo(
    () => new Map((studySourceNoteGroups || []).map((group) => [group.id, group])),
    [studySourceNoteGroups]
  );
  const sourceNoteGroupOptions = useMemo(
    () =>
      (studySourceNoteGroups || []).map((group, index) => ({
        value: group.id,
        label: group.title || `Note Group ${index + 1}`
      })),
    [studySourceNoteGroups]
  );
  const pinnedStudyCardForModal = useMemo(
    () =>
      resolvePinnedStudyCardForModal({
        pinnedStudyCard,
        readingPinnedCardId,
        studyNoteGroups,
        studySourceNoteGroups
      }),
    [pinnedStudyCard, readingPinnedCardId, studyNoteGroups, studySourceNoteGroups]
  );
  const pinnedSourceNoteGroupId = useMemo(() => {
    if (!readingPinnedCardId) {
      return "";
    }
    if (pinnedStudyCardForModal?.note_group_id) {
      return pinnedStudyCardForModal.note_group_id;
    }
    const sourceGroup = (studySourceNoteGroups || []).find((group) =>
      (group.study_cards || []).some((card) => card.id === readingPinnedCardId)
    );
    return sourceGroup?.id || "";
  }, [pinnedStudyCardForModal, readingPinnedCardId, studySourceNoteGroups]);
  const activeSourceSelectionId =
    activeSourceNoteGroupId && sourceGroupsById.has(activeSourceNoteGroupId)
      ? activeSourceNoteGroupId
      : "";
  const resolvedSourceNoteGroupId =
    pinnedSourceNoteGroupId ||
    activeSourceSelectionId ||
    studySourceNoteGroups[0]?.id ||
    selectedNoteGroupId ||
    "";
  const activeSourceGroup = sourceGroupsById.get(resolvedSourceNoteGroupId);
  const hasScopedSourceGroups = studySourceNoteGroups.length > 0;
  const {
    modalEffectiveCleanedText,
    modalPinnedSourceRanges,
    modalReadingAvailable,
    modalReadingHighlights
  } = useMemo(() => resolveSourceTextModalPayload({
    activeSourceGroup,
    activeSourceRangeIndex,
    effectiveCleanedText,
    hasScopedSourceGroups,
    pinnedSourceRanges,
    readingAvailable,
    readingHighlights,
    readingPinnedCardId,
    sourceRangesByCardId
  }), [
    activeSourceGroup,
    activeSourceRangeIndex,
    effectiveCleanedText,
    hasScopedSourceGroups,
    pinnedSourceRanges,
    readingAvailable,
    readingHighlights,
    readingPinnedCardId,
    sourceRangesByCardId
  ]);

  if (shouldHoldContent) {
    return (
      <NoteGroupGenerationWorkflow
        workflow={selectedNoteGroupWorkflow}
        connection={moduleGenerationWorkflowConnection}
        error={moduleGenerationWorkflowError}
        actionId={autoJobActionId}
        canManage={canManageSelectedSubject}
        onCancel={handleCancelAutoJob}
        onRetry={handleRetryAutoJob}
        onDelete={handleDeleteAutoJob}
      />
    );
  }

  const isDefaultNonExplicitRoute = !isViewCardsPage && !isInlineStudyPage && !isStudyPage && !isQuestionPage;
  const scopeLabel = isConceptScope
    ? "Concept"
    : selectedModuleId && !selectedNoteGroupId
      ? "Module"
      : "Note Group";
  const groupedStudyNoteGroups = studyNoteGroups.filter((group) => group.studyCards?.length);
  const shouldRenderGroupedStudyCards = groupedStudyNoteGroups.length > 0;
  const effectiveVisibleStudyCardOrder = visibleStudyCardOrder.length
    ? visibleStudyCardOrder
    : shouldRenderGroupedStudyCards
      ? groupedStudyNoteGroups.flatMap((group) =>
          group.studyCards
            .map((card) => ({ id: card.id, noteGroupId: group.id }))
            .filter((item) => item.id)
        )
      : studyNoteSections
          .map((section) => ({
            id: section.study_card_id,
            noteGroupId: section.note_group_id || section.source_note_group_id || ""
          }))
          .filter((item) => item.id);
  const orderedStudyCardIds = effectiveVisibleStudyCardOrder.map((item) => item.id);
  const pinnedStudyCardOrderIndex = orderedStudyCardIds.indexOf(readingPinnedCardId);
  const currentVisibleIndex = effectiveVisibleStudyCardOrder.findIndex(
    (item) => item.id === readingPinnedCardId
  );
  const previousVisibleCard =
    currentVisibleIndex > 0 ? effectiveVisibleStudyCardOrder[currentVisibleIndex - 1] : null;
  const nextVisibleCard =
    currentVisibleIndex >= 0 && currentVisibleIndex < effectiveVisibleStudyCardOrder.length - 1
      ? effectiveVisibleStudyCardOrder[currentVisibleIndex + 1]
      : null;
  const currentVisibleCard =
    currentVisibleIndex >= 0 ? effectiveVisibleStudyCardOrder[currentVisibleIndex] : null;
  const previousStudyCardCrossesNoteGroup = Boolean(
    previousVisibleCard &&
      currentVisibleCard &&
      previousVisibleCard.noteGroupId !== currentVisibleCard.noteGroupId
  );
  const nextStudyCardCrossesNoteGroup = Boolean(
    nextVisibleCard &&
      currentVisibleCard &&
      nextVisibleCard.noteGroupId !== currentVisibleCard.noteGroupId
  );
  const hasPreviousStudyCard = currentVisibleIndex > 0;
  const hasNextStudyCard =
    currentVisibleIndex >= 0 &&
    currentVisibleIndex < effectiveVisibleStudyCardOrder.length - 1;
  const activeSourceRangeNumber = Math.min(activeSourceRangeIndex + 1, modalPinnedSourceRanges.length);
  const hasPreviousSourceRange = modalPinnedSourceRanges.length > 0 && activeSourceRangeIndex > 0;
  const hasNextSourceRange =
    modalPinnedSourceRanges.length > 0 && activeSourceRangeIndex < modalPinnedSourceRanges.length - 1;
  const pinnedStudyCardPositionLabel =
    pinnedStudyCardOrderIndex >= 0
      ? `Study Card ${pinnedStudyCardOrderIndex + 1} of ${orderedStudyCardIds.length}`
      : "Pinned Study Card";
  const sourceRangePositionLabel = modalPinnedSourceRanges.length
    ? `Source range ${activeSourceRangeNumber} of ${modalPinnedSourceRanges.length}`
    : "";
  const openSourceTextModal = () => {
    setSourceTextOpen(true);
    if (handleReadingModeChange) {
      handleReadingModeChange("clean");
      return;
    }
    setReadingMode?.("clean");
  };
  const handleStudyCardSourceOpen = (event, studyCardId, rangeIndex = 0, sourceNoteGroupId = "") => {
    setSourceTextOpen(true);
    if (sourceNoteGroupId) {
      setActiveSourceNoteGroupId(sourceNoteGroupId);
    }
    if (handleReadingViewInClean) {
      handleReadingViewInClean(event, studyCardId, rangeIndex);
      return;
    }
    event.stopPropagation();
    setReadingMode?.("clean");
  };
  const renderReadingStudyCard = (card, index, keyPrefix = "study-card") => {
    const studyCardId = card.id || card.study_card_id || "";
    const title = card.title || `Study Card ${index + 1}`;
    const content = card.content || "";
    const sourceNoteGroupId = card.note_group_id || card.source_note_group_id || selectedNoteGroupId || "";
    const sourceRanges = getValidSourceRanges(sourceRangesByCardId, studyCardId);
    const sourceDisabled = !sourceRanges.length;

    return (
      <section
        key={`${keyPrefix}-${studyCardId || index}`}
        id={`reading-study-${studyCardId}`}
        className={`reading-section ${readingPinnedCardId === studyCardId ? "pinned" : ""}`}
      >
        <button
          className="reading-section-toggle"
          type="button"
          aria-label={
            sourceDisabled
              ? `Source text unavailable for ${title}`
              : `View source text for ${title}`
          }
          disabled={sourceDisabled}
          onClick={(event) => handleStudyCardSourceOpen(event, studyCardId, 0, sourceNoteGroupId)}
        >
          <Search size={16} aria-hidden="true" />
        </button>
        <div className="reading-section-header">
          <h3>{title}</h3>
        </div>
        <div className="reading-section-body">
          {renderMarkdownBlocks(content)}
        </div>
      </section>
    );
  };
  const sourceTextDialog = (
    <Dialog open={sourceTextOpen} onOpenChange={setSourceTextOpen}>
      <DialogContent className="source-text-dialog sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Source Text</DialogTitle>
          <DialogDescription>
            Read the original Note Group source text with Study Card source highlights.
          </DialogDescription>
        </DialogHeader>
        <SourceTextContainer
          activeSourceRangeIndex={activeSourceRangeIndex}
          activeSourceNoteGroupId={resolvedSourceNoteGroupId}
          classes={classes}
          effectiveCleanedText={modalEffectiveCleanedText}
          hasNextSourceRange={hasNextSourceRange}
          hasNextStudyCard={hasNextStudyCard}
          hasPreviousSourceRange={hasPreviousSourceRange}
          hasPreviousStudyCard={hasPreviousStudyCard}
          nextStudyCardCrossesNoteGroup={nextStudyCardCrossesNoteGroup}
          noteGroupOptions={sourceNoteGroupOptions}
          onBackToStudyCards={() => setSourceTextOpen(false)}
          onSourceNoteGroupChange={setActiveSourceNoteGroupId}
          previousStudyCardCrossesNoteGroup={previousStudyCardCrossesNoteGroup}
          handleReadingNextStudyCard={handleReadingNextStudyCard}
          handleReadingPreviousStudyCard={handleReadingPreviousStudyCard}
          handleReadingSourceRangeNext={handleReadingSourceRangeNext}
          handleReadingSourceRangePrevious={handleReadingSourceRangePrevious}
          handleReadingUnpin={handleReadingUnpin}
          pinnedSourceRanges={modalPinnedSourceRanges}
          pinnedStudyCard={pinnedStudyCardForModal}
          pinnedStudyCardPositionLabel={pinnedStudyCardPositionLabel}
          readingAvailable={modalReadingAvailable}
          readingContentRef={readingContentRef}
          readingHighlights={modalReadingHighlights}
          readingPinnedCardId={readingPinnedCardId}
          sourceRangePositionLabel={sourceRangePositionLabel}
        />
      </DialogContent>
    </Dialog>
  );
  if (isMindMapPage || isDefaultNonExplicitRoute) {
    if (isConceptScope) {
      return (
        <PageMindMapCard id="topic-mind-map">
          <MindMapPanel
            embedded
            graph={conceptMindMap}
            title={`${selectedConcept?.label || "Concept"} Mind Map`}
            description="Knowledge Nodes, child Concepts, parent Concept, and Study Cards for this Concept."
            loading={conceptMindMapLoading}
            error={conceptMindMapError}
            canRegenerateTopicKnowledgeNodes={canManageSelectedSubject}
            regeneratingTopicId={conceptKnowledgeNodeRegeneratingId}
            onRegenerateTopicKnowledgeNodes={handleRegenerateConceptKnowledgeNodes}
            onTopicNodeClick={(concept) => navigateToConcept(concept.topicId)}
          />
        </PageMindMapCard>
      );
    }

    if (!isConceptScope) {
      return (
        <PageMindMapCard id="note-group-mind-map">
          <MindMapPanel
            embedded
            graph={noteGroupMindMap}
            title={`${selectedNoteGroup?.title || "Note Group"} Mind Map`}
            description="Concepts and relationships extracted from this Note Group."
            loading={noteGroupMindMapLoading}
            error={noteGroupMindMapError}
            canGenerate={canManageSelectedSubject}
            generating={noteGroupMindMapGenerating}
            onGenerate={handleGenerateNoteGroupMindMap}
            canRegenerateTopicKnowledgeNodes={canManageSelectedSubject}
            regeneratingTopicId={conceptKnowledgeNodeRegeneratingId}
            onRegenerateTopicKnowledgeNodes={handleRegenerateConceptKnowledgeNodes}
            canRegenerateNeedsReview={canManageSelectedSubject}
            regeneratingNeedsReview={noteGroupNeedsReviewRegenerating}
            onRegenerateNeedsReview={handleRegenerateNeedsReviewKnowledgeNodes}
            onTopicNodeClick={(concept) => handleOpenMindMapConcept(concept, "note-group")}
            drilldownGraph={mindMapDrilldown.sourceKey === "note-group" ? mindMapDrilldown.graph : null}
            drilldownTitle={
              mindMapDrilldown.sourceKey === "note-group"
                ? `${mindMapDrilldown.title || "Concept"} Mind Map`
                : ""
            }
            drilldownLoading={mindMapDrilldown.sourceKey === "note-group" && mindMapDrilldown.loading}
            drilldownError={mindMapDrilldown.sourceKey === "note-group" ? mindMapDrilldown.error : ""}
            onBackFromDrilldown={clearMindMapDrilldown}
          />
        </PageMindMapCard>
      );
    }
  }

  if (isViewCardsPage) {
    return (
      <>
        <section className="flex flex-wrap items-start gap-3">
          <div>
            <h2>View Cards</h2>
            <p className={classes.mutedText}>
              Study Cards with their linked Question Cards.
            </p>
          </div>
        </section>
        <NoteGroupViewCards
          rows={isConceptScope ? conceptCardTableRows : noteGroupCardTable.rows}
          studyCards={studyCards}
          questionCards={questionCards}
          topicChips={concepts}
          canEdit={canEditCurrentCards}
          showEditControls={canUseProtectedActions}
          editingStudyCardId={editingStudyCardId}
          editingStudyCard={editingStudyCard}
          editingQuestionCardId={editingQuestionCardId}
          editingQuestionCard={editingQuestionCard}
          unlinkedQuestionCount={
            isConceptScope
              ? conceptUnlinkedQuestionCount
              : noteGroupCardTable.unlinked_question_count
          }
          loading={isConceptScope ? false : noteGroupCardTableLoading}
          error={isConceptScope ? studyCardError || questionCardError : noteGroupCardTableError}
          fixedTopicFilter={isConceptScope && !includeDescendantStudyCards ? selectedConcept : null}
          onEditStudyCard={handleEditStudyCard}
          onEditingStudyCardChange={setEditingStudyCard}
          onSaveStudyCard={handleSaveStudyCard}
          onCancelStudyCardEdit={() => setEditingStudyCardId("")}
          onDeleteStudyCard={handleDeleteStudyCard}
          onEditQuestionCard={handleEditQuestionCard}
          onEditingQuestionCardChange={setEditingQuestionCard}
          onSaveQuestionCard={handleSaveQuestionCard}
          onCancelQuestionCardEdit={() => setEditingQuestionCardId("")}
          onDeleteQuestionCard={handleDeleteQuestionCard}
        />
      </>
    );
  }

  if (isInlineStudyPage) {
    return (
      <>
        <section className={`${classes.panel} inline-study-panel`} id="note-group-study">
          <div className="inline-study-header flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2>Study</h2>
              <p className={classes.mutedText}>
                Read this {scopeLabel} as Derived Study Cards.
              </p>
            </div>
            <button
              type="button"
              className={classes.outlineButton}
              onClick={openSourceTextModal}
              disabled={!readingAvailable}
            >
              <Search size={16} aria-hidden="true" />
              View Source Text
            </button>
          </div>
          {!readingAvailable ? (
            <p className={classes.mutedText}>Study content is unavailable for this {scopeLabel}.</p>
          ) : (
            <div className="reading-content inline-reading-content inline-study-scroll">
              {shouldRenderGroupedStudyCards
                ? groupedStudyNoteGroups.map((group) => (
                    <section className="study-note-group" key={group.id}>
                      <div className="study-note-group-divider">
                        {group.title || "Untitled Note Group"}
                      </div>
                      {group.studyCards.map((card, index) =>
                        renderReadingStudyCard(card, index, group.id)
                      )}
                    </section>
                  ))
                : studyNoteSections.map((section, index) =>
                    renderReadingStudyCard(
                      {
                        id: section.study_card_id,
                        title: section.title || `Section ${index + 1}`,
                        content: section.content || "",
                        source_note_group_id: section.source_note_group_id || ""
                      },
                      index,
                      section.anchor || "section"
                    )
                  )}
            </div>
          )}
        </section>
        {sourceTextDialog}
      </>
    );
  }

  if (isStudyPage) {
    return (
      <>
        <section className="flex flex-wrap items-start gap-3">
          <button className="back-button" type="button" onClick={handleBackToOverview}>
            &larr; Back
          </button>
          <div>
            <h2>Study cards</h2>
            <p className={classes.mutedText}>
              {isConceptScope
                ? "Read study cards for this concept."
                : "Manage study cards for this note group."}
            </p>
          </div>
        </section>
        <StudyCardList
          cards={filteredStudyCards}
          canEdit={canEditCurrentCards}
          showEditControls={canUseProtectedActions}
          topicChips={concepts}
          editingStudyCardId={editingStudyCardId}
          editingStudyCard={editingStudyCard}
          error={studyCardError}
          onCreate={openStudyCreateModal}
          onEdit={handleEditStudyCard}
          onEditingChange={setEditingStudyCard}
          onSave={handleSaveStudyCard}
          onCancelEdit={() => setEditingStudyCardId("")}
          onDelete={handleDeleteStudyCard}
          onToggleTopic={(conceptId) =>
            setEditingStudyCard((prev) => ({
              ...prev,
              chipIds: prev.chipIds.includes(conceptId)
                ? prev.chipIds.filter((id) => id !== conceptId)
                : [...prev.chipIds, conceptId]
            }))
          }
        />
      </>
    );
  }

  if (isQuestionPage) {
    return (
      <>
        <section className="flex flex-wrap items-start gap-3">
          <button className="back-button" type="button" onClick={handleBackToOverview}>
            &larr; Back
          </button>
          <div>
            <h2>Question cards</h2>
            <p className={classes.mutedText}>
              {isConceptScope
                ? "Review question cards for this concept."
                : "Review, generate, and edit question cards."}
            </p>
          </div>
        </section>
        <QuestionTimelinePanel
          panelClass={classes.panel}
          mutedTextClass={classes.mutedText}
          questionTimeline={questionTimeline}
        />
        <QuestionCardList
          cards={questionCardsForDisplay}
          masteryFilter={masteryFilter}
          reviewCount={reviewCount}
          generationStatus={questionJobStatus}
          generating={isGeneratingQuestions}
          canEdit={canEditCurrentCards}
          showEditControls={canUseProtectedActions}
          canReview={canUseProtectedActions}
          editingQuestionCardId={editingQuestionCardId}
          editingQuestionCard={editingQuestionCard}
          studyCards={studyCards}
          error={questionCardError || reviewError}
          onMasteryFilterChange={setMasteryFilter}
          onReviewCountChange={setReviewCount}
          onStartReviewDue={() => startReview("due", isConceptScope ? "topic" : "note-group")}
          onStartReviewNext={() => startReview("queue", isConceptScope ? "topic" : "note-group")}
          onStartReviewAll={() => startReview("all", isConceptScope ? "topic" : "note-group")}
          onCreate={openQuestionCreateModal}
          onEdit={handleEditQuestionCard}
          onEditingChange={setEditingQuestionCard}
          onSave={handleSaveQuestionCard}
          onCancelEdit={() => setEditingQuestionCardId("")}
          onDelete={handleDeleteQuestionCard}
          onFocus={openQuestionFocus}
          onGenerate={handleGenerateQuestions}
          onCancelGeneration={() => {}}
          onToggleReference={(studyCardId) =>
            setEditingQuestionCard((prev) => ({
              ...prev,
              refs: prev.refs.includes(studyCardId)
                ? prev.refs.filter((id) => id !== studyCardId)
                : [...prev.refs, studyCardId]
            }))
          }
        />
      </>
    );
  }

  return null;
}

export function NoteGroupScopeContent(props) {
  return <StudyScopeContent {...props} isConceptScope={false} />;
}

export function ConceptScopeContent(props) {
  return <StudyScopeContent {...props} isConceptScope />;
}
