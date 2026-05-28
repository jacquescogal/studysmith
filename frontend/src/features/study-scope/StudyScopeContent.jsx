import { useState } from "react";
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
  classes,
  effectiveCleanedText,
  hasNextSourceRange,
  hasNextStudyCard,
  hasPreviousSourceRange,
  hasPreviousStudyCard,
  onBackToStudyCards,
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
              disabled={!hasPreviousStudyCard}
              onClick={handleReadingPreviousStudyCard}
            >
              <ArrowLeft size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Pin next Study Card"
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
  const orderedStudyCardIds = studyNoteSections
    .map((section) => section.study_card_id)
    .filter(Boolean);
  const pinnedStudyCardOrderIndex = orderedStudyCardIds.indexOf(readingPinnedCardId);
  const hasPreviousStudyCard = pinnedStudyCardOrderIndex > 0;
  const hasNextStudyCard =
    pinnedStudyCardOrderIndex >= 0 &&
    pinnedStudyCardOrderIndex < orderedStudyCardIds.length - 1;
  const activeSourceRangeNumber = Math.min(activeSourceRangeIndex + 1, pinnedSourceRanges.length);
  const hasPreviousSourceRange = pinnedSourceRanges.length > 0 && activeSourceRangeIndex > 0;
  const hasNextSourceRange =
    pinnedSourceRanges.length > 0 && activeSourceRangeIndex < pinnedSourceRanges.length - 1;
  const pinnedStudyCardPositionLabel =
    pinnedStudyCardOrderIndex >= 0
      ? `Study Card ${pinnedStudyCardOrderIndex + 1} of ${orderedStudyCardIds.length}`
      : "Pinned Study Card";
  const sourceRangePositionLabel = pinnedSourceRanges.length
    ? `Source range ${activeSourceRangeNumber} of ${pinnedSourceRanges.length}`
    : "";
  const openSourceTextModal = () => {
    setSourceTextOpen(true);
    if (handleReadingModeChange) {
      handleReadingModeChange("clean");
      return;
    }
    setReadingMode?.("clean");
  };
  const handleStudyCardSourceOpen = (event, studyCardId, rangeIndex = 0) => {
    setSourceTextOpen(true);
    if (handleReadingViewInClean) {
      handleReadingViewInClean(event, studyCardId, rangeIndex);
      return;
    }
    event.stopPropagation();
    setReadingMode?.("clean");
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
          classes={classes}
          effectiveCleanedText={effectiveCleanedText}
          hasNextSourceRange={hasNextSourceRange}
          hasNextStudyCard={hasNextStudyCard}
          hasPreviousSourceRange={hasPreviousSourceRange}
          hasPreviousStudyCard={hasPreviousStudyCard}
          onBackToStudyCards={() => setSourceTextOpen(false)}
          handleReadingNextStudyCard={handleReadingNextStudyCard}
          handleReadingPreviousStudyCard={handleReadingPreviousStudyCard}
          handleReadingSourceRangeNext={handleReadingSourceRangeNext}
          handleReadingSourceRangePrevious={handleReadingSourceRangePrevious}
          handleReadingUnpin={handleReadingUnpin}
          pinnedSourceRanges={pinnedSourceRanges}
          pinnedStudyCard={pinnedStudyCard}
          pinnedStudyCardPositionLabel={pinnedStudyCardPositionLabel}
          readingAvailable={readingAvailable}
          readingContentRef={readingContentRef}
          readingHighlights={readingHighlights}
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
                Read this Note Group as Derived Study Cards.
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
            <p className={classes.mutedText}>Study content is unavailable for this Note Group.</p>
          ) : (
            <div className="reading-content inline-reading-content inline-study-scroll">
              {studyNoteSections.map((section, index) => {
                const title = section.title || `Section ${index + 1}`;
                const sourceRanges = getValidSourceRanges(sourceRangesByCardId, section.study_card_id);
                const sourceDisabled = !sourceRanges.length;
                return (
                  <section
                    key={section.anchor || section.study_card_id || index}
                    id={`reading-study-${section.study_card_id}`}
                    className={`reading-section ${
                      readingPinnedCardId === section.study_card_id ? "pinned" : ""
                    }`}
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
                      onClick={(event) => handleStudyCardSourceOpen(event, section.study_card_id, 0)}
                    >
                      <Search size={16} aria-hidden="true" />
                    </button>
                    <div className="reading-section-header">
                      <h3>{title}</h3>
                    </div>
                    <div className="reading-section-body">
                      {renderMarkdownBlocks(section.content || "")}
                    </div>
                  </section>
                );
              })}
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
