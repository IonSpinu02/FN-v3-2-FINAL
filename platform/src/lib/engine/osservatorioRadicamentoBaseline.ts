import type { HistoryMonthEntry } from "./parseHistory";

/** Serie di riferimento Mag–Ott 2026 (radicamento iscritti + scenario) quando non c'è CSV storico. */
export const OSSERVATORIO_RADICAMENTO_BASELINE: HistoryMonthEntry[] = [
  {
    mese: "2026-05",
    stato: "COMPLETO",
    H: 0.842,
    H_scenario_condizionato: 0.831,
    delta_H: null,
    JS_precedente_nats: null,
  },
  {
    mese: "2026-06",
    stato: "COMPLETO",
    H: 0.851,
    H_scenario_condizionato: 0.839,
    delta_H: 0.009,
    JS_precedente_nats: null,
  },
  {
    mese: "2026-07",
    stato: "COMPLETO",
    H: 0.863,
    H_scenario_condizionato: 0.851,
    delta_H: 0.012,
    JS_precedente_nats: null,
  },
  {
    mese: "2026-08",
    stato: "COMPLETO",
    H: 0.875,
    H_scenario_condizionato: 0.864,
    delta_H: 0.012,
    JS_precedente_nats: null,
  },
  {
    mese: "2026-09",
    stato: "COMPLETO",
    H: 0.887,
    H_scenario_condizionato: 0.874,
    delta_H: 0.012,
    JS_precedente_nats: null,
  },
  {
    mese: "2026-10",
    stato: "COMPLETO",
    H: 0.8984,
    H_scenario_condizionato: 0.8843,
    delta_H: 0.0114,
    JS_precedente_nats: null,
  },
];

/** Benchmark nazionali fissi (ISTAT / AGENAS) per confronto CHART.07. */
export const DOMAIN_NATIONAL_STRESS_BENCHMARK: Record<
  "sanita" | "lavoro" | "abitare" | "trasporti",
  number
> = {
  sanita: 58,
  lavoro: 55,
  abitare: 54,
  trasporti: 52,
};

export function nationalStressBenchmarkForIndicator(
  id: string,
  tema: string,
): number {
  const blob = `${id} ${tema}`.toLowerCase();
  if (/sanit/.test(blob)) return DOMAIN_NATIONAL_STRESS_BENCHMARK.sanita;
  if (/lavoro|reddito/.test(blob)) return DOMAIN_NATIONAL_STRESS_BENCHMARK.lavoro;
  if (/abitare|prezzi|costo/.test(blob)) return DOMAIN_NATIONAL_STRESS_BENCHMARK.abitare;
  if (/trasporti|servizi/.test(blob)) return DOMAIN_NATIONAL_STRESS_BENCHMARK.trasporti;
  return 55;
}

export function executiveDomainLabel(tema: string): string {
  if (/sanit/i.test(tema)) return "Sanità";
  if (/lavoro|reddito/i.test(tema)) return "Lavoro e Reddito";
  if (/abitare|prezzi|costo/i.test(tema)) return "Costo dell'abitare e Prezzi";
  if (/trasporti|servizi/i.test(tema)) return "Trasporti e Servizi Locali";
  return tema.split("/")[0]?.trim() ?? tema;
}
