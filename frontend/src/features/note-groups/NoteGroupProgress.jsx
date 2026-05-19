import { AlertTriangle } from "lucide-react";

import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDurationMs, formatPercent } from "@/lib/format";

function ProgressLine({ buckets }) {
  const points = buckets.length ? buckets : [{ date: "", success_rate: 0 }];
  const maxIndex = Math.max(points.length - 1, 1);
  const path = points
    .map((bucket, index) => {
      const x = (index / maxIndex) * 100;
      const y = 100 - Math.max(0, Math.min(100, Number(bucket.success_rate) || 0));
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <svg className="progress-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function ActivityBars({ buckets }) {
  const max = Math.max(...buckets.map((bucket) => Number(bucket.review_count) || 0), 1);
  return (
    <div className="progress-activity-bars">
      {buckets.map((bucket) => {
        const correct = Number(bucket.correct) || 0;
        const incorrect = Number(bucket.incorrect) || 0;
        const height = Math.max(6, ((correct + incorrect) / max) * 100);
        return (
          <div
            key={bucket.date}
            className="progress-activity-bar"
            style={{ height: `${height}%` }}
            title={`${bucket.date}: ${correct} correct, ${incorrect} incorrect`}
          >
            <span className="correct" style={{ flexGrow: correct }} />
            <span className="incorrect" style={{ flexGrow: incorrect }} />
          </div>
        );
      })}
    </div>
  );
}

export function NoteGroupProgress({
  progress,
  range,
  loading,
  error,
  onRangeChange,
  onOpenPerformance
}) {
  const summary = progress.summary;
  const distribution = progress.masteryDistribution;
  const distributionTotal =
    distribution.low + distribution.medium + distribution.high + distribution.unknown || 1;

  return (
    <section className="note-group-progress" id="note-group-progress">
      <div className="note-group-progress-header">
        <div>
          <span className="overview-kicker">Progress</span>
          <h2>Learning progress</h2>
        </div>
        <div className="note-group-progress-controls">
          <Select value={range} onValueChange={onRangeChange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={onOpenPerformance}>
            Details
          </Button>
        </div>
      </div>
      <ErrorAlert title="Progress failed" message={error} />
      {loading ? <p className="text-sm text-muted-foreground">Loading progress...</p> : null}
      <div className="stats-grid">
        <div className="stat-card">
          <p className="label">Success rate</p>
          <p className="value">{formatPercent(summary.successRate)}</p>
        </div>
        <div className="stat-card">
          <p className="label">Mastery</p>
          <p className="value">{formatPercent(summary.masteryPercentage)}</p>
        </div>
        <div className="stat-card">
          <p className="label">Reviewed cards</p>
          <p className="value">
            {summary.reviewedCardCount} / {summary.questionCount}
          </p>
        </div>
        <div className="stat-card">
          <p className="label">Median time</p>
          <p className="value">{formatDurationMs(summary.medianResponseTimeMs)}</p>
        </div>
      </div>
      <div className="note-group-progress-grid">
        <Card>
          <CardHeader>
            <CardTitle>Success over time</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressLine buckets={progress.trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Review activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityBars buckets={progress.activity} />
          </CardContent>
        </Card>
      </div>
      <div className="mastery-segment" aria-label="Mastery distribution">
        {["low", "medium", "high", "unknown"].map((tier) => (
          <span
            key={tier}
            className={`mastery-segment-part ${tier}`}
            style={{ width: `${(distribution[tier] / distributionTotal) * 100}%` }}
          />
        ))}
      </div>
      {progress.needsAttention.length ? (
        <div className="needs-attention-list">
          {progress.needsAttention.map((item) => (
            <div key={item.id} className="needs-attention-item">
              <AlertTriangle className="size-4" />
              <span>{item.prompt}</span>
              <Badge variant="outline">{item.reason}</Badge>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
