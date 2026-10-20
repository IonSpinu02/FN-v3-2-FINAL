import { DashboardClient } from "@/components/DashboardClient";
import { loadJson, runDefaultScenario } from "@/lib/engine/loadData";
import type { FnConfig, ScenarioResult } from "@/lib/engine/types";
import { Suspense } from "react";

export const instant = false;

export default async function DashboardPage() {
  const { connection } = await import("next/server");
  await connection();
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
