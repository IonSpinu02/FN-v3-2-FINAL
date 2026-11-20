"use client";

import type { ReactNode } from "react";
import type {
  ForecastBacktestV4,
  ForecastFactorRow,
  ForecastHorizonResult,
  ForecastNetworkDelta,
  ForecastScenarioId,
  ForecastScenarioResult,
} from "@/lib/engine/forecastEngineV4";
import { niceScale } from "@/lib/chartGeometry";
import { formatDecimalIt, formatIntIt, formatPpSignedIt, formatPuntiSignedIt } from "@/lib/formatIt";
import { useMeasuredWidth } from "@/lib/useMeasuredWidth";

const PROVENANCE_META: Record<
  ForecastFactorRow["provenance"],
  { label: string; className: string }
> = {
  dati: {
    label: "dato",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  },
  misto: {
    label: "dato + ipotesi",
    className: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
  },
  ipotesi: {
    label: "ipotesi",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  },
};

/** «tra 30 giorni», «a maggio 2027»: l'orizzonte detto come in una frase. */
export function horizonPhraseIt(horizon: Pick<ForecastHorizonResult, "key" | "days">): string {
  if (horizon.key === "d180") return "a maggio 2027";
  return `tra ${horizon.days} giorni`;
}

const DETAILS_SUMMARY =
  "cursor-pointer list-none font-mono text-[9px] uppercase tracking-wide text-slate-500 hover:text-slate-300 [&::-webkit-details-marker]:hidden";

function toneText(v: number): string {
  if (v > 0.005) return "text-emerald-300";
  if (v < -0.005) return "text-rose-300";
  return "text-slate-400";
}

function pct2(n: number): string {
  return `${formatDecimalIt(n, 2)}%`;
}

function signed2(n: number): string {
  return formatPpSignedIt(n, 2).replace(" pp", "");
}

/** Etichette lunghe («Delusi FdI-Lega») vanno su due righe per non invadere la colonna accanto. */
function BarLabel({ x, y, fill, label }: { x: number; y: number; fill: string; label: string }) {
  const lines = label.length > 10 && label.includes(" ") ? label.split(" ") : [label];
  return (
    <text x={x} y={y - (lines.length - 1) * 10} textAnchor="middle" fill={fill} fontSize="9" fontFamily="ui-monospace, monospace">
      {lines.map((line, i) => (
        <tspan key={line} x={x} dy={i === 0 ? 0 : 10}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** Barre a cascata: da «Oggi» al risultato, un gradino per voce. */
export function ForecastWaterfallChart({ horizon }: { horizon: ForecastHorizonResult }) {
  const { ref, width: w } = useMeasuredWidth(600);
  const h = 200;
  const padL = 44;
  const padR = 8;
  const padT = 20;
  const padB = 38;
  const plotW = Math.max(1, w - padL - padR);
  const plotH = h - padT - padB;

  const steps: { label: string; from: number; to: number; kind: "total" | "factor" }[] = [];
  steps.push({ label: "Oggi", from: horizon.startPct, to: horizon.startPct, kind: "total" });
  let level = horizon.startPct;
  for (const f of horizon.factors) {
    steps.push({ label: f.short, from: level, to: level + f.pp, kind: "factor" });
    level += f.pp;
  }
  steps.push({ label: "Previsione", from: horizon.centralPct, to: horizon.centralPct, kind: "total" });

  const scale = niceScale(
    steps.flatMap((s) => [s.from, s.to]),
    0.2,
  );
  const yOf = (v: number) =>
    padT + plotH - ((v - scale.min) / (scale.max - scale.min || 1)) * plotH;
  const colW = plotW / steps.length;
  const barW = Math.min(56, colW * 0.6);

  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="block h-[200px] w-full"
        role="img"
        aria-label={`Cascata da ${pct2(horizon.startPct)} a ${pct2(horizon.centralPct)}`}
      >
        {scale.ticks.map((t) => (
          <g key={t.toFixed(3)}>
            <line x1={padL} x2={w - padR} y1={yOf(t)} y2={yOf(t)} stroke="#1e293b" strokeDasharray="3 3" />
            <text
              x={padL - 6}
              y={yOf(t) + 3}
              textAnchor="end"
              fill="#64748b"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
            >
              {formatDecimalIt(t, scale.decimals)}%
            </text>
          </g>
        ))}
        {steps.map((s, i) => {
          const cx = padL + colW * i + colW / 2;
          const x = cx - barW / 2;
          if (s.kind === "total") {
            const top = yOf(s.to);
            return (
              <g key={`s-${i}`}>
                <rect
                  x={x}
                  y={top}
                  width={barW}
                  height={Math.max(2, padT + plotH - top)}
                  rx={3}
                  fill={i === 0 ? "#334155" : "#0891b2"}
                  opacity={0.9}
                />
                <text
                  x={cx}
                  y={top - 6}
                  textAnchor="middle"
                  fill="#f1f5f9"
                  fontSize="10.5"
                  fontWeight="700"
                  fontFamily="ui-monospace, monospace"
                >
                  {formatDecimalIt(s.to, 2)}
                </text>
                <BarLabel x={cx} y={h - 16} fill="#e2e8f0" label={s.label} />
              </g>
            );
          }
          const delta = s.to - s.from;
          const y1 = yOf(Math.max(s.from, s.to));
          const y2 = yOf(Math.min(s.from, s.to));
          const color = delta > 0.0001 ? "#34d399" : delta < -0.0001 ? "#fb7185" : "#64748b";
          const next = steps[i + 1];
          return (
            <g key={`s-${i}`}>
              <rect x={x} y={y1} width={barW} height={Math.max(1.5, y2 - y1)} rx={2} fill={color} opacity={0.85} />
              {next ? (
                <line
                  x1={x + barW}
                  x2={padL + colW * (i + 1) + colW / 2 - barW / 2}
                  y1={yOf(s.to)}
                  y2={yOf(s.to)}
                  stroke="#475569"
                  strokeDasharray="2 2"
                />
              ) : null}
              <text
                x={cx}
                y={delta >= 0 ? y1 - 5 : y2 + 12}
                textAnchor="middle"
                fill={color}
                fontSize="10"
                fontWeight="600"
                fontFamily="ui-monospace, monospace"
              >
                {signed2(delta)}
              </text>
              <BarLabel x={cx} y={h - 16} fill="#94a3b8" label={s.label} />
              <text x={cx} y={h - 4} textAnchor="middle" fill="#475569" fontSize="8" fontFamily="ui-monospace, monospace">
                {i}
              </text>
            </g>
          );
        })}
        <line
          x1={padL}
          x2={padL + colW}
          y1={yOf(horizon.startPct)}
          y2={yOf(horizon.startPct)}
          stroke="#475569"
          strokeDasharray="2 2"
        />
      </svg>
    </div>
  );
}

function TechnicalNote({ children }: { children: ReactNode }) {
  return (
    <details className="group mt-1">
      <summary className={DETAILS_SUMMARY}>
        <span className="group-open:hidden">+ Come è calcolato</span>
        <span className="hidden group-open:inline">− Come è calcolato</span>
      </summary>
      <div className="mt-0.5 space-y-0.5 text-[10px] leading-snug text-slate-500">{children}</div>
    </details>
  );
}

/** Voce per voce: prima in parole semplici, poi (a richiesta) il conto. */
export function ForecastFactorTable({ horizon }: { horizon: ForecastHorizonResult }) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
      {horizon.factors.map((f) => (
        <article
          key={f.id}
          className="flex flex-col rounded-lg border border-[#1B2436] bg-[#0B111E] px-3 py-2.5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="min-w-0 text-[12px] font-semibold leading-snug text-slate-100">
              {f.n}. {f.label}
            </h4>
            <span className={`shrink-0 font-mono text-[12px] font-bold tabular-nums ${toneText(f.pp)}`}>
              {formatPuntiSignedIt(f.pp, 2)}
            </span>
          </div>
          <span
            className={`mt-1 self-start rounded border px-1 py-px font-mono text-[8px] ${PROVENANCE_META[f.provenance].className}`}
          >
            {PROVENANCE_META[f.provenance].label}
          </span>
          <p className="mt-1.5 text-[11.5px] leading-snug text-slate-300">{f.plain}</p>
          <div className="mt-auto pt-1">
            <TechnicalNote>
              <p>{f.note}</p>
              {f.sources.length > 0 ? (
                <p className="font-mono text-[9px]">
                  Fonti:{" "}
                  {f.sources.map((s, i) => (
                    <span key={s.label}>
                      {i > 0 ? " · " : ""}
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-cyan-400/80 hover:text-cyan-300">
                          {s.label}
                        </a>
                      ) : (
                        s.label
                      )}
                    </span>
                  ))}
                </p>
              ) : null}
            </TechnicalNote>
          </div>
        </article>
      ))}
      <article className="flex flex-col justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-3 py-2.5">
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-200/90">
          Previsione · {horizon.label}
        </p>
        <p className="mt-1 font-mono text-[22px] font-bold leading-none tabular-nums text-cyan-50">
          {pct2(horizon.centralPct)}
        </p>
        <p className="mt-1.5 text-[11.5px] leading-snug text-slate-300">
          Oggi {pct2(horizon.startPct)}; le voci sommate fanno{" "}
          {formatPuntiSignedIt(horizon.deltaPp, 2)}.
        </p>
      </article>
    </div>
  );
}

/** Versione compatta per il riquadro 02: barre piccole e valori, niente note. */
export function ForecastCompactWaterfall({ horizon }: { horizon: ForecastHorizonResult }) {
  const scale = Math.max(0.1, ...horizon.factors.map((f) => Math.abs(f.pp)));
  return (
    <div className="mt-2 space-y-0.5">
      <p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
        Come si calcola il numero
      </p>
      <div className="flex items-baseline justify-between font-mono text-[10px]">
        <span className="text-slate-400">Oggi</span>
        <span className="tabular-nums text-slate-100">{pct2(horizon.startPct)}</span>
      </div>
      {horizon.factors.map((f) => (
        <div
          key={f.id}
          className="grid grid-cols-[minmax(0,1fr)_3.2rem_3.3rem] items-center gap-1.5 font-mono text-[10px]"
          title={f.plain}
        >
          <span className="truncate text-slate-400">
            {f.n}. {f.short}
          </span>
          <span className="relative h-1 rounded bg-slate-800">
            <span
              className={`absolute top-0 h-1 rounded ${f.pp >= 0 ? "bg-emerald-400" : "bg-rose-400"}`}
              style={
                f.pp >= 0
                  ? { left: "50%", width: `${(Math.abs(f.pp) / scale) * 50}%` }
                  : { right: "50%", width: `${(Math.abs(f.pp) / scale) * 50}%` }
              }
            />
          </span>
          <span className={`text-right tabular-nums ${toneText(f.pp)}`}>
            {signed2(f.pp)}
          </span>
        </div>
      ))}
      <div className="flex items-baseline justify-between border-t border-[#1B2436] pt-0.5 font-mono text-[10px]">
        <span className="text-slate-300">Previsione</span>
        <span className="tabular-nums font-semibold text-white">{pct2(horizon.centralPct)}</span>
      </div>
    </div>
  );
}

const SCENARIO_STYLE: Record<ForecastScenarioId, { card: string; accent: string }> = {
  passivo: { card: "border-slate-600/40 bg-[#0B111E]", accent: "text-slate-200" },
  base: { card: "border-cyan-500/50 bg-cyan-950/20", accent: "text-cyan-100" },
  offensiva: { card: "border-emerald-500/40 bg-[#0B111E]", accent: "text-emerald-200" },
};

export type VerdeGainRow = { regione: string; extraVotes: number; centralPct: number };

export function ForecastScenarioCards({
  scenarios,
  horizonIndex,
  verdeGains,
}: {
  scenarios: ForecastScenarioResult[];
  horizonIndex: number;
  verdeGains?: VerdeGainRow[];
}) {
  const base = scenarios.find((s) => s.id === "base")?.horizons[horizonIndex];
  return (
    <div
      className={`grid grid-cols-1 gap-2 ${
        scenarios.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"
      }`}
    >
      {scenarios.map((sc) => {
        const h = sc.horizons[horizonIndex];
        if (!h) return null;
        const style = SCENARIO_STYLE[sc.id];
        const vsBase = base ? h.deltaPp - base.deltaPp : 0;
        const changes =
          base && sc.id !== "base"
            ? h.factors.flatMap((f) => {
                const diff = f.pp - (base.factors.find((x) => x.id === f.id)?.pp ?? 0);
                return Math.abs(diff) >= 0.005 ? [{ id: f.id, short: f.short, pp: diff }] : [];
              })
            : [];
        return (
          <article key={sc.id} className={`flex flex-col rounded-xl border p-3 ${style.card}`}>
            <p className={`font-mono text-[10px] font-semibold uppercase tracking-wide ${style.accent}`}>
              {sc.label}
            </p>
            <p className="mt-2 font-mono text-[26px] font-bold leading-none tabular-nums text-white">
              {pct2(h.centralPct)}
              <span className={`ml-2 text-[12px] font-semibold ${toneText(h.deltaPp)}`}>
                {formatPuntiSignedIt(h.deltaPp, 2)}
              </span>
            </p>
            <p
              className={`mt-1 font-mono text-[10px] tabular-nums ${
                sc.id === "base" ? "text-cyan-200/80" : toneText(vsBase)
              }`}
            >
              {sc.id === "base"
                ? "È la previsione di questa pagina"
                : `${formatPuntiSignedIt(vsBase, 2)} rispetto alla previsione`}
            </p>
            <p className="mt-2 text-[11.5px] leading-snug text-slate-300">{sc.tagline}</p>
            {changes.length > 0 ? (
              <p className="mt-2 text-[11px] leading-snug text-slate-400">
                <span className="text-slate-500">Cosa cambia: </span>
                {changes.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 ? " · " : ""}
                    {c.short}{" "}
                    <span className={`font-mono tabular-nums ${toneText(c.pp)}`}>{signed2(c.pp)}</span>
                  </span>
                ))}
              </p>
            ) : null}
            {sc.id === "offensiva" && verdeGains && verdeGains.length > 0 ? (
              <div className="mt-2 border-t border-[#1B2436] pt-2">
                <p className="font-mono text-[9px] uppercase tracking-wide text-emerald-300/90">
                  Dove rende di più · Regioni Verdi
                </p>
                <ul className="mt-1 space-y-0.5">
                  {verdeGains.slice(0, 4).map((g) => (
                    <li key={g.regione} className="flex justify-between gap-2 font-mono text-[10.5px]">
                      <span className="text-slate-300">{g.regione}</span>
                      <span className="tabular-nums text-emerald-300">
                        +{formatIntIt(g.extraVotes)} voti · {pct2(g.centralPct)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function Stepper({
  label,
  value,
  base,
  step,
  onChange,
}: {
  label: string;
  value: number;
  base: number;
  step: number;
  onChange: (next: number) => void;
}) {
  const total = base + value;
  return (
    <div className="forecast-network-stepper flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="font-mono text-[12px] font-semibold tabular-nums text-white">
          {formatIntIt(total)}
          {value !== 0 ? (
            <span className={`ml-1 text-[10px] ${value > 0 ? "text-emerald-300" : "text-rose-300"}`}>
              ({value > 0 ? "+" : "−"}
              {formatIntIt(Math.abs(value))})
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(-base + step, value - step))}
          className="rounded border border-[#1B2436] bg-[#070b12] px-2 py-0.5 font-mono text-[11px] text-slate-200 hover:border-rose-500/40"
          aria-label={`Riduci ${label}`}
        >
          −{formatIntIt(step)}
        </button>
        <button
          type="button"
          onClick={() => onChange(value + step)}
          className="rounded border border-[#1B2436] bg-[#070b12] px-2 py-0.5 font-mono text-[11px] text-slate-200 hover:border-emerald-500/40"
          aria-label={`Aumenta ${label}`}
        >
          +{formatIntIt(step)}
        </button>
        <button
          type="button"
          onClick={() => onChange(0)}
          disabled={value === 0}
          className="rounded border border-[#1B2436] bg-[#070b12] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-400 hover:text-white disabled:opacity-40"
          aria-label={`Reset ${label}`}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/** What-if della rete: comitati e tesserati ricalcolano la previsione in tempo reale. */
export function ForecastNetworkWhatIf({
  value,
  onChange,
  baseTesserati,
  baseComitati,
  groundPp,
  simulatedProfiles,
  stacked = false,
  capacityNotes,
}: {
  value: ForecastNetworkDelta;
  onChange: (next: ForecastNetworkDelta) => void;
  baseTesserati: number;
  baseComitati: number;
  groundPp: number;
  simulatedProfiles: number;
  stacked?: boolean;
  capacityNotes?: Array<{ label: string; feasible: boolean }>;
}) {
  return (
    <div
      className={
        stacked
          ? "forecast-network-whatif is-stacked flex flex-col gap-3"
          : "forecast-network-whatif flex flex-wrap items-center gap-x-6 gap-y-2"
      }
    >
      {!stacked ? (
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400">
            Prova: più comitati, più tesserati
          </p>
          <p className="text-[11px] leading-snug text-slate-500">Tutta la pagina si ricalcola.</p>
        </div>
      ) : null}
      <Stepper
        label="Comitati"
        value={value.comitati}
        base={baseComitati}
        step={50}
        onChange={(comitati) => onChange({ ...value, comitati })}
      />
      <Stepper
        label="Tesserati"
        value={value.tesserati}
        base={baseTesserati}
        step={5000}
        onChange={(tesserati) => onChange({ ...value, tesserati })}
      />
      <p className="min-w-[14rem] flex-1 text-[11px] leading-snug text-slate-400">
        Lavoro dei tesserati in questo periodo:{" "}
        <span className={`font-mono tabular-nums ${toneText(groundPp)}`}>
          {formatPuntiSignedIt(groundPp, 2)}
        </span>
        .{" "}
        <span className="text-slate-500">
          {simulatedProfiles > 0
            ? `I ${simulatedProfiles} ingressi provati con «+ Simula» contano in «Eletti e nuovi ingressi».`
            : "Gli ingressi provati con «+ Simula» nella Rassegna stampa contano in «Eletti e nuovi ingressi»."}
        </span>
      </p>
      {capacityNotes && capacityNotes.length > 0 ? (
        <ul className="flex w-full flex-wrap gap-1.5" aria-label="Capacità fisica della rete">
          {capacityNotes.map((note) => (
            <li
              key={note.label}
              className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                note.feasible
                  ? "border-emerald-500/30 text-emerald-200 light:text-emerald-800"
                  : "border-amber-400/40 text-amber-200 light:text-amber-800"
              }`}
            >
              {note.label} {note.feasible ? "assorbibile" : "oltre capacità"}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** «Quanto fidarsi»: la prova sul passato detta in parole semplici. */
export function ForecastBacktestBadge({ backtest }: { backtest: ForecastBacktestV4 }) {
  if (backtest.n === 0) {
    return (
      <p className="text-[11.5px] leading-snug text-slate-400">
        Prova sul passato: non ci sono ancora abbastanza rilevazioni per farla.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/15 px-3.5 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-300">
        Quanto fidarsi
      </p>
      <p className="mt-1 text-[12px] leading-snug text-slate-300">
        Su {backtest.n} verifiche storiche a 30 giorni da luglio (fase di assestamento post-lancio),
        lo scostamento medio rispetto ai sondaggi è stato di {formatDecimalIt(backtest.maeV4, 2)} punti
        (contro {formatDecimalIt(backtest.maeFlat, 2)} punti dell&apos;ipotesi statica e{" "}
        {formatDecimalIt(backtest.maeSlope, 2)} punti dei soli sondaggi). A 30 giorni il rumore
        campionario dei singoli sondaggi prevale; il contributo direzionale delle leve politiche
        (temi, territorio, calendario) è progettato per guidare la traiettoria sugli orizzonti
        strategici a 90 e 180 giorni.
      </p>
    </div>
  );
}
