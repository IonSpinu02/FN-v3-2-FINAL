import { buildExposurePriorityCards } from "@/lib/engine/exposurePriorityEngine";
import type { Region } from "@/lib/engine/constants";
import type { ScenarioResult } from "@/lib/engine/types";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import { cdxSharePct, getRegionalPartyHistory } from "@/lib/fnProgramAndAffinityEngine";
import {
  macroAreaOf,
  type BackcastRegionInput,
  type BridgeTheme,
} from "@/lib/engine/strategicBackcastEngine";

const THEME_OF: Record<TerritoryIssueCategory, BridgeTheme> = {
  SICUREZZA: "Sicurezza",
  SANITA: "Liste d'attesa Sanità",
  LAVORO: "Energia PMI",
  COSTO_VITA: "Casa/Mutui",
  TRASPORTI: "Trasporti/Flussi",
  TERRITORIO: "Fisco P.IVA",
};

export function bridgeThemeForCategory(category: TerritoryIssueCategory): BridgeTheme {
  return THEME_OF[category];
}

export function buildBackcastRegions(
  scenario: ScenarioResult,
  poll: readonly { regione: Region; piHat: number }[] = [],
): {
  regions: BackcastRegionInput[];
  currentMembers: number;
  currentCommittees: number;
} {
  const cards = buildExposurePriorityCards({
    rows: scenario.righe.map((row) => ({
      regione: row.regione,
      stima: row.stima,
      voti_di_scenario: row.voti_di_scenario,
      elettori_ricostruiti: row.elettori_ricostruiti,
    })),
  });
  const byRegion = new Map(cards.map((card) => [card.regione, card]));
  const pollByRegion = new Map(poll.map((row) => [row.regione, row.piHat]));
  const totalVoters = scenario.righe.reduce((sum, row) => sum + row.elettori_ricostruiti, 0) || 1;
  const regions = scenario.righe.map((row) => {
    const card = byRegion.get(row.regione);
    const history = getRegionalPartyHistory(row.regione);
    const share = Math.max(0.001, totalVoters > 0 ? row.elettori_ricostruiti / totalVoters : 0);
    const measuredShare = pollByRegion.get(row.regione) ?? row.stima;
    return {
      region: row.regione,
      validVoters: Math.max(1, Math.round(row.validi2024 > 0 ? row.validi2024 : row.elettori_ricostruiti)),
      currentSharePct: measuredShare * 100,
      priority: card?.exposurePriorityScore ?? 40,
      affinity: history.permeabilitaVannacciScore,
      macroArea: macroAreaOf(row.regione),
      cdxSharePct: cdxSharePct(history),
      abstentionPct: history.astensionePct,
      themePressure: (card?.socialDistressScore ?? 40) / 100,
      members: Math.max(0, Math.round(row.iscritti)),
      committees: Math.max(1, Math.round(scenario.parametri.comitati * share)),
      localElected: Math.max(0, Math.round(row.punti_istituzionali)),
      primaryTheme: bridgeThemeForCategory(card?.primaryCategory ?? "SICUREZZA"),
    };
  });
  return {
    regions,
    currentMembers: scenario.parametri.iscritti_attribuiti,
    currentCommittees: scenario.parametri.comitati,
  };
}
