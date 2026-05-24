export function isAuthReadyForRouteRestore(auth) {
  return !auth?.loading;
}
