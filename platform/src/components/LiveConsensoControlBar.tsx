"use client";

import type { LiveConsensoPayload } from "@/lib/engine/pollTypes";
import { formatDecimalIt } from "@/lib/formatIt";

export function LiveConsensoControlBar({
  enabled,
  onEnabledChange,
  liveConsenso,
  loading,
  compact,
}: {
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  liveConsenso: LiveConsensoPayload | null;
  loading?: boolean;
  compact?: boolean;
}) {
  const tier = liveConsenso?.reliabilityTier;
  const method = liveConsenso?.method;
  const [lo, hi] = liveConsenso?.confidenceBandPp ?? [null, null];
  const polls = liveConsenso?.pollsUsed ?? [];
  const tooltipId = "live-consenso-tooltip";

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] ${
        compact ? "p-2" : "p-2.5"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-fn-text-muted">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-emerald-500"
          />
          <span className="font-medium text-fn-text">
            Riacquisisci fonti e ricalcola il consenso (formula fissa)
          </span>
        </label>
        {loading ? (
          <span className="font-mono text-[10px] text-emerald-400/80">
            Caricamento dati in corso…
          </span>
        ) : enabled && liveConsenso?.asOf ? (
          <span className="font-mono text-[10px] text-slate-500" title="Ultimo aggiornamento">
            agg.{" "}
            {new Date(liveConsenso.asOf).toLocaleTimeString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ) : null}
        {enabled && tier && method ? (
          <>
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-emerald-300">
              {tier}
            </span>
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] uppercase text-slate-400">
              {method.replace(/_/g, " ")}
            </span>
          </>
        ) : null}
        {enabled && liveConsenso?.calendarDay ? (
          <span className="font-mono text-[10px] text-slate-500">
            {liveConsenso.calendarDay}
            {liveConsenso.dailyDeltaPp != null && liveConsenso.dailyDeltaPp !== 0 ? (
              <span
                className={
                  liveConsenso.dailyDeltaPp > 0 ? " text-emerald-400" : " text-rose-400"
                }
              >
                {" "}
                ({liveConsenso.dailyDeltaPp > 0 ? "+" : ""}
                {formatDecimalIt(liveConsenso.dailyDeltaPp, 1)} pp/gg)
              </span>
            ) : null}
          </span>
        ) : null}
        {enabled && liveConsenso ? (
          <button
            type="button"
            className="font-mono text-[10px] text-cyan-400/90 underline decoration-cyan-500/30 underline-offset-2 hover:text-cyan-300"
            aria-describedby={tooltipId}
            title={
              polls.length > 0
                ? polls
                    .map(
                      (p) =>
                        `${p.institute} ${p.fnPct}% (w=${formatDecimalIt(p.weight, 3)})`,
                    )
                    .join(" · ")
                : liveConsenso.sourceLabel
            }
          >
            {lo != null && hi != null
              ? `Banda ${formatDecimalIt(lo, 1)}–${formatDecimalIt(hi, 1)} pp`
              : "Dettaglio fonte"}
          </button>
        ) : null}
      </div>
      {enabled && liveConsenso ? (
        <p id={tooltipId} className="text-[10px] leading-snug text-fn-text-muted">
          {liveConsenso.sourceLabel}
          {polls.length > 0 ? (
            <>
              {" · "}
              {polls.length} sondaggi:{" "}
              {polls
                .slice(0, 4)
                .map((p) => `${p.institute} ${formatDecimalIt(p.fnPct, 1)}%`)
                .join(", ")}
              {polls.length > 4 ? "…" : ""}
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
