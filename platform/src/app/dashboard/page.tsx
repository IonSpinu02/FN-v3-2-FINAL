import { DashboardClient } from "@/components/DashboardClient";
import { loadJson, runDefaultScenario } from "@/lib/engine/loadData";
import type { FnConfig, ScenarioResult } from "@/lib/engine/types";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const initialScenario = runDefaultScenario();
  const frozenSnapshot = loadJson<ScenarioResult>(
    "scenario_congelato_18-10-2026.json",
  );
  const fnConfig = loadJson<FnConfig>("config_v3_2.json");
  return (
    <Suspense fallback={<p className="p-8 text-fn-text-muted">Caricamento dashboard…</p>}>
      <DashboardClient
        initialScenario={initialScenario}
        frozenSnapshot={frozenSnapshot}
        fnConfig={fnConfig}
      />
    </Suspense>
  );
}
