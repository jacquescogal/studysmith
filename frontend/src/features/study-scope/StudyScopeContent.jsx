import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Search, X } from "lucide-react";

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
  setIncludeDescendantStudyCards,
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
  const descendantStudyCardToggle = isConceptScope ? (
    <label className="toggle">
      <input
        type="checkbox"
        checked={includeDescendantStudyCards}
        onChange={(event) => setIncludeDescendantStudyCards?.(event.target.checked)}
      />
      Include descendant Study Cards
    </label>
  ) : null;

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
            {descendantStudyCardToggle}
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
          fixedTopicFilter={isConceptScope ? selectedConcept : null}
          unlinkedQuestionCount={
            isConceptScope
              ? conceptUnlinkedQuestionCount
              : noteGroupCardTable.unlinked_question_count
          }
          loading={isConceptScope ? false : noteGroupCardTableLoading}
          error={isConceptScope ? studyCardError || questionCardError : noteGroupCardTableError}
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
      <section className={`${classes.panel} inline-study-panel`} id="note-group-study">
        <div className="inline-study-header flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2>Study</h2>
            <p className={classes.mutedText}>
              Read this Note Group as Source Text or Derived Study Cards.
            </p>
          </div>
          <div className="segmented-control" role="group" aria-label="Study reading mode">
            <button
              type="button"
              className={readingMode === "clean" ? "active" : ""}
              onClick={() =>
                handleReadingModeChange ? handleReadingModeChange("clean") : setReadingMode("clean")
              }
            >
              Source Text
            </button>
            <button
              type="button"
              className={readingMode === "study" ? "active" : ""}
              onClick={() =>
                handleReadingModeChange ? handleReadingModeChange("study") : setReadingMode("study")
              }
            >
              Derived Study Cards
            </button>
          </div>
        </div>
        {!readingAvailable ? (
          <p className={classes.mutedText}>Study content is unavailable for this Note Group.</p>
        ) : readingMode === "clean" ? (
          <div className="reading-content inline-reading-content inline-study-scroll" ref={readingContentRef}>
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
                  onClick={() =>
                    handleReadingModeChange ? handleReadingModeChange("study") : setReadingMode("study")
                  }
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
        ) : (
          <div className="reading-content inline-reading-content inline-study-scroll" ref={readingContentRef}>
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
                    onClick={(event) => handleReadingViewInClean?.(event, section.study_card_id, 0)}
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
            {descendantStudyCardToggle}
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
        {descendantStudyCardToggle}
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
