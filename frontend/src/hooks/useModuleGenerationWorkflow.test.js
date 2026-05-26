import { describe, expect, test } from "vitest";

import {
  buildVisibleGenerationWorkflowState,
  normalizeGenerationWorkflowSnapshot
} from "./useModuleGenerationWorkflow";

describe("normalizeGenerationWorkflowSnapshot", () => {
  test("normalizes missing module and job fields", () => {
    expect(normalizeGenerationWorkflowSnapshot(null)).toEqual({
      module_id: "",
      jobs: []
    });
  });
});

describe("buildVisibleGenerationWorkflowState", () => {
  test("indexes visible jobs by job and Note Group id", () => {
    const runningWorkflow = {
      current_stage: "study_cards",
      job: {
        id: "job-running",
        note_group_id: "note-1",
        status: "running"
      },
      note_group: {
        id: "note-1",
        title: "Running Note Group"
      }
    };
    const completedWorkflow = {
      current_stage: "promoting",
      job: {
        id: "job-completed",
        note_group_id: "note-2",
        status: "completed"
      },
      note_group: {
        id: "note-2",
        title: "Completed Note Group"
      }
    };

    const state = buildVisibleGenerationWorkflowState({
      module_id: "module-1",
      jobs: [runningWorkflow, completedWorkflow]
    });

    expect(state.visibleSnapshot.jobs).toEqual([runningWorkflow]);
    expect(state.workflowsByJobId).toEqual({
      "job-running": runningWorkflow
    });
    expect(state.workflowsByNoteGroupId).toEqual({
      "note-1": runningWorkflow
    });
    expect(state.autoJobsByNoteGroupId).toEqual({
      "note-1": {
        id: "job-running",
        note_group_id: "note-1",
        status: "running",
        current_stage: "study_cards"
      }
    });
  });

  test("reports terminal status changes and missing previous active workflows", () => {
    const previousRunning = {
      job: {
        id: "job-1",
        note_group_id: "note-1",
        status: "running"
      }
    };
    const previousMissing = {
      job: {
        id: "job-2",
        note_group_id: "note-2",
        status: "running"
      }
    };
    const nextFailed = {
      job: {
        id: "job-1",
        note_group_id: "note-1",
        status: "failed"
      }
    };

    const state = buildVisibleGenerationWorkflowState(
      {
        module_id: "module-1",
        jobs: [nextFailed]
      },
      {
        module_id: "module-1",
        jobs: [previousRunning, previousMissing]
      }
    );

    expect(state.statusChanges).toMatchObject([
      {
        previousStatus: "running",
        nextStatus: "failed"
      }
    ]);
    expect(state.missingPreviousWorkflows).toEqual([
      {
        jobId: "job-2",
        previousWorkflow: previousMissing
      }
    ]);
  });
});
