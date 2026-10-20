import { REGIONS, type Region } from "./constants";
import { parseCsvRecords } from "./csv";
import type { ScenarioResult, ScenarioRow } from "./types";

export type ScenarioRowWithVote = ScenarioRow & {
  voto_osservato?: number;
  errore_punti?: number;
};

export interface PostVoteValidation {
  stato: string;
  s_observato: number;
  regioni: number;
  voti_validi: number;
  fn_voti: number;
  mae_punti_scenario: number;
  mae_punti_benchmark: number;
  rmse_punti_scenario: number;
  rmse_punti_benchmark: number;
  skill_vs_benchmark: number | null;
  mae_geografico_scenario: number;
  mae_geografico_benchmark: number;
  skill_geografico: number | null;
  copertura_regioni_sensibilita: number;
  avvertenza: string;
}

export interface PostVoteResult {
  validazione_predittiva: PostVoteValidation;
  righe: ScenarioRowWithVote[];
}

/** Port di `evaluate()` — usa ESCLUSIVAMENTE lo snapshot congelato ex ante. */
export function evaluatePostVote(
  snapshot: ScenarioResult,
  csvContent: string,
): PostVoteResult {
  const data = parseCsvRecords(csvContent);
  const dd: Record<string, Record<string, string>> = {};
  for (const row of data) {
    if (row.regione) dd[row.regione] = row;
  }
  if (Object.keys(dd).length !== REGIONS.length || data.length !== 20) {
    throw new Error(
      "Serve un file con esattamente 20 righe e 20 regioni distinte",
    );
  }
  for (const r of REGIONS) {
    if (!dd[r]) {
      throw new Error(
        "Serve un file con esattamente 20 righe e 20 regioni distinte",
      );
    }
  }

  const valid: Record<Region, number> = {} as Record<Region, number>;
  const fn: Record<Region, number> = {} as Record<Region, number>;
  for (const r of REGIONS) {
    valid[r] = parseInt(dd[r].voti_validi, 10);
    fn[r] = parseInt(dd[r].voti_fn, 10);
    if (valid[r] <= 0 || fn[r] < 0 || fn[r] > valid[r]) {
      throw new Error(`Risultato elettorale non valido: ${r}`);
    }
  }

  const total = REGIONS.reduce((s, r) => s + valid[r], 0);
  const fnTot = REGIONS.reduce((s, r) => s + fn[r], 0);
  const SActual = fnTot / total;
  const qActual: Record<Region, number> = {} as Record<Region, number>;
  for (const r of REGIONS) qActual[r] = valid[r] / total;

  const pred: Record<Region, number> = {} as Record<Region, number>;
  const bench: Record<Region, number> = {} as Record<Region, number>;
  const pm: Record<Region, number> = {} as Record<Region, number>;
  const pb: Record<Region, number> = {} as Record<Region, number>;
  for (const a of snapshot.righe) {
    pred[a.regione] = a.stima;
    bench[a.regione] = a.benchmark;
    pm[a.regione] = a.p;
    pb[a.regione] = a.b;
  }

  const obs: Record<Region, number> = {} as Record<Region, number>;
  for (const r of REGIONS) obs[r] = fn[r] / valid[r];

  const weightedMae = (y: Record<Region, number>) =>
    100 * REGIONS.reduce((s, r) => s + qActual[r] * Math.abs(y[r] - obs[r]), 0);

  const weightedRmse = (y: Record<Region, number>) =>
    100 *
    Math.sqrt(
      REGIONS.reduce((s, r) => s + qActual[r] * (y[r] - obs[r]) ** 2, 0),
    );

  const cmpPred: Record<Region, number> = {} as Record<Region, number>;
  const cmpB: Record<Region, number> = {} as Record<Region, number>;
  for (const r of REGIONS) {
    cmpPred[r] = (SActual * pm[r]) / qActual[r];
    cmpB[r] = (SActual * pb[r]) / qActual[r];
  }

  const wModel = weightedMae(pred);
  const wBench = weightedMae(bench);
  const cModel = weightedMae(cmpPred);
  const cBench = weightedMae(cmpB);

  let coverage = 0;
  for (const r of REGIONS) {
    const row = snapshot.righe.find((a) => a.regione === r);
    if (row && obs[r] >= row.lo10 && obs[r] <= row.hi90) coverage += 1;
  }

  const righe: ScenarioRowWithVote[] = snapshot.righe.map((a) => {
    const r = a.regione;
    return {
      ...a,
      voto_osservato: obs[r],
      errore_punti: (pred[r] - obs[r]) * 100,
    };
  });

  return {
    validazione_predittiva: {
      stato: "VALUTAZIONE EX POST (controllare comparabilità del risultato!)",
      s_observato: SActual,
      regioni: 20,
      voti_validi: total,
      fn_voti: fnTot,
      mae_punti_scenario: wModel,
      mae_punti_benchmark: wBench,
      rmse_punti_scenario: weightedRmse(pred),
      rmse_punti_benchmark: weightedRmse(bench),
      skill_vs_benchmark: wBench > 0 ? 1 - wModel / wBench : null,
      mae_geografico_scenario: cModel,
      mae_geografico_benchmark: cBench,
      skill_geografico: cBench > 0 ? 1 - cModel / cBench : null,
      copertura_regioni_sensibilita: coverage / 20,
      avvertenza:
        "Lo skill descrittivo ex post richiede dati che non siano stati usati per tarare il modello; il controllo geografico usa S osservato soltanto per separare livello nazionale e allocazione regionale.",
    },
    righe,
  };
}
