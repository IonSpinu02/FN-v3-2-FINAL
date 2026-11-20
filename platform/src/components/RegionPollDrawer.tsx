"use client";

import type { Region } from "@/lib/engine/constants";
import {
  PRIMARY_SOCIAL_ISSUE,
  buildExposurePriorityCards,
} from "@/lib/engine/exposurePriorityEngine";
import { REGION_FABBISOGNO_DISPLAY } from "@/lib/engine/fabbisogniCatalogFallback";
import { categoryStressForRegion } from "@/lib/engine/territoryIssueStress";
import {
  categoryLabel,
  type TerritoryIssueCategory,
} from "@/lib/engine/territoryIssuesTypes";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { FnConfig, ScenarioRow } from "@/lib/engine/types";
import { getBipMessaging } from "@/lib/bipProgramCatalog";
import {
  buildRegionalCampaignSummary,
  cdxSharePct,
  computeIssueConversionGain,
  getRegionalPartyHistory,
  validVotesFromScenarioRow,
} from "@/lib/fnProgramAndAffinityEngine";
import { formatDecimalIt, formatIntIt, formatPpSignedIt } from "@/lib/formatIt";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const INST_KEYS = ["dep", "creg", "sind", "com"] as const;

function urgencyTone(stress: number): string {
  if (stress >= 72) return "text-rose-300";
  if (stress >= 55) return "text-amber-300";
  return "text-cyan-300";
}

function urgencyLabel(stress: number): string {
  if (stress >= 72) return "CRITICO";
  if (stress >= 55) return "ALTO";
  return "ATTIVO";
}

function socialIssuesForRegion(region: Region): {
  label: string;
  category: TerritoryIssueCategory;
  stress: number;
}[] {
  const primary = PRIMARY_SOCIAL_ISSUE[region];
  const display = REGION_FABBISOGNO_DISPLAY[region];
  const secondCat: TerritoryIssueCategory =
    primary.category === "SANITA"
      ? "LAVORO"
      : primary.category === "SICUREZZA"
        ? "COSTO_VITA"
        : primary.category === "COSTO_VITA"
          ? "SICUREZZA"
          : primary.category === "LAVORO"
            ? "SANITA"
            : "SANITA";
  const thirdCat: TerritoryIssueCategory =
    secondCat === "LAVORO"
      ? "COSTO_VITA"
      : secondCat === "COSTO_VITA"
        ? "SANITA"
        : secondCat === "SANITA"
          ? "TRASPORTI"
          : "LAVORO";
  return [
    {
      label: primary.label,
      category: primary.category,
      stress: categoryStressForRegion(region, primary.category),
    },
    {
      label: display[0] ?? categoryLabel(secondCat),
      category: secondCat,
      stress: categoryStressForRegion(region, secondCat),
    },
    {
      label: display[1] ?? categoryLabel(thirdCat),
      category: thirdCat,
      stress: categoryStressForRegion(region, thirdCat),
    },
  ];
}

function PartyBar({
  label,
  pctValue,
  detail,
  color,
}: {
  label: string;
  pctValue: number;
  detail: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-200">{label}</p>
        <p className="font-mono text-[12px] tabular-nums text-emerald-300">
          {formatDecimalIt(pctValue, 1)}%
        </p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#162032]">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, pctValue)}%` }}
        />
      </div>
      <p className="mt-1 font-mono text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}

export function RegionPollDrawer({
  poll,
  row,
  fnConfig,
  region,
  nationalS,
  allRows,
  onClose,
  onOpenOsservatorio,
}: {
  poll: RegionPollResult;
  row: ScenarioRow;
  fnConfig: FnConfig;
  region: Region;
  nationalS: number;
  allRows: ScenarioRow[];
  onClose: () => void;
  onOpenOsservatorio: (region: Region, category: TerritoryIssueCategory) => void;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const history = getRegionalPartyHistory(region);
  const primary = PRIMARY_SOCIAL_ISSUE[region];
  const socialIssues = useMemo(() => socialIssuesForRegion(region), [region]);
  const validVotes = validVotesFromScenarioRow(row.voti_di_scenario, row.stima);
  const sharePct = poll.piHat * 100;
  const nationalPct = nationalS * 100;
  const gapPp = sharePct - nationalPct;
  const campaign = buildRegionalCampaignSummary(region, sharePct, validVotes);

  const exposure = useMemo(() => {
    const cards = buildExposurePriorityCards({
      rows: allRows.map((item) => ({
        regione: item.regione as Region,
        stima: item.stima,
        voti_di_scenario: item.voti_di_scenario,
        elettori_ricostruiti: item.elettori_ricostruiti,
      })),
    });
    return cards.find((card) => card.regione === region) ?? {
      conversionScore: history.permeabilitaVannacciScore,
      exposurePriorityScore: history.permeabilitaVannacciScore,
      primaryCategory: primary.category,
    };
  }, [allRows, region, history.permeabilitaVannacciScore, primary.category]);

  const totaleEletti = INST_KEYS.reduce(
    (sum, key) => sum + (fnConfig.presenze_istituzionali[key]?.[region] ?? 0),
    0,
  );

  const immigrationHot = /msna|migrat|balcan|sbarchi|flussi/i.test(primary.label);
  const leverCategories = useMemo(() => {
    const second =
      socialIssues.find((issue) => issue.category !== primary.category)?.category ??
      "SANITA";
    return [primary.category, second] as const;
  }, [primary.category, socialIssues]);

  const levers = leverCategories.map((category, index) => {
    const issue = socialIssues.find((item) => item.category === category) ?? socialIssues[index]!;
    const subTheme =
      immigrationHot && category === "SICUREZZA" ? ("immigrazione" as const) : null;
    const gain = computeIssueConversionGain(
      region,
      category,
      Math.max(70, issue.stress),
      validVotes,
      0.36,
      subTheme,
      { title: issue.label },
    );
    const messaging = getBipMessaging(category, subTheme);
    return {
      index: index + 1,
      category,
      issueLabel: issue.label,
      gain,
      messaging,
      badge:
        gain.conversionBadge === "ALTA"
          ? "CONVERSIONE ALTA"
          : gain.conversionBadge === "MIRATA"
            ? "CONVERSIONE MIRATA"
            : "CONVERSIONE LIMITATA",
    };
  });

  const cdx = cdxSharePct(history);
  const cdxCore = history.fdiPct + history.legaPct;

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      setCopiedKey(null);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Dossier operativo ${region}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md md:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-emerald-500/25 bg-[#070b12] text-slate-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#1B2436] px-5 py-4 md:px-6">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.16em] text-cyan-300/90">
              DOSSIER OPERATIVO REGIONALE · QUADRO TATTICO PER L&apos;ESPOSIZIONE
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-white md:text-3xl">
                {region}
              </h2>
              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] tabular-nums text-emerald-300">
                Priorità Esposizione: {exposure.exposurePriorityScore}/100
              </span>
              <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] tabular-nums text-cyan-300">
                Affinità Bacino: {exposure.conversionScore}/100
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-slate-400 hover:text-white"
          >
            Chiudi
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:none] md:p-6 [&::-webkit-scrollbar]:hidden">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-5">
              <section className="rounded-xl border border-[#1B2436] bg-[#0a1018] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
                  01 · Forza attuale & struttura reale FN
                </p>
                <p className="mt-3 font-mono text-4xl font-bold tabular-nums text-emerald-400">
                  {formatDecimalIt(sharePct, 2)}%
                </p>
                <p className="mt-1 font-mono text-[11px] text-slate-400">
                  Consenso FN stimato ·{" "}
                  <span
                    className={
                      gapPp >= 0 ? "text-emerald-300" : "text-amber-300"
                    }
                  >
                    {formatPpSignedIt(gapPp, 2)} vs media Italia
                  </span>
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#1B2436] pt-3">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
                      Tesserati FN
                    </p>
                    <p className="mt-1 font-mono text-lg tabular-nums text-slate-100">
                      {formatIntIt(row.iscritti)}
                    </p>
                    <p className="text-[10px] text-slate-500">iscritti in regione</p>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
                      Rete istituzionale
                    </p>
                    <p className="mt-1 font-mono text-lg tabular-nums text-slate-100">
                      {formatIntIt(totaleEletti)}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      amministratori/eletti (sola lettura)
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-[#1B2436] bg-[#0a1018] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
                  02 · Bacino elettorale reale · Europee 2024
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Ministero dell&apos;Interno · Stima · Score 0–100 conversione{" "}
                  {history.permeabilitaVannacciScore}
                </p>
                <div className="mt-4 space-y-3.5">
                  <PartyBar
                    label="Bacino Centrodestra (FdI + Lega)"
                    pctValue={cdxCore}
                    detail={`FdI ${formatDecimalIt(history.fdiPct, 1)}% · Lega ${formatDecimalIt(history.legaPct, 1)}% · FI ${formatDecimalIt(history.fiPct, 1)}% · CDX tot. ${formatDecimalIt(cdx, 1)}%`}
                    color="bg-emerald-500/80"
                  />
                  <PartyBar
                    label="Area avversa (PD + M5S)"
                    pctValue={history.pdPct + history.m5sPct}
                    detail={`PD ${formatDecimalIt(history.pdPct, 1)}% · M5S ${formatDecimalIt(history.m5sPct, 1)}% · Astensione ${formatDecimalIt(history.astensionePct, 1)}%`}
                    color="bg-rose-500/70"
                  />
                </div>
                <p className="mt-3 text-[11px] leading-snug text-slate-400">
                  {campaign.strategicExplanation}
                </p>
              </section>

              <section className="rounded-xl border border-[#1B2436] bg-[#0a1018] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
                  03 · Emergenze e disagi sociali critici
                </p>
                <ul className="mt-3 space-y-2.5">
                  {socialIssues.map((issue, index) => (
                    <li
                      key={`${issue.category}-${index}`}
                      className="rounded-lg border border-[#1B2436] bg-[#070b12]/80 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[9px] text-slate-500">
                          #{index + 1} · {categoryLabel(issue.category)}
                        </span>
                        <span
                          className={`font-mono text-[9px] uppercase tracking-wide ${urgencyTone(issue.stress)}`}
                        >
                          {urgencyLabel(issue.stress)} · {issue.stress}/100
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] leading-snug text-amber-100/90">
                        {issue.label}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="flex flex-col gap-4 lg:col-span-7">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
                Cosa dichiarare in {region} · Leve B.I.P. prioritarie
              </p>
              {levers.map((lever) => (
                <section
                  key={lever.category}
                  className="rounded-xl border border-emerald-500/20 bg-[#0a1018] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-emerald-300">
                      Leva #{lever.index} · {lever.badge}
                    </span>
                    <span className="font-mono text-[10px] text-cyan-300/90">
                      Cap. {lever.messaging.chapterNum} · {lever.messaging.pages}
                    </span>
                  </div>
                  <h3 className="mt-2 text-[15px] font-semibold leading-snug text-slate-50">
                    {lever.gain.fnPromise.shortTitle}
                  </h3>
                  <p className="mt-2 text-[11px] leading-snug text-amber-200/85">
                    <span className="font-mono uppercase tracking-wide text-slate-500">
                      Problema territoriale ·{" "}
                    </span>
                    {lever.issueLabel}
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-slate-300">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
                      Atto / soluzione ·{" "}
                    </span>
                    {lever.messaging.provvedimento.attoConcreto}
                  </p>
                  <div className="mt-3 rounded-lg border border-[#1B2436] bg-[#070b12] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
                        [Bozza per lo staff] · Dichiarazione stampa / comizio
                      </p>
                      <button
                        type="button"
                        className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-emerald-300 hover:text-cyan-300"
                        onClick={() =>
                          void copyText(
                            `lever-${lever.index}`,
                            lever.messaging.pressDeclaration,
                          )
                        }
                      >
                        {copiedKey === `lever-${lever.index}`
                          ? "Copiato"
                          : "[ Copia dichiarazione ]"}
                      </button>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-slate-200">
                      «{lever.messaging.pressDeclaration}»
                    </p>
                  </div>
                </section>
              ))}

              <button
                type="button"
                className="mt-auto w-full rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-cyan-400/50 hover:bg-emerald-500/25 hover:text-white"
                onClick={() =>
                  onOpenOsservatorio(region, levers[0]?.category ?? primary.category)
                }
              >
                [ Apri dossier completo in Osservatorio → ]
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
