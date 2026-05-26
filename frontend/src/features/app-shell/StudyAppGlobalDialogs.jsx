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
  destructiveOutlineButton: destructiveOutlineButtonClass,
  buttonRow: buttonRowClass,
  badge: badgeClass,
  mutedText: mutedTextClass,
  smallMutedText: smallMutedTextClass,
  errorText: errorTextClass
} = appShellClasses;

export function StudyAppGlobalDialogs({ model }) {
  const {
    canManageSelectedSubject,
    chipOptions,
    closeQuestionFocus,
    editingSubjectId,
    focusCardType,
    focusMasteryScore,
    focusMasteryTier,
    focusQuestionCard,
    formatDueAt,
    formatReviewAt,
    handleCreateModuleFromWizard,
    handleCreateQuestionCard,
    handleCreateStudyCard,
    handleCreateSubjectFromWizard,
    handleModuleWizardSend,
    handleSaveMetadataTitle,
    handleSaveModuleMetadata,
    handleSaveSubjectMetadata,
    handleSubjectWizardSend,
    isMetadataOpen,
    isModuleMetadataOpen,
    isModuleWizardOpen,
    isQuestionCreateOpen,
    isQuestionFocusOpen,
    isStudyCreateOpen,
    isSubjectMetadataOpen,
    isSubjectWizardOpen,
    metadataError,
    metadataSaving,
    metadataTitleDraft,
    moduleAdditionalInstructionsDraft,
    moduleDescriptionDraft,
    moduleGoalDraft,
    moduleMetadataError,
    moduleMetadataSaving,
    moduleScopeDraft,
    moduleTitleDraft,
    moduleWizardCreating,
    moduleWizardError,
    moduleWizardGoal,
    moduleWizardInput,
    moduleWizardLoading,
    moduleWizardMessages,
    moduleWizardScope,
    moduleWizardTitle,
    newQuestionCorrectIndices,
    newQuestionOptions,
    newQuestionPrompt,
    newQuestionRefs,
    newQuestionType,
    newStudyCardChipIds,
    newStudyCardContent,
    newStudyCardTitle,
    questionCardError,
    selectedNoteGroupId,
    selectedSubject,
    selectedSubjectId,
    setIsMetadataOpen,
    setIsModuleMetadataOpen,
    setIsModuleWizardOpen,
    setIsQuestionCreateOpen,
    setIsStudyCreateOpen,
    setIsSubjectMetadataOpen,
    setIsSubjectWizardOpen,
    setMetadataTitleDraft,
    setModuleAdditionalInstructionsDraft,
    setModuleDescriptionDraft,
    setModuleGoalDraft,
    setModuleScopeDraft,
    setModuleTitleDraft,
    setModuleWizardGoal,
    setModuleWizardInput,
    setModuleWizardScope,
    setModuleWizardTitle,
    setNewQuestionCorrectIndices,
    setNewQuestionOptions,
    setNewQuestionPrompt,
    setNewQuestionRefs,
    setNewQuestionType,
    setNewStudyCardChipIds,
    setNewStudyCardContent,
    setNewStudyCardTitle,
    setSubjectGoalDraft,
    setSubjectScopeDraft,
    setSubjectTitleDraft,
    setSubjectWizardGoal,
    setSubjectWizardInput,
    setSubjectWizardScope,
    setSubjectWizardTitle,
    studyCardError,
    studyCards,
    subjectGoalDraft,
    subjectMetadataError,
    subjectMetadataSaving,
    subjectScopeDraft,
    subjectTitleDraft,
    subjectWizardCreating,
    subjectWizardError,
    subjectWizardGoal,
    subjectWizardInput,
    subjectWizardLoading,
    subjectWizardMessages,
    subjectWizardScope,
    subjectWizardTitle,
    wizardChatRef
  } = model;

  return (
    <>
{isQuestionFocusOpen && focusQuestionCard ? (
        <LegacyDialog
          open={isQuestionFocusOpen && Boolean(focusQuestionCard)}
          onOpenChange={(open) => {
            if (!open) {
              closeQuestionFocus();
            }
          }}
          title="Question focus"
        >
          <div className="focus-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Question focus</h2>
                <p className={mutedTextClass}>Mastery and scheduling details for this card.</p>
              </div>
              <button className={outlineButtonClass} type="button" onClick={closeQuestionFocus}>
                Close
              </button>
            </div>
            <p className={mutedTextClass}>
              {focusCardType.toUpperCase()} · {focusQuestionCard.id.slice(0, 8)}
            </p>
            <div className="stats-grid">
              <div className="stat-card">
                <p className="label">Mastery</p>
                <p className={`value mastery-value ${focusMasteryTier}`}>
                  {focusMasteryScore !== null ? focusMasteryScore.toFixed(1) : "—"}
                </p>
              </div>
              <div className="stat-card">
                <p className="label">Reps</p>
                <p className="value">{focusQuestionCard.reps ?? 0}</p>
              </div>
              <div className="stat-card">
                <p className="label">Last review</p>
                <p className="value">{formatReviewAt(focusQuestionCard.last_review_at)}</p>
              </div>
              <div className="stat-card">
                <p className="label">Due</p>
                <p className="value">{formatDueAt(focusQuestionCard.due_at)}</p>
              </div>
            </div>
            <div className="focus-question">
              <p>{focusQuestionCard.prompt}</p>
              <ul className="options">
                {focusQuestionCard.options.map((option, optionIndex) => {
                  const isCorrect =
                    focusQuestionCard.correct_option_indices.includes(optionIndex);
                  return (
                    <li key={`${focusQuestionCard.id}-${optionIndex}`} className={isCorrect ? "correct" : ""}>
                      {option}
                    </li>
                  );
                })}
              </ul>
              <p className="refs">
                Refs:{" "}
                {focusQuestionCard.study_card_refs?.length
                  ? focusQuestionCard.study_card_refs.join(", ")
                  : "—"}
              </p>
            </div>
          </div>
        </LegacyDialog>
      ) : null}
{isStudyCreateOpen ? (
        <LegacyDialog
          open={isStudyCreateOpen}
          onOpenChange={setIsStudyCreateOpen}
          title="Create study card"
        >
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Create study card</h2>
                <p className={mutedTextClass}>Add a custom study card to this note group.</p>
              </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsStudyCreateOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="form-block">
              <input
                type="text"
                value={newStudyCardTitle}
                onChange={(event) => setNewStudyCardTitle(event.target.value)}
                placeholder="New study card title"
                disabled={!canManageSelectedSubject || !selectedNoteGroupId}
              />
              <textarea
                value={newStudyCardContent}
                onChange={(event) => setNewStudyCardContent(event.target.value)}
                placeholder="New study card content"
                rows={4}
                disabled={!canManageSelectedSubject || !selectedNoteGroupId}
              />
              {chipOptions.length > 0 ? (
                <Select
                  className="select"
                  classNamePrefix="select"
                  options={chipOptions}
                  value={chipOptions.filter((opt) => newStudyCardChipIds.includes(opt.value))}
                  onChange={(selected) =>
                    setNewStudyCardChipIds((selected || []).map((opt) => opt.value))
                  }
                  placeholder="Assign concepts"
                  isMulti
                  isClearable
                  maxMenuHeight={200}
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
              ) : null}
              <div className={buttonRowClass}>
                <button
                  className={primaryButtonClass}
                  type="button"
                  onClick={handleCreateStudyCard}
                  disabled={!canManageSelectedSubject || !selectedNoteGroupId || !newStudyCardContent.trim()}
                >
                  Add study card
                </button>
                <button
                  className={outlineButtonClass}
                  type="button"
                  onClick={() => setIsStudyCreateOpen(false)}
                >
                  Cancel
                </button>
              </div>
              {studyCardError ? <p className={errorTextClass}>{studyCardError}</p> : null}
            </div>
          </div>
        </LegacyDialog>
      ) : null}
{isQuestionCreateOpen ? (
        <LegacyDialog
          open={isQuestionCreateOpen}
          onOpenChange={setIsQuestionCreateOpen}
          title="Create question card"
        >
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Create question card</h2>
                <p className={mutedTextClass}>Build a custom question for this note group.</p>
              </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsQuestionCreateOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="form-block">
              <select
                value={newQuestionType}
                onChange={(event) => setNewQuestionType(event.target.value)}
              >
                <option value="mcq">MCQ</option>
                <option value="multi">Multi-answer</option>
              </select>
              <textarea
                value={newQuestionPrompt}
                onChange={(event) => setNewQuestionPrompt(event.target.value)}
                placeholder="Question prompt"
                rows={3}
              />
              <textarea
                value={newQuestionOptions}
                onChange={(event) => setNewQuestionOptions(event.target.value)}
                placeholder="Options (one per line)"
                rows={4}
              />
              <input
                type="text"
                value={newQuestionCorrectIndices}
                onChange={(event) => setNewQuestionCorrectIndices(event.target.value)}
                placeholder="Correct option indices (comma-separated)"
              />
              <div className="chip-grid">
                {studyCards.map((card) => (
                  <label key={card.id} className="chip-toggle">
                    <input
                      type="checkbox"
                      checked={newQuestionRefs.includes(card.id)}
                      onChange={() =>
                        setNewQuestionRefs((prev) =>
                          prev.includes(card.id)
                            ? prev.filter((id) => id !== card.id)
                            : [...prev, card.id]
                        )
                      }
                    />
                    {card.title || card.id.slice(0, 6)}
                  </label>
                ))}
              </div>
              <div className={buttonRowClass}>
                <button
                  className={primaryButtonClass}
                  type="button"
                  onClick={handleCreateQuestionCard}
                  disabled={!canManageSelectedSubject || !selectedNoteGroupId || !newQuestionPrompt.trim()}
                >
                  Add question card
                </button>
                <button
                  className={outlineButtonClass}
                  type="button"
                  onClick={() => setIsQuestionCreateOpen(false)}
                >
                  Cancel
                </button>
              </div>
              {questionCardError ? <p className={errorTextClass}>{questionCardError}</p> : null}
            </div>
          </div>
        </LegacyDialog>
      ) : null}
{isSubjectWizardOpen ? (
        <LegacyDialog
          open={isSubjectWizardOpen}
          onOpenChange={setIsSubjectWizardOpen}
          title="Create subject"
          wide
        >
          <div className="intent-wizard">
            <div className="intent-wizard-header">
              <div>
                <h2>Create subject</h2>
                <p className={mutedTextClass}>
                  Describe what you want to study — the AI will suggest a title, goal, and scope.
                </p>
              </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsSubjectWizardOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="intent-wizard-body">
              <div className="intent-wizard-chat">
                <div className="chat">
                  {subjectWizardMessages.length === 0 ? (
                    <p className={smallMutedTextClass}>
                      Tell me what subject you want to study and why. I&apos;ll fill in the fields on the right.
                    </p>
                  ) : (
                    subjectWizardMessages.map((msg, idx) => (
                      <div key={idx} className={`chat-bubble ${msg.role}`}>
                        <p>{msg.content}</p>
                      </div>
                    ))
                  )}
                  {subjectWizardLoading ? (
                    <div className="chat-bubble assistant">
                      <p>Thinking...</p>
                    </div>
                  ) : null}
                </div>
                <div className="chat-input">
                  <textarea
                    value={subjectWizardInput}
                    onChange={(e) => setSubjectWizardInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubjectWizardSend();
                      }
                    }}
                    placeholder="Describe your learning intent..."
                    rows={2}
                    disabled={subjectWizardLoading}
                  />
                  <button
                    className={primaryButtonClass}
                    type="button"
                    onClick={handleSubjectWizardSend}
                    disabled={subjectWizardLoading || !subjectWizardInput.trim()}
                  >
                    Send
                  </button>
                </div>
              </div>
              <div className="intent-wizard-fields">
                <div className="field">
                  <label>Title</label>
                  <input
                    type="text"
                    value={subjectWizardTitle}
                    onChange={(e) => setSubjectWizardTitle(e.target.value)}
                    placeholder="Subject title"
                  />
                </div>
                <div className="field">
                  <label>Goal</label>
                  <textarea
                    value={subjectWizardGoal}
                    onChange={(e) => setSubjectWizardGoal(e.target.value)}
                    placeholder="What does success look like?"
                    rows={3}
                  />
                </div>
                <div className="field">
                  <label>Scope</label>
                  <textarea
                    value={subjectWizardScope}
                    onChange={(e) => setSubjectWizardScope(e.target.value)}
                    placeholder="Concepts and boundaries of study"
                    rows={3}
                  />
                </div>
                {subjectWizardError ? (
                  <p className={errorTextClass}>{subjectWizardError}</p>
                ) : null}
                <button
                  className={primaryButtonClass}
                  type="button"
                  onClick={handleCreateSubjectFromWizard}
                  disabled={!subjectWizardTitle.trim() || subjectWizardCreating}
                >
                  {subjectWizardCreating ? "Creating..." : "Create subject"}
                </button>
              </div>
            </div>
          </div>
        </LegacyDialog>
      ) : null}
{isModuleWizardOpen ? (
        <LegacyDialog
          open={isModuleWizardOpen}
          onOpenChange={setIsModuleWizardOpen}
          title="Create module"
          wide
        >
          <div className="intent-wizard">
            <div className="intent-wizard-header">
              <div>
                <h2>Create module</h2>
                <p className={mutedTextClass}>
                  Describe what you want to study — the AI will suggest a title, goal, and scope.
                </p>
              </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsModuleWizardOpen(false)}
              >
                Close
              </button>
            </div>
            {selectedSubject ? (
              <div className="wizard-context-banner">
                <span className={smallMutedTextClass}>
                  Subject: <strong>{selectedSubject.title}</strong>
                  {selectedSubject.goal ? ` — ${selectedSubject.goal}` : ""}
                </span>
              </div>
            ) : null}
            <div className="intent-wizard-body">
              <div className="intent-wizard-chat">
                <div className="chat" ref={wizardChatRef}>
                  {moduleWizardMessages.length === 0 ? (
                    <p className={smallMutedTextClass}>
                      Tell me what you want to learn and why. I&apos;ll fill in the fields on the right.
                    </p>
                  ) : (
                    moduleWizardMessages.map((msg, idx) => (
                      <div key={idx} className={`chat-bubble ${msg.role}`}>
                        <p>{msg.content}</p>
                      </div>
                    ))
                  )}
                  {moduleWizardLoading ? (
                    <div className="chat-bubble assistant">
                      <p>Thinking...</p>
                    </div>
                  ) : null}
                </div>
                <div className="chat-input">
                  <textarea
                    value={moduleWizardInput}
                    onChange={(e) => setModuleWizardInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleModuleWizardSend();
                      }
                    }}
                    placeholder="Describe your learning intent..."
                    rows={2}
                    disabled={moduleWizardLoading}
                  />
                  <button
                    className={primaryButtonClass}
                    type="button"
                    onClick={handleModuleWizardSend}
                    disabled={moduleWizardLoading || !moduleWizardInput.trim()}
                  >
                    Send
                  </button>
                </div>
              </div>
              <div className="intent-wizard-fields">
                <div className="field">
                  <label>Title</label>
                  <input
                    type="text"
                    value={moduleWizardTitle}
                    onChange={(e) => setModuleWizardTitle(e.target.value)}
                    placeholder="Module title"
                  />
                </div>
                <div className="field">
                  <label>Goal</label>
                  <textarea
                    value={moduleWizardGoal}
                    onChange={(e) => setModuleWizardGoal(e.target.value)}
                    placeholder="What does success look like?"
                    rows={3}
                  />
                </div>
                <div className="field">
                  <label>Scope</label>
                  <textarea
                    value={moduleWizardScope}
                    onChange={(e) => setModuleWizardScope(e.target.value)}
                    placeholder="Concepts and boundaries of study"
                    rows={3}
                  />
                </div>
                {moduleWizardError ? (
                  <p className={errorTextClass}>{moduleWizardError}</p>
                ) : null}
                <button
                  className={primaryButtonClass}
                  type="button"
                  onClick={handleCreateModuleFromWizard}
                  disabled={!moduleWizardTitle.trim() || moduleWizardCreating || !selectedSubjectId}
                >
                  {moduleWizardCreating ? "Creating..." : "Create module"}
                </button>
              </div>
            </div>
          </div>
        </LegacyDialog>
      ) : null}
{isSubjectMetadataOpen ? (
        <LegacyDialog
          open={isSubjectMetadataOpen}
          onOpenChange={setIsSubjectMetadataOpen}
          title="Subject settings"
        >
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Subject settings</h2>
                <p className={mutedTextClass}>Manage subject details.</p>
              </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsSubjectMetadataOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="field">
              <label htmlFor="subject-title">Subject title</label>
              <input
                id="subject-title"
                type="text"
                value={subjectTitleDraft}
                onChange={(event) => setSubjectTitleDraft(event.target.value)}
                placeholder="Enter a subject title"
              />
            </div>
            <div className="field">
              <label htmlFor="subject-goal">Learning goal</label>
              <textarea
                id="subject-goal"
                value={subjectGoalDraft}
                onChange={(event) => setSubjectGoalDraft(event.target.value)}
                placeholder="What does success look like for this subject?"
                rows={3}
              />
            </div>
            <div className="field">
              <label htmlFor="subject-scope">Scope</label>
              <textarea
                id="subject-scope"
                value={subjectScopeDraft}
                onChange={(event) => setSubjectScopeDraft(event.target.value)}
                placeholder="Concepts and boundaries of study"
                rows={3}
              />
            </div>
            <div className={buttonRowClass}>
              <button
                className={primaryButtonClass}
                type="button"
                onClick={() => handleSaveSubjectMetadata(editingSubjectId)}
                disabled={subjectMetadataSaving || !subjectTitleDraft.trim()}
              >
                {subjectMetadataSaving ? "Saving..." : "Save settings"}
              </button>
            </div>
            {subjectMetadataError ? <p className={errorTextClass}>{subjectMetadataError}</p> : null}
          </div>
        </LegacyDialog>
      ) : null}
{isModuleMetadataOpen ? (
        <LegacyDialog
          open={isModuleMetadataOpen}
          onOpenChange={setIsModuleMetadataOpen}
          title="Module settings"
        >
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Module settings</h2>
                <p className={mutedTextClass}>Manage module details and defaults.</p>
              </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsModuleMetadataOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="field">
              <label htmlFor="module-title">Module title</label>
              <input
                id="module-title"
                type="text"
                value={moduleTitleDraft}
                onChange={(event) => setModuleTitleDraft(event.target.value)}
                placeholder="Enter a module title"
              />
            </div>
            <div className="field">
              <label htmlFor="module-description">Module description</label>
              <input
                id="module-description"
                type="text"
                value={moduleDescriptionDraft}
                onChange={(event) => setModuleDescriptionDraft(event.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="field">
              <label htmlFor="module-additional-instructions">
                Default additional generation instructions
              </label>
              <textarea
                id="module-additional-instructions"
                value={moduleAdditionalInstructionsDraft}
                onChange={(event) => setModuleAdditionalInstructionsDraft(event.target.value)}
                placeholder="Optional guidance for study and question generation"
                rows={4}
              />
              <p className={mutedTextClass}>
                Word count: {countWords(moduleAdditionalInstructionsDraft)}/500
              </p>
            </div>
            <div className="field">
              <label htmlFor="module-goal">Learning goal</label>
              <textarea
                id="module-goal"
                value={moduleGoalDraft}
                onChange={(event) => setModuleGoalDraft(event.target.value)}
                placeholder="What does success look like for this module?"
                rows={3}
              />
            </div>
            <div className="field">
              <label htmlFor="module-scope">Scope</label>
              <textarea
                id="module-scope"
                value={moduleScopeDraft}
                onChange={(event) => setModuleScopeDraft(event.target.value)}
                placeholder="Concepts and boundaries of study"
                rows={3}
              />
            </div>
            <div className={buttonRowClass}>
              <button
                className={primaryButtonClass}
                type="button"
                onClick={handleSaveModuleMetadata}
                disabled={moduleMetadataSaving || !moduleTitleDraft.trim()}
              >
                {moduleMetadataSaving ? "Saving..." : "Save settings"}
              </button>
            </div>
            {moduleMetadataError ? <p className={errorTextClass}>{moduleMetadataError}</p> : null}
          </div>
        </LegacyDialog>
      ) : null}
{isMetadataOpen ? (
        <LegacyDialog
          open={isMetadataOpen}
          onOpenChange={setIsMetadataOpen}
          title="Edit note group metadata"
        >
          <div className="meta-modal">
            <div className="meta-modal-header">
              <div>
                <h2>Edit note group metadata</h2>
                <p className={mutedTextClass}>
                  Update the title for this note group.
                </p>
              </div>
              <button className={outlineButtonClass} type="button" onClick={() => setIsMetadataOpen(false)}>
                Close
              </button>
            </div>
            <div className="field">
              <label htmlFor="note-group-title">Note group title</label>
              <input
                id="note-group-title"
                type="text"
                value={metadataTitleDraft}
                onChange={(event) => setMetadataTitleDraft(event.target.value)}
                placeholder="Enter a descriptive title"
              />
            </div>
            <div className={buttonRowClass}>
              <button
                className={primaryButtonClass}
                type="button"
                onClick={handleSaveMetadataTitle}
                disabled={metadataSaving || !metadataTitleDraft.trim()}
              >
                {metadataSaving ? "Saving..." : "Save title"}
              </button>
            </div>
            {metadataError ? <p className={errorTextClass}>{metadataError}</p> : null}
          </div>
        </LegacyDialog>
      ) : null}
    </>
  );
}
