"use client";

import type { RegionalGrowthMonthPoint } from "@/lib/politicalModel";
import { formatDecimalIt } from "@/lib/formatIt";

export function RegionalGrowthMiniChart({
  trajectory,
  width = 240,
  height = 48,
  className = "h-[48px] w-full",
}: {
  trajectory: RegionalGrowthMonthPoint[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (!trajectory.length) return null;

  const padX = 6;
  const padY = 5;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2 - 10;

  const lows = trajectory.map((p) => p.lowBandPct);
  const highs = trajectory.map((p) => p.highBandPct);
  const yMin = Math.min(...lows, trajectory[0]!.sharePct) - 0.15;
  const yMax = Math.max(...highs, trajectory.at(-1)!.sharePct) + 0.15;
  const ySpan = yMax - yMin || 1;
  const n = trajectory.length;
  const xs = trajectory.map((_, i) => padX + (i / (n - 1)) * plotW);
  const yOf = (pct: number) => padY + plotH - ((pct - yMin) / ySpan) * plotH;

  const fanPoints = [
    ...highs.map((v, i) => `${xs[i]},${yOf(v)}`),
    ...lows
      .slice()
      .reverse()
      .map((v, i) => {
        const idx = n - 1 - i;
        return `${xs[idx]},${yOf(v)}`;
      }),
  ].join(" ");

  const linePoints = trajectory.map((p, i) => `${xs[i]},${yOf(p.sharePct)}`).join(" ");
  const start = trajectory[0]!;
  const end = trajectory.at(-1)!;
  const lastIdx = n - 1;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <polygon points={fanPoints} fill="rgba(16,185,129,0.16)" />
      <polyline
        points={linePoints}
        fill="none"
        stroke="#10B981"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx={xs[0]} cy={yOf(start.sharePct)} r={2.5} fill="#10B981" />
      <circle
        cx={xs[lastIdx]}
        cy={yOf(end.sharePct)}
        r={3.5}
        fill="#10B981"
        className="animate-pulse"
      />
      <text
        x={padX}
        y={height - 1}
        className="fill-slate-500 text-[6px] font-mono"
      >
        OTT
      </text>
      <text
        x={width - padX}
        y={height - 1}
        textAnchor="end"
        className="fill-slate-500 text-[6px] font-mono"
      >
        MAG
      </text>
      <text
        x={xs[lastIdx]! - 1}
        y={yOf(end.sharePct) - 4}
        textAnchor="end"
        className="fill-emerald-400 text-[7px] font-mono"
      >
        {formatDecimalIt(end.sharePct, 2)}%
      </text>
    </svg>
  );
}
