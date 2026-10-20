"use client";

import catalogSeed from "../../data/fabbisogni_catalog.json";
import { Btn, Panel, PanelTitle } from "@/components/ui/FnUi";
import { ClassStatusMark } from "@/components/ui/TelemetryUi";
import { CIRC, REGIONS, type Region } from "@/lib/engine/constants";
import { OFFICIAL_FLUSSI } from "@/lib/engine/defaults";
import { nationalStressBand } from "@/lib/engine/fabbisogniCatalogFallback";
import {
  loadOsservatorioLocal,
  saveOsservatorioLocal,
} from "@/lib/engine/osservatorioStorage";
import type {
  FabbisogniCatalogFile,
  OsservatorioCloudPayload,
  OsservatorioEvento,
} from "@/lib/engine/osservatorioTypes";
import type { CaricaLocale } from "@/lib/engine/localiTypes";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { ScenarioRow } from "@/lib/engine/types";
import {
  buildTerritorialIntelligenceRow,
  MOBILIZATION_BAND_LABEL,
  type MobilizationContext,
  type TerritorialIntelligenceRow,
} from "@/lib/engine/territorialIntelligence";
import type { ScenarioResult } from "@/lib/engine/types";
import { pct } from "@/lib/format";
import {
  FactorContributionStack,
  MonteCarloForestChart,
  QuadrantCorrelationMatrix,
  type ForestPlotRow,
  type QuadrantPoint,
} from "@/components/charts/AnalyticalChartsSuite";
import { useCallback, useEffect, useMemo, useState } from "react";

type VizMode = "matrix" | "forest" | "quadrant" | "factors" | "full";

const VIZ_OPTIONS: { id: VizMode; label: string }[] = [
  { id: "matrix", label: "MATRICE DATI 20 REG." },
  { id: "forest", label: "FOREST PLOT MC (CI 80%)" },
  { id: "quadrant", label: "QUADRANTE CONSENSO vs STRESS B" },
  { id: "factors", label: "DECOMPOSIZIONE 4 FATTORI & PARETO" },
  { id: "full", label: "VISTA COMPLETA (MATRICE + GRAFICI)" },
];

type DashboardTab = "scenario" | "quadro" | "osservatorio" | "locali" | "audit";

type SortKey =
  | "stima"
  | "voti"
  | "iscritti"
  | "astenuti"
  | "stress"
  | "eventi"
  | "regione";

type CircFilter = "ALL" | "NO" | "NE" | "C" | "S" | "I";

type MobFilter = "all" | MobilizationContext["band"];

const CIRC_LABELS: Record<CircFilter, string> = {
  ALL: "TUTTE (20)",
  NO: "NORD-OVEST (4)",
  NE: "NORD-EST (4)",
  C: "CENTRO (4)",
  S: "SUD (6)",
  I: "ISOLE (2)",
};

const CIRC_COUNTS: Record<CircFilter, number> = {
  ALL: 20,
  NO: 4,
  NE: 4,
  C: 4,
  S: 6,
  I: 2,
};

const CATALOG_SEED = catalogSeed as FabbisogniCatalogFile;

function mergeFabbisogniCatalog(
  incoming?: FabbisogniCatalogFile,
): FabbisogniCatalogFile {
  if (!incoming?.regions) return CATALOG_SEED;
  return {
    ...CATALOG_SEED,
    ...incoming,
    regions: { ...CATALOG_SEED.regions, ...incoming.regions },
  };
}

/** Separatore migliaia it-IT garantito (es. 6169 → 6.169). */
function formatInt(n: number): string {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return "0";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v).toString();
  return sign + abs.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDec(n: number, digits = 4): string {
  return n.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function regionCirc(region: Region): CircFilter {
  for (const [key, list] of Object.entries(CIRC) as [CircFilter, readonly Region[]][]) {
    if (list.includes(region)) return key;
  }
  return "ALL";
}

function NavArrow() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" className="inline opacity-80" aria-hidden>
      <path
        d="M7 17L17 7M17 7H9M17 7V15"
        stroke="currentColor"
        strokeWidth={1.8}
        fill="none"
      />
    </svg>
  );
}

function TechNavBtn({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 border border-[#1B2436] bg-[#0C101A] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
    >
      <span className="text-slate-600">[</span>
      {label}
      <NavArrow />
      <span className="text-slate-600">]</span>
    </button>
  );
}

function StressMiniBar({ value }: { value: number }) {
  const tone =
    value > 68
      ? "bg-rose-400"
      : value >= 50
        ? "bg-amber-400"
        : "bg-emerald-500";
  return (
    <div className="flex min-w-[72px] items-center gap-1.5">
      <span className="w-12 font-mono text-[10px] tabular-nums text-slate-300">
        {value}/100
      </span>
      <div className="h-1 w-14 overflow-hidden rounded-sm bg-slate-800">
        <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function MobilizationBadge({ band }: { band: MobilizationContext["band"] }) {
  const label = MOBILIZATION_BAND_LABEL[band];
  const styles: Record<MobilizationContext["band"], string> = {
    dati_insufficienti:
      "bg-slate-500/10 text-slate-300 border-slate-500/25",
    base_organizzativa_limitata:
      "bg-violet-500/10 text-violet-300 border-violet-500/25",
    pool_astensione_rilevante:
      "bg-amber-500/10 text-amber-300 border-amber-500/25",
    contesto_misto: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
    elettorato_compatto:
      "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  };
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 font-mono text-[11px] ${styles[band]}`}
    >
      {label}
    </span>
  );
}

function ContestBadge({ poll }: { poll?: RegionPollResult }) {
  if (!poll) return null;
  const label =
    poll.classificazione === "sicura"
      ? "SICURA"
      : poll.classificazione === "critica"
        ? "CRITICA"
        : "CONTESA";
  const sicura = poll.classificazione === "sicura";
  return (
    <span
      className={`ml-1 inline-block h-2 w-3 skew-x-[-12deg] border ${
        sicura
          ? "border-emerald-400/70 bg-emerald-500/25"
          : poll.classificazione === "critica"
            ? "border-rose-400/60 bg-rose-500/20"
            : "border-amber-400/60 bg-amber-500/20"
      }`}
      title={label}
      aria-label={label}
    />
  );
}

type InstCounts = Record<CaricaLocale, number>;

function FactorMiniBars({ scenarioRow }: { scenarioRow: ScenarioRow }) {
  const mix = scenarioRow.f + scenarioRow.m + scenarioRow.p + scenarioRow.v + 1e-9;
  const items = [
    { label: "Flussi", pct: (scenarioRow.f / mix) * 100, color: "#F97316" },
    { label: "Preferenze", pct: (scenarioRow.p / mix) * 100, color: "#10B981" },
    { label: "Iscritti", pct: (scenarioRow.v / mix) * 100, color: "#38BDF8" },
    { label: "Istituzioni", pct: (scenarioRow.m / mix) * 100, color: "#A855F7" },
  ];
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2">
          <span className="w-[5.5rem] shrink-0 font-mono text-[9px] text-slate-500">
            {it.label}
          </span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm bg-slate-800">
            <div
              className="h-full rounded-sm"
              style={{ width: `${it.pct}%`, backgroundColor: it.color }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-[9px] tabular-nums text-slate-300">
            {it.pct.toFixed(0).replace(".", ",")}%
          </span>
        </div>
      ))}
    </div>
  );
}

function InstCountsSummary({ counts }: { counts: InstCounts }) {
  const rows: { label: string; key: CaricaLocale }[] = [
    { label: "Deputati", key: "dep" },
    { label: "Cons. Regionali", key: "creg" },
    { label: "Sindaci", key: "sind" },
    { label: "Comunali", key: "com" },
  ];
  const total = rows.reduce((s, r) => s + counts[r.key], 0);
  if (!total) {
    return (
      <p className="mt-3 font-mono text-[9px] text-slate-500">
        Nessuna carica nel registro locale per questa regione.
      </p>
    );
  }
  return (
    <ul className="mt-3 space-y-1 font-mono text-[9px] text-slate-400">
      {rows.map((r) => (
        <li key={r.key}>
          {r.label}:{" "}
          <span className="tabular-nums text-slate-200">{counts[r.key]}</span>
        </li>
      ))}
    </ul>
  );
}

function RegionDetail({
  row,
  poll,
  events,
  scenarioRow,
  instCounts,
  onOpenScenario,
  onOpenOsservatorio,
}: {
  row: TerritorialIntelligenceRow;
  poll?: RegionPollResult;
  events: OsservatorioEvento[];
  scenarioRow: ScenarioRow;
  instCounts: InstCounts;
  onOpenScenario: () => void;
  onOpenOsservatorio: () => void;
}) {
  const vi =
    row.scenario.iscritti > 0
      ? row.scenario.voti / row.scenario.iscritti
      : 0;
  const stimaStr = row.scenario.stimaPct.toFixed(2).replace(".", ",");
  const loStr = row.scenario.lo10.toFixed(2).replace(".", ",");
  const hiStr = row.scenario.hi90.toFixed(2).replace(".", ",");

  return (
    <Panel className="mb-28 mt-4 border border-[#1E2638]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1B2436] px-4 py-3">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-200">
          {row.regione} — SCHEDA INTEGRATA
        </h3>
        <div className="flex flex-wrap gap-2">
          <TechNavBtn label="APRI IN SCENARIO" onClick={onOpenScenario} />
          <TechNavBtn label="DOSSIER OSSERVATORIO" onClick={onOpenOsservatorio} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 divide-y divide-[#1B2436] md:grid-cols-2 md:divide-x-0 md:divide-y xl:grid-cols-4 xl:divide-x xl:divide-y-0">
        <div className="p-4 xl:pr-5">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-widest text-slate-500">
            01 // MODULO A · SCENARIO ELETTORALE
          </p>
          <p className="font-mono text-3xl font-bold tabular-nums text-emerald-400">
            {stimaStr}%
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-400">
            CI 80%: {loStr}% – {hiStr}%
          </p>
          <ul className="mt-3 space-y-1 font-mono text-[11px] text-slate-300">
            <li>Voti: {formatInt(row.scenario.voti)}</li>
            <li>Iscritti: {formatInt(row.scenario.iscritti)}</li>
            <li>
              Rapporto V/I:{" "}
              {vi.toLocaleString("it-IT", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              x
            </li>
            {poll && (
              <li>
                Margine voti vs soglia 3%:{" "}
                <span className="text-amber-300">
                  {formatInt(poll.margineVotiSoglia)}
                </span>
              </li>
            )}
          </ul>
          {poll && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ClassStatusMark classificazione={poll.classificazione} />
              <span className="font-mono text-[10px] font-semibold text-slate-200">
                STIMA SCENARIO {pct(poll.piHat)}
              </span>
            </div>
          )}
        </div>

        <div className="p-4 xl:px-5">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-widest text-slate-500">
            02 // SPETTRO 4 FATTORI REGIONALI
          </p>
          <FactorMiniBars scenarioRow={scenarioRow} />
          <p className="mb-1 mt-4 font-mono text-[9px] uppercase text-slate-500">
            Cariche locali attive
          </p>
          <InstCountsSummary counts={instCounts} />
        </div>

        <div className="p-4 xl:px-5">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-widest text-slate-500">
            03 // MODULO B · PRESSIONE &amp; FABBISOGNI
          </p>
          <p className="font-mono text-sm text-slate-200">
            Stress B:{" "}
            <span className="font-bold tabular-nums text-amber-300">
              {row.stressResolved}/100
            </span>
          </p>
          <div className="mt-2">
            <StressMiniBar value={row.stressResolved} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {row.fabbisognoTags.map((t) => (
              <span
                key={t.label}
                title={t.tooltip}
                className="rounded border border-[#1B2436] bg-[#0C101A] px-2 py-0.5 font-mono text-[10px] text-slate-200"
              >
                [{t.label}]
              </span>
            ))}
          </div>
          <div className="mt-3">
            <MobilizationBadge band={row.mobilization.band} />
          </div>
          <p className="mt-2 font-mono text-[9px] leading-snug text-slate-500">
            {MOBILIZATION_BAND_LABEL[row.mobilization.band]}
          </p>
        </div>

        <div className="p-4 xl:pl-5">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-widest text-slate-500">
            04 // MODULO C · EVENTI &amp; AZIONI RAPIDE
          </p>
          {events.length === 0 ? (
            <p className="font-mono text-[10px] text-slate-500">
              Nessun episodio in registro per {row.regione}.
            </p>
          ) : (
            <ul className="max-h-40 space-y-2 overflow-y-auto pr-1">
              {events.slice(0, 8).map((e) => (
                <li
                  key={e.id}
                  className="font-mono text-[10px] leading-snug text-slate-400"
                >
                  <span className="text-slate-500">
                    {e.data.slice(0, 10)}
                  </span>
                  {" · "}
                  {e.titolo}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 font-mono text-[9px] text-slate-600">
            {row.eventiCount} episodi totali in registro
          </p>
        </div>
      </div>
    </Panel>
  );
}

export function FuturoNazionaleQuadroPanel({
  scenario,
  poll,
  onOpenTab,
  onOpenScenarioRegion,
}: {
  scenario: ScenarioResult;
  poll: RegionPollResult[];
  onOpenTab: (tab: DashboardTab) => void;
  onOpenScenarioRegion: (region: Region) => void;
}) {
  const [fabbisogni, setFabbisogni] = useState<FabbisogniCatalogFile>(
    () => CATALOG_SEED,
  );
  const [cloud, setCloud] = useState<OsservatorioCloudPayload>(() => {
    return (
      loadOsservatorioLocal() ?? {
        events: [],
        trendsSeries: [],
        prioritaDichiarate: {},
        monthlyNotes: {},
      }
    );
  });
  const [selected, setSelected] = useState<Region>("Lazio");
  const [sortKey, setSortKey] = useState<SortKey>("stima");
  const [sortAsc, setSortAsc] = useState(false);
  const [circFilter, setCircFilter] = useState<CircFilter>("ALL");
  const [mobFilter, setMobFilter] = useState<MobFilter>("all");
  const [search, setSearch] = useState("");
  const [vizMode, setVizMode] = useState<VizMode>("full");
  const [instByRegion, setInstByRegion] = useState<
    Partial<Record<Region, InstCounts>>
  >({});

  const emptyInst = (): InstCounts => ({
    dep: 0,
    creg: 0,
    sind: 0,
    com: 0,
  });

  useEffect(() => {
    void fetch("/api/locali/registry")
      .then((r) => r.json())
      .then(
        (data: {
          registry?: { entries: { regione: Region; carica: CaricaLocale }[] };
        }) => {
          const map: Partial<Record<Region, InstCounts>> = {};
          for (const e of data.registry?.entries ?? []) {
            const cur = map[e.regione] ?? emptyInst();
            cur[e.carica] += 1;
            map[e.regione] = cur;
          }
          setInstByRegion(map);
        },
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    void fetch("/api/osservatorio")
      .then((r) => r.json())
      .then(
        (data: {
          fabbisogni?: FabbisogniCatalogFile;
          cloud?: OsservatorioCloudPayload;
        }) => {
          if (data.fabbisogni) {
            setFabbisogni(mergeFabbisogniCatalog(data.fabbisogni));
          }
          if (data.cloud) {
            setCloud(data.cloud);
            saveOsservatorioLocal(data.cloud);
          }
        },
      )
      .catch(() => {});
  }, []);

  const pollByRegion = useMemo(
    () => new Map(poll.map((p) => [p.regione, p])),
    [poll],
  );

  const allEvents = cloud.events ?? [];

  const rows = useMemo((): TerritorialIntelligenceRow[] => {
    return REGIONS.map((regione) => {
      const srow = scenario.righe.find((r) => r.regione === regione);
      if (!srow) throw new Error(`Scenario row missing: ${regione}`);
      const fab = fabbisogni.regions[regione];
      const eventiCount = allEvents.filter(
        (e) => !e.regione || e.regione === regione,
      ).length;
      return buildTerritorialIntelligenceRow(srow, fab, eventiCount);
    });
  }, [scenario.righe, fabbisogni, allEvents]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (circFilter !== "ALL") {
        const list = CIRC[circFilter];
        if (!list.includes(r.regione)) return false;
      }
      if (mobFilter !== "all" && r.mobilization.band !== mobFilter) return false;
      if (!q) return true;
      const hay = [
        r.regione,
        ...r.fabbisognoTags.map((t) => t.label),
        MOBILIZATION_BAND_LABEL[r.mobilization.band],
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, circFilter, mobFilter, search]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "regione":
          cmp = a.regione.localeCompare(b.regione, "it");
          break;
        case "voti":
          cmp = a.scenario.voti - b.scenario.voti;
          break;
        case "iscritti":
          cmp = a.scenario.iscritti - b.scenario.iscritti;
          break;
        case "astenuti":
          cmp = a.scenario.astenuti - b.scenario.astenuti;
          break;
        case "stress":
          cmp = a.stressResolved - b.stressResolved;
          break;
        case "eventi":
          cmp = a.eventiCount - b.eventiCount;
          break;
        default:
          cmp = a.scenario.stimaPct - b.scenario.stimaPct;
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [filteredRows, sortKey, sortAsc]);

  const selectedRow = rows.find((r) => r.regione === selected)!;
  const selectedEvents = allEvents.filter(
    (e) => !e.regione || e.regione === selected,
  );

  const national = useMemo(() => {
    const voti = scenario.righe.reduce((s, r) => s + r.voti_di_scenario, 0);
    const iscritti = scenario.righe.reduce((s, r) => s + r.iscritti, 0);
    const astenuti = scenario.righe.reduce(
      (s, r) => s + r.astenuti_ricostruiti,
      0,
    );
    const stressMedia =
      rows.reduce((s, r) => s + r.stressResolved, 0) / rows.length;
    const sopraSoglia = rows.filter((r) => r.scenario.stimaPct >= 3).length;
    const viRatio = iscritti > 0 ? voti / iscritti : 0;
    const sInput = scenario.parametri.S * 100;
    return {
      voti,
      iscritti,
      astenuti,
      h: scenario.metriche.H.scenario,
      sim: scenario.metadati.simulazioni,
      seed: scenario.metadati.seme,
      stressMedia,
      stressBand: nationalStressBand(stressMedia),
      sopraSoglia,
      viRatio,
      sInput,
    };
  }, [scenario, rows]);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortAsc((a) => !a);
      else {
        setSortKey(key);
        setSortAsc(false);
      }
    },
    [sortKey],
  );

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  const forestData = useMemo((): ForestPlotRow[] => {
    return filteredRows.map((r) => {
      const srow = scenario.righe.find((x) => x.regione === r.regione)!;
      return {
        regione: r.regione,
        circ: regionCirc(r.regione),
        stimaPct: r.scenario.stimaPct,
        lo10Pct: srow.lo10 * 100,
        hi90Pct: srow.hi90 * 100,
      };
    });
  }, [filteredRows, scenario.righe]);

  const quadrantData = useMemo((): QuadrantPoint[] => {
    return filteredRows.map((r) => ({
      regione: r.regione,
      stress: r.stressResolved,
      astenutiPct:
        r.scenario.elettori > 0
          ? (r.scenario.astenuti / r.scenario.elettori) * 100
          : 0,
      viRatio:
        r.scenario.iscritti > 0 ? r.scenario.voti / r.scenario.iscritti : 0,
      yPct: r.scenario.stimaPct,
      voti: r.scenario.voti,
      iscritti: r.scenario.iscritti,
    }));
  }, [filteredRows]);

  const factorScenarioRows = useMemo(() => {
    const set = new Set(filteredRows.map((r) => r.regione));
    return scenario.righe.filter((r) => set.has(r.regione));
  }, [filteredRows, scenario.righe]);

  const showMatrix = vizMode === "matrix" || vizMode === "full";
  const showForest = vizMode === "forest" || vizMode === "full";
  const showQuadrant = vizMode === "quadrant" || vizMode === "full";
  const showFactors = vizMode === "factors" || vizMode === "full";

  const mobPills: { id: MobFilter; label: string }[] = [
    { id: "all", label: "TUTTI I CONTESTI" },
    { id: "pool_astensione_rilevante", label: "POOL ASTENSIONE RILEVANTE" },
    { id: "contesto_misto", label: "CONTESTO MISTO" },
    { id: "elettorato_compatto", label: "ELETTORATO GIÀ COMPATTO" },
  ];

  return (
    <div id="fn-quadro-matrix" className="space-y-4 pb-36">
      <div className="flex flex-col gap-4 rounded-xl border border-[#1B2436] bg-[#080C14] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
            SYS.QUADRO // MATRICE DI COORDINAMENTO NAZIONALE (MODULI A · B · C)
          </p>
          <p className="mt-1 max-w-3xl text-xs text-slate-400">
            Incrocio descrittivo tra consenso Monte Carlo (Mod. A), pressione fabbisogni
            ISTAT/AGENAS (Mod. B) e presidio eventi (Mod. C).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TechNavBtn
            label="MAPPA SCENARIO"
            onClick={() => onOpenTab("scenario")}
          />
          <TechNavBtn
            label="OSSERVATORIO A/B/C"
            onClick={() => onOpenTab("osservatorio")}
          />
          <TechNavBtn label="RASSEGNA STAMPA" onClick={() => onOpenTab("locali")} />
        </div>
      </div>

      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-[#1B2436] bg-[#080C14] sm:grid-cols-2 lg:grid-cols-5 divide-y divide-[#1B2436] sm:divide-y-0 sm:divide-x sm:divide-[#1B2436] [&>div]:min-w-0">
        <div className="p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
            01 // VOTI DI SCENARIO (20 REG.)
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
            {formatInt(national.voti)}
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            Input S: {national.sInput.toFixed(2).replace(".", ",")}% ·{" "}
            {national.sopraSoglia}/20 sopra soglia 3%
          </p>
        </div>
        <div className="p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
            02 // ISCRITTI FN TOTALI
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-400">
            {formatInt(national.iscritti)}
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            Rapporto medio V/I:{" "}
            {national.viRatio.toLocaleString("it-IT", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            voti/iscritto
          </p>
        </div>
        <div className="p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
            03 // BACINO ASTENUTI 2024
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-cyan-300">
            {formatInt(national.astenuti)}
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            Peso recupero astensione:{" "}
            {(OFFICIAL_FLUSSI.ast * 100).toFixed(0)}% dei flussi
          </p>
        </div>
        <div className="p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
            04 // ENTROPIA H · MONTE CARLO
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
            {formatDec(national.h, 4)}
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            {formatInt(national.sim)} iterazioni · Seme CPython {national.seed}
          </p>
        </div>
        <div className="p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
            05 // INDICE STRESS TERRITORIALE (MOD. B)
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
            {national.stressMedia.toLocaleString("it-IT", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{" "}
            / 100
          </p>
          <p className="mt-1 font-mono text-[10px] leading-snug text-slate-500">
            {national.stressBand}
            <span className="text-slate-600"> · </span>
            <button
              type="button"
              className="inline-flex items-center gap-0.5 text-emerald-400/90 underline-offset-2 hover:underline"
              onClick={() => onOpenTab("osservatorio")}
            >
              Aggiorna da Osservatorio
              <NavArrow />
            </button>
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-sm bg-slate-800">
            <div
              className="h-full bg-amber-400"
              style={{ width: `${national.stressMedia}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-[#1B2436] bg-[#080C14] p-3">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CIRC_LABELS) as CircFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCircFilter(key)}
              className={`rounded-full border px-2.5 py-1 font-mono text-[10px] ${
                circFilter === key
                  ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
                  : "border-[#1B2436] text-slate-500 hover:text-slate-300"
              }`}
            >
              {CIRC_LABELS[key].replace(/\(\d+\)/, `(${CIRC_COUNTS[key]})`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
        {VIZ_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setVizMode(o.id)}
            className={`rounded border px-2 py-1 font-mono text-[9px] ${
              vizMode === o.id
                ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
                : "border-[#1B2436] text-slate-500 hover:text-slate-300"
            }`}
          >
            {o.label}
          </button>
        ))}
        </div>
      </div>

      {vizMode === "full" && (showForest || showQuadrant || showFactors) && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {showForest && (
              <MonteCarloForestChart
                rows={forestData}
                nationalSPct={national.sInput}
                selectedRegion={selected}
                onSelectRegion={setSelected}
              />
            )}
            {showQuadrant && (
              <QuadrantCorrelationMatrix
                points={quadrantData}
                yMedianPct={national.sInput}
                selectedRegion={selected}
                onSelectRegion={setSelected}
              />
            )}
          </div>
          {showFactors && (
            <FactorContributionStack rows={factorScenarioRows} />
          )}
        </div>
      )}

      {vizMode !== "full" && (showForest || showQuadrant || showFactors) && (
        <div className="space-y-4">
          {showForest && (
            <MonteCarloForestChart
              rows={forestData}
              nationalSPct={national.sInput}
              selectedRegion={selected}
              onSelectRegion={setSelected}
            />
          )}
          {showQuadrant && (
            <QuadrantCorrelationMatrix
              points={quadrantData}
              yMedianPct={national.sInput}
              selectedRegion={selected}
              onSelectRegion={setSelected}
            />
          )}
          {showFactors && <FactorContributionStack rows={factorScenarioRows} />}
        </div>
      )}

      {showMatrix && (
      <Panel>
        <PanelTitle>20 REGIONI — VISTA OPERATIVA</PanelTitle>
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {mobPills.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setMobFilter(p.id)}
                className={`rounded border px-2 py-1 font-mono text-[10px] ${
                  mobFilter === p.id
                    ? "border-cyan-500/40 bg-cyan-950/30 text-cyan-200"
                    : "border-[#1B2436] text-slate-500"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtra regione o fabbisogno..."
            className="w-full max-w-md rounded border border-[#1B2436] bg-[#0C101A] px-3 py-2 font-mono text-xs text-slate-200 placeholder:text-slate-600"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-fn-border-subtle font-mono text-[10px] uppercase text-fn-text-muted">
                <th className="py-2 pr-2">Regione</th>
                <th
                  className="cursor-pointer py-2 pr-2"
                  onClick={() => toggleSort("stima")}
                >
                  Stima MC{sortIndicator("stima")}
                </th>
                <th
                  className="cursor-pointer py-2 pr-2"
                  onClick={() => toggleSort("voti")}
                >
                  Voti{sortIndicator("voti")}
                </th>
                <th
                  className="cursor-pointer py-2 pr-2"
                  onClick={() => toggleSort("iscritti")}
                >
                  Iscritti{sortIndicator("iscritti")}
                </th>
                <th
                  className="cursor-pointer py-2 pr-2"
                  onClick={() => toggleSort("astenuti")}
                >
                  Astenuti 2024{sortIndicator("astenuti")}
                </th>
                <th className="py-2 pr-2">Mobilitazione</th>
                <th
                  className="cursor-pointer py-2 pr-2"
                  onClick={() => toggleSort("stress")}
                >
                  Stress B{sortIndicator("stress")}
                </th>
                <th className="py-2 pr-2">Fabbisogni (Modulo B)</th>
                <th
                  className="cursor-pointer py-2"
                  onClick={() => toggleSort("eventi")}
                >
                  Eventi{sortIndicator("eventi")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const pollRow = pollByRegion.get(r.regione);
                const active = selected === r.regione;
                const idx = String(REGIONS.indexOf(r.regione) + 1).padStart(2, "0");
                const circ = regionCirc(r.regione);
                const vi =
                  r.scenario.iscritti > 0
                    ? r.scenario.voti / r.scenario.iscritti
                    : 0;
                return (
                  <tr
                    key={r.regione}
                    className={`cursor-pointer border-b border-fn-border-subtle/60 transition-colors hover:bg-white/[0.03] ${active ? "bg-emerald-950/20" : ""}`}
                    onClick={() => setSelected(r.regione)}
                  >
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-500">
                          {idx}
                        </span>
                        <span className="font-semibold text-white">{r.regione}</span>
                        <span className="rounded border border-[#1B2436] px-1 font-mono text-[9px] text-slate-500">
                          {circ}
                        </span>
                        <ContestBadge poll={pollRow} />
                        {pollRow && (
                          <ClassStatusMark classificazione={pollRow.classificazione} />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-2">
                      <p className="font-mono font-bold tabular-nums text-emerald-400">
                        {r.scenario.stimaPct.toFixed(2).replace(".", ",")}%
                      </p>
                      <div className="mt-1 h-1 w-20 overflow-hidden rounded-sm bg-slate-800">
                        <div
                          className="h-full bg-emerald-500/80"
                          style={{
                            width: `${Math.min(100, (r.scenario.stimaPct / 12) * 100)}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 pr-2 font-mono tabular-nums text-slate-300">
                      {formatInt(r.scenario.voti)}
                    </td>
                    <td className="py-2.5 pr-2">
                      <p className="font-mono tabular-nums text-slate-200">
                        {formatInt(r.scenario.iscritti)}
                      </p>
                      <p className="font-mono text-[10px] text-slate-500">
                        {vi.toLocaleString("it-IT", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        x
                      </p>
                    </td>
                    <td className="py-2.5 pr-2 font-mono tabular-nums text-slate-400">
                      {formatInt(r.scenario.astenuti)}
                    </td>
                    <td className="py-2.5 pr-2">
                      <MobilizationBadge band={r.mobilization.band} />
                    </td>
                    <td className="py-2.5 pr-2">
                      <StressMiniBar value={r.stressResolved} />
                    </td>
                    <td className="py-2.5 pr-2">
                      <div className="flex flex-wrap gap-1.5">
                        {r.fabbisognoTags.slice(0, 2).map((t) => (
                          <span
                            key={t.label}
                            title={t.tooltip}
                            className="whitespace-nowrap rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-slate-200"
                          >
                            {t.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5">
                      <span className="inline-flex min-w-[1.75rem] justify-center rounded border border-[#1B2436] bg-[#0C101A] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-slate-300">
                        {r.eventiCount}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      )}

      <RegionDetail
        row={selectedRow}
        poll={pollByRegion.get(selected)}
        events={selectedEvents}
        scenarioRow={scenario.righe.find((r) => r.regione === selected)!}
        instCounts={instByRegion[selected] ?? emptyInst()}
        onOpenScenario={() => onOpenScenarioRegion(selected)}
        onOpenOsservatorio={() => onOpenTab("osservatorio")}
      />
    </div>
  );
}
