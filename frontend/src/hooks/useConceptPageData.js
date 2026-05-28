import { useEffect, useState } from "react";

import { getConceptMindMap, getConceptQuestionTimeline } from "@/api";
import { normalizeTimeline } from "@/lib/format";

const emptyTimeline = {
  due: 0,
  week: 0,
  month: 0,
  sixMonths: 0,
  longTerm: 0
};

export function useConceptPageData({
  conceptId = "",
  questionCards = [],
  includeDescendantStudyCards = true,
  reviewRefreshToken = 0,
  mindMapRefreshToken = 0,
  shouldHoldContent = false
} = {}) {
  const [conceptMindMap, setConceptMindMap] = useState(null);
  const [conceptMindMapLoading, setConceptMindMapLoading] = useState(false);
  const [conceptMindMapError, setConceptMindMapError] = useState("");
  const [questionTimeline, setQuestionTimeline] = useState(emptyTimeline);

  useEffect(() => {
    let cancelled = false;
    if (!conceptId || shouldHoldContent) {
      setConceptMindMap(null);
      setConceptMindMapError("");
      setConceptMindMapLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadConceptMindMap = async () => {
      setConceptMindMapLoading(true);
      setConceptMindMapError("");
      try {
        const data = await getConceptMindMap(conceptId);
        if (!cancelled) {
          setConceptMindMap(data);
        }
      } catch (error) {
        if (!cancelled) {
          setConceptMindMap(null);
          setConceptMindMapError(error.message || "Failed to load Concept Mind Map");
        }
      } finally {
        if (!cancelled) {
          setConceptMindMapLoading(false);
        }
      }
    };

    loadConceptMindMap();
    return () => {
      cancelled = true;
    };
  }, [conceptId, mindMapRefreshToken, shouldHoldContent]);

  useEffect(() => {
    let cancelled = false;
    if (!conceptId || shouldHoldContent) {
      setQuestionTimeline(emptyTimeline);
      return () => {
        cancelled = true;
      };
    }

    const loadTimeline = async () => {
      try {
        const data = await getConceptQuestionTimeline(conceptId, {
          includeDescendants: includeDescendantStudyCards
        });
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
    conceptId,
    includeDescendantStudyCards,
    questionCards,
    reviewRefreshToken,
    shouldHoldContent
  ]);

  return {
    conceptMindMap,
    setConceptMindMap,
    conceptMindMapLoading,
    setConceptMindMapLoading,
    conceptMindMapError,
    setConceptMindMapError,
    questionTimeline,
    setQuestionTimeline
  };
}
