"use client";

import { useEffect, useRef, useState } from "react";
import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import type { BasinId, RegionPlan, StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import type { ExecutionPhase } from "@/lib/engine/strategicCommandBrief";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const BASIN_ORDER: BasinId[] = [
  "voto_tematico_ponte",
  "delusi_coalizione",
  "astensione_recuperabile",
  "radicamento_civico_eletti",
];

const BASIN_COLOR: Record<BasinId, string> = {
  voto_tematico_ponte: "#34d399",
  delusi_coalizione: "#22d3ee",
  astensione_recuperabile: "#f59e0b",
  radicamento_civico_eletti: "#94a3b8",
};

export function WaterfallChart({
  current,
  offensive,
  target,
  groundingShare,
  maxEndogenous,
}: {
  current: number;
  offensive: number;
  target: number;
  groundingShare: number;
  maxEndogenous: number;
}) {
  const inertia = Math.max(0, Math.min(offensive, target) - current);
  const covered = Math.min(target, maxEndogenous);
  const surplus = Math.max(0, covered - Math.min(offensive, target));
  const air = surplus * (1 - groundingShare);
  const ground = Math.max(0, surplus - air);
  const steps = [
    { label: "Oggi", rise: current, from: 0, color: "#64748b", caption: `${formatDecimalIt(current, 1)}%` },
    { label: "Scorrimento", rise: inertia, from: current, color: "#22d3ee", caption: `+${formatDecimalIt(inertia, 1)}` },
    { label: "+Aria", rise: air, from: current + inertia, color: "#34d399", caption: `+${formatDecimalIt(air, 1)}` },
    { label: "+Terra", rise: ground, from: current + inertia + air, color: "#d97706", caption: `+${formatDecimalIt(ground, 1)}` },
    { label: "Target", rise: target, from: 0, color: "#34d399", caption: `${formatDecimalIt(target, 1)}%` },
  ];
  const w = 300;
  const h = 148;
  const padL = 8;
  const padR = 6;
  const padB = 22;
  const padT = 18;
  const scale = Math.max(target, current, offensive, 1) * 1.08;
  const yOf = (pct: number) => {
    const y = h - padB - (pct / scale) * (h - padT - padB);
    return Number.isFinite(y) ? y : h - padB;
  };
  const gap = 6;
  const barW = (w - padL - padR - gap * (steps.length - 1)) / steps.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-36 w-full" role="img" aria-label="Ponte dal consenso di oggi al traguardo">
      {steps.map((step, index) => {
        const x = padL + index * (barW + gap);
        const top = step.label === "Target" ? yOf(target) : yOf(step.from + step.rise);
        const bottom = step.label === "Target" ? yOf(0) : yOf(step.from);
        const next = steps[index + 1];
        const guideY = top;
        return (
          <g key={step.label}>
            {next && step.label !== "Target" ? (
              <line x1={x + barW} x2={padL + (index + 1) * (barW + gap)} y1={guideY} y2={guideY} stroke="var(--ink-muted)" strokeDasharray="2 2" />
            ) : null}
            <rect x={x} y={Math.min(top, bottom)} width={barW} height={Math.max(1.5, Math.abs(bottom - top))} rx="2" fill={step.color} opacity={step.label === "Target" ? 1 : 0.92} />
            <text x={x + barW / 2} y={Math.max(10, Math.min(top, bottom) - 3)} textAnchor="middle" fill="var(--ink-primary)" style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace" }}>
              {step.caption}
            </text>
            <text x={x + barW / 2} y={h - 6} textAnchor="middle" fill="var(--ink-muted)" style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace" }}>
              {step.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function HemicycleChart({
  todaySeats,
  planSeats,
  rangeLabel,
  caption = "SEGGI CAMERA (IPOTESI)",
}: {
  todaySeats: number;
  planSeats: number;
  rangeLabel: string;
  caption?: string;
}) {
  const rows = [16, 20, 24, 28];
  const cx = 150;
  const cy = 128;
  const dots: { x: number; y: number; index: number }[] = [];
  let index = 0;
  rows.forEach((count, row) => {
    const radius = 40 + row * 22;
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const angle = Math.PI - t * Math.PI;
      dots.push({
        x: round2(cx + Math.cos(angle) * radius),
        y: round2(cy - Math.sin(angle) * radius),
        index,
      });
      index += 1;
    }
  });
  const perDot = 400 / dots.length;
  return (
    <svg viewBox="0 0 300 158" className="h-40 w-full" role="img" aria-label="Emiciclo dei 400 seggi della Camera">
      {dots.map((dot) => {
        const seat = dot.index * perDot;
        const fill = seat < todaySeats ? "#67e8f9" : seat < planSeats ? "#34d399" : "rgba(148,163,184,0.16)";
        return <circle key={dot.index} cx={dot.x} cy={dot.y} r={2.8} fill={fill} />;
      })}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--ink-primary)" style={{ fontSize: 18, fontFamily: "var(--font-mono), monospace" }}>
        {rangeLabel}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--ink-muted)" style={{ fontSize: 9, fontFamily: "var(--font-mono), monospace" }}>
        {caption}
      </text>
    </svg>
  );
}

const BASIN_SHORT: Record<BasinId, string> = {
  voto_tematico_ponte: "Ceto produttivo e PMI",
  delusi_coalizione: "Delusi Centrodestra",
  astensione_recuperabile: "Astensione recuperabile",
  radicamento_civico_eletti: "Reti civiche e Eletti",
};

function compactVotes(votes: number): string {
  if (votes >= 1_000_000) return `+${formatDecimalIt(votes / 1_000_000, 2)}M`;
  return `+${formatIntIt(Math.round(votes / 1000))}k`;
}

export function BasinRing({ totals, totalVotes }: { totals: Record<BasinId, number>; totalVotes: number }) {
  const sum = BASIN_ORDER.reduce((acc, key) => acc + totals[key], 0) || 1;
  const r = 26;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="mt-2">
      <div className="flex justify-center">
        <svg viewBox="0 0 76 76" className="h-[76px] w-[76px]" role="img" aria-label="Riparto dei quattro bacini">
          <circle cx="38" cy="38" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
          {BASIN_ORDER.map((key) => {
            const length = (totals[key] / sum) * c;
            const node = (
              <circle
                key={key}
                cx="38"
                cy="38"
                r={r}
                fill="none"
                stroke={BASIN_COLOR[key]}
                strokeWidth="9"
                strokeDasharray={`${length} ${c - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 38 38)"
              />
            );
            offset += length;
            return node;
          })}
          <text x="38" y="42" textAnchor="middle" fill="var(--ink-primary)" style={{ fontSize: 11, fontFamily: "var(--font-mono), monospace" }}>
            {compactVotes(totalVotes)}
          </text>
        </svg>
      </div>
      <ul className="mt-2 space-y-1.5">
        {BASIN_ORDER.map((key) => {
          const share = (totals[key] / sum) * 100;
          return (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-2 text-[12px] text-[var(--ink-primary)]">
                <span>{BASIN_SHORT[key]}</span>
                <span className="font-mono text-[11px] tabular-nums text-[var(--ink-secondary)]">
                  {formatDecimalIt(share, 0)}% · {compactVotes(totals[key])}
                </span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div className="h-full" style={{ width: `${share}%`, background: BASIN_COLOR[key] }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FanChart({
  result,
  electorate,
  activePhase,
}: {
  result: StrategicBackcastResult;
  electorate: number;
  activePhase: { fromDay: number; toDay: number } | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(920);
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const update = () => setW(Math.max(320, Math.round(node.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const h = 172;
  const padL = 40;
  const padR = 20;
  const padT = 22;
  const padB = 22;
  const horizon = result.horizonDays;
  const points = [{ day: 0, expectedPct: result.currentPct, minOnTrackPct: result.currentPct, stretchPct: result.currentPct }, ...result.checkpoints];
  const values = [
    result.currentPct,
    result.offensiveCentral,
    result.p10,
    result.p90,
    ...points.flatMap((point) => [point.minOnTrackPct, point.expectedPct, point.stretchPct]),
  ];
  const min = Math.min(...values) - 0.35;
  const max = Math.max(...values) + 0.45;
  const x = (day: number) => padL + (day / horizon) * (w - padL - padR);
  const y = (pct: number) => h - padB - ((pct - min) / (max - min || 1)) * (h - padT - padB);
  const ticks = [0, 1, 2, 3].map((step) => min + ((max - min) * step) / 3);
  const fan = [
    ...points.map((point) => {
      const t = point.day / horizon;
      return `${x(point.day)},${y(result.currentPct + (result.p90 - result.currentPct) * t)}`;
    }),
    ...[...points].reverse().map((point) => {
      const t = point.day / horizon;
      return `${x(point.day)},${y(result.currentPct + (result.p10 - result.currentPct) * t)}`;
    }),
  ].join(" ");
  const corridor = [
    ...result.checkpoints.map((point) => `${x(point.day)},${y(point.stretchPct)}`),
    ...[...result.checkpoints].reverse().map((point) => `${x(point.day)},${y(point.minOnTrackPct)}`),
  ].join(" ");
  const expected = points.map((point) => `${x(point.day)},${y(point.expectedPct)}`).join(" ");
  const area = [...points.map((point) => `${x(point.day)},${y(point.expectedPct)}`), `${x(horizon)},${h - padB}`, `${x(0)},${h - padB}`].join(" ");
  const hovered = points.find((point) => point.day === hover) ?? null;
  return (
    <div ref={wrapRef} className="relative w-full">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="block" role="img" aria-label="Traiettoria del piano">
        <defs>
          <linearGradient id="obj-fan-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
          <filter id="obj-curve-glow" x="-5%" y="-40%" width="110%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {activePhase ? (
          <rect
            x={x(activePhase.fromDay)}
            y={padT}
            width={Math.max(0, x(activePhase.toDay) - x(activePhase.fromDay))}
            height={h - padT - padB}
            fill="var(--ink-primary)"
            opacity="0.045"
          />
        ) : null}
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={padL} x2={w - padR} y1={y(tick)} y2={y(tick)} stroke="var(--border-subtle)" strokeDasharray="3 4" />
            <text x={padL - 6} y={y(tick) + 3} textAnchor="end" fill="var(--ink-muted)" style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace" }}>
              {formatDecimalIt(tick, 1)}
            </text>
          </g>
        ))}
        <polygon points={fan} fill="#22d3ee" opacity="0.08" />
        <polygon points={area} fill="url(#obj-fan-area)" className="obj-region" style={{ animationDelay: "900ms" }} />
        <polygon points={corridor} fill="#34d399" opacity="0.1" />
        <line x1={x(0)} y1={y(result.currentPct)} x2={x(horizon)} y2={y(result.offensiveCentral)} stroke="var(--ink-muted)" strokeDasharray="5 4" strokeWidth="1.3" />
        <polyline points={expected} pathLength={1} fill="none" stroke="#34d399" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" filter="url(#obj-curve-glow)" className="obj-draw" />
        {points.map((point) => (
          <g key={point.day} onMouseEnter={() => setHover(point.day)} onMouseLeave={() => setHover(null)}>
            <circle cx={x(point.day)} cy={y(point.expectedPct)} r={hover === point.day ? 4.5 : 2.6} fill="var(--ink-primary)" />
            <text x={point.day === 0 ? x(point.day) + 8 : x(point.day)} y={h - 6} textAnchor={point.day === 0 ? "start" : point.day === horizon ? "end" : "middle"} fill="var(--ink-muted)" style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace" }}>
              {point.day === 0 ? "Oggi" : `${point.day}g`}
            </text>
            {point.day === 90 || point.day === 180 || point.day === 270 || point.day === 360 ? (
              <text x={point.day === horizon ? x(point.day) - 4 : x(point.day)} y={Math.max(12, y(point.expectedPct) - 7)} textAnchor={point.day === horizon ? "end" : "middle"} fill="var(--ink-primary)" style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace" }}>
                {formatDecimalIt(point.expectedPct, 1)}%
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      {hovered ? (
        <p className="pointer-events-none absolute right-2 top-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-2 py-1 font-mono text-[10px] tabular-nums text-[var(--ink-primary)]">
          {formatDecimalIt(hovered.expectedPct, 2)}% · soglia {formatDecimalIt(hovered.minOnTrackPct, 2)}% · +
          {formatIntIt(Math.max(0, ((hovered.expectedPct - result.currentPct) / 100) * electorate))}
        </p>
      ) : null}
    </div>
  );
}

export function PhaseGantt({
  phases,
  horizon,
  active,
  onActive,
}: {
  phases: readonly ExecutionPhase[];
  horizon: number;
  active: number;
  onActive: (id: number) => void;
}) {
  const w = 760;
  const padL = 44;
  const padR = 20;
  const x = (day: number) => padL + (Math.max(0, day) / horizon) * (w - padL - padR);
  return (
    <svg viewBox={`0 0 ${w} 40`} className="h-10 w-full" role="img" aria-label="Sequenza delle tre fasi">
      {phases.map((phase, index) => {
        const start = index === 0 ? 0 : phase.fromDay;
        const left = x(start);
        const width = Math.max(28, x(phase.toDay) - left);
        const on = active === phase.id;
        return (
          <g key={phase.id} onMouseEnter={() => onActive(phase.id)} onClick={() => onActive(phase.id)} className="cursor-pointer">
            <rect x={left + 2} y={6} width={Math.max(8, width - 4)} height={28} rx="4" fill={on ? "rgba(52,211,153,0.28)" : "var(--surface-2)"} stroke={on ? "#34d399" : "var(--border-default)"} />
            <text x={left + 8} y={24} fill="var(--ink-primary)" style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace" }}>
              {width > 120 ? `${phase.code} · ${phase.title} · ${formatDecimalIt(phase.targetPct, 1)}%` : `${phase.code} · ${formatDecimalIt(phase.targetPct, 1)}%`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function RegionRadar({ plan }: { plan: RegionPlan }) {
  const basinSum = Object.values(plan.basins).reduce((sum, value) => sum + value, 0) || 1;
  const air = (plan.basins.delusi_coalizione + plan.basins.voto_tematico_ponte) / basinSum;
  const ground = plan.basins.radicamento_civico_eletti / basinSum;
  const cap = plan.targetPct / Math.max(plan.ceilingPct, 0.01);
  const hold = Math.max(0, 1 - plan.resistance / 6);
  const planAxes = [cap, air, ground, hold];
  const nowAxes = [plan.todayPct / Math.max(plan.ceilingPct, 0.01), air * 0.45, ground * 0.4, hold * 0.7];
  const labels = ["Bacino", "Aria", "Terra", "Tenuta"];
  const cx = 90;
  const cy = 74;
  const radius = 40;
  const point = (values: number[], index: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 4;
    const mag = Math.max(0, Math.min(1, values[index] ?? 0));
    return [round2(cx + Math.cos(angle) * radius * mag), round2(cy + Math.sin(angle) * radius * mag)] as const;
  };
  const ringPoint = (scale: number, index: number) => point([scale, scale, scale, scale], index);
  const poly = (values: number[]) => values.map((_, index) => point(values, index).join(",")).join(" ");
  const labelPos = [
    [cx, 18],
    [cx + radius + 22, cy + 3],
    [cx, 138],
    [cx - radius - 22, cy + 3],
  ];
  return (
    <svg viewBox="0 0 180 150" className="mx-auto my-1 h-[150px] w-full max-w-[220px]" role="img" aria-label="Radar regionale del piano">
      {[0.33, 0.66, 1].map((ring) => (
        <polygon key={ring} points={[0, 1, 2, 3].map((index) => ringPoint(ring, index).join(",")).join(" ")} fill="none" stroke="var(--border-subtle)" />
      ))}
      {[0, 1, 2, 3].map((index) => {
        const [ex, ey] = ringPoint(1, index);
        return <line key={index} x1={cx} y1={cy} x2={ex} y2={ey} stroke="var(--border-subtle)" />;
      })}
      <polygon points={poly(nowAxes)} fill="none" stroke="#94a3b8" strokeDasharray="3 2" />
      <polygon points={poly(planAxes)} fill="#34d399" opacity="0.25" stroke="#34d399" />
      {planAxes.map((_, index) => {
        const [vx, vy] = point(planAxes, index);
        return <circle key={index} cx={vx} cy={vy} r="2.2" fill="#34d399" />;
      })}
      {labels.map((label, index) => (
        <text key={label} x={labelPos[index]?.[0]} y={labelPos[index]?.[1]} textAnchor="middle" fill="var(--ink-muted)" style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace" }}>
          {label}
        </text>
      ))}
    </svg>
  );
}

export function BulletBar({ plan }: { plan: RegionPlan }) {
  const scale = Math.max(plan.ceilingPct, plan.targetPct, 0.01);
  const anchor = Math.min(100, (plan.anchorPct / scale) * 100);
  const gain = Math.max(0, Math.min(100 - anchor, ((plan.targetPct - plan.anchorPct) / scale) * 100));
  return (
    <div className="relative mt-1 h-1.5 rounded-full border border-[var(--border-subtle)] bg-transparent">
      <div className="absolute inset-y-0 left-0 bg-[var(--ink-muted)]" style={{ width: `${anchor}%` }} />
      <div className="absolute inset-y-0 bg-[var(--signal-positive)]" style={{ left: `${anchor}%`, width: `${gain}%` }} />
    </div>
  );
}

export function LoadGauge({ label, need, cap, total }: { label: string; need: number; cap: number; total: number }) {
  const ratio = cap > 0 ? need / cap : 1;
  const tone = ratio <= 0.85 ? "#34d399" : ratio <= 1 ? "#f59e0b" : "#fb7185";
  const words = ratio <= 0.85 ? "Sostenibile" : ratio <= 1 ? "Sforzo intenso" : "Saturazione";
  const cells = 12;
  const lit = Math.min(cells, Math.round(Math.min(1.4, ratio) / 1.4 * cells));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12px] text-[var(--ink-secondary)]">{label}</p>
        <p className="font-mono text-[11px] tabular-nums text-[var(--ink-primary)]">+{formatIntIt(total)}</p>
      </div>
      <svg viewBox="0 0 120 14" className="mt-1 h-3.5 w-full" role="img" aria-label={`${label}: ${words}`}>
        {Array.from({ length: cells }, (_, index) => (
          <rect key={index} x={index * 10} y="2" width="7" height="10" rx="1" fill={index < lit ? tone : "var(--surface-2)"} stroke="var(--border-subtle)" />
        ))}
      </svg>
      <p className="font-mono text-[10px] tabular-nums text-[var(--ink-muted)]">
        +{formatIntIt(need)}/mese su +{formatIntIt(cap)} · {words}
      </p>
    </div>
  );
}

export function basinTotals(result: StrategicBackcastResult): Record<BasinId, number> {
  const totals: Record<BasinId, number> = {
    delusi_coalizione: 0,
    astensione_recuperabile: 0,
    voto_tematico_ponte: 0,
    radicamento_civico_eletti: 0,
  };
  for (const region of result.regions) {
    for (const key of BASIN_ORDER) totals[key] += region.basins[key];
  }
  return totals;
}

/** Riproporziona i bacini sul delta totale Oggi→Target (include quota inerziale V4). */
export function basinTotalsForDisplay(
  result: StrategicBackcastResult,
  totalVotes: number,
): Record<BasinId, number> {
  const raw = basinTotals(result);
  const rawSum = BASIN_ORDER.reduce((acc, key) => acc + raw[key], 0);
  if (totalVotes <= 0) return raw;
  if (rawSum <= 0) {
    const each = totalVotes / BASIN_ORDER.length;
    return {
      delusi_coalizione: each,
      astensione_recuperabile: each,
      voto_tematico_ponte: each,
      radicamento_civico_eletti: each,
    };
  }
  const out: Record<BasinId, number> = {
    delusi_coalizione: 0,
    astensione_recuperabile: 0,
    voto_tematico_ponte: 0,
    radicamento_civico_eletti: 0,
  };
  let allocated = 0;
  for (let index = 0; index < BASIN_ORDER.length; index += 1) {
    const key = BASIN_ORDER[index]!;
    if (index === BASIN_ORDER.length - 1) {
      out[key] = Math.max(0, Math.round(totalVotes - allocated));
    } else {
      const slice = Math.round((raw[key] / rawSum) * totalVotes);
      out[key] = slice;
      allocated += slice;
    }
  }
  return out;
}

