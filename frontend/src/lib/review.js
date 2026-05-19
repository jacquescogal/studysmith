export const MASTERY_MAX = 10;
export const MASTERY_LOW_MAX = 3;
export const MASTERY_MEDIUM_MAX = 6;

export function buildReviewCard(card) {
  const options = Array.isArray(card.options) ? card.options : [];
  const explanations = Array.isArray(card.option_explanations) ? card.option_explanations : [];
  if (!options.length) {
    return {
      ...card,
      reviewOptions: options,
      reviewCorrectIndices: card.correct_option_indices || [],
      reviewOptionExplanations: explanations,
      reviewChoices: []
    };
  }

  const indices = options.map((_, idx) => idx);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const newIndexByOld = new Map();
  indices.forEach((oldIndex, newIndex) => {
    newIndexByOld.set(oldIndex, newIndex);
  });

  const reviewChoices = indices.map((idx) => ({
    text: options[idx],
    explanation: explanations[idx] || "",
    originalIndex: idx
  }));

  return {
    ...card,
    reviewOptions: reviewChoices.map((choice) => choice.text),
    reviewCorrectIndices: (card.correct_option_indices || [])
      .map((idx) => newIndexByOld.get(idx))
      .filter((idx) => Number.isInteger(idx)),
    reviewOptionExplanations: reviewChoices.map((choice) => choice.explanation),
    reviewChoices
  };
}

export function getMasteryScore(card) {
  const difficulty = Number(card?.difficulty);
  if (!Number.isFinite(difficulty) || difficulty <= 0) {
    return null;
  }
  const score = MASTERY_MAX - difficulty;
  return Math.max(0, Math.min(MASTERY_MAX, score));
}

export function getMasteryTier(score) {
  if (score === null) {
    return "unknown";
  }
  if (score <= MASTERY_LOW_MAX) {
    return "low";
  }
  if (score <= MASTERY_MEDIUM_MAX) {
    return "medium";
  }
  return "high";
}
