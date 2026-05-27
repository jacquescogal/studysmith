import { Outlet } from "react-router-dom";

import { AppRouteContextProvider } from "./routeContext";
import { ModuleWorkspacePage } from "./pages";

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

export function ModuleLayout({ renderAppShell }) {
  return (
    <AppRouteContextProvider scope="module">
      {renderAppShell ? <ModuleWorkspacePage renderAppShell={renderAppShell} /> : <Outlet />}
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
