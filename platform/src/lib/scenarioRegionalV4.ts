import type { Region } from "@/lib/engine/constants";
import {
  forecastV4Regional,
  type ForecastV4Input,
  type ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";
import { buildRegionalCampaignSummary, validVotesFromScenarioRow } from "@/lib/fnProgramAndAffinityEngine";
import { monthLabelsFromAsOf } from "@/lib/engine/partyGrowthForecast";
import type { RegionalGrowthMonthPoint } from "@/lib/politicalModel";

const MONTH_FULL_IT = [
  "GENNAIO",
  "FEBBRAIO",
  "MARZO",
  "APRILE",
  "MAGGIO",
  "GIUGNO",
  "LUGLIO",
  "AGOSTO",
  "SETTEMBRE",
  "OTTOBRE",
  "NOVEMBRE",
  "DICEMBRE",
] as const;

const MONTH_SHORT_IT = [
  "GEN",
  "FEB",
  "MAR",
  "APR",
  "MAG",
  "GIU",
  "LUG",
  "AGO",
  "SET",
  "OTT",
  "NOV",
  "DIC",
] as const;

export type ScenarioRegionalV4View = {
  regione: Region;
  startPct: number;
  mag27BasePct: number;
  mag27OffensivePct: number;
  deltaPp: number;
  addedVotes: number;
  reachSaturation: number;
  iscritti: number;
  fasciaLabel: "ROCCAFORTE" | "IN CRESCITA" | "PRIORITÀ";
  primaryGrowthDriver: string;
  monthlyTrajectory: RegionalGrowthMonthPoint[];
};

export function scenarioRegionalHorizonCopy(asOf: Date): {
  rangeLabel: string;
  todayShort: string;
  targetShort: string;
} {
  const monthIdx = asOf.getMonth();
  const yy = String(asOf.getFullYear()).slice(-2);
  return {
    rangeLabel: `${MONTH_FULL_IT[monthIdx]} ${asOf.getFullYear()} → MAGGIO 2027`,
    todayShort: `OGGI · ${MONTH_SHORT_IT[monthIdx]} '${yy}`,
    targetShort: "TARGET · MAG '27",
  };
}

function fasciaFromPct(pct: number): ScenarioRegionalV4View["fasciaLabel"] {
  if (pct > 8) return "ROCCAFORTE";
  if (pct >= 6.5) return "IN CRESCITA";
  return "PRIORITÀ";
}

function buildTrajectory(
  startPct: number,
  endPct: number,
  asOf: Date,
): RegionalGrowthMonthPoint[] {
  const labels = monthLabelsFromAsOf(asOf, 8);
  const steps = labels.length;
  return labels.map((month, i) => {
    const t = steps <= 1 ? 1 : i / (steps - 1);
    const sharePct = startPct + (endPct - startPct) * t;
    const band = 0.12;
    return {
      month,
      sharePct,
      lowBandPct: sharePct - band,
      highBandPct: sharePct + band,
    };
  });
}

export function buildScenarioRegionalV4Map(
  v4Input: ForecastV4Input,
  v4: ForecastV4Result,
  scenarioRows: { regione: string; iscritti: number; voti_di_scenario: number; stima: number }[],
  asOf: Date,
): Record<string, ScenarioRegionalV4View> {
  const baseRows = forecastV4Regional(v4Input, v4, "d180", "base");
  const offRows = forecastV4Regional(v4Input, v4, "d180", "offensiva");
  const offBy = Object.fromEntries(offRows.map((row) => [row.regione, row]));
  const scenarioBy = Object.fromEntries(scenarioRows.map((row) => [row.regione, row]));
  const out: Record<string, ScenarioRegionalV4View> = {};

  for (const row of baseRows) {
    const off = offBy[row.regione];
    const scen = scenarioBy[row.regione];
    const iscritti = scen?.iscritti ?? 0;
    const validi = validVotesFromScenarioRow(
      scen?.voti_di_scenario ?? 0,
      scen?.stima ?? row.startPct / 100,
    );
    const campaign = buildRegionalCampaignSummary(row.regione, row.startPct, validi);
    out[row.regione] = {
      regione: row.regione,
      startPct: row.startPct,
      mag27BasePct: row.centralPct,
      mag27OffensivePct: off?.centralPct ?? row.centralPct,
      deltaPp: row.deltaPp,
      addedVotes: row.addedVotes,
      reachSaturation: row.reachSaturation,
      iscritti,
      fasciaLabel: fasciaFromPct(row.centralPct),
      primaryGrowthDriver: campaign.strategicExplanation,
      monthlyTrajectory: buildTrajectory(row.startPct, row.centralPct, asOf),
    };
  }

  return out;
}
