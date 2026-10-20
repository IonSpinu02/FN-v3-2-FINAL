import type { Region } from "./constants";
import {
  buildFabbisognoDomainTags,
  computeResolvedTerritorialStress,
  type FabbisognoDomainTag,
} from "./fabbisogniCatalogFallback";
import type { FabbisognoIndicatore, FabbisogniRegione } from "./osservatorioTypes";
import type { ScenarioRow } from "./types";

/** Stress 0 = condizioni favorevoli, 100 = massima tensione (solo da indicatori oggettivi). */
export function indicatorStressScore(ind: FabbisognoIndicatore): number | null {
  if (ind.valore === null || typeof ind.valore === "string") return null;
  const v = ind.valore;
  const key = ind.id.toLowerCase();
  if (key.includes("lavoro")) {
    return Math.max(0, Math.min(100, 100 - v));
  }
  if (key.includes("sanita")) {
    return Math.max(0, Math.min(100, v * 1.5));
  }
  if (key.includes("abitare") || key.includes("entropia")) {
    return Math.max(0, Math.min(100, v));
  }
  return Math.max(0, Math.min(100, v));
}

export type TerritorialStressBreakdown = {
  scores: { id: string; tema: string; stress: number | null }[];
  aggregate: number | null;
  populated: number;
  total: number;
};

export function computeTerritorialStress(
  indicatori: FabbisognoIndicatore[],
): TerritorialStressBreakdown {
  const scores = indicatori.map((ind) => ({
    id: ind.id,
    tema: ind.tema,
    stress: indicatorStressScore(ind),
  }));
  const populated = scores.filter((s) => s.stress != null).length;
  const values = scores.map((s) => s.stress).filter((s): s is number => s != null);
  const aggregate =
    values.length > 0
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : null;
  return {
    scores,
    aggregate,
    populated,
    total: indicatori.length,
  };
}

export type MobilizationContext = {
  /** Astenuti ricostruiti (non votanti sul totale elettori). */
  astenuti: number;
  elettori: number;
  astenutiPct: number;
  /** Iscritti FN in regione (base organizzativa). */
  iscrittiFn: number;
  /** Voti scenario MC (Modulo A). */
  votiScenario: number;
  /** Rapporto iscritti / astenuti — capacità relativa di contatto (indice grezzo). */
  iscrittiSuAstenutiPct: number | null;
  band:
    | "dati_insufficienti"
    | "base_organizzativa_limitata"
    | "pool_astensione_rilevante"
    | "contesto_misto"
    | "elettorato_compatto";
  nota: string;
  naturaDato: "osservato" | "simulazione";
};

export function computeMobilizationContext(row: ScenarioRow): MobilizationContext {
  const elettori = Math.max(1, row.elettori_ricostruiti);
  const astenuti = Math.max(0, row.astenuti_ricostruiti);
  const astenutiPct = (astenuti / elettori) * 100;
  const iscrittiFn = row.iscritti;
  const votiScenario = row.voti_di_scenario;
  const iscrittiSuAstenutiPct =
    astenuti > 0 ? (iscrittiFn / astenuti) * 100 : null;

  let band: MobilizationContext["band"] = "contesto_misto";
  let nota =
    "Lettura organizzativa: non sostituisce sondaggi né converte fabbisogni in voti.";

  if (iscrittiFn < 500 && astenutiPct > 55) {
    band = "base_organizzativa_limitata";
    nota =
      "Iscritti limitati rispetto al pool di non votanti 2024: priorità radicamento e affluenza.";
  } else if (astenutiPct >= 58 && iscrittiSuAstenutiPct != null && iscrittiSuAstenutiPct < 8) {
    band = "pool_astensione_rilevante";
    nota =
      "Fascia di astensione elevata: opportunità di lavoro territoriale su partecipazione (ipotesi operativa).";
  } else if (astenutiPct < 45) {
    band = "elettorato_compatto";
    nota = "Elettorato già molto mobilitato nel 2024: margini su switch e preferenze.";
  } else {
    band = "contesto_misto";
  }

  return {
    astenuti,
    elettori,
    astenutiPct,
    iscrittiFn,
    votiScenario,
    iscrittiSuAstenutiPct,
    band,
    nota,
    naturaDato: "simulazione",
  };
}

export type TerritorialIntelligenceRow = {
  regione: Region;
  scenario: {
    stimaPct: number;
    voti: number;
    iscritti: number;
    presenze: number;
    elettori: number;
    astenuti: number;
    affluenza2024: number;
    lo10: number;
    hi90: number;
  };
  stress: TerritorialStressBreakdown;
  /** Stress Modulo B sempre valorizzato (catalogo + fallback descrittivo). */
  stressResolved: number;
  stressScoresResolved: { id: string; tema: string; stress: number }[];
  fabbisognoTags: FabbisognoDomainTag[];
  mobilization: MobilizationContext;
  prioritaStato: string;
  eventiCount: number;
};

export function buildTerritorialIntelligenceRow(
  row: ScenarioRow,
  fabbisogni: FabbisogniRegione | undefined,
  eventiCount: number,
): TerritorialIntelligenceRow {
  const indicatori = fabbisogni?.indicatori ?? [];
  const stress = computeTerritorialStress(indicatori);
  const resolved = computeResolvedTerritorialStress(
    indicatori,
    row.regione as Region,
  );
  const fabbisognoTags = buildFabbisognoDomainTags(
    indicatori,
    row.regione as Region,
  );
  const mobilization = computeMobilizationContext(row);

  const priorita = fabbisogni?.prioritaDichiarate;
  const prioritaStato =
    priorita?.stato === "rilevato"
      ? `Rilevato${priorita.campione ? ` (N≈${priorita.campione})` : ""}`
      : priorita?.stato === "parziale"
        ? "Parziale"
        : "Non rilevato";

  return {
    regione: row.regione,
    scenario: {
      stimaPct: row.stima * 100,
      voti: row.voti_di_scenario,
      iscritti: row.iscritti,
      presenze: row.presenze,
      elettori: row.elettori_ricostruiti,
      astenuti: row.astenuti_ricostruiti,
      affluenza2024: row.affluenza2024,
      lo10: row.lo10 * 100,
      hi90: row.hi90 * 100,
    },
    stress,
    stressResolved: resolved.aggregate,
    stressScoresResolved: resolved.scores,
    fabbisognoTags,
    mobilization,
    prioritaStato,
    eventiCount,
  };
}

export const MOBILIZATION_BAND_LABEL: Record<
  MobilizationContext["band"],
  string
> = {
  dati_insufficienti: "Dati insufficienti",
  base_organizzativa_limitata: "Base iscritti da rafforzare",
  pool_astensione_rilevante: "Pool astensione rilevante",
  contesto_misto: "Contesto misto",
  elettorato_compatto: "Elettorato già compatto",
};
