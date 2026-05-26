import { useEffect } from "react";

import { resolveAppConceptRoute } from "@/api";
import { isAuthReadyForRouteRestore } from "@/routes/routeRestore";

const withRouteRestoreTimeout = (promise, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out`)), 8000);
    })
  ]);

export function useConceptRouteResolution({
  auth,
  routeSubjectCode,
  routeModuleCode,
  routeConceptCode,
  setResolvedRouteContext,
  setSelectedSubjectId,
  setSelectedModuleId,
  setSelectedNoteGroupId,
  setSelectedConceptId,
  setSidebarScope,
  setChipFilterIds,
  setNoteGroupMode,
  setReviewSummary,
  setIsChatOpen,
  setIsMetadataOpen,
  setIsModuleMetadataOpen,
  setRouteRestoreError,
  onError
}) {
  useEffect(() => {
    if (!isAuthReadyForRouteRestore(auth)) {
      return undefined;
    }
    if (!routeConceptCode) {
      return undefined;
    }

    let cancelled = false;
    setRouteRestoreError("");

    const restoreConceptRoute = async () => {
      try {
        const context = await withRouteRestoreTimeout(
          resolveAppConceptRoute(routeSubjectCode, routeModuleCode, routeConceptCode),
          "Concept route restore"
        );
        if (cancelled) {
          return;
        }
        setResolvedRouteContext(context);
        setSelectedSubjectId(context.subject_id);
        setSelectedModuleId(context.module_id);
        setSelectedNoteGroupId("");
        setSelectedConceptId(context.concept_id || context.topic_id);
        setSidebarScope("concepts");
        setChipFilterIds([]);
        setNoteGroupMode("overview");
        setReviewSummary(null);
        setIsChatOpen(false);
        setIsMetadataOpen(false);
        setIsModuleMetadataOpen(false);
      } catch (error) {
        if (!cancelled) {
          setRouteRestoreError(error.message || "Unable to restore concept page");
          onError?.(error, "Failed to restore concept page");
        }
      }
    };

    restoreConceptRoute();
    return () => {
      cancelled = true;
    };
  }, [
    auth?.loading,
    onError,
    routeConceptCode,
    routeModuleCode,
    routeSubjectCode,
    setChipFilterIds,
    setIsChatOpen,
    setIsMetadataOpen,
    setIsModuleMetadataOpen,
    setNoteGroupMode,
    setResolvedRouteContext,
    setReviewSummary,
    setRouteRestoreError,
    setSelectedConceptId,
    setSelectedModuleId,
    setSelectedNoteGroupId,
    setSelectedSubjectId,
    setSidebarScope
  ]);
}
