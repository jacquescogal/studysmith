import { useEffect, useState } from "react";

import { getNoteGroupMindMap } from "@/api";

export function useNoteGroupMindMap({
  noteGroupId = "",
  selectedConceptId = "",
  refreshToken = 0,
  shouldHoldSelectedNoteGroupContent = false
} = {}) {
  const [noteGroupMindMap, setNoteGroupMindMap] = useState(null);
  const [noteGroupMindMapLoading, setNoteGroupMindMapLoading] = useState(false);
  const [noteGroupMindMapError, setNoteGroupMindMapError] = useState("");
  const [noteGroupMindMapGenerating, setNoteGroupMindMapGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!noteGroupId || selectedConceptId || shouldHoldSelectedNoteGroupContent) {
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
  }, [noteGroupId, selectedConceptId, refreshToken, shouldHoldSelectedNoteGroupContent]);

  return {
    noteGroupMindMap,
    setNoteGroupMindMap,
    noteGroupMindMapLoading,
    noteGroupMindMapError,
    setNoteGroupMindMapError,
    noteGroupMindMapGenerating,
    setNoteGroupMindMapGenerating
  };
}
