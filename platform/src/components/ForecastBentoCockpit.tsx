"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Route, ShieldAlert, Sparkles, TrendingUp, Users } from "lucide-react";
import { ForecastOutlookChart, type OutlookSample } from "@/components/ForecastPredictiveVisuals";
import { ForecastEditorialCopy } from "@/components/ForecastOperationalBlocks";
import { ForecastStrategistPanel } from "@/components/ForecastStrategistPanel";
import { BasinRing, HemicycleChart } from "@/components/obiettivo/goalCharts";
import { TacticalItalyMap } from "@/components/obiettivo/TacticalItalyMap";
import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import { parliamentSeatRange } from "@/lib/engine/strategicCommandBrief";
import {
  factorPp,
  forecastV4Regional,
  type ForecastBacktestV4,
  type ForecastDiagnostics,
  type ForecastHorizonKey,
  type ForecastHorizonResult,
  type ForecastNetworkDelta,
  type ForecastScenarioId,
  type ForecastStage,
  type ForecastV4Input,
  type ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";
import { macroAreaOfRegion } from "@/lib/engine/territorialAllocationCore";
import type { Region } from "@/lib/engine/constants";
import type { RegionPlan } from "@/lib/engine/strategicBackcastEngine";

const KICKER = "font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-muted)]";
const CARD = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)]";
const GLASS = "rounded-xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-1)_76%,transparent)] backdrop-blur-md";
const SEG = "inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-0.5";
const GHOST =
  "obj-press inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--surface-2)] px-2.5 text-[12px] text-[var(--ink-primary)] hover:border-[var(--ink-muted)]";

const STAGE_META: Record<
  ForecastHorizonKey,
  { days: 30 | 90 | 180; n: 1 | 2 | 3; short: string; title: string; line: string }
> = {
  d30: {
    days: 30,
    n: 1,
    short: "30g",
    title: "Sprint Tattico & Agenda",
    line: "Scontro breve tra inerzia dei sondaggi e spinta di agenda. Presidi strutturali limitati a quanto assorbibile in 30 giorni.",
  },
  d90: {
    days: 90,
    n: 2,
    short: "90g",
    title: "Consolidamento Invernale",
    line: "Tesserati e comitati entrano in trazione progressiva. La saturazione eredita i voti già allocati a +30 giorni.",
  },
  d180: {
    days: 180,
    n: 3,
    short: "Maggio '27",
    title: "Mobilitazione Primaverile",
    line: "Dispiegamento completo: calendario politico, recupero astenuti, eletti e flussi dei delusi.",
  },
};

const DIRECTIVES: { code: string; title: string; regionNames: readonly Region[]; prompt: string }[] = [
  {
    code: "BIP.08-FN",
    title: "Energia & PMI",
    regionNames: ["Lombardia", "Veneto", "Emilia-Romagna"],
    prompt: "Apri la direttrice ENERGIA BIP.08-FN: impatto sulla tappa, regioni target e mossa di piazza.",
  },
  {
    code: "BIP.13-SAN",
    title: "Sanità & Liste",
    regionNames: ["Calabria", "Campania", "Sicilia"],
    prompt: "Apri la direttrice SANITÀ BIP.13-SAN: liste d'attesa, regioni target e misura da portare in piazza.",
  },
  {
    code: "BIP.13-CV",
    title: "Caro-vita & Trasporti",
    regionNames: ["Lazio", "Liguria", "Piemonte"],
    prompt: "Apri la direttrice CARO-VITA E TRASPORTI BIP.13-CV: regioni target e messaggio operativo.",
  },
  {
    code: "BIP.07",
    title: "Sicurezza Urbana",
    regionNames: ["Lombardia", "Lazio", "Veneto"],
    prompt: "Apri la direttrice SICUREZZA BIP.07: regioni target e presidio comunicativo della tappa.",
  },
];

const DARK_SCROLL =
  "[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.14)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15";

function splitByWeight(total: number, weights: number[]): number[] {
  const sign = total < 0 ? -1 : 1;
  const cents = Math.round(Math.abs(total) * 100);
  const safe = weights.some((weight) => weight > 0) ? weights.map((weight) => Math.max(0, weight)) : weights.map(() => 1);
  const sum = safe.reduce((acc, weight) => acc + weight, 0) || 1;
  const raw = safe.map((weight) => (cents * weight) / sum);
  const base = raw.map((value) => Math.floor(value));
  let left = cents - base.reduce((acc, value) => acc + value, 0);
  const rank = raw
    .map((value, index) => ({ index, frac: value - base[index]! }))
    .sort((a, b) => b.frac - a.frac);
  for (const row of rank) {
    if (left <= 0) break;
    base[row.index] = (base[row.index] ?? 0) + 1;
    left -= 1;
  }
  return base.map((value) => (sign * value) / 100);
}

function pct(n: number): string {
  return `${formatDecimalIt(n, 2)}%`;
}

function votesLabel(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  const abs = Math.abs(Math.round(n));
  if (abs >= 1_000_000) return `${sign}${formatDecimalIt(abs / 1_000_000, 2)}M`;
  if (abs >= 1000) return `${sign}${formatDecimalIt(abs / 1000, 0)}k`;
  return `${sign}${formatIntIt(abs)}`;
}

function segItem(on: boolean, emerald = false): string {
  return `obj-press h-6 rounded-md px-2.5 font-mono text-[11px] tabular-nums transition-colors ${
    on
      ? `bg-[var(--surface-1)] shadow-[0_1px_2px_rgba(0,0,0,0.24)] ${emerald ? "text-emerald-300 light:text-emerald-700" : "text-[var(--ink-primary)]"}`
      : "text-[var(--ink-muted)] hover:text-[var(--ink-secondary)]"
  }`;
}

function FactorBridge({
  start,
  end,
  horizon,
}: {
  start: number;
  end: number;
  horizon: ForecastHorizonResult;
}) {
  const pieces: { label: string; pp: number; color: string }[] = [
    { label: "Sond.", pp: factorPp(horizon, "momentum"), color: "#22d3ee" },
    { label: "Temi", pp: factorPp(horizon, "agenda"), color: "#34d399" },
    { label: "Rete", pp: factorPp(horizon, "ground"), color: "#d97706" },
    { label: "Eletti", pp: factorPp(horizon, "magnet"), color: "#a78bfa" },
    { label: "Flussi", pp: factorPp(horizon, "donor"), color: "#38bdf8" },
    { label: "Cal.", pp: factorPp(horizon, "cycle") + factorPp(horizon, "bounds"), color: "#f59e0b" },
  ];
  const steps: { label: string; from: number; to: number; anchor?: boolean; color: string }[] = [
    { label: "Oggi", from: start, to: start, anchor: true, color: "#64748b" },
  ];
  for (const piece of pieces) {
    const from = steps[steps.length - 1]!.to;
    steps.push({ label: piece.label, from, to: from + piece.pp, color: piece.color });
  }
  steps.push({ label: "Stima", from: end, to: end, anchor: true, color: "#34d399" });

  const levels = steps.flatMap((step) => [step.from, step.to]);
  const min = Math.min(...levels) - 0.28;
  const max = Math.max(...levels) + 0.22;
  const w = 304;
  const h = 132;
  const padL = 24;
  const padR = 4;
  const padB = 20;
  const padT = 16;
  const yOf = (value: number) => {
    const span = max - min || 1;
    return h - padB - ((value - min) / span) * (h - padT - padB);
  };
  const gap = 3.5;
  const barW = (w - padL - padR - gap * (steps.length - 1)) / steps.length;
  const floor = yOf(min);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1.5 h-[116px] w-full" role="img" aria-label="Ponte dei fattori sulla tappa">
      {[min, (min + max) / 2, max].map((tick) => (
        <g key={tick}>
          <line x1={padL - 2} x2={w - padR} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--border-subtle)" strokeDasharray="2 3" />
          <text x={2} y={yOf(tick) + 3} fill="var(--ink-muted)" style={{ fontSize: 7.2, fontFamily: "var(--font-mono), monospace" }}>
            {formatDecimalIt(tick, 1)}
          </text>
        </g>
      ))}
      {steps.map((step, index) => {
        const x = padL + index * (barW + gap);
        const y1 = step.anchor ? floor : yOf(step.from);
        const y2 = yOf(step.to);
        const top = Math.min(y1, y2);
        const height = Math.max(3, Math.abs(y2 - y1));
        const delta = step.to - step.from;
        const caption = step.anchor ? formatDecimalIt(step.to, 2) : `${delta >= 0 ? "+" : ""}${formatDecimalIt(delta, 2)}`;
        const nextStep = steps[index + 1];
        return (
          <g key={`${step.label}-${index}`}>
            {nextStep ? (
              <line
                x1={x + barW}
                x2={x + barW + gap}
                y1={yOf(step.to)}
                y2={yOf(step.to)}
                stroke="rgba(148,163,184,0.45)"
                strokeWidth="0.9"
                strokeDasharray="1.5 1.5"
              />
            ) : null}
            <rect x={x} y={top} width={barW} height={height} rx="2.5" fill={step.color} opacity={step.anchor ? 0.92 : 0.86}>
              <title>{`${step.label}: ${caption}${step.anchor ? "%" : " pt"}`}</title>
            </rect>
            <text x={x + barW / 2} y={Math.max(10, top - 3)} textAnchor="middle" fill="var(--ink-secondary)" style={{ fontSize: 7.2, fontFamily: "var(--font-mono), monospace" }}>
              {caption}
            </text>
            <text x={x + barW / 2} y={h - 5} textAnchor="middle" fill="var(--ink-muted)" style={{ fontSize: 7.8, fontFamily: "var(--font-mono), monospace" }}>
              {step.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ForecastBentoCockpit({
  measuredPct,
  viewScenario,
  onScenario,
  activeKey,
  onStage,
  v4,
  v4Input,
  horizon,
  mayHorizon,
  projection,
  offensiveProjection,
  inertialProjection,
  history,
  asOf,
  backtest,
  stages,
  diagnostics,
  onOpenFattori,
  strategist,
  attackStatement,
  initialSelectedRegion = null,
}: {
  measuredPct: number;
  viewScenario: ForecastScenarioId;
  onScenario: (id: ForecastScenarioId) => void;
  activeKey: ForecastHorizonKey;
  onStage: (days: 30 | 90 | 180) => void;
  v4: ForecastV4Result;
  v4Input: ForecastV4Input;
  horizon: ForecastHorizonResult;
  mayHorizon: ForecastHorizonResult;
  projection: OutlookSample[];
  offensiveProjection?: OutlookSample[];
  inertialProjection?: OutlookSample[];
  history: { isoDate: string; pct: number }[];
  asOf: Date;
  backtest: ForecastBacktestV4 | null;
  stages: ForecastStage[];
  diagnostics: ForecastDiagnostics;
  onOpenFattori: () => void;
  attackStatement: string;
  strategist: {
    open: boolean;
    networkDelta: ForecastNetworkDelta;
    newsHeadlines: string[];
    excludedEntityIds: string[];
    onResetNetwork: () => void;
  };
  initialSelectedRegion?: Region | null;
}) {
  const [crono, setCrono] = useState(false);
  const [cronoTab, setCronoTab] = useState<"tappa" | "bozze" | "sinottica">("tappa");
  const [selected, setSelected] = useState<Region | null>(null);
  const [syncedInitialRegion, setSyncedInitialRegion] = useState<Region | "cleared" | null>(null);
  if (
    initialSelectedRegion &&
    syncedInitialRegion !== initialSelectedRegion
  ) {
    setSyncedInitialRegion(initialSelectedRegion);
    setSelected(initialSelectedRegion);
  } else if (!initialSelectedRegion && syncedInitialRegion !== "cleared") {
    setSyncedInitialRegion("cleared");
  }
  const [hoverDirective, setHoverDirective] = useState<number | null>(null);
  const [cronoHoverRegions, setCronoHoverRegions] = useState<readonly Region[] | null>(null);
  const meta = STAGE_META[activeKey];
  const seats = parliamentSeatRange(horizon.centralPct);
  const todaySeats = parliamentSeatRange(measuredPct)[1];
  const rows = useMemo(
    () =>
      [...forecastV4Regional(v4Input, v4, activeKey, viewScenario)].sort((a, b) => b.addedVotes - a.addedVotes),
    [v4Input, v4, activeKey, viewScenario],
  );
  const focus = rows.find((row) => row.regione === selected) ?? rows[0] ?? null;
  const plans = useMemo<RegionPlan[]>(
    () =>
      rows.map((row) => ({
        region: row.regione,
        macroArea: macroAreaOfRegion(row.regione),
        role: row.verde ? "FRONTE_PRIORITARIO" : row.addedVotes > 500 ? "SUPPORTO_ESPANSIONE" : "PRESIDIO_ORDINARIO",
        theme: "Sicurezza",
        anchorPct: row.startPct,
        targetPct: row.centralPct,
        ceilingPct: Math.max(row.startPct + 0.4, row.centralPct),
        physPct: row.centralPct,
        addedVotes: Math.max(0, Math.round(row.addedVotes)),
        resistance: row.reachSaturation * 6,
        basins: row.basins,
        todayPct: row.startPct,
      })),
    [rows],
  );
  const basinTotals = rows.reduce(
    (acc, row) => {
      acc.voto_tematico_ponte += row.basins.voto_tematico_ponte;
      acc.delusi_coalizione += row.basins.delusi_coalizione;
      acc.astensione_recuperabile += row.basins.astensione_recuperabile;
      acc.radicamento_civico_eletti += row.basins.radicamento_civico_eletti;
      return acc;
    },
    { voto_tematico_ponte: 0, delusi_coalizione: 0, astensione_recuperabile: 0, radicamento_civico_eletti: 0 },
  );
  const stageVotes = rows.reduce((sum, row) => sum + Math.max(0, row.addedVotes), 0);
  const greens = rows.filter((row) => row.verde && row.addedVotes > 0).length;
  const activeStage = stages.find((stage) => stage.key === activeKey) ?? null;
  const capacity = activeStage?.capacity ?? null;
  const agendaPp = factorPp(horizon, "agenda");
  const directivePts = splitByWeight(
    agendaPp,
    DIRECTIVES.map((item) =>
      item.regionNames.reduce((sum, name) => {
        const row = rows.find((region) => region.regione === name);
        if (!row) return sum;
        return sum + Math.max(0, row.addedVotes) + Math.max(0, row.basins.voto_tematico_ponte);
      }, 0),
    ),
  );

  useEffect(() => {
    const openCrono = () => {
      setCrono(true);
      setCronoTab("tappa");
    };
    window.addEventListener("fn-open-forecast-crono", openCrono);
    return () => window.removeEventListener("fn-open-forecast-crono", openCrono);
  }, []);

  useEffect(() => {
    if (!crono) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector("[data-strategist-drawer-open]")) return;
      event.stopPropagation();
      event.preventDefault();
      setCrono(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [crono]);

  function ask(prompt: string) {
    setCrono(true);
    setCronoTab("tappa");
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("fn-open-strategist", { detail: { prompt } }));
    }, 80);
  }

  const regimePct = (id: ForecastScenarioId) =>
    v4.scenarios[id].horizons.find((row) => row.key === activeKey)?.centralPct ?? measuredPct;
  const obiettivoHref = `/app/obiettivo?horizon=${meta.days}&regime=${viewScenario}`;
  const cvar = activeStage?.cvar10 ?? horizon.lo10Pct;
  const futureStages = stages.filter((stage) => stage.key !== "today");
  const deltaPp = horizon.centralPct - measuredPct;
  const verdeTotal = rows.filter((row) => row.verde).length;
  const regimeName = viewScenario === "passivo" ? "Inerziale" : viewScenario === "offensiva" ? "Offensiva" : "Base";
  const groundPp = factorPp(horizon, "ground");
  const magnetPp = factorPp(horizon, "magnet");

  return (
    <div className={`forecast-bento mx-auto flex h-full min-h-0 w-full max-w-[1920px] flex-col gap-2.5 overflow-x-hidden overflow-y-auto px-3.5 py-2.5 xl:overflow-hidden ${DARK_SCROLL}`}>
      {/* TOP COMMAND BAR — 1 riga su desktop ampio */}
      <header className={`${CARD} flex w-full min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className={SEG} role="group" aria-label="Regime di stima">
            {(["passivo", "base", "offensiva"] as const).map((id) => (
              <button key={id} type="button" className={`${segItem(viewScenario === id, id === "offensiva")} whitespace-nowrap`} aria-pressed={viewScenario === id} onClick={() => onScenario(id)}>
                {id === "passivo" ? "Inerziale" : id === "base" ? "Base" : "Offensiva"} {pct(regimePct(id))}
              </button>
            ))}
          </div>
          <div className={SEG} role="group" aria-label="Tappa attiva">
            {(["d30", "d90", "d180"] as const).map((key) => (
              <button key={key} type="button" className={`${segItem(activeKey === key)} whitespace-nowrap`} aria-pressed={activeKey === key} onClick={() => onStage(STAGE_META[key].days)}>
                Tappa {STAGE_META[key].n} · {STAGE_META[key].short}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2.5 overflow-x-auto whitespace-nowrap rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 px-2.5 py-1 font-mono text-[10.5px]">
            <span className="inline-flex items-center rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200 light:text-cyan-800">
              Stima
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[var(--ink-muted)]">Fascia 80%</span>
              <span className="font-semibold tabular-nums text-[var(--ink-primary)]">{pct(horizon.lo10Pct)}–{pct(horizon.hi90Pct)}</span>
            </span>
            <span className="text-[var(--border-default)]" aria-hidden>|</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[var(--ink-muted)]">Tenuta avversa</span>
              <span className="font-semibold tabular-nums text-[var(--ink-primary)]">{pct(cvar)}</span>
            </span>
            <span className="text-[var(--border-default)]" aria-hidden>|</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[var(--ink-muted)]">Verifica 30g</span>
              <span className="font-semibold tabular-nums text-[var(--ink-primary)]">
                {backtest && backtest.n > 0 ? `±${formatDecimalIt(backtest.maeV4, 2)} pt` : "n.d."}
              </span>
            </span>
          </div>

          <a className={`${GHOST} whitespace-nowrap`} href={obiettivoHref}>
            <span>Apri in 04 · Obiettivo</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden />
          </a>
        </div>
      </header>

      {/* BENTO 3-COLUMN COCKPIT */}
      <div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-2.5 xl:min-h-0 xl:grid-cols-[292px_minmax(0,1fr)_324px] 2xl:grid-cols-[316px_minmax(0,1fr)_352px]">
        {/* COLONNA SINISTRA */}
        <aside className={`${CARD} flex flex-col divide-y divide-[var(--border-subtle)] xl:h-full xl:min-h-0 xl:overflow-y-auto ${DARK_SCROLL}`}>
          <section className="p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className={KICKER}>PONTE DEI FATTORI</p>
              <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${deltaPp >= 0 ? "bg-emerald-500/12 text-emerald-300 light:text-emerald-700" : "bg-rose-500/12 text-rose-300"}`}>
                {deltaPp >= 0 ? "+" : ""}{formatDecimalIt(deltaPp, 2)} pt
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] tabular-nums text-[var(--ink-secondary)]">
              Oggi {pct(measuredPct)} <span className="text-[var(--ink-muted)]">MISURATO</span> → {pct(horizon.centralPct)}
            </p>
            <FactorBridge start={measuredPct} end={horizon.centralPct} horizon={horizon} />
          </section>

          <section className="p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className={KICKER}>PROIEZIONE PESO IN AULA</p>
              <span className="font-mono text-[10px] text-[var(--ink-muted)]">400 seggi</span>
            </div>
            <div className="[&_svg]:!h-[106px]">
              <HemicycleChart
                todaySeats={todaySeats}
                planSeats={seats[1]}
                rangeLabel={`${seats[0]}–${seats[1]}`}
                caption="SEGGI CAMERA (Stima)"
              />
            </div>
          </section>

          <section className="flex-1 p-3.5">
            <p className={KICKER}>DA DOVE ARRIVANO I VOTI</p>
            <BasinRing totals={basinTotals} totalVotes={Math.max(0, stageVotes)} />
          </section>
        </aside>

        {/* COLONNA CENTRALE */}
        <div className="flex min-w-0 flex-col gap-2.5 xl:h-full xl:min-h-0">
          {/* STAGE MAPPA + HERO KPI + SCHEDA REGIONE */}
          <div className="obj-stage flex min-h-[256px] flex-[1.22] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3">
              <p className={KICKER}>MAPPA DI TRAZIONE PREVISIONALE</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/[0.07] px-2.5 py-0.5 font-mono text-[10px] text-emerald-300 light:text-emerald-700">
                <i className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                Regime {regimeName} · {meta.title}
              </span>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-3.5 pt-1.5 lg:grid-cols-[minmax(180px,220px)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col justify-center">
                <p className={KICKER}>STIMA DELLA TAPPA</p>
                <p className="obj-hero-num mt-1.5 font-mono text-[clamp(40px,3.8vw,64px)] font-semibold leading-[0.88] tracking-[-0.04em] tabular-nums">
                  {formatDecimalIt(horizon.centralPct, 2)}
                  <span className="ml-0.5 align-top text-[0.4em] font-medium tracking-normal text-[var(--ink-muted)]">%</span>
                </p>
                <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--ink-secondary)]">
                  da <span className="font-mono tabular-nums text-[var(--ink-primary)]">{pct(measuredPct)}</span> oggi (MISURATO)
                </p>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-[var(--border-subtle)] pt-2.5">
                  <div>
                    <dt className="whitespace-nowrap text-[10.5px] text-[var(--ink-muted)]">Nuovi voti</dt>
                    <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-[var(--signal-positive)]">{votesLabel(stageVotes)}</dd>
                  </div>
                  <div>
                    <dt className="whitespace-nowrap text-[10.5px] text-[var(--ink-muted)]">Variazione</dt>
                    <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums">{deltaPp >= 0 ? "+" : ""}{formatDecimalIt(deltaPp, 2)} pt</dd>
                  </div>
                  <div>
                    <dt className="whitespace-nowrap text-[10.5px] text-[var(--ink-muted)]">Regioni verdi</dt>
                    <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums">{verdeTotal}<span className="text-[11px] font-normal text-[var(--ink-muted)]"> su 20</span></dd>
                  </div>
                  <div>
                    <dt className="whitespace-nowrap text-[10.5px] text-[var(--ink-muted)]">Tenuta avversa</dt>
                    <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums">{pct(cvar)}</dd>
                  </div>
                </dl>
              </div>

              <div className="relative min-h-[220px] min-w-0 lg:min-h-[240px]">
                <TacticalItalyMap
                  regions={plans}
                  selected={focus?.regione ?? null}
                  onSelect={setSelected}
                  stage
                  emphasis={hoverDirective == null ? undefined : [...DIRECTIVES[hoverDirective]!.regionNames]}
                />
              </div>
            </div>
          </div>

          {/* CARD TRAIETTORIA + 3 TAPPE + CTA CRONOPROGRAMMA */}
          <div className={`${CARD} flex min-h-[238px] flex-1 flex-col justify-between`}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
              <p className={KICKER}>TRAIETTORIA FINO A MAGGIO 2027</p>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-[var(--ink-muted)]">
                <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-3.5 rounded-full bg-slate-400" aria-hidden /> Storico</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-3.5 rounded-full bg-cyan-300" aria-hidden /> {regimeName}</span>
                {viewScenario !== "offensiva" ? (
                  <span className="inline-flex items-center gap-1.5"><i className="w-3.5 border-t border-dashed border-emerald-400" aria-hidden /> Offensiva</span>
                ) : null}
                {viewScenario !== "passivo" ? (
                  <span className="inline-flex items-center gap-1.5"><i className="w-3.5 border-t border-dashed border-slate-500" aria-hidden /> Inerziale</span>
                ) : null}
              </div>
            </div>

            <div className="forecast-bento-chart min-h-[128px] flex-1 overflow-hidden px-2 pt-0.5">
              <ForecastOutlookChart
                historyLabel="Consenso osservato"
                projection={projection}
                offensiveProjection={offensiveProjection}
                inertialProjection={inertialProjection}
                horizon={mayHorizon}
                history={history}
                asOf={asOf}
                markerDay={meta.days}
                compactChrome
                hideHeading
                onSelectDay={(mark) => onStage(mark <= 30 ? 30 : mark <= 90 ? 90 : 180)}
              />
            </div>

            <div className="grid grid-cols-2 items-stretch gap-2 border-t border-[var(--border-subtle)] px-3.5 py-2.5 xl:grid-cols-4">
              {futureStages.map((stage, index) => {
                const key = stage.key as ForecastHorizonKey;
                const on = key === activeKey;
                const cumulative = futureStages
                  .slice(0, index + 1)
                  .reduce((sum, row) => sum + Math.max(0, row.addedVotes), 0);
                const marginal = Math.max(0, stage.addedVotes);
                const stepNote = index === 0 ? "finestra tattica iniziale" : index === 1 ? `di cui ${votesLabel(marginal)} dal giorno 30` : `di cui ${votesLabel(marginal)} negli ultimi 90g`;
                return (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => onStage(stage.horizonDays === 90 ? 90 : stage.horizonDays === 180 ? 180 : 30)}
                    className={`obj-press relative flex flex-col justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                      on
                        ? "border-emerald-400/45 bg-emerald-500/[0.08] shadow-[inset_0_1px_0_rgba(52,211,153,0.25)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-2)]/40 hover:border-[var(--border-default)]"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`font-mono text-[10px] ${on ? "text-emerald-300 light:text-emerald-700" : "text-[var(--ink-muted)]"}`}>
                        Tappa {STAGE_META[key].n} · {stage.label}
                      </span>
                      <span className="font-mono text-[15px] font-semibold tabular-nums text-[var(--ink-primary)]">{pct(stage.centralPct)}</span>
                    </div>
                    <div className="mt-1">
                      <span className="block font-mono text-[10.5px] tabular-nums text-[var(--ink-secondary)]">
                        <span className="text-[var(--signal-positive)]">{votesLabel(cumulative)}</span> · tenuta {pct(stage.cvar10)}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--ink-muted)]">{stepNote}</span>
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setCronoTab("tappa");
                  setCrono(true);
                }}
                className="obj-press group flex flex-col justify-between rounded-xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/[0.14] to-emerald-500/[0.06] px-3 py-2 text-left hover:border-cyan-300/60 hover:from-cyan-500/[0.2]"
              >
                <span className="flex items-center justify-between gap-1.5 text-[12px] font-semibold text-cyan-100 light:text-cyan-900">
                  <span className="inline-flex items-center gap-1.5">
                    <Route className="h-3.5 w-3.5 text-cyan-300 light:text-cyan-700" aria-hidden />
                    Cronoprogramma
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-cyan-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 light:text-cyan-700" aria-hidden />
                </span>
                <span className="mt-1 block text-[10.5px] leading-snug text-[var(--ink-secondary)]">
                  Tesi di tappa, direttrici B.I.P., bozze e sinottica
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA — B.I.P. + capacità rete (senza scroll verticale) */}
        <aside className={`${CARD} flex min-h-0 flex-col justify-between gap-3 p-3.5 xl:h-full`}>
          <section className="flex min-h-0 flex-1 flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className={KICKER}>DIRETTRICI B.I.P. · AGENDA</p>
              <span className="font-mono text-[10px] tabular-nums text-emerald-300 light:text-emerald-700">
                Σ {agendaPp >= 0 ? "+" : ""}{formatDecimalIt(agendaPp, 2)} pt
              </span>
            </div>
            <ul className="flex min-h-0 flex-1 flex-col justify-between gap-2.5">
              {DIRECTIVES.map((item, index) => (
                <li
                  key={item.code}
                  className={`flex min-h-0 flex-col justify-between gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                    hoverDirective === index ? "border-emerald-400/50 bg-emerald-500/[0.07]" : "border-[var(--border-subtle)] bg-[var(--surface-2)]/35"
                  }`}
                  onMouseEnter={() => setHoverDirective(index)}
                  onMouseLeave={() => setHoverDirective(null)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold leading-snug text-[var(--ink-primary)]">{item.title}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[var(--ink-muted)]">{item.code}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-emerald-300 light:text-emerald-700">
                      +{formatDecimalIt(Math.max(0, directivePts[index] ?? 0), 2)} pt
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.regionNames.map((region) => {
                      const onMap = focus?.regione === region;
                      return (
                        <button
                          key={region}
                          type="button"
                          className={`obj-press rounded-full border px-2 py-0.5 text-[10px] leading-tight transition-colors ${
                            onMap
                              ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-200 light:text-emerald-800"
                              : "border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--ink-secondary)] hover:border-[var(--border-default)] hover:text-[var(--ink-primary)]"
                          }`}
                          onClick={() => setSelected(region)}
                        >
                          {region}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="obj-press inline-flex items-center gap-1 rounded-md border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-1 font-mono text-[10.5px] font-medium text-cyan-200 hover:bg-cyan-500/15 light:text-cyan-800"
                      onClick={() => ask(item.prompt)}
                    >
                      Portaborse →
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="shrink-0 border-t border-[var(--border-subtle)] pt-3">
            <p className={KICKER}>SPINTA E CAPACITÀ RETE · TERRA</p>
            <p className="mt-1.5 font-mono text-[12px] tabular-nums text-[var(--ink-primary)]">
              {formatIntIt(Math.round(diagnostics.tesserati))} tesserati · {formatIntIt(Math.round(diagnostics.comitati))} comitati
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--border-subtle)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-violet-400"
                  style={{ width: `${Math.min(100, Math.max(10, ((Math.abs(groundPp) + Math.abs(magnetPp)) / 0.45) * 100))}%` }}
                />
              </div>
              <span className="shrink-0 font-mono text-[10px] leading-tight tabular-nums text-[var(--ink-secondary)]">
                Rete {groundPp >= 0 ? "+" : ""}{formatDecimalIt(groundPp, 2)} · Eletti {magnetPp >= 0 ? "+" : ""}{formatDecimalIt(magnetPp, 2)} pt
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className={`text-[11px] leading-snug ${capacity && !capacity.feasible ? "text-amber-300 light:text-amber-800" : "text-[var(--signal-positive)]"}`}>
                {capacity
                  ? capacity.feasible
                    ? "Rete assorbibile nella tappa"
                    : "Oltre capacità mensile"
                  : "Rete assorbibile nella tappa"}
              </span>
              {strategist.networkDelta.comitati !== 0 || strategist.networkDelta.tesserati !== 0 ? (
                <button
                  type="button"
                  onClick={strategist.onResetNetwork}
                  className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 font-mono text-[10px] text-amber-200 light:text-amber-800"
                >
                  Azzera what-if
                </button>
              ) : (
                <button
                  type="button"
                  className="obj-press font-mono text-[11px] font-medium text-cyan-300 hover:underline light:text-cyan-700"
                  onClick={onOpenFattori}
                >
                  02 · Simulazioni →
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* MODAL CRONOPROGRAMMA PREVISIONALE E DIRETTRICI */}
      {crono ? (
        <div
          className="fixed inset-0 z-[140] flex flex-col bg-[var(--surface-canvas)] text-[var(--ink-primary)]"
          data-forecast-crono-open=""
          role="dialog"
          aria-modal="true"
          aria-label="Cronoprogramma previsionale"
        >
          <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <button type="button" className={GHOST} onClick={() => setCrono(false)}>
                ← Torna alla plancia
              </button>
              <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-200 light:text-cyan-800">
                Stima
              </span>
              <h3 className="hidden truncate text-[14px] font-semibold md:block">
                Cronoprogramma Previsionale e Direttrici B.I.P.
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <div className={SEG} role="group" aria-label="Regime nel cronoprogramma">
                {(["passivo", "base", "offensiva"] as const).map((id) => (
                  <button key={id} type="button" className={segItem(viewScenario === id, id === "offensiva")} onClick={() => onScenario(id)}>
                    {id === "passivo" ? "Inerziale" : id === "base" ? "Base" : "Offensiva"}
                  </button>
                ))}
              </div>
              <div className={SEG} role="tablist" aria-label="Sezioni del cronoprogramma">
                {([
                  ["tappa", "Dossier Tappa"],
                  ["bozze", "Bozze Pronte"],
                  ["sinottica", "Vista Sinottica"],
                ] as const).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={cronoTab === id} className={segItem(cronoTab === id)} onClick={() => setCronoTab(id)}>
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" className={GHOST} onClick={() => setCrono(false)}>
                Esc ✕
              </button>
            </div>
          </header>

          <div className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 ${DARK_SCROLL}`}>
            <div className="mx-auto flex max-w-[1640px] flex-col gap-4">
              {/* HERO STEPPER STILE 04 · OBIETTIVO */}
              <section className="obj-stage overflow-hidden rounded-2xl border border-[var(--border-subtle)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 max-w-2xl">
                    <p className={KICKER}>ROTTA PREVISIONALE · REGIME {regimeName.toUpperCase()}</p>
                    <h2 className="mt-1.5 text-[clamp(20px,2.2vw,30px)] font-semibold tracking-tight">
                      Da {pct(measuredPct)} oggi a {pct(horizon.centralPct)} ({meta.title})
                    </h2>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-secondary)]">{meta.line}</p>
                  </div>

                  <dl className="grid w-full grid-cols-2 gap-2.5 sm:w-auto lg:grid-cols-4">
                    {[
                      { icon: TrendingUp, label: "Consenso atteso", value: pct(horizon.centralPct) },
                      { icon: Users, label: "Nuovi voti cumulati", value: votesLabel(stageVotes) },
                      { icon: Sparkles, label: "Fascia teorica 80%", value: `${pct(horizon.lo10Pct)}–${pct(horizon.hi90Pct)}` },
                      { icon: ShieldAlert, label: "Tenuta scenario avverso", value: pct(cvar) },
                    ].map((kpi) => {
                      const Icon = kpi.icon;
                      return (
                        <div key={kpi.label} className={`${GLASS} min-w-[148px] px-3.5 py-2.5`}>
                          <dt className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
                            <Icon className="h-3.5 w-3.5 text-cyan-300 light:text-cyan-700" aria-hidden />
                            {kpi.label}
                          </dt>
                          <dd className="mt-1 font-mono text-[17px] font-semibold tabular-nums">{kpi.value}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>

                {/* STEPPER ORIZZONTALE A 4 NODI */}
                <div className="relative mt-6" role="tablist" aria-label="Tappe previsionali">
                  <div className="absolute left-[12%] right-[12%] top-[11px] h-px bg-[var(--border-default)]" aria-hidden />
                  <div
                    className="absolute left-[12%] top-[11px] h-px bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)] transition-[width] duration-300"
                    style={{ width: `${(meta.n / 3) * 76}%` }}
                    aria-hidden
                  />
                  <ol className="relative grid grid-cols-4">
                    <li className="flex flex-col items-center text-center">
                      <span className="block h-[22px] w-[22px] rounded-full border-2 border-cyan-400 bg-[var(--surface-1)]" aria-hidden />
                      <span className="mt-2 font-mono text-[10.5px] text-[var(--ink-muted)]">Oggi · MISURATO</span>
                      <span className="font-mono text-[15px] font-semibold tabular-nums">{pct(measuredPct)}</span>
                    </li>
                    {futureStages.map((stage) => {
                      const key = stage.key as ForecastHorizonKey;
                      const info = STAGE_META[key];
                      const on = key === activeKey;
                      const done = info.n < meta.n;
                      return (
                        <li key={stage.key} className="flex flex-col items-center text-center">
                          <button
                            type="button"
                            role="tab"
                            aria-selected={on}
                            onClick={() => onStage(info.days)}
                            className="obj-press group flex flex-col items-center"
                          >
                            <span
                              className={`block h-[22px] w-[22px] rounded-full border-2 transition-all ${
                                on
                                  ? "border-emerald-400 bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]"
                                  : done
                                    ? "border-cyan-400 bg-cyan-400/40"
                                    : "border-[var(--border-default)] bg-[var(--surface-1)] group-hover:border-emerald-400/60"
                              }`}
                              aria-hidden
                            />
                            <span className={`mt-2 font-mono text-[10.5px] ${on ? "text-emerald-300 light:text-emerald-700" : "text-[var(--ink-muted)]"}`}>
                              Tappa {info.n} · {stage.label}
                            </span>
                            <span className="font-mono text-[15px] font-semibold tabular-nums">{pct(stage.centralPct)}</span>
                            <span className="hidden text-[11px] text-[var(--ink-muted)] sm:block">{info.title}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </section>

              <div hidden={cronoTab !== "tappa"}>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
                  <aside className={`${CARD} flex flex-col p-4 lg:sticky lg:top-0 lg:self-start`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className={KICKER}>ONDA DI TRAZIONE · TAPPA {meta.n}</p>
                      <span className="font-mono text-[10px] text-emerald-300 light:text-emerald-700">{greens} fronti attivi</span>
                    </div>
                    <div className="relative mt-2 h-[340px]">
                      <TacticalItalyMap
                        regions={plans}
                        selected={focus?.regione ?? null}
                        onSelect={setSelected}
                        stage
                        emphasis={cronoHoverRegions ?? undefined}
                      />
                    </div>
                    {focus ? (
                      <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/55 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-semibold">{focus.regione}</p>
                          <p className="font-mono text-[10.5px] tabular-nums text-[var(--ink-muted)]">
                            {pct(focus.startPct)} → {pct(focus.centralPct)} · sat. {formatDecimalIt(focus.reachSaturation * 100, 0)}%
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-[var(--signal-positive)]">
                          {votesLabel(focus.addedVotes)}
                        </span>
                      </div>
                    ) : null}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {rows.slice(0, 6).map((row) => (
                        <button
                          key={row.regione}
                          type="button"
                          onClick={() => setSelected(row.regione)}
                          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] transition-colors ${
                            focus?.regione === row.regione
                              ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200 light:text-emerald-800"
                              : "border-[var(--border-subtle)] text-[var(--ink-secondary)] hover:border-[var(--border-default)]"
                          }`}
                        >
                          {row.regione} {votesLabel(row.addedVotes)}
                        </button>
                      ))}
                    </div>
                  </aside>

                  <div className={`${CARD} p-5`}>
                    <ForecastStrategistPanel
                      open={strategist.open}
                      v4={v4}
                      v4Input={v4Input}
                      networkDelta={strategist.networkDelta}
                      backtest={backtest}
                      newsHeadlines={strategist.newsHeadlines}
                      viewScenario={viewScenario}
                      horizonKey={activeKey}
                      excludedEntityIds={strategist.excludedEntityIds}
                      selectedRegion={focus?.regione ?? null}
                      onSelectRegion={setSelected}
                      onHoverRegions={setCronoHoverRegions}
                      onOpenFattori={() => {
                        setCrono(false);
                        onOpenFattori();
                      }}
                    />
                  </div>
                </div>
              </div>

              <div hidden={cronoTab !== "bozze"}>
                <div className={`${CARD} p-5`}>
                  <ForecastEditorialCopy startPct={measuredPct} mayHorizon={mayHorizon} attackStatement={attackStatement} />
                </div>
              </div>

              <div hidden={cronoTab !== "sinottica"}>
                <section className={`${CARD} p-5`} aria-label="Vista sinottica delle tre tappe">
                  <p className={KICKER}>VISTA SINOTTICA DELLE 3 TAPPE · +30g | +90g | +180g</p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[12.5px]">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] font-mono text-[10.5px] tracking-[0.12em] text-[var(--ink-muted)]">
                          <th className="py-2.5 pr-4 font-normal">Indicatore</th>
                          {futureStages.map((stage) => {
                            const key = stage.key as ForecastHorizonKey;
                            return (
                              <th key={stage.key} className="py-2.5 pr-4 font-normal">
                                Tappa {STAGE_META[key].n} · {stage.label} ({STAGE_META[key].title})
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        <tr>
                          <th className="py-2.5 pr-4 font-normal text-[var(--ink-secondary)]">Consenso cumulato</th>
                          {futureStages.map((stage) => (
                            <td key={stage.key} className="py-2.5 pr-4 font-mono font-semibold tabular-nums text-[var(--ink-primary)]">{pct(stage.centralPct)}</td>
                          ))}
                        </tr>
                        <tr>
                          <th className="py-2.5 pr-4 font-normal text-[var(--ink-secondary)]">Passo di tappa</th>
                          {futureStages.map((stage, index) => {
                            const prev = index === 0 ? measuredPct : futureStages[index - 1]!.centralPct;
                            const step = stage.centralPct - prev;
                            return <td key={stage.key} className="py-2.5 pr-4 font-mono tabular-nums">{step >= 0 ? "+" : ""}{formatDecimalIt(step, 2)} pt</td>;
                          })}
                        </tr>
                        <tr>
                          <th className="py-2.5 pr-4 font-normal text-[var(--ink-secondary)]">Fascia teorica 80% (lo10–hi90)</th>
                          {futureStages.map((stage) => (
                            <td key={stage.key} className="py-2.5 pr-4 font-mono tabular-nums">{pct(stage.lo10)} – {pct(stage.hi90)}</td>
                          ))}
                        </tr>
                        <tr>
                          <th className="py-2.5 pr-4 font-normal text-[var(--ink-secondary)]">Tenuta scenario avverso</th>
                          {futureStages.map((stage) => (
                            <td key={stage.key} className="py-2.5 pr-4 font-mono tabular-nums">{pct(stage.cvar10)}</td>
                          ))}
                        </tr>
                        <tr>
                          <th className="py-2.5 pr-4 font-normal text-[var(--ink-secondary)]">Voti cumulati da oggi</th>
                          {futureStages.map((stage, index) => {
                            const cumulative = futureStages
                              .slice(0, index + 1)
                              .reduce((sum, row) => sum + Math.max(0, row.addedVotes), 0);
                            return <td key={stage.key} className="py-2.5 pr-4 font-mono font-semibold tabular-nums text-[var(--signal-positive)]">{votesLabel(cumulative)}</td>;
                          })}
                        </tr>
                        <tr>
                          <th className="py-2.5 pr-4 font-normal text-[var(--ink-secondary)]">Voti marginali di frazione</th>
                          {futureStages.map((stage) => (
                            <td key={stage.key} className="py-2.5 pr-4 font-mono tabular-nums">{votesLabel(stage.addedVotes)}</td>
                          ))}
                        </tr>
                        <tr>
                          <th className="py-2.5 pr-4 font-normal text-[var(--ink-secondary)]">Regioni guida</th>
                          {futureStages.map((stage) => (
                            <td key={stage.key} className="py-2.5 pr-4 text-[12px] text-[var(--ink-secondary)]">
                              {stage.topRegions.slice(0, 3).map((r) => r.regione).join(", ")}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
