import { Outlet } from "react-router-dom";

import { AppRouteContextProvider } from "./routeContext";

export function AppRouteRootLayout() {
  return (
    <AppRouteContextProvider scope="root">
      <Outlet />
    </AppRouteContextProvider>
  );
}

export function SubjectLayout() {
  return (
    <AppRouteContextProvider scope="subject">
      <Outlet />
    </AppRouteContextProvider>
  );
}

export function ModuleLayout() {
  return (
    <AppRouteContextProvider scope="module">
      <Outlet />
    </AppRouteContextProvider>
  );
}

export function NoteGroupLayout() {
  return (
    <AppRouteContextProvider scope="note-group">
      <Outlet />
    </AppRouteContextProvider>
  );
}

export function ConceptLayout() {
  return (
    <AppRouteContextProvider scope="concept">
      <Outlet />
    </AppRouteContextProvider>
  );
}
