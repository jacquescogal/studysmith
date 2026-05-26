import { useEffect } from "react";

import { resolveAppNoteGroupRoute } from "@/api";
import { isAuthReadyForRouteRestore } from "@/routes/routeRestore";

const withRouteRestoreTimeout = (promise, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out`)), 8000);
    })
  ]);

export function useNoteGroupRouteResolution({
  auth,
  routeSubjectCode,
  routeModuleCode,
  routeNoteGroupCode,
  setResolvedRouteContext,
  setSelectedSubjectId,
  setSelectedModuleId,
  setSelectedNoteGroupId,
  setNoteGroupMode,
  setRouteRestoreError
}) {
  useEffect(() => {
    if (!isAuthReadyForRouteRestore(auth)) {
      return undefined;
    }
    if (!routeNoteGroupCode) {
      return undefined;
    }

    let cancelled = false;
    setRouteRestoreError("");
    setNoteGroupMode("overview");

    const restoreNoteGroupRoute = async () => {
      try {
        const context = await withRouteRestoreTimeout(
          resolveAppNoteGroupRoute(routeSubjectCode, routeModuleCode, routeNoteGroupCode),
          "Note group route restore"
        );
        if (cancelled) {
          return;
        }
        setResolvedRouteContext(context);
        setSelectedSubjectId(context.subject_id);
        setSelectedModuleId(context.module_id);
        setSelectedNoteGroupId(context.note_group_id);
      } catch (error) {
        if (!cancelled) {
          setRouteRestoreError(error.message || "Unable to restore note group page");
        }
      }
    };

    restoreNoteGroupRoute();
    return () => {
      cancelled = true;
    };
  }, [
    auth?.loading,
    routeModuleCode,
    routeNoteGroupCode,
    routeSubjectCode,
    setNoteGroupMode,
    setResolvedRouteContext,
    setRouteRestoreError,
    setSelectedModuleId,
    setSelectedNoteGroupId,
    setSelectedSubjectId
  ]);
}
