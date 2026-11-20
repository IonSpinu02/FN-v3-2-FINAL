"use client";

import { RegionalGrowthMiniChart } from "@/components/RegionalGrowthMiniChart";
import type { Region } from "@/lib/engine/constants";
import { BIP_FN_PROMISES_CATALOG } from "@/lib/bipProgramCatalog";
import {
  buildRegionalCampaignSummary,
  getRegionalPartyHistory,
  validVotesFromScenarioRow,
} from "@/lib/fnProgramAndAffinityEngine";
import { formatCompactVotes } from "@/lib/formatApproximateVotes";
import { formatDecimalIt, formatIntIt, formatPpSignedIt } from "@/lib/formatIt";
import {
  scenarioRegionalHorizonCopy,
  type ScenarioRegionalV4View,
} from "@/lib/scenarioRegionalV4";

const FASCIA_CLASS: Record<
  ScenarioRegionalV4View["fasciaLabel"],
  string
> = {
  ROCCAFORTE: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  "IN CRESCITA": "text-cyan-300 border-cyan-500/40 bg-cyan-500/10",
  PRIORITÀ: "text-amber-300 border-amber-500/40 bg-amber-500/10",
};

export function RegionalGrowthMapTooltip({
  tooltipRef,
  regional,
  asOf,
  rank,
  currentVotes,
  currentShare,
}: {
  tooltipRef: React.RefObject<HTMLDivElement | null>;
  regional: ScenarioRegionalV4View;
  asOf: Date;
  rank: number;
  currentVotes: number;
  currentShare: number;
}) {
  const region = regional.regione as Region;
  const history = getRegionalPartyHistory(region);
  const validVotes = validVotesFromScenarioRow(currentVotes, currentShare);
  const campaign = buildRegionalCampaignSummary(region, regional.startPct, validVotes);
  const promise = BIP_FN_PROMISES_CATALOG.find(
    (item) => item.shortTitle === campaign.topPromiseFocus.label,
  );
  const horizon = scenarioRegionalHorizonCopy(asOf);
  const satPct = Math.round(regional.reachSaturation * 100);

  return (
    <div
      ref={tooltipRef}
      className="pointer-events-none fixed left-0 top-0 z-50 w-[310px] rounded-xl border border-emerald-500/35 bg-[#070B14]/95 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-xl will-change-transform"
      style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-white">{regional.regione}</p>
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[8px] font-bold uppercase ${FASCIA_CLASS[regional.fasciaLabel]}`}
        >
          {regional.fasciaLabel}
        </span>
        <span className="ml-auto font-mono text-[9px] text-slate-500">
          RNK #{String(rank).padStart(2, "0")}/20
        </span>
      </div>

      <p className="mt-2 font-mono text-[8px] uppercase tracking-wide text-slate-500">
        {horizon.rangeLabel}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums">
        <div>
          <p className="text-[8px] text-slate-500">{horizon.todayShort}</p>
          <p className="font-bold text-white">
            {formatDecimalIt(regional.startPct, 2)}%
          </p>
        </div>
        <span className="text-emerald-400">→</span>
        <div className="text-right">
          <p className="text-[8px] text-slate-500">{horizon.targetShort}</p>
          <p className="font-bold text-emerald-400">
            {formatDecimalIt(regional.mag27BasePct, 2)}%
          </p>
          <p className="whitespace-nowrap text-[9px] text-emerald-300">
            {formatPpSignedIt(regional.deltaPp, 2)}
          </p>
        </div>
      </div>

      <RegionalGrowthMiniChart trajectory={regional.monthlyTrajectory} />

      <p className="mt-2 font-mono text-[8px] leading-snug text-slate-400">
        {regional.primaryGrowthDriver}
      </p>
      <p className="mt-1 font-mono text-[8px] tabular-nums text-slate-500">
        Offensiva: {formatDecimalIt(regional.mag27OffensivePct, 2)}% · Tesserati:{" "}
        {formatIntIt(regional.iscritti)} · {formatCompactVotes(regional.addedVotes)} · Sat. bacino{" "}
        {satPct}%
      </p>

      <div className="mt-3 border-t border-white/10 pt-2.5">
        <p className="font-mono text-[8px] uppercase text-slate-500">Storico voto (Europee 2024)</p>
        <p className="mt-1 font-mono text-[9px] tabular-nums text-slate-300">
          FdI {formatDecimalIt(history.fdiPct, 1)}% · Lega {formatDecimalIt(history.legaPct, 1)}% · PD{" "}
          {formatDecimalIt(history.pdPct, 1)}% · M5S {formatDecimalIt(history.m5sPct, 1)}%
        </p>
        <p className="mt-1.5 font-mono text-[9px] leading-snug text-slate-400">
          {campaign.mapVerdictShort}
        </p>
        <p className="mt-1 font-mono text-[8px] leading-snug text-emerald-300/90">
          Focus: {campaign.topPromiseFocus.label}
          {promise ? ` · ${promise.bipReference}` : ""}
        </p>
      </div>
    </div>
  );
}
