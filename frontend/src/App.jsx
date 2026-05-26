import React from "react";

import { LegacyApp } from "@/features/app-shell/LegacyApp";
import { AppRoutes } from "@/routes/appRoutes";

export default function App() {
  return <AppRoutes renderLegacyApp={() => <LegacyApp />} />;
}
