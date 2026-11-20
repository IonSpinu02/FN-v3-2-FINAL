import type { Region } from "./constants";
import { REGIONS } from "./constants";
import type { ScenarioResult, ScenarioRow } from "./types";

export type StrengthBand = "FORTE" | "MEDIO" | "DEBOLE";

/** Indice dirigenziale 0,00–1,00 (rank consenso + floor organizzativo). */
export function computeIndiceForzaTerritoriale(
  row: ScenarioRow,
  righe: ScenarioRow[],
): number {
  const sorted = [...righe].sort((a, b) => b.stima - a.stima);
  const rank = sorted.findIndex((r) => r.regione === row.regione);
  const n = sorted.length;
  const rankComponent = n <= 1 ? 1 : 1 - rank / (n - 1);
  return Math.round((0.2 + 0.8 * rankComponent) * 100) / 100;
}

export function strengthBandFromIndex(indice: number): StrengthBand {
  if (indice >= 0.7) return "FORTE";
  if (indice >= 0.45) return "MEDIO";
  return "DEBOLE";
}

export type RegionalStrengthRow = {
  regione: Region | "NAZIONALE";
  indice: number;
  band: StrengthBand;
  stimaPct: number;
  voti: number;
  iscritti: number;
  lo10Pct: number;
  hi90Pct: number;
};

export function buildRegionalStrengthTable(
  scenario: ScenarioResult,
  liveS: number,
): RegionalStrengthRow[] {
  const righe = scenario.righe;
  const rows: RegionalStrengthRow[] = REGIONS.map((regione) => {
    const row = righe.find((r) => r.regione === regione)!;
    const indice = computeIndiceForzaTerritoriale(row, righe);
    return {
      regione,
      indice,
      band: strengthBandFromIndex(indice),
      stimaPct: row.stima * 100,
      voti: row.voti_di_scenario,
      iscritti: row.iscritti,
      lo10Pct: row.lo10 * 100,
      hi90Pct: row.hi90 * 100,
    };
  });
  const totalVoti = righe.reduce((a, r) => a + r.voti_di_scenario, 0);
  const avgIndice =
    rows.reduce((a, r) => a + r.indice, 0) / Math.max(1, rows.length);
  rows.unshift({
    regione: "NAZIONALE",
    indice: Math.round(avgIndice * 100) / 100,
    band: strengthBandFromIndex(avgIndice),
    stimaPct: liveS * 100,
    voti: totalVoti,
    iscritti: righe.reduce((a, r) => a + r.iscritti, 0),
    lo10Pct: liveS * 100 * 0.85,
    hi90Pct: liveS * 100 * 1.15,
  });
  return rows;
}

export function summarizeStrengthBands(
  rows: RegionalStrengthRow[],
): {
  roccaforte: RegionalStrengthRow[];
  intermedie: RegionalStrengthRow[];
  critiche: RegionalStrengthRow[];
} {
  const regional = rows.filter((r) => r.regione !== "NAZIONALE");
  return {
    roccaforte: regional.filter((r) => r.band === "FORTE"),
    intermedie: regional.filter((r) => r.band === "MEDIO"),
    critiche: regional.filter((r) => r.band === "DEBOLE"),
  };
}
