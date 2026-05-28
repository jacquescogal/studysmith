import React from "react";

import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionNav } from "@/components/layout/SectionNav";
import { ScopeInteractionDock } from "@/components/layout/ScopeInteractionDock";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { LegacyDialog } from "@/components/common/LegacyDialog";
import { ModuleIndexPage } from "@/features/modules/ModuleIndexPage";
import { ModuleMindMapPage } from "@/features/modules/ModuleMindMapPage";
import { AdminPanel } from "@/features/admin/AdminPanel";
import { NoteGroupCreate } from "@/features/note-groups/NoteGroupCreate";
import { NoteGroupViewCards } from "@/features/note-groups/NoteGroupViewCards";
import { ReadingDialog } from "@/features/reading/ReadingDialog";
import { ReviewDialog } from "@/features/review/ReviewDialog";
import { SubjectIndexPage as SubjectIndexRouteContent } from "@/features/subjects/SubjectIndexPage";
import { SubjectManagementPanel } from "@/features/subjects/SubjectManagementPanel";
import { ConceptScopeContent, NoteGroupScopeContent } from "@/features/study-scope/StudyScopeContent";
import { TutorChatDialog } from "@/features/chat/TutorChatDialog";
import { appShellClasses, generationWorkflowStageLabel, generationWorkflowStatusLabel, generationWorkflowTitle, selectStyles } from "@/features/app-shell/appShellUi";
import { countWords, formatCreatedAt, getNoteGroupStatusMeta } from "@/lib/format";
import { renderCleanedMarkdown, renderMarkdownBlocks } from "@/lib/text-rendering";
import { conceptPath, moduleMindMapPath, modulePath, moduleStudyPath, moduleViewCardsPath, noteGroupMindMapPath, noteGroupPath } from "@/lib/routes";

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
    activeSourceRangeIndex,
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
    effectiveCleanedText,
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
    handleReadingModeChange,
    handleReadingNextStudyCard,
    handleReadingPreviousStudyCard,
    handleReadingSourceRangeNext,
    handleReadingSourceRangePrevious,
    handleReadingUnpin,
    handleReadingViewInClean,
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
    includeDescendantStudyCards,
    isAdmin,
    isAdminPanelOpen,
    isGeneratingQuestions,
    isQuestionPage,
    isInlineStudyPage,
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
    moduleCardTable,
    moduleCardTableError,
    moduleCardTableLoading,
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
    pinnedSourceRanges,
    pinnedStudyCard,
    pageBreadcrumbs,
    pageHeader,
    progressRange,
    questionCardError,
    questionCards,
    questionCardsForDisplay,
    questionJobStatus,
    questionTimeline,
    readingAvailable,
    readingContentRef,
    readingHighlights,
    readingMode,
    readingPinnedCardId,
    reviewCount,
    reviewError,
    routePanel,
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
    setIncludeDescendantStudyCards,
    setIsAdminPanelOpen,
    setIsChatOpen,
    setIsConceptSettingsOpen,
    setIsReadingOpen,
    setIsSubjectManagementOpen,
    setMasteryFilter,
    setProgressRange,
    setReadingMode,
    setReviewCount,
    setTopicDescriptionDraft,
    setTopicTitleDraft,
    shouldHoldSelectedNoteGroupContent,
    sidebarContent,
    sidebarError,
    sourceRangesByCardId,
    sourceCheckError,
    sourceChecked,
    sourceChecking,
    sourceConfirmed,
    sourceDuplicateCount,
    sourceDuplicates,
    startReview,
    studyCardError,
    studyCards,
    studyNoteGroups,
    studyNoteSections,
    studySourceNoteGroups,
    visibleStudyCardOrder,
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
  const reviewCardCount = selectedTopicId
    ? questionCards.length
    : selectedNoteGroupId
      ? questionCards.length
      : moduleStats?.questionCount || 0;
  const reviewMaxCount = Math.max(0, reviewCardCount);
  const reviewDock = (scope) => ({
    dueCount: selectedTopicId || selectedNoteGroupId ? noteGroupStats?.dueCount || 0 : moduleStats?.dueCount || 0,
    count: reviewCount,
    maxCount: reviewMaxCount,
    disabled: !canUseProtectedActions || isReviewing,
    onCountChange: setReviewCount,
    onReviewDue: () => startReview("due", scope),
    onReviewCount: () => startReview("queue", scope)
  });
  const currentPanel = routePanel || (selectedNoteGroupId || selectedTopicId ? "overview" : "");
  const isExplicitDockRoute = Boolean(isViewCardsPage || isInlineStudyPage || isStudyPage || isQuestionPage);
  const isMindMapPage = currentPanel === "mind-map" || (!isExplicitDockRoute && (!currentPanel || currentPanel === "overview"));
  const isMindMapSelected = isMindMapPage;
  const settingsDisabled = !canManageSelectedSubject || !canUseProtectedActions || isReviewOverlayVisible;
  const moduleStudyUnavailable =
    Boolean(moduleStats) &&
    !moduleStatsLoading &&
    !readingAvailable &&
    Number(moduleStats.studyCount || 0) <= 0;
  const moduleMindMapProps = {
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
    drilldownGraph: mindMapDrilldown.sourceKey === "module" ? mindMapDrilldown.graph : null,
    drilldownTitle:
      mindMapDrilldown.sourceKey === "module"
        ? `${mindMapDrilldown.title || "Concept"} Mind Map`
        : "",
    drilldownLoading: mindMapDrilldown.sourceKey === "module" && mindMapDrilldown.loading,
    drilldownError: mindMapDrilldown.sourceKey === "module" ? mindMapDrilldown.error : "",
    onBackFromDrilldown: clearMindMapDrilldown
  };
  const workspaceDock = (() => {
    if (!selectedModuleId || noteGroupMode === "auto" || shouldHoldSelectedNoteGroupContent) {
      return null;
    }
    if (selectedTopicId) {
      return (
        <ScopeInteractionDock
          scopeLabel="Concept"
          actions={[
            {
              id: "mind-map",
              label: "Mind Map",
              active: isMindMapSelected,
              onClick: () => navigate(conceptPath(selectedSubjectCode, selectedModuleCode, selectedTopicCode, "mind-map"))
            },
            {
              id: "view-cards",
              label: "View Cards",
              active: isViewCardsPage,
              onClick: () => navigate(conceptPath(selectedSubjectCode, selectedModuleCode, selectedTopicCode, "view-cards"))
            },
            {
              id: "study",
              label: "Study",
              active: isInlineStudyPage,
              disabled: !readingAvailable,
              disabledReason: "Study content is unavailable",
              onClick: () => navigate(conceptPath(selectedSubjectCode, selectedModuleCode, selectedTopicCode, "study"))
            }
          ]}
          settings={{
            label: "Concept settings",
            onClick: () => setIsConceptSettingsOpen?.(true),
            disabled: settingsDisabled,
            disabledReason: canUseProtectedActions ? "Maintainer access is required to edit Concept settings." : "Sign in to edit Concept settings."
          }}
          studyCardScope={{
            includeDescendants: includeDescendantStudyCards,
            onIncludeDescendantsChange: setIncludeDescendantStudyCards
          }}
          review={reviewDock("topic")}
        />
      );
    }
    if (selectedNoteGroupId) {
      return (
        <ScopeInteractionDock
          scopeLabel="Note Group"
          actions={[
            {
              id: "mind-map",
              label: "Mind Map",
              active: isMindMapSelected,
              onClick: () => navigate(noteGroupMindMapPath(selectedSubjectCode, selectedModuleCode, selectedNoteGroupCode))
            },
            {
              id: "view-cards",
              label: "View Cards",
              active: isViewCardsPage,
              onClick: () => navigate(noteGroupPath(selectedSubjectCode, selectedModuleCode, selectedNoteGroupCode, "view-cards"))
            },
            {
              id: "study",
              label: "Study",
              active: isInlineStudyPage,
              disabled: !readingAvailable,
              disabledReason: "Study content is unavailable",
              onClick: () => navigate(noteGroupPath(selectedSubjectCode, selectedModuleCode, selectedNoteGroupCode, "study"))
            }
          ]}
          settings={{
            label: "Note Group settings",
            onClick: openMetadataModal,
            disabled: settingsDisabled,
            disabledReason: canUseProtectedActions ? "Maintainer access is required to edit Note Group settings." : "Sign in to edit Note Group settings."
          }}
          review={reviewDock("note-group")}
        />
      );
    }
    return (
      <ScopeInteractionDock
        scopeLabel="Module"
        actions={[
          {
          id: "mind-map",
          label: "Mind Map",
          active: isMindMapSelected,
          onClick: () => navigate(moduleMindMapPath(selectedSubjectCode, selectedModuleCode))
          },
          {
            id: "view-cards",
            label: "View Cards",
            active: isViewCardsPage,
            onClick: () => navigate(moduleViewCardsPath(selectedSubjectCode, selectedModuleCode))
          },
          {
            id: "study",
            label: "Study",
            active: isInlineStudyPage,
            disabled: moduleStudyUnavailable,
            disabledReason: "Study content is unavailable",
            onClick: () => navigate(moduleStudyPath(selectedSubjectCode, selectedModuleCode))
        }
      ]}
      settings={{
        label: "Module settings",
        onClick: openModuleMetadataModal,
        disabled: settingsDisabled,
        disabledReason: canUseProtectedActions ? "Maintainer access is required to edit Module settings." : "Sign in to edit Module settings."
      }}
      review={reviewDock("module")}
    />
    );
  })();

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
        sectionNav={workspaceDock || (sectionNavItems.length ? <SectionNav items={sectionNavItems} /> : null)}
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
                  isInlineStudyPage ? (
                    <NoteGroupScopeContent
                      isInlineStudyPage={isInlineStudyPage}
                      selectedNoteGroup={null}
                      selectedNoteGroupId=""
                      selectedModuleId={selectedModuleId}
                      readingAvailable={readingAvailable}
                      activeSourceRangeIndex={activeSourceRangeIndex}
                      effectiveCleanedText={effectiveCleanedText}
                      readingContentRef={readingContentRef}
                      readingHighlights={readingHighlights}
                      readingPinnedCardId={readingPinnedCardId}
                      sourceRangesByCardId={sourceRangesByCardId}
                      pinnedSourceRanges={pinnedSourceRanges}
                      pinnedStudyCard={pinnedStudyCard}
                      studyNoteGroups={studyNoteGroups}
                      studyNoteSections={studyNoteSections}
                      studySourceNoteGroups={studySourceNoteGroups}
                      visibleStudyCardOrder={visibleStudyCardOrder}
                      classes={{
                        panel: panelClass,
                        mutedText: mutedTextClass,
                        primaryButton: primaryButtonClass,
                        outlineButton: outlineButtonClass,
                        smallOutlineButton: smallOutlineButtonClass,
                        destructiveOutlineButton: destructiveOutlineButtonClass,
                        buttonRow: buttonRowClass
                      }}
                      setReadingMode={setReadingMode}
                      handleReadingModeChange={handleReadingModeChange}
                      handleReadingNextStudyCard={handleReadingNextStudyCard}
                      handleReadingPreviousStudyCard={handleReadingPreviousStudyCard}
                      handleReadingSourceRangeNext={handleReadingSourceRangeNext}
                      handleReadingSourceRangePrevious={handleReadingSourceRangePrevious}
                      handleReadingUnpin={handleReadingUnpin}
                      handleReadingViewInClean={handleReadingViewInClean}
                    />
                  ) : isViewCardsPage ? (
                    <>
                      <section className="flex flex-wrap items-start gap-3">
                        <div>
                          <h2>View Cards</h2>
                          <p className={mutedTextClass}>Study Cards with their linked Question Cards across this Module.</p>
                        </div>
                      </section>
                      <NoteGroupViewCards
                        rows={moduleCardTable?.rows || []}
                        studyCards={[]}
                        questionCards={[]}
                        topicChips={topicChips}
                        canEdit={canEditCurrentCards}
                        showEditControls={canUseProtectedActions}
                        editingStudyCardId={editingStudyCardId}
                        editingStudyCard={editingStudyCard}
                        editingQuestionCardId={editingQuestionCardId}
                        editingQuestionCard={editingQuestionCard}
                        unlinkedQuestionCount={moduleCardTable?.unlinked_question_count || 0}
                        loading={moduleCardTableLoading}
                        error={moduleCardTableError}
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
                  ) : (
                    <ModuleMindMapPage {...moduleMindMapProps} />
                  )
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
                    isMindMapPage={isMindMapPage}
                    isInlineStudyPage={isInlineStudyPage}
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
                    readingMode={readingMode}
                    activeSourceRangeIndex={activeSourceRangeIndex}
                    includeDescendantStudyCards={includeDescendantStudyCards}
                    effectiveCleanedText={effectiveCleanedText}
                    readingContentRef={readingContentRef}
                    readingHighlights={readingHighlights}
                    readingPinnedCardId={readingPinnedCardId}
                    sourceRangesByCardId={sourceRangesByCardId}
                    pinnedSourceRanges={pinnedSourceRanges}
                    pinnedStudyCard={pinnedStudyCard}
                    studyNoteGroups={studyNoteGroups}
                    studyNoteSections={studyNoteSections}
                    studySourceNoteGroups={studySourceNoteGroups}
                    visibleStudyCardOrder={visibleStudyCardOrder}
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
                    setReadingMode={setReadingMode}
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
                    handleReadingModeChange={handleReadingModeChange}
                    handleReadingNextStudyCard={handleReadingNextStudyCard}
                    handleReadingPreviousStudyCard={handleReadingPreviousStudyCard}
                    handleReadingSourceRangeNext={handleReadingSourceRangeNext}
                    handleReadingSourceRangePrevious={handleReadingSourceRangePrevious}
                    handleReadingUnpin={handleReadingUnpin}
                    handleReadingViewInClean={handleReadingViewInClean}
                  />
                )}
              </>
            )}
        </>
      </AppShell>
    </>
  );
}
