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
import { appShellClasses, generationWorkflowStageLabel, generationWorkflowStatusLabel, generationWorkflowTitle } from "@/features/app-shell/appShellUi";
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
  errorText: errorTextClass
} = appShellClasses;

export function StudyAppReviewOverlay({ model }) {
  const {
    cancelReviewDelete,
    confirmReviewDelete,
    currentReviewCard,
    endReview,
    formatDueAt,
    handleBackToReviewChat,
    handleReviewChatKeyDown,
    handleSendReviewChat,
    isReviewOverlayVisible,
    nextReviewCard,
    openReviewStudyCard,
    requestReviewDelete,
    resolveNoteGroupLabel,
    reviewAnswer,
    reviewCardRefs,
    reviewCardType,
    reviewChatCardCache,
    reviewChatCardError,
    reviewChatCardId,
    reviewChatCardLoading,
    reviewChatError,
    reviewChatInput,
    reviewChatListRef,
    reviewChatLoading,
    reviewChatMessages,
    reviewChatView,
    reviewDeleteLoading,
    reviewDeleteStep,
    reviewError,
    reviewExplanationOpen,
    reviewFeedback,
    reviewIndex,
    reviewMode,
    reviewNoteGroupId,
    reviewQueue,
    reviewRefsMessage,
    reviewScope,
    reviewSummary,
    setReviewChatInput,
    setReviewSummary,
    submitReviewAnswer,
    toggleReviewAnswer
  } = model;

  return (
    <>
<ReviewDialog
        open={isReviewOverlayVisible}
        card={currentReviewCard}
        summary={reviewSummary}
        error={reviewError}
        onOpenChange={(open) => {
          if (!open) {
            endReview();
          }
        }}
      >
          <div
            className={`review-layout ${
              reviewFeedback && currentReviewCard ? "has-review-chat" : ""
            }`}
          >
            <div className="review-modal">
              {reviewSummary ? (
                <>
                  <h2>Review summary</h2>
                  <div className="review-meta">
                    <span className={badgeClass}>
                      Scope: {reviewSummary.scope === "module" ? "Module" : "Note group"}
                    </span>
                    <span className={badgeClass}>Mode: {reviewSummary.mode}</span>
                    <span className={badgeClass}>
                      Reviewed: {reviewSummary.answered} / {reviewSummary.total}
                    </span>
                    <span className={badgeClass}>Accuracy: {reviewSummary.accuracy}%</span>
                    <span className={badgeClass}>Avg time: {reviewSummary.avgSeconds}s</span>
                    {reviewSummary.remaining ? (
                      <span className={badgeClass}>Remaining: {reviewSummary.remaining}</span>
                    ) : null}
                  </div>
                  <p className={mutedTextClass}>
                    Correct: {reviewSummary.correct} · Incorrect: {reviewSummary.incorrect}
                  </p>
                  <div className={buttonRowClass}>
                    <button
                      className={primaryButtonClass}
                      type="button"
                      onClick={() => setReviewSummary(null)}
                    >
                      Close summary
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="review-meta">
                    <span className={badgeClass}>
                      Scope: {reviewScope === "module" ? "Module" : "Note group"}
                    </span>
                    <span className={badgeClass}>
                      Card {reviewIndex + 1} / {reviewQueue.length}
                    </span>
                    <span className={badgeClass}>Mode: {reviewMode}</span>
                    {reviewScope === "module" && currentReviewCard ? (
                      <span className={badgeClass}>
                        Note group: {resolveNoteGroupLabel(currentReviewCard.note_group_id)}
                      </span>
                    ) : null}
                    {currentReviewCard ? (
                      <span className={badgeClass}>Due: {formatDueAt(currentReviewCard.due_at)}</span>
                    ) : null}
                  </div>
                  {reviewError ? <p className={errorTextClass}>{reviewError}</p> : null}
                  {currentReviewCard ? (
                    <>
                      <h3>{currentReviewCard.prompt}</h3>
                      <p className={mutedTextClass}>
                        {reviewCardType === "multi"
                          ? "Select all that apply."
                          : "Select the best answer."}
                      </p>
                      <div className="review-options">
                        {(currentReviewCard.reviewChoices ||
                          (currentReviewCard.reviewOptions ||
                            currentReviewCard.options ||
                            []).map((option, index) => {
                            const fallbackExplanations =
                              currentReviewCard.reviewOptionExplanations ||
                              currentReviewCard.option_explanations ||
                              [];
                            return {
                              text: option,
                              explanation: fallbackExplanations[index] || "",
                              originalIndex: index
                            };
                          })).map((choice, optionIndex) => {
                          const explanation = choice.explanation || "";
                          const isSelected = reviewAnswer.includes(optionIndex);
                          const isCorrect = reviewFeedback?.correctIndices?.includes(optionIndex);
                          const showIncorrect =
                            reviewFeedback && isSelected && !isCorrect;
                          const showMissed =
                            reviewFeedback &&
                            reviewCardType === "multi" &&
                            isCorrect &&
                            !isSelected;
                          const showCorrect = isCorrect && !showMissed;
                          const isExplanationOpen =
                            reviewFeedback && reviewExplanationOpen.includes(optionIndex);
                          return (
                            <div key={`${currentReviewCard.id}-${optionIndex}`} className="review-option-item">
                              <button
                                type="button"
                                className={`review-option ${
                                  isSelected ? "selected" : ""
                                } ${showCorrect ? "correct" : ""} ${
                                  showIncorrect ? "incorrect" : ""
                                } ${showMissed ? "missed" : ""}`}
                                onClick={() =>
                                  reviewFeedback
                                    ? null
                                    : toggleReviewAnswer(optionIndex, reviewCardType)
                                }
                                disabled={Boolean(reviewFeedback)}
                              >
                                <span className="option-control">
                                  {reviewCardType === "multi" ? (
                                    <span className={`option-box ${isSelected ? "checked" : ""}`}>
                                      {isSelected ? "✓" : ""}
                                    </span>
                                  ) : (
                                    <span className={`option-radio ${isSelected ? "checked" : ""}`}>
                                      <span className="option-radio-dot" />
                                    </span>
                                  )}
                                </span>
                                <span className="option-text">{choice.text}</span>
                              </button>
                              {reviewFeedback && explanation ? (
                                <div
                                  className={`review-explanation-bubble${
                                    isExplanationOpen ? " open" : ""
                                  }`}
                                >
                                  {explanation}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      <div className={buttonRowClass}>
                        <button
                          className={primaryButtonClass}
                          type="button"
                          onClick={() => submitReviewAnswer(currentReviewCard)}
                          disabled={!reviewAnswer.length || Boolean(reviewFeedback)}
                        >
                          Submit answer
                        </button>
                        <button
                          className={outlineButtonClass}
                          type="button"
                          onClick={nextReviewCard}
                          disabled={!reviewFeedback}
                        >
                          {reviewIndex + 1 >= reviewQueue.length ? "Finish review" : "Next question"}
                        </button>
                        <button className={outlineButtonClass} type="button" onClick={endReview}>
                          End review
                        </button>
                        <button
                          className={destructiveOutlineButtonClass}
                          type="button"
                          onClick={requestReviewDelete}
                          disabled={reviewDeleteLoading || reviewDeleteStep === 1}
                        >
                          Delete card
                        </button>
                      </div>
                      {reviewDeleteStep === 1 ? (
                        <div className="review-delete-confirm">
                          <p>Delete this question card? This cannot be undone.</p>
                          <div className={buttonRowClass}>
                            <button
                              className={outlineButtonClass}
                              type="button"
                              onClick={cancelReviewDelete}
                              disabled={reviewDeleteLoading}
                            >
                              Keep card
                            </button>
                            <button
                              className={destructiveOutlineButtonClass}
                              type="button"
                              onClick={confirmReviewDelete}
                              disabled={reviewDeleteLoading}
                            >
                              {reviewDeleteLoading ? "Deleting..." : "Delete permanently"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className={mutedTextClass}>No review card loaded.</p>
                  )}
                </>
              )}
            </div>
            {reviewFeedback && currentReviewCard ? (
              <div className="review-chat-panel">
                {reviewChatView === "card" ? (
                  <>
                    <div className="review-chat-header">
                      <button
                        className="back-button"
                        type="button"
                        onClick={handleBackToReviewChat}
                      >
                        ← Back to chat
                      </button>
                      <p className={mutedTextClass}>
                        {reviewNoteGroupId
                          ? `Scoped to ${resolveNoteGroupLabel(reviewNoteGroupId)}.`
                          : "Scoped to current note group."}
                      </p>
                    </div>
                    {reviewChatCardLoading ? (
                      <p className={mutedTextClass}>Loading study card...</p>
                    ) : null}
                    {reviewChatCardError ? <p className={errorTextClass}>{reviewChatCardError}</p> : null}
                    {reviewChatCardId && reviewChatCardCache[reviewChatCardId] ? (
                      <div className="review-chat-card">
                        <h3>
                          {reviewChatCardCache[reviewChatCardId].title ||
                            "Untitled study card"}
                        </h3>
                        <p>{reviewChatCardCache[reviewChatCardId].content}</p>
                        {reviewChatCardCache[reviewChatCardId].topic_chips?.length ? (
                          <div className="chip-grid">
                            {reviewChatCardCache[reviewChatCardId].topic_chips.map((chip) => (
                              <span key={chip.id} className={`${badgeClass} topic-chip`}>
                                {chip.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="review-chat-header">
                      <h3>Clarify this question</h3>
                      <p className={mutedTextClass}>
                        Scoped to {resolveNoteGroupLabel(reviewNoteGroupId)}.
                      </p>
                    </div>
                    <div className="chat" ref={reviewChatListRef}>
                      {currentReviewCard ? (
                        <div className="chat-bubble assistant">
                          <p>{reviewRefsMessage}</p>
                          {reviewCardRefs.length ? (
                            <ol className="chat-refs">
                              {reviewCardRefs.map((refId) => {
                                const refCard = reviewChatCardCache[refId];
                                const title =
                                  refCard?.title || `Study card ${refId.slice(0, 8)}`;
                                return (
                                  <li key={refId}>
                                    <button
                                      className="link-button"
                                      type="button"
                                      onClick={() => openReviewStudyCard(refId)}
                                    >
                                      {title}
                                    </button>
                                  </li>
                                );
                              })}
                            </ol>
                          ) : null}
                        </div>
                      ) : null}
                      {reviewChatMessages.length === 0 ? (
                        <p className="empty">Ask for clarity about the question or its sources.</p>
                      ) : (
                        reviewChatMessages.map((message, index) => (
                          <div
                            key={`${message.role}-${index}`}
                            className={`chat-bubble ${message.role}`}
                          >
                            <p>{message.content}</p>
                            {message.refs && message.refs.length ? (
                              <ol className="chat-refs">
                                {message.refs.map((refId) => {
                                  const refCard = reviewChatCardCache[refId];
                                  const title =
                                    refCard?.title ||
                                    `Study card ${refId.slice(0, 8)}`;
                                  return (
                                    <li key={refId}>
                                      <button
                                        className="link-button"
                                        type="button"
                                        onClick={() => openReviewStudyCard(refId)}
                                      >
                                        {title}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ol>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                    {reviewChatError ? <p className={errorTextClass}>{reviewChatError}</p> : null}
                    <div className="chat-input">
                      <textarea
                        value={reviewChatInput}
                        onChange={(event) => setReviewChatInput(event.target.value)}
                        onKeyDown={handleReviewChatKeyDown}
                        placeholder="Ask about this question..."
                        rows={2}
                        disabled={!reviewNoteGroupId}
                      />
                      <button
                        className={primaryButtonClass}
                        type="button"
                        onClick={handleSendReviewChat}
                        disabled={!reviewNoteGroupId || !reviewChatInput.trim() || reviewChatLoading}
                      >
                        {reviewChatLoading ? "Sending..." : "Send"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
      </ReviewDialog>
    </>
  );
}
