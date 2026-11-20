"use client";

import { useRealtimeDomain } from "@/components/realtime/RealtimeSyncProvider";
import { RegionalPartyHistoryBar } from "@/components/RegionalPartyHistoryBar";
import { OsservatorioCockpitSidebar } from "@/components/osservatorio/OsservatorioCockpitSidebar";
import { OsservatorioIssueAnalyzePanel } from "@/components/osservatorio/OsservatorioIssueAnalyzePanel";
import type { Region } from "@/lib/engine/constants";
import {
  TERRITORY_NAZIONALE,
  type TerritoryScope,
} from "@/lib/engine/osservatorioTerritoryScope";
import type { ScenarioResult } from "@/lib/engine/types";
import type { TerritoryIssue } from "@/lib/engine/territoryIssuesTypes";
import { buildBackcastRegions, bridgeThemeForCategory } from "@/lib/engine/buildBackcastRegions";
import { computeForecastV4 } from "@/lib/engine/forecastEngineV4";
import { computeStrategicBackcast, type StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import { useActiveStrategicRoute } from "@/lib/state/useActiveStrategicRoute";
import {
  cleanIssueHeadline,
  dedupeIssues,
  enrichIssuesWithConversion,
  formatIssueCardLocality,
  issuePriorityScore,
  orderIssuesForCockpitDisplay,
} from "@/lib/engine/territoryIssuesEngine";
import { filterTerritoryIssuesList } from "@/lib/engine/territoryIssuesReadFilter";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import { territoryBenchmarkLine } from "@/lib/engine/regionBenchmarkMatrix";
import {
  bipCardDisplayLines,
  staffBipLeverForCategory,
} from "@/lib/engine/osservatorioStaffBipLevers";
import { extractNewsSourceLabel } from "@/lib/engine/osservatorioNewsSanitizer";
import { pressDeclarationForIssue } from "@/lib/engine/territoryIssueAnalyzeCopy";
import {
  buildRegionalCampaignSummary,
  cdxSharePct,
  getRegionalPartyHistory,
  validVotesFromScenarioRow,
} from "@/lib/fnProgramAndAffinityEngine";
import { OsservatorioGoogleTrendsTab } from "@/components/osservatorio/OsservatorioGoogleTrendsTab";
import {
  OsservatorioViralReelsTab,
  viralReelsTabLabel,
} from "@/components/osservatorio/OsservatorioViralReelsTab";
import { useLiveGoogleTrends } from "@/components/osservatorio/useLiveGoogleTrends";
import {
  COCKPIT_VERDICT,
  cockpitTierForRegion,
  type CockpitTierFilter,
  type RegionCockpitMetrics,
} from "@/lib/osservatorioCockpitTiers";
import { formatDecimalIt, formatIntIt, formatPpSignedIt } from "@/lib/formatIt";
import { Check, Copy, FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CockpitTab = "problemi" | "google" | "viral";

/** 2×3 card per pagina su laptop; 3×2 su monitor larghi. */
const ISSUES_PER_PAGE = 6;

function categoryPillLabel(cat: TerritoryIssueCategory): string {
  const map: Record<TerritoryIssueCategory, string> = {
    SANITA: "SANITÀ",
    TRASPORTI: "TRASPORTI",
    LAVORO: "LAVORO & IMPRESE",
    SICUREZZA: "SICUREZZA",
    COSTO_VITA: "CARO-VITA",
    TERRITORIO: "AGRICOLTURA",
  };
  return map[cat];
}

function issueFonteLabel(issue: TerritoryIssue): string {
  if (
    issue.canaleVirale &&
    !/google news|radar b\.i\.p|tavily search/i.test(issue.canaleVirale)
  ) {
    return issue.canaleVirale;
  }
  return extractNewsSourceLabel(
    issue.sourceUrl,
    issue.evidence?.feedHint,
    issue.titoloProblema,
  );
}

function paginateIssues<T>(
  items: T[],
  page: number,
  pageSize: number,
): { slice: T[]; totalPages: number; safePage: number; rangeStart: number; rangeEnd: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  const rangeStart = items.length === 0 ? 0 : start + 1;
  const rangeEnd = start + slice.length;
  return { slice, totalPages, safePage, rangeStart, rangeEnd };
}

function regionMetrics(
  scenario: ScenarioResult,
): Map<Region, RegionCockpitMetrics> {
  const map = new Map<Region, RegionCockpitMetrics>();
  for (const row of scenario.righe) {
    const hist = getRegionalPartyHistory(row.regione);
    map.set(row.regione, {
      currentPct: row.stima * 100,
      conversionScore: hist.permeabilitaVannacciScore,
    });
  }
  return map;
}

export function OsservatorioCockpit({
  scenario,
  liveS,
  regione,
  setRegione,
  mainTerritory,
  setMainTerritory,
  onRegisterIssueEvent,
  onOpenMethodology,
  onOpenData,
  onExportPdf: _onExportPdf,
  focusCategory = null,
}: {
  scenario: ScenarioResult;
  liveS: number;
  regione: Region;
  setRegione: (r: Region) => void;
  mainTerritory: TerritoryScope;
  setMainTerritory: (t: TerritoryScope) => void;
  onRegisterIssueEvent: (issue: TerritoryIssue) => void;
  onOpenMethodology: () => void;
  onOpenData: () => void;
  onExportPdf: () => void;
  focusCategory?: TerritoryIssueCategory | null;
}) {
  void _onExportPdf;
  const [tierFilter, setTierFilter] = useState<CockpitTierFilter>("all");
  const [tab, setTab] = useState<CockpitTab>("problemi");
  const [issues, setIssues] = useState<TerritoryIssue[]>([]);
  const [viralCount, setViralCount] = useState<number | null>(null);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [simulatedTrendIds, setSimulatedTrendIds] = useState<string[]>([]);
  const [issuesFetchedAt, setIssuesFetchedAt] = useState<string | null>(null);
  const [issuePage, setIssuePage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<
    TerritoryIssueCategory | "all"
  >("all");
  const [routeOnly, setRouteOnly] = useState(false);
  const { route } = useActiveStrategicRoute();
  const routePlan = useMemo(() => {
    if (!route) return null;
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
  }, [route, scenario]);
  const [analyzeIssue, setAnalyzeIssue] = useState<TerritoryIssue | null>(null);
  const problemiSectionRef = useRef<HTMLDivElement>(null);

  const metricsByRegion = useMemo(() => regionMetrics(scenario), [scenario]);

  const validVotesByRegion = useMemo(() => {
    const map = new Map<Region, number>();
    for (const r of scenario.righe) {
      map.set(
        r.regione,
        validVotesFromScenarioRow(r.voti_di_scenario, r.stima),
      );
    }
    return map;
  }, [scenario]);

  const isNationalOverview = mainTerritory === TERRITORY_NAZIONALE;
  const issuesTerritory: Region | "NAZIONALE" = isNationalOverview
    ? TERRITORY_NAZIONALE
    : regione;
  const displayTerritoryName = isNationalOverview ? "Italia" : regione;

  const nationalKpi = useMemo(() => {
    if (!isNationalOverview) return null;
    let totalIscritti = 0;
    let conversionSum = 0;
    let cdxSum = 0;
    for (const r of scenario.righe) {
      totalIscritti += r.iscritti;
      conversionSum += metricsByRegion.get(r.regione)?.conversionScore ?? 0;
      cdxSum += cdxSharePct(getRegionalPartyHistory(r.regione));
    }
    const n = Math.max(1, scenario.righe.length);
    return {
      currentPct: liveS * 100,
      totalIscritti,
      avgConversionScore: Math.round(conversionSum / n),
      avgCdxPct: cdxSum / n,
    };
  }, [isNationalOverview, scenario.righe, metricsByRegion, liveS]);

  const row = scenario.righe.find((r) => r.regione === regione);
  const validVotes = row
    ? validVotesFromScenarioRow(row.voti_di_scenario, row.stima)
    : 0;
  const summary = row
    ? buildRegionalCampaignSummary(regione, row.stima * 100, validVotes)
    : null;
  const hist = getRegionalPartyHistory(regione);
  const tier = isNationalOverview ? "verde" : cockpitTierForRegion(regione);
  const baseMetrics = metricsByRegion.get(regione);

  const trendsTerritory = isNationalOverview ? TERRITORY_NAZIONALE : regione;
  const {
    trends: liveTrends,
    loading: trendsLoading,
    fetchedAt: trendsFetchedAt,
    source: trendsSource,
  } = useLiveGoogleTrends(trendsTerritory);

  const regionalCurrentPct = baseMetrics?.currentPct ?? 0;
  const nationalPct = liveS * 100;
  const currentPct = isNationalOverview ? nationalPct : regionalCurrentPct;
  const vsNationalPp = isNationalOverview ? 0 : regionalCurrentPct - nationalPct;
  const conversionScore = isNationalOverview
    ? (nationalKpi?.avgConversionScore ?? 0)
    : (baseMetrics?.conversionScore ?? hist.permeabilitaVannacciScore);
  const displayIscritti = isNationalOverview
    ? (nationalKpi?.totalIscritti ?? 0)
    : (row?.iscritti ?? 0);
  const headerVerdict = isNationalOverview
    ? "QUADRO NAZIONALE — Cronaca live dalle 20 regioni, ordinata per priorità di campagna e conversione territoriale"
    : COCKPIT_VERDICT[tier];
  const activeRegionMetrics = useMemo(
    () => ({
      currentPct,
      conversionScore,
    }),
    [currentPct, conversionScore],
  );

  const loadIssues = useCallback(async () => {
    setLoadingIssues(true);
    try {
      const vvQuery = isNationalOverview ? 0 : validVotes;
      const res = await fetch(
        `/api/territory/issues?region=${encodeURIComponent(issuesTerritory)}&validVotes=${vvQuery}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        issues: TerritoryIssue[];
        liveNews?: TerritoryIssue[];
        fetchedAt?: string;
      };
      const filtered = filterTerritoryIssuesList(data.issues ?? [], "auto");
      const enriched = enrichIssuesWithConversion(
        filtered,
        issuesTerritory,
        isNationalOverview ? 0 : validVotes,
        0.36,
        validVotesByRegion,
      );
      const merged = orderIssuesForCockpitDisplay(dedupeIssues(enriched));
      setIssues(merged);
      if (focusCategory) {
        const match = merged.find(
          (issue) =>
            issue.categoria === focusCategory &&
            (issue.regione === regione || issue.regione === "NAZIONALE"),
        );
        if (match) {
          setAnalyzeIssue(match);
          setTab("problemi");
        }
      }
      setIssuesFetchedAt(data.fetchedAt ?? null);
      setIssuePage(1);
    } catch {
      setIssues([]);
      setIssuePage(1);
    } finally {
      setLoadingIssues(false);
    }
  }, [
    issuesTerritory,
    isNationalOverview,
    validVotes,
    validVotesByRegion,
    focusCategory,
    regione,
  ]);

  useEffect(() => {
    setSimulatedTrendIds([]);
    setCategoryFilter("all");
    void loadIssues();
    setIssuePage(1);
  }, [loadIssues, issuesTerritory]);

  useRealtimeDomain("news", () => {
    void loadIssues();
  });

  const categoryCounts = useMemo(() => {
    const counts = new Map<TerritoryIssueCategory, number>();
    for (const issue of issues) {
      counts.set(issue.categoria, (counts.get(issue.categoria) ?? 0) + 1);
    }
    return counts;
  }, [issues]);

  const filteredIssues = useMemo(() => {
    const byCategory =
      categoryFilter === "all"
        ? issues
        : issues.filter((issue) => issue.categoria === categoryFilter);
    if (!routeOnly || !routePlan) return byCategory;
    return byCategory.filter((issue) => routeLeverVotes(issue, routePlan) != null);
  }, [issues, categoryFilter, routeOnly, routePlan]);

  const issuesPagination = useMemo(
    () => paginateIssues(filteredIssues, issuePage, ISSUES_PER_PAGE),
    [filteredIssues, issuePage],
  );

  useEffect(() => {
    if (issuesPagination.safePage !== issuePage) {
      setIssuePage(issuesPagination.safePage);
    }
  }, [issuesPagination.safePage, issuePage]);

  const goIssuePage = useCallback((next: number) => {
    setIssuePage(next);
    problemiSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const cdx = cdxSharePct(hist);
  const sinistraPdM5s = hist.pdPct + hist.m5sPct;

  useEffect(() => {
    let cancelled = false;
    const regionQs = encodeURIComponent(issuesTerritory);
    void fetch(`/api/viral-reels?region=${regionQs}&mode=cache`)
      .then((r) => r.json())
      .then((data: { items?: unknown[] }) => {
        if (cancelled) return;
        setViralCount(Array.isArray(data.items) ? data.items.length : 0);
      })
      .catch(() => {
        if (!cancelled) setViralCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [issuesTerritory]);

  const tabs: { id: CockpitTab; label: string; short: string }[] = [
    { id: "problemi", label: "1. Problemi Reali & Cosa Dire sul Campo", short: "Problemi" },
    { id: "google", label: "2. Temi e Domande dei Cittadini (Repertorio)", short: "Domande" },
    { id: "viral", label: viralReelsTabLabel(viralCount), short: "Video" },
  ];

  return (
    <>
      <OsservatorioIssueAnalyzePanel
        issue={analyzeIssue}
        onClose={() => setAnalyzeIssue(null)}
        onRegister={() => {
          if (analyzeIssue) onRegisterIssueEvent(analyzeIssue);
        }}
      />
    <div className="mx-auto w-full space-y-3 pb-28 pt-0">
          <div className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3.5 py-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold tracking-tight text-[var(--ink-primary)] lg:text-[1.35rem]">
                  {displayTerritoryName}
                </h1>
                <p className="mt-1 max-w-2xl text-[11px] font-medium leading-snug text-slate-300 lg:text-xs">
                  {headerVerdict}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onOpenMethodology}
                  className="rounded-lg border border-white/15 bg-black/20 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/[0.06]"
                >
                  Programma B.I.P. &amp; Metodologia
                </button>
                <button
                  type="button"
                  onClick={onOpenData}
                  className="rounded-lg border border-white/15 bg-black/20 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/[0.06]"
                >
                  Dati &amp; CSV
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-white/[0.08] pt-3 sm:grid-cols-3 sm:gap-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
                  {isNationalOverview
                    ? "Consenso nazionale S (Ott '26)"
                    : "Consenso oggi (Ott '26)"}
                </p>
                <p className="mt-0.5 font-mono text-xl font-bold text-white lg:text-2xl">
                  {formatDecimalIt(currentPct, 2)}%
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                  {formatIntIt(displayIscritti)} tesserati FN
                  {isNationalOverview ? " · 20 regioni" : null}
                </p>
                {!isNationalOverview ? (
                  <p
                    className={`mt-0.5 font-mono text-[11px] tabular-nums ${
                      vsNationalPp >= 0 ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {formatPpSignedIt(vsNationalPp, 2)} vs media Italia (
                    {formatDecimalIt(nationalPct, 2)}%)
                  </p>
                ) : null}
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
                  Indice affinità bacino &amp; priorità
                </p>
                <p
                  className="mt-0.5 font-mono text-2xl font-bold text-emerald-400 lg:text-[1.65rem]"
                  title="Indice Affinità Bacino: peso centrodestra + astensione contendibile nella regione (0–100). Non è una probabilità di vittoria."
                >
                  Indice Affinità Bacino: {conversionScore}/100
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-300">
                  Bacino FdI+Lega:{" "}
                  {formatDecimalIt(
                    isNationalOverview ? (nationalKpi?.avgCdxPct ?? 0) : cdx,
                    1,
                  )}
                  % ·{" "}
                  {loadingIssues && !issues.length
                    ? "caricamento articoli…"
                    : `${issues.length} articoli pertinenti rilevati`}
                </p>
                {issues.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilter("all");
                        setIssuePage(1);
                      }}
                      className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide transition ${
                        categoryFilter === "all"
                          ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                          : "border-white/10 bg-black/25 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Tutti ({issues.length})
                    </button>
                    {route ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRouteOnly((on) => !on);
                          setIssuePage(1);
                        }}
                        className={`rounded-full border px-2 py-1 text-[11px] ${
                          routeOnly
                            ? "border-[var(--signal-positive)] bg-[var(--surface-2)] text-[var(--ink-primary)]"
                            : "border-[var(--border-subtle)] text-[var(--ink-muted)]"
                        }`}
                      >
                        Solo leve Rotta {formatDecimalIt(route.targetPct, 1)}%
                      </button>
                    ) : null}
                    {(
                      [
                        "SICUREZZA",
                        "SANITA",
                        "LAVORO",
                        "TRASPORTI",
                        "COSTO_VITA",
                        "TERRITORIO",
                      ] as TerritoryIssueCategory[]
                    )
                      .filter((cat) => (categoryCounts.get(cat) ?? 0) > 0)
                      .map((cat) => {
                        const count = categoryCounts.get(cat) ?? 0;
                        const on = categoryFilter === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setCategoryFilter(cat);
                              setIssuePage(1);
                            }}
                            className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide transition ${
                              on
                                ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                                : "border-white/10 bg-black/25 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {categoryPillLabel(cat)} ({count})
                          </button>
                        );
                      })}
                  </div>
                ) : null}
              </div>
              <div>
                {isNationalOverview ? (
                  <>
                    <p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
                      Overview nazionale
                    </p>
                    <p className="mt-1 text-[12px] font-medium leading-snug text-slate-100">
                      Notizie sui problemi del territorio: tutte le fonti regionali in un&apos;unica
                      lista per priorità elettorale.
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Seleziona una regione nel menu per il dettaglio storico e
                      territoriale.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
                      Cosa hanno votato in questa regione
                    </p>
                    <RegionalPartyHistoryBar history={hist} compact />
                    <p className="mt-1.5 text-[11px] font-medium text-slate-200">
                      <strong className="text-white">Totale Centrodestra:</strong>{" "}
                      {formatDecimalIt(cdx, 1)}%{" "}
                      <span className="text-slate-500">vs</span>{" "}
                      <strong className="text-white">Sinistra (PD+M5S):</strong>{" "}
                      {formatDecimalIt(sinistraPdM5s, 1)}%
                    </p>
                  </>
                )}
              </div>
            </div>
            {summary && !isNationalOverview ? (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                {summary.strategicExplanation}
              </p>
            ) : null}
          </div>

          <div
            className="flex w-full gap-2 overflow-x-auto lg:overflow-visible"
            role="tablist"
            aria-label="Sezioni cockpit"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`min-h-11 shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold leading-snug transition lg:min-h-0 lg:flex-1 lg:text-[12px] ${
                  tab === t.id
                    ? "border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--ink-primary)]"
                    : "border-[var(--border-subtle)] bg-transparent text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                }`}
              >
                <span className="lg:hidden">{t.short}</span>
                <span className="hidden lg:inline">{t.label}</span>
              </button>
            ))}
          </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="order-2 min-w-0 xl:order-1">
        {tab === "google" ? (
          <OsservatorioGoogleTrendsTab
            regione={regione}
            trendsTerritoryLabel={displayTerritoryName}
            trends={liveTrends}
            loading={trendsLoading}
            fetchedAt={trendsFetchedAt}
            source={trendsSource}
            validVotes={validVotes}
            simulatedTrendIds={simulatedTrendIds}
            onToggleTrendSimulate={(id) => {
              setSimulatedTrendIds((prev) => {
                if (prev.includes(id)) return prev.filter((x) => x !== id);
                if (prev.length >= 3) return prev;
                return [...prev, id];
              });
            }}
            mainTerritory={mainTerritory}
            liveS={liveS}
            scenario={scenario}
            tierFilter={tierFilter}
            setTierFilter={setTierFilter}
            metricsByRegion={metricsByRegion}
            activeRegionMetrics={activeRegionMetrics}
            setRegione={setRegione}
            setMainTerritory={setMainTerritory}
          />
        ) : tab === "viral" ? (
          <div className="flex min-w-0 flex-col gap-4">
            <OsservatorioViralReelsTab
              regionParam={issuesTerritory}
              territoryLabel={
                isNationalOverview ? "Tutta l'Italia · Quadro Nazionale" : regione
              }
              onItemsCount={setViralCount}
            />
          </div>
        ) : (
        <div
          className="flex min-w-0 flex-col gap-4"
        >
          {tab === "problemi" && (
            <div ref={problemiSectionRef} className="flex flex-col gap-4 scroll-mt-24">
              {loadingIssues && !issues.length ? (
                <p className="text-sm text-slate-500">Caricamento problemi…</p>
              ) : null}
              <div className="shrink-0">
                {filteredIssues.length > 0 ? (
                  <IssuesPageBar
                    safePage={issuesPagination.safePage}
                    totalPages={issuesPagination.totalPages}
                    rangeStart={issuesPagination.rangeStart}
                    rangeEnd={issuesPagination.rangeEnd}
                    total={filteredIssues.length}
                    onPage={goIssuePage}
                    regionLabel={
                      isNationalOverview ? "Tutta l'Italia · overview nazionale" : regione
                    }
                    issuesCount={filteredIssues.length}
                    pageLabel={
                      filteredIssues.length > ISSUES_PER_PAGE
                        ? `${issuesPagination.safePage}/${issuesPagination.totalPages}`
                        : undefined
                    }
                    fetchedAt={issuesFetchedAt}
                    showRegionMeta
                  />
                ) : null}
              </div>
              <div className="grid grid-cols-1 content-start gap-3 lg:grid-cols-2 lg:gap-3 2xl:grid-cols-3 2xl:gap-3">
                {issuesPagination.slice.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    showRegionBadge={isNationalOverview}
                    routeLeverVotes={routeLeverVotes(issue, routePlan)}
                    onAnalyze={() => setAnalyzeIssue(issue)}
                  />
                ))}
              </div>
              {filteredIssues.length === 0 && !loadingIssues ? (
                <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-slate-400">
                  Nessuna emergenza per il filtro selezionato.
                </p>
              ) : null}
              <div className="shrink-0">
                {filteredIssues.length > 0 ? (
                  <IssuesPageBar
                    safePage={issuesPagination.safePage}
                    totalPages={issuesPagination.totalPages}
                    rangeStart={issuesPagination.rangeStart}
                    rangeEnd={issuesPagination.rangeEnd}
                    total={filteredIssues.length}
                    onPage={goIssuePage}
                  />
                ) : null}
              </div>
            </div>
          )}

        </div>
        )}
        </div>

        <div className="order-1 xl:sticky xl:top-16 xl:order-2 xl:max-h-[calc(100dvh-5rem)] xl:overflow-y-auto">
          <OsservatorioCockpitSidebar
            regione={regione}
            mainTerritory={mainTerritory}
            liveS={liveS}
            scenario={scenario}
            tierFilter={tierFilter}
            setTierFilter={setTierFilter}
            metricsByRegion={metricsByRegion}
            activeRegionMetrics={activeRegionMetrics}
            onSelectRegion={(r) => {
              setRegione(r);
              setMainTerritory(r);
            }}
            onSelectNazionale={() => setMainTerritory(TERRITORY_NAZIONALE)}
            flatRegionSelection={tab !== "problemi"}
          />
        </div>
      </div>
    </div>
    </>
  );
}

function IssuesPageBar({
  safePage,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onPage,
  showRegionMeta,
  regionLabel,
  issuesCount,
  pageLabel,
  fetchedAt,
}: {
  safePage: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onPage: (page: number) => void;
  showRegionMeta?: boolean;
  regionLabel?: string;
  issuesCount?: number;
  pageLabel?: string;
  fetchedAt?: string | null;
}) {
  const pages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const set = new Set<number>([1, totalPages, safePage, safePage - 1, safePage + 1]);
    return [...set].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  }, [safePage, totalPages]);

  return (
    <nav
      className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#0A0E17] px-3 py-2.5"
      aria-label="Paginazione problemi"
    >
      {showRegionMeta && regionLabel != null && issuesCount != null ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
          <p className="text-[11px] text-slate-400 lg:text-xs">
            Problemi reali in {regionLabel} · {issuesCount} segnalazioni totali
            {pageLabel ? (
              <span className="text-slate-500"> · pagina {pageLabel}</span>
            ) : null}
          </p>
          {fetchedAt ? (
            <p className="font-mono text-[10px] text-slate-500">
              Aggiornato{" "}
              {new Date(fetchedAt).toLocaleString("it-IT", {
                timeZone: "Europe/Rome",
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "short",
              })}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="font-mono text-[10px] text-slate-500 lg:text-[11px]">
        {rangeStart}–{rangeEnd} di {total}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPage(safePage - 1)}
          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white/[0.06] lg:text-[11px]"
        >
          Precedente
        </button>
        <div className="flex items-center gap-0.5">
          {pages.map((p, idx) => {
            const prev = pages[idx - 1];
            const gap = prev != null && p - prev > 1;
            return (
              <span key={p} className="flex items-center gap-0.5">
                {gap ? (
                  <span className="px-1 font-mono text-[10px] text-slate-600" aria-hidden>
                    …
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-current={p === safePage ? "page" : undefined}
                  onClick={() => onPage(p)}
                  className={`min-w-[2rem] rounded-lg px-2 py-1 font-mono text-[11px] ${
                    p === safePage
                      ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40"
                      : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {p}
                </button>
              </span>
            );
          })}
        </div>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPage(safePage + 1)}
          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white/[0.06] lg:text-[11px]"
        >
          Successiva
        </button>
      </div>
      </div>
    </nav>
  );
}

function priorityTone(score: number): {
  badge: string;
  bar: string;
} {
  if (score >= 80) {
    return {
      badge: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
      bar: "from-emerald-400 to-cyan-400",
    };
  }
  if (score >= 60) {
    return {
      badge: "border-amber-400/40 bg-amber-500/15 text-amber-200",
      bar: "from-amber-400 to-orange-400",
    };
  }
  return {
    badge: "border-slate-500/40 bg-slate-500/15 text-slate-300",
    bar: "from-slate-400 to-slate-500",
  };
}

function routeLeverVotes(issue: TerritoryIssue, plan: StrategicBackcastResult | null): number | null {
  if (!plan) return null;
  const theme = bridgeThemeForCategory(issue.categoria);
  const themeHit = plan.themes.find((row) => row.theme === theme);
  const front = plan.regions.some(
    (row) => row.role === "FRONTE_PRIORITARIO" && row.region === issue.regione,
  );
  if (!themeHit && !front) return null;
  return themeHit?.votes ?? 0;
}

function IssueCard({
  issue,
  showRegionBadge,
  routeLeverVotes: leverVotes = null,
  onAnalyze,
}: {
  issue: TerritoryIssue;
  showRegionBadge?: boolean;
  routeLeverVotes?: number | null;
  onAnalyze: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const locality = formatIssueCardLocality(issue.regione, issue.provinciaComune);
  const regionBadge =
    showRegionBadge && issue.regione !== "NAZIONALE" ? issue.regione : null;
  const score = issuePriorityScore(issue);
  const tone = priorityTone(score);
  const fonte = issueFonteLabel(issue);
  const isViralSocial =
    /tiktok|instagram|reel|shorts|video virale|canale virale/i.test(
      `${issue.canaleVirale ?? ""} ${issue.sourceUrl ?? ""} ${fonte}`,
    );
  const datoReale =
    issue.datoUfficialeModuloB?.trim() ||
    territoryBenchmarkLine(issue.regione, issue.categoria);
  // Sempre dalla categoria card: evita badge Sicurezza su news Sanità (cache/legacy).
  const staff = staffBipLeverForCategory(
    issue.categoria,
    `${issue.titoloProblema} ${issue.sintesiLamentela}`,
  );
  const lever = bipCardDisplayLines(staff.badge, staff.measure);

  async function copyDraft() {
    const text =
      issue.bipSolutions?.[0]?.pressDeclaration?.trim() ||
      pressDeclarationForIssue(issue);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="flex h-full flex-col justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 transition-colors hover:border-[var(--border-default)]">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-[12px] text-[var(--ink-secondary)]">
            {categoryPillLabel(issue.categoria)}
            {regionBadge ? ` · ${regionBadge}` : ""} · {locality}
            <span className="text-[var(--ink-muted)]"> · {fonte}</span>
            {isViralSocial ? " · virale" : ""}
          </p>
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${tone.badge}`}
          >
            Priorità {score}/100
          </span>
          {leverVotes != null ? (
            <span
              className="shrink-0 rounded border border-[var(--border-default)] px-1.5 py-0.5 text-[11px] text-[var(--ink-secondary)]"
              title={`IPOTESI: aiuta a sbloccare ${formatIntIt(leverVotes)} voti di bacino nel piano attivo`}
            >
              LEVA ROTTA
            </span>
          ) : null}
        </div>

        <h3 className="text-[15px] font-semibold leading-snug text-[var(--ink-primary)]">
          {cleanIssueHeadline(issue.titoloProblema)}
        </h3>
        <p className="rounded-md bg-[var(--surface-2)] px-2.5 py-2 font-mono text-[12px] tabular-nums leading-snug text-[var(--ink-secondary)]">
          {datoReale}
        </p>

        <div className="border-l-2 border-[var(--signal-positive)] pl-3">
          <p className="text-[13px] font-semibold leading-snug text-[var(--ink-primary)]">
            {lever.title}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-[var(--ink-secondary)]">{lever.body}</p>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onAnalyze}
          className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-2)] px-2 py-2 text-[12px] font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--signal-positive)]"
        >
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">Apri Dossier</span>
        </button>
        <button
          type="button"
          onClick={() => void copyDraft()}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 font-mono text-[11px] font-semibold transition-colors ${
            copied
              ? "border-[var(--signal-positive)] text-[var(--signal-positive)]"
              : "border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
          }`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
          {copied ? "Copiato" : "Copia"}
        </button>
      </div>
    </article>
  );
}
