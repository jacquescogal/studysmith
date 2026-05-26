import { useEffect, useState } from "react";

import { getNoteGroupProgress } from "@/api";
import { normalizeNoteGroupProgress } from "@/lib/format";

export function useNoteGroupProgress({
  noteGroupId = "",
  selectedConceptId = "",
  range = "30d",
  chipFilterIds = [],
  refreshToken = 0,
  shouldHoldSelectedNoteGroupContent = false
} = {}) {
  const [noteGroupProgress, setNoteGroupProgress] = useState(normalizeNoteGroupProgress());
  const [noteGroupProgressLoading, setNoteGroupProgressLoading] = useState(false);
  const [noteGroupProgressError, setNoteGroupProgressError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!noteGroupId || selectedConceptId || shouldHoldSelectedNoteGroupContent) {
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
        const data = await getNoteGroupProgress(noteGroupId, range, chipFilterIds);
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
  }, [
    chipFilterIds,
    noteGroupId,
    range,
    refreshToken,
    selectedConceptId,
    shouldHoldSelectedNoteGroupContent
  ]);

  return {
    noteGroupProgress,
    noteGroupProgressLoading,
    noteGroupProgressError
  };
}
