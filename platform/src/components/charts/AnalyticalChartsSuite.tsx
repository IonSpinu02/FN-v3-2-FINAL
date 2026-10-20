"use client";

import type { Region } from "@/lib/engine/constants";
import type { HistoryMonthEntry } from "@/lib/engine/parseHistory";
import { OSSERVATORIO_RADICAMENTO_BASELINE } from "@/lib/engine/osservatorioRadicamentoBaseline";
import type { GoogleTrendsSeries, OsservatorioEvento } from "@/lib/engine/osservatorioTypes";
import type { RegionSnapshotDiff } from "@/lib/engine/snapshotDiff";
import type { ScenarioRow } from "@/lib/engine/types";
import type { PostVoteResultExtended } from "@/lib/engine/historyAndEval";
import { parseEventDate } from "@/lib/engine/eventStudyProtocol";
import { buildRegionalBaselineTrends } from "./osservatorioBaselineTrends";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  CHART_BORDER,
  CHART_GRID,
  clamp,
  fmtNumIt,
  fmtPctIt,
  olsLine,
  pearsonR,
  REGION_ABBR,
  useChartCrosshair,
} from "./chartUtils";

function ChartFrame({
  code,
  title,
  subtitle,
  children,
  header,
  clipContent = true,
}: {
  code: string;
  title: string;
  subtitle?: string;
  header?: ReactNode;
  children: ReactNode;
  /** false evita taglio SVG (es. CHART.03 — 20 regioni) */
  clipContent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-[#080C14] ${clipContent ? "overflow-hidden" : "overflow-visible"}`}
      style={{ borderColor: CHART_BORDER }}
    >
      <div className="border-b border-[#1B2436] px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
          {code} // {title}
        </p>
        {subtitle && (
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">{subtitle}</p>
        )}
        {header && <div className="mt-2">{header}</div>}
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

export type ForestPlotRow = {
  regione: Region;
  circ: string;
  stimaPct: number;
  lo10Pct: number;
  hi90Pct: number;
};

function linearTicks(min: number, max: number, count: number): number[] {
  if (count <= 1 || max <= min) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

type BubbleLayout = {
  regione: Region;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  r: number;
  link: boolean;
};

/** Sposta leggermente le bolle in pixel per evitare sovrapposizione etichette. */
function layoutQuadrantBubbles(
  items: { regione: Region; cx: number; cy: number; r: number }[],
  iterations = 3,
): BubbleLayout[] {
  const vx = items.map((p) => p.cx);
  const vy = items.map((p) => p.cy);
  const rs = items.map((p) => p.r);
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        let dx = vx[i]! - vx[j]!;
        let dy = vy[i]! - vy[j]!;
        let dist = Math.hypot(dx, dy);
        if (dist < 1e-6) {
          dx = 1;
          dy = 0;
          dist = 1;
        }
        const minDist = rs[i]! + rs[j]! + 3;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          vx[i]! += ux * push;
          vy[i]! += uy * push;
          vx[j]! -= ux * push;
          vy[j]! -= uy * push;
        }
      }
    }
  }
  return items.map((p, i) => {
    const ox = p.cx;
    const oy = p.cy;
    const px = vx[i]!;
    const py = vy[i]!;
    return {
      regione: p.regione,
      cx: ox,
      cy: oy,
      vx: px,
      vy: py,
      r: p.r,
      link: Math.hypot(px - ox, py - oy) > 6,
    };
  });
}

export function MonteCarloForestChart({
  rows,
  nationalSPct,
  selectedRegion,
  onSelectRegion,
}: {
  rows: ForestPlotRow[];
  nationalSPct: number;
  selectedRegion?: Region | null;
  onSelectRegion?: (r: Region) => void;
}) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.stimaPct - a.stimaPct),
    [rows],
  );
  const svgW = 680;
  const svgH = 520;
  const xMin = 0;
  const xMax = 15;
  const padL = 148;
  const padR = 118;
  const padT = 40;
  const padB = 28;
  const headerY = 14;
  const plotW = svgW - padL - padR;
  const rowH = (svgH - padT - padB) / Math.max(1, sorted.length);
  const xScale = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * plotW;
  const sogliaX = xScale(3);
  const mediaX = xScale(nationalSPct);

  return (
    <ChartFrame
      code="CHART.01"
      title="FOREST PLOT MONTE CARLO"
      subtitle="CI 80% lo10–hi90 · 20.000 iterazioni · MOD.A"
    >
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="h-auto w-full select-none">
        {Array.from({ length: 16 }, (_, i) => xMin + i).map((tick) => (
          <g key={tick}>
            <line
              x1={xScale(tick)}
              y1={padT}
              x2={xScale(tick)}
              y2={svgH - padB}
              stroke={CHART_GRID}
              strokeWidth={tick % 5 === 0 ? 1 : 0.5}
            />
            {tick % 5 === 0 && (
              <text
                x={xScale(tick)}
                y={svgH - 8}
                textAnchor="middle"
                fill="#64748B"
                fontSize={10}
                className="font-mono tabular-nums"
              >
                {fmtPctIt(tick, 0)}%
              </text>
            )}
          </g>
        ))}
        <line
          x1={sogliaX}
          y1={padT}
          x2={sogliaX}
          y2={svgH - padB}
          stroke="#F59E0B"
          strokeDasharray="4 3"
          strokeWidth={1.2}
        />
        <g>
          <rect
            x={sogliaX + 2}
            y={headerY - 11}
            width={148}
            height={14}
            fill="#080C14"
            rx={2}
          />
          <text
            x={sogliaX + 6}
            y={headerY}
            fill="#FBBF24"
            fontSize={9}
            className="font-mono"
          >
            SOGLIA SBARRAMENTO 3,00%
          </text>
        </g>
        <line
          x1={mediaX}
          y1={padT}
          x2={mediaX}
          y2={svgH - padB}
          stroke="#38BDF8"
          strokeDasharray="4 3"
          strokeWidth={1.2}
        />
        <g>
          <rect
            x={Math.min(mediaX + 2, svgW - padR - 152)}
            y={headerY - 11}
            width={168}
            height={14}
            fill="#080C14"
            rx={2}
          />
          <text
            x={Math.min(mediaX + 6, svgW - padR - 148)}
            y={headerY}
            fill="#38BDF8"
            fontSize={9}
            className="font-mono"
          >
            MEDIA NAZIONALE LIVE {fmtPctIt(nationalSPct, 2)}%
          </text>
        </g>
        {sorted.map((row, i) => {
          const y = padT + i * rowH + rowH / 2;
          const active = selectedRegion === row.regione;
          const moe = 0.5;
          return (
            <g
              key={row.regione}
              className="cursor-pointer"
              onClick={() => onSelectRegion?.(row.regione)}
            >
              <rect
                x={padL}
                y={padT + i * rowH}
                width={plotW}
                height={rowH}
                fill={active ? "rgba(16,185,129,0.08)" : "transparent"}
              />
              <text
                x={8}
                y={y + 4}
                fill="#E2E8F0"
                fontSize={11.5}
                className="font-mono"
              >
                {row.regione}
              </text>
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                fill="#64748B"
                fontSize={10}
                className="font-mono"
              >
                {row.circ}
              </text>
              <rect
                x={xScale(row.lo10Pct)}
                y={y - 3}
                width={Math.max(1, xScale(row.hi90Pct) - xScale(row.lo10Pct))}
                height={6}
                fill="rgba(16,185,129,0.18)"
              />
              <line x1={xScale(row.lo10Pct)} y1={y - 6} x2={xScale(row.lo10Pct)} y2={y + 6} stroke="#10B981" strokeWidth={1} />
              <line x1={xScale(row.hi90Pct)} y1={y - 6} x2={xScale(row.hi90Pct)} y2={y + 6} stroke="#10B981" strokeWidth={1} />
              <rect
                x={xScale(row.stimaPct - moe)}
                y={y - 2}
                width={Math.max(1, xScale(row.stimaPct + moe) - xScale(row.stimaPct - moe))}
                height={4}
                fill="rgba(16,185,129,0.45)"
              />
              <polygon
                points={`${xScale(row.stimaPct)},${y - 5} ${xScale(row.stimaPct) + 5},${y} ${xScale(row.stimaPct)},${y + 5} ${xScale(row.stimaPct) - 5},${y}`}
                fill={active ? "#38BDF8" : "#10B981"}
              />
              <text
                x={svgW - padR + 4}
                y={y + 4}
                fill="#CBD5E1"
                fontSize={11.5}
                className="font-mono tabular-nums"
              >
                {fmtPctIt(row.stimaPct, 2)}% [{fmtPctIt(row.lo10Pct, 2)}–{fmtPctIt(row.hi90Pct, 2)}]
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

export type QuadrantPoint = {
  regione: Region;
  stress: number;
  astenutiPct: number;
  viRatio: number;
  yPct: number;
  voti: number;
  iscritti: number;
};

type XMode = "stress" | "astenuti" | "vi";

export function QuadrantCorrelationMatrix({
  points,
  yMedianPct,
  onSelectRegion,
  selectedRegion,
}: {
  points: QuadrantPoint[];
  yMedianPct: number;
  onSelectRegion?: (r: Region) => void;
  selectedRegion?: Region | null;
}) {
  const [xMode, setXMode] = useState<XMode>("stress");
  const [sizeMode, setSizeMode] = useState<"voti" | "iscritti">("voti");
  const svgRef = useRef<SVGSVGElement>(null);
  const { vLineRef, hLineRef, labelRef } = useChartCrosshair(svgRef);

  const resolved = useMemo(
    () =>
      points.map((p) => ({
        regione: p.regione,
        x:
          xMode === "stress"
            ? p.stress
            : xMode === "astenuti"
              ? p.astenutiPct
              : p.viRatio,
        yPct: p.yPct,
        radius: sizeMode === "voti" ? p.voti : p.iscritti,
      })),
    [points, xMode, sizeMode],
  );

  const xs = resolved.map((p) => p.x);
  const ys = resolved.map((p) => p.yPct);
  const xMed = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 50;
  const { slope, intercept } = useMemo(() => olsLine(xs, ys), [xs, ys]);
  const r = useMemo(() => pearsonR(xs, ys), [xs, ys]);

  const padLeft = 56;
  const padRight = 56;
  const padTop = 56;
  const padBottom = 56;
  const w = 860;
  const h = 440;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  const domain = useMemo(() => {
    const rawMinX = xs.length ? Math.min(...xs) : 0;
    const rawMaxX = xs.length ? Math.max(...xs) : 100;
    const rawMinY = ys.length ? Math.min(...ys) : 0;
    const rawMaxY = ys.length ? Math.max(...ys) : 10;
    const xSpan = rawMaxX - rawMinX || 1;
    return {
      xMin: rawMinX - xSpan * 0.16,
      xMax: rawMaxX + xSpan * 0.16,
      yMin: Math.max(2.5, rawMinY - 0.8),
      yMax: rawMaxY + 0.9,
    };
  }, [xs, ys]);

  const sx = (v: number) =>
    padLeft + ((v - domain.xMin) / (domain.xMax - domain.xMin)) * plotW;
  const sy = (v: number) =>
    padTop + plotH - ((v - domain.yMin) / (domain.yMax - domain.yMin)) * plotH;
  const xMid = sx(xMed);
  const yMid = sy(yMedianPct);

  const xTicks = useMemo(
    () => linearTicks(domain.xMin, domain.xMax, 5),
    [domain.xMin, domain.xMax],
  );
  const yTicks = useMemo(
    () => linearTicks(domain.yMin, domain.yMax, 5),
    [domain.yMin, domain.yMax],
  );

  const bubbleLayouts = useMemo(() => {
    const xMin = domain.xMin;
    const xMax = domain.xMax;
    const yMin = domain.yMin;
    const yMax = domain.yMax;
    const toSx = (v: number) => padLeft + ((v - xMin) / (xMax - xMin)) * plotW;
    const toSy = (v: number) =>
      padTop + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
    const seed = resolved.map((p) => ({
      regione: p.regione,
      cx: toSx(p.x),
      cy: toSy(p.yPct),
      r: clamp(6 + p.radius * 0.012, 6, 18),
    }));
    return layoutQuadrantBubbles(seed, 3);
  }, [resolved, domain, plotW, plotH]);

  const header = (
    <div className="flex flex-wrap gap-2">
      {(
        [
          ["stress", "STRESS TERRITORIALE MOD. B (0-100)"],
          ["astenuti", "QUOTA ASTENUTI 2024"],
          ["vi", "RAPPORTO V/I (VOTI/ISCRITTO)"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setXMode(id)}
          className={`rounded border px-2 py-0.5 font-mono text-[9px] ${
            xMode === id
              ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
              : "border-[#1B2436] text-slate-500"
          }`}
        >
          {label}
        </button>
      ))}
      <span className="text-slate-600">|</span>
      {(
        [
          ["voti", "VOTI SCENARIO"],
          ["iscritti", "ISCRITTI FN"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setSizeMode(id)}
          className={`rounded border px-2 py-0.5 font-mono text-[9px] ${
            sizeMode === id
              ? "border-cyan-500/40 bg-cyan-950/30 text-cyan-200"
              : "border-[#1B2436] text-slate-500"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <ChartFrame
      code="CHART.02"
      title="QUADRANTE CONSENSO vs PRESSIONE"
      subtitle={`Pearson r = ${fmtPctIt(r, 3)} · Correlazione descrittiva ecologica · Non causale`}
      header={header}
    >
      <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
        <rect
          x={padLeft}
          y={padTop}
          width={plotW}
          height={plotH}
          fill="#0C101A"
          stroke={CHART_GRID}
        />
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line
              x1={sx(tick)}
              y1={padTop + plotH}
              x2={sx(tick)}
              y2={padTop + plotH + 4}
              stroke="#475569"
            />
            <text
              x={sx(tick)}
              y={h - padBottom + 18}
              textAnchor="middle"
              fill="#64748B"
              fontSize={10}
              className="font-mono tabular-nums"
            >
              {fmtPctIt(tick, xMode === "stress" ? 0 : 1)}
            </text>
          </g>
        ))}
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={padLeft - 4}
              y1={sy(tick)}
              x2={padLeft}
              y2={sy(tick)}
              stroke="#475569"
            />
            <text
              x={padLeft - 8}
              y={sy(tick) + 3}
              textAnchor="end"
              fill="#64748B"
              fontSize={10}
              className="font-mono tabular-nums"
            >
              {fmtPctIt(tick, 2)}%
            </text>
          </g>
        ))}
        <line
          x1={xMid}
          y1={padTop}
          x2={xMid}
          y2={padTop + plotH}
          stroke="#334155"
          strokeDasharray="3 3"
        />
        <line
          x1={padLeft}
          y1={yMid}
          x2={padLeft + plotW}
          y2={yMid}
          stroke="#334155"
          strokeDasharray="3 3"
        />
        <text
          x={padLeft + 10}
          y={padTop + 16}
          fill="#64748B"
          fontSize={8}
          className="font-mono"
        >
          Q2 // CONSOLIDAMENTO · BASSA PRESSIONE
        </text>
        <text
          x={w - padRight - 10}
          y={padTop + 16}
          textAnchor="end"
          fill="#64748B"
          fontSize={8}
          className="font-mono"
        >
          Q1 // ALTO CONSENSO · ALTA PRESSIONE
        </text>
        <text
          x={padLeft + 10}
          y={h - padBottom - 10}
          fill="#64748B"
          fontSize={8}
          className="font-mono"
        >
          Q3 // PRESIDIO ORDINARIO
        </text>
        <text
          x={w - padRight - 10}
          y={h - padBottom - 10}
          textAnchor="end"
          fill="#64748B"
          fontSize={8}
          className="font-mono"
        >
          Q4 // POTENZIALE CRITICO · PRIORITÀ
        </text>
        <line
          x1={sx(domain.xMin)}
          y1={sy(slope * domain.xMin + intercept)}
          x2={sx(domain.xMax)}
          y2={sy(slope * domain.xMax + intercept)}
          stroke="#475569"
          strokeDasharray="4 4"
        />
        {bubbleLayouts.map((b) => {
          const active = selectedRegion === b.regione;
          return (
            <g
              key={b.regione}
              className="cursor-pointer"
              onClick={() => onSelectRegion?.(b.regione)}
            >
              {b.link && (
                <line
                  x1={b.cx}
                  y1={b.cy}
                  x2={b.vx}
                  y2={b.vy}
                  stroke="#475569"
                  strokeWidth={0.8}
                />
              )}
              <circle
                cx={b.cx}
                cy={b.cy}
                r={b.r}
                fill={active ? "#38BDF8" : "#10B981"}
                fillOpacity={0.12}
                stroke={active ? "#38BDF8" : "#10B981"}
                strokeWidth={0.6}
              />
              <circle
                cx={b.vx}
                cy={b.vy}
                r={b.r}
                fill={active ? "#38BDF8" : "#10B981"}
                fillOpacity={0.35}
                stroke={active ? "#38BDF8" : "#10B981"}
              />
              <text
                x={b.vx}
                y={b.vy + 3}
                textAnchor="middle"
                fill="#F1F5F9"
                fontSize={8}
                className="font-mono font-semibold"
              >
                {REGION_ABBR[b.regione]}
              </text>
            </g>
          );
        })}
        <line ref={vLineRef} stroke="#64748B" strokeWidth={0.8} opacity={0} pointerEvents="none" />
        <line ref={hLineRef} stroke="#64748B" strokeWidth={0.8} opacity={0} pointerEvents="none" />
        <text ref={labelRef} opacity={0} className="fill-slate-400 font-mono text-[8px]" pointerEvents="none" />
      </svg>
    </ChartFrame>
  );
}

function regionFactorLabel(region: Region): string {
  if (region === "Friuli-Venezia Giulia") return "Friuli-V.G.";
  if (region === "Trentino-Alto Adige") return "Trentino-A.A.";
  if (region === "Emilia-Romagna") return "Emilia-Rom.";
  return region;
}

function giniFromVotes(votes: number[]): number {
  const sorted = [...votes].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let weighted = 0;
  for (let i = 0; i < n; i++) weighted += (i + 1) * sorted[i]!;
  return (2 * weighted) / (n * total) - (n + 1) / n;
}

const FACTOR_SEGMENTS = [
  { key: "flussi" as const, color: "#F97316", label: "Flussi" },
  { key: "pref" as const, color: "#10B981", label: "Preferenze" },
  { key: "isc" as const, color: "#38BDF8", label: "Iscritti" },
  { key: "ist" as const, color: "#A855F7", label: "Istituzioni" },
];

export function FactorContributionStack({ rows }: { rows: ScenarioRow[] }) {
  const factors = useMemo(() => {
    return [...rows]
      .map((r) => {
        const sum = r.f + r.m + r.p + r.v + 1e-9;
        return {
          regione: r.regione,
          stima: r.stima,
          flussi: (r.f / sum) * r.stima,
          pref: (r.p / sum) * r.stima,
          isc: (r.v / sum) * r.stima,
          ist: (r.m / sum) * r.stima,
          voti: r.voti_di_scenario,
        };
      })
      .sort((a, b) => b.stima - a.stima);
  }, [rows]);

  /** Ancoraggio asse X a 11% (stima in frazione 0–1). */
  const maxStima = useMemo(
    () => Math.max(11 / 100, ...factors.map((f) => f.stima)),
    [factors],
  );

  const pareto = useMemo(() => {
    const sorted = [...rows].sort(
      (a, b) => b.voti_di_scenario - a.voti_di_scenario,
    );
    const total = sorted.reduce((s, r) => s + r.voti_di_scenario, 0);
    let cum = 0;
    return sorted.map((r) => {
      cum += r.voti_di_scenario;
      return {
        regione: r.regione,
        voti: r.voti_di_scenario,
        cumPct: (cum / total) * 100,
        share: (r.voti_di_scenario / total) * 100,
      };
    });
  }, [rows]);

  const voteTotal = useMemo(
    () => rows.reduce((s, r) => s + r.voti_di_scenario, 0),
    [rows],
  );

  const top3Pct = useMemo(() => {
    const t = pareto.slice(0, 3).reduce((s, p) => s + p.share, 0);
    return t;
  }, [pareto]);

  const top5Pct = useMemo(() => {
    const t = pareto.slice(0, 5).reduce((s, p) => s + p.share, 0);
    return t;
  }, [pareto]);

  const gini = useMemo(
    () => giniFromVotes(rows.map((r) => r.voti_di_scenario)),
    [rows],
  );

  const barMaxWidth = 340;
  const barX0 = 125;
  const padTop = 28;
  const rowHeight = 21;
  const padBottomAxis = 40;
  const leftSvgH = padTop + rowHeight * 20 + padBottomAxis;
  const xAxisPctMax = 11;
  const xTickPcts = [0, 3, 6, 9, 11];

  const paretoW = 400;
  const paretoH = 440;
  const pPadL = 52;
  const pPadR = 16;
  const pPadT = 28;
  const pPadB = 48;
  const pPlotW = paretoW - pPadL - pPadR;
  const pPlotH = paretoH - pPadT - pPadB;
  const nRegions = pareto.length;
  const pX = (rankIndex: number) =>
    pPadL + (rankIndex / Math.max(1, nRegions - 1)) * pPlotW;
  const pY = (cumPct: number) =>
    pPadT + pPlotH - (cumPct / 100) * pPlotH;

  return (
    <ChartFrame
      code="CHART.03"
      title="DECOMPOSIZIONE 4 FATTORI & PARETO VOTI"
      subtitle="Flussi 35% · Pref 25% · Iscritti 25% · Istituzioni 15%"
      clipContent={false}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-slate-500">
            03.A // DECOMPOSIZIONE PONDERATA DEI 4 FATTORI (20 REGIONI)
          </p>
          <svg
            viewBox={`0 0 560 ${leftSvgH}`}
            className="h-auto w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <g transform={`translate(0, ${padTop - 18})`}>
              {FACTOR_SEGMENTS.map((seg, i) => (
                <g key={seg.key} transform={`translate(${8 + i * 128}, 0)`}>
                  <rect x={0} y={0} width={10} height={10} fill={seg.color} rx={1} />
                  <text x={14} y={9} fill="#94A3B8" fontSize={9} className="font-mono">
                    {seg.label}
                  </text>
                </g>
              ))}
            </g>
            {xTickPcts.map((pct) => {
              const gx = barX0 + (pct / xAxisPctMax) * barMaxWidth;
              return (
                <g key={pct}>
                  <line
                    x1={gx}
                    y1={padTop}
                    x2={gx}
                    y2={leftSvgH - padBottomAxis}
                    stroke="#162032"
                    strokeWidth={1}
                  />
                  <text
                    x={gx}
                    y={leftSvgH - 12}
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize={9}
                    className="font-mono tabular-nums"
                  >
                    {fmtPctIt(pct, 0)}%
                  </text>
                </g>
              );
            })}
            {factors.map((f, i) => {
              const y = padTop + i * rowHeight;
              const barW = (f.stima / maxStima) * barMaxWidth;
              const segs = [
                { w: f.flussi, c: "#F97316" },
                { w: f.pref, c: "#10B981" },
                { w: f.isc, c: "#38BDF8" },
                { w: f.ist, c: "#A855F7" },
              ];
              let x = barX0;
              return (
                <g key={f.regione}>
                  <text
                    x={115}
                    y={y + 12}
                    textAnchor="end"
                    fill="#E2E8F0"
                    fontSize={11}
                    className="font-mono"
                  >
                    {regionFactorLabel(f.regione)}
                  </text>
                  {segs.map((s) => {
                    const segW = (s.w / f.stima) * barW;
                    const rect = (
                      <rect
                        key={s.c}
                        x={x}
                        y={y + 1}
                        width={Math.max(0, segW)}
                        height={11}
                        fill={s.c}
                        fillOpacity={0.9}
                        rx={2}
                      />
                    );
                    x += segW;
                    return rect;
                  })}
                  <text
                    x={barX0 + barW + 8}
                    y={y + 12}
                    fill="#E2E8F0"
                    fontSize={11}
                    className="font-mono tabular-nums"
                  >
                    {fmtPctIt(f.stima * 100, 2)}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="lg:col-span-5">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-slate-500">
            03.B // CURVA DI CONCENTRAZIONE VOTI (PARETO / LORENZ)
          </p>
          <div className="rounded-lg border border-[#162032] bg-[#060911] p-3">
            <svg viewBox={`0 0 ${paretoW} ${paretoH}`} className="h-auto w-full">
              {[25, 50, 75, 100].map((mark) => (
                <g key={`y-${mark}`}>
                  <line
                    x1={pPadL}
                    y1={pY(mark)}
                    x2={pPadL + pPlotW}
                    y2={pY(mark)}
                    stroke="#162032"
                    strokeWidth={1}
                  />
                  <text
                    x={pPadL - 6}
                    y={pY(mark) + 3}
                    textAnchor="end"
                    fill="#64748B"
                    fontSize={9}
                    className="font-mono tabular-nums"
                  >
                    {mark}%
                  </text>
                  <text
                    x={pPadL + pPlotW + 4}
                    y={pY(mark) + 3}
                    fill="#475569"
                    fontSize={8}
                    className="font-mono tabular-nums"
                  >
                    {fmtNumIt(Math.round((mark / 100) * voteTotal))}
                  </text>
                </g>
              ))}
              {[5, 10, 15, 20].map((rank, idx) => {
                const x = pX(rank - 1);
                const labels = ["Top 5", "Top 10", "Top 15", "20 Regioni"];
                return (
                  <g key={rank}>
                    <line
                      x1={x}
                      y1={pPadT}
                      x2={x}
                      y2={pPadT + pPlotH}
                      stroke="#162032"
                      strokeWidth={1}
                    />
                    <text
                      x={x}
                      y={paretoH - 12}
                      textAnchor="middle"
                      fill="#64748B"
                      fontSize={9}
                      className="font-mono"
                    >
                      {labels[idx]}
                    </text>
                  </g>
                );
              })}
              <line
                x1={pPadL}
                y1={pY(50)}
                x2={pPadL + pPlotW}
                y2={pY(50)}
                stroke="#F59E0B"
                strokeDasharray="5 4"
                strokeWidth={1}
              />
              <line
                x1={pPadL}
                y1={pY(80)}
                x2={pPadL + pPlotW}
                y2={pY(80)}
                stroke="#A855F7"
                strokeDasharray="5 4"
                strokeWidth={1}
              />
              <polygon
                points={`${pX(0)},${pPadT + pPlotH} ${pareto
                  .map((p, i) => `${pX(i)},${pY(p.cumPct)}`)
                  .join(" ")} ${pX(nRegions - 1)},${pPadT + pPlotH}`}
                fill="rgba(16,185,129,0.10)"
              />
              <polyline
                points={pareto
                  .map((p, i) => `${pX(i)},${pY(p.cumPct)}`)
                  .join(" ")}
                fill="none"
                stroke="#10B981"
                strokeWidth={2}
              />
              {pareto.map((p, i) => (
                <circle
                  key={p.regione}
                  cx={pX(i)}
                  cy={pY(p.cumPct)}
                  r={3.5}
                  fill="#10B981"
                  stroke="#080C14"
                  strokeWidth={1.5}
                />
              ))}
              {pareto.slice(0, 6).map((p, i) => {
                const abbr = REGION_ABBR[p.regione];
                const label =
                  i === 0
                    ? `${abbr} ${fmtPctIt(p.cumPct, 1)}%`
                    : `+${abbr} ${fmtPctIt(p.cumPct, 1)}%`;
                return (
                  <text
                    key={p.regione}
                    x={pX(i) + 6}
                    y={pY(p.cumPct) - 6}
                    fill="#A7F3D0"
                    fontSize={8}
                    className="font-mono font-semibold"
                  >
                    {label}
                  </text>
                );
              })}
            </svg>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded border border-[#162032] bg-[#080C14] px-2 py-1.5">
                <p className="font-mono text-[8px] text-slate-500">TOP 3 REGIONI</p>
                <p className="font-mono text-sm tabular-nums text-emerald-300">
                  {fmtPctIt(top3Pct, 1)}%
                </p>
              </div>
              <div className="rounded border border-[#162032] bg-[#080C14] px-2 py-1.5">
                <p className="font-mono text-[8px] text-slate-500">TOP 5 REGIONI</p>
                <p className="font-mono text-sm tabular-nums text-emerald-300">
                  {fmtPctIt(top5Pct, 1)}%
                </p>
              </div>
              <div className="rounded border border-[#162032] bg-[#080C14] px-2 py-1.5">
                <p className="font-mono text-[8px] text-slate-500">INDICE DI GINI VOTI</p>
                <p className="font-mono text-sm tabular-nums text-emerald-300">
                  {gini.toLocaleString("it-IT", {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ChartFrame>
  );
}

function fmtTrendAxisDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = d.getUTCDate();
  const mon = d.toLocaleDateString("it-IT", { month: "short" }).replace(".", "");
  const cap = mon.charAt(0).toUpperCase() + mon.slice(1);
  return `${day} ${cap}`;
}

function eventSeriesIndex(
  evtIdx: number,
  d: Date | null,
  points: { date: string }[],
  eventCount: number,
): number {
  const n = points.length;
  if (n <= 1) return 0;
  const minT = new Date(`${points[0]!.date}T12:00:00Z`).getTime();
  const maxT = new Date(`${points[n - 1]!.date}T12:00:00Z`).getTime();
  if (d) {
    const t = d.getTime();
    if (t >= minT && t <= maxT) {
      const exact = points.findIndex((p) => p.date === d.toISOString().slice(0, 10));
      if (exact >= 0) return exact;
      const frac = (t - minT) / (maxT - minT);
      return Math.round(frac * (n - 1));
    }
  }
  return Math.round(((evtIdx + 1) / (eventCount + 1)) * (n - 1));
}

export function EventStudyTrendsChart({
  series,
  events,
  region,
}: {
  series: GoogleTrendsSeries | null;
  events: OsservatorioEvento[];
  region?: import("@/lib/engine/constants").Region;
}) {
  const effectiveSeries = useMemo(() => {
    if (series?.points.length) return series;
    if (!region) return null;
    return buildRegionalBaselineTrends(region, events);
  }, [series, region, events]);

  const metrics = useMemo(() => {
    if (!effectiveSeries?.points.length) return null;
    const vals = effectiveSeries.points.map((p) => p.value);
    const max = Math.max(...vals);
    const last = vals[vals.length - 1] ?? 0;
    const ma7 = vals.map((_, i) => {
      const slice = vals.slice(Math.max(0, i - 6), i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });
    const preBaseline =
      vals.slice(0, Math.min(8, vals.length)).reduce((a, b) => a + b, 0) /
      Math.min(8, vals.length);
    const deltaAttention = max - preBaseline;
    return { max, last, ma7, vals, deltaAttention, preBaseline };
  }, [effectiveSeries]);

  const w = 920;
  const h = 220;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 22;
  const padBottom = 32;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  if (!effectiveSeries || !metrics) {
    return (
      <ChartFrame code="CHART.04" title="EVENT STUDY TRENDS MOD.C" subtitle="Serie Google Trends 0–100">
        <p className="p-4 font-mono text-xs text-slate-500">Seleziona una regione per la curva baseline.</p>
      </ChartFrame>
    );
  }

  const plotSeries = effectiveSeries;
  const n = plotSeries.points.length;
  const sx = (i: number) => padLeft + (i / Math.max(1, n - 1)) * plotW;
  const sy = (v: number) => padTop + plotH - (v / 100) * plotH;

  const xTickIndices = [0, 6, 12, 18, 24, n - 1].filter((i) => i < n);
  const yTicks = [0, 25, 50, 75, 100];
  const displayEvents = events.slice(0, 8);

  const deltaLabel =
    metrics.deltaAttention >= 0
      ? `+${fmtPctIt(metrics.deltaAttention, 1)} pt post-evento`
      : `${fmtPctIt(metrics.deltaAttention, 1)} pt post-evento`;

  return (
    <ChartFrame code="CHART.04" title="EVENT STUDY TRENDS MOD.C" subtitle={`${plotSeries.query} · ${plotSeries.windowStart} → ${plotSeries.windowEnd}`}>
      <div className="mb-1 grid grid-cols-2 gap-1 px-1 font-mono text-[9px] text-slate-400 md:grid-cols-5">
        <span>INDICE ATTUALE {fmtPctIt(metrics.last, 0)}</span>
        <span>PICCO MAX {fmtPctIt(metrics.max, 0)}</span>
        <span>MEDIA 7 GIORNI</span>
        <span>DELTA ATTENZIONE {deltaLabel}</span>
        <span>EVT {events.length}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[210px] w-full">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
          </linearGradient>
        </defs>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={padLeft}
              y1={sy(tick)}
              x2={padLeft + plotW}
              y2={sy(tick)}
              stroke="#162032"
              strokeDasharray="3 3"
            />
            <text
              x={padLeft - 8}
              y={sy(tick) + 3}
              textAnchor="end"
              fill="#64748B"
              fontSize={10}
              className="font-mono tabular-nums"
            >
              {tick}
            </text>
          </g>
        ))}
        {xTickIndices.map((i) => (
          <text
            key={plotSeries.points[i]!.date}
            x={sx(i)}
            y={h - 8}
            textAnchor="middle"
            fill="#64748B"
            fontSize={10}
            className="font-mono"
          >
            {fmtTrendAxisDate(plotSeries.points[i]!.date)}
          </text>
        ))}
        {displayEvents.map((ev, evtIdx) => {
          const d = parseEventDate(ev.data);
          const i = eventSeriesIndex(
            evtIdx,
            d,
            plotSeries.points,
            displayEvents.length,
          );
          const cx = sx(i);
          const band = 22;
          const labelY = padTop + 14 + (evtIdx % 2) * 22;
          const presetLabels = [
            "EVT.01 // Intervista Vannacci-Corona",
            "EVT.02 // Manifestazione agricoltori",
          ];
          const title = ev.titolo.replace(/\s+/g, " ");
          const label =
            presetLabels[evtIdx] ??
            `EVT.${String(evtIdx + 1).padStart(2, "0")} // ${title.slice(0, 36)}`;
          const labelW = label.length * 6.4 + 16;
          const labelX = Math.max(
            padLeft + 2,
            Math.min(cx - labelW / 2, padLeft + plotW - labelW - 2),
          );
          return (
            <g key={ev.id}>
              <rect
                x={cx - band}
                y={padTop}
                width={band * 2}
                height={plotH}
                fill="rgba(245,158,11,0.08)"
              />
              <line
                x1={cx}
                y1={padTop}
                x2={cx}
                y2={padTop + plotH}
                stroke="#F59E0B"
                strokeWidth={1.2}
              />
              <rect
                x={labelX}
                y={labelY - 11}
                width={labelW}
                height={14}
                fill="#080C14"
                stroke="#F59E0B"
                strokeWidth={1}
                rx={3}
              />
              <text
                x={labelX + 6}
                y={labelY}
                fill="#FCD34D"
                fontSize={8}
                className="font-mono"
              >
                {label}
              </text>
            </g>
          );
        })}
        <polygon
          points={`${sx(0)},${padTop + plotH} ${plotSeries.points
            .map((p, i) => `${sx(i)},${sy(p.value)}`)
            .join(" ")} ${sx(n - 1)},${padTop + plotH}`}
          fill="url(#trendFill)"
        />
        <polyline
          points={plotSeries.points.map((p, i) => `${sx(i)},${sy(p.value)}`).join(" ")}
          fill="none"
          stroke="#C4B5FD"
          strokeWidth={1.4}
        />
        {plotSeries.points.map((p, i) => (
          <circle key={p.date} cx={sx(i)} cy={sy(p.value)} r={2.2} fill="#A855F7" />
        ))}
        <polyline
          points={metrics.ma7.map((v, i) => `${sx(i)},${sy(v)}`).join(" ")}
          fill="none"
          stroke="#38BDF8"
          strokeWidth={2}
        />
      </svg>
    </ChartFrame>
  );
}

export function EntropyAndCalibrationChart({
  mode,
  history,
  snapshotMetrics,
  postVote,
}: {
  mode: "entropy" | "parity";
  history?: HistoryMonthEntry[];
  snapshotMetrics?: { hIsc: number; hScen: number; js: number };
  postVote?: PostVoteResultExtended | null;
}) {
  if (mode === "entropy") {
    const w = 880;
    const h = 280;
    const pad = 48;
    const fromCsv = history?.filter((e) => e.H != null) ?? [];
    const entries =
      fromCsv.length > 0 ? fromCsv : OSSERVATORIO_RADICAMENTO_BASELINE;
    const plotW = w - pad * 2;
    const plotH = h - pad * 2;
    const monthLabel = (m: string) => {
      const parts = m.split("-");
      const mm = parts[1];
      const names: Record<string, string> = {
        "05": "Mag",
        "06": "Giu",
        "07": "Lug",
        "08": "Ago",
        "09": "Set",
        "10": "Ott",
      };
      return names[mm ?? ""] ?? mm ?? m;
    };
    return (
      <ChartFrame
        code="CHART.05A"
        title="RADICAMENTO TERRITORIALE FN"
        subtitle="Equilibrio iscritti · Equilibrio consenso · Mag 2026 → Ott 2026"
      >
        <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
          {[0.82, 0.86, 0.9].map((tick) => (
            <g key={tick}>
              <line
                x1={pad}
                y1={pad + (1 - tick) * plotH}
                x2={pad + plotW}
                y2={pad + (1 - tick) * plotH}
                stroke="#162032"
                strokeDasharray="3 3"
              />
              <text
                x={pad - 6}
                y={pad + (1 - tick) * plotH + 3}
                textAnchor="end"
                className="fill-slate-600 font-mono text-[8px]"
              >
                {tick.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </text>
            </g>
          ))}
          <polyline
            points={entries
              .map((e, i) => {
                const x = pad + (i / Math.max(1, entries.length - 1)) * plotW;
                const y = pad + (1 - (e.H ?? 0)) * plotH;
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="#10B981"
            strokeWidth={2}
          />
          <polyline
            points={entries
              .map((e, i) => {
                const x = pad + (i / Math.max(1, entries.length - 1)) * plotW;
                const y =
                  pad + (1 - (e.H_scenario_condizionato ?? e.H ?? 0)) * plotH;
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="#38BDF8"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          {entries.map((e, i) => {
            const x = pad + (i / Math.max(1, entries.length - 1)) * plotW;
            const y = pad + (1 - (e.H ?? 0)) * plotH;
            return (
              <g key={e.mese}>
                <circle cx={x} cy={y} r={4} fill="#10B981" />
                <text
                  x={x}
                  y={h - 12}
                  textAnchor="middle"
                  className="fill-slate-500 font-mono text-[9px]"
                >
                  {monthLabel(e.mese)}
                </text>
              </g>
            );
          })}
          {snapshotMetrics && (
            <text x={pad} y={18} className="fill-slate-400 font-mono text-[9px]">
              Radicamento iscritti · Consenso scenario · Scostamento storico
            </text>
          )}
        </svg>
      </ChartFrame>
    );
  }

  const righe = postVote?.righe.filter((r) => r.voto_osservato != null) ?? [];
  const w = 880;
  const h = 360;
  const pad = 52;
  const plot = w / 2 - pad;

  return (
    <ChartFrame
      code="CHART.05B"
      title="PARITY PLOT & RESIDUI POST-VOTO"
      subtitle={
        postVote
          ? `MAE ${fmtPctIt(postVote.validazione_predittiva.mae_punti_scenario * 100, 2)} pp · RMSE ${fmtPctIt(postVote.validazione_predittiva.rmse_punti_scenario * 100, 2)} pp · COPERTURA CI ${fmtPctIt(postVote.validazione_predittiva.copertura_regioni_sensibilita * 100, 0)}%`
          : "Carica CSV esiti o simulazione test"
      }
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
        <g transform={`translate(0,0)`}>
          <rect x={pad} y={pad} width={plot} height={plot} fill="#0C101A" stroke={CHART_GRID} />
          <line x1={pad} y1={pad + plot} x2={pad + plot} y2={pad} stroke="#475569" strokeDasharray="4 4" />
          {righe.map((r) => {
            const pred = r.stima * 100;
            const obs = (r.voto_osservato ?? 0) * 100;
            const x = pad + (pred / 15) * plot;
            const y = pad + plot - (obs / 15) * plot;
            const err = Math.abs(obs - pred);
            const col = err > 1.5 ? "#F87171" : err > 0.8 ? "#FBBF24" : "#34D399";
            return <circle key={r.regione} cx={x} cy={y} r={5} fill={col} fillOpacity={0.7} />;
          })}
        </g>
        <g transform={`translate(${w / 2},0)`}>
          {righe.map((r, i) => {
            const errPp = ((r.voto_osservato ?? 0) - r.stima) * 100;
            const y = pad + i * ((plot - 20) / Math.max(1, righe.length));
            const cx = w / 2 - pad + plot / 2;
            const wBar = (Math.abs(errPp) / 3) * (plot / 2);
            return (
              <rect
                key={r.regione}
                x={errPp >= 0 ? cx : cx - wBar}
                y={y}
                width={wBar}
                height={8}
                fill={errPp >= 0 ? "#34D399" : "#F87171"}
                fillOpacity={0.8}
              />
            );
          })}
        </g>
      </svg>
    </ChartFrame>
  );
}

export function SnapshotDivergingDeltaChart({
  regions,
  subtitle,
}: {
  regions: RegionSnapshotDiff[];
  subtitle?: string;
}) {
  const sorted = useMemo(
    () => [...regions].sort((a, b) => b.deltaStimaPp - a.deltaStimaPp),
    [regions],
  );
  const w = 920;
  const h = 520;
  const mid = w / 2;
  const rowH = (h - 40) / Math.max(sorted.length, 1);

  return (
    <ChartFrame
      code="CHART.06"
      title="DIVERGING DELTA SNAPSHOT A vs B"
      subtitle={subtitle ?? "Delta stima pp · Delta voti"}
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
        <line x1={mid} y1={20} x2={mid} y2={h - 20} stroke="#334155" />
        {sorted.map((r, i) => {
          const y = 30 + i * rowH;
          const barW = clamp(Math.abs(r.deltaStimaPp) * 18, 2, 200);
          return (
            <g key={r.regione}>
              <text x={8} y={y + 8} className="fill-slate-300 font-mono text-[9px]">
                {r.regione}
              </text>
              <rect
                x={r.deltaStimaPp >= 0 ? mid : mid - barW}
                y={y}
                width={barW}
                height={rowH - 6}
                fill={r.deltaStimaPp >= 0 ? "#34D399" : "#FBBF24"}
                fillOpacity={0.75}
              />
              <text x={mid + (r.deltaStimaPp >= 0 ? barW + 4 : -barW - 4)} y={y + 8} className="fill-slate-400 font-mono text-[8px] tabular-nums">
                {fmtPctIt(r.deltaStimaPp, 2)} pp · {fmtNumIt(r.deltaVoti)} voti
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

export type DomainStressRow = {
  domain: string;
  regionStress: number;
  nationalAvg: number;
};

export function DomainStressComparativeChart({
  rows,
  regionLabel,
}: {
  rows: DomainStressRow[];
  regionLabel: string;
}) {
  const w = 720;
  const h = 40 + rows.length * 28;
  return (
    <ChartFrame
      code="CHART.07"
      title="DISAGIO TERRITORIALE PER AMBITO"
      subtitle={`Confronto regionale · ${regionLabel}`}
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
        {rows.map((r, i) => {
          const y = 24 + i * 28;
          const scale = 5;
          return (
            <g key={r.domain}>
              <text x={8} y={y} className="fill-slate-300 font-mono text-[9px]">
                {r.domain}
              </text>
              <rect x={140} y={y - 10} width={r.regionStress * scale} height={12} fill="#F59E0B" fillOpacity={0.7} />
              <line x1={140 + r.nationalAvg * scale} y1={y - 12} x2={140 + r.nationalAvg * scale} y2={y + 4} stroke="#38BDF8" strokeWidth={1.5} />
              <text x={400} y={y} className="fill-slate-400 font-mono text-[9px] tabular-nums">
                Regionale: {r.regionStress}/100 · Media Italia: {Math.round(r.nationalAvg)}/100
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

export type InstitutionalRadixRow = {
  region: string;
  dep: number;
  creg: number;
  sind: number;
  com: number;
};

const CARICA_COLORS: Record<keyof Omit<InstitutionalRadixRow, "region">, string> =
  {
    dep: "#8B5CF6",
    creg: "#38BDF8",
    sind: "#34D399",
    com: "#FBBF24",
  };

export function InstitutionalRadixChart({
  rows,
}: {
  rows: InstitutionalRadixRow[];
}) {
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          b.dep + b.creg + b.sind + b.com - (a.dep + a.creg + a.sind + a.com),
      ),
    [rows],
  );
  const maxTotal = Math.max(
    1,
    ...sorted.map((r) => r.dep + r.creg + r.sind + r.com),
  );
  const w = 920;
  const rowStep = 24;
  const barHeight = 12;
  const h = 48 + sorted.length * rowStep;
  const labelW = 120;
  const barW = w - labelW - 40;
  const scale = barW / maxTotal;

  return (
    <ChartFrame
      code="CHART.08"
      title="RADICAMENTO ISTITUZIONALE PER REGIONE"
      subtitle="Deputati · Consiglieri regionali · Sindaci · Consiglieri comunali"
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
        {sorted.map((r, i) => {
          const y = 24 + i * rowStep;
          let x = labelW;
          const segments: (keyof typeof CARICA_COLORS)[] = [
            "dep",
            "creg",
            "sind",
            "com",
          ];
          return (
            <g key={r.region}>
              <text x={8} y={y} className="fill-slate-300 font-mono text-[9px]">
                {r.region}
              </text>
              {segments.map((key) => {
                const val = r[key];
                const segW = val * scale;
                const out = (
                  <rect
                    key={key}
                    x={x}
                    y={y - barHeight}
                    width={Math.max(val ? 2 : 0, segW)}
                    height={barHeight}
                    fill={CARICA_COLORS[key]}
                    fillOpacity={0.85}
                  />
                );
                x += segW;
                return out;
              })}
              <text
                x={labelW + barW + 8}
                y={y}
                className="fill-slate-500 font-mono text-[8px] tabular-nums"
              >
                {r.dep + r.creg + r.sind + r.com}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${labelW}, ${h - 20})`}>
          {(
            [
              ["dep", "Deputati"],
              ["creg", "Cons. reg."],
              ["sind", "Sindaci"],
              ["com", "Cons. com."],
            ] as const
          ).map(([key, lab], i) => (
            <g key={key} transform={`translate(${i * 120}, 0)`}>
              <rect
                x={0}
                y={-8}
                width={10}
                height={10}
                fill={CARICA_COLORS[key]}
              />
              <text x={14} y={0} className="fill-slate-500 font-mono text-[8px]">
                {lab}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </ChartFrame>
  );
}
