export const formatCreatedAt = (value) => {
  if (!value) {
    return "Created: —";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Created: —";
  }
  return `Created: ${date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  })}`;
};

export const normalizeNoteGroups = (groups) => {
  if (!Array.isArray(groups)) {
    return [];
  }
  const hasCustomOrder = groups.some(
    (group) => group.sort_order !== null && group.sort_order !== undefined
  );
  if (hasCustomOrder) {
    return groups;
  }
  return [...groups].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : Number.POSITIVE_INFINITY;
    const safeATime = Number.isNaN(aTime) ? Number.POSITIVE_INFINITY : aTime;
    const safeBTime = Number.isNaN(bTime) ? Number.POSITIVE_INFINITY : bTime;
    return safeATime - safeBTime;
  });
};

export const getModuleAdditionalInstructions = (module) => {
  const value = module?.settings?.additional_generation_instructions;
  if (typeof value === "string") {
    return value;
  }
  return "";
};

export const countWords = (value) => {
  if (!value) {
    return 0;
  }
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
};

export const normalizeTimeline = (timeline = {}) => ({
  due: Number.isInteger(timeline.due) ? timeline.due : 0,
  week: Number.isInteger(timeline.week) ? timeline.week : 0,
  month: Number.isInteger(timeline.month) ? timeline.month : 0,
  sixMonths: Number.isInteger(timeline.six_months)
    ? timeline.six_months
    : Number.isInteger(timeline.sixMonths)
      ? timeline.sixMonths
      : 0,
  longTerm: Number.isInteger(timeline.long_term)
    ? timeline.long_term
    : Number.isInteger(timeline.longTerm)
      ? timeline.longTerm
    : 0
});

export const formatPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0%";
  }
  return `${number.toFixed(number % 1 === 0 ? 0 : 1)}%`;
};

export const formatDurationMs = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }
  if (number < 1000) {
    return `${Math.round(number)} ms`;
  }
  return `${(number / 1000).toFixed(1)} s`;
};

export const normalizeNoteGroupProgress = (data = {}) => ({
  summary: {
    successRate: Number(data.summary?.success_rate) || 0,
    masteryPercentage: Number(data.summary?.mastery_percentage) || 0,
    reviewedCardCount: Number(data.summary?.reviewed_card_count) || 0,
    questionCount: Number(data.summary?.question_count) || 0,
    totalReviews: Number(data.summary?.total_reviews) || 0,
    medianResponseTimeMs: Number.isFinite(Number(data.summary?.median_response_time_ms))
      ? Number(data.summary.median_response_time_ms)
      : null
  },
  trend: Array.isArray(data.trend) ? data.trend : [],
  activity: Array.isArray(data.activity) ? data.activity : [],
  masteryDistribution: {
    low: Number(data.mastery_distribution?.low) || 0,
    medium: Number(data.mastery_distribution?.medium) || 0,
    high: Number(data.mastery_distribution?.high) || 0,
    unknown: Number(data.mastery_distribution?.unknown) || 0
  },
  needsAttention: Array.isArray(data.needs_attention) ? data.needs_attention : []
});

export const formatAnswerLabels = (card, indices) => {
  if (!card || !Array.isArray(indices) || indices.length === 0) {
    return "No answer";
  }
  const options = card.reviewChoices
    ? card.reviewChoices.map((choice) => choice.text)
    : card.reviewOptions || card.options || [];
  const labels = indices
    .map((index) => options?.[index])
    .filter((option) => Boolean(option));
  return labels.length ? labels.join(", ") : "No answer";
};

export const getNoteGroupStatusMeta = (status) => {
  if (!status || status === "complete") {
    return null;
  }
  if (status === "queued") {
    return { label: "Queued", className: "status-queued" };
  }
  if (status === "generating") {
    return { label: "Generating", className: "status-running" };
  }
  if (status === "failed") {
    return { label: "Failed", className: "status-failed" };
  }
  if (status === "cancelled") {
    return { label: "Cancelled", className: "status-failed" };
  }
  if (status === "created") {
    return { label: "Draft", className: "status-queued" };
  }
  return { label: status, className: "status-queued" };
};
