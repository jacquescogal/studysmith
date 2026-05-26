import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  cancelJob,
  deleteJob,
  getModuleGenerationWorkflow,
  retryAutoJob,
  subscribeModuleGenerationWorkflow
} from "@/api";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const AUTO_WORKFLOW_ACTIVE_STATUSES = new Set(["queued", "running"]);
const AUTO_WORKFLOW_TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);
const AUTO_WORKFLOW_VISIBLE_STATUSES = new Set(["queued", "running", "failed", "cancelled"]);
const WORKFLOW_STREAM_RECONNECT_DELAYS_MS = [1000, 2000, 5000];
const WORKFLOW_DELETE_REQUESTED_ERROR = "Generation deletion requested";

export const autoWorkflowTerminalStatuses = AUTO_WORKFLOW_TERMINAL_STATUSES;

export const normalizeGenerationWorkflowSnapshot = (snapshot) => ({
  module_id: snapshot?.module_id || "",
  jobs: Array.isArray(snapshot?.jobs) ? snapshot.jobs : []
});

export function buildVisibleGenerationWorkflowState(nextSnapshot, previousSnapshot = null) {
  const previousWorkflowsById = new Map(
    (previousSnapshot?.jobs || [])
      .map((workflow) => [workflow?.job?.id, workflow])
      .filter(([jobId]) => Boolean(jobId))
  );
  const nextWorkflowsById = new Map();
  const nextObservedWorkflowIds = new Set();
  const visibleJobs = [];
  const workflowsByNoteGroupId = {};
  const autoJobsByNoteGroupId = {};
  const statusChanges = [];
  const missingPreviousWorkflows = [];

  nextSnapshot.jobs.forEach((workflow) => {
    const job = workflow?.job;
    if (!job?.id) {
      return;
    }
    const noteGroupId = job.note_group_id || workflow.note_group?.id;
    nextObservedWorkflowIds.add(job.id);
    if (AUTO_WORKFLOW_VISIBLE_STATUSES.has(job.status)) {
      visibleJobs.push(workflow);
      nextWorkflowsById.set(job.id, workflow);
      if (noteGroupId) {
        workflowsByNoteGroupId[noteGroupId] = workflow;
        autoJobsByNoteGroupId[noteGroupId] = {
          ...job,
          note_group_id: noteGroupId,
          current_stage: workflow.current_stage || job.current_stage
        };
      }
    }

    const previousWorkflow = previousWorkflowsById.get(job.id);
    const previousStatus = previousWorkflow?.job?.status;
    if (previousWorkflow && previousStatus !== job.status) {
      statusChanges.push({
        job,
        previousWorkflow,
        previousStatus,
        nextStatus: job.status
      });
    }
  });

  previousWorkflowsById.forEach((previousWorkflow, jobId) => {
    if (!nextObservedWorkflowIds.has(jobId)) {
      missingPreviousWorkflows.push({ jobId, previousWorkflow });
    }
  });

  return {
    visibleSnapshot: {
      ...nextSnapshot,
      jobs: visibleJobs
    },
    workflowsByJobId: Object.fromEntries(nextWorkflowsById),
    workflowsByNoteGroupId,
    autoJobsByNoteGroupId,
    statusChanges,
    missingPreviousWorkflows
  };
}

export function useModuleGenerationWorkflow({
  moduleId = "",
  canManageSelectedSubject = false,
  isSelectedSubjectPermissionHydrating = false,
  selectedNoteGroupTitle = "",
  requestConfirm,
  onRefreshGeneratedData,
  onRefreshReview,
  onGenerationDeleted
} = {}) {
  const [moduleGenerationWorkflow, setModuleGenerationWorkflow] = useState(null);
  const [moduleGenerationWorkflowError, setModuleGenerationWorkflowError] = useState("");
  const [moduleGenerationWorkflowConnection, setModuleGenerationWorkflowConnection] =
    useState("idle");
  const [moduleGenerationWorkflowChecked, setModuleGenerationWorkflowChecked] =
    useState(false);
  const [generationWorkflowsByJobId, setGenerationWorkflowsByJobId] = useState({});
  const [generationWorkflowsByNoteGroupId, setGenerationWorkflowsByNoteGroupId] =
    useState({});
  const [autoJobsByNoteGroupId, setAutoJobsByNoteGroupId] = useState({});
  const [autoJobActionId, setAutoJobActionId] = useState("");
  const moduleGenerationWorkflowRef = useRef(null);
  const notifiedAutoJobTerminalRef = useRef(new Set());

  const resetWorkflowState = useCallback((checked = false) => {
    moduleGenerationWorkflowRef.current = null;
    setModuleGenerationWorkflow(null);
    setModuleGenerationWorkflowError("");
    setModuleGenerationWorkflowConnection("idle");
    setModuleGenerationWorkflowChecked(checked);
    setGenerationWorkflowsByJobId({});
    setGenerationWorkflowsByNoteGroupId({});
    setAutoJobsByNoteGroupId({});
  }, []);

  const applyModuleGenerationWorkflowSnapshot = useCallback(
    (snapshot, options = {}) => {
      const { moduleId: snapshotModuleId = moduleId, notify = true } = options;
      const nextSnapshot = normalizeGenerationWorkflowSnapshot(snapshot);
      if (!snapshotModuleId || nextSnapshot.module_id !== snapshotModuleId) {
        return null;
      }

      const previousSnapshot =
        moduleGenerationWorkflowRef.current?.module_id === snapshotModuleId
          ? moduleGenerationWorkflowRef.current
          : null;
      const nextState = buildVisibleGenerationWorkflowState(nextSnapshot, previousSnapshot);

      nextState.statusChanges.forEach(({ job, nextStatus }) => {
        const terminalToastKey = `${job.id}:${nextStatus}`;
        if (AUTO_WORKFLOW_ACTIVE_STATUSES.has(nextStatus)) {
          AUTO_WORKFLOW_TERMINAL_STATUSES.forEach((status) => {
            notifiedAutoJobTerminalRef.current.delete(`${job.id}:${status}`);
          });
        }
        if (notify && AUTO_WORKFLOW_TERMINAL_STATUSES.has(nextStatus)) {
          onRefreshGeneratedData?.(snapshotModuleId);
          if (!notifiedAutoJobTerminalRef.current.has(terminalToastKey)) {
            notifiedAutoJobTerminalRef.current.add(terminalToastKey);
            if (nextStatus === "failed") {
              toast.error(job.error || "Note group creation failed.");
            } else if (nextStatus === "cancelled") {
              toast.info("Note group creation cancelled.");
            } else if (nextStatus === "completed") {
              toast.success("Note group ready.");
            }
          }
        }
      });

      if (notify && previousSnapshot) {
        nextState.missingPreviousWorkflows.forEach(({ jobId, previousWorkflow }) => {
          const previousJob = previousWorkflow?.job || {};
          const wasActive = AUTO_WORKFLOW_ACTIVE_STATUSES.has(previousJob.status);
          const wasDeleteRequested = previousJob.error === WORKFLOW_DELETE_REQUESTED_ERROR;
          if (wasActive && !wasDeleteRequested) {
            const terminalToastKey = `${jobId}:completed`;
            if (!notifiedAutoJobTerminalRef.current.has(terminalToastKey)) {
              notifiedAutoJobTerminalRef.current.add(terminalToastKey);
              toast.success("Note group ready.");
            }
          }
          onRefreshGeneratedData?.(snapshotModuleId);
        });
      }

      moduleGenerationWorkflowRef.current = nextState.visibleSnapshot;
      setModuleGenerationWorkflow(nextState.visibleSnapshot);
      setModuleGenerationWorkflowError("");
      setModuleGenerationWorkflowChecked(true);
      setGenerationWorkflowsByJobId(nextState.workflowsByJobId);
      setGenerationWorkflowsByNoteGroupId(nextState.workflowsByNoteGroupId);
      setAutoJobsByNoteGroupId(nextState.autoJobsByNoteGroupId);
      return nextSnapshot;
    },
    [moduleId, onRefreshGeneratedData]
  );

  const refreshModuleGenerationWorkflowSnapshot = useCallback(
    async (refreshModuleId = moduleId, options = {}) => {
      const snapshot = await getModuleGenerationWorkflow(refreshModuleId);
      applyModuleGenerationWorkflowSnapshot(snapshot, {
        moduleId: refreshModuleId,
        ...options
      });
      return snapshot;
    },
    [applyModuleGenerationWorkflowSnapshot, moduleId]
  );

  useEffect(() => {
    if (!moduleId) {
      resetWorkflowState(false);
      return undefined;
    }
    if (isSelectedSubjectPermissionHydrating) {
      resetWorkflowState(false);
      return undefined;
    }
    if (!canManageSelectedSubject) {
      resetWorkflowState(true);
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;
    moduleGenerationWorkflowRef.current = null;
    setModuleGenerationWorkflow(null);
    setModuleGenerationWorkflowError("");
    setModuleGenerationWorkflowConnection("connecting");
    setModuleGenerationWorkflowChecked(false);
    setGenerationWorkflowsByJobId({});
    setGenerationWorkflowsByNoteGroupId({});
    setAutoJobsByNoteGroupId({});

    const connectWorkflowStream = async () => {
      try {
        await refreshModuleGenerationWorkflowSnapshot(moduleId, { notify: false });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setModuleGenerationWorkflowError(
          error.message || "Failed to load note group generation workflow."
        );
        setModuleGenerationWorkflowConnection("error");
        setModuleGenerationWorkflowChecked(true);
        toast.error(error.message || "Failed to check note group creation jobs.");
        return;
      }
      if (cancelled) {
        return;
      }

      let reconnectAttempt = 0;
      while (!cancelled && !controller.signal.aborted) {
        await subscribeModuleGenerationWorkflow(moduleId, {
          signal: controller.signal,
          onSnapshot: (snapshot) => {
            if (cancelled) {
              return;
            }
            reconnectAttempt = 0;
            setModuleGenerationWorkflowConnection("connected");
            applyModuleGenerationWorkflowSnapshot(snapshot, { moduleId });
          },
          onError: (error) => {
            if (cancelled) {
              return;
            }
            setModuleGenerationWorkflowError(
              error.message || "Note group generation workflow stream disconnected."
            );
            setModuleGenerationWorkflowConnection("error");
          }
        });
        if (cancelled || controller.signal.aborted) {
          break;
        }
        const delayMs =
          WORKFLOW_STREAM_RECONNECT_DELAYS_MS[
            Math.min(reconnectAttempt, WORKFLOW_STREAM_RECONNECT_DELAYS_MS.length - 1)
          ];
        reconnectAttempt += 1;
        setModuleGenerationWorkflowConnection("connecting");
        await sleep(delayMs);
      }
    };

    connectWorkflowStream();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    applyModuleGenerationWorkflowSnapshot,
    canManageSelectedSubject,
    isSelectedSubjectPermissionHydrating,
    moduleId,
    refreshModuleGenerationWorkflowSnapshot,
    resetWorkflowState
  ]);

  const handleCancelAutoJob = useCallback(
    async (jobId) => {
      if (!canManageSelectedSubject) {
        toast.error("Maintainer access is required to manage note group creation jobs.");
        return;
      }
      if (!jobId) {
        return;
      }
      setAutoJobActionId(jobId);
      try {
        await cancelJob(jobId);
        notifiedAutoJobTerminalRef.current.add(`${jobId}:cancelled`);
        toast.info("Note group creation job cancelled.");
        if (moduleId) {
          onRefreshReview?.();
          await refreshModuleGenerationWorkflowSnapshot(moduleId);
        }
      } catch (error) {
        toast.error(error.message || "Failed to cancel note group creation job.");
      } finally {
        setAutoJobActionId("");
      }
    },
    [canManageSelectedSubject, moduleId, onRefreshReview, refreshModuleGenerationWorkflowSnapshot]
  );

  const handleRetryAutoJob = useCallback(
    async (jobId) => {
      if (!canManageSelectedSubject) {
        toast.error("Maintainer access is required to manage note group creation jobs.");
        return;
      }
      if (!jobId) {
        return;
      }
      setAutoJobActionId(jobId);
      try {
        await retryAutoJob(jobId);
        AUTO_WORKFLOW_TERMINAL_STATUSES.forEach((status) => {
          notifiedAutoJobTerminalRef.current.delete(`${jobId}:${status}`);
        });
        toast.info("Retrying note group creation.");
        if (moduleId) {
          onRefreshReview?.();
          await refreshModuleGenerationWorkflowSnapshot(moduleId);
        }
      } catch (error) {
        toast.error(error.message || "Failed to retry note group creation job.");
      } finally {
        setAutoJobActionId("");
      }
    },
    [canManageSelectedSubject, moduleId, onRefreshReview, refreshModuleGenerationWorkflowSnapshot]
  );

  const handleDeleteAutoJob = useCallback(
    async (jobId, noteGroupId = "") => {
      if (!canManageSelectedSubject) {
        toast.error("Maintainer access is required to manage note group creation jobs.");
        return;
      }
      if (!jobId) {
        return;
      }

      const workflow = generationWorkflowsByJobId[jobId];
      const noteGroupLabel =
        workflow?.draft_title ||
        workflow?.note_group?.title ||
        selectedNoteGroupTitle ||
        "this generation";
      const confirmed = await requestConfirm?.({
        title: `Delete "${noteGroupLabel}"?`,
        description: "This removes the unfinished Note Group and its generation workflow.",
        confirmLabel: "Delete generation"
      });
      if (!confirmed) {
        return;
      }

      setAutoJobActionId(jobId);
      try {
        const result = await deleteJob(jobId);
        if (result?.delete_requested) {
          toast.info("Generation deletion requested.");
        } else {
          toast.info("Generation deleted.");
          onGenerationDeleted?.(noteGroupId);
        }
        if (moduleId) {
          await refreshModuleGenerationWorkflowSnapshot(moduleId);
        }
      } catch (error) {
        toast.error(error.message || "Failed to delete generation.");
      } finally {
        setAutoJobActionId("");
      }
    },
    [
      canManageSelectedSubject,
      generationWorkflowsByJobId,
      moduleId,
      onGenerationDeleted,
      refreshModuleGenerationWorkflowSnapshot,
      requestConfirm,
      selectedNoteGroupTitle
    ]
  );

  return {
    moduleGenerationWorkflow,
    moduleGenerationWorkflowError,
    moduleGenerationWorkflowConnection,
    moduleGenerationWorkflowChecked,
    generationWorkflowsByJobId,
    generationWorkflowsByNoteGroupId,
    autoJobsByNoteGroupId,
    autoJobActionId,
    refreshModuleGenerationWorkflowSnapshot,
    handleCancelAutoJob,
    handleRetryAutoJob,
    handleDeleteAutoJob
  };
}
