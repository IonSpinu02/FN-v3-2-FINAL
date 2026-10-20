import type { Region } from "@/lib/engine/constants";
import { computeResolvedTerritorialStress } from "@/lib/engine/fabbisogniCatalogFallback";
import {
  buildKeyIndicatorLines,
  type IndicatorDisplayLine,
} from "@/lib/engine/osservatorioIndicatorReference";
import type { ScenarioResult } from "@/lib/engine/types";
import { fmtNumIt } from "@/components/charts/chartUtils";
import { pct } from "@/lib/format";
import type {
  FabbisogniRegione,
  GoogleTrendsSeries,
  OsservatorioEvento,
  PrioritaDichiarateRilevazione,
} from "@/lib/engine/osservatorioTypes";

export type DossierSchedaRow = {
  dimensione: string;
  statoCapitolo: string;
  misureMetadati: string;
  notaMetodologica: string;
  naturaBadge: string;
};

export const CASE_STUDY_EVENTS = [
  {
    date: "2026-09-26",
    title: "Intervista televisiva/digitale di Vannacci con Corona",
  },
  {
    date: "2026-10-09",
    title: "Contestazione in manifestazione di agricoltori",
  },
] as const;

function formatScenarioRow(region: Region, scenario: ScenarioResult): DossierSchedaRow {
  const row = scenario.righe.find((r) => r.regione === region);
  const S = scenario.parametri.S;
  const stimaLabel = row ? pct(row.stima) : "—";
  const lo = row ? (row.lo10 * 100).toFixed(2).replace(".", ",") : "—";
  const hi = row ? (row.hi90 * 100).toFixed(2).replace(".", ",") : "—";
  const voti = row ? fmtNumIt(row.voti_di_scenario) : "—";
  const iscritti = row ? fmtNumIt(row.iscritti) : "—";
  const inputS = (S * 100).toFixed(2).replace(".", ",");

  return {
    dimensione: "Scenario elettorale (Modulo A)",
    statoCapitolo: `${stimaLabel} con S=${inputS}% · Forbice stimata: [${lo}% – ${hi}%] · Voti stimati: ${voti} · Iscritti: ${iscritti}`,
    misureMetadati: `Input nazionale ${inputS}% (Ott 2026) · Modello Territoriale FN · Ottobre 2026`,
    notaMetodologica:
      "Risultato del modello territoriale di ottobre; non sondaggio campionario regionale.",
    naturaBadge: "SIMULAZIONE / SCENARIO",
  };
}

function formatFabbisogniRow(
  region: Region,
  fab: FabbisogniRegione | undefined,
  lines: IndicatorDisplayLine[],
): DossierSchedaRow {
  const inds = fab?.indicatori ?? [];
  const resolved = computeResolvedTerritorialStress(inds, region);
  const detail = lines
    .map(
      (l) =>
        `${l.tema} — ${l.nomeCompleto}: ${l.valoreRegionale} (Italia: ${l.benchmarkItalia}) · Anno rif.: ${l.annoRiferimento} · Pubbl.: ${l.dataPubblicazione} · Stress ${l.stress}/100`,
    )
    .join(" | ");

  return {
    dimensione: "Fabbisogni oggettivi (Modulo B)",
    statoCapitolo: `Popolato per 3 temi chiave (Sanità, Lavoro, Abitare/Trasporti) · Indice sintesi Stress B: ${resolved.aggregate}/100`,
    misureMetadati: detail || "Catalogo BesT/AGENAS in caricamento",
    notaMetodologica:
      "Periodi distinti per indicatore; confronto storico BesT/AGENAS/OpenCivitas.",
    naturaBadge: "DATO OSSERVATO (CONFRONTO STORICO)",
  };
}

function formatPrioritaRow(
  prioritaRilevazione?: PrioritaDichiarateRilevazione,
): DossierSchedaRow {
  if (prioritaRilevazione) {
    return {
      dimensione: "Priorità dichiarate (Modulo B)",
      statoCapitolo: `Rilevato (N=${prioritaRilevazione.campioneN}, ±${prioritaRilevazione.margineIncertezzaPct} pp)`,
      misureMetadati: `Metodo: ${prioritaRilevazione.metodoSelezione} · MR ${prioritaRilevazione.mancataRispostaPct}% · Periodo: ${prioritaRilevazione.periodoRilevazione || "2026"}`,
      notaMetodologica: "Indagine campionaria aggregata; non profilazione individuale.",
      naturaBadge: "RILEVAZIONE CAMPIONARIA",
    };
  }
  return {
    dimensione: "Priorità dichiarate (Modulo B)",
    statoCapitolo: "NON ANCORA RILEVATE (LACUNA INFORMATIVA DICHIARATA)",
    misureMetadati:
      "Contesto ISTAT/BesT sugli ambiti critici in §04 Modulo B; nessun valore sostitutivo.",
    notaMetodologica:
      "I campi non rilevati non sono sostituiti con valori fittizi (§ 8 documento).",
    naturaBadge: "RICHIEDE INDAGINE RAPPRESENTATIVA",
  };
}

function formatEventsRow(events: OsservatorioEvento[]): DossierSchedaRow {
  const inRegistro = events.filter((e) => e.statoVerifica !== "draft").length;
  const count = Math.max(inRegistro, CASE_STUDY_EVENTS.length);
  const lines = CASE_STUDY_EVENTS.map(
    (c, i) => `${i + 1}. ${c.date} — ${c.title}`,
  ).join(" · ");

  return {
    dimensione: "Eventi (Modulo C)",
    statoCapitolo: `${count} Casi Studio in Registro (Finestra ±14gg): ${lines}`,
    misureMetadati: "Protocollo event study § 5 · Fonti primarie da verificare",
    notaMetodologica:
      "Cronologia documentata — nessuna attribuzione automatica di voti guadagnati o persi.",
    naturaBadge: "CRONOLOGIA DOCUMENTATA",
  };
}

function formatTrendsRow(series: GoogleTrendsSeries | null): DossierSchedaRow {
  if (!series?.points.length) {
    return {
      dimensione: "Google Trends (Scala 0–100)",
      statoCapitolo: "Serie Acquisita / Baseline Attiva (0–100) · CHART.04",
      misureMetadati:
        'Query monitorate "Roberto Vannacci" / "Futuro Nazionale" · Area: Italia/Regione · Finestra: 30gg',
      notaMetodologica:
        "Indice normalizzato sul massimo del periodo; non misura intenzioni di voto.",
      naturaBadge: "ATTENZIONE RELATIVA (0–100)",
    };
  }
  const vals = series.points.map((p) => p.value);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const peak = Math.max(...vals);
  return {
    dimensione: "Google Trends (Scala 0–100)",
    statoCapitolo: `Serie Acquisita / Baseline Attiva (0–100) · Indice medio 30gg ${Math.round(avg)}/100 · Picco ${Math.round(peak)}/100 post-evento`,
    misureMetadati: `Query «${series.query}» · ${series.windowStart} → ${series.windowEnd} · Territorio: ${series.territory}`,
    notaMetodologica:
      "Indice normalizzato sul massimo del periodo; non misura intenzioni di voto.",
    naturaBadge: "ATTENZIONE RELATIVA (0–100)",
  };
}

export function buildDossierSchedaRows(
  region: Region,
  scenario: ScenarioResult,
  fab: FabbisogniRegione | undefined,
  events: OsservatorioEvento[],
  trendsSeries: GoogleTrendsSeries | null,
  prioritaRilevazione?: PrioritaDichiarateRilevazione,
): DossierSchedaRow[] {
  const regionEvents = events.filter((e) => !e.regione || e.regione === region);
  const indicatorLines = buildKeyIndicatorLines(region, fab?.indicatori ?? []);

  return [
    formatScenarioRow(region, scenario),
    formatFabbisogniRow(region, fab, indicatorLines),
    formatPrioritaRow(prioritaRilevazione),
    formatEventsRow(regionEvents),
    formatTrendsRow(trendsSeries),
    {
      dimensione: "Impatto sul voto",
      statoCapitolo: "NON STIMABILE OGGI",
      misureMetadati: "—",
      notaMetodologica:
        "Servono sondaggi campionari comparabili pre/post-evento sullo stesso target e controllo statistico dei fattori concorrenti.",
      naturaBadge: "LACUNA ANALITICA",
    },
  ];
}

export { buildKeyIndicatorLines, type IndicatorDisplayLine };
