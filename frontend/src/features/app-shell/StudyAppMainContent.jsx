import React from "react";

import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionNav } from "@/components/layout/SectionNav";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { LegacyDialog } from "@/components/common/LegacyDialog";
import { ModuleIndexPage } from "@/features/modules/ModuleIndexPage";
import { ModuleHomePage } from "@/features/modules/ModuleHomePage";
import { AdminPanel } from "@/features/admin/AdminPanel";
import { NoteGroupCreate } from "@/features/note-groups/NoteGroupCreate";
import { ReadingDialog } from "@/features/reading/ReadingDialog";
import { ReviewDialog } from "@/features/review/ReviewDialog";
import { SubjectIndexPage as SubjectIndexRouteContent } from "@/features/subjects/SubjectIndexPage";
import { SubjectManagementPanel } from "@/features/subjects/SubjectManagementPanel";
import { ConceptScopeContent, NoteGroupScopeContent } from "@/features/study-scope/StudyScopeContent";
import { TutorChatDialog } from "@/features/chat/TutorChatDialog";
import { appShellClasses, generationWorkflowStageLabel, generationWorkflowStatusLabel, generationWorkflowTitle, selectStyles } from "@/features/app-shell/appShellUi";
import { countWords, formatCreatedAt, getNoteGroupStatusMeta } from "@/lib/format";
import { renderCleanedMarkdown, renderMarkdownBlocks } from "@/lib/text-rendering";

const {
  panel: panelClass,
  primaryButton: primaryButtonClass,
  outlineButton: outlineButtonClass,
  smallOutlineButton: smallOutlineButtonClass,
  destructiveOutlineButton: destructiveOutlineButtonClass,
  smallDestructiveOutlineButton: smallDestructiveOutlineButtonClass,
  buttonRow: buttonRowClass,
  badge: badgeClass,
  mutedText: mutedTextClass,
  smallMutedText: smallMutedTextClass,
  errorText: errorTextClass
} = appShellClasses;

export function StudyAppMainContent({ model }) {
  const {
    authActions,
    autoAdditionalInstructions,
    autoCreateError,
    autoCreateLoading,
    autoJobActionId,
    autoJobsByNoteGroupId,
    autoRawText,
    canCreateSubjects,
    canDeleteSubject,
    canEditCurrentCards,
    canMaintainSubject,
    canManageSelectedSubject,
    canReorderNoteGroups,
    canUseProtectedActions,
    chipFilterIds,
    chipFilterValue,
    chipOptions,
    clearMindMapDrilldown,
    currentUserProfile,
    dragOverNoteGroupId,
    draggedNoteGroupId,
    editingQuestionCard,
    editingQuestionCardId,
    editingStudyCard,
    editingStudyCardId,
    filteredStudyCards,
    generationWorkflowsByNoteGroupId,
    handleAutoCreateNoteGroup,
    handleBackToOverview,
    handleBreadcrumbHome,
    handleCancelAutoJob,
    handleCheckSource,
    handleChipFilterSelect,
    handleConfirmDuplicateSource,
    handleDeleteAutoJob,
    handleDeleteModule,
    handleDeleteNoteGroup,
    handleDeleteQuestionCard,
    handleDeleteStudyCard,
    handleDeleteSubject,
    handleDeleteTopic,
    handleEditQuestionCard,
    handleEditStudyCard,
    handleGenerateNoteGroupMindMap,
    handleGenerateQuestions,
    handleNoteGroupDragEnd,
    handleNoteGroupDragEnter,
    handleNoteGroupDragOver,
    handleNoteGroupDragStart,
    handleNoteGroupDrop,
    handleOpenMindMapTopic,
    handleOpenModuleWizard,
    handleOpenSubjectWizard,
    handleRegenerateModuleNeedsReviewKnowledgeNodes,
    handleRegenerateNeedsReviewKnowledgeNodes,
    handleRegenerateTopicKnowledgeNodes,
    handleResetChipFilters,
    handleRetryAutoJob,
    handleSaveQuestionCard,
    handleSaveStudyCard,
    handleSaveTopic,
    handleSelectModule,
    handleSelectSubject,
    handleSubjectUpdated,
    handleUniqueIdChange,
    handleUseGeneratedUniqueId,
    hasSidebar,
    isAdmin,
    isAdminPanelOpen,
    isGeneratingQuestions,
    isQuestionPage,
    isReorderingNoteGroups,
    isRestoringRoute,
    isReviewOverlayVisible,
    isReviewing,
    isSourceReady,
    isStudyPage,
    isSubjectManagementOpen,
    isViewCardsPage,
    masteryFilter,
    mindMapDrilldown,
    moduleDueCounts,
    moduleGenerationWorkflow,
    moduleGenerationWorkflowConnection,
    moduleGenerationWorkflowError,
    moduleMindMap,
    moduleMindMapError,
    moduleMindMapLoading,
    moduleNeedsReviewRegenerating,
    moduleNoteGroupStatsById,
    moduleNoteGroupsForDisplay,
    moduleQuestionTimeline,
    moduleStats,
    moduleStatsError,
    moduleStatsLoading,
    modules,
    navigate,
    navigateToNoteGroup,
    navigateToTopic,
    noteGroupCardTable,
    noteGroupCardTableError,
    noteGroupCardTableLoading,
    noteGroupChipIds,
    noteGroupMindMap,
    noteGroupMindMapError,
    noteGroupMindMapGenerating,
    noteGroupMindMapLoading,
    noteGroupMode,
    noteGroupNeedsReviewRegenerating,
    noteGroupProgress,
    noteGroupProgressError,
    noteGroupProgressLoading,
    noteGroupSource,
    noteGroupStats,
    noteGroupStatusMeta,
    openMetadataModal,
    openModuleMetadataModal,
    openQuestionCreateModal,
    openQuestionFocus,
    openStudyCreateModal,
    openSubjectMetadataModal,
    pageBreadcrumbs,
    pageHeader,
    progressRange,
    questionCardError,
    questionCards,
    questionCardsForDisplay,
    questionJobStatus,
    questionTimeline,
    readingAvailable,
    reviewCount,
    reviewError,
    routeRestoreError,
    sectionNavItems,
    selectedModule,
    selectedModuleCode,
    selectedModuleId,
    selectedNoteGroup,
    selectedNoteGroupCode,
    selectedNoteGroupId,
    selectedNoteGroupWorkflow,
    selectedSubject,
    selectedSubjectCode,
    selectedSubjectId,
    selectedTopic,
    selectedTopicCode,
    selectedTopicId,
    setAutoAdditionalInstructions,
    setAutoRawText,
    setEditingQuestionCard,
    setEditingQuestionCardId,
    setEditingStudyCard,
    setEditingStudyCardId,
    setIsAdminPanelOpen,
    setIsChatOpen,
    setIsReadingOpen,
    setIsSubjectManagementOpen,
    setMasteryFilter,
    setProgressRange,
    setReviewCount,
    setTopicDescriptionDraft,
    setTopicTitleDraft,
    shouldHoldSelectedNoteGroupContent,
    sidebarContent,
    sidebarError,
    sourceCheckError,
    sourceChecked,
    sourceChecking,
    sourceConfirmed,
    sourceDuplicateCount,
    sourceDuplicates,
    startReview,
    studyCardError,
    studyCards,
    subjects,
    topicCardTableRows,
    topicChips,
    topicDescriptionDraft,
    topicError,
    topicKnowledgeNodeRegenerating,
    topicKnowledgeNodeRegeneratingId,
    topicMindMap,
    topicMindMapError,
    topicMindMapLoading,
    topicSaving,
    topicTitleDraft,
    topicUnlinkedQuestionCount
  } = model;
  const StudyScopeRouteContent = selectedTopicId ? ConceptScopeContent : NoteGroupScopeContent;

  return (
    <>
<AppShell
        hasSidebar={hasSidebar}
        sidebar={sidebarContent}
        header={
          <PageHeader
            title={pageHeader.title}
            description={pageHeader.description}
            pageType={pageHeader.pageType}
            tone={pageHeader.tone}
            breadcrumbs={pageBreadcrumbs}
            actions={authActions}
          />
        }
        sectionNav={sectionNavItems.length ? <SectionNav items={sectionNavItems} /> : null}
      >
        <>
            {isSubjectManagementOpen && selectedSubject && canManageSelectedSubject ? (
              <SubjectManagementPanel
                subject={selectedSubject}
                currentUser={currentUserProfile}
                isAdmin={isAdmin}
                onSubjectUpdated={handleSubjectUpdated}
                onClose={() => setIsSubjectManagementOpen(false)}
              />
            ) : isAdminPanelOpen && isAdmin ? (
              <AdminPanel
                subjects={subjects}
                selectedSubjectId={selectedSubjectId}
                onSubjectUpdated={handleSubjectUpdated}
                onClose={() => setIsAdminPanelOpen(false)}
              />
            ) : routeRestoreError ? (
              <section className={panelClass}>
                <h2>Unable to restore page</h2>
                <p className={errorTextClass}>{routeRestoreError}</p>
                <p className={mutedTextClass}>
                  The URL points to a page that could not be loaded from the API.
                </p>
              </section>
            ) : !isRestoringRoute && !selectedSubjectId ? (
              <SubjectIndexRouteContent
                subjects={subjects}
                error={sidebarError}
                canCreateSubjects={canCreateSubjects}
                canUseProtectedActions={canUseProtectedActions}
                canMaintainSubject={canMaintainSubject}
                canDeleteSubject={canDeleteSubject}
                onOpenWizard={handleOpenSubjectWizard}
                onSelectSubject={handleSelectSubject}
                onEditSubject={openSubjectMetadataModal}
                onDeleteSubject={handleDeleteSubject}
              />
            ) : isRestoringRoute ? (
              <section className={panelClass}>
                <h2>Fetching page</h2>
                <p className={mutedTextClass}>Loading the subject and module for this URL.</p>
              </section>
            ) : !selectedModuleId ? (
              <ModuleIndexPage
                modules={modules}
                dueCounts={moduleDueCounts}
                subjectDescription={selectedSubject?.description}
                error={sidebarError}
                canManageSelectedSubject={canManageSelectedSubject}
                canUseProtectedActions={canUseProtectedActions}
                onOpenWizard={handleOpenModuleWizard}
                onBack={handleBreadcrumbHome}
                onSelectModule={handleSelectModule}
                onDeleteModule={handleDeleteModule}
              />
            ) : noteGroupMode === "auto" ? (
              <NoteGroupCreate
                uniqueId={noteGroupSource}
                rawText={autoRawText}
                additionalInstructions={autoAdditionalInstructions}
                sourceChecking={sourceChecking}
                sourceConfirmed={isSourceReady}
                sourceDuplicateCount={sourceChecked && !sourceConfirmed ? sourceDuplicateCount : 0}
                sourceDuplicates={sourceDuplicates}
                sourceCheckError={sourceCheckError}
                autoCreateError={autoCreateError}
                autoCreateLoading={autoCreateLoading}
                rawTextDisabled={!selectedModuleId}
                createDisabled={
                  !canManageSelectedSubject || !selectedModuleId || !isSourceReady || !autoRawText.trim()
                }
                additionalInstructionsMeta={`Word count: ${countWords(autoAdditionalInstructions)}/500`}
                onUniqueIdChange={handleUniqueIdChange}
                onGenerateUniqueId={handleUseGeneratedUniqueId}
                onCheckSource={handleCheckSource}
                onConfirmDuplicate={handleConfirmDuplicateSource}
                onRawTextChange={setAutoRawText}
                onAdditionalInstructionsChange={setAutoAdditionalInstructions}
                onCreate={handleAutoCreateNoteGroup}
              />
            ) : (
              <>
                {!selectedNoteGroupId && !selectedTopicId ? (
                  <ModuleHomePage
                    selectedModule={selectedModule}
                    moduleMindMapProps={{
                      moduleTitle: selectedModule?.title,
                      graph: moduleMindMap,
                      loading: moduleMindMapLoading,
                      error: moduleMindMapError,
                      canRegenerateTopicKnowledgeNodes: canManageSelectedSubject,
                      regeneratingTopicId: topicKnowledgeNodeRegeneratingId,
                      onRegenerateTopicKnowledgeNodes: handleRegenerateTopicKnowledgeNodes,
                      canRegenerateNeedsReview: canManageSelectedSubject,
                      regeneratingNeedsReview: moduleNeedsReviewRegenerating,
                      onRegenerateNeedsReview: handleRegenerateModuleNeedsReviewKnowledgeNodes,
                      onTopicNodeClick: (topic) => handleOpenMindMapTopic(topic, "module"),
                      drilldownGraph:
                        mindMapDrilldown.sourceKey === "module" ? mindMapDrilldown.graph : null,
                      drilldownTitle:
                        mindMapDrilldown.sourceKey === "module"
                          ? `${mindMapDrilldown.title || "Concept"} Mind Map`
                          : "",
                      drilldownLoading:
                        mindMapDrilldown.sourceKey === "module" && mindMapDrilldown.loading,
                      drilldownError:
                        mindMapDrilldown.sourceKey === "module" ? mindMapDrilldown.error : "",
                      onBackFromDrilldown: clearMindMapDrilldown
                    }}
                    moduleStats={moduleStats}
                    moduleStatsLoading={moduleStatsLoading}
                    moduleStatsError={moduleStatsError}
                    moduleQuestionTimeline={moduleQuestionTimeline}
                    moduleNoteGroupsForDisplay={moduleNoteGroupsForDisplay}
                    moduleNoteGroupStatsById={moduleNoteGroupStatsById}
                    chipFilterIds={chipFilterIds}
                    chipOptions={chipOptions}
                    chipFilterValue={chipFilterValue}
                    selectStyles={selectStyles}
                    selectedModuleId={selectedModuleId}
                    canUseProtectedActions={canUseProtectedActions}
                    canManageSelectedSubject={canManageSelectedSubject}
                    isReviewOverlayVisible={isReviewOverlayVisible}
                    moduleGenerationWorkflow={moduleGenerationWorkflow}
                    moduleGenerationWorkflowConnection={moduleGenerationWorkflowConnection}
                    moduleGenerationWorkflowError={moduleGenerationWorkflowError}
                    generationWorkflowStatusLabel={generationWorkflowStatusLabel}
                    generationWorkflowTitle={generationWorkflowTitle}
                    generationWorkflowStageLabel={generationWorkflowStageLabel}
                    reviewCount={reviewCount}
                    isReviewing={isReviewing}
                    reviewError={reviewError}
                    canReorderNoteGroups={canReorderNoteGroups}
                    isReorderingNoteGroups={isReorderingNoteGroups}
                    draggedNoteGroupId={draggedNoteGroupId}
                    dragOverNoteGroupId={dragOverNoteGroupId}
                    generationWorkflowsByNoteGroupId={generationWorkflowsByNoteGroupId}
                    autoJobsByNoteGroupId={autoJobsByNoteGroupId}
                    autoJobActionId={autoJobActionId}
                    classes={{
                      panel: panelClass,
                      mutedText: mutedTextClass,
                      smallMutedText: smallMutedTextClass,
                      errorText: errorTextClass,
                      badge: badgeClass,
                      primaryButton: primaryButtonClass,
                      outlineButton: outlineButtonClass,
                      smallOutlineButton: smallOutlineButtonClass,
                      smallDestructiveOutlineButton: smallDestructiveOutlineButtonClass,
                      buttonRow: buttonRowClass
                    }}
                    onChipFilterSelect={handleChipFilterSelect}
                    onResetChipFilters={handleResetChipFilters}
                    onOpenChat={() => setIsChatOpen(true)}
                    onOpenModuleMetadata={openModuleMetadataModal}
                    onDeleteModule={handleDeleteModule}
                    onReviewCountChange={(event) => setReviewCount(event.target.value)}
                    onStartReview={startReview}
                    onNoteGroupDragOver={handleNoteGroupDragOver}
                    onNoteGroupDragEnter={handleNoteGroupDragEnter}
                    onNoteGroupDrop={handleNoteGroupDrop}
                    onNoteGroupDragEnd={handleNoteGroupDragEnd}
                    onNoteGroupDragStart={handleNoteGroupDragStart}
                    onCancelAutoJob={handleCancelAutoJob}
                    onRetryAutoJob={handleRetryAutoJob}
                    onNavigateToNoteGroup={navigateToNoteGroup}
                  />
                ) : (
                  <StudyScopeRouteContent
                    shouldHoldContent={shouldHoldSelectedNoteGroupContent}
                    selectedNoteGroupWorkflow={selectedNoteGroupWorkflow}
                    moduleGenerationWorkflowConnection={moduleGenerationWorkflowConnection}
                    moduleGenerationWorkflowError={moduleGenerationWorkflowError}
                    autoJobActionId={autoJobActionId}
                    canManageSelectedSubject={canManageSelectedSubject}
                    handleCancelAutoJob={handleCancelAutoJob}
                    handleRetryAutoJob={handleRetryAutoJob}
                    handleDeleteAutoJob={handleDeleteAutoJob}
                    isViewCardsPage={isViewCardsPage}
                    isStudyPage={isStudyPage}
                    isQuestionPage={isQuestionPage}
                    selectedConcept={selectedTopic}
                    selectedConceptId={selectedTopicId}
                    selectedConceptCode={selectedTopicCode}
                    selectedNoteGroup={selectedNoteGroup}
                    selectedNoteGroupId={selectedNoteGroupId}
                    selectedNoteGroupCode={selectedNoteGroupCode}
                    selectedSubjectCode={selectedSubjectCode}
                    selectedModuleCode={selectedModuleCode}
                    conceptMindMap={topicMindMap}
                    conceptMindMapLoading={topicMindMapLoading}
                    conceptMindMapError={topicMindMapError}
                    noteGroupMindMap={noteGroupMindMap}
                    noteGroupMindMapLoading={noteGroupMindMapLoading}
                    noteGroupMindMapError={noteGroupMindMapError}
                    noteGroupMindMapGenerating={noteGroupMindMapGenerating}
                    conceptKnowledgeNodeRegenerating={topicKnowledgeNodeRegenerating}
                    conceptKnowledgeNodeRegeneratingId={topicKnowledgeNodeRegeneratingId}
                    noteGroupNeedsReviewRegenerating={noteGroupNeedsReviewRegenerating}
                    mindMapDrilldown={mindMapDrilldown}
                    noteGroupStats={noteGroupStats}
                    noteGroupStatusMeta={noteGroupStatusMeta}
                    noteGroupProgress={noteGroupProgress}
                    noteGroupProgressLoading={noteGroupProgressLoading}
                    noteGroupProgressError={noteGroupProgressError}
                    progressRange={progressRange}
                    noteGroupCardTable={noteGroupCardTable}
                    noteGroupCardTableLoading={noteGroupCardTableLoading}
                    noteGroupCardTableError={noteGroupCardTableError}
                    conceptCardTableRows={topicCardTableRows}
                    conceptUnlinkedQuestionCount={topicUnlinkedQuestionCount}
                    studyCards={studyCards}
                    filteredStudyCards={filteredStudyCards}
                    questionCards={questionCards}
                    questionCardsForDisplay={questionCardsForDisplay}
                    questionTimeline={questionTimeline}
                    concepts={topicChips}
                    conceptOptions={chipOptions}
                    conceptFilterValue={chipFilterValue}
                    conceptFilterIds={chipFilterIds}
                    noteGroupConceptIds={noteGroupChipIds}
                    selectedModuleId={selectedModuleId}
                    canUseProtectedActions={canUseProtectedActions}
                    canEditCurrentCards={canEditCurrentCards}
                    isReviewing={isReviewing}
                    isReviewOverlayVisible={isReviewOverlayVisible}
                    readingAvailable={readingAvailable}
                    conceptTitleDraft={topicTitleDraft}
                    conceptDescriptionDraft={topicDescriptionDraft}
                    conceptError={topicError}
                    conceptSaving={topicSaving}
                    studyCardError={studyCardError}
                    questionCardError={questionCardError}
                    reviewError={reviewError}
                    questionJobStatus={questionJobStatus}
                    isGeneratingQuestions={isGeneratingQuestions}
                    masteryFilter={masteryFilter}
                    reviewCount={reviewCount}
                    editingStudyCardId={editingStudyCardId}
                    editingStudyCard={editingStudyCard}
                    editingQuestionCardId={editingQuestionCardId}
                    editingQuestionCard={editingQuestionCard}
                    classes={{
                      panel: panelClass,
                      mutedText: mutedTextClass,
                      primaryButton: primaryButtonClass,
                      outlineButton: outlineButtonClass,
                      smallOutlineButton: smallOutlineButtonClass,
                      destructiveOutlineButton: destructiveOutlineButtonClass,
                      buttonRow: buttonRowClass
                    }}
                    selectStyles={selectStyles}
                    navigate={navigate}
                    setIsChatOpen={setIsChatOpen}
                    setIsReadingOpen={setIsReadingOpen}
                    setProgressRange={setProgressRange}
                    setConceptTitleDraft={setTopicTitleDraft}
                    setConceptDescriptionDraft={setTopicDescriptionDraft}
                    setEditingStudyCard={setEditingStudyCard}
                    setEditingStudyCardId={setEditingStudyCardId}
                    setEditingQuestionCard={setEditingQuestionCard}
                    setEditingQuestionCardId={setEditingQuestionCardId}
                    setMasteryFilter={setMasteryFilter}
                    setReviewCount={setReviewCount}
                    handleBackToOverview={handleBackToOverview}
                    handleRegenerateConceptKnowledgeNodes={handleRegenerateTopicKnowledgeNodes}
                    handleGenerateNoteGroupMindMap={handleGenerateNoteGroupMindMap}
                    handleRegenerateNeedsReviewKnowledgeNodes={handleRegenerateNeedsReviewKnowledgeNodes}
                    handleOpenMindMapConcept={handleOpenMindMapTopic}
                    clearMindMapDrilldown={clearMindMapDrilldown}
                    navigateToConcept={navigateToTopic}
                    handleConceptFilterSelect={handleChipFilterSelect}
                    handleResetConceptFilters={handleResetChipFilters}
                    startReview={startReview}
                    openMetadataModal={openMetadataModal}
                    handleDeleteNoteGroup={handleDeleteNoteGroup}
                    handleSaveConcept={handleSaveTopic}
                    handleDeleteConcept={handleDeleteTopic}
                    openStudyCreateModal={openStudyCreateModal}
                    handleEditStudyCard={handleEditStudyCard}
                    handleSaveStudyCard={handleSaveStudyCard}
                    handleDeleteStudyCard={handleDeleteStudyCard}
                    openQuestionCreateModal={openQuestionCreateModal}
                    handleEditQuestionCard={handleEditQuestionCard}
                    handleSaveQuestionCard={handleSaveQuestionCard}
                    handleDeleteQuestionCard={handleDeleteQuestionCard}
                    openQuestionFocus={openQuestionFocus}
                    handleGenerateQuestions={handleGenerateQuestions}
                  />
                )}
              </>
            )}
        </>
      </AppShell>
    </>
  );
}
