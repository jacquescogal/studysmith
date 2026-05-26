import { useEffect, useState } from "react";

import { listModules } from "@/api";

export function useSubjectModules({ subjectId = "", onError } = {}) {
  const [modules, setModules] = useState([]);

  useEffect(() => {
    if (!subjectId) {
      setModules([]);
      return undefined;
    }

    let cancelled = false;

    listModules(subjectId)
      .then((data) => {
        if (!cancelled) {
          setModules(data);
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
  }, [onError, subjectId]);

  return { modules, setModules };
}
