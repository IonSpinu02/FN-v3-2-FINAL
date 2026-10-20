import { loadJson, runDefaultScenario } from "@/lib/engine/loadData";
import type { FnConfig, ScenarioResult } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const initialScenario = runDefaultScenario();
  const frozenSnapshot = loadJson<ScenarioResult>(
    "scenario_congelato_18-10-2026.json",
  );
  const fnConfig = loadJson<FnConfig>("config_v3_2.json");
  return Response.json({ initialScenario, frozenSnapshot, fnConfig });
}
