import { useEffect, useState } from "react";

import {
  getConceptQuestionTimeline,
  getNoteGroupQuestionTimeline
} from "@/api";
import { normalizeTimeline } from "@/lib/format";

const emptyTimeline = {
  due: 0,
  week: 0,
  month: 0,
  sixMonths: 0,
  longTerm: 0
};

export function useQuestionTimeline({
  noteGroupId = "",
  conceptId = "",
  chipFilterIds = [],
  questionCards = [],
  refreshToken = 0,
  shouldHoldSelectedNoteGroupContent = false
} = {}) {
  const [questionTimeline, setQuestionTimeline] = useState(emptyTimeline);

  useEffect(() => {
    let cancelled = false;
    if ((!noteGroupId && !conceptId) || shouldHoldSelectedNoteGroupContent) {
      setQuestionTimeline(emptyTimeline);
      return () => {
        cancelled = true;
      };
    }

    const loadTimeline = async () => {
      try {
        const data = conceptId
          ? await getConceptQuestionTimeline(conceptId)
          : await getNoteGroupQuestionTimeline(noteGroupId, chipFilterIds);
        if (!cancelled) {
          setQuestionTimeline(normalizeTimeline(data.timeline));
        }
      } catch {
        if (!cancelled) {
          setQuestionTimeline(emptyTimeline);
        }
      }
    };

    loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [
    chipFilterIds,
    conceptId,
    noteGroupId,
    questionCards,
    refreshToken,
    shouldHoldSelectedNoteGroupContent
  ]);

  return questionTimeline;
}
