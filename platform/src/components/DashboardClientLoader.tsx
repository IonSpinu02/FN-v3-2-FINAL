"use client";

import type { FnConfig, ScenarioResult } from "@/lib/engine/types";
import { DashboardClient } from "./DashboardClient";

/**
 * Wrapper sottile (compatibilità). La pagina `/app/[section]` passa già i dati
 * dal Server Component: niente fetch e niente gate «Caricamento…».
 */
export function DashboardClientLoader({
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
      variant="app"
      initialScenario={initialScenario}
      frozenSnapshot={frozenSnapshot}
      fnConfig={fnConfig}
    />
  );
}
