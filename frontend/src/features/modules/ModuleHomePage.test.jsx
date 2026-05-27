import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { ModuleHomePage } from "./ModuleHomePage";

const classes = {
  panel: "panel",
  mutedText: "muted",
  smallMutedText: "small-muted",
  errorText: "error",
  badge: "badge",
  buttonRow: "button-row",
  outlineButton: "outline",
  smallOutlineButton: "small-outline",
  smallDestructiveOutlineButton: "small-destructive"
};

describe("ModuleHomePage", () => {
  test("does not render dock-owned settings and delete actions below Mind Map", () => {
    globalThis.document = { body: {} };
    const html = renderToStaticMarkup(
      <ModuleHomePage
        selectedModule={{ id: "module-1", title: "Cell biology" }}
        moduleMindMapProps={{
          moduleTitle: "Cell biology",
          graph: null,
          loading: false,
          error: ""
        }}
        moduleStats={{ studyCount: 0, questionCount: 0, dueCount: 0, staleCount: 0 }}
        moduleStatsLoading={false}
        moduleStatsError=""
        moduleQuestionTimeline={{ due: 0, week: 0, month: 0, sixMonths: 0, longTerm: 0 }}
        moduleNoteGroupsForDisplay={[]}
        moduleNoteGroupStatsById={new Map()}
        chipFilterIds={[]}
        chipOptions={[]}
        chipFilterValue={[]}
        selectStyles={{}}
        selectedModuleId="module-1"
        canManageSelectedSubject
        canUseProtectedActions
        isReviewOverlayVisible={false}
        moduleGenerationWorkflow={null}
        moduleGenerationWorkflowConnection={{}}
        moduleGenerationWorkflowError=""
        generationWorkflowStatusLabel={() => "Idle"}
        generationWorkflowTitle={() => "Generation"}
        generationWorkflowStageLabel={() => "Stage"}
        reviewCount="10"
        isReviewing={false}
        reviewError=""
        canReorderNoteGroups={false}
        isReorderingNoteGroups={false}
        draggedNoteGroupId=""
        dragOverNoteGroupId=""
        generationWorkflowsByNoteGroupId={{}}
        autoJobsByNoteGroupId={{}}
        autoJobActionId=""
        classes={classes}
        onChipFilterSelect={vi.fn()}
        onResetChipFilters={vi.fn()}
        onOpenChat={vi.fn()}
        onOpenModuleMetadata={vi.fn()}
        onDeleteModule={vi.fn()}
        onReviewCountChange={vi.fn()}
        onStartReview={vi.fn()}
        onNoteGroupDragOver={vi.fn()}
        onNoteGroupDragEnter={vi.fn()}
        onNoteGroupDrop={vi.fn()}
        onNoteGroupDragEnd={vi.fn()}
        onNoteGroupDragStart={vi.fn()}
        onCancelAutoJob={vi.fn()}
        onRetryAutoJob={vi.fn()}
        onNavigateToNoteGroup={vi.fn()}
      />
    );

    expect(html).not.toContain("Module settings");
    expect(html).not.toContain("Delete module");
  });
});
