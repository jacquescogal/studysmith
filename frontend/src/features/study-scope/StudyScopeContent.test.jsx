import fs from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { ConceptScopeContent, NoteGroupScopeContent } from "./StudyScopeContent";

const classes = {
  panel: "panel",
  mutedText: "muted"
};

describe("NoteGroupScopeContent inline Study route", () => {
  test("defines bounded inline Study reading layout styles", () => {
    const css = fs.readFileSync(
      path.resolve(process.cwd(), "src/styles.css"),
      "utf8"
    );

    expect(css).toContain(".inline-study-panel");
    expect(css).toContain("max-height: calc(100svh - 220px)");
    expect(css).toContain(".inline-study-header");
    expect(css).toContain(".inline-study-scroll");
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain("overscroll-behavior: contain");
    expect(css).toContain(".source-lookup-floating");
    expect(css).toContain("margin-inline: auto");
    expect(css).toContain(".inline-study-scroll .clean-source.has-pin");
    expect(css).toContain("padding-bottom: 240px");
  });

  test("renders friendly Study mode labels and derived Study Card content", () => {
    const html = renderToStaticMarkup(
      <NoteGroupScopeContent
        shouldHoldContent={false}
        isViewCardsPage={false}
        isInlineStudyPage
        isStudyPage={false}
        isQuestionPage={false}
        readingAvailable
        readingMode="study"
        effectiveCleanedText="# Source"
        studyNoteSections={[
          {
            anchor: "section-1",
            title: "Derived section",
            content: "Derived answer"
          }
        ]}
        classes={classes}
        setReadingMode={vi.fn()}
      />
    );

    expect(html).toContain(">Study</");
    expect(html).toContain("Source Text");
    expect(html).toContain("Derived Study Cards");
    expect(html).toContain('class="panel inline-study-panel"');
    expect(html).toContain("inline-study-header");
    expect(html).toContain("reading-content inline-reading-content inline-study-scroll");
    expect(html).toContain("Derived answer");
    expect(html).not.toContain("Formatted Text");
  });

  test("renders source lookup controls and disables them without valid ranges", () => {
    const html = renderToStaticMarkup(
      <NoteGroupScopeContent
        shouldHoldContent={false}
        isViewCardsPage={false}
        isInlineStudyPage
        isStudyPage={false}
        isQuestionPage={false}
        readingAvailable
        readingMode="study"
        sourceRangesByCardId={
          new Map([
            ["card-1", [{ start_index: 0, end_index: 7 }]],
            ["card-2", []]
          ])
        }
        studyNoteSections={[
          { study_card_id: "card-1", title: "Card with source", content: "Derived one" },
          { study_card_id: "card-2", title: "Card without source", content: "Derived two" }
        ]}
        classes={classes}
        handleReadingModeChange={vi.fn()}
        handleReadingViewInClean={vi.fn()}
      />
    );

    expect(html).toContain("aria-label=\"View source text for Card with source\"");
    expect(html).toContain("aria-label=\"Source text unavailable for Card without source\"");
    expect(html).toContain("disabled=\"\"");
  });

  test("renders highlighted Source Text with wrapped controls and pinned card preview", () => {
    const html = renderToStaticMarkup(
      <NoteGroupScopeContent
        shouldHoldContent={false}
        isViewCardsPage={false}
        isInlineStudyPage
        isStudyPage={false}
        isQuestionPage={false}
        readingAvailable
        readingMode="clean"
        effectiveCleanedText="first source\nsecond source"
        readingPinnedCardId="card-1"
        activeSourceRangeIndex={1}
        pinnedSourceRanges={[
          { start_index: 0, end_index: 5 },
          { start_index: 13, end_index: 19 }
        ]}
        pinnedStudyCard={{
          id: "card-1",
          title: "Pinned card",
          content: "Full pinned Study Card content should be visible in a scrollable panel instead of hidden behind hover."
        }}
        studyNoteSections={[
          { title: "Section heading", content: "No card id here" },
          { study_card_id: "card-1", title: "Pinned card", content: "Pinned content" },
          { study_card_id: "card-2", title: "Next card", content: "Next content" },
          { study_card_id: "card-3", title: "Final card", content: "Final content" }
        ]}
        readingHighlights={[
          { study_card_id: "card-1", start_index: 0, end_index: 5, kind: "related", range_index: 0 },
          { study_card_id: "card-1", start_index: 13, end_index: 19, kind: "active", range_index: 1 }
        ]}
        classes={classes}
        handleReadingModeChange={vi.fn()}
        handleReadingPreviousStudyCard={vi.fn()}
        handleReadingNextStudyCard={vi.fn()}
        handleReadingSourceRangePrevious={vi.fn()}
        handleReadingSourceRangeNext={vi.fn()}
        handleReadingUnpin={vi.fn()}
      />
    );

    expect(html).toContain("source-highlight related");
    expect(html).toContain("source-highlight active");
    expect(html).toContain('class="panel inline-study-panel"');
    expect(html).toContain("inline-study-header");
    expect(html).toContain("reading-content inline-reading-content inline-study-scroll");
    expect(html).toContain("Study Card 1 of 3");
    expect(html).toContain("Source range 2 of 2");
    expect(html).toContain("aria-label=\"Pin previous Study Card\"");
    expect(html).toContain("aria-label=\"Pin next Study Card\"");
    expect(html).toContain("Pinned card");
    expect(html).toContain("source-lookup-study-card-body");
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Pinned Study Card content"');
    expect(html).toContain("Full pinned Study Card content should be visible in a scrollable panel instead of hidden behind hover.");
    expect(html).not.toContain("pinned-study-card-popover");
    expect(html).toContain("aria-label=\"Unpin Study Card\"");
    expect(html).toContain("Back to Derived Study Cards");
  });

  test("keeps pinned Study Card controls visible without source ranges", () => {
    const html = renderToStaticMarkup(
      <NoteGroupScopeContent
        shouldHoldContent={false}
        isViewCardsPage={false}
        isInlineStudyPage
        isStudyPage={false}
        isQuestionPage={false}
        readingAvailable
        readingMode="clean"
        effectiveCleanedText="first source\nsecond source"
        readingPinnedCardId="card-2"
        activeSourceRangeIndex={0}
        pinnedSourceRanges={[]}
        pinnedStudyCard={{
          id: "card-2",
          title: "No source card",
          content: "This Study Card has no valid source range."
        }}
        studyNoteSections={[
          { study_card_id: "card-1", title: "Pinned card", content: "Pinned content" },
          { study_card_id: "card-2", title: "No source card", content: "No source content" },
          { study_card_id: "card-3", title: "Final card", content: "Final content" }
        ]}
        readingHighlights={[]}
        classes={classes}
        handleReadingModeChange={vi.fn()}
        handleReadingPreviousStudyCard={vi.fn()}
        handleReadingNextStudyCard={vi.fn()}
        handleReadingSourceRangePrevious={vi.fn()}
        handleReadingSourceRangeNext={vi.fn()}
        handleReadingUnpin={vi.fn()}
      />
    );

    expect(html).toContain("Study Card 2 of 3");
    expect(html).not.toContain("Source range");
    expect(html).toContain("aria-label=\"Pin previous Study Card\"");
    expect(html).toContain("aria-label=\"Pin next Study Card\"");
    expect(html).toContain("No source card");
    expect(html).toContain("This Study Card has no valid source range.");
    expect(html).toContain("aria-label=\"Previous source range\" disabled=\"\"");
    expect(html).toContain("aria-label=\"Next source range\" disabled=\"\"");
  });

  test("renders unavailable content guidance when Study content is missing", () => {
    const html = renderToStaticMarkup(
      <NoteGroupScopeContent
        shouldHoldContent={false}
        isViewCardsPage={false}
        isInlineStudyPage
        isStudyPage={false}
        isQuestionPage={false}
        readingAvailable={false}
        readingMode="clean"
        effectiveCleanedText=""
        studyNoteSections={[]}
        classes={classes}
        setReadingMode={vi.fn()}
      />
    );

    expect(html).toContain("Study content is unavailable for this Note Group.");
    expect(html).toContain("Source Text");
    expect(html).toContain("Derived Study Cards");
  });
});

describe("StudyScopeContent Mind Map routes", () => {
  test("Note Group View Cards route renders without a local Back button", () => {
    const html = renderToStaticMarkup(
      <NoteGroupScopeContent
        shouldHoldContent={false}
        isViewCardsPage
        isMindMapPage={false}
        isInlineStudyPage={false}
        isStudyPage={false}
        isQuestionPage={false}
        isConceptScope={false}
        noteGroupCardTable={{ rows: [], unlinked_question_count: 0 }}
        noteGroupCardTableLoading={false}
        noteGroupCardTableError=""
        studyCards={[]}
        questionCards={[]}
        concepts={[]}
        canEditCurrentCards={false}
        canUseProtectedActions={false}
        editingStudyCardId=""
        editingStudyCard={{ title: "", content: "" }}
        editingQuestionCardId=""
        editingQuestionCard={{
          type: "mcq",
          prompt: "",
          optionsText: "",
          correctIndicesText: "",
          refs: []
        }}
        classes={classes}
        handleBackToOverview={vi.fn()}
        handleEditStudyCard={vi.fn()}
        setEditingStudyCard={vi.fn()}
        handleSaveStudyCard={vi.fn()}
        setEditingStudyCardId={vi.fn()}
        handleDeleteStudyCard={vi.fn()}
        handleEditQuestionCard={vi.fn()}
        setEditingQuestionCard={vi.fn()}
        handleSaveQuestionCard={vi.fn()}
        setEditingQuestionCardId={vi.fn()}
        handleDeleteQuestionCard={vi.fn()}
      />
    );

    expect(html).toContain("<h2>View Cards</h2>");
    expect(html).not.toContain("← Back");
    expect(html).not.toContain("Overview");
  });

  test("Concept View Cards route renders without a local Back button", () => {
    const html = renderToStaticMarkup(
      <ConceptScopeContent
        shouldHoldContent={false}
        isViewCardsPage
        isMindMapPage={false}
        isInlineStudyPage={false}
        isStudyPage={false}
        isQuestionPage={false}
        isConceptScope
        conceptCardTableRows={[]}
        studyCards={[]}
        questionCards={[]}
        concepts={[]}
        selectedConcept={{ id: "concept-1", label: "Elasticity" }}
        canEditCurrentCards={false}
        canUseProtectedActions={false}
        editingStudyCardId=""
        editingStudyCard={{ title: "", content: "" }}
        editingQuestionCardId=""
        editingQuestionCard={{
          type: "mcq",
          prompt: "",
          optionsText: "",
          correctIndicesText: "",
          refs: []
        }}
        classes={classes}
        handleBackToOverview={vi.fn()}
        handleEditStudyCard={vi.fn()}
        setEditingStudyCard={vi.fn()}
        handleSaveStudyCard={vi.fn()}
        setEditingStudyCardId={vi.fn()}
        handleDeleteStudyCard={vi.fn()}
        handleEditQuestionCard={vi.fn()}
        setEditingQuestionCard={vi.fn()}
        handleSaveQuestionCard={vi.fn()}
        setEditingQuestionCardId={vi.fn()}
        handleDeleteQuestionCard={vi.fn()}
      />
    );

    expect(html).toContain("<h2>View Cards</h2>");
    expect(html).not.toContain("← Back");
  });

  test("Concept Mind Map route renders only Mind Map content", () => {
    const html = renderToStaticMarkup(
      <ConceptScopeContent
        shouldHoldContent={false}
        isMindMapPage
        isViewCardsPage={false}
        isInlineStudyPage={false}
        isStudyPage={false}
        isQuestionPage={false}
        selectedConcept={{ id: "concept-1", label: "Elasticity", knowledge_node_status: "complete" }}
        selectedConceptId="concept-1"
        conceptMindMap={{
          scope: "concept",
          status: "complete",
          module_id: "module-1",
          concept_id: "concept-1",
          nodes: [
            {
              id: "concept-map-current-group:concept-1",
              node_type: "concept_current_group",
              title: "Elasticity",
              concept_ids: ["concept-1"]
            },
            {
              id: "node-definition",
              node_type: "knowledge_node",
              title: "Definition",
              parent_group_id: "concept-map-current-group:concept-1"
            }
          ],
          edges: []
        }}
        conceptMindMapLoading={false}
        conceptMindMapError=""
        mindMapDrilldown={{ sourceKey: "", graph: null, title: "", loading: false, error: "" }}
        noteGroupStats={{ studyCount: 3, questionCount: 4, dueCount: 1, staleCount: 0 }}
        canManageSelectedSubject
        isReviewOverlayVisible={false}
        conceptKnowledgeNodeRegenerating={false}
        conceptKnowledgeNodeRegeneratingId=""
        conceptTitleDraft="Elasticity"
        conceptDescriptionDraft="Description"
        conceptError=""
        conceptSaving={false}
        classes={{
          ...classes,
          buttonRow: "button-row",
          outlineButton: "outline",
          primaryButton: "primary",
          destructiveOutlineButton: "destructive"
        }}
        handleRegenerateConceptKnowledgeNodes={vi.fn()}
        handleDeleteConcept={vi.fn()}
        navigateToConcept={vi.fn()}
      />
    );

    expect(html).toContain("Elasticity Mind Map");
    expect(html).not.toContain("Knowledge Nodes ready");
    expect(html).not.toContain("Concept management");
    expect(html).not.toContain("placeholder=\"Concept name\"");
    expect(html).not.toContain("placeholder=\"Description (optional)\"");
    expect(html).not.toContain("Rename concept");
  });

  test("Note Group Mind Map route renders only Mind Map content", () => {
    const html = renderToStaticMarkup(
      <NoteGroupScopeContent
        shouldHoldContent={false}
        isMindMapPage
        isViewCardsPage={false}
        isInlineStudyPage={false}
        isStudyPage={false}
        isQuestionPage={false}
        selectedNoteGroup={{ id: "note-group-1", title: "Photosynthesis" }}
        selectedNoteGroupId="note-group-1"
        noteGroupMindMap={{
          scope: "note_group",
          status: "complete",
          module_id: "module-1",
          note_group_id: "note-group-1",
          nodes: [{ id: "concept-1", node_type: "concept", title: "Photosynthesis" }],
          edges: []
        }}
        noteGroupMindMapLoading={false}
        noteGroupMindMapError=""
        noteGroupMindMapGenerating={false}
        noteGroupNeedsReviewRegenerating={false}
        mindMapDrilldown={{ sourceKey: "", graph: null, title: "", loading: false, error: "" }}
        noteGroupStats={{ studyCount: 3, questionCount: 4, dueCount: 1, staleCount: 0 }}
        noteGroupStatusMeta={null}
        noteGroupProgress={{
          summary: {
            successRate: 0,
            masteryPercentage: 0,
            medianResponseTimeMs: 0
          }
        }}
        noteGroupProgressLoading={false}
        noteGroupProgressError=""
        progressRange="week"
        concepts={[]}
        conceptOptions={[]}
        conceptFilterValue={[]}
        conceptFilterIds={[]}
        noteGroupConceptIds={[]}
        selectedModuleId="module-1"
        selectedSubjectCode="S1"
        selectedModuleCode="M1"
        selectedNoteGroupCode="N1"
        canManageSelectedSubject
        isReviewOverlayVisible={false}
        conceptKnowledgeNodeRegeneratingId=""
        classes={{
          ...classes,
          buttonRow: "button-row",
          smallOutlineButton: "small-outline",
          outlineButton: "outline",
          destructiveOutlineButton: "destructive"
        }}
        selectStyles={{}}
        navigate={vi.fn()}
        setProgressRange={vi.fn()}
        handleGenerateNoteGroupMindMap={vi.fn()}
        handleRegenerateConceptKnowledgeNodes={vi.fn()}
        handleRegenerateNeedsReviewKnowledgeNodes={vi.fn()}
        handleOpenMindMapConcept={vi.fn()}
        clearMindMapDrilldown={vi.fn()}
        handleConceptFilterSelect={vi.fn()}
        handleResetConceptFilters={vi.fn()}
        openMetadataModal={vi.fn()}
        handleDeleteNoteGroup={vi.fn()}
      />
    );

    expect(html).toContain("Photosynthesis Mind Map");
    expect(html).not.toContain("Progress");
    expect(html).not.toContain("Filter note groups");
    expect(html).not.toContain("Study Cards");
    expect(html).not.toContain("Question Cards");
    expect(html).not.toContain("Edit metadata");
    expect(html).not.toContain("Delete note group");
  });
});
