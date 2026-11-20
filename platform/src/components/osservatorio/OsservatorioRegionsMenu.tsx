"use client";

import { REGIONS, type Region } from "@/lib/engine/constants";
import type { ScenarioResult } from "@/lib/engine/types";
import { getRegionalPartyHistory } from "@/lib/fnProgramAndAffinityEngine";
import {
  conversionTierFromScore,
  getConversionCardTheme,
  type ConversionTier,
} from "@/lib/osservatorioConversionTheme";
import { fmtPctIt } from "@/lib/osservatorioFormatIt";
import { useMemo } from "react";

export function regionShortLabel(region: Region): string {
  if (region === "Friuli-Venezia Giulia") return "Friuli-V.G.";
  return region;
}

export function OsservatorioRegionsMenu({
  regione,
  scenario,
  tierFilter,
  onSelect,
}: {
  regione: Region;
  scenario: ScenarioResult;
  tierFilter: "all" | ConversionTier;
  onSelect: (r: Region) => void;
}) {
  const stimaByRegion = useMemo(() => {
    const m = new Map<Region, number>();
    for (const row of scenario.righe) {
      m.set(row.regione, row.stima * 100);
    }
    return m;
  }, [scenario.righe]);

  const visibleRegions = useMemo(() => {
    return REGIONS.filter((r) => {
      if (tierFilter === "all") return true;
      const score = getRegionalPartyHistory(r).permeabilitaVannacciScore;
      return conversionTierFromScore(score) === tierFilter;
    });
  }, [tierFilter]);

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-[14rem] lg:self-start">
      <div className="rounded-xl border border-white/[0.08] bg-[#0A0E17] p-3">
        <p className="px-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
          Regioni · ordine ISTAT
        </p>
        <nav className="mt-2 max-h-[min(520px,55vh)] space-y-0.5 overflow-y-auto pr-0.5">
          {visibleRegions.map((r) => {
            const active = r === regione;
            const hist = getRegionalPartyHistory(r);
            const theme = getConversionCardTheme(hist.permeabilitaVannacciScore);
            const stima = stimaByRegion.get(r) ?? 0;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onSelect(r)}
                className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                  active
                    ? "border-emerald-500/45 bg-emerald-500/10 ring-1 ring-white/25"
                    : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${theme.dotColor} opacity-80`}
                  title={theme.tierLabel}
                />
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-200">
                  {regionShortLabel(r)}
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500">
                  {fmtPctIt(stima, 2)}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
