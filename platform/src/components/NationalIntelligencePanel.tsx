"use client";

import type { InstitutionalRow } from "@/lib/engine/calculate";
import { type Region } from "@/lib/engine/constants";
import {
  buildExposurePriorityCards,
  buildMacroExposureRows,
} from "@/lib/engine/exposurePriorityEngine";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { FnConfig, ScenarioResult, ScenarioRow } from "@/lib/engine/types";
import { formatCompactVotes } from "@/lib/formatApproximateVotes";
import type { ScenarioRegionalV4View } from "@/lib/scenarioRegionalV4";
import { BIP_FN_PROMISES_CATALOG } from "@/lib/bipProgramCatalog";
import { Btn } from "@/components/ui/FnUi";
import { ClassStatusMark } from "@/components/ui/TelemetryUi";
import { pct } from "@/lib/format";
import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { buildBackcastRegions } from "@/lib/engine/buildBackcastRegions";
import { computeForecastV4 } from "@/lib/engine/forecastEngineV4";
import { computeStrategicBackcast } from "@/lib/engine/strategicBackcastEngine";
import { useActiveStrategicRoute } from "@/lib/state/useActiveStrategicRoute";
import { BASIN_LABEL, primaryBasin } from "@/components/obiettivo/goalViewModel";

const CARICHE: { key: keyof InstitutionalRow; label: string }[] = [
  { key: "dep", label: "Deputati" },
  { key: "creg", label: "Cons. Regionali" },
  { key: "sind", label: "Sindaci" },
  { key: "com", label: "Comunali" },
];

function hasInstChanges(d?: Partial<InstitutionalRow>): boolean {
  if (!d) return false;
  return CARICHE.some(({ key }) => (d[key] ?? 0) !== 0);
}

function RegionFocusPanel({
  row,
  shell,
  sectionLabel,
  variant,
  onSelectRegion,
  onAdjustInst,
  onResetRegion,
  fnConfig,
  region,
  regionQuickDelta,
  scenarioRow,
  baselineRow,
}: {
  row: RegionPollResult;
  shell: string;
  sectionLabel: string;
  variant: "default" | "stage" | "holographic";
  onSelectRegion: (r: string | null) => void;
  onAdjustInst?: (carica: keyof InstitutionalRow, delta: number) => void;
  onResetRegion?: () => void;
  fnConfig?: FnConfig;
  region?: Region;
  regionQuickDelta?: Partial<InstitutionalRow>;
  scenarioRow?: ScenarioRow;
  baselineRow?: ScenarioRow;
}) {
  const animPi = useAnimatedNumber(row.piHat * 100);
  const animMargine = useAnimatedNumber(row.margineVotiSoglia);
  const stimaDelta =
    scenarioRow && baselineRow ? (scenarioRow.stima - baselineRow.stima) * 100 : 0;
  const votiDelta =
    scenarioRow && baselineRow
      ? scenarioRow.voti_di_scenario - baselineRow.voti_di_scenario
      : 0;
  const showImpact = variant === "holographic" && hasInstChanges(regionQuickDelta);

  function displayCount(k: keyof InstitutionalRow): number {
    const base = fnConfig?.presenze_istituzionali[k]?.[region!] ?? 0;
    const d = regionQuickDelta?.[k] ?? 0;
    return base + d;
  }

  return (
    <div className={shell}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Focus regione
          </p>
          <h3 className="text-lg font-semibold text-white">{row.regione}</h3>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-emerald-300 hover:text-emerald-200"
          onClick={() => onSelectRegion(null)}
        >
          [ ← VISTA NAZIONALE ]
        </button>
      </div>

      <p className="font-mono text-2xl tabular-nums text-fn-text">
        {animPi.toFixed(2).replace(".", ",")}%{" "}
        <span className="text-sm text-fn-text-muted">± {(row.moe * 100).toFixed(1)} pp</span>
      </p>
      <p className="mt-1 font-mono text-xs tabular-nums text-fn-text-muted">
        {pct(row.icLow, 2)} – {pct(row.icHigh, 2)}
      </p>
      <p className="mt-1 font-mono text-[10px] tabular-nums text-slate-400">
        Margine 3%: {animMargine >= 0 ? "+" : ""}
        {formatIntIt(animMargine)} voti
      </p>

      <div className="mt-4">
        <p className={variant === "holographic" ? sectionLabel : "fn-label"}>
          {variant === "holographic" ? "05 // MIX PROVENIENZA" : "Mix provenienza"}
        </p>
        <div className="space-y-2">
          <WaterfallBar label="Flussi" share={row.contribFlussi} color="bg-orange-500" />
          <WaterfallBar label="Preferenze" share={row.contribPreferenze} color="bg-emerald-500" />
          <WaterfallBar label="Iscritti" share={row.contribIscritti} color="bg-sky-500" />
          <WaterfallBar label="Istituzioni" share={row.contribIstituzioni} color="bg-violet-500" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="fn-badge fn-badge-cloud capitalize">{row.classificazione}</span>
        <span className="fn-badge fn-badge-local">V/I {row.votiPerIscritto.toFixed(2)}</span>
      </div>

      {onAdjustInst && (
        <div className="mt-4 border-t border-white/[0.07] pt-4">
          {showImpact && (
            <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-2 font-mono text-[10px] text-emerald-200">
              VARIAZIONE SIMULATA: {stimaDelta >= 0 ? "+" : ""}
              {stimaDelta.toFixed(2).replace(".", ",")} pp ({votiDelta >= 0 ? "+" : ""}
              {formatIntIt(votiDelta)} VOTI)
            </div>
          )}
          <p className="fn-label mb-2">CAMPAGNA ACQUISTI (DELTA ISTITUZIONALE)</p>
          <div className="grid grid-cols-2 gap-2">
            {CARICHE.map(({ key, label }) => {
              const delta = regionQuickDelta?.[key] ?? 0;
              const count = region && fnConfig ? displayCount(key) : null;
              return (
                <div
                  key={key}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-2 transition-shadow hover:shadow-[0_0_12px_rgba(52,211,153,0.2)]"
                >
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-fn-text-muted">{label}</span>
                    {delta !== 0 && (
                      <span className="rounded bg-emerald-500/20 px-1 font-mono text-[11px] text-emerald-300">
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </div>
                  {count != null && (
                    <p className="mb-1 font-mono text-sm tabular-nums text-slate-100">{count}</p>
                  )}
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="fn-icon-btn h-7 w-7 active:shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                      aria-label={`Meno ${label}`}
                      onClick={() => onAdjustInst(key, -1)}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="fn-icon-btn h-7 w-7 active:shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                      aria-label={`Più ${label}`}
                      onClick={() => onAdjustInst(key, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {onResetRegion && (
            <Btn variant="secondary" className="mt-2 w-full text-xs" onClick={onResetRegion}>
              Azzera modifiche regione
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}

const CIRC_DOT: Record<string, { bar: string; dot: string }> = {
  NO: { bar: "bg-cyan-400", dot: "bg-cyan-400" },
  NE: { bar: "bg-emerald-400", dot: "bg-emerald-400" },
  C: { bar: "bg-sky-400", dot: "bg-sky-400" },
  S: { bar: "bg-amber-400", dot: "bg-amber-400" },
  I: { bar: "bg-violet-400", dot: "bg-violet-400" },
};

/** Titolo breve leva B.I.P. coerente col disagio regionale (riga 2 sidebar). */
function bipLeverShort(category: TerritoryIssueCategory, issueLabel: string): string {
  const label = issueLabel.toLowerCase();
  if (/energia|bollett|fisco|p\.?\s*iva|pmi|partite?\s*iva/.test(label)) {
    return "Stop Saldo-Acconto P.IVA & Energia";
  }
  if (/stazion|carcer|san vittore|degrado|furti|sicur/.test(label) && category === "SICUREZZA") {
    return "Protocollo Sicurezza & Carceri";
  }
  if (/liste d'attesa|sanit|ospedal|cure/.test(label) || category === "SANITA") {
    return "Piano Liste d'Attesa & Sanità";
  }
  if (/msna|migrat|balcan|sbarchi|flussi|ong|continuità/.test(label)) {
    return "Blocco ONG & Continuità Territoriale";
  }
  if (/auto|industria|cassa integrazione|lavoro/.test(label) || category === "LAVORO") {
    return "San Paolo & Filiera Italia";
  }
  if (/mutui|affitti|abitativ|erp|casa/.test(label)) {
    return "Mutuo Tricolore & ERP";
  }
  const promise =
    BIP_FN_PROMISES_CATALOG.find((item) => item.category === category) ??
    BIP_FN_PROMISES_CATALOG[0]!;
  return promise.shortTitle.replace(/^[^·]+·\s*/, "").trim() || promise.shortTitle;
}

/** Etichetta completa leva (dossier / coerenza Veneto fisco-energia). */
function bipLeverTitle(category: TerritoryIssueCategory, issueLabel: string): string {
  const label = issueLabel.toLowerCase();
  if (/energia|bollett|fisco|p\.?\s*iva|pmi|partite?\s*iva/.test(label)) {
    return "FISCO & IMPRESE · Stop Saldo-Acconto P.IVA & Energia Sovrana";
  }
  if (/msna|migrat|balcan|sbarchi|flussi|ong/.test(label)) {
    return (
      BIP_FN_PROMISES_CATALOG.find((item) => item.id === "BIP.05")?.shortTitle ??
      "IMMIGRAZIONE · Piano remigrazione 22 misure"
    );
  }
  if (/stazion|carcer|san vittore|degrado/.test(label) && category === "SICUREZZA") {
    return "SICUREZZA · Protocollo Sicurezza & Carceri";
  }
  if (/liste d'attesa|sanit|ospedal|cure/.test(label) || category === "SANITA") {
    return "SANITÀ · Piano Liste d'Attesa & Sanità";
  }
  if (/continuità|traghetti|trasporti/.test(label) && /migrat|flussi|sbarchi|isole|sicilia/i.test(label) === false) {
    return "TRASPORTI · Continuità Territoriale";
  }
  if (/continuità|migrat|flussi|sbarchi/.test(label)) {
    return "TERRITORIO · Blocco ONG & Continuità Territoriale";
  }
  const promise =
    BIP_FN_PROMISES_CATALOG.find((item) => item.category === category) ??
    BIP_FN_PROMISES_CATALOG[0]!;
  return promise.shortTitle;
}

export type ScenarioPriorityView = "oggi" | "mag27" | "rotta";

function HolographicNationalView({
  poll,
  scenario,
  activeRegion,
  hoveredRegion,
  newsHeadlines,
  onSelectRegion,
  onOpenDossier,
  regionalV4ByRegion,
  priorityView,
  onPriorityViewChange,
}: {
  poll: RegionPollResult[];
  scenario?: ScenarioResult;
  activeRegion: string | null;
  hoveredRegion?: string | null;
  newsHeadlines?: string[];
  onSelectRegion: (r: string | null) => void;
  onOpenDossier?: (region: Region, category: TerritoryIssueCategory) => void;
  regionalV4ByRegion?: Record<string, ScenarioRegionalV4View>;
  priorityView: ScenarioPriorityView;
  onPriorityViewChange: (view: ScenarioPriorityView) => void;
}) {
  const sectionLabel =
    "mb-2.5 font-mono text-[10px] tracking-[0.15em] text-[var(--ink-muted)]";
  const { route } = useActiveStrategicRoute();
  const routePlan = useMemo(() => {
    if (!route || !scenario || priorityView !== "rotta") return null;
    const built = buildBackcastRegions(scenario);
    const forecast = computeForecastV4({
      startPct: scenario.parametri.S * 100,
      tesserati: built.currentMembers,
      comitati: built.currentCommittees,
    });
    return computeStrategicBackcast({
      forecast,
      targetPct: route.targetPct,
      horizonDays: route.horizonDays,
      regions: built.regions,
      currentMembers: built.currentMembers,
      currentCommittees: built.currentCommittees,
    });
  }, [route, scenario, priorityView]);

  const rows = useMemo(
    () =>
      (scenario?.righe ?? []).map((row) => ({
        regione: row.regione as Region,
        stima: row.stima,
        voti_di_scenario: row.voti_di_scenario,
        elettori_ricostruiti: row.elettori_ricostruiti,
      })),
    [scenario?.righe],
  );

  const pollByRegion = useMemo(
    () => Object.fromEntries(poll.map((p) => [p.regione, { piHat: p.piHat }])),
    [poll],
  );

  const allCards = useMemo(
    () =>
      buildExposurePriorityCards({
        rows:
          rows.length > 0
            ? rows
            : poll.map((p) => ({
                regione: p.regione as Region,
                stima: p.piHat,
                voti_di_scenario: p.votiAttesi,
                elettori_ricostruiti: Math.max(
                  1,
                  Math.round(p.validiAttesi || p.votiAttesi * 12),
                ),
              })),
        newsHeadlines,
      }),
    [rows, poll, newsHeadlines],
  );

  const targetPriorityRegions = allCards.slice(0, 5);

  const mag27Top = useMemo(() => {
    if (!regionalV4ByRegion) return [];
    return Object.values(regionalV4ByRegion)
      .sort((a, b) => b.addedVotes - a.addedVotes)
      .slice(0, 5);
  }, [regionalV4ByRegion]);
  const macroSourceRows = useMemo(
    () =>
      rows.length > 0
        ? rows
        : poll.map((p) => ({
            regione: p.regione as Region,
            stima: p.piHat,
            elettori_ricostruiti: Math.max(
              1,
              Math.round(p.validiAttesi || p.votiAttesi * 12),
            ),
          })),
    [rows, poll],
  );
  const macroRows = useMemo(
    () => buildMacroExposureRows(allCards, macroSourceRows, pollByRegion),
    [allCards, macroSourceRows, pollByRegion],
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#1B2436] bg-[#080C14]/90">
      <section className="shrink-0 px-2.5 pb-1 pt-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className={sectionLabel}>PRIORITÀ TERRITORIALI</p>
          <div className="inline-flex rounded-md border border-[var(--border-subtle)] p-0.5">
            <button
              type="button"
              onClick={() => onPriorityViewChange("oggi")}
              className={`rounded px-1.5 py-0.5 text-[10px] ${priorityView === "oggi" ? "bg-[var(--surface-2)] text-[var(--ink-primary)]" : "text-[var(--ink-muted)]"}`}
            >
              Oggi
            </button>
            <button
              type="button"
              onClick={() => onPriorityViewChange("mag27")}
              className={`rounded px-1.5 py-0.5 text-[10px] ${priorityView === "mag27" ? "bg-[var(--surface-2)] text-[var(--ink-primary)]" : "text-[var(--ink-muted)]"}`}
            >
              Mag &apos;27
            </button>
            {route ? (
              <button
                type="button"
                onClick={() => onPriorityViewChange("rotta")}
                className={`rounded px-1.5 py-0.5 text-[10px] ${priorityView === "rotta" ? "bg-[var(--surface-2)] text-[var(--ink-primary)]" : "text-[var(--ink-muted)]"}`}
              >
                Rotta {formatDecimalIt(route.targetPct, 1)}%
              </button>
            ) : null}
          </div>
        </div>
        {priorityView === "mag27" && mag27Top.length > 0 ? (
          <ul>
            {mag27Top.map((row, index) => {
              const hot = activeRegion === row.regione || hoveredRegion === row.regione;
              const card = allCards.find((item) => item.regione === row.regione);
              const leverShort = card
                ? bipLeverShort(card.primaryCategory, card.primarySocialIssue)
                : "Trazione stimata";
              return (
                <li
                  key={row.regione}
                  className={`border-b border-slate-800/70 px-1 py-1.5 last:border-0 ${
                    hot ? "bg-cyan-500/15" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <button
                    type="button"
                    className="flex w-full items-baseline gap-1.5 text-left"
                    onClick={() => onSelectRegion(row.regione)}
                  >
                    <span className="shrink-0 font-mono text-[10px] text-[var(--ink-muted)]">
                      [{String(index + 1).padStart(2, "0")}]
                    </span>
                    <span className="min-w-0 text-[12px] font-semibold leading-none text-white">
                      {row.regione}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-emerald-300">
                      {formatCompactVotes(row.addedVotes)} · sat.{" "}
                      {Math.round(row.reachSaturation * 100)}%
                    </span>
                  </button>
                  <p className="mt-0.5 pl-5 text-[11px] leading-snug text-[var(--ink-secondary)]">
                    {formatDecimalIt(row.startPct, 2)}% → {formatDecimalIt(row.mag27BasePct, 2)}% ·{" "}
                    Stima · {leverShort}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : route && priorityView === "rotta" && routePlan ? (
          <ul>
            {[...routePlan.regions]
              .sort((a, b) => b.addedVotes - a.addedVotes)
              .slice(0, 5)
              .map((row) => (
                <li key={row.region} className="border-b border-slate-800/70 px-1 py-1">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-left"
                    onClick={() => onSelectRegion(row.region)}
                  >
                    <span className="text-[12px] font-semibold text-white">{row.region}</span>
                    <span className="font-mono text-[10px] tabular-nums text-[var(--signal-positive)]">
                      +{formatIntIt(row.addedVotes)} · {row.role === "FRONTE_PRIORITARIO" ? "FRONTE" : "SUPPORTO"}
                    </span>
                  </button>
                  <p className="text-[11px] leading-snug text-[var(--ink-secondary)]">{BASIN_LABEL[primaryBasin(row)]}</p>
                </li>
              ))}
          </ul>
        ) : (
        <ul>
          {targetPriorityRegions.map((card, i) => {
            const hot = activeRegion === card.regione || hoveredRegion === card.regione;
            const leverShort = bipLeverShort(card.primaryCategory, card.primarySocialIssue);
            const leverFull = bipLeverTitle(card.primaryCategory, card.primarySocialIssue);
            const dossierCategory =
              /energia|bollett|fisco|p\.?\s*iva|pmi/i.test(card.primarySocialIssue)
                ? ("LAVORO" as TerritoryIssueCategory)
                : card.primaryCategory;
            return (
              <li
                key={card.regione}
                className={`border-b border-slate-800/70 px-1 py-1.5 last:border-0 ${
                  hot ? "bg-cyan-500/15" : "hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left"
                    onClick={() => onSelectRegion(card.regione)}
                  >
                    <span className="shrink-0 font-mono text-[10px] text-[var(--ink-muted)]">
                      [{String(i + 1).padStart(2, "0")}]
                    </span>
                    <span className="min-w-0 text-[12px] font-semibold leading-none text-white">
                      {card.regione}
                    </span>
                    {i < 2 || card.exposurePriorityScore >= 75 ? (
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-rose-300">
                        {i === 0 ? "PRIORITÀ #1" : "HOT"}
                      </span>
                    ) : null}
                    <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-[var(--ink-secondary)]">
                      Prio {card.exposurePriorityScore} · Aff {card.conversionScore}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 text-[11px] leading-none text-emerald-400 hover:underline"
                    aria-label={`Apri dossier: ${leverFull}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (onOpenDossier) {
                        onOpenDossier(card.regione, dossierCategory);
                      } else {
                        onSelectRegion(card.regione);
                      }
                    }}
                  >
                    →
                  </button>
                </div>
                <div className="mt-1 h-[2px] overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                    style={{
                      width: `${Math.max(6, Math.min(100, card.exposurePriorityScore))}%`,
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="mt-1 w-full text-left"
                  onClick={() => onSelectRegion(card.regione)}
                >
                  <span className="block text-[11px] leading-snug text-[var(--ink-secondary)]">
                    {card.primarySocialIssue}
                    <span className="text-[var(--ink-muted)]"> → </span>
                    {leverShort}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        )}
      </section>

      <section className="border-t border-[#1B2436] px-2.5 py-2">
        <p className={`${sectionLabel} mb-1`}>
          TEMI PER MACRO-AREA
        </p>
        <div className="mb-1 flex h-1 overflow-hidden rounded-sm bg-[#162032]">
          {macroRows.map((area) => {
            const style = CIRC_DOT[area.code] ?? CIRC_DOT.C!;
            return (
              <div
                key={area.code}
                className={style.bar}
                style={{ width: `${Math.max(8, area.elettoriShare * 100)}%` }}
                title={`${area.label} ${formatDecimalIt(area.elettoriShare * 100, 0)}% elettori`}
              />
            );
          })}
        </div>
        <ul>
          {macroRows.map((area) => {
            const style = CIRC_DOT[area.code] ?? CIRC_DOT.C!;
            const hot =
              activeRegion === area.leadRegion || hoveredRegion === area.leadRegion;
            return (
              <li key={area.code}>
                <button
                  type="button"
                  className={`w-full rounded px-1 py-1 text-left transition-colors ${
                    hot ? "bg-cyan-500/10 ring-1 ring-cyan-400/30" : "hover:bg-white/[0.03]"
                  }`}
                  onClick={() => onSelectRegion(area.leadRegion)}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-100">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
                      <span className="font-medium">{area.label}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums">
                      <span className="text-cyan-300">Aff {area.avgConversion}</span>
                      <span className="text-[var(--ink-muted)]"> · </span>
                      <span className="font-semibold text-emerald-400">
                        FN {formatDecimalIt(area.avgConsensusPct, 1)}%
                      </span>
                    </span>
                  </span>
                  <span className="mt-0.5 block pl-3 text-[11px] leading-snug text-[var(--ink-secondary)]">
                    {area.primaryIssue}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}


export function NationalIntelligencePanel({
  poll,
  scenario,
  selectedRegion,
  hoveredRegion,
  onSelectRegion,
  onAdjustInst,
  onResetRegion,
  variant = "default",
  fnConfig,
  region,
  regionQuickDelta,
  scenarioRow,
  baselineRow,
  nationalS = 0.0659,
  newsHeadlines,
  onOpenDossier,
  regionalV4ByRegion,
  priorityView = "oggi",
  onPriorityViewChange,
}: {
  poll: RegionPollResult[];
  scenario?: ScenarioResult;
  selectedRegion: string | null;
  hoveredRegion?: string | null;
  regionalV4ByRegion?: Record<string, ScenarioRegionalV4View>;
  priorityView?: ScenarioPriorityView;
  onPriorityViewChange?: (view: ScenarioPriorityView) => void;
  onSelectRegion: (r: string | null) => void;
  onAdjustInst?: (carica: keyof InstitutionalRow, delta: number) => void;
  onResetRegion?: () => void;
  variant?: "default" | "stage" | "holographic";
  fnConfig?: FnConfig;
  region?: Region;
  regionQuickDelta?: Partial<InstitutionalRow>;
  scenarioRow?: ScenarioRow;
  baselineRow?: ScenarioRow;
  nationalS?: number;
  newsHeadlines?: string[];
  onOpenDossier?: (region: Region, category: TerritoryIssueCategory) => void;
}) {
  const shell =
    variant === "holographic"
      ? "flex h-full min-h-0 flex-col overflow-y-auto rounded-xl border border-[#1B2436] bg-[#080C14]/90"
      : variant === "stage"
        ? "flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-[#0B1221]/90 p-3.5 shadow-lg"
        : "fn-bento fn-intel-panel flex h-full flex-col";
  const sectionLabel =
    "mb-2 font-mono text-[10px] tracking-[0.15em] text-[var(--ink-muted)]";
  const row = poll.find((p) => p.regione === selectedRegion);

  if (variant === "holographic") {
    return (
      <HolographicNationalView
        poll={poll}
        scenario={scenario}
        activeRegion={selectedRegion}
        hoveredRegion={hoveredRegion}
        newsHeadlines={newsHeadlines}
        onSelectRegion={onSelectRegion}
        onOpenDossier={onOpenDossier}
        regionalV4ByRegion={regionalV4ByRegion}
        priorityView={priorityView}
        onPriorityViewChange={onPriorityViewChange ?? (() => {})}
      />
    );
  }

  if (row) {
    return (
      <RegionFocusPanel
        row={row}
        shell={shell}
        sectionLabel={sectionLabel}
        variant={variant}
        onSelectRegion={onSelectRegion}
        onAdjustInst={onAdjustInst}
        onResetRegion={onResetRegion}
        fnConfig={fnConfig}
        region={region}
        regionQuickDelta={regionQuickDelta}
        scenarioRow={scenarioRow}
        baselineRow={baselineRow}
      />
    );
  }

  const sicure = poll.filter((p) => p.classificazione === "sicura").length;
  const contese = poll.filter((p) => p.classificazione === "contesa").length;
  const critiche = poll.filter((p) => p.classificazione === "critica").length;

  const top5 = [...poll].sort((a, b) => b.piHat - a.piHat).slice(0, 5);
  const watch = [...poll].sort((a, b) => a.piHat - b.piHat).slice(0, 5);

  const mix = poll.reduce(
    (acc, p) => ({
      flussi: acc.flussi + p.contribFlussi,
      pref: acc.pref + p.contribPreferenze,
      isc: acc.isc + p.contribIscritti,
      ist: acc.ist + p.contribIstituzioni,
    }),
    { flussi: 0, pref: 0, isc: 0, ist: 0 },
  );
  const n = poll.length || 1;
  const mixNorm = {
    flussi: mix.flussi / n,
    pref: mix.pref / n,
    isc: mix.isc / n,
    ist: mix.ist / n,
  };

  const nationalPct = nationalS * 100;

  return (
    <div className={`${shell} overflow-hidden p-4`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
        Panoramica Territoriale Live
      </p>
      <p className="mb-3 text-xs text-slate-400">
        Clicca una regione sulla mappa per il focus tattico
      </p>

      {variant === "default" && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <StatPill label="Sicure" count={sicure} color="bg-emerald-500" />
          <StatPill label="Contese" count={contese} color="bg-amber-400" />
          <StatPill label="Critiche" count={critiche} color="bg-red-500" />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Top 5 regioni per stima %
          </p>
          <ul className="space-y-2">
            {top5.map((p, i) => (
              <li key={p.regione}>
                <button
                  type="button"
                  className="w-full text-left transition-colors hover:bg-white/[0.03]"
                  onClick={() => onSelectRegion(p.regione)}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-mono text-[10px] text-[var(--ink-muted)]">
                        [{String(i + 1).padStart(2, "0")}]
                      </span>
                      <span className="truncate font-medium text-slate-100">{p.regione}</span>
                    </div>
                    <span className="shrink-0 font-mono tabular-nums text-emerald-400">
                      {(p.piHat * 100).toFixed(2).replace(".", ",")}%
                    </span>
                  </div>
                </button>
                <div className="relative h-1 overflow-hidden bg-[#162032]">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-emerald-500/80"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, p.piHat * 400)}%` }}
                    transition={{ duration: 0.4, delay: i * 0.04 }}
                  />
                  <div
                    className="absolute top-0 h-full w-px bg-slate-400/70"
                    style={{ left: `${Math.min(100, nationalPct * 4)}%` }}
                    title={`Media nazionale ${nationalPct.toFixed(2)}%`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Watchlist soglia sbarramento 3%
          </p>
          <ul className="space-y-1.5">
            {watch.map((p) => (
              <li key={p.regione}>
                <button
                  type="button"
                  className="w-full py-0.5 text-left transition-colors hover:bg-white/[0.03]"
                  onClick={() => onSelectRegion(p.regione)}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <ClassStatusMark classificazione={p.classificazione} />
                      <span className="truncate font-medium text-slate-100">{p.regione}</span>
                    </div>
                    <span className="shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tabular-nums text-slate-300">
                      {p.margineVotiSoglia >= 0 ? "+" : ""}
                      {formatIntIt(p.margineVotiSoglia)} VOTI
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Mix nazionale · 4 fattori
          </p>
          <div className="flex h-1.5 overflow-hidden bg-[#162032]">
            <div className="bg-orange-500" style={{ width: `${mixNorm.flussi * 100}%` }} />
            <div className="bg-emerald-500" style={{ width: `${mixNorm.pref * 100}%` }} />
            <div className="bg-sky-500" style={{ width: `${mixNorm.isc * 100}%` }} />
            <div className="bg-violet-500" style={{ width: `${mixNorm.ist * 100}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1 font-mono text-[11px] tabular-nums text-slate-400">
            <span>FLUSSI {(mixNorm.flussi * 100).toFixed(0)}%</span>
            <span>PREF. {(mixNorm.pref * 100).toFixed(0)}%</span>
            <span>ISCR. {(mixNorm.isc * 100).toFixed(0)}%</span>
            <span>IST. {(mixNorm.ist * 100).toFixed(0)}%</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatPill({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-2 text-center">
      <span className={`mx-auto mb-1 block h-2 w-2 rounded-full ${color}`} />
      <p className="font-mono text-lg tabular-nums">{count}</p>
      <p className="text-[10px] text-fn-text-muted">{label}</p>
    </div>
  );
}

function WaterfallBar({
  label,
  share,
  color,
}: {
  label: string;
  share: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px]">
        <span className="text-fn-text-muted">{label}</span>
        <span className="font-mono tabular-nums">{(share * 100).toFixed(1)}%</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}
