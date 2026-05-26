export function isAuthReadyForRouteRestore(auth) {
  return !auth?.loading;
}

export function shouldBlockForRouteRestore({
  hasAppRouteTarget,
  authLoading,
  resolvedRouteMatches,
  hasUnresolvedRouteTarget,
  routeRestoreError
}) {
  if (!hasAppRouteTarget || routeRestoreError) {
    return false;
  }
  return Boolean(authLoading || !resolvedRouteMatches || hasUnresolvedRouteTarget);
}

export function shouldClearSelectedSubject({
  selectedSubjectId,
  subjects,
  hasAppRouteTarget,
  routeSubjectId
}) {
  if (!selectedSubjectId) {
    return false;
  }
  if (Array.isArray(subjects) && subjects.some((subject) => subject.id === selectedSubjectId)) {
    return false;
  }
  if (hasAppRouteTarget && routeSubjectId && selectedSubjectId === routeSubjectId) {
    return false;
  }
  return true;
}
