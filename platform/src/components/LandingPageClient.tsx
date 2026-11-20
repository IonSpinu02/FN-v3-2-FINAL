"use client";

import type { FnConfig, ScenarioResult } from "@/lib/engine/types";
import { DashboardClient } from "./DashboardClient";

/** Showcase landing: riceve già lo scenario di default dal Server Component. */
export function LandingPageClient({
  initialScenario,
  frozenSnapshot,
  fnConfig,
}: {
  initialScenario: ScenarioResult;
  frozenSnapshot: ScenarioResult;
  fnConfig: FnConfig;
}) {
  return (
    <DashboardClient
      variant="landing"
      initialScenario={initialScenario}
      frozenSnapshot={frozenSnapshot}
      fnConfig={fnConfig}
    />
  );
}
