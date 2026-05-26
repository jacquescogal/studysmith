import { useEffect, useState } from "react";

import { getNoteGroupCardTable } from "@/api";

const emptyCardTable = {
  rows: [],
  unlinked_question_count: 0
};

export function useNoteGroupCardTable({
  noteGroupId = "",
  selectedConceptId = "",
  isViewCardsPage = false,
  shouldHoldSelectedNoteGroupContent = false
} = {}) {
  const [noteGroupCardTable, setNoteGroupCardTable] = useState(emptyCardTable);
  const [noteGroupCardTableLoading, setNoteGroupCardTableLoading] = useState(false);
  const [noteGroupCardTableError, setNoteGroupCardTableError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!noteGroupId || selectedConceptId || !isViewCardsPage || shouldHoldSelectedNoteGroupContent) {
      setNoteGroupCardTable(emptyCardTable);
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
          setNoteGroupCardTable(emptyCardTable);
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
  }, [isViewCardsPage, noteGroupId, selectedConceptId, shouldHoldSelectedNoteGroupContent]);

  return {
    noteGroupCardTable,
    setNoteGroupCardTable,
    noteGroupCardTableLoading,
    noteGroupCardTableError
  };
}
