"use client";

import { fnSupermediaChartMeta } from "@/lib/fnSupermediaConsensoSeries";
import { formatDecimalIt } from "@/lib/formatIt";

function monthShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("it-IT", { month: "short", day: "numeric" });
}

export function RassegnaStampaConsensoChart() {
  const { series, sourceLabel, sourceUrl, deltaPp, latestPct, firstPct } =
    fnSupermediaChartMeta();

  const w = 920;
  const h = 240;
  const padL = 44;
  const padR = 16;
  const padT = 28;
  const padB = 36;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const yMin = Math.max(0, Math.min(...series.map((p) => p.pct)) - 0.8);
  const yMax = Math.max(...series.map((p) => p.pct)) + 0.6;
  const ySpan = yMax - yMin || 1;

  const sx = (i: number) =>
    padL + (series.length <= 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
  const sy = (pct: number) => padT + plotH - ((pct - yMin) / ySpan) * plotH;

  const line = series.map((p, i) => `${sx(i)},${sy(p.pct)}`).join(" ");
  const area = [
    ...series.map((p, i) => `${sx(i)},${sy(p.pct)}`),
    `${sx(series.length - 1)},${padT + plotH}`,
    `${sx(0)},${padT + plotH}`,
  ].join(" ");

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round((yMin + (ySpan * i) / (yTicks - 1)) * 10) / 10,
  );

  return (
    <section
      className="mt-2 rounded-2xl border border-white/[0.08] bg-[#090D16] p-4 lg:p-5"
      aria-label="Andamento consenso Futuro Nazionale"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Andamento partito · dati reali
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">
            Futuro Nazionale — Supermedia intenzioni di voto
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
            Media ponderata settimanale degli istituti (YouTrend/AGI). Non è output del motore
            scenario: riflette sondaggi nazionali pubblicati.
          </p>
        </div>
        <div className="text-right font-mono text-xs tabular-nums">
          <p className="text-2xl font-bold text-emerald-400">
            {formatDecimalIt(latestPct, 1)}%
          </p>
          <p className="text-slate-500">
            da {formatDecimalIt(firstPct, 1)}% ·{" "}
            <span className={deltaPp >= 0 ? "text-emerald-300" : "text-rose-300"}>
              {deltaPp >= 0 ? "+" : ""}
              {formatDecimalIt(deltaPp, 1)} pp
            </span>
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-4 h-auto w-full"
        role="img"
        aria-label={`Grafico consenso FN da ${firstPct} a ${latestPct} per cento`}
      >
        {tickValues.map((tick) => (
          <g key={tick}>
            <line
              x1={padL}
              y1={sy(tick)}
              x2={padL + plotW}
              y2={sy(tick)}
              stroke="#1B2436"
              strokeDasharray="4 4"
            />
            <text
              x={padL - 6}
              y={sy(tick) + 3}
              textAnchor="end"
              className="fill-slate-600 font-mono text-[9px]"
            >
              {formatDecimalIt(tick, 1)}%
            </text>
          </g>
        ))}
        <polygon points={area} fill="rgba(16,185,129,0.12)" />
        <polyline
          points={line}
          fill="none"
          stroke="#10B981"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {series.map((p, i) => (
          <g key={p.isoDate}>
            <circle cx={sx(i)} cy={sy(p.pct)} r={4} fill="#10B981" stroke="#090D16" strokeWidth={1.5} />
            <title>
              {monthShort(p.isoDate)} · {formatDecimalIt(p.pct, 1)}% — {p.caption}
            </title>
            {(i === 0 || i === series.length - 1 || i % 2 === 0) && (
              <text
                x={sx(i)}
                y={h - 8}
                textAnchor="middle"
                className="fill-slate-500 font-mono text-[8px]"
              >
                {monthShort(p.isoDate)}
              </text>
            )}
          </g>
        ))}
      </svg>

      <p className="mt-2 font-mono text-[9px] text-slate-500">
        Fonte:{" "}
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400/90 underline-offset-2 hover:underline"
        >
          {sourceLabel}
        </a>
        {" · "}
        Ultimo aggiornamento serie:{" "}
        {series[series.length - 1]
          ? monthShort(series[series.length - 1]!.isoDate)
          : "—"}
      </p>
    </section>
  );
}
