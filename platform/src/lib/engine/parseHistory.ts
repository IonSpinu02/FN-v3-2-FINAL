import { REGIONS, type Region, type RegionMap } from "./constants";
import { parseCsvRecords } from "./csv";
import { entropyH, js, norm } from "./math";
import type { ScenarioResult } from "./types";

export interface HistoryMonthEntry {
  mese: string;
  stato: "COMPLETO" | "INCOMPLETO";
  regioni_presenti?: number;
  iscritti_regionalizzati?: number;
  H: number | null;
  delta_H: number | null;
  JS_precedente_nats: number | null;
  H_scenario_condizionato: number | null;
}

/**
 * Port di `parse_history` da modello_fn_v3_2.py
 * @param baseline snapshot congelato ex ante (parametri + righe f/v/m)
 */
export function parseHistory(
  csvContent: string,
  baseline: ScenarioResult | null,
): HistoryMonthEntry[] {
  const groups: Record<string, Partial<Record<Region, number>>> = {};

  for (const row of parseCsvRecords(csvContent)) {
    const t = row.mese?.trim();
    const r = row.regione?.trim() as Region;
    const n = row.iscritti?.trim();
    if (!t || !r || !n) continue;
    if (!REGIONS.includes(r)) {
      throw new Error(`Regione non riconosciuta nel monitoraggio: ${r}`);
    }
    if (!groups[t]) groups[t] = {};
    if (groups[t]![r] !== undefined) {
      throw new Error(`Regione duplicata nel mese ${t}: ${r}`);
    }
    groups[t]![r] = parseInt(n, 10);
  }

  const result: HistoryMonthEntry[] = [];
  let previous: ReturnType<typeof norm> | null = null;

  for (const t of Object.keys(groups).sort()) {
    const g = groups[t]!;
    const keys = Object.keys(g) as Region[];
    if (keys.length !== REGIONS.length || !REGIONS.every((r) => r in g)) {
      result.push({
        mese: t,
        stato: "INCOMPLETO",
        regioni_presenti: keys.length,
        H: null,
        delta_H: null,
        JS_precedente_nats: null,
        H_scenario_condizionato: null,
      });
      previous = null;
      continue;
    }

    const full = g as Record<Region, number>;
    if (Object.values(full).some((v) => v < 0) || !Object.values(full).reduce((a, b) => a + b, 0)) {
      throw new Error(`Conteggi iscritti non validi: ${t}`);
    }

    const pp = norm(full);
    const entry: HistoryMonthEntry = {
      mese: t,
      stato: "COMPLETO",
      iscritti_regionalizzati: Object.values(full).reduce((a, b) => a + b, 0),
      H: entropyH(pp),
      delta_H: previous ? entropyH(pp) - entropyH(previous) : null,
      JS_precedente_nats: previous ? js(pp, previous) : null,
      H_scenario_condizionato: null,
    };

    if (baseline !== null) {
      const weights = baseline.parametri.pesi;
      const frozen = Object.fromEntries(
        baseline.righe.map((row) => [row.regione, row]),
      ) as Record<Region, (typeof baseline.righe)[0]>;
      const mixT = {} as RegionMap;
      for (const r of REGIONS) {
        mixT[r] =
          weights.flussi * frozen[r].f +
          weights.pref * frozen[r].v +
          weights.isc * pp[r] +
          weights.ist * frozen[r].m;
      }
      entry.H_scenario_condizionato = entropyH(mixT);
    }

    result.push(entry);
    previous = pp;
  }

  return result;
}
