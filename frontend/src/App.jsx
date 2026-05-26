import React from "react";

import { StudyAppShell } from "@/features/app-shell/StudyAppShell";
import { AppRoutes } from "@/routes/appRoutes";

export default function App() {
  return (
    <AppRoutes
      renderAppShell={({ routePageModels }) => (
        <StudyAppShell routePageModels={routePageModels} />
      )}
    />
  );
}
