import fs from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { ConceptScopeContent, NoteGroupScopeContent, SourceTextContainer } from "./StudyScopeContent";

const classes = {
  panel: "panel",
  mutedText: "muted"
};

const getButtonMarkup = (html, ariaLabel) => {
  const match = html.match(new RegExp(`<button[^>]*aria-label="${ariaLabel}"[^>]*>`));
  return match?.[0] || "";
};

describe("Concept View Cards", () => {
  test("Concept View Cards leaves include descendant Study Cards toggle to the dock", () => {
    const html = renderToStaticMarkup(
      <ConceptScopeContent
        shouldHoldContent={false}
        isViewCardsPage
        isMindMapPage={false}
        isStudyPage={false}
        isQuestionPage={false}
        selectedConcept={{ id: "concept-1", label: "Energy" }}
        studyCards={[]}
        questionCards={[]}
        classes={classes}
        startReview={vi.fn()}
      />
    );

    expect(html).toContain("<h2>View Cards</h2>");
    expect(html).not.toContain("Include descendant Study Cards");
  });

  test("Concept View Cards keeps descendant Study Cards when descendant scope is included", () => {
    const html = renderToStaticMarkup(
      <ConceptScopeContent
        shouldHoldContent={false}
        isViewCardsPage
        isMindMapPage={false}
        isStudyPage={false}
        isQuestionPage={false}
        selectedConcept={{ id: "concept-parent", label: "Parent" }}
        includeDescendantStudyCards
        conceptCardTableRows={[
          {
            study_card: {
              id: "study-direct",
              title: "Direct card",
              topic_chips: [{ id: "concept-parent", label: "Parent" }]
            },
            question_cards: []
          },
          {
            study_card: {
              id: "study-child",
              title: "Child card",
              topic_chips: [{ id: "concept-child", label: "Child" }]
            },
            question_cards: []
          }
        ]}
        studyCards={[
          {
            id: "study-direct",
            title: "Direct card",
            topic_chips: [{ id: "concept-parent", label: "Parent" }]
          },
          {
            id: "study-child",
            title: "Child card",
            topic_chips: [{ id: "concept-child", label: "Child" }]
          }
        ]}
        questionCards={[]}
        concepts={[
          { id: "concept-parent", label: "Parent" },
          { id: "concept-child", label: "Child" }
        ]}
        classes={classes}
        startReview={vi.fn()}
      />
    );

    expect(html).toContain("Direct card");
    expect(html).toContain("Child card");
  });

  test("Concept View Cards applies fixed Concept filter when descendant scope is disabled", () => {
    const html = renderToStaticMarkup(
      <ConceptScopeContent
        shouldHoldContent={false}
        isViewCardsPage
        isMindMapPage={false}
        isStudyPage={false}
        isQuestionPage={false}
        selectedConcept={{ id: "concept-parent", label: "Parent" }}
        includeDescendantStudyCards={false}
        conceptCardTableRows={[
          {
            study_card: {
              id: "study-direct",
              title: "Direct card",
              topic_chips: [{ id: "concept-parent", label: "Parent" }]
            },
            question_cards: []
          },
          {
            study_card: {
              id: "study-child",
              title: "Child card",
              topic_chips: [{ id: "concept-child", label: "Child" }]
            },
            question_cards: []
          }
        ]}
        studyCards={[
          {
            id: "study-direct",
            title: "Direct card",
            topic_chips: [{ id: "concept-parent", label: "Parent" }]
          },
          {
            id: "study-child",
            title: "Child card",
            topic_chips: [{ id: "concept-child", label: "Child" }]
          }
        ]}
        questionCards={[]}
        concepts={[
          { id: "concept-parent", label: "Parent" },
          { id: "concept-child", label: "Child" }
        ]}
        classes={classes}
        startReview={vi.fn()}
      />
    );

    expect(html).toContain("Direct card");
    expect(html).not.toContain("Child card");
  });
});

describe("Concept Study Cards", () => {
  test("Concept Study Cards route leaves include descendant Study Cards toggle to the dock", () => {
    const html = renderToStaticMarkup(
      <ConceptScopeContent
        shouldHoldContent={false}
        isViewCardsPage={false}
        isMindMapPage={false}
        isStudyPage
        isQuestionPage={false}
        selectedConcept={{ id: "concept-1", label: "Energy" }}
        filteredStudyCards={[]}
        studyCards={[]}
        concepts={[]}
        classes={classes}
        canEditCurrentCards={false}
        canUseProtectedActions={false}
        editingStudyCardId=""
        editingStudyCard={{ title: "", content: "", chipIds: [] }}
        setEditingStudyCard={vi.fn()}
        setEditingStudyCardId={vi.fn()}
        handleBackToOverview={vi.fn()}
        handleEditStudyCard={vi.fn()}
        handleSaveStudyCard={vi.fn()}
        handleDeleteStudyCard={vi.fn()}
      />
    );

    expect(html).toContain("<h2>Study cards</h2>");
    expect(html).not.toContain("Include descendant Study Cards");
  });
});

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
    expect(css).toContain(".source-lookup-study-card-scroll");
    expect(css).toContain("height: 100px");
    expect(css).toContain("\n  height: 100px");
    expect(css).toContain("overflow-y: auto");
    expect(css).toMatch(
      /\.source-lookup-study-card-scroll\s*\{[^}]*overscroll-behavior:\s*contain;/s
    );
    expect(css).toMatch(/\.clean-source\s*\{[^}]*color:\s*var\(--ink\);/s);
    expect(css).toMatch(/\.reading-section-body p\s*\{[^}]*color:\s*var\(--ink\);/s);
    expect(css).toMatch(/\.source-lookup-study-card-body\s*\{[^}]*color:\s*var\(--ink\);/s);
    expect(css).toMatch(/\.source-lookup-nav button:disabled\s*\{[^}]*opacity:\s*0\.42;/s);
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
    expect(html).toContain("View Source Text");
    expect(html).toContain("Derived Study Cards");
    expect(html).not.toContain("segmented-control");
    expect(html).not.toContain("Study reading mode");
    expect(html).toContain('class="panel inline-study-panel"');
    expect(html).toContain("inline-study-header");
    expect(html).toContain("reading-content inline-reading-content inline-study-scroll");
    expect(html).toContain("Derived answer");
    expect(html).not.toContain("Formatted Text");
  });

  test("renders scoped Study Cards grouped by Note Group order", () => {
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
        studyNoteGroups={[
          {
            id: "note-b",
            title: "Second Note Group",
            studyCards: [
              {
                id: "card-b",
                title: "Card B",
                content: "Body B",
                note_group_id: "note-b"
              }
            ]
          },
          {
            id: "note-a",
            title: "First Note Group",
            studyCards: [
              {
                id: "card-a",
                title: "Card A",
                content: "Body A",
                note_group_id: "note-a"
              }
            ]
          }
        ]}
        sourceRangesByCardId={new Map()}
        classes={classes}
        setReadingMode={vi.fn()}
      />
    );

    expect(html.indexOf("Second Note Group")).toBeLessThan(html.indexOf("First Note Group"));
    expect(html).toContain("study-note-group-divider");
    expect(html).toContain("Card B");
    expect(html).toContain("Body A");
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
      <SourceTextContainer
        readingAvailable
        effectiveCleanedText="first source\nsecond source"
        readingPinnedCardId="card-1"
        activeSourceRangeIndex={1}
        hasPreviousStudyCard={false}
        hasNextStudyCard
        hasPreviousSourceRange
        hasNextSourceRange={false}
        pinnedSourceRanges={[
          { start_index: 0, end_index: 5 },
          { start_index: 13, end_index: 19 }
        ]}
        pinnedStudyCard={{
          id: "card-1",
          title: "Pinned card",
          content: "Full pinned Study Card content should be visible in a scrollable panel instead of hidden behind hover."
        }}
        pinnedStudyCardPositionLabel="Study Card 1 of 3"
        sourceRangePositionLabel="Source range 2 of 2"
        readingHighlights={[
          { study_card_id: "card-1", start_index: 0, end_index: 5, kind: "related", range_index: 0 },
          { study_card_id: "card-1", start_index: 13, end_index: 19, kind: "active", range_index: 1 }
        ]}
        classes={classes}
        onBackToStudyCards={vi.fn()}
        handleReadingPreviousStudyCard={vi.fn()}
        handleReadingNextStudyCard={vi.fn()}
        handleReadingSourceRangePrevious={vi.fn()}
        handleReadingSourceRangeNext={vi.fn()}
        handleReadingUnpin={vi.fn()}
      />
    );

    expect(html).toContain("source-highlight related");
    expect(html).toContain("source-highlight active");
    expect(html).toContain("reading-content source-text-modal-content inline-study-scroll");
    expect(html).toContain("Study Card 1 of 3");
    expect(html).toContain("Source range 2 of 2");
    expect(html).toContain("aria-label=\"Pin previous Study Card\"");
    expect(html).toContain("aria-label=\"Pin next Study Card\"");
    expect(getButtonMarkup(html, "Pin previous Study Card")).toContain("disabled");
    expect(getButtonMarkup(html, "Pin next Study Card")).not.toContain("disabled");
    expect(getButtonMarkup(html, "Previous source range")).not.toContain("disabled");
    expect(getButtonMarkup(html, "Next source range")).toContain("disabled");
    expect(html).toContain("Pinned card");
    expect(html).toContain("source-lookup-study-card-scroll");
    expect(html).toContain("source-lookup-study-card-body");
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Pinned Study Card title and content"');
    expect(html).toContain("Full pinned Study Card content should be visible in a scrollable panel instead of hidden behind hover.");
    expect(html).not.toContain("pinned-study-card-popover");
    expect(html).toContain("aria-label=\"Unpin Study Card\"");
    expect(html).toContain("Back to Derived Study Cards");
  });

  test("disables pinned navigation at the last Study Card and first source range", () => {
    const html = renderToStaticMarkup(
      <SourceTextContainer
        readingAvailable
        effectiveCleanedText="first source\nsecond source"
        readingPinnedCardId="card-3"
        activeSourceRangeIndex={0}
        hasPreviousStudyCard
        hasNextStudyCard={false}
        hasPreviousSourceRange={false}
        hasNextSourceRange
        pinnedSourceRanges={[
          { start_index: 0, end_index: 5 },
          { start_index: 13, end_index: 19 }
        ]}
        pinnedStudyCard={{
          id: "card-3",
          title: "Final card",
          content: "Final pinned content"
        }}
        pinnedStudyCardPositionLabel="Study Card 3 of 3"
        sourceRangePositionLabel="Source range 1 of 2"
        readingHighlights={[
          { study_card_id: "card-3", start_index: 0, end_index: 5, kind: "active", range_index: 0 }
        ]}
        classes={classes}
        onBackToStudyCards={vi.fn()}
        handleReadingPreviousStudyCard={vi.fn()}
        handleReadingNextStudyCard={vi.fn()}
        handleReadingSourceRangePrevious={vi.fn()}
        handleReadingSourceRangeNext={vi.fn()}
        handleReadingUnpin={vi.fn()}
      />
    );

    expect(getButtonMarkup(html, "Pin previous Study Card")).not.toContain("disabled");
    expect(getButtonMarkup(html, "Pin next Study Card")).toContain("disabled");
    expect(getButtonMarkup(html, "Previous source range")).toContain("disabled");
    expect(getButtonMarkup(html, "Next source range")).not.toContain("disabled");
  });

  test("keeps pinned Study Card controls visible without source ranges", () => {
    const html = renderToStaticMarkup(
      <SourceTextContainer
        readingAvailable
        effectiveCleanedText="first source\nsecond source"
        readingPinnedCardId="card-2"
        activeSourceRangeIndex={0}
        hasPreviousStudyCard
        hasNextStudyCard
        hasPreviousSourceRange={false}
        hasNextSourceRange={false}
        pinnedSourceRanges={[]}
        pinnedStudyCard={{
          id: "card-2",
          title: "No source card",
          content: "This Study Card has no valid source range."
        }}
        pinnedStudyCardPositionLabel="Study Card 2 of 3"
        sourceRangePositionLabel=""
        readingHighlights={[]}
        classes={classes}
        onBackToStudyCards={vi.fn()}
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
    expect(html).toContain("View Source Text");
    expect(html).toContain("disabled");
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
