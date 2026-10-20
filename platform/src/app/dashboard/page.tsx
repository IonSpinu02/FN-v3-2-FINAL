import { DashboardClient } from "@/components/DashboardClient";
import { loadJson, runDefaultScenario } from "@/lib/engine/loadData";
import type { FnConfig, ScenarioResult } from "@/lib/engine/types";

export const instant = false;

export default async function DashboardPage() {
  // Mantiene render dinamico (come ex auth()) con cacheComponents attivo
  const { connection } = await import("next/server");
  await connection();
  const initialScenario = runDefaultScenario();
  const frozenSnapshot = loadJson<ScenarioResult>(
    "scenario_congelato_18-10-2026.json",
  );
  const fnConfig = loadJson<FnConfig>("config_v3_2.json");
  return (
    <DashboardClient
      initialScenario={initialScenario}
      frozenSnapshot={frozenSnapshot}
      fnConfig={fnConfig}
    />
  );
}
