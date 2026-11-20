"use client";

import type { Region } from "@/lib/engine/constants";
import {
  COCKPIT_MENU_CARD,
  COCKPIT_NAZIONALE_CARD,
  cockpitTierForRegion,
  regionsForCockpitFilter,
  sortRegionsByTierThenVotes,
  type CockpitTierFilter,
} from "@/lib/osservatorioCockpitTiers";
import { regionShortLabel } from "@/components/osservatorio/OsservatorioRegionsMenu";
import { formatDecimalIt } from "@/lib/formatIt";
import { cdxSharePct, getRegionalPartyHistory } from "@/lib/fnProgramAndAffinityEngine";
import type { ScenarioResult } from "@/lib/engine/types";
import { TERRITORY_NAZIONALE, type TerritoryScope } from "@/lib/engine/osservatorioTerritoryScope";
import { TricolorMark } from "@/components/ui/TelemetryUi";
import type { RegionCockpitMetrics } from "@/lib/osservatorioCockpitTiers";
import { useMemo } from "react";

export function OsservatorioCockpitSidebar({
  regione,
  mainTerritory,
  liveS,
  scenario: _scenario,
  tierFilter,
  setTierFilter,
  metricsByRegion,
  activeRegionMetrics,
  onSelectRegion,
  onSelectNazionale,
  panelClassName,
  flatRegionSelection,
}: {
  regione: Region;
  mainTerritory: TerritoryScope;
  liveS: number;
  scenario: ScenarioResult;
  tierFilter: CockpitTierFilter;
  setTierFilter: (f: CockpitTierFilter) => void;
  metricsByRegion: Map<Region, RegionCockpitMetrics>;
  activeRegionMetrics: RegionCockpitMetrics;
  onSelectRegion: (r: Region) => void;
  onSelectNazionale: () => void;
  /** Es. xl:h-[465px] per allineamento tab Google Trends */
  panelClassName?: string;
  /** Bordo piatto senza ombre esterne (tab Google Trends). */
  flatRegionSelection?: boolean;
}) {
  void _scenario;
  const nazToday = liveS * 100;

  const sortedRegions = useMemo(() => {
    const pool = regionsForCockpitFilter(tierFilter);
    const scores = new Map<Region, number>();
    for (const r of pool) {
      scores.set(r, metricsByRegion.get(r)?.conversionScore ?? 0);
    }
    return sortRegionsByTierThenVotes(pool, scores);
  }, [tierFilter, metricsByRegion]);

  const nazSelected = mainTerritory === TERRITORY_NAZIONALE;

  const flatSelectedByTier = {
    verde: "border-emerald-400/80 bg-emerald-500/[0.10] text-emerald-100",
    giallo: "border-yellow-400/80 bg-yellow-500/[0.10] text-yellow-100",
    rosso: "border-rose-400/80 bg-rose-500/[0.10] text-rose-100",
  } as const;

  const filters: { id: CockpitTierFilter; label: string }[] = [
    { id: "all", label: "Tutte (20)" },
    { id: "verde", label: "Vai (8)" },
    { id: "giallo", label: "Media (7)" },
    { id: "rosso", label: "No PD (5)" },
  ];

  return (
    <div className={`relative w-full ${panelClassName ?? ""}`}>
      <aside
        className={`flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080C14] p-3.5 ${
          panelClassName ? "h-full" : "sticky top-[4.5rem] max-h-[min(680px,calc(100vh-10rem))] shadow-2xl"
        }`}
      >
        <div className="mb-2 shrink-0">
          <button
            type="button"
            onClick={onSelectNazionale}
            className={`relative w-full rounded-xl border p-2.5 text-left text-[11px] font-medium transition-all duration-150 lg:p-3 ${
              nazSelected
                ? flatRegionSelection
                  ? "border-emerald-400/80 bg-emerald-500/[0.10] text-emerald-100"
                  : COCKPIT_NAZIONALE_CARD.selected
                : COCKPIT_NAZIONALE_CARD.idle
            }`}
          >
            {nazSelected ? (
              <span
                className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${COCKPIT_NAZIONALE_CARD.accentBarClass}`}
                aria-hidden
              />
            ) : null}
            <span className="relative inline-flex items-center gap-2 pl-0.5">
              <TricolorMark className="h-3 shrink-0 [&>span]:h-3 [&>span]:w-[5px]" />
              Tutta l&apos;Italia · Quadro Nazionale ({formatDecimalIt(nazToday, 2)}%)
            </span>
          </button>

          <div className="my-2.5 grid grid-cols-4 gap-1">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTierFilter(f.id)}
                className={`rounded-lg border px-1 py-1.5 text-[9px] font-medium leading-tight ${
                  tierFilter === f.id
                    ? "border-white/20 bg-white/12 text-white"
                    : "border-transparent text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {sortedRegions.map((r) => {
            const tier = cockpitTierForRegion(r);
            const styles = COCKPIT_MENU_CARD[tier];
            const isSelected = mainTerritory !== TERRITORY_NAZIONALE && regione === r;
            const m = isSelected ? activeRegionMetrics : metricsByRegion.get(r);
            const hist = getRegionalPartyHistory(r);
            const cdx = Math.round(cdxSharePct(hist));
            const pd = Math.round(hist.pdPct);
            const isMuro = tier === "rosso";
            const conversion = m?.conversionScore ?? hist.permeabilitaVannacciScore;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onSelectRegion(r)}
                className={`relative w-full rounded-xl border p-2.5 text-left transition-all duration-150 lg:py-2.5 lg:pl-3 lg:pr-2.5 ${
                  isSelected
                    ? flatRegionSelection
                      ? flatSelectedByTier[tier]
                      : styles.selected
                    : styles.idle
                }`}
              >
                {isSelected ? (
                  <span
                    className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${styles.accentBarClass}`}
                    aria-hidden
                  />
                ) : null}
                <div className="relative flex items-center justify-between gap-2 pl-0.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={`inline-block h-2 w-2 shrink-0 rounded-full ${styles.tierDotClass}`}
                      aria-hidden
                    />
                    <span className="truncate text-sm font-semibold text-white">
                      {regionShortLabel(r)}
                    </span>
                  </span>
                  {isMuro ? (
                    <span className="shrink-0 rounded border border-rose-500/30 bg-rose-500/15 px-1.5 py-0.5 font-mono text-[9px] text-rose-300">
                      Muro PD
                    </span>
                  ) : (
                    <span className="shrink-0 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-300">
                      Affinità {conversion}/100
                    </span>
                  )}
                </div>
                <div className="relative mt-1 flex items-center justify-between gap-2 pl-0.5 font-mono text-[10px] text-slate-200">
                  <span className="text-slate-300">
                    Consenso FN: {formatDecimalIt(m?.currentPct ?? 0, 2)}%
                  </span>
                  <span className="tabular-nums text-slate-200">
                    <span className="text-sky-300">CDX {cdx}%</span>
                    <span className="text-slate-500"> vs </span>
                    <span className="text-rose-300">PD {pd}%</span>
                  </span>
                </div>
                <div
                  className="relative mt-1.5 ml-0.5 flex h-0.5 overflow-hidden rounded-full bg-white/[0.06]"
                  aria-hidden
                >
                  {(() => {
                    const total = Math.max(1, cdx + pd);
                    const cdxW = (cdx / total) * 100;
                    const pdW = (pd / total) * 100;
                    return (
                      <>
                        <span
                          className="h-full bg-gradient-to-r from-sky-400 to-emerald-400"
                          style={{ width: `${cdxW}%` }}
                        />
                        <span
                          className="h-full bg-rose-500/90"
                          style={{ width: `${pdW}%` }}
                        />
                      </>
                    );
                  })()}
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
