import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TopicOverview({
  topic,
  stats,
  description = "Snapshot of study and question cards for this topic.",
  actions,
  error,
  children
}) {
  return (
    <Card id="topic-overview">
      <CardHeader>
        <CardTitle>{topic?.label || "Topic overview"}</CardTitle>
        <CardDescription>{description || topic?.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="stats-grid">
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
        <div className="flex flex-wrap gap-2">{actions}</div>
        <ErrorAlert title="Topic action failed" message={error} />
        {children}
      </CardContent>
    </Card>
  );
}
