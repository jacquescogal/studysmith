import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NoteGroupOverview({
  noteGroup,
  statusMeta,
  stats,
  topics = [],
  concepts = [],
  description = "Snapshot of your current note group.",
  filterControls,
  actions,
  error,
  children
}) {
  const visibleConcepts = concepts.length ? concepts : topics;
  return (
    <Card id="note-group-overview" className="note-group-overview-card">
      <CardHeader className="note-group-overview-header">
        <div className="note-group-overview-heading">
          <div className="note-group-overview-title-block">
            <CardTitle>{noteGroup?.title || "Note Group overview"}</CardTitle>
            <CardDescription>{description || noteGroup?.source}</CardDescription>
          </div>
          {statusMeta ? (
            <Badge variant="outline" className={`note-group-status-badge ${statusMeta.className}`}>
              {statusMeta.label}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="note-group-overview-content">
        {filterControls}
        <div className="stats-grid note-group-stats-grid">
          <div className="stat-card">
            <p className="label">Study cards</p>
            <p className="value">{stats?.studyCount ?? 0}</p>
          </div>
          <div className="stat-card">
            <p className="label">Question cards</p>
            <p className="value">{stats?.questionCount ?? 0}</p>
          </div>
          <div className="stat-card">
            <p className="label">Due now</p>
            <p className="value">{stats?.dueCount ?? 0}</p>
          </div>
          <div className="stat-card">
            <p className="label">Stale questions</p>
            <p className="value">{stats?.staleCount ?? 0}</p>
          </div>
        </div>
        {visibleConcepts.length ? (
          <div className="flex flex-wrap gap-2">
            {visibleConcepts.map((topic) => (
              <Badge key={topic.id || topic.value} variant="outline" className="topic-chip">
                {topic.label}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="note-group-action-row">{actions}</div>
        <ErrorAlert title="Note Group action failed" message={error} />
        {children}
      </CardContent>
    </Card>
  );
}
