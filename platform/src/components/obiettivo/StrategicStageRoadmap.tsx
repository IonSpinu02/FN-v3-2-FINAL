"use client";

import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import type { ForecastStage } from "@/lib/engine/forecastEngineV4";
import type { RoadmapStage } from "@/lib/engine/operationalRoadmapBuilder";

type ForecastProps = {
  mode: "forecast";
  stages: ForecastStage[];
  regimeLabel: string;
};

type BackcastProps = {
  mode: "backcast";
  stages: readonly RoadmapStage[];
  activeStageId?: 1 | 2 | 3 | 4;
  onSelect?: (stageId: 1 | 2 | 3 | 4) => void;
};

const BASIN_LABEL: Record<string, string> = {
  delusi_coalizione: "Delusi",
  astensione_recuperabile: "Astensione",
  voto_tematico_ponte: "Tema",
  radicamento_civico_eletti: "Eletti",
};

export function StrategicStageRoadmap(props: ForecastProps | BackcastProps) {
  if (props.mode === "backcast") return <BackcastRail {...props} />;
  return <ForecastRail {...props} />;
}

function BackcastRail({ stages, activeStageId, onSelect }: BackcastProps) {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 lg:grid-cols-4" aria-label="Checkpoint delle tappe">
      {stages.map((item) => {
        const on = activeStageId === item.stageId;
        return (
          <button
            key={item.stageId}
            type="button"
            onClick={() => onSelect?.(item.stageId)}
            className={`obj-press flex min-w-0 items-baseline justify-between gap-2 rounded-lg border px-3 py-1.5 text-left ${on ? "border-emerald-500/40 bg-emerald-500/[0.07]" : "border-[var(--border-subtle)] hover:border-[var(--border-default)]"}`}
          >
            <span className="min-w-0">
              <span className={`block font-mono text-[10px] tabular-nums ${on ? "text-[var(--signal-positive)]" : "text-[var(--ink-muted)]"}`}>
                Tappa {item.stageId} · Gg {item.fromDay}–{item.toDay}
              </span>
              <span className="block truncate text-[11px] text-[var(--ink-secondary)]">{item.label}</span>
            </span>
            <span className="shrink-0 font-mono text-[14px] font-semibold tabular-nums">{formatDecimalIt(item.targetConsensusPct, 1)}%</span>
          </button>
        );
      })}
    </div>
  );
}

function ForecastRail({ stages, regimeLabel }: ForecastProps) {
  const last = Math.max(1, stages.length - 1);
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4" aria-label="Roadmap a tappe della previsione">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)]">ROADMAP A TAPPE · {regimeLabel}</p>
        <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-200 light:text-cyan-800">
          Stima
        </span>
      </div>
      <div className="relative mt-4">
        <div className="absolute left-[8%] right-[8%] top-[11px] h-px bg-[var(--border-default)]" aria-hidden />
        <div className="absolute left-[8%] top-[11px] h-px bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: "84%" }} aria-hidden />
        <ol className="relative grid grid-cols-4 gap-1">
          {stages.map((stage, index) => (
            <li key={stage.key} className="flex flex-col items-center text-center">
              <span
                className={`block h-[22px] w-[22px] rounded-full border-2 ${
                  index === 0 ? "border-cyan-400 bg-[var(--surface-1)]" : "border-emerald-400 bg-emerald-400/80"
                }`}
                aria-hidden
              />
              <span className="mt-2 text-[10px] text-[var(--ink-muted)]">{stage.label}</span>
              <span className="font-mono text-[13px] font-semibold tabular-nums sm:text-[16px]">{formatDecimalIt(stage.centralPct, 2)}%</span>
              {stage.key !== "today" ? (
                <span className="mt-0.5 font-mono text-[9px] tabular-nums text-[var(--ink-muted)]">
                  {formatDecimalIt(stage.lo10, 2)}–{formatDecimalIt(stage.hi90, 2)}
                </span>
              ) : (
                <span className="mt-0.5 text-[9px] text-[var(--ink-muted)]">MISURATO</span>
              )}
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        {stages.filter((stage) => stage.key !== "today").map((stage) => (
          <article key={stage.key} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] tracking-[0.12em] text-[var(--signal-positive)]">{stage.label}</p>
              <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 font-mono text-[10px] text-[var(--ink-secondary)]">
                Tenuta avversa {formatDecimalIt(stage.cvar10, 2)}%
              </span>
            </div>
            <p className="mt-1 font-mono text-[18px] font-semibold tabular-nums">{formatDecimalIt(stage.centralPct, 2)}%</p>
            <p className="text-[11px] text-[var(--ink-muted)]">Forchetta {formatDecimalIt(stage.lo10, 2)}–{formatDecimalIt(stage.hi90, 2)} · stima</p>
            {stage.capacity ? (
              <p className={`mt-2 text-[11px] ${stage.capacity.feasible ? "text-[var(--signal-positive)]" : "text-amber-300 light:text-amber-800"}`}>
                {stage.capacity.feasible
                  ? "Rete assorbibile in questa tappa"
                  : `Oltre la capacità fisica${stage.capacity.committeeOver > 0 ? ` · comitati +${formatIntIt(Math.round(stage.capacity.committeeOver))}` : ""}${stage.capacity.memberOver > 0 ? ` · tesserati +${formatIntIt(Math.round(stage.capacity.memberOver))}` : ""}`}
              </p>
            ) : null}
            <ul className="mt-2 space-y-1.5">
              {stage.topRegions.map((row) => {
                const basin = Object.entries(row.basins).sort((a, b) => b[1] - a[1])[0];
                return (
                  <li key={row.regione}>
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate">{row.regione}</span>
                      <span className="font-mono tabular-nums text-[var(--signal-positive)]">+{formatIntIt(Math.round(row.addedVotes))}</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[var(--border-subtle)]">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.round(row.reachSaturation * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-[var(--ink-muted)]">
                      {basin ? `${BASIN_LABEL[basin[0]] ?? basin[0]} · ` : ""}
                      saturazione {formatDecimalIt(row.reachSaturation * 100, 0)}%
                    </p>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-[var(--ink-muted)]">
        Oggi misurato · tappe in avanti (stima). Il connettore copre {last} passaggi fino a +180 giorni. La saturazione si accumula: i voti già assegnati non vengono riassegnati.
      </p>
    </section>
  );
}
