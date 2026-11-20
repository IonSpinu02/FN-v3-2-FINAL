"use client";

import type { Region } from "@/lib/engine/constants";
import {
  TERRITORY_NAZIONALE,
  type TerritoryScope,
  isRegionScope,
} from "@/lib/engine/osservatorioTerritoryScope";
import {
  buildRegionalStrengthTable,
  summarizeStrengthBands,
  type RegionalStrengthRow,
} from "@/lib/engine/regionalPartyStrength";
import type { ScenarioResult } from "@/lib/engine/types";
import type {
  TerritoryIssue,
  TerritoryIssueCategory,
} from "@/lib/engine/territoryIssuesTypes";
import { RegionalGrowthMiniChart } from "@/components/RegionalGrowthMiniChart";
import type { RegionalGrowthForecast } from "@/lib/politicalModel";
import { formatDecimalIt, formatIntIt, formatPpSignedIt } from "@/lib/formatIt";
import { fmtIndexIt, fmtNumIt, fmtPctIt } from "@/lib/osservatorioFormatIt";
import {
  cleanRssText,
  enrichIssuesWithConversion,
  cleanIssueHeadline,
  dedupeIssues,
} from "@/lib/engine/territoryIssuesEngine";
import { RegionalPartyHistoryBar } from "@/components/RegionalPartyHistoryBar";
import {
  buildCampaignPriorityLists,
  buildRegionalCampaignSummary,
  getRegionalPartyHistory,
  simulateSelectedIssuesGain,
  validVotesFromScenarioRow,
} from "@/lib/fnProgramAndAffinityEngine";
import { useCallback, useEffect, useMemo, useState } from "react";

type SortMode = "forti" | "deboli" | "voti";

const FILTER_CHIPS: { id: TerritoryIssueCategory | "ALL"; label: string }[] = [
  { id: "ALL", label: "TUTTI I PROBLEMI" },
  { id: "SANITA", label: "SANITÀ & OSPEDALI" },
  { id: "TRASPORTI", label: "TRASPORTI & PENDOLARI" },
  { id: "LAVORO", label: "LAVORO & IMPRESE" },
  { id: "SICUREZZA", label: "SICUREZZA & DEGRADO" },
  { id: "COSTO_VITA", label: "CARO-VITA & CASA" },
  { id: "TERRITORIO", label: "AGRICOLTURA & AMBIENTE" },
];

function bandStyles(band: RegionalStrengthRow["band"]) {
  if (band === "FORTE")
    return {
      badge: "FORTE",
      bar: "bg-emerald-500",
      text: "text-emerald-300",
      ring: "border-emerald-500/40",
    };
  if (band === "MEDIO")
    return {
      badge: "MEDIO",
      bar: "bg-amber-400",
      text: "text-amber-200",
      ring: "border-amber-500/35",
    };
  return {
    badge: "DEBOLE",
    bar: "bg-rose-500",
    text: "text-rose-300",
    ring: "border-rose-500/40",
  };
}

export function OsservatorioDecisionHub({
  scenario,
  liveS,
  mainTerritory,
  setMainTerritory,
  regione,
  setRegione,
  onRegisterIssueEvent,
  regionalGrowthByRegion,
  section = "all",
}: {
  scenario: ScenarioResult;
  liveS: number;
  mainTerritory: TerritoryScope;
  setMainTerritory: (t: TerritoryScope) => void;
  regione: Region;
  setRegione: (r: Region) => void;
  onRegisterIssueEvent: (issue: TerritoryIssue) => void;
  regionalGrowthByRegion?: Record<string, RegionalGrowthForecast>;
  /** In layout unificato: renderizza solo 01 o 03 tra Scheda e Modulo B. */
  section?: "all" | "01" | "03";
}) {
  const [hoverCard, setHoverCard] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("deboli");
  const [issueFilter, setIssueFilter] = useState<TerritoryIssueCategory | "ALL">(
    "ALL",
  );
  const [issues, setIssues] = useState<TerritoryIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesMeta, setIssuesMeta] = useState<string>("");
  const [simulatedIssueIds, setSimulatedIssueIds] = useState<string[]>([]);

  const strengthRows = useMemo(
    () => buildRegionalStrengthTable(scenario, liveS),
    [scenario, liveS],
  );
  const bands = useMemo(() => summarizeStrengthBands(strengthRows), [strengthRows]);
  const roccaforteTop = useMemo(
    () =>
      [...bands.roccaforte].sort((a, b) => b.indice - a.indice).slice(0, 3),
    [bands.roccaforte],
  );
  const criticheAll = useMemo(
    () => [...bands.critiche].sort((a, b) => a.indice - b.indice),
    [bands.critiche],
  );
  const lombardiaVoti = useMemo(() => {
    const row = strengthRows.find((r) => r.regione === "Lombardia");
    return row ? fmtNumIt(row.voti) : "—";
  }, [strengthRows]);

  const selectedScope: TerritoryScope =
    mainTerritory === TERRITORY_NAZIONALE ? TERRITORY_NAZIONALE : regione;

  const campaignLists = useMemo(
    () => buildCampaignPriorityLists(scenario.righe),
    [scenario.righe],
  );

  const focusRegionForConversion: Region =
    selectedScope === TERRITORY_NAZIONALE ? regione : (selectedScope as Region);

  const conversionScopeRow = useMemo(
    () => scenario.righe.find((r) => r.regione === focusRegionForConversion),
    [scenario.righe, focusRegionForConversion],
  );

  const validVotesScope = useMemo(() => {
    if (!conversionScopeRow) return 0;
    return validVotesFromScenarioRow(
      conversionScopeRow.voti_di_scenario,
      conversionScopeRow.stima,
    );
  }, [conversionScopeRow]);

  const regionalCampaignSummary = useMemo(() => {
    if (!conversionScopeRow) return null;
    return buildRegionalCampaignSummary(
      focusRegionForConversion,
      conversionScopeRow.stima * 100,
      validVotesScope,
    );
  }, [conversionScopeRow, focusRegionForConversion, validVotesScope]);

  const simulatedGain = useMemo(() => {
    if (!simulatedIssueIds.length || selectedScope === TERRITORY_NAZIONALE) {
      return { totalPp: 0, totalVotes: 0 };
    }
    return simulateSelectedIssuesGain(
      focusRegionForConversion,
      simulatedIssueIds,
      issues,
      validVotesScope,
    );
  }, [
    simulatedIssueIds,
    selectedScope,
    focusRegionForConversion,
    issues,
    validVotesScope,
  ]);

  const regionalCards = useMemo(() => {
    const list = strengthRows.filter((r) => r.regione !== "NAZIONALE");
    if (sortMode === "forti")
      return [...list].sort((a, b) => b.indice - a.indice);
    if (sortMode === "deboli")
      return [...list].sort((a, b) => a.indice - b.indice);
    return [...list].sort((a, b) => b.voti - a.voti);
  }, [strengthRows, sortMode]);

  const selectTerritory = useCallback(
    (scope: TerritoryScope) => {
      setMainTerritory(scope);
      if (isRegionScope(scope)) setRegione(scope);
    },
    [setMainTerritory, setRegione],
  );

  const loadIssues = useCallback(async () => {
    setIssuesLoading(true);
    try {
      const regionQ =
        selectedScope === TERRITORY_NAZIONALE ? "NAZIONALE" : selectedScope;
      const catQ = issueFilter === "ALL" ? "" : `&category=${issueFilter}`;
      const res = await fetch(
        `/api/territory/issues?region=${encodeURIComponent(regionQ)}${catQ}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        issues: TerritoryIssue[];
        liveNews?: TerritoryIssue[];
        liveCount: number;
        fetchedAt: string;
      };
      const raw = dedupeIssues(data.issues ?? []);
      const votes =
        selectedScope === TERRITORY_NAZIONALE
          ? validVotesFromScenarioRow(
              scenario.righe.reduce((a, r) => a + r.voti_di_scenario, 0),
              scenario.parametri.S,
            )
          : validVotesFromScenarioRow(
              scenario.righe.find((r) => r.regione === selectedScope)
                ?.voti_di_scenario ?? 0,
              scenario.righe.find((r) => r.regione === selectedScope)?.stima ?? 0.07,
            );
      setIssues(
        enrichIssuesWithConversion(
          raw,
          selectedScope === TERRITORY_NAZIONALE ? "NAZIONALE" : selectedScope,
          votes,
        ),
      );
      setSimulatedIssueIds([]);
      setIssuesMeta(
        `${data.liveCount ?? 0} segnali live · aggiornato ${new Date(data.fetchedAt).toLocaleString("it-IT")}`,
      );
    } catch {
      setIssues([]);
      setIssuesMeta("Radar non disponibile — catalogo offline in caricamento");
    } finally {
      setIssuesLoading(false);
    }
  }, [selectedScope, issueFilter, scenario]);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  const scopeTitle =
    selectedScope === TERRITORY_NAZIONALE
      ? "ITALIA · QUADRO NAZIONALE"
      : selectedScope.toUpperCase();

  const show01 = section === "all" || section === "01";
  const show03 = section === "all" || section === "03";

  return (
    <div className={section === "all" ? "space-y-10 pb-8" : ""}>
      {show01 ? (
      <section
        id="osservatorio-sec-01"
        className="scroll-mt-28 rounded-2xl border border-white/10 bg-[#070B14]/90 shadow-xl backdrop-blur-md"
      >
        <header className="border-b border-white/10 px-6 py-4">
          <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-400">
            SEZIONE 01 // DOVE SIAMO FORTI E DOVE SIAMO DEBOLI
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Termometro regionale · Indice di forza{" "}
            <span className="font-mono text-emerald-300">0,00 – 1,00</span>
          </h2>
        </header>
        <div className="grid gap-4 border-b border-white/10 p-6 md:grid-cols-3">
          <SummaryTile
            title="Regioni Roccaforte"
            band="0,70 – 1,00 · Messo Bene"
            objective="Consolidare e mobilitare"
            tone="emerald"
            count={bands.roccaforte.length}
            sample={`${roccaforteTop
              .map(
                (r) =>
                  `${r.regione} (${fmtIndexIt(r.indice)} · ${fmtPctIt(r.stimaPct, 2)})`,
              )
              .join(" · ")} · Lombardia (${lombardiaVoti} voti)`}
          />
          <SummaryTile
            title="Regioni Intermedie"
            band="0,45 – 0,69 · Da Spingere"
            objective="Convertire l'attenzione in radicamento"
            tone="amber"
            count={bands.intermedie.length}
            sample={bands.intermedie
              .slice(0, 6)
              .map(
                (r) =>
                  `${r.regione} (${fmtIndexIt(r.indice)} · ${fmtPctIt(r.stimaPct, 2)})`,
              )
              .join(", ")}
          />
          <SummaryTile
            title="Regioni Critiche"
            band="0,00 – 0,44 · Messo Male"
            objective="Andare sul territorio sui temi caldi"
            tone="rose"
            count={criticheAll.length}
            sample={criticheAll
              .map(
                (r) =>
                  `${r.regione} (${fmtIndexIt(r.indice)} · ${fmtPctIt(r.stimaPct, 2)})`,
              )
              .join(", ")}
          />
        </div>
        <div className="grid gap-4 border-b border-white/10 p-6 lg:grid-cols-2">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-emerald-300">
              Regioni ad alta conversione (dove andare subito — forte bacino Lega / FdI)
            </p>
            <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-slate-300">
              {campaignLists.altaConversione.slice(0, 8).map((item) => (
                <li key={item.regione}>
                  <button
                    type="button"
                    onClick={() => selectTerritory(item.regione)}
                    className="text-left hover:text-emerald-200"
                  >
                    <strong className="text-white">{item.regione}</strong>: CDX{" "}
                    {formatDecimalIt(item.cdxPct, 1)}% (FdI{" "}
                    {formatDecimalIt(item.history.fdiPct, 1)}% · Lega{" "}
                    {formatDecimalIt(item.history.legaPct, 1)}%) → Potenziale fino a{" "}
                    <span className="font-mono text-emerald-300">
                      +{formatIntIt(item.maxNewVotes)} nuovi voti
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-rose-300">
              Regioni a bassa conversione (non disperdere energie — storico PD / sinistra)
            </p>
            <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-slate-300">
              {campaignLists.bassaConversione.map((item) => (
                <li key={item.regione}>
                  <button
                    type="button"
                    onClick={() => selectTerritory(item.regione)}
                    className="text-left hover:text-rose-200"
                  >
                    <strong className="text-white">{item.regione}</strong>: PD{" "}
                    {formatDecimalIt(item.history.pdPct, 1)}% + CSX · Permeabilità{" "}
                    {item.history.permeabilitaVannacciScore}/100
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
              L&apos;elettorato storico PD è ideologicamente distante da Vannacci: anche
              intervenendo sui problemi locali, il tasso di conversione in voti FN resta
              minimo (&lt; +0,20 pp).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-6 py-3">
          <span className="font-mono text-[9px] uppercase text-slate-500">
            Ordina:
          </span>
          {(
            [
              ["forti", "Più Forti"],
              ["deboli", "Più Deboli"],
              ["voti", "Più Voti Assoluti"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSortMode(id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                sortMode === id
                  ? "bg-emerald-500/15 text-emerald-200"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => selectTerritory(TERRITORY_NAZIONALE)}
            className={`ml-auto rounded-lg border px-3 py-1 text-[11px] font-semibold ${
              selectedScope === TERRITORY_NAZIONALE
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-100"
                : "border-white/15 text-slate-300 hover:border-white/30"
            }`}
          >
            [ ITALIA · Quadro Nazionale ]
          </button>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {regionalCards.map((r) => {
            const st = bandStyles(r.band);
            const active = selectedScope === r.regione;
            return (
              <button
                key={r.regione}
                type="button"
                onClick={() => selectTerritory(r.regione)}
                onMouseEnter={() => setHoverCard(r.regione)}
                onMouseLeave={() => setHoverCard(null)}
                className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${
                  active ? st.ring + " bg-white/[0.06]" : "border-white/10 bg-[#0A0E17]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{r.regione}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${st.text} bg-black/30`}
                  >
                    {st.badge}
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs text-slate-400">
                  Indice {fmtIndexIt(r.indice)} · {fmtPctIt(r.stimaPct, 2)}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full ${st.bar}`}
                    style={{ width: `${Math.round(r.indice * 100)}%` }}
                  />
                </div>
                <p className="mt-2 font-mono text-[10px] text-slate-500">
                  {fmtNumIt(r.voti)} voti stimati
                </p>
                {regionalGrowthByRegion?.[r.regione] && (
                  <p className="mt-2 font-mono text-[9px] leading-snug text-emerald-300/90">
                    Mag &apos;27:{" "}
                    {formatDecimalIt(
                      regionalGrowthByRegion[r.regione]!.projectedShareMay27Pct,
                      2,
                    )}
                    % ({formatPpSignedIt(regionalGrowthByRegion[r.regione]!.deltaPp, 2)} · +
                    {formatIntIt(regionalGrowthByRegion[r.regione]!.addedVotes)} voti)
                  </p>
                )}
                {hoverCard === r.regione && regionalGrowthByRegion?.[r.regione] && (
                  <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                    <RegionalGrowthMiniChart
                      trajectory={regionalGrowthByRegion[r.regione]!.monthlyTrajectory}
                      height={40}
                      className="h-[40px] w-full"
                    />
                    <p className="mt-1 font-mono text-[8px] text-slate-500">
                      {regionalGrowthByRegion[r.regione]!.primaryGrowthDriver}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>
      ) : null}

      {show03 ? (
      <section
        id="osservatorio-sec-03"
        className="scroll-mt-28 rounded-2xl border border-white/10 bg-[#070B14]/90"
      >
        <header className="border-b border-white/10 px-6 py-4">
          <p className="font-mono text-[10px] tracking-[0.2em] text-amber-300">
            03 // SIMULATORE · PROMESSE FN × PROBLEMI SOCIALI × +CONSENSO
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            {scopeTitle} — conversione elettorale stimata
          </h2>
          {regionalCampaignSummary && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
              <p className="font-mono text-[9px] uppercase text-amber-200/80">
                Simulatore di conversione: se FN risolve i problemi di questa regione
              </p>
              <div className="mt-3 flex flex-wrap gap-4 font-mono text-sm tabular-nums">
                <div>
                  <p className="text-[9px] text-slate-500">Consenso attuale FN</p>
                  <p className="font-bold text-white">
                    {formatDecimalIt(regionalCampaignSummary.currentFnSharePct, 2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500">Guadagno potenziale (top criticità)</p>
                  <p className="font-bold text-emerald-400">
                    +{formatDecimalIt(regionalCampaignSummary.maxCumulativeGainPp, 2)} pp · +
                    {formatIntIt(regionalCampaignSummary.maxCumulativeNewVotes)} voti
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500">Consenso raggiungibile</p>
                  <p className="font-bold text-emerald-300">
                    {formatDecimalIt(regionalCampaignSummary.reachableSharePct, 2)}%
                  </p>
                </div>
                {simulatedGain.totalPp > 0 && (
                  <div>
                    <p className="text-[9px] text-violet-300">Simulazione attiva (1–3 temi)</p>
                    <p className="font-bold text-violet-200">
                      +{formatDecimalIt(simulatedGain.totalPp, 2)} pp · +
                      {formatIntIt(simulatedGain.totalVotes)} voti
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                {regionalCampaignSummary.strategicExplanation}
              </p>
              {selectedScope !== TERRITORY_NAZIONALE && (
                <RegionalPartyHistoryBar
                  history={getRegionalPartyHistory(focusRegionForConversion)}
                  compact
                />
              )}
            </div>
          )}
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-slate-400">
            Radar live (cronaca, Tavily news, social) + motore Promesse FN × storico voto
            regionale × permeabilità elettorale.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setIssueFilter(chip.id)}
                className={`rounded-lg px-2 py-1 font-mono text-[9px] font-semibold ${
                  issueFilter === chip.id
                    ? "bg-amber-500/20 text-amber-100"
                    : "text-slate-400 hover:bg-white/5"
                }`}
              >
                [ {chip.label} ]
              </button>
            ))}
            <button
              type="button"
              disabled={issuesLoading}
              onClick={() => void loadIssues()}
              className="ml-auto rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              [ AGGIORNA RADAR LIVE ]
            </button>
          </div>
          {issuesMeta ? (
            <p className="mt-2 font-mono text-[9px] text-slate-600">{issuesMeta}</p>
          ) : null}
        </header>
        <div className="space-y-4 p-4">
          {issuesLoading && issues.length === 0 ? (
            <p className="text-sm text-slate-500">Caricamento radar…</p>
          ) : null}
          {issues.map((issue) => (
            <IssueActionCard
              key={issue.id}
              issue={issue}
              regionHistory={
                issue.regione === "NAZIONALE"
                  ? getRegionalPartyHistory(focusRegionForConversion)
                  : getRegionalPartyHistory(issue.regione)
              }
              simulated={simulatedIssueIds.includes(issue.id)}
              onToggleSimulate={() => {
                setSimulatedIssueIds((prev) => {
                  if (prev.includes(issue.id)) {
                    return prev.filter((id) => id !== issue.id);
                  }
                  if (prev.length >= 3) return prev;
                  return [...prev, issue.id];
                });
              }}
              onRegister={() => onRegisterIssueEvent(issue)}
            />
          ))}
        </div>
      </section>
      ) : null}
    </div>
  );
}

function SummaryTile({
  title,
  band,
  objective,
  tone,
  count,
  sample,
}: {
  title: string;
  band: string;
  objective: string;
  tone: "emerald" | "amber" | "rose";
  count: number;
  sample: string;
}) {
  const c =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
        ? "text-amber-200"
        : "text-rose-300";
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0E17] p-4">
      <p className={`text-sm font-semibold ${c}`}>{title}</p>
      <p className="mt-1 font-mono text-[10px] text-slate-500">{band}</p>
      <p className="mt-2 font-mono text-2xl font-bold text-white">{count}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{sample || "—"}</p>
      <p className="mt-2 text-[10px] font-medium text-slate-500">Obiettivo: {objective}</p>
    </div>
  );
}

function IssueActionCard({
  issue,
  regionHistory,
  simulated,
  onToggleSimulate,
  onRegister,
}: {
  issue: TerritoryIssue;
  regionHistory: ReturnType<typeof getRegionalPartyHistory>;
  simulated: boolean;
  onToggleSimulate: () => void;
  onRegister: () => void;
}) {
  const conv = issue.conversion;
  const badgeClass =
    conv?.conversionBadge === "ALTA"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
      : conv?.conversionBadge === "MURO_PD"
        ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
        : "border-amber-500/40 bg-amber-500/15 text-amber-200";

  return (
    <article className="space-y-4 rounded-xl border border-white/10 bg-[#0A0E17] p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="font-mono text-[9px] font-bold uppercase text-amber-300">
            Blocco 1 · Problema sociale e dato ufficiale
          </p>
          <p className="mt-1 font-mono text-[9px] text-slate-500">
            {issue.categoria} // {issue.provinciaComune} · {issue.visualizzazioniStimate}
          </p>
          <h4 className="mt-2 text-sm font-semibold text-white">
            {cleanIssueHeadline(issue.titoloProblema)}
          </h4>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            {cleanRssText(issue.sintesiLamentela)}
          </p>
          <p className="mt-3 text-xs text-slate-300">{issue.datoUfficialeModuloB}</p>
          <a
            href={issue.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[11px] text-cyan-400 underline"
          >
            Fonte ↗
          </a>
        </div>
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
          <p className="font-mono text-[9px] font-bold uppercase text-emerald-400">
            Blocco 2 · Promessa di Futuro Nazionale
          </p>
          {conv ? (
            <>
              <p className="mt-2 font-mono text-[10px] font-semibold text-white">
                {conv.fnPromise.id} · {conv.fnPromise.shortTitle}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                {conv.fnPromise.testo}
              </p>
            </>
          ) : null}
          <p className="mt-3 text-xs text-slate-300">
            <strong className="text-white">Dove andare:</strong>{" "}
            {issue.azionePoliticaConsigliata.doveAndare}
          </p>
          <p className="mt-1 text-xs text-slate-300">
            <strong className="text-white">Cosa fare:</strong>{" "}
            {issue.azionePoliticaConsigliata.cosaDire}
          </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 p-3">
          <p className="font-mono text-[9px] font-bold uppercase text-slate-400">
            Blocco 3 · Storico voti & permeabilità
          </p>
          <p className="mt-2 font-mono text-[11px] text-slate-300">
            Bacino Lega+FdI+FI:{" "}
            {formatDecimalIt(
              regionHistory.fdiPct + regionHistory.legaPct + regionHistory.fiPct,
              1,
            )}
            % vs PD: {formatDecimalIt(regionHistory.pdPct, 1)}%
          </p>
          {conv ? (
            <span
              className={`mt-2 inline-flex rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold ${badgeClass}`}
            >
              {conv.conversionBadge === "ALTA"
                ? "ALTA CONVERSIONE"
                : conv.conversionBadge === "MURO_PD"
                  ? "MURO PD (BASSA RESA)"
                  : "INTERVENTO MIRATO"}
            </span>
          ) : null}
          <p className="mt-2 text-[10px] text-slate-500">{conv?.campaignVerdictText}</p>
        </div>
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3">
          <p className="font-mono text-[9px] font-bold uppercase text-violet-200">
            Blocco 4 · Previsione aumento consenso
          </p>
          {conv ? (
            <>
              <p className="mt-2 font-mono text-2xl font-bold text-emerald-300">
                +{formatDecimalIt(conv.potentialGainPp, 2)} pp
              </p>
              <p className="font-mono text-sm text-emerald-200/90">
                +{formatIntIt(conv.potentialNewVotes)} nuovi voti stimati
              </p>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                {conv.voteSourceMix}
              </p>
            </>
          ) : null}
          <button
            type="button"
            onClick={onToggleSimulate}
            className={`mt-3 w-full rounded-lg border px-3 py-2 text-[11px] font-semibold ${
              simulated
                ? "border-emerald-500/60 bg-emerald-500/25 text-emerald-100"
                : "border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20"
            }`}
          >
            {simulated
              ? "Intervento simulato (clic per rimuovere)"
              : "Simula intervento FN su questo problema"}
          </button>
          <button
            type="button"
            onClick={onRegister}
            className="mt-2 w-full rounded-lg border border-white/15 px-3 py-2 text-[10px] text-slate-400 hover:text-white"
          >
            + Registra come evento
          </button>
        </div>
      </div>
    </article>
  );
}
