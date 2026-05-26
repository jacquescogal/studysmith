import React from "react";

import { useTutorChat } from "@/features/chat/useTutorChat";
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

export function StudyAppTutorChatOverlay({ model }) {
  const {
    canUseProtectedActions,
    isChatOpen,
    resolveNoteGroupLabel,
    selectedModuleId,
    selectedNoteGroupId,
    selectedTopicId,
    setIsChatOpen
  } = model;
  const {
    messages: chatMessages,
    input: chatInput,
    setInput: setChatInput,
    error: chatError,
    loading: chatLoading,
    view: chatView,
    cardId: chatCardId,
    cardCache: chatCardCache,
    cardLoading: chatCardLoading,
    cardError: chatCardError,
    listRef: chatListRef,
    sendMessage: handleSendChat,
    openStudyCard: openChatStudyCard,
    backToChat: handleBackToChat,
    handleKeyDown: handleChatKeyDown
  } = useTutorChat({
    moduleId: selectedModuleId,
    noteGroupId: selectedNoteGroupId,
    conceptId: selectedTopicId,
    isOpen: isChatOpen
  });

  return (
    <>
<TutorChatDialog open={isChatOpen} onOpenChange={setIsChatOpen}>
          <div className="chat-modal">
            <div className="chat-modal-header">
              <div>
                <h2>Chat with your notes</h2>
                <p className={mutedTextClass}>
                  {selectedNoteGroupId
                    ? "Ask about the current Note Group."
                    : "Ask about this module and its note groups."}
                </p>
              </div>
              <button className={outlineButtonClass} type="button" onClick={() => setIsChatOpen(false)}>
                Close
              </button>
            </div>
            {selectedNoteGroupId ? (
              <div className="results-meta">
                <span className={`${badgeClass} chat-scope-badge`}>
                  Scoped to current Note Group: {resolveNoteGroupLabel(selectedNoteGroupId)}
                </span>
              </div>
            ) : null}
            {chatView === "card" ? (
              <>
                <div className="review-chat-header">
                  <button className="back-button" type="button" onClick={handleBackToChat}>
                    ← Back to chat
                  </button>
                  <p className={mutedTextClass}>
                    {selectedNoteGroupId
                      ? "Scoped to current note group."
                      : "Scoped to selected module."}
                  </p>
                </div>
                {chatCardLoading ? <p className={mutedTextClass}>Loading study card...</p> : null}
                {chatCardError ? <p className={errorTextClass}>{chatCardError}</p> : null}
                {chatCardId && chatCardCache[chatCardId] ? (
                  <div className="chat-card">
                    <h3>{chatCardCache[chatCardId].title || "Untitled study card"}</h3>
                    <p>{chatCardCache[chatCardId].content}</p>
                    {chatCardCache[chatCardId].topic_chips?.length ? (
                      <div className="chip-grid">
                        {chatCardCache[chatCardId].topic_chips.map((chip) => (
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
                <div className="chat" ref={chatListRef}>
                  {chatMessages.length === 0 ? (
                    <p className="empty">Ask a question to get answers from your study cards.</p>
                  ) : (
                    chatMessages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`chat-bubble ${message.role}`}
                      >
                        <p>{message.content}</p>
                        {message.refs && message.refs.length ? (
                          <ol className="chat-refs">
                            {message.refs.map((refId) => {
                              const refCard = chatCardCache[refId];
                              const title =
                                refCard?.title || `Study card ${refId.slice(0, 8)}`;
                              return (
                                <li key={refId}>
                                  <button
                                    className="link-button"
                                    type="button"
                                    onClick={() => openChatStudyCard(refId)}
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
                {chatError ? <p className={errorTextClass}>{chatError}</p> : null}
                <div className="chat-input">
                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder={
                      selectedNoteGroupId
                        ? "Ask a question about this Note Group..."
                        : "Ask a question about this module..."
                    }
                    rows={2}
                    disabled={!canUseProtectedActions || !selectedModuleId}
                  />
                  <button
                    className={primaryButtonClass}
                    type="button"
                    onClick={handleSendChat}
                    disabled={!canUseProtectedActions || !selectedModuleId || !chatInput.trim() || chatLoading}
                  >
                    {chatLoading ? "Sending..." : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
      </TutorChatDialog>
    </>
  );
}
