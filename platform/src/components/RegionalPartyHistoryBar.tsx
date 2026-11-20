"use client";

import type { RegionalPartyHistory } from "@/lib/fnProgramAndAffinityEngine";
import {
  cdxSharePct,
  leftBlockPct,
} from "@/lib/fnProgramAndAffinityEngine";
import { formatDecimalIt } from "@/lib/formatIt";

const SEGMENTS = [
  { key: "fdiPct" as const, label: "FdI", color: "bg-sky-700" },
  { key: "legaPct" as const, label: "Lega", color: "bg-cyan-500" },
  { key: "fiPct" as const, label: "FI", color: "bg-sky-400" },
  { key: "pdPct" as const, label: "PD", color: "bg-rose-600" },
  { key: "m5sPct" as const, label: "M5S", color: "bg-amber-400" },
] as const;

export function RegionalPartyHistoryBar({
  history,
  compact,
}: {
  history: RegionalPartyHistory;
  compact?: boolean;
}) {
  const cdx = cdxSharePct(history);
  const left = leftBlockPct(history);
  const perm = history.permeabilitaVannacciScore;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
        {SEGMENTS.map((s) => (
          <div
            key={s.key}
            className={`${s.color} h-full`}
            style={{ width: `${history[s.key]}%` }}
            title={`${s.label} ${formatDecimalIt(history[s.key], 1)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] text-slate-400">
        {SEGMENTS.map((s) => (
          <span key={s.key}>
            <span className={`inline-block h-2 w-2 rounded-sm ${s.color} mr-1 align-middle`} />
            {s.label}{" "}
            <span className="text-slate-200">{formatDecimalIt(history[s.key], 1)}%</span>
          </span>
        ))}
      </div>
      {!compact && (
        <div className="grid gap-2 rounded-lg border border-white/10 bg-black/30 p-3 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[8px] uppercase text-slate-500">
              Indice affinità / Permeabilità FN
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-white">
              {perm}{" "}
              <span className="text-sm font-normal text-slate-400">/ 100</span>
            </p>
            <p className="mt-1 text-[10px] text-slate-400">{history.permeabilitaLabel}</p>
          </div>
          <div className="text-[10px] leading-relaxed text-slate-400">
            <p>
              <span className="text-emerald-300">Bacino aggredibile (Lega+FdI+FI):</span>{" "}
              {formatDecimalIt(cdx, 1)}%
            </p>
            <p className="mt-1">
              <span className="text-rose-300">Muro ideologico (PD+CSX):</span>{" "}
              {formatDecimalIt(left, 1)}%
            </p>
            <p className="mt-2 font-mono text-[9px] text-slate-500">
              {history.bloccoPrevalente}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
