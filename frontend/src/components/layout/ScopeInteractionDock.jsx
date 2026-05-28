import { BookOpen, Layers3, Map, RotateCcw, Settings, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const iconById = {
  "mind-map": Map,
  "view-cards": Table2,
  study: BookOpen,
  review: RotateCcw
};

export function getReviewCountFromSliderValue(value, maxCount) {
  const maxReviewCount = Math.max(0, Number(maxCount) || 0);
  if (maxReviewCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(1, Number(value) + 1 || 1), maxReviewCount);
}

export function ScopeInteractionDock({
  scopeLabel,
  actions = [],
  review = null,
  settings = null,
  studyCardScope = null
}) {
  const maxReviewCount = Math.max(0, Number(review?.maxCount) || 0);
  const reviewCount = Number(review?.count) || (maxReviewCount > 0 ? 1 : 0);
  const boundedReviewCount =
    maxReviewCount > 0 ? Math.min(Math.max(1, reviewCount), maxReviewCount) : 0;
  const reviewControlsDisabled = Boolean(review?.disabled) || maxReviewCount <= 0;
  const reviewSliderValue = maxReviewCount > 0 ? boundedReviewCount - 1 : 0;
  const reviewSliderMax = maxReviewCount > 0 ? maxReviewCount - 1 : 0;

  return (
    <aside className="scope-interaction-dock" aria-label={`${scopeLabel} interaction dock`}>
      <div className="scope-interaction-dock-header">
        <div className="scope-interaction-dock-title">
          <span className="scope-interaction-dock-kicker">Dock</span>
          <h2>{scopeLabel}</h2>
        </div>
        {settings ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="scope-dock-settings-button"
            onClick={settings.onClick}
            disabled={settings.disabled}
            aria-label={settings.label}
            title={settings.disabledReason || settings.label}
          >
            <Settings className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <div className="scope-interaction-dock-actions">
        {actions.map((action) => {
          const Icon = iconById[action.id] || Layers3;
          return (
            <Button
              key={action.id}
              type="button"
              variant={action.active ? "default" : "outline"}
              className="scope-dock-action"
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.disabledReason || action.label}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{action.label}</span>
              {typeof action.count === "number" ? (
                <span className="scope-dock-count">{action.count}</span>
              ) : null}
            </Button>
          );
        })}
      </div>
      {studyCardScope ? (
        <label className="scope-dock-toggle">
          <input
            type="checkbox"
            checked={studyCardScope.includeDescendants !== false}
            onChange={(event) => studyCardScope.onIncludeDescendantsChange?.(event.target.checked)}
          />
          <span>{studyCardScope.label || "Include descendant Study Cards"}</span>
        </label>
      ) : null}
      {review ? (
        <div className="scope-dock-review">
          <div className="scope-dock-review-divider" aria-hidden="true" />
          <div className="scope-dock-review-title">Review Questions</div>
          <div className="scope-dock-review-header">
            <span>Total</span>
            <span className="scope-dock-count">{maxReviewCount}</span>
          </div>
          <div className="scope-dock-review-header">
            <span>Due</span>
            <span className="scope-dock-count">{Number(review.dueCount) || 0}</span>
          </div>
          <Button
            type="button"
            variant="default"
            className="scope-dock-action"
            onClick={review.onReviewDue}
            disabled={reviewControlsDisabled}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            <span>Review Due</span>
          </Button>
          <label className="scope-dock-slider">
            <input
              aria-label="Review count"
              type="range"
              min={0}
              max={reviewSliderMax}
              value={reviewSliderValue}
              onChange={(event) =>
                review.onCountChange?.(getReviewCountFromSliderValue(event.target.value, maxReviewCount))
              }
              disabled={reviewControlsDisabled || maxReviewCount <= 1}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className="scope-dock-action"
            onClick={() => review.onReviewCount?.(boundedReviewCount)}
            disabled={reviewControlsDisabled}
          >
            Review {boundedReviewCount}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
