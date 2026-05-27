import { useEffect, useState } from "react";

import { getModuleCardTable } from "@/api";

const emptyCardTable = {
  rows: [],
  unlinked_question_count: 0
};

export function useModuleCardTable({ moduleId = "", isViewCardsPage = false } = {}) {
  const [moduleCardTable, setModuleCardTable] = useState(emptyCardTable);
  const [moduleCardTableLoading, setModuleCardTableLoading] = useState(false);
  const [moduleCardTableError, setModuleCardTableError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!moduleId || !isViewCardsPage) {
      setModuleCardTable(emptyCardTable);
      setModuleCardTableError("");
      setModuleCardTableLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadCardTable = async () => {
      setModuleCardTableLoading(true);
      setModuleCardTableError("");
      try {
        const data = await getModuleCardTable(moduleId);
        if (!cancelled) {
          setModuleCardTable({
            rows: data.rows || [],
            unlinked_question_count: data.unlinked_question_count || 0
          });
        }
      } catch (error) {
        if (!cancelled) {
          setModuleCardTable(emptyCardTable);
          setModuleCardTableError(error.message || "Failed to load View Cards");
        }
      } finally {
        if (!cancelled) {
          setModuleCardTableLoading(false);
        }
      }
    };

    loadCardTable();
    return () => {
      cancelled = true;
    };
  }, [isViewCardsPage, moduleId]);

  return {
    moduleCardTable,
    moduleCardTableLoading,
    moduleCardTableError
  };
}
