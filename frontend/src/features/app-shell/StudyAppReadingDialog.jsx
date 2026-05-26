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

export function StudyAppReadingDialog({ model }) {
  const {
    effectiveCleanedText,
    getSectionAnchor,
    handleReadingModeChange,
    handleReadingTitleClick,
    handleReadingToggleMode,
    handleReadingViewInClean,
    handleScrollNavToCard,
    isReadingOpen,
    readingAvailable,
    readingContentRef,
    readingHighlights,
    readingHoverCardId,
    readingMode,
    readingPinnedCardId,
    setIsReadingOpen,
    setReadingHoverCardId,
    setReadingPinnedCardId,
    studyCardTitleById,
    studyCards,
    studyNoteSections
  } = model;

  return (
    <>
<ReadingDialog open={isReadingOpen} onOpenChange={setIsReadingOpen} renderShell={false}>
          <div className="reading-modal">
            <div className="reading-header">
              <div>
                <h2>Clean study text</h2>
                <p className={mutedTextClass}>Switch between study notes and their cleaned source text.</p>
              </div>
              <div className="reading-actions">
                <div className="segmented-control" role="group" aria-label="Reading mode">
                  <button
                    type="button"
                    className={readingMode === "study" ? "active" : ""}
                    onClick={() => handleReadingModeChange("study")}
                  >
                    Study notes
                  </button>
                  <button
                    type="button"
                    className={readingMode === "clean" ? "active" : ""}
                    onClick={() => handleReadingModeChange("clean")}
                  >
                    Clean text
                  </button>
                </div>
              <button
                className={outlineButtonClass}
                type="button"
                onClick={() => setIsReadingOpen(false)}
              >
                Close
              </button>
              </div>
            </div>
            {!readingAvailable ? (
              <p className={mutedTextClass}>No formatted text available for this note group yet.</p>
            ) : (
              <div className="reading-body">
                <aside className="reading-nav">
                  <p className="label">Study cards</p>
                  {studyCards.map((card, index) => {
                    const isHovered = readingHoverCardId === card.id;
                    const isPinned = readingPinnedCardId === card.id;
                    return (
                      <div
                        key={`nav-${card.id}`}
                        id={`reading-nav-${card.id}`}
                        className={`reading-link-row ${isHovered ? "hovered" : ""} ${
                          isPinned ? "pinned" : ""
                        }`}
                        onMouseEnter={() => setReadingHoverCardId(card.id)}
                        onMouseLeave={() => setReadingHoverCardId("")}
                      >
                        <button
                          className="reading-link"
                          type="button"
                          onClick={() => handleReadingTitleClick(card.id)}
                        >
                          {card.title || `Study card ${index + 1}`}
                        </button>
                        <button
                          className="reading-toggle-mode"
                          type="button"
                          aria-label={readingMode === "study" ? "Switch to clean text" : "Switch to study notes"}
                          onClick={(event) => handleReadingToggleMode(event, card.id)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 9h16M4 9l4-4M4 9l4 4M20 15H4M20 15l-4-4M20 15l-4 4"/>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </aside>
                <div className="reading-content" ref={readingContentRef}>
                  {readingMode === "clean" ? (
                    <div className={`clean-source${readingPinnedCardId ? " has-pin" : ""}`}>
                      {renderCleanedMarkdown(effectiveCleanedText, readingHighlights)}
                    </div>
                  ) : (
                    studyNoteSections.map((section, index) => {
                      const anchor = getSectionAnchor(section, index);
                      const cardTitle = studyCardTitleById.get(section.study_card_id);
                      const isHovered = readingHoverCardId === section.study_card_id;
                      const isPinned = readingPinnedCardId === section.study_card_id;
                      return (
                        <section
                          key={anchor}
                          id={`reading-study-${section.study_card_id}`}
                          className={`reading-section ${isHovered ? "hovered" : ""} ${
                            isPinned ? "pinned" : ""
                          }`}
                          onMouseEnter={() => setReadingHoverCardId(section.study_card_id)}
                          onMouseLeave={() => setReadingHoverCardId("")}
                          onClick={() => {
                            setReadingPinnedCardId((current) => current === section.study_card_id ? "" : section.study_card_id);
                            handleScrollNavToCard(section.study_card_id);
                          }}
                        >
                          <button
                            className="reading-section-toggle"
                            type="button"
                            aria-label="View in clean text"
                            onClick={(event) => handleReadingViewInClean(event, section.study_card_id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="11" cy="11" r="8"/>
                              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                          </button>
                          <div className="reading-section-header">
                            <h3>{section.title || `Section ${index + 1}`}</h3>
                          </div>
                          <div className="reading-section-body">
                            {renderMarkdownBlocks(section.content)}
                          </div>
                        </section>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
      </ReadingDialog>
    </>
  );
}
