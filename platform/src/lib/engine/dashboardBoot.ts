import { loadJson, runDefaultScenario } from "@/lib/engine/loadData";
import type { FnConfig, ScenarioResult } from "@/lib/engine/types";

/** Payload deterministico di avvio dashboard (stesso di `/api/dashboard-data`). */
export type DashboardBoot = {
  initialScenario: ScenarioResult;
  frozenSnapshot: ScenarioResult;
  fnConfig: FnConfig;
};

/** Calcolo server-side: `calculate()` con parametri ufficiali + snapshot congelato. */
export function loadDashboardBoot(): DashboardBoot {
  return {
    initialScenario: runDefaultScenario(),
    frozenSnapshot: loadJson<ScenarioResult>("scenario_congelato_18-10-2026.json"),
    fnConfig: loadJson<FnConfig>("config_v3_2.json"),
  };
}
