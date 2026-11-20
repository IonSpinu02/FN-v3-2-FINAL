"use client";

import { bipCardSolutionLines } from "@/lib/engine/bipProblemRadar";
import type { TerritoryIssue } from "@/lib/engine/territoryIssuesTypes";
import { useState } from "react";

export function OsservatorioBipSolutionsCarousel({
  issue,
  compact,
}: {
  issue: Pick<
    TerritoryIssue,
    "categoria" | "electoralSubTheme" | "bipEmergencyId" | "bipSolutions"
  >;
  compact?: boolean;
}) {
  const slides = issue.bipSolutions?.length ? issue.bipSolutions : null;
  const total = slides?.length ?? 1;
  const [index, setIndex] = useState(0);
  const line = bipCardSolutionLines({ ...issue, slideIndex: index });

  if (total <= 1) {
    return (
      <section
        className={`shrink-0 border-t border-white/[0.06] bg-white/[0.02] ${compact ? "px-3 py-2" : "px-4 py-3 lg:px-3.5 lg:py-2.5"}`}
        aria-label="Soluzione programma B.I.P."
      >
        <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-slate-500">
          Soluzione B.I.P. · {line.capRef}
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-slate-300">{line.measures}</p>
      </section>
    );
  }

  return (
    <section
      className={`shrink-0 border-t border-white/[0.06] bg-white/[0.02] ${compact ? "px-3 py-2" : "px-4 py-3 lg:px-3.5 lg:py-2.5"}`}
      aria-label="Soluzioni B.I.P."
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-slate-500">
          Soluzioni B.I.P. · {line.index + 1}/{line.total}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Misura B.I.P. precedente"
            disabled={index <= 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400 enabled:hover:bg-white/[0.06] disabled:opacity-30"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Misura B.I.P. successiva"
            disabled={index >= total - 1}
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400 enabled:hover:bg-white/[0.06] disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-slate-500">
        {line.capRef}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-300">{line.measures}</p>
      <div className="mt-2 flex justify-center gap-1">
        {slides!.map((s, i) => (
          <button
            key={s.emergencyId}
            type="button"
            aria-label={`Vai a misura ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1 rounded-full transition-all ${
              i === index ? "w-4 bg-slate-400" : "w-1 bg-white/20"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
