import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { ScenarioResult } from "@/lib/engine/types";
import type { RegionalGrowthRegionInput } from "@/lib/politicalModel";

export function scenarioToRegionalGrowthInputs(
  scenario: ScenarioResult,
  poll: RegionPollResult[],
): RegionalGrowthRegionInput[] {
  const pollBy = Object.fromEntries(poll.map((p) => [p.regione, p]));
  return scenario.righe.map((r) => ({
    regione: r.regione,
    stima: r.stima,
    p: r.p,
    q: r.q,
    f: r.f,
    voti_di_scenario: r.voti_di_scenario,
    iscritti: r.iscritti,
    piHat: pollBy[r.regione]?.piHat,
  }));
}
