"use client";

import {
  DomainStressComparativeChart,
  EntropyAndCalibrationChart,
  EventStudyTrendsChart,
} from "@/components/charts/AnalyticalChartsSuite";
import {
  fmtDecimalIt,
  fmtMultiplierIt,
  fmtNumIt,
  fmtPctIt,
} from "@/components/charts/chartUtils";
import {
  buildDossierSchedaRows,
  buildKeyIndicatorLines,
  CASE_STUDY_EVENTS,
} from "@/components/osservatorioSchedaDisplay";
import { buildRegionalBaselineTrends } from "@/components/charts/osservatorioBaselineTrends";
import {
  ModuloATerritorySelect,
  TerritoryScopeSelect,
  TerritoryScopeToolbar,
} from "@/components/OsservatorioTerritoryControls";
import { CsvDropzone } from "@/components/CsvDropzone";
import type { Region } from "@/lib/engine/constants";
import { OFFICIAL_S } from "@/lib/engine/defaults";
import { buildDemoTrendsSeries } from "@/lib/engine/demoTrendsSeries";
import { computeResolvedTerritorialStress } from "@/lib/engine/fabbisogniCatalogFallback";
import type {
  FabbisogniCatalogFile,
  FabbisogniRegione,
  GoogleTrendsSeries,
  OsservatorioCloudPayload,
  OsservatorioEvento,
  PrioritaDichiarateRilevazione,
} from "@/lib/engine/osservatorioTypes";
import {
  buildDomainStressRows,
  computeNationalScenarioSummary,
  isRegionScope,
  moduloAForScope,
  NATIONAL_FABBISOGNI_BENCHMARKS,
  nationalDomainStressReferenceRows,
  regionStressRanking,
  TERRITORY_NAZIONALE,
  type ModuloAProfile,
  type TerritoryScope,
} from "@/lib/engine/osservatorioTerritoryScope";
import type { ScenarioResult } from "@/lib/engine/types";
import { RegionalPartyHistoryBar } from "@/components/RegionalPartyHistoryBar";
import { getRegionalPartyHistory } from "@/lib/fnProgramAndAffinityEngine";
import { type ReactNode, useEffect, useMemo, useState } from "react";

const NAV = [
  { id: "osservatorio-sec-1", num: "01", label: "Sintesi" },
  { id: "osservatorio-sec-2", num: "02", label: "Scheda" },
  { id: "osservatorio-sec-3", num: "03", label: "Consenso nei territori" },
  { id: "osservatorio-sec-4", num: "04", label: "Bisogni del territorio" },
  { id: "osservatorio-sec-5", num: "05", label: "Eventi e ricerche online" },
  { id: "osservatorio-sec-6", num: "06", label: "Piano '27" },
] as const;

const MONO =
  "bg-[#080C14] border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]";

const METADATA_POINTS = [
  "01 Fonte",
  "02 Territorio",
  "03 Popolazione rif.",
  "04 Periodo misurato",
  "05 Data pubblicazione",
  "06 Metodo",
  "07 Natura dato",
  "08 Confrontabilità",
];

const LIMITI_METODO = [
  "Fonti ISTAT/BesT/AGENAS con periodi di pubblicazione distinti per indicatore.",
  "Google Trends 0–100: scala relativa al picco del periodo selezionato.",
  "Equilibrio H: copertura del tesseramento sulle 20 regioni.",
  "Stress territoriale: sintesi su sanità, lavoro e abitare/trasporti.",
  "Event study: finestre ±14 gg e serie Trends esportate a parametri bloccati.",
  "Scenari Monte Carlo: esplorazione descrittiva con seme e ipotesi documentate.",
  "Priorità campionarie: lacune lasciate esplicite fino a nuova rilevazione.",
];

const QUESTIONARIO = [
  "Quali sono, secondo lei, i tre problemi più importanti nel suo territorio?",
  "Quale difficoltà ha incontrato personalmente negli ultimi 12 mesi?",
  "Quanto è soddisfatto dei principali servizi pubblici locali?",
  "Quanto ritiene urgenti diverse possibili soluzioni, presentate in modo equilibrato?",
  "Qual è la sua intenzione di voto oggi?",
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type Sec4Mode = "nazionale" | "singola" | "confronto";

function columnLabel(scope: TerritoryScope): string {
  if (scope === TERRITORY_NAZIONALE) return "Italia (Media Nazionale)";
  if (scope === "Veneto") return "Veneto (Doc §2)";
  if (scope === "Lazio") return "Lazio (Doc §8)";
  return scope;
}

function SectionHeader({
  badge,
  title,
  right,
}: {
  badge: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-white/[0.07] bg-gradient-to-r from-emerald-500/[0.04] via-transparent to-transparent px-6 py-5">
      <div className="min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
          {badge}
        </span>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">{title}</h2>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

const MODULO_A_COMPARE_ROWS: {
  label: string;
  format: (d: ModuloAProfile) => string;
}[] = [
  {
    label: "Bacino Elettorale e Flussi (peso 35%)",
    format: (d) => `${fmtPctIt(d.f, 2)}%`,
  },
  {
    label: "Preferenze Storiche Vannacci (peso 25%)",
    format: (d) => `${fmtPctIt(d.v, 2)}%`,
  },
  {
    label: "Tesseramento e Iscritti FN (peso 25%)",
    format: (d) => `${fmtPctIt(d.s, 2)}%`,
  },
  {
    label: "Sindaci ed Eletti sul Territorio (peso 15%)",
    format: (d) => `${fmtPctIt(d.m, 2)}%`,
  },
  {
    label: "Quota di Forza Nazionale FN nella Regione",
    format: (d) => `${fmtPctIt(d.p, 2)}%`,
  },
  {
    label: "Peso Elettorale della Regione sul Totale Italia",
    format: (d) => `${fmtPctIt(d.q, 2)}%`,
  },
  {
    label: "Moltiplicatore di Spinta Territoriale",
    format: (d) => fmtMultiplierIt(d.w, 2),
  },
  {
    label: "Consenso Stimato",
    format: (d) => `${fmtPctIt(d.sReg, 2)}%`,
  },
  {
    label: "Voti Stimati FN",
    format: (d) => fmtNumIt(d.voti),
  },
];

function ModuloACompareTable({
  colA,
  colB,
  labelA,
  labelB,
}: {
  colA: ModuloAProfile;
  colB: ModuloAProfile;
  labelA: string;
  labelB: string;
}) {
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b border-white/[0.07] text-[9px] uppercase text-slate-500">
          <th className="px-4 py-2 text-left font-medium">Indicatore di forza territoriale</th>
          <th className="px-4 py-2 text-left font-medium">Territorio A · {labelA}</th>
          <th className="px-4 py-2 text-left font-medium">Territorio B · {labelB}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.06] tabular-nums text-slate-300">
        {MODULO_A_COMPARE_ROWS.map((r) => (
          <tr key={r.label} className="hover:bg-white/[0.02]">
            <td className="px-4 py-2.5 text-[11px] leading-snug text-slate-400">{r.label}</td>
            <td className="px-4 py-2.5 font-mono text-sm">{r.format(colA)}</td>
            <td className="px-4 py-2.5 font-mono text-sm text-emerald-300/90">{r.format(colB)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Props = {
  scenario: ScenarioResult;
  baselineScenario: ScenarioResult;
  liveS: number;
  onRestoreBaselineS: () => void;
  mainTerritory: TerritoryScope;
  setMainTerritory: (t: TerritoryScope) => void;
  regione: Region;
  setRegione: (r: Region) => void;
  fabbisogni: FabbisogniCatalogFile | null;
  fabRegione: FabbisogniRegione | undefined;
  events: OsservatorioEvento[];
  activeTrendSeries: GoogleTrendsSeries | null;
  prioritaRegione?: PrioritaDichiarateRilevazione;
  monthlyNote?: string;
  setMonthlyNote: (v: string) => void;
  dataDrawerOpen: boolean;
  setDataDrawerOpen: (v: boolean) => void;
  cloud: OsservatorioCloudPayload;
  dbConnected: boolean;
  cloudMeta: { updatedAt: string | null; updatedBy: string | null; source: string };
  onSaveCloud: () => void;
  onExportPdf: () => void;
  onPrioritaCsv: (text: string) => void;
  onTrendsCsv: (text: string) => void;
  onLoadDemoTrends: () => void;
  onAddEvent: () => void;
  onSavePriorita: () => void;
  /** Mostra solo piano operativo (Trends, scheda, questionario) sotto l'hub decisionale. */
  operationalTailOnly?: boolean;
  /** Con operationalTailOnly: nasconde Scheda §8 / Modulo A e Modulo C (solo drawer dati). */
  hideSchedaAndModuloC?: boolean;
};

export function OsservatorioOnePageDossier(props: Props) {
  const {
    scenario,
    liveS,
    onRestoreBaselineS,
    mainTerritory,
    setMainTerritory,
    regione,
    setRegione,
    fabbisogni,
    fabRegione,
    events,
    activeTrendSeries,
    prioritaRegione,
    monthlyNote,
    setMonthlyNote,
    dataDrawerOpen,
    setDataDrawerOpen,
    cloud,
    onSaveCloud,
    onExportPdf,
    onPrioritaCsv,
    onTrendsCsv,
    onLoadDemoTrends,
    onAddEvent,
    onSavePriorita,
    operationalTailOnly = false,
    hideSchedaAndModuloC = false,
  } = props;

  const showSchedaAndModuloC =
    !operationalTailOnly || !hideSchedaAndModuloC;

  const [sec2Scope, setSec2Scope] = useState<TerritoryScope>(mainTerritory);
  const [sec3ColA, setSec3ColA] = useState<TerritoryScope>("Veneto");
  const [sec3ColB, setSec3ColB] = useState<TerritoryScope>("Lazio");
  const [sec4Mode, setSec4Mode] = useState<Sec4Mode>("nazionale");
  const [sec4Region, setSec4Region] = useState<Region>("Lazio");
  const [sec4RegionA, setSec4RegionA] = useState<Region>("Calabria");
  const [sec4RegionB, setSec4RegionB] = useState<Region>("Veneto");
  const [sec5Scope, setSec5Scope] = useState<TerritoryScope>(TERRITORY_NAZIONALE);

  useEffect(() => {
    setSec2Scope(mainTerritory);
    setSec3ColA(mainTerritory);
    if (mainTerritory === TERRITORY_NAZIONALE) {
      setSec4Mode("nazionale");
      setSec5Scope(TERRITORY_NAZIONALE);
      setSec3ColB("Veneto");
    } else {
      setSec4Mode("singola");
      setSec4Region(mainTerritory);
      setSec5Scope(mainTerritory);
      setSec3ColB(TERRITORY_NAZIONALE);
    }
  }, [mainTerritory]);

  const sec2Region = isRegionScope(sec2Scope) ? sec2Scope : regione;
  const sec2Fab = fabbisogni?.regions[sec2Region];
  const sec2Priorita = cloud.prioritaDichiarate[sec2Region];

  const nationalSummary = useMemo(
    () => computeNationalScenarioSummary(scenario, liveS),
    [scenario, liveS],
  );

  const row = scenario.righe.find((r) => r.regione === sec2Region);
  const chartTrendSeries = useMemo(() => {
    if (sec5Scope === TERRITORY_NAZIONALE) {
      if (
        activeTrendSeries?.points.length &&
        activeTrendSeries.territory === "Italia"
      ) {
        return activeTrendSeries;
      }
      return buildDemoTrendsSeries();
    }
    if (activeTrendSeries?.points.length) return activeTrendSeries;
    return buildRegionalBaselineTrends(sec5Scope, events);
  }, [sec5Scope, activeTrendSeries, events]);

  const dossierRows = buildDossierSchedaRows(
    sec2Region,
    scenario,
    sec2Fab,
    events,
    chartTrendSeries,
    sec2Priorita,
  );
  const indicatorLines = buildKeyIndicatorLines(
    sec2Region,
    sec2Fab?.indicatori ?? [],
  );
  const stressAgg = computeResolvedTerritorialStress(
    sec2Fab?.indicatori ?? [],
    sec2Region,
  ).aggregate;
  const effectiveSec3ColB: TerritoryScope =
    sec3ColA === TERRITORY_NAZIONALE && sec3ColB === TERRITORY_NAZIONALE
      ? "Veneto"
      : sec3ColB;
  const colAData = moduloAForScope(sec3ColA, scenario, liveS, sec3ColA === "Veneto");
  const colBData = moduloAForScope(
    effectiveSec3ColB,
    scenario,
    liveS,
    effectiveSec3ColB === "Veneto",
  );

  const sec4PrimaryRegion =
    sec4Mode === "confronto"
      ? sec4RegionA
      : sec4Mode === "singola"
        ? sec4Region
        : "Lazio";
  const domainStressChart = useMemo(() => {
    if (sec4Mode === "nazionale") return nationalDomainStressReferenceRows();
    return buildDomainStressRows(fabbisogni, sec4PrimaryRegion);
  }, [sec4Mode, fabbisogni, sec4PrimaryRegion]);

  const sec4CompareLines = useMemo(() => {
    if (sec4Mode !== "confronto") return null;
    return {
      a: buildKeyIndicatorLines(
        sec4RegionA,
        fabbisogni?.regions[sec4RegionA]?.indicatori ?? [],
      ),
      b: buildKeyIndicatorLines(
        sec4RegionB,
        fabbisogni?.regions[sec4RegionB]?.indicatori ?? [],
      ),
    };
  }, [sec4Mode, sec4RegionA, sec4RegionB, fabbisogni]);

  const sec4IndicatorLines =
    sec4Mode === "confronto"
      ? buildKeyIndicatorLines(
          sec4RegionA,
          fabbisogni?.regions[sec4RegionA]?.indicatori ?? [],
        )
      : sec4Mode === "nazionale"
        ? []
        : buildKeyIndicatorLines(
            sec4Region,
            fabbisogni?.regions[sec4Region]?.indicatori ?? [],
          );

  const stressRanking = regionStressRanking();
  const sLive = liveS * 100;
  const showRestore = Math.abs(liveS - OFFICIAL_S) > 0.0005;
  const hIsc = scenario.metriche.H.iscritti;
  const hScen = scenario.metriche.H.scenario;
  const js = scenario.metriche.JS.scenario_benchmark;

  const trendsAvg = chartTrendSeries?.points.length
    ? Math.round(
        chartTrendSeries.points.reduce((a, p) => a + p.value, 0) /
          chartTrendSeries.points.length,
      )
    : null;
  const trendsPeak = chartTrendSeries?.points.length
    ? Math.max(...chartTrendSeries.points.map((p) => p.value))
    : null;

  const stimaDisplay =
    sec2Scope === TERRITORY_NAZIONALE
      ? fmtPctIt(liveS * 100, 2)
      : row
        ? fmtPctIt(row.stima * 100, 2)
        : "—";
  const docBadgeLazio = sec2Region === "Lazio";
  const docBadgeVeneto = sec2Region === "Veneto";

  const sec5Events =
    sec5Scope === TERRITORY_NAZIONALE
      ? events
      : events.filter((e) => !e.regione || e.regione === sec5Scope);
  const sec5RegionLabel =
    sec5Scope === TERRITORY_NAZIONALE ? "Italia (20 Regioni)" : sec5Scope;

  const sec2Id = operationalTailOnly ? "osservatorio-sec-02" : "osservatorio-sec-2";
  const sec5Id = operationalTailOnly ? "osservatorio-sec-05" : "osservatorio-sec-5";

  return (
    <div className={operationalTailOnly ? "space-y-8" : "space-y-8 pb-36"}>
      {!operationalTailOnly ? (
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#070A12]/90 px-3 py-2 backdrop-blur-xl">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-lg border border-white/[0.05] bg-white/[0.03] p-1 [scrollbar-width:none]">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => scrollTo(n.id)}
              className="flex shrink-0 items-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <span className="mr-1 font-mono text-[10px] text-emerald-400">{n.num}</span>
              {n.label}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={showRestore ? onRestoreBaselineS : undefined}
            className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 font-mono text-[11px] text-emerald-300"
            title={showRestore ? "Ripristina il valore di riferimento" : "Valore di riferimento attivo"}
          >
            S {fmtPctIt(sLive, 2)}%
          </button>
          <button
            type="button"
            onClick={() => setDataDrawerOpen(!dataDrawerOpen)}
            className="h-7 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs text-slate-200 hover:bg-white/[0.08]"
          >
            Dati &amp; CSV
          </button>
          <button
            type="button"
            onClick={onSaveCloud}
            className="h-7 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs text-slate-200 hover:bg-white/[0.08]"
          >
            Salva Cloud
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            className="h-7 rounded-md bg-emerald-500 px-3 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Esporta PDF
          </button>
        </div>
      </div>
      ) : null}

      {!operationalTailOnly ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#070A12]/80 px-4 py-3">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
            Territorio globale · aggiorna tutte le sezioni (override locale in §02–§05)
          </p>
          <TerritoryScopeToolbar value={mainTerritory} onChange={setMainTerritory} />
        </div>
      ) : null}

      {dataDrawerOpen ? (
        <div
          className={`${MONO} grid divide-x divide-white/[0.06] md:grid-cols-3`}
        >
          <div className="p-4">
            <p className="mb-2 font-mono text-[9px] uppercase text-slate-500">Bisogni del territorio</p>
            <CsvDropzone label="Import CSV" onText={onPrioritaCsv} />
            <button
              type="button"
              onClick={onSavePriorita}
              className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
            >
              Salva {regione}
            </button>
          </div>
          <div className="p-4">
            <p className="mb-2 font-mono text-[9px] uppercase text-slate-500">Ricerche online</p>
            <CsvDropzone label="Import CSV" onText={onTrendsCsv} />
            <button
              type="button"
              onClick={onLoadDemoTrends}
              className="mt-2 text-xs text-slate-400 hover:text-white"
            >
              Serie demo 0–100
            </button>
          </div>
          <div className="p-4">
            <p className="mb-2 font-mono text-[9px] uppercase text-slate-500">Eventi</p>
            <button
              type="button"
              onClick={onAddEvent}
              className="text-xs text-slate-300 hover:text-white"
            >
              + Episodio
            </button>
            <p className="mt-2 font-mono text-[9px] text-slate-600">{cloud.events.length} in registro</p>
          </div>
        </div>
      ) : null}

      {!operationalTailOnly ? (
      /* §01 */
      <section id="osservatorio-sec-1" className={`scroll-mt-28 ${MONO}`}>
        <SectionHeader
          badge="SEZIONE 01"
          title="Osservatorio Integrato — Sintesi Metodologica per la Dirigenza"
          right={
            <span className="font-mono text-[11px] text-slate-400">
              DOCUMENTO DI LAVORO · {new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }).toUpperCase()} | ORIZZONTE ODIERNO – MAG 2027
            </span>
          }
        />
        <div className="grid grid-cols-1 divide-y divide-white/[0.07] border-b border-white/[0.07] bg-[#0A0F1A]/60 md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            {
              t: "01 // Bisogni del territorio",
              b: "Indicatori oggettivi su servizi e condizioni di vita per territorio.",
            },
            {
              t: "02 // Ricerche online",
              b: "Indice Google Trends 0–100 sull'attenzione relativa nel periodo.",
            },
            {
              t: "03 // Event study",
              b: "Cronologia eventi con finestre ±14 gg e serie Trends allineate.",
            },
          ].map((x) => (
            <div key={x.t} className="p-5">
              <div className="mb-2.5 h-0.5 w-6 bg-amber-400" />
              <p className="text-xs font-mono uppercase tracking-wider text-amber-300">{x.t}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{x.b}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 divide-y divide-white/[0.07] border-b border-white/[0.07] md:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-y-0">
          {[
            {
              t: "MODULO A · ELETTORALE",
              q: "Dove viene rilevato o ipotizzato il consenso?",
              o: "Sondaggi nazionali (input 7,2% ott. 2026) e scenari regionali Monte Carlo.",
              n: "Simulazione territoriale",
            },
            {
              t: "MODULO B · FABBISOGNI",
              q: "Quali condizioni emergono nei territori?",
              o: "Indicatori ufficiali su servizi e condizioni di vita, più priorità dichiarate.",
              n: "Osservato + campionario",
            },
            {
              t: "MODULO C · EVENTI & OPINIONE",
              q: "A cosa si presta attenzione e cosa cambia dopo?",
              o: "Cronologia ±14 gg, Google Trends (0–100), sondaggi pre/post.",
              n: "Attenzione + event study",
            },
            {
              t: "3 RISULTATI / MESE",
              q: "Output mensile consegnabile",
              o: "Quadro scenari · Scheda bisogni · Nota eventi con incertezza.",
              n: "Confronti e lacune esplicite",
            },
          ].map((c) => (
            <div key={c.t} className="p-5 transition-colors hover:bg-white/[0.015]">
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">{c.t}</p>
              <p className="mt-1.5 text-sm font-semibold text-white">{c.q}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{c.o}</p>
              <p className="mt-3 inline-block font-mono text-[9px] text-slate-500">{c.n}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 bg-[#060910] px-6 py-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Protocollo 8 Metadati Obbligatori:
          </span>
          {METADATA_POINTS.map((m, i) => (
            <span key={m} className="font-mono text-[10px] text-slate-600">
              {i > 0 ? "· " : ""}
              {m}
            </span>
          ))}
        </div>
      </section>
      ) : null}

      {showSchedaAndModuloC ? (
      /* §02 */
      <section id={sec2Id} className={`scroll-mt-28 ${MONO}`}>
        <SectionHeader
          badge="SEZIONE 02"
          title="Quadro elettorale e scheda mensile"
          right={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSec2Scope(TERRITORY_NAZIONALE)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  sec2Scope === TERRITORY_NAZIONALE
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                ITALIA · Quadro Nazionale
              </button>
              {(
                [
                  ["Lazio", "Esempio Doc §8: Lazio"],
                  ["Veneto", "Esempio Doc §2: Veneto"],
                ] as const
              ).map(([r, label]) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setSec2Scope(r);
                    setRegione(r);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    sec2Scope === r
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
              <TerritoryScopeSelect
                value={sec2Scope}
                onChange={(v) => {
                  setSec2Scope(v);
                  if (isRegionScope(v)) setRegione(v);
                }}
                showNav
              />
            </div>
          }
        />
        <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.07] border-b border-white/[0.07] bg-[#0A0E17] md:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
          {(
            sec2Scope === TERRITORY_NAZIONALE
              ? [
                  ["TERRITORIO", "Italia · Quadro Nazionale (20 Regioni)"],
                  ["TEMPO", "Ottobre 2026 · Sintesi mensile nazionale"],
                  [
                    "CONSENSO",
                    `Base Nazionale ${fmtPctIt(nationalSummary.sNazionale * 100, 2)}% · ${fmtNumIt(nationalSummary.totalVoti)} voti stimati`,
                  ],
                  [
                    "BISOGNI",
                    `Stress medio Italia: ${nationalSummary.nationalAvgStress}/100 · 20 regioni monitorate`,
                  ],
                  [
                    "EVENTI",
                    `${events.length} episodi in registro nazionale · Finestra ±14 gg`,
                  ],
                  [
                    "ESITO",
                    `${nationalSummary.regionsAbove3Pct}/20 regioni sopra la soglia del 3% · Copertura omogenea`,
                  ],
                ]
              : [
                  ["TERRITORIO", sec2Region],
                  ["TEMPO", "Ottobre 2026 · Periodi distinti per fonte"],
                  [
                    "CONSENSO",
                    row
                      ? `Input ${fmtPctIt(scenario.parametri.S * 100, 2)}% → ${stimaDisplay}%`
                      : "—",
                  ],
                  ["BISOGNI", `Stress sintesi ${stressAgg}/100 · 3 ambiti + indagine`],
                  ["EVENTI", "2 casi studio ±14 gg + Trends"],
                  ["ESITO", "Convergenze · divergenze · lacune"],
                ]
          ).map(([k, v]) => (
            <div key={k} className="px-4 py-3">
              <p className="font-mono text-[9px] uppercase text-slate-600">{k}</p>
              <p className="mt-0.5 text-[11px] text-slate-300">{v}</p>
            </div>
          ))}
        </div>
        {isRegionScope(sec2Scope) ? (
          <div className="border-b border-white/[0.07] px-6 py-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-violet-300">
              Storico elettorale regionale · Verdetto campagna FN
            </p>
            <div className="mt-3 max-w-3xl">
              <RegionalPartyHistoryBar history={getRegionalPartyHistory(sec2Region)} />
            </div>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.07] font-mono text-[9px] uppercase tracking-wide text-slate-500">
                <th className="w-[18%] px-4 py-3">Dimensione</th>
                <th className="w-[28%] px-4 py-3">Stato capitolo (§ 8)</th>
                <th className="w-[34%] px-4 py-3">Misure &amp; metadati</th>
                <th className="w-[20%] px-4 py-3">Nota &amp; natura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              <tr className="align-top">
                <td className="px-4 py-4 font-medium text-slate-200">
                  Stima del consenso
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold text-emerald-400">
                      {stimaDisplay}%
                    </span>
                    {docBadgeLazio ? (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
                        ≈ 6,6% doc §8
                      </span>
                    ) : null}
                    {docBadgeVeneto ? (
                      <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300">
                        9,21% doc §2
                      </span>
                    ) : null}
                  </div>
                  {sec2Scope === TERRITORY_NAZIONALE ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        Voti totali stimati: {fmtNumIt(nationalSummary.totalVoti)}
                      </span>
                      <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        Tesserati totali FN: {fmtNumIt(nationalSummary.totalIscritti)}
                      </span>
                      <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        Regioni sopra soglia 3%: {nationalSummary.regionsAbove3Pct} su 20
                      </span>
                      <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        Equilibrio Nazionale: {fmtPctIt(nationalSummary.hEquilibrioPct, 1)}%
                      </span>
                    </div>
                  ) : row ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        Forbice stimata: {fmtPctIt(row.lo10 * 100, 2)}% – {fmtPctIt(row.hi90 * 100, 2)}%
                      </span>
                      <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        Voti: {fmtNumIt(row.voti_di_scenario)}
                      </span>
                      <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        Iscritti: {fmtNumIt(row.iscritti)}
                      </span>
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-slate-400">{dossierRows[0]?.misureMetadati}</td>
                <td className="px-4 py-4">
                  <NaturaBadge label={dossierRows[0]?.naturaBadge ?? ""} />
                  <p className="mt-1 text-[10px] text-slate-500">{dossierRows[0]?.notaMetodologica}</p>
                </td>
              </tr>
              <tr className="align-top">
                <td className="px-4 py-4 font-medium text-slate-200">
                  Bisogni rilevati dai dati
                </td>
                <td className="px-4 py-4">
                  {sec2Scope === TERRITORY_NAZIONALE ? (
                    <>
                      <span className="font-mono text-xl font-bold text-white">
                        {nationalSummary.nationalAvgStress}
                      </span>
                      <span className="text-slate-500"> / 100</span>
                      <p className="mt-2 text-[11px] text-slate-500">
                        Indice Medio Italia · benchmark nazionali
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="font-mono text-xl font-bold text-white">{stressAgg}</span>
                      <span className="text-slate-500"> / 100</span>
                      <div className="mt-2 h-1.5 max-w-[140px] overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500/80 to-amber-400/80"
                          style={{ width: `${Math.min(100, stressAgg)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        3 ambiti presidiati (Sanità, Lavoro, Abitare)
                      </p>
                    </>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.06] bg-[#0A0E17]/80">
                    {sec2Scope === TERRITORY_NAZIONALE ? (
                      <>
                        <NationalBenchmarkLine
                          tag="SANITÀ · MEDIA ITALIA"
                          body={`Tempi medi attesa specialistica: ${NATIONAL_FABBISOGNI_BENCHMARKS.sanita.gg} gg · Rinuncia alle cure: ${String(NATIONAL_FABBISOGNI_BENCHMARKS.sanita.rinuncia).replace(".", ",")}%`}
                          note="Range regionale: da 28 gg Veneto/TAA a 54 gg Calabria"
                          stress={NATIONAL_FABBISOGNI_BENCHMARKS.sanita.stress}
                        />
                        <NationalBenchmarkLine
                          tag="LAVORO · MEDIA ITALIA"
                          body={`Tasso occupazione 20–64 anni: ${String(NATIONAL_FABBISOGNI_BENCHMARKS.lavoro.occ).replace(".", ",")}%`}
                          note="Range regionale: da 44,8% Sud/Isole a 71,2% Nord"
                          stress={NATIONAL_FABBISOGNI_BENCHMARKS.lavoro.stress}
                        />
                        <NationalBenchmarkLine
                          tag="FAMIGLIE & ABITARE · MEDIA ITALIA"
                          body={`Sovraccarico costo abitazione: ${String(NATIONAL_FABBISOGNI_BENCHMARKS.famiglie.sov).replace(".", ",")}%`}
                          note="Benchmark ISTAT BesT 2025 · OpenCivitas"
                          stress={NATIONAL_FABBISOGNI_BENCHMARKS.famiglie.stress}
                        />
                      </>
                    ) : (
                      indicatorLines.map((l) => (
                        <div key={l.id} className="space-y-1 px-3 py-2.5 text-[11px]">
                          <p className="text-slate-300">
                            <span className="font-mono text-[9px] text-emerald-400">[{l.tag}]</span>{" "}
                            <span className="text-slate-400">{shortTitle(l)}</span>
                          </p>
                          <p>
                            <strong className="font-mono text-white">{l.valoreCompact}</strong>
                            <span className="text-slate-500">
                              {" "}
                              (Italia: {l.benchmarkCompact})
                            </span>
                          </p>
                          <p className="font-mono text-[9px] text-slate-600">
                            {l.pubBadge} · Stress {l.stress}/100
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <NaturaBadge label={dossierRows[1]?.naturaBadge ?? ""} />
                  <p className="mt-1 text-[10px] text-slate-500">{dossierRows[1]?.notaMetodologica}</p>
                </td>
              </tr>
              <tr className="align-top">
                <td className="px-4 py-4 font-medium text-slate-200">
                  Priorità dichiarate
                </td>
                <td className="px-4 py-4" colSpan={2}>
                  {sec2Priorita ? (
                    <p className="text-slate-300">{dossierRows[2]?.statoCapitolo}</p>
                  ) : (
                    <>
                      <span className="inline-block rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-200">
                        NON ANCORA RILEVATE (LACUNA DICHIARATA §8)
                      </span>
                      <p className="mt-2 max-w-lg text-[11px] leading-relaxed text-slate-500">
                        {dossierRows[2]?.notaMetodologica}
                      </p>
                    </>
                  )}
                </td>
                <td className="px-4 py-4">
                  <NaturaBadge label={dossierRows[2]?.naturaBadge ?? ""} />
                </td>
              </tr>
              <tr className="align-top">
                <td className="px-4 py-4 font-medium text-slate-200">Eventi</td>
                <td className="px-4 py-4" colSpan={2}>
                  <div className="space-y-2">
                    {CASE_STUDY_EVENTS.map((ev) => (
                      <div key={ev.date} className="flex gap-2 text-[11px]">
                        <span className="shrink-0 font-mono text-amber-300/90">{ev.date}</span>
                        <span className="text-slate-400">{ev.title}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <NaturaBadge label={dossierRows[3]?.naturaBadge ?? ""} />
                  <p className="mt-1 text-[10px] text-slate-500">{dossierRows[3]?.notaMetodologica}</p>
                </td>
              </tr>
              <tr className="align-top">
                <td className="px-4 py-4 font-medium text-slate-200">
                  Google Trends · 0–100
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-300">
                      Media 30gg {trendsAvg ?? "—"}/100
                    </span>
                    <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-violet-300">
                      Picco {trendsPeak ?? "—"}/100
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-400">{dossierRows[4]?.misureMetadati}</td>
                <td className="px-4 py-4">
                  <NaturaBadge label={dossierRows[4]?.naturaBadge ?? ""} />
                </td>
              </tr>
              <tr className="align-top">
                <td className="px-4 py-4 font-medium text-slate-200">Impatto sul voto</td>
                <td className="px-4 py-4">
                  <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 font-mono text-[10px] text-amber-200">
                    NON STIMABILE OGGI
                  </span>
                </td>
                <td className="px-4 py-4 text-[11px] text-slate-500" colSpan={2}>
                  {dossierRows[5]?.notaMetodologica}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="border-t border-white/[0.07] bg-[#060910] px-6 py-3">
          <label className="block font-mono text-[9px] uppercase text-slate-600">
            Nota analitica mensile
          </label>
          <textarea
            rows={2}
            className="mt-1 w-full resize-y border-0 bg-transparent text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-0"
            placeholder="Annotazione dirigenziale…"
            value={monthlyNote ?? ""}
            onChange={(e) => setMonthlyNote(e.target.value)}
          />
        </div>
        {operationalTailOnly ? (
          <ModuloAComparePanel
            sec3ColA={sec3ColA}
            sec3ColB={sec3ColB}
            effectiveSec3ColB={effectiveSec3ColB}
            setSec3ColA={setSec3ColA}
            setSec3ColB={setSec3ColB}
            colAData={colAData}
            colBData={colBData}
            hIsc={hIsc}
            hScen={hScen}
            js={js}
            embeddedInSec02
          />
        ) : null}
      </section>
      ) : null}

      {!operationalTailOnly ? (
      /* §03 */
      <section id="osservatorio-sec-3" className={`scroll-mt-28 ${MONO}`}>
        <SectionHeader
          badge="SEZIONE 03"
          title="Consenso: confronto tra due territori e dato nazionale"
          right={
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <label className="text-slate-500">A</label>
              <ModuloATerritorySelect value={sec3ColA} onChange={setSec3ColA} />
              <label className="text-slate-500">B</label>
              <ModuloATerritorySelect value={sec3ColB} onChange={setSec3ColB} />
            </div>
          }
        />
        <div className="flex flex-wrap gap-2 border-b border-white/[0.07] bg-[#060910] px-6 py-3">
          {[
            {
              label: "Preset Doc §2: Veneto vs Italia",
              a: "Veneto" as TerritoryScope,
              b: TERRITORY_NAZIONALE,
            },
            {
              label: "Confronto Locomotiva: Veneto vs Calabria",
              a: "Veneto" as TerritoryScope,
              b: "Calabria" as TerritoryScope,
            },
            {
              label: "Grandi Bacini: Lombardia vs Lazio",
              a: "Lombardia" as TerritoryScope,
              b: "Lazio" as TerritoryScope,
            },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setSec3ColA(p.a);
                setSec3ColB(p.b);
              }}
              className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[11px] text-slate-400 hover:bg-white/[0.04] hover:text-white"
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const a = sec3ColA;
              setSec3ColA(sec3ColB);
              setSec3ColB(a);
            }}
            className="rounded-lg border border-emerald-500/20 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10"
          >
            Scambia Colonne ⇄
          </button>
        </div>
        <div className="border-b border-white/[0.07] bg-[#060910] px-6 py-2 text-[12px] leading-relaxed text-slate-400">
          Bacino elettorale, tesseramento, eletti locali e moltiplicatore di spinta territoriale — linguaggio
          dirigenziale, senza formule algebriche esposte.
        </div>
        <div className="grid xl:grid-cols-12">
          <div className="border-b border-white/[0.07] xl:col-span-7 xl:border-b-0 xl:border-r">
            <ModuloACompareTable
              colA={colAData}
              colB={colBData}
              labelA={columnLabel(sec3ColA)}
              labelB={columnLabel(effectiveSec3ColB)}
            />
          </div>
          <div className="xl:col-span-5">
            <ModuloAEquilibrioChart hIsc={hIsc} hScen={hScen} js={js} />
          </div>
        </div>
      </section>
      ) : null}

      {!operationalTailOnly ? (
      /* §04 */
      <section id="osservatorio-sec-4" className={`scroll-mt-28 ${MONO}`}>
        <SectionHeader
          badge="SEZIONE 04"
          title="Bisogni del territorio: Italia, regione o confronto"
          right={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSec4Mode("nazionale")}
                className={`rounded-lg px-2.5 py-1 text-[11px] ${
                  sec4Mode === "nazionale"
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Vista Nazionale (Media Italia &amp; Classifica)
              </button>
              <button
                type="button"
                onClick={() => setSec4Mode("singola")}
                className={`rounded-lg px-2.5 py-1 text-[11px] ${
                  sec4Mode === "singola"
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Singola Regione
              </button>
              <TerritoryScopeSelect
                regionOnly
                value={sec4Region}
                onChange={(r) => {
                  setSec4Mode("singola");
                  setSec4Region(r);
                  setRegione(r);
                }}
              />
              <button
                type="button"
                onClick={() => setSec4Mode("confronto")}
                className={`rounded-lg px-2.5 py-1 text-[11px] ${
                  sec4Mode === "confronto"
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Confronta 2 Regioni
              </button>
              {sec4Mode === "confronto" ? (
                <>
                  <TerritoryScopeSelect
                    regionOnly
                    value={sec4RegionA}
                    onChange={setSec4RegionA}
                  />
                  <span className="text-slate-600">vs</span>
                  <TerritoryScopeSelect
                    regionOnly
                    value={sec4RegionB}
                    onChange={setSec4RegionB}
                  />
                </>
              ) : null}
            </div>
          }
        />
        <div className="grid divide-x divide-white/[0.07] border-b border-white/[0.07] md:grid-cols-2">
          <div className="px-6 py-4 text-xs text-slate-400">
            <strong className="text-slate-200">Contesto oggettivo</strong> — Indicatori ufficiali su
            sanità, lavoro, famiglie e servizi locali (fonti ISTAT e amministrazioni).
          </div>
          <div className="px-6 py-4 text-xs text-slate-400">
            <strong className="text-slate-200">Esperienza dichiarata</strong> — Indagini rappresentative;
            entrambi i livelli necessari (§ 4).
          </div>
        </div>
        <div className="grid border-b border-white/[0.07] xl:grid-cols-12">
          <div className="border-b border-white/[0.07] p-4 xl:col-span-5 xl:border-b-0 xl:border-r">
            <DomainStressComparativeChart
              rows={domainStressChart}
              regionLabel={
                sec4Mode === "nazionale"
                  ? "Italia · Media Nazionale"
                  : sec4Mode === "confronto"
                    ? `${sec4RegionA} (confronto ${sec4RegionB})`
                    : sec4Region
              }
            />
          </div>
          <div className="divide-y divide-white/[0.06] xl:col-span-7">
            {sec4Mode === "nazionale" ? (
              <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
                <div>
                  <p className="font-mono text-[9px] uppercase text-amber-300">
                    Maggiore pressione sociale (top 5)
                  </p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {stressRanking.highest.map((r, i) => (
                      <li key={r.region}>
                        <button
                          type="button"
                          className="text-left text-slate-300 hover:text-emerald-300"
                          onClick={() => {
                            setSec4Mode("singola");
                            setSec4Region(r.region);
                            setRegione(r.region);
                          }}
                        >
                          {i + 1}. {r.region}{" "}
                          <span className="font-mono text-white">{r.stress}/100</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase text-emerald-400">
                    Territori più stabili (3)
                  </p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {stressRanking.stable.map((r) => (
                      <li key={r.region}>
                        <button
                          type="button"
                          className="text-left text-slate-300 hover:text-emerald-300"
                          onClick={() => {
                            setSec4Mode("singola");
                            setSec4Region(r.region);
                            setRegione(r.region);
                          }}
                        >
                          {r.region}{" "}
                          <span className="font-mono text-white">{r.stress}/100</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : sec4Mode === "confronto" && sec4CompareLines ? (
              <div className="grid divide-x divide-white/[0.06] md:grid-cols-2">
                {[sec4CompareLines.a, sec4CompareLines.b].map((lines, idx) => (
                  <div key={idx} className="divide-y divide-white/[0.06]">
                    <p className="px-5 py-2 font-mono text-[9px] text-emerald-400">
                      {idx === 0 ? sec4RegionA : sec4RegionB}
                    </p>
                    {lines.map((l) => (
                      <div key={l.id} className="px-5 py-3 text-xs">
                        <span className="font-mono text-[9px] text-emerald-400">{l.tag}</span>
                        <p className="mt-1 text-slate-200">{shortTitle(l)}</p>
                        <p className="mt-1 font-mono text-slate-400">
                          {l.valoreCompact}{" "}
                          <span className="text-slate-600">· Italia {l.benchmarkCompact}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              sec4IndicatorLines.map((l) => (
                <div key={l.id} className="px-5 py-3 text-xs">
                  <span className="font-mono text-[9px] text-emerald-400">{l.tag}</span>
                  <p className="mt-1 text-slate-200">{shortTitle(l)}</p>
                  <p className="mt-1 font-mono text-slate-400">
                    {l.valoreCompact}{" "}
                    <span className="text-slate-600">· Italia {l.benchmarkCompact}</span>
                  </p>
                  <p className="mt-1 font-mono text-[9px] text-slate-600">{l.pubBadge}</p>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="grid divide-x divide-white/[0.07] md:grid-cols-12">
          <div className="px-6 py-5 md:col-span-5">
            <p className="font-mono text-[9px] uppercase text-slate-500">
              Collegamento fabbisogni e scenario (§ 4)
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["45%", "Sanità problemi"],
                ["7,2%", "FN campione"],
                ["6,8%", "FN sottogr. sanità"],
              ].map(([v, l]) => (
                <div key={l} className="text-center">
                  <p className="font-mono text-xl font-bold text-white">{v}</p>
                  <p className="mt-1 text-[9px] text-slate-500">{l}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Analisi su campioni rappresentativi e metadati di rilevazione documentati.
            </p>
          </div>
          <div className="divide-y divide-white/[0.06] md:col-span-7">
            {QUESTIONARIO.map((q, i) => (
              <div key={q} className="flex gap-3 px-6 py-3">
                <span className="font-mono text-[10px] text-emerald-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[12px] text-slate-400">{q}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {showSchedaAndModuloC ? (
      /* §05 */
      <section id={sec5Id} className={`scroll-mt-28 ${MONO}`}>
        <SectionHeader
          badge="SEZIONE 05"
          title="Eventi, opinioni e ricerche su Google"
          right={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSec5Scope(TERRITORY_NAZIONALE)}
                className={`rounded-lg px-2.5 py-1 text-[11px] ${
                  sec5Scope === TERRITORY_NAZIONALE
                    ? "bg-violet-500/15 text-violet-200"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                ITALIA · Livello Nazionale (Standard §6)
              </button>
              <span className="text-[11px] text-slate-500">Focus regionale</span>
              <TerritoryScopeSelect
                regionOnly
                value={isRegionScope(sec5Scope) ? sec5Scope : "Lazio"}
                onChange={(r) => setSec5Scope(r)}
              />
            </div>
          }
        />
        <div className="grid divide-x divide-white/[0.07] border-b border-white/[0.07] md:grid-cols-3">
          {[
            ["LIVELLO 1 · ATTENZIONE", "Google Trends, rassegna stampa"],
            ["LIVELLO 2 · VALUTAZIONE", "Sondaggi di opinione"],
            ["LIVELLO 3 · VOTO", "Sondaggi comparabili / panel"],
          ].map(([t, d]) => (
            <div key={t} className="px-5 py-4">
              <p className="font-mono text-[9px] text-violet-300">{t}</p>
              <p className="mt-1 text-xs text-slate-400">{d}</p>
            </div>
          ))}
        </div>
        <div className="border-b border-white/[0.07] p-4">
          <p className="mb-2 font-mono text-[10px] text-slate-500">
            Futuro Nazionale / Roberto Vannacci · Area: {sec5RegionLabel}
            {sec5Scope === TERRITORY_NAZIONALE
              ? " · Impostazione stabile Italia (§6 documento)"
              : ""}
          </p>
          <EventStudyTrendsChart
            series={chartTrendSeries}
            events={sec5Events}
            region={
              sec5Scope === TERRITORY_NAZIONALE ? undefined : sec5Scope
            }
          />
          <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] text-slate-400">
            <span>Indice attuale: {chartTrendSeries?.points.at(-1)?.value ?? "—"}/100</span>
            <span>Picco: {trendsPeak ?? "—"}/100</span>
            <span>Media 30gg: {trendsAvg ?? "—"}/100</span>
          </div>
        </div>
        <div className="grid divide-x divide-y divide-white/[0.07] md:grid-cols-2 md:divide-y-0">
          <div className="px-6 py-4">
            <p className="font-mono text-[9px] uppercase text-slate-500">Protocollo 6 passi · § 5</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-slate-400">
              <li>Data, luogo, tema, fonte primaria</li>
              <li>Finestre ±14 gg e 3/7/30 gg ex-ante</li>
              <li>Export Trends a parametri bloccati</li>
              <li>Sondaggi pre/post comparabili</li>
              <li>Eventi concorrenti annotati</li>
              <li>Nota: misurato vs non identificato</li>
            </ol>
          </div>
          <div className="grid grid-cols-2 divide-x divide-white/[0.07]">
            <div className="px-4 py-4">
              <p className="font-mono text-[9px] text-slate-500">Scala 0–100</p>
              {[
                ["100", "Max relativo periodo"],
                ["50", "Metà del picco"],
                ["0", "Dati insufficienti"],
              ].map(([v, l]) => (
                <p key={v} className="mt-2 font-mono text-sm text-white">
                  {v} <span className="text-[10px] text-slate-500">{l}</span>
                </p>
              ))}
            </div>
            <div className="px-4 py-4">
              <p className="font-mono text-[9px] text-slate-500">Esempio § 6</p>
              {[
                ["20", "Giorno prima"],
                ["100", "Giorno intervista"],
                ["45", "Tre giorni dopo"],
              ].map(([v, l]) => (
                <p key={l} className="mt-2 font-mono text-sm text-violet-300">
                  {v} → <span className="text-[10px] text-slate-500">{l}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
        {operationalTailOnly ? <PianoOperativo2027Tail /> : null}
      </section>
      ) : null}

      {!operationalTailOnly ? (
      /* §06 */
      <section id="osservatorio-sec-6" className={`scroll-mt-28 ${MONO}`}>
        <SectionHeader badge="SEZIONE 06" title="Piano Ott 2026 – Mag 2027 · Governance & Limiti" />
        <div className="grid grid-cols-5 divide-x divide-white/[0.07] border-b border-white/[0.07]">
          {[
            { p: "Ott 2026", active: true, a: "Situazione iniziale e fonti", c: "Quadro iniziale" },
            { p: "Nov–Dic", active: false, a: "Raccolta mensile", c: "Confronti temporali" },
            { p: "Gen–Feb", active: false, a: "Coerenza, indagini", c: "Rapporti incertezza" },
            { p: "Mar–Apr", active: false, a: "Consolidamento", c: "Dashboard" },
            { p: "Mag 2027", active: false, a: "Sintesi periodo", c: "Dossier finale" },
          ].map((step) => (
            <div
              key={step.p}
              className={`px-3 py-4 ${step.active ? "bg-emerald-500/[0.06]" : ""}`}
            >
              <div
                className={`mb-2 h-1.5 w-full rounded-full ${
                  step.active ? "bg-emerald-400" : "bg-white/[0.08]"
                }`}
              />
              <p
                className={`font-mono text-[10px] ${step.active ? "text-emerald-300" : "text-slate-500"}`}
              >
                {step.p}
              </p>
              <p className="mt-1 text-[10px] text-slate-600">{step.a}</p>
              <p className="mt-1 text-[11px] text-slate-400">{step.c}</p>
            </div>
          ))}
        </div>
        <div className="grid divide-x divide-white/[0.07] border-b border-white/[0.07] md:grid-cols-2">
          <div className="px-6 py-4 text-xs text-slate-400">
            <p className="font-mono text-[9px] uppercase text-slate-500">Cadenza</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Quotidiano: registro eventi</li>
              <li>Settimanale: attenzione e fonti</li>
              <li>Mensile: sondaggi, bisogni, relazione</li>
            </ul>
          </div>
          <div className="px-6 py-4 text-xs text-slate-400">
            <p className="font-mono text-[9px] uppercase text-slate-500">Ruoli</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Coordinatore metodo</li>
              <li>Responsabile dati / audit</li>
              <li>Analista statistico</li>
              <li>Referente privacy</li>
            </ul>
          </div>
        </div>
        <div className="px-6 py-4">
          <p className="font-mono text-[9px] uppercase text-slate-500">7 limiti · § 11</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-400">
            {LIMITI_METODO.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
          <p className="mt-4 font-mono text-[9px] text-slate-600">
            Fonti § 12: ISTAT, amministrazioni, Google Trends, registro eventi, Modello Territoriale FN.
          </p>
        </div>
      </section>
      ) : null}
    </div>
  );
}

function ModuloAEquilibrioChart({
  hIsc,
  hScen,
  js,
}: {
  hIsc: number;
  hScen: number;
  js: number;
}) {
  return (
    <>
      <div className="divide-y divide-white/[0.07] border-b border-white/[0.07] text-[11px]">
        <div className="px-4 py-3">
          <p className="font-semibold text-emerald-300">
            Equilibrio Nazionale Tesseramento: {fmtPctIt(hIsc * 100, 1)}% (H ={" "}
            {fmtDecimalIt(hIsc, 4)})
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Quanto il tesseramento FN è distribuito sulle 20 regioni senza lasciare territori scoperti.
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="font-semibold text-cyan-300">
            Equilibrio Consenso Nazionale: {fmtPctIt(hScen * 100, 1)}% ({fmtDecimalIt(hScen, 4)})
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="font-semibold text-violet-300">
            Scostamento dal Voto Storico: {fmtDecimalIt(js, 4)} (Allineamento Alto)
          </p>
        </div>
      </div>
      <div className="p-3">
        <EntropyAndCalibrationChart mode="entropy" snapshotMetrics={{ hIsc, hScen, js }} />
      </div>
    </>
  );
}

function ModuloAComparePanel({
  sec3ColA,
  sec3ColB,
  effectiveSec3ColB,
  setSec3ColA,
  setSec3ColB,
  colAData,
  colBData,
  hIsc,
  hScen,
  js,
  embeddedInSec02,
}: {
  sec3ColA: TerritoryScope;
  sec3ColB: TerritoryScope;
  effectiveSec3ColB: TerritoryScope;
  setSec3ColA: (v: TerritoryScope) => void;
  setSec3ColB: (v: TerritoryScope) => void;
  colAData: ReturnType<typeof moduloAForScope>;
  colBData: ReturnType<typeof moduloAForScope>;
  hIsc: number;
  hScen: number;
  js: number;
  embeddedInSec02?: boolean;
}) {
  function setColB(v: TerritoryScope) {
    if (sec3ColA === TERRITORY_NAZIONALE && v === TERRITORY_NAZIONALE) {
      setSec3ColB("Veneto");
      return;
    }
    setSec3ColB(v);
  }

  return (
    <>
      <div
        className={`border-white/[0.07] bg-[#060910] px-6 py-4 ${embeddedInSec02 ? "border-t" : "border-b"}`}
      >
        <p className="font-mono text-[9px] uppercase text-cyan-400">
          Confronto dei fattori usati nella stima nazionale
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <label className="text-slate-500">Territorio attivo (A)</label>
          <ModuloATerritorySelect value={sec3ColA} onChange={setSec3ColA} />
          <label className="text-slate-500">Confronta con (B)</label>
          <ModuloATerritorySelect value={sec3ColB} onChange={setColB} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            {
              label: "Italia vs Veneto (Roccaforte §2)",
              a: TERRITORY_NAZIONALE,
              b: "Veneto" as TerritoryScope,
            },
            {
              label: "Doc §2: Veneto vs Italia",
              a: "Veneto" as TerritoryScope,
              b: TERRITORY_NAZIONALE,
            },
            {
              label: "Grandi Bacini: Lombardia vs Lazio",
              a: "Lombardia" as TerritoryScope,
              b: "Lazio" as TerritoryScope,
            },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setSec3ColA(p.a);
                setSec3ColB(p.b);
              }}
              className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[11px] text-slate-400 hover:bg-white/[0.04] hover:text-white"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid xl:grid-cols-12">
        <div className="border-b border-white/[0.07] xl:col-span-7 xl:border-b-0 xl:border-r">
          <ModuloACompareTable
            colA={colAData}
            colB={colBData}
            labelA={columnLabel(sec3ColA)}
            labelB={columnLabel(effectiveSec3ColB)}
          />
        </div>
        <div className="xl:col-span-5">
          <ModuloAEquilibrioChart hIsc={hIsc} hScen={hScen} js={js} />
        </div>
      </div>
    </>
  );
}

function PianoOperativo2027Tail() {
  return (
    <>
      <div className="grid grid-cols-5 divide-x divide-white/[0.07] border-y border-white/[0.07]">
        {[
          { p: "Ott 2026", active: true, a: "Situazione iniziale e fonti", c: "Quadro iniziale" },
          { p: "Nov–Dic", active: false, a: "Raccolta mensile", c: "Confronti temporali" },
          { p: "Gen–Feb", active: false, a: "Coerenza, indagini", c: "Rapporti incertezza" },
          { p: "Mar–Apr", active: false, a: "Consolidamento", c: "Dashboard" },
          { p: "Mag 2027", active: false, a: "Sintesi periodo", c: "Dossier finale" },
        ].map((step) => (
          <div
            key={step.p}
            className={`px-3 py-4 ${step.active ? "bg-emerald-500/[0.06]" : ""}`}
          >
            <div
              className={`mb-2 h-1.5 w-full rounded-full ${
                step.active ? "bg-emerald-400" : "bg-white/[0.08]"
              }`}
            />
            <p
              className={`font-mono text-[10px] ${step.active ? "text-emerald-300" : "text-slate-500"}`}
            >
              {step.p}
            </p>
            <p className="mt-1 text-[10px] text-slate-600">{step.a}</p>
            <p className="mt-1 text-[11px] text-slate-400">{step.c}</p>
          </div>
        ))}
      </div>
      <div className="grid divide-x divide-white/[0.07] border-b border-white/[0.07] md:grid-cols-2">
        <div className="px-6 py-4 text-xs text-slate-400">
          <p className="font-mono text-[9px] uppercase text-slate-500">Cadenza &amp; 4 Ruoli</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Quotidiano: registro eventi</li>
            <li>Settimanale: attenzione e fonti</li>
            <li>Mensile: sondaggi, bisogni, relazione</li>
            <li>Coordinatore metodo · Dati/audit · Statistico · Privacy</li>
          </ul>
        </div>
        <div className="px-6 py-4 text-xs text-slate-400">
          <p className="font-mono text-[9px] uppercase text-slate-500">7 Limiti metodologici · § 11–12</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {LIMITI_METODO.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
          <p className="mt-4 font-mono text-[9px] text-slate-600">
            Fonti § 12: ISTAT, amministrazioni, Google Trends, registro eventi, Modello Territoriale FN.
          </p>
        </div>
      </div>
    </>
  );
}

function NaturaBadge({ label }: { label: string }) {
  return (
    <span className="inline-block font-mono text-[8px] uppercase tracking-wide text-cyan-400/90">
      {label}
    </span>
  );
}

function shortTitle(l: { tag: string; nomeCompleto: string }): string {
  if (l.tag === "SANITÀ") return "Sanità · Liste d'attesa e accesso alle cure";
  if (l.tag === "LAVORO") return "Lavoro · Occupazione (20–64 anni) e redditi";
  if (l.tag === "ABITARE") return "Famiglie · Costo della vita e abitazione";
  return l.nomeCompleto.slice(0, 64);
}

function NationalBenchmarkLine({
  tag,
  body,
  note,
  stress,
}: {
  tag: string;
  body: string;
  note: string;
  stress: number;
}) {
  return (
    <div className="space-y-1 px-3 py-2.5 text-[11px]">
      <p className="text-slate-300">
        <span className="font-mono text-[9px] text-emerald-400">[{tag}]</span> {body}
      </p>
      <p className="text-slate-500 italic">({note})</p>
      <p className="font-mono text-[9px] text-slate-600">Stress medio: {stress}/100</p>
    </div>
  );
}
