import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDurationMs, formatPercent } from "@/lib/format";

export function NoteGroupProgress({
  progress,
  range,
  loading,
  error,
  onRangeChange,
  onOpenPerformance
}) {
  const summary = progress.summary;

  return (
    <section className="note-group-progress hero-card" id="note-group-progress">
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
      <div className="progress-hero-metrics">
        <div className="progress-hero-metric">
          <p className="label">Success rate</p>
          <p className="value">{formatPercent(summary.successRate)}</p>
        </div>
        <div className="progress-hero-metric">
          <p className="label">Mastery</p>
          <p className="value">{formatPercent(summary.masteryPercentage)}</p>
        </div>
        <div className="progress-hero-metric">
          <p className="label">Median time</p>
          <p className="value">{formatDurationMs(summary.medianResponseTimeMs)}</p>
        </div>
      </div>
    </section>
  );
}
