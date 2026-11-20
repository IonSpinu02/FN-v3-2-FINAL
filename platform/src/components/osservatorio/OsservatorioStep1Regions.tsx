"use client";

import { REGIONS, type Region } from "@/lib/engine/constants";
import { OsservatorioRegionsMenu, regionShortLabel } from "@/components/osservatorio/OsservatorioRegionsMenu";
import type { TerritoryScope } from "@/lib/engine/osservatorioTerritoryScope";
import {
  buildRegionalStrengthTable,
  type RegionalStrengthRow,
} from "@/lib/engine/regionalPartyStrength";
import type { ScenarioResult } from "@/lib/engine/types";
import type { RegionalGrowthForecast } from "@/lib/politicalModel";
import {
  buildRegionalCampaignSummary,
  cdxSharePct,
  getRegionalPartyHistory,
  validVotesFromScenarioRow,
} from "@/lib/fnProgramAndAffinityEngine";
import {
  formatCompactVotes,
  formatDecimalIt,
  formatIntIt,
} from "@/lib/formatIt";
import { fmtIndexIt, fmtPctIt } from "@/lib/osservatorioFormatIt";
import {
  ACTIVE_REGION_RING,
  conversionTierFromScore,
  getConversionCardTheme,
  type ConversionTier,
} from "@/lib/osservatorioConversionTheme";
import { useEffect, useMemo, useState } from "react";

const CARD =
  "rounded-2xl border border-white/[0.08] bg-[#090D16] p-6";

type RegionFilter = "all" | ConversionTier;

function formatTierSummary(
  strengthRows: RegionalStrengthRow[],
  tier: ConversionTier,
): string {
  return strengthRows
    .filter((r) => r.regione !== "NAZIONALE")
    .filter((r) => {
      const score = getRegionalPartyHistory(r.regione as Region).permeabilitaVannacciScore;
      return conversionTierFromScore(score) === tier;
    })
    .sort((a, b) => b.stimaPct - a.stimaPct)
    .map((r) => `${regionShortLabel(r.regione as Region)} (${fmtPctIt(r.stimaPct, 2)})`)
    .join(" · ");
}

function PartySplitBar({
  cdxPct,
  pdPct,
  cdxBarClass,
}: {
  cdxPct: number;
  pdPct: number;
  cdxBarClass: string;
}) {
  const total = Math.max(1, cdxPct + pdPct);
  const cdxW = (cdxPct / total) * 100;
  return (
    <div className="mt-2 flex h-[3px] overflow-hidden rounded-full bg-white/10">
      <div className={`h-full ${cdxBarClass}`} style={{ width: `${cdxW}%` }} />
      <div className="h-full bg-slate-500/50" style={{ width: `${100 - cdxW}%` }} />
    </div>
  );
}

const SUMMARY_META: Record<
  ConversionTier,
  { title: string; subtitle: string; countLabel: string }
> = {
  alta: {
    title: "Alta Conversione · Forte bacino Lega / FdI",
    subtitle: "Azione: Consolidare e mobilitare",
    countLabel: "regioni verde",
  },
  media: {
    title: "Media Conversione · Terreno contendibile & Astenuti",
    subtitle: "Azione: Problemi locali → ex Lega, FdI, astenuti",
    countLabel: "regioni giallo",
  },
  bassa: {
    title: "Bassa Conversione · Storico blocco PD / CSX",
    subtitle: "Azione: Evitare dispersione risorse",
    countLabel: "regioni rosse",
  },
};

function regionsMatchingFilter(filter: RegionFilter): Region[] {
  return REGIONS.filter((r) => {
    if (filter === "all") return true;
    const score = getRegionalPartyHistory(r).permeabilitaVannacciScore;
    return conversionTierFromScore(score) === filter;
  });
}

export function OsservatorioStep1Regions({
  scenario,
  liveS,
  regione,
  setRegione,
  setMainTerritory,
  regionalGrowthByRegion,
}: {
  scenario: ScenarioResult;
  liveS: number;
  regione: Region;
  setRegione: (r: Region) => void;
  setMainTerritory: (t: TerritoryScope) => void;
  regionalGrowthByRegion?: Record<string, RegionalGrowthForecast>;
}) {
  const [filter, setFilter] = useState<RegionFilter>("all");

  const strengthRows = useMemo(
    () => buildRegionalStrengthTable(scenario, liveS),
    [scenario, liveS],
  );

  const tierCounts = useMemo(() => {
    const counts = { alta: 0, media: 0, bassa: 0 };
    for (const r of strengthRows) {
      if (r.regione === "NAZIONALE") continue;
      const score = getRegionalPartyHistory(r.regione as Region).permeabilitaVannacciScore;
      counts[conversionTierFromScore(score)] += 1;
    }
    return counts;
  }, [strengthRows]);

  const campaignByRegion = useMemo(() => {
    const map = new Map<
      Region,
      ReturnType<typeof buildRegionalCampaignSummary>
    >();
    for (const row of scenario.righe) {
      const reg = row.regione;
      const valid = validVotesFromScenarioRow(row.voti_di_scenario, row.stima);
      map.set(
        reg,
        buildRegionalCampaignSummary(reg, row.stima * 100, valid),
      );
    }
    return map;
  }, [scenario.righe]);

  useEffect(() => {
    const allowed = regionsMatchingFilter(filter);
    if (!allowed.includes(regione) && allowed[0]) {
      setRegione(allowed[0]);
      setMainTerritory(allowed[0]);
    }
  }, [filter, regione, setRegione, setMainTerritory]);

  const summaryAlta = getConversionCardTheme(80);
  const summaryMedia = getConversionCardTheme(65);
  const summaryBassa = getConversionCardTheme(40);

  const selectRegion = (r: Region) => {
    setRegione(r);
    setMainTerritory(r);
  };

  const selectedRow = strengthRows.find((r) => r.regione === regione);
  const selectedHist = getRegionalPartyHistory(regione);
  const selectedTheme = getConversionCardTheme(selectedHist.permeabilitaVannacciScore);
  const selectedCampaign = campaignByRegion.get(regione);
  const selectedGrowth = regionalGrowthByRegion?.[regione];
  const selectedCdx = cdxSharePct(selectedHist);
  const cdx = Math.round(selectedCdx);
  const pd = Math.round(selectedHist.pdPct);
  const addedVotes = selectedCampaign?.maxCumulativeNewVotes ?? 0;

  const targetPct =
    selectedCampaign?.reachableSharePct ??
    (selectedRow ? selectedRow.stimaPct + (selectedCampaign?.maxCumulativeGainPp ?? 0) : 0);
  const targetVotes = selectedCampaign?.maxCumulativeNewVotes ?? 0;

  const filterPills: { id: RegionFilter; label: string }[] = [
    { id: "all", label: "Tutte le 20 Regioni" },
    { id: "alta", label: "Alta conversione (Verde)" },
    { id: "media", label: "Media conversione (Giallo)" },
    { id: "bassa", label: "Bassa conversione (Rosso)" },
  ];

  return (
    <section id="oss-step-1" className={`scroll-mt-28 ${CARD}`}>
      <header>
        <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400/90">
          1 // Mappa delle priorità
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
          1. Scegli la Regione da Analizzare
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Clicca su una regione nel menu a destra per vedere voti, problemi dei cittadini e quanti
          voti possiamo guadagnare. Sfondo: verde / giallo / rosso = fascia di conversione.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {filterPills.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                filter === id
                  ? "bg-white/10 text-white ring-1 ring-white/20"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="my-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {(
          [
            ["alta", summaryAlta],
            ["media", summaryMedia],
            ["bassa", summaryBassa],
          ] as const
        ).map(([tier, theme]) => {
          const meta = SUMMARY_META[tier];
          return (
            <div
              key={tier}
              className={`rounded-xl border p-4 ${theme.summaryBorder} ${theme.summaryBox}`}
            >
              <p className={`text-xs font-semibold ${theme.summaryTitle}`}>
                {meta.title} · {tierCounts[tier]} {meta.countLabel}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                {formatTierSummary(strengthRows, tier) || "—"}
              </p>
              <p
                className={`mt-3 text-[10px] font-medium uppercase tracking-wide opacity-80 ${theme.summaryTitle}`}
              >
                {meta.subtitle}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {selectedRow && selectedCampaign ? (
            <div
              className={`rounded-2xl border p-6 transition-all ${selectedTheme.cardBg} ${selectedTheme.cardBorder} ${ACTIVE_REGION_RING}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={`font-mono text-[10px] uppercase ${selectedTheme.summaryTitle}`}>
                    {selectedTheme.tierLabel} · {regione}
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold text-white">
                    {regionShortLabel(regione)}
                  </h3>
                </div>
                <span
                  className={`rounded-lg px-2.5 py-1 font-mono text-sm font-semibold ${selectedTheme.badge}`}
                >
                  +{formatCompactVotes(addedVotes)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-3 font-mono tabular-nums">
                <span className="text-4xl font-bold text-white">
                  {fmtPctIt(selectedRow.stimaPct, 2)}
                </span>
                {selectedGrowth && (
                  <span className="text-lg font-semibold text-emerald-400">
                    → {formatDecimalIt(selectedGrowth.projectedShareMay27Pct, 2)}%
                  </span>
                )}
              </div>

              <p className="mt-3 font-mono text-sm text-slate-200">
                <span className="font-semibold text-white">
                  {formatIntIt(selectedRow.voti)} voti
                </span>
                <span className="text-slate-400"> · Forza {fmtIndexIt(selectedRow.indice)}</span>
              </p>

              <p className="mt-2 font-mono text-[12px] text-slate-300">
                CDX {cdx}% (FdI {Math.round(selectedHist.fdiPct)} · Lega{" "}
                {Math.round(selectedHist.legaPct)}) vs PD {pd}%
              </p>
              <PartySplitBar
                cdxPct={cdx}
                pdPct={pd}
                cdxBarClass={selectedTheme.barColor}
              />

              <div className="mt-6 rounded-xl border border-white/[0.08] bg-black/20 p-4 text-[11px] leading-relaxed text-slate-300">
                Obiettivo con interventi FN:{" "}
                <strong className="text-white">{formatDecimalIt(targetPct, 2)}%</strong> (+
                {formatCompactVotes(targetVotes)} nuovi voti) · Storico CDX{" "}
                {selectedCdx.toFixed(1).replace(".", ",")}% vs PD{" "}
                {selectedHist.pdPct.toFixed(1).replace(".", ",")}%
              </div>

              <button
                type="button"
                onClick={() =>
                  document.getElementById("oss-step-2")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
                className="mt-5 w-full rounded-lg border border-emerald-500/40 bg-emerald-500/15 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25 sm:w-auto sm:px-6"
              >
                Analizza i Problemi e le Soluzioni per {regione} ↓
              </button>
            </div>
          ) : null}
        </div>

        <OsservatorioRegionsMenu
          regione={regione}
          scenario={scenario}
          tierFilter={filter}
          onSelect={selectRegion}
        />
      </div>
    </section>
  );
}
