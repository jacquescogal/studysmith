import { useEffect, useState } from "react";

import {
  getNoteGroupCardTable,
  getNoteGroupMindMap,
  getNoteGroupProgress,
  getNoteGroupQuestionTimeline
} from "@/api";
import { normalizeNoteGroupProgress, normalizeTimeline } from "@/lib/format";

const emptyTimeline = {
  due: 0,
  week: 0,
  month: 0,
  sixMonths: 0,
  longTerm: 0
};

export function useNoteGroupPageData({
  noteGroupId = "",
  selectedConceptId = "",
  chipFilterIds = [],
  questionCards = [],
  progressRange = "30d",
  reviewRefreshToken = 0,
  mindMapRefreshToken = 0,
  isViewCardsPage = false,
  shouldHoldContent = false
} = {}) {
  const [noteGroupMindMap, setNoteGroupMindMap] = useState(null);
  const [noteGroupMindMapLoading, setNoteGroupMindMapLoading] = useState(false);
  const [noteGroupMindMapError, setNoteGroupMindMapError] = useState("");
  const [noteGroupMindMapGenerating, setNoteGroupMindMapGenerating] = useState(false);
  const [questionTimeline, setQuestionTimeline] = useState(emptyTimeline);
  const [noteGroupProgress, setNoteGroupProgress] = useState(normalizeNoteGroupProgress());
  const [noteGroupProgressLoading, setNoteGroupProgressLoading] = useState(false);
  const [noteGroupProgressError, setNoteGroupProgressError] = useState("");
  const [noteGroupCardTable, setNoteGroupCardTable] = useState({
    rows: [],
    unlinked_question_count: 0
  });
  const [noteGroupCardTableLoading, setNoteGroupCardTableLoading] = useState(false);
  const [noteGroupCardTableError, setNoteGroupCardTableError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!noteGroupId || selectedConceptId || shouldHoldContent) {
      setNoteGroupMindMap(null);
      setNoteGroupMindMapError("");
      setNoteGroupMindMapLoading(false);
      setNoteGroupMindMapGenerating(false);
      return () => {
        cancelled = true;
      };
    }

    const loadNoteGroupMindMap = async () => {
      setNoteGroupMindMapLoading(true);
      setNoteGroupMindMapError("");
      try {
        const data = await getNoteGroupMindMap(noteGroupId);
        if (!cancelled) {
          setNoteGroupMindMap(data);
        }
      } catch (error) {
        if (!cancelled) {
          setNoteGroupMindMap(null);
          setNoteGroupMindMapError(error.message || "Failed to load Note Group Mind Map");
        }
      } finally {
        if (!cancelled) {
          setNoteGroupMindMapLoading(false);
        }
      }
    };

    loadNoteGroupMindMap();
    return () => {
      cancelled = true;
    };
  }, [mindMapRefreshToken, noteGroupId, selectedConceptId, shouldHoldContent]);

  useEffect(() => {
    let cancelled = false;
    if (!noteGroupId || selectedConceptId || shouldHoldContent) {
      setQuestionTimeline(emptyTimeline);
      return () => {
        cancelled = true;
      };
    }

    const loadTimeline = async () => {
      try {
        const data = await getNoteGroupQuestionTimeline(noteGroupId, chipFilterIds);
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
  }, [chipFilterIds, noteGroupId, questionCards, reviewRefreshToken, selectedConceptId, shouldHoldContent]);

  useEffect(() => {
    let cancelled = false;
    if (!noteGroupId || selectedConceptId || shouldHoldContent) {
      setNoteGroupProgress(normalizeNoteGroupProgress());
      setNoteGroupProgressError("");
      setNoteGroupProgressLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadProgress = async () => {
      setNoteGroupProgressLoading(true);
      setNoteGroupProgressError("");
      try {
        const data = await getNoteGroupProgress(noteGroupId, progressRange, chipFilterIds);
        if (!cancelled) {
          setNoteGroupProgress(normalizeNoteGroupProgress(data));
        }
      } catch (error) {
        if (!cancelled) {
          setNoteGroupProgress(normalizeNoteGroupProgress());
          setNoteGroupProgressError(error.message || "Failed to load progress");
        }
      } finally {
        if (!cancelled) {
          setNoteGroupProgressLoading(false);
        }
      }
    };

    loadProgress();
    return () => {
      cancelled = true;
    };
  }, [chipFilterIds, noteGroupId, progressRange, reviewRefreshToken, selectedConceptId, shouldHoldContent]);

  useEffect(() => {
    let cancelled = false;
    if (!noteGroupId || selectedConceptId || !isViewCardsPage || shouldHoldContent) {
      setNoteGroupCardTable({ rows: [], unlinked_question_count: 0 });
      setNoteGroupCardTableError("");
      setNoteGroupCardTableLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadCardTable = async () => {
      setNoteGroupCardTableLoading(true);
      setNoteGroupCardTableError("");
      try {
        const data = await getNoteGroupCardTable(noteGroupId);
        if (!cancelled) {
          setNoteGroupCardTable({
            rows: data.rows || [],
            unlinked_question_count: data.unlinked_question_count || 0
          });
        }
      } catch (error) {
        if (!cancelled) {
          setNoteGroupCardTable({ rows: [], unlinked_question_count: 0 });
          setNoteGroupCardTableError(error.message || "Failed to load View Cards");
        }
      } finally {
        if (!cancelled) {
          setNoteGroupCardTableLoading(false);
        }
      }
    };

    loadCardTable();
    return () => {
      cancelled = true;
    };
  }, [isViewCardsPage, noteGroupId, selectedConceptId, shouldHoldContent]);

  return {
    noteGroupMindMap,
    setNoteGroupMindMap,
    noteGroupMindMapLoading,
    setNoteGroupMindMapLoading,
    noteGroupMindMapError,
    setNoteGroupMindMapError,
    noteGroupMindMapGenerating,
    setNoteGroupMindMapGenerating,
    questionTimeline,
    setQuestionTimeline,
    noteGroupProgress,
    setNoteGroupProgress,
    noteGroupProgressLoading,
    setNoteGroupProgressLoading,
    noteGroupProgressError,
    setNoteGroupProgressError,
    noteGroupCardTable,
    setNoteGroupCardTable,
    noteGroupCardTableLoading,
    setNoteGroupCardTableLoading,
    noteGroupCardTableError,
    setNoteGroupCardTableError
  };
}
