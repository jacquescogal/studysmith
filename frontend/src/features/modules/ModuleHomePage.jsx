import Select from "react-select";

import { Button } from "@/components/ui/button";
import { ModuleMindMapPage } from "@/features/modules/ModuleMindMapPage";
import { ModuleOverview } from "@/features/modules/ModuleOverview";
import { formatCreatedAt, getNoteGroupStatusMeta } from "@/lib/format";

export function ModuleHomePage({
  selectedModule,
  moduleMindMapProps,
  moduleStats,
  moduleStatsLoading,
  moduleStatsError,
  moduleQuestionTimeline,
  moduleNoteGroupsForDisplay,
  moduleNoteGroupStatsById,
  chipFilterIds,
  chipOptions,
  chipFilterValue,
  selectStyles,
  selectedModuleId,
  canUseProtectedActions,
  canManageSelectedSubject,
  isReviewOverlayVisible,
  moduleGenerationWorkflow,
  moduleGenerationWorkflowConnection,
  moduleGenerationWorkflowError,
  generationWorkflowStatusLabel,
  generationWorkflowTitle,
  generationWorkflowStageLabel,
  reviewCount,
  isReviewing,
  reviewError,
  canReorderNoteGroups,
  isReorderingNoteGroups,
  draggedNoteGroupId,
  dragOverNoteGroupId,
  generationWorkflowsByNoteGroupId,
  autoJobsByNoteGroupId,
  autoJobActionId,
  classes,
  onChipFilterSelect,
  onResetChipFilters,
  onReviewCountChange,
  onStartReview,
  onNoteGroupDragOver,
  onNoteGroupDragEnter,
  onNoteGroupDrop,
  onNoteGroupDragEnd,
  onNoteGroupDragStart,
  onCancelAutoJob,
  onRetryAutoJob,
  onNavigateToNoteGroup
}) {
  return (
    <div className="space-y-6">
      <ModuleMindMapPage {...moduleMindMapProps} />
      <ModuleOverview
        title={selectedModule?.title}
        description={
          selectedModule?.description ||
          "Review across note groups and manage module details."
        }
        noteGroupCount={moduleNoteGroupsForDisplay.length}
        stats={moduleStats}
        loading={moduleStatsLoading}
        error={moduleStatsError}
        filterControls={
          <div className="filter-row">
            <div className="filter-label">
              <span>Filter note groups</span>
              {chipFilterIds.length ? (
                <span className="filter-badge">{chipFilterIds.length}</span>
              ) : null}
            </div>
            <div className="filter-controls">
              <Select
                className="select"
                classNamePrefix="select"
                options={chipOptions}
                value={chipFilterValue}
                onChange={onChipFilterSelect}
                placeholder="Search concepts"
                isMulti
                isClearable
                isDisabled={!selectedModuleId || chipOptions.length === 0}
                maxMenuHeight={220}
                menuPortalTarget={document.body}
                styles={selectStyles}
                formatOptionLabel={(opt) => (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span>{opt.label}</span>
                    {opt.description ? (
                      <span style={{ fontSize: "0.75em", color: "#888" }}>
                        {opt.description}
                      </span>
                    ) : null}
                  </div>
                )}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onResetChipFilters}
                disabled={!chipFilterIds.length}
              >
                Reset
              </Button>
            </div>
          </div>
        }
      />
      {moduleGenerationWorkflow?.jobs?.length ? (
        <section className={classes.panel} id="module-generation-workflow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2>Active Note Group generations</h2>
              <p className={classes.mutedText}>
                {moduleGenerationWorkflow.jobs.length} active or awaiting action in this module.
              </p>
            </div>
            <span className={classes.badge}>
              {generationWorkflowStatusLabel({
                job: { status: moduleGenerationWorkflowConnection }
              })}
            </span>
          </div>
          {moduleGenerationWorkflowError ? (
            <p className={classes.errorText}>{moduleGenerationWorkflowError}</p>
          ) : null}
          <div className="mt-4 grid gap-3">
            {moduleGenerationWorkflow.jobs.map((workflow) => {
              const noteGroupId =
                workflow.job?.note_group_id || workflow.note_group?.id || "";
              return (
                <button
                  key={workflow.job?.id}
                  type="button"
                  className="rounded-md border bg-background p-3 text-left transition-colors hover:bg-accent"
                  onClick={() => noteGroupId && onNavigateToNoteGroup(noteGroupId)}
                >
                  <span className="block font-medium">
                    {generationWorkflowTitle(workflow)}
                  </span>
                  <span className={classes.smallMutedText}>
                    {generationWorkflowStageLabel(workflow)} -{" "}
                    {generationWorkflowStatusLabel(workflow)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
      <section className={classes.panel} id="module-timeline">
        <h2>Question timeline</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <p className="label">Due</p>
            <p className="value">
              {moduleStatsLoading ? "..." : moduleQuestionTimeline.due}
            </p>
          </div>
          <div className="stat-card">
            <p className="label">&lt; 1 week</p>
            <p className="value">
              {moduleStatsLoading ? "..." : moduleQuestionTimeline.week}
            </p>
          </div>
          <div className="stat-card">
            <p className="label">&lt; 1 month</p>
            <p className="value">
              {moduleStatsLoading ? "..." : moduleQuestionTimeline.month}
            </p>
          </div>
          <div className="stat-card">
            <p className="label">&lt; 6 months</p>
            <p className="value">
              {moduleStatsLoading ? "..." : moduleQuestionTimeline.sixMonths}
            </p>
          </div>
          <div className="stat-card">
            <p className="label">&gt; 6 months</p>
            <p className="value">
              {moduleStatsLoading ? "..." : moduleQuestionTimeline.longTerm}
            </p>
          </div>
        </div>
        <p className={classes.mutedText}>
          Due includes anything scheduled within the next 6 hours.
        </p>
      </section>
      <section className={classes.panel} id="module-note-groups">
        <h2>Note groups in this module</h2>
        {chipFilterIds.length ? (
          <p className={classes.mutedText}>Filtered by selected concepts.</p>
        ) : null}
        {canReorderNoteGroups ? (
          <p className={classes.mutedText}>
            Drag and drop note groups to reorder.
            {isReorderingNoteGroups ? " Saving order..." : ""}
          </p>
        ) : null}
        {moduleNoteGroupsForDisplay.length === 0 ? (
          <p className={classes.mutedText}>
            {chipFilterIds.length
              ? "No note groups match the selected concepts."
              : "No note groups yet."}
          </p>
        ) : (
          <div className="grid gap-4">
            {moduleNoteGroupsForDisplay.map((group) => {
              const stats = moduleNoteGroupStatsById.get(group.id);
              const statusMeta = getNoteGroupStatusMeta(group.generation_status);
              const workflow = generationWorkflowsByNoteGroupId[group.id];
              const autoJob = autoJobsByNoteGroupId[group.id];
              const canCancelAuto =
                autoJob &&
                (autoJob.status === "queued" || autoJob.status === "running");
              const canRetryAuto =
                autoJob &&
                (autoJob.status === "failed" || autoJob.status === "cancelled");

              return (
                <article
                  key={group.id}
                  className={`rounded-lg border bg-card p-4 text-card-foreground shadow-sm ${
                    draggedNoteGroupId === group.id ? "dragging" : ""
                  } ${dragOverNoteGroupId === group.id ? "drag-over" : ""}`}
                  onDragOver={onNoteGroupDragOver}
                  onDragEnter={() => onNoteGroupDragEnter(group.id)}
                  onDrop={(event) => onNoteGroupDrop(event, group.id)}
                  onDragEnd={onNoteGroupDragEnd}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {canReorderNoteGroups ? (
                        <button
                          type="button"
                          className="drag-handle"
                          aria-label="Drag to reorder note groups"
                          draggable
                          onDragStart={(event) => onNoteGroupDragStart(event, group.id)}
                          onDragEnd={onNoteGroupDragEnd}
                        >
                          ::
                        </button>
                      ) : null}
                      <div className="note-group-title-stack">
                        <h3>
                          {workflow
                            ? generationWorkflowTitle(workflow)
                            : group.title || "Untitled note group"}
                        </h3>
                        <span className="note-group-date">
                          {workflow
                            ? generationWorkflowStageLabel(workflow)
                            : formatCreatedAt(group.created_at)}
                        </span>
                      </div>
                      {statusMeta ? (
                        <span className={`${classes.badge} ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      ) : null}
                    </div>
                    <span className="mono">{group.id.slice(0, 8)}</span>
                  </div>
                  <div className="review-meta">
                    <span className={classes.badge}>
                      Study cards: {stats ? stats.studyCount : "-"}
                    </span>
                    <span className={classes.badge}>
                      Questions: {stats ? stats.questionCount : "-"}
                    </span>
                    <span className={classes.badge}>
                      Due: {stats ? stats.dueCount : "-"}
                    </span>
                    {stats ? (
                      <span className={classes.badge}>
                        Stale: {stats.staleCount}
                      </span>
                    ) : null}
                  </div>
                  <div className={classes.buttonRow}>
                    {canCancelAuto ? (
                      <button
                        className={classes.smallDestructiveOutlineButton}
                        type="button"
                        onClick={() => onCancelAutoJob(autoJob.id)}
                        disabled={autoJobActionId === autoJob.id || isReviewOverlayVisible}
                      >
                        {autoJobActionId === autoJob.id ? "Cancelling..." : "Cancel auto"}
                      </button>
                    ) : null}
                    {canRetryAuto ? (
                      <button
                        className={classes.smallOutlineButton}
                        type="button"
                        onClick={() => onRetryAutoJob(autoJob.id)}
                        disabled={autoJobActionId === autoJob.id || isReviewOverlayVisible}
                      >
                        {autoJobActionId === autoJob.id ? "Retrying..." : "Retry auto"}
                      </button>
                    ) : null}
                    <button
                      className={classes.outlineButton}
                      type="button"
                      onClick={() => onNavigateToNoteGroup(group.id)}
                    >
                      {workflow ? "Open workflow" : "Open overview"}
                    </button>
                    <button
                      className={classes.outlineButton}
                      type="button"
                      onClick={() => onNavigateToNoteGroup(group.id, "study-cards")}
                      disabled={Boolean(workflow)}
                    >
                      Study cards
                    </button>
                    <button
                      className={classes.outlineButton}
                      type="button"
                      onClick={() => onNavigateToNoteGroup(group.id, "question-cards")}
                      disabled={Boolean(workflow)}
                    >
                      Question cards
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
