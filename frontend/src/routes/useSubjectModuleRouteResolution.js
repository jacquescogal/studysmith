import { useEffect } from "react";

import { resolveAppModuleRoute, resolveAppSubjectRoute } from "@/api";
import { moduleRouteSidebarScope } from "@/lib/sidebarScope";
import { isAuthReadyForRouteRestore } from "@/routes/routeRestore";

const withRouteRestoreTimeout = (promise, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out`)), 8000);
    })
  ]);

export function useSubjectModuleRouteResolution({
  auth,
  locationState,
  routeSubjectPageCode,
  routeSubjectCode,
  routeModuleCode,
  routeNoteGroupCode,
  routeTopicCode,
  routeCreateNoteGroup,
  setResolvedRouteContext,
  setSelectedSubjectId,
  setSelectedModuleId,
  setSelectedNoteGroupId,
  setSelectedTopicId,
  setSidebarScope,
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
    if (!routeSubjectPageCode) {
      return undefined;
    }

    let cancelled = false;
    setRouteRestoreError("");

    const restoreSubjectRoute = async () => {
      try {
        const context = await withRouteRestoreTimeout(
          resolveAppSubjectRoute(routeSubjectPageCode),
          "Subject route restore"
        );
        if (cancelled) {
          return;
        }
        setResolvedRouteContext(context);
        setSelectedSubjectId(context.subject_id);
        setSelectedModuleId("");
        setSelectedNoteGroupId("");
        setSelectedTopicId("");
        setSidebarScope("note-groups");
        setNoteGroupMode("overview");
        setReviewSummary(null);
        setIsChatOpen(false);
        setIsMetadataOpen(false);
        setIsModuleMetadataOpen(false);
      } catch (error) {
        if (!cancelled) {
          setRouteRestoreError(error.message || "Unable to restore subject page");
          onError?.(error, "Failed to restore subject page");
        }
      }
    };

    restoreSubjectRoute();
    return () => {
      cancelled = true;
    };
  }, [
    auth?.loading,
    onError,
    routeSubjectPageCode,
    setIsChatOpen,
    setIsMetadataOpen,
    setIsModuleMetadataOpen,
    setNoteGroupMode,
    setResolvedRouteContext,
    setReviewSummary,
    setRouteRestoreError,
    setSelectedModuleId,
    setSelectedNoteGroupId,
    setSelectedSubjectId,
    setSelectedTopicId,
    setSidebarScope
  ]);

  useEffect(() => {
    if (!isAuthReadyForRouteRestore(auth)) {
      return undefined;
    }
    if (!routeModuleCode || routeNoteGroupCode || routeTopicCode) {
      return undefined;
    }

    let cancelled = false;
    setRouteRestoreError("");

    const restoreModuleRoute = async () => {
      try {
        const context = await withRouteRestoreTimeout(
          resolveAppModuleRoute(routeSubjectCode, routeModuleCode),
          "Module route restore"
        );
        if (cancelled) {
          return;
        }
        setResolvedRouteContext(context);
        setSelectedSubjectId(context.subject_id);
        setSelectedModuleId(context.module_id);
        setSelectedNoteGroupId("");
        setSelectedTopicId("");
        setSidebarScope(moduleRouteSidebarScope(locationState));
        setNoteGroupMode(routeCreateNoteGroup ? "auto" : "overview");
        setReviewSummary(null);
        setIsChatOpen(false);
        setIsMetadataOpen(false);
        setIsModuleMetadataOpen(false);
      } catch (error) {
        if (!cancelled) {
          setRouteRestoreError(error.message || "Unable to restore module page");
          onError?.(error, "Failed to restore module page");
        }
      }
    };

    restoreModuleRoute();
    return () => {
      cancelled = true;
    };
  }, [
    auth?.loading,
    locationState,
    onError,
    routeCreateNoteGroup,
    routeModuleCode,
    routeNoteGroupCode,
    routeSubjectCode,
    routeTopicCode,
    setIsChatOpen,
    setIsMetadataOpen,
    setIsModuleMetadataOpen,
    setNoteGroupMode,
    setResolvedRouteContext,
    setReviewSummary,
    setRouteRestoreError,
    setSelectedModuleId,
    setSelectedNoteGroupId,
    setSelectedSubjectId,
    setSelectedTopicId,
    setSidebarScope
  ]);
}
