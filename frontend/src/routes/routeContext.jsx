import React, { createContext, useContext, useMemo } from "react";
import { useParams } from "react-router-dom";

const AppRouteContext = createContext({
  scope: "root",
  subjectCode: undefined,
  moduleCode: undefined,
  noteGroupCode: undefined,
  conceptCode: undefined
});

export function AppRouteContextProvider({ scope, children }) {
  const params = useParams();
  const value = useMemo(
    () => ({
      scope,
      subjectCode: params.subjectCode,
      moduleCode: params.moduleCode,
      noteGroupCode: params.noteGroupCode,
      conceptCode: params.conceptCode
    }),
    [params.conceptCode, params.moduleCode, params.noteGroupCode, params.subjectCode, scope]
  );

  return <AppRouteContext.Provider value={value}>{children}</AppRouteContext.Provider>;
}

export function useAppRouteContext() {
  return useContext(AppRouteContext);
}

export function useSubjectRouteContext() {
  const context = useAppRouteContext();
  return {
    subjectCode: context.subjectCode
  };
}

export function useModuleRouteContext() {
  const context = useAppRouteContext();
  return {
    subjectCode: context.subjectCode,
    moduleCode: context.moduleCode
  };
}

export function useNoteGroupRouteContext() {
  const context = useAppRouteContext();
  return {
    subjectCode: context.subjectCode,
    moduleCode: context.moduleCode,
    noteGroupCode: context.noteGroupCode
  };
}

export function useConceptRouteContext() {
  const context = useAppRouteContext();
  return {
    subjectCode: context.subjectCode,
    moduleCode: context.moduleCode,
    conceptCode: context.conceptCode
  };
}
