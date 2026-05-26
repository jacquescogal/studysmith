import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ModuleOverview({
  title,
  description,
  noteGroupCount = 0,
  stats,
  timeline,
  loading,
  error,
  actions,
  filterControls,
  noteGroups = []
}) {
  return (
    <div className="space-y-6">
      <section id="module-overview" className="module-overview-shell">
        <div className="module-overview-header">
          <div className="module-overview-title-block">
            <h2>{title || "Module overview"}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <div className="module-overview-metrics">
            <Badge variant="outline" className="metric-chip">Note Groups: {noteGroupCount}</Badge>
            <Badge variant="outline" className="metric-chip">Study Cards: {loading ? "..." : stats?.studyCount ?? 0}</Badge>
            <Badge variant="outline" className="metric-chip">Question Cards: {loading ? "..." : stats?.questionCount ?? 0}</Badge>
            <Badge variant="outline" className="metric-chip">Due: {loading ? "..." : stats?.dueCount ?? 0}</Badge>
          </div>
        </div>
        <div className="module-overview-body">
          {filterControls}
          {timeline ? (
            <p className="text-sm text-muted-foreground">
              Due {timeline.due} · Week {timeline.week} · Month {timeline.month} · 6 months {timeline.sixMonths} · Long term {timeline.longTerm}
            </p>
          ) : null}
          {loading ? <p className="text-sm text-muted-foreground">Loading module stats...</p> : null}
          {actions ? <div className="module-overview-actions">{actions}</div> : null}
          <ErrorAlert title="Module overview failed" message={error} />
        </div>
      </section>
      {noteGroups.length ? (
        <div className="grid gap-4">
          {noteGroups.map((group) => (
            <Card key={group.id || group.value}>
              <CardHeader>
                <CardTitle>{group.title || group.label}</CardTitle>
                {group.description ? <CardDescription>{group.description}</CardDescription> : null}
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
