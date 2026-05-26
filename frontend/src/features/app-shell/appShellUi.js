export const selectStyles = {
  menuPortal: (base) => ({ ...base, zIndex: 9999 })
};

export const appShellClasses = {
  panel: "rounded-lg border bg-card p-6 text-card-foreground shadow-sm",
  primaryButton:
    "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50",
  outlineButton:
    "inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
  smallOutlineButton:
    "inline-flex h-8 items-center justify-center gap-2 rounded-md border bg-background px-3 py-1 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
  destructiveOutlineButton:
    "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-destructive/30 bg-background px-4 py-2 text-sm font-medium text-destructive shadow-xs transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:pointer-events-none disabled:opacity-50",
  smallDestructiveOutlineButton:
    "inline-flex h-8 items-center justify-center gap-2 rounded-md border border-destructive/30 bg-background px-3 py-1 text-sm font-medium text-destructive shadow-xs transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:pointer-events-none disabled:opacity-50",
  buttonRow: "flex flex-wrap gap-2",
  badge:
    "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground",
  mutedText: "text-sm text-muted-foreground",
  smallMutedText: "text-xs text-muted-foreground",
  errorText: "text-sm font-medium text-destructive"
};

export const generationWorkflowTitle = (workflow) =>
  workflow?.draft_title ||
  workflow?.note_group?.title ||
  (workflow?.job?.id ? `Generation ${workflow.job.id.slice(0, 8)}` : "Generating");

export const generationWorkflowStageLabel = (workflow) => {
  const stage = workflow?.current_stage || workflow?.job?.current_stage || workflow?.job?.status || "";
  const labels = {
    queued: "Queued",
    title: "Title",
    cleaned_text: "Cleaned Text",
    study_cards: "Study Cards",
    embeddings: "Embeddings",
    formatted_text: "Formatted Text",
    question_cards: "Question Cards",
    mind_map_topics: "Mind Map and Concepts",
    topic_knowledge_nodes: "Concept Knowledge Nodes",
    promoting: "Publishing"
  };
  return labels[stage] || String(stage || "Generating").replace(/_/g, " ");
};

export const generationWorkflowStatusLabel = (workflow) => {
  const status = workflow?.job?.status || "";
  const labels = {
    queued: "Queued",
    running: "Running",
    failed: "Failed",
    cancelled: "Cancelled",
    connected: "Connected",
    connecting: "Connecting",
    error: "Connection issue",
    idle: "Idle"
  };
  return labels[status] || String(status || "Generating").replace(/_/g, " ");
};
