import Select from "react-select";

import { Button } from "@/components/ui/button";
import { PageMindMapCard } from "@/features/mind-map/PageMindMapCard";
import { MindMapPanel } from "@/features/mind-map/MindMapPanel";
import { NoteGroupGenerationWorkflow } from "@/features/note-groups/NoteGroupGenerationWorkflow";
import { NoteGroupOverview } from "@/features/note-groups/NoteGroupOverview";
import { NoteGroupProgress } from "@/features/note-groups/NoteGroupProgress";
import { NoteGroupViewCards } from "@/features/note-groups/NoteGroupViewCards";
import { QuestionCardList } from "@/features/question-cards/QuestionCardList";
import { StudyCardList } from "@/features/study-cards/StudyCardList";
import { ConceptOverview } from "@/features/concepts/ConceptOverview";
import { conceptPath, noteGroupPath } from "@/lib/routes";

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
  handleGenerateQuestions
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

  if (!isViewCardsPage && !isStudyPage && !isQuestionPage) {
    return (
      <div className="space-y-6">
        {isConceptScope ? (
          <>
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
            <ConceptOverview
              concept={selectedConcept}
              stats={noteGroupStats}
              actions={
                <>
                  <button
                    className={classes.primaryButton}
                    type="button"
                    onClick={() =>
                      navigate(
                        conceptPath(
                          selectedSubjectCode,
                          selectedModuleCode,
                          selectedConceptCode,
                          "view-cards"
                        )
                      )
                    }
                  >
                    View cards
                  </button>
                  <button
                    className={classes.outlineButton}
                    type="button"
                    onClick={() => setIsChatOpen(true)}
                    disabled={!canUseProtectedActions || !selectedModuleId || isReviewOverlayVisible}
                  >
                    Open chat
                  </button>
                  <button
                    className={classes.outlineButton}
                    type="button"
                    onClick={() => handleRegenerateConceptKnowledgeNodes()}
                    disabled={
                      !canManageSelectedSubject ||
                      !selectedConceptId ||
                      conceptKnowledgeNodeRegenerating ||
                      isReviewOverlayVisible
                    }
                  >
                    {conceptKnowledgeNodeRegenerating ? "Regenerating..." : "Regenerate Knowledge Nodes"}
                  </button>
                </>
              }
              error={conceptError}
            >
              <div className="form-block">
                <h3>Concept management</h3>
                {selectedConcept?.knowledge_node_status ? (
                  <div className="status-row">
                    <span className={`status-pill status-${selectedConcept.knowledge_node_status}`}>
                      {selectedConcept.knowledge_node_status === "needs_review"
                        ? "Needs review"
                        : selectedConcept.knowledge_node_status === "complete"
                          ? "Knowledge Nodes ready"
                          : "Knowledge Nodes not generated"}
                    </span>
                    {selectedConcept.knowledge_node_review_reason ? (
                      <span className={classes.mutedText}>
                        {selectedConcept.knowledge_node_review_reason}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <input
                  type="text"
                  value={conceptTitleDraft}
                  onChange={(event) => setConceptTitleDraft(event.target.value)}
                  placeholder="Concept name"
                />
                <input
                  type="text"
                  value={conceptDescriptionDraft}
                  onChange={(event) => setConceptDescriptionDraft(event.target.value)}
                  placeholder="Description (optional)"
                />
                <div className={classes.buttonRow}>
                  <button
                    className={classes.primaryButton}
                    type="button"
                    onClick={handleSaveConcept}
                    disabled={!canManageSelectedSubject || conceptSaving || !conceptTitleDraft.trim()}
                  >
                    {conceptSaving ? "Saving..." : "Rename concept"}
                  </button>
                  <button
                    className={classes.destructiveOutlineButton}
                    type="button"
                    onClick={handleDeleteConcept}
                    disabled={!canManageSelectedSubject || conceptSaving || isReviewOverlayVisible}
                  >
                    Delete concept
                  </button>
                </div>
              </div>
            </ConceptOverview>
          </>
        ) : (
          <>
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
            <NoteGroupOverview
              noteGroup={selectedNoteGroup}
              statusMeta={noteGroupStatusMeta}
              stats={noteGroupStats}
              topics={concepts.filter((concept) => noteGroupConceptIds.includes(concept.id))}
              filterControls={
                <div className="filter-row">
                  <div className="filter-label">
                    <span>Filter note groups</span>
                    {conceptFilterIds.length ? (
                      <span className="filter-badge">{conceptFilterIds.length}</span>
                    ) : null}
                  </div>
                  <div className="filter-controls">
                    <Select
                      className="select"
                      classNamePrefix="select"
                      options={conceptOptions}
                      value={conceptFilterValue}
                      onChange={handleConceptFilterSelect}
                      placeholder="Search concepts"
                      isMulti
                      isClearable
                      isDisabled={!selectedModuleId || conceptOptions.length === 0}
                      maxMenuHeight={220}
                      menuPortalTarget={document.body}
                      styles={selectStyles}
                      formatOptionLabel={(opt) => (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span>{opt.label}</span>
                          {opt.description ? (
                            <span style={{ fontSize: "0.75em", color: "#888" }}>{opt.description}</span>
                          ) : null}
                        </div>
                      )}
                    />
                    <button
                      className={classes.smallOutlineButton}
                      type="button"
                      onClick={handleResetConceptFilters}
                      disabled={!conceptFilterIds.length}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              }
              actions={
                <>
                  <button
                    className={classes.primaryButton}
                    type="button"
                    onClick={() => startReview("due", "note-group")}
                    disabled={!canUseProtectedActions || !selectedNoteGroupId || isReviewing}
                  >
                    Review Due
                    <span className="rounded-md bg-primary-foreground/20 px-2 py-0.5 text-xs">
                      {noteGroupStats.dueCount}
                    </span>
                  </button>
                  <button
                    className={classes.outlineButton}
                    type="button"
                    onClick={() => setIsChatOpen(true)}
                    disabled={!canUseProtectedActions || !selectedModuleId || isReviewOverlayVisible}
                  >
                    Chat
                  </button>
                  <button
                    className={classes.outlineButton}
                    type="button"
                    onClick={openMetadataModal}
                    disabled={!canManageSelectedSubject || !selectedNoteGroupId || isReviewOverlayVisible}
                  >
                    Edit metadata
                  </button>
                  <button
                    className={classes.destructiveOutlineButton}
                    type="button"
                    onClick={handleDeleteNoteGroup}
                    disabled={!canManageSelectedSubject || !selectedNoteGroupId || isReviewOverlayVisible}
                  >
                    Delete note group
                  </button>
                </>
              }
            />
            <section className={classes.panel} id="note-group-content">
              <div className="mb-4">
                <h3 className="text-base font-semibold">Content</h3>
                <p className={classes.mutedText}>
                  Open the cards table or source for this Note Group.
                </p>
              </div>
              <div className={classes.buttonRow}>
                <button
                  className={classes.primaryButton}
                  type="button"
                  onClick={() =>
                    navigate(
                      noteGroupPath(
                        selectedSubjectCode,
                        selectedModuleCode,
                        selectedNoteGroupCode,
                        "view-cards"
                      )
                    )
                  }
                >
                  View Cards
                </button>
                <button
                  className={classes.outlineButton}
                  type="button"
                  onClick={() => setIsReadingOpen(true)}
                  disabled={!readingAvailable}
                >
                  View Source
                </button>
              </div>
            </section>
            <NoteGroupProgress
              progress={noteGroupProgress}
              range={progressRange}
              loading={noteGroupProgressLoading}
              error={noteGroupProgressError}
              onRangeChange={setProgressRange}
              onOpenPerformance={() =>
                navigate(
                  noteGroupPath(
                    selectedSubjectCode,
                    selectedModuleCode,
                    selectedNoteGroupCode,
                    "view-cards"
                  )
                )
              }
            />
          </>
        )}
        {isConceptScope ? (
          <section
            className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
            id="note-group-shortcuts"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Shortcuts</h3>
                <p className={classes.mutedText}>Quick actions for this concept.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => startReview("due", "topic")}
                disabled={!canUseProtectedActions || !selectedConceptId || isReviewing}
              >
                Review due
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {noteGroupStats.dueCount}
                </span>
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  if (isViewCardsPage) {
    return (
      <>
        <section className="flex flex-wrap items-start gap-3">
          <button className="back-button" type="button" onClick={handleBackToOverview}>
            &larr; Back
          </button>
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
