import { useEffect, useState } from "react";

import { listPublicSubjects, listSubjects } from "@/api";

export function useSubjects({
  authLoading = false,
  isAuthenticated = false,
  userId = "",
  onError
} = {}) {
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    if (authLoading) {
      return undefined;
    }

    let cancelled = false;
    const loadSubjects = isAuthenticated ? listSubjects : listPublicSubjects;

    loadSubjects()
      .then((data) => {
        if (!cancelled) {
          setSubjects(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          onError?.(error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, onError, userId]);

  return { subjects, setSubjects };
}
