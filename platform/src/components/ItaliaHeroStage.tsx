"use client";

import { ItalyMap, type MapColorMode } from "@/components/ItalyMap";
import {
  NationalIntelligencePanel,
  type ScenarioPriorityView,
} from "@/components/NationalIntelligencePanel";
import {
  ScenarioGrowthForecastPanel,
  SIDEBAR_SCROLL,
} from "@/components/ScenarioGrowthForecastPanel";
import { FlussiMatrix2026Panel } from "@/components/FlussiMatrix2026Panel";
import {
  OFFICIAL_S_SOURCE_LABEL,
  OFFICIAL_S_SOURCE_URL,
  type FlussiIpsos,
} from "@/lib/engine/defaults";
import type { FlussiMatrixId } from "@/lib/politicalModel";
import type { GrowthRegimeId, RegionalGrowthForecast } from "@/lib/politicalModel";
import type { InstitutionalRow } from "@/lib/engine/calculate";
import type { Region } from "@/lib/engine/constants";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { FnConfig, ScenarioResult } from "@/lib/engine/types";
import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import { ConsensoMovementInfo } from "@/components/ConsensoMovementInfo";
import type { LiveConsensoPayload } from "@/lib/engine/pollTypes";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import type { GrowthEvidence } from "@/lib/engine/growthTrajectory";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { TacticalCard } from "@/components/ui/TacticalCard";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import type { ScenarioRegionalV4View } from "@/lib/scenarioRegionalV4";
import { useCallback, useMemo, useState } from "react";

const SPARK_MARKS = ["2026-02-26", "2026-06-18", "2026-07-30", "2026-09-08"];

function peakCaption(isoDate: string): string {
  const months = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const date = new Date(`${isoDate}T12:00:00Z`);
  const month = months[date.getUTCMonth()] ?? "";
  const year = String(date.getUTCFullYear()).slice(2);
  return `${month} '${year}`;
}

function ConsensoSparkline({ points }: { points: number[] }) {
  const w = 118;
  const h = 44;
  const finite = points.filter((point) => Number.isFinite(point));
  if (finite.length < 2) return null;
  const min = Math.min(...finite) - 0.4;
  const max = Math.max(...finite) + 0.4;
  const span = max - min || 1;
  const peak = Math.max(...finite);
  const coords = finite.map((point, index) => {
    const x = 2 + (index / (finite.length - 1)) * (w - 4);
    const y = h - 4 - ((point - min) / span) * (h - 8);
    return { x, y };
  });
  const last = coords[coords.length - 1]!;
  const peakY = h - 4 - ((peak - min) / span) * (h - 8);
  const area = `M ${coords[0]!.x},${h - 2} L ${coords
    .map((c) => `${c.x},${c.y}`)
    .join(" L ")} L ${last.x},${h - 2} Z`;
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-11 w-[7.4rem]" aria-hidden>
      <defs>
        <linearGradient id="fn-consenso-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#fn-consenso-area)" />
      <line
        x1={2}
        x2={w - 2}
        y1={peakY}
        y2={peakY}
        stroke="#94a3b8"
        strokeOpacity={0.45}
        strokeDasharray="2 3"
        strokeWidth={0.8}
      />
      <polyline
        points={line}
        fill="none"
        stroke="#34d399"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last.x} cy={last.y} r="5" fill="#22d3ee" fillOpacity={0.18} />
      <circle cx={last.x} cy={last.y} r="2.3" fill="#22d3ee" className="fn-map-reticle-dot" />
    </svg>
  );
}

function TickerStatusMark({
  classificazione,
}: {
  classificazione: RegionPollResult["classificazione"];
}) {
  const color =
    classificazione === "sicura"
      ? "bg-emerald-400"
      : classificazione === "contesa"
        ? "bg-amber-400"
        : "bg-rose-500";
  return <span className={`mr-2 inline-block h-1.5 w-1.5 rotate-45 ${color}`} aria-hidden />;
}

function LiveTicker({ poll }: { poll: RegionPollResult[] }) {
  const sorted = useMemo(
    () => [...poll].sort((a, b) => b.piHat - a.piHat),
    [poll],
  );
  const segment = (
    <span className="inline-flex items-center">
      {sorted.map((p, i) => (
        <span key={p.regione} className="inline-flex items-center">
          <TickerStatusMark classificazione={p.classificazione} />
          <span className="font-semibold text-[var(--ink-secondary)]">{p.regione.toUpperCase()}</span>
          <span className="ml-1.5 font-mono tabular-nums text-[var(--signal-positive)]">
            {(p.piHat * 100).toFixed(2).replace(".", ",")}%
          </span>
          {i < sorted.length - 1 && <span className="mx-3 text-slate-700">{"//"}</span>}
        </span>
      ))}
    </span>
  );
  return (
    <div className="fn-live-ticker-fade flex min-w-0 flex-1 overflow-hidden" tabIndex={0}>
      <div className="fn-live-ticker flex whitespace-nowrap font-mono text-[10px] tabular-nums">
        <span className="pr-12">{segment}</span>
        <span className="pr-12" aria-hidden>
          {segment}
        </span>
      </div>
    </div>
  );
}

export function ItaliaHeroStage({
  scenario,
  poll,
  mapValues,
  mapMode,
  selectedRegion,
  onSelectRegion,
  hoveredRegion,
  onHoverRegion,
  classFilter,
  onClassFilterChange,
  pollByRegion,
  votesByRegion,
  flussiIpsos,
  flussiMatrixId,
  onSelectFlussiMatrix,
  onAdjustInst,
  onResetInstRegion,
  fnConfig,
  regionQuickDelta,
  baselineScenario,
  growthRegime,
  onGrowthRegimeChange,
  regionalGrowthByRegion,
  sLiveEnabled,
  liveConsenso,
  liveConsensoLoading,
  onOpenDossier,
}: {
  scenario: ScenarioResult;
  poll: RegionPollResult[];
  mapValues: Record<string, number>;
  mapMode: MapColorMode;
  selectedRegion: string | null;
  onSelectRegion: (r: string | null) => void;
  hoveredRegion: string | null;
  onHoverRegion: (r: string | null) => void;
  classFilter: "all" | RegionPollResult["classificazione"];
  onClassFilterChange: (f: "all" | RegionPollResult["classificazione"]) => void;
  pollByRegion: Record<string, RegionPollResult>;
  votesByRegion: Record<string, number>;
  flussiIpsos: FlussiIpsos;
  flussiMatrixId: FlussiMatrixId;
  onSelectFlussiMatrix: (id: FlussiMatrixId) => void;
  onAdjustInst?: (carica: keyof InstitutionalRow, delta: number) => void;
  onResetInstRegion?: () => void;
  fnConfig?: FnConfig;
  regionQuickDelta?: Partial<InstitutionalRow>;
  baselineScenario?: ScenarioResult;
  growthRegime: GrowthRegimeId;
  onGrowthRegimeChange: (r: GrowthRegimeId) => void;
  regionalGrowthByRegion: Record<string, RegionalGrowthForecast>;
  sLiveEnabled?: boolean;
  onSLiveEnabledChange?: (enabled: boolean) => void;
  liveConsenso?: LiveConsensoPayload | null;
  liveConsensoLoading?: boolean;
  onOpenDossier?: (region: Region, category: TerritoryIssueCategory) => void;
}) {
  const { parametri } = scenario;
  const sourceLabel =
    sLiveEnabled && liveConsenso?.sourceLabel
      ? liveConsenso.sourceLabel
      : OFFICIAL_S_SOURCE_LABEL;
  const sourceUrl =
    sLiveEnabled && liveConsenso?.sourceUrl
      ? liveConsenso.sourceUrl
      : OFFICIAL_S_SOURCE_URL;
  const [surgeKey, setSurgeKey] = useState(0);
  const [newsHeadlines, setNewsHeadlines] = useState<string[]>([]);
  const [regionalV4ByRegion, setRegionalV4ByRegion] = useState<
    Record<string, ScenarioRegionalV4View>
  >({});
  const [regionalV4AsOf, setRegionalV4AsOf] = useState(() => new Date());
  const [priorityView, setPriorityView] = useState<ScenarioPriorityView>("oggi");
  const animS = useAnimatedNumber(parametri.S * 100);
  const consensoPct = parametri.S * 100;
  const peak = FN_SUPERMEDIA_CONSENSO_SERIES.reduce((best, point) =>
    point.pct > best.pct ? point : best,
  );
  const spark = [
    ...SPARK_MARKS.map(
      (iso) => FN_SUPERMEDIA_CONSENSO_SERIES.find((point) => point.isoDate === iso)?.pct ?? consensoPct,
    ),
    consensoPct,
  ];
  const sopraSoglia = poll.filter((row) => row.piHat >= 0.03).length;

  const handleSelectMatrix = (id: FlussiMatrixId) => {
    setSurgeKey((k) => k + 1);
    onSelectFlussiMatrix(id);
  };

  const handleAdjust = (carica: keyof InstitutionalRow, delta: number) => {
    onAdjustInst?.(carica, delta);
  };

  const scenarioRow = selectedRegion
    ? scenario.righe.find((r) => r.regione === selectedRegion)
    : undefined;
  const baselineRow = selectedRegion
    ? baselineScenario?.righe.find((r) => r.regione === selectedRegion)
    : undefined;

  const focusRegion = hoveredRegion ?? selectedRegion;

  const handleRegionalV4Map = useCallback(
    (payload: { map: Record<string, ScenarioRegionalV4View>; asOf: Date }) => {
      setRegionalV4ByRegion(payload.map);
      setRegionalV4AsOf(payload.asOf);
    },
    [],
  );

  const displayMapValues = useMemo(() => {
    if (priorityView !== "mag27" || Object.keys(regionalV4ByRegion).length === 0) {
      return mapValues;
    }
    return Object.fromEntries(
      Object.entries(regionalV4ByRegion).map(([regione, row]) => [regione, row.mag27BasePct]),
    );
  }, [mapValues, priorityView, regionalV4ByRegion]);

  const handleEvidence = useCallback((evidence: GrowthEvidence) => {
    const next = evidence.newsHeadlines ?? [];
    setNewsHeadlines((prev) => {
      if (
        prev.length === next.length &&
        prev.every((line, i) => line === next[i])
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  return (
    <section
      className="fn-scenario-stage relative flex h-dvh w-full max-w-full flex-col gap-2.5 overflow-hidden bg-[#070A10] px-3 pb-2 pt-[calc(3.5rem+env(safe-area-inset-top))] max-lg:h-auto max-lg:min-h-dvh max-lg:overflow-y-auto max-lg:pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
      aria-label="Cabina di regia nazionale"
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)_360px] xl:grid-cols-[320px_minmax(0,1fr)_420px]">
      <aside
        aria-label="Consenso e previsione"
        className={`fn-scenario-metrics order-2 flex h-full min-h-0 flex-col gap-2.5 overflow-y-auto lg:order-1 ${SIDEBAR_SCROLL}`}
      >
        <TacticalCard className="divide-y divide-[#1B2436] rounded-xl !p-0">
          <div className="relative z-[2] p-4">
            <p className="font-mono text-[10px] tracking-[0.15em] text-[var(--ink-muted)]">
              CONSENSO NAZIONALE
            </p>
            <div className="mt-2">
              <div className="flex items-start gap-1.5">
                <p className="font-mono text-[44px] font-bold leading-none tracking-tighter text-white">
                  {liveConsensoLoading && !liveConsenso ? (
                    <span className="text-[22px] text-slate-400">
                      Caricamento dati in corso…
                    </span>
                  ) : (
                    <AnimatedNumber value={animS} decimals={2} suffix="%" />
                  )}
                </p>
                {sLiveEnabled && liveConsenso?.movementBrief ? (
                  <ConsensoMovementInfo brief={liveConsenso.movementBrief} />
                ) : null}
              </div>
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-block font-mono text-[11px] leading-snug text-cyan-400/90 underline decoration-cyan-500/30 underline-offset-2 hover:text-cyan-300"
                >
                  Fonti del consenso ↗
                </a>
              ) : (
                <p className="mt-1.5 font-mono text-[11px] leading-snug text-cyan-400/90">
                  Fonte: {sourceLabel}
                </p>
              )}
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="min-w-0 font-mono text-[12px] leading-snug text-[var(--ink-secondary)]">
                  Picco {peakCaption(peak.isoDate)}
                  <span className="mt-0.5 block text-[15px] font-semibold tabular-nums text-white">
                    {formatDecimalIt(peak.pct, 2)}%
                  </span>
                </p>
                <ConsensoSparkline points={spark} />
              </div>
            </div>
            <div className="fn-consensus-stats mt-4 grid grid-cols-3 divide-x divide-[#1B2436] font-mono text-[10px] tabular-nums">
              <div className="min-w-0 pr-2">
                <p className="leading-tight text-[var(--ink-muted)]">TESSERATI</p>
                <p className="mt-1 text-slate-100">{formatIntIt(parametri.iscritti_attribuiti)}</p>
              </div>
              <div className="min-w-0 px-2">
                <p className="leading-tight text-[var(--ink-muted)]">COMITATI</p>
                <p className="mt-1 text-slate-100">{formatIntIt(parametri.comitati)}</p>
              </div>
              <div className="min-w-0 pl-2">
                <p className="leading-tight text-[var(--ink-muted)]">SOPRA 3%</p>
                <p className="mt-1 text-emerald-300">
                  {liveConsensoLoading && poll.length === 0
                    ? "Fonte in aggiornamento"
                    : poll.length === 0
                      ? "Dato non disponibile"
                      : `${sopraSoglia} / ${poll.length}`}
                </p>
              </div>
            </div>
          </div>

          <ScenarioGrowthForecastPanel
            scenario={scenario}
            poll={poll}
            flussiIpsos={flussiIpsos}
            regime={growthRegime}
            onRegimeChange={onGrowthRegimeChange}
            focusRegion={focusRegion}
            onRegionalV4Map={handleRegionalV4Map}
            onEvidence={handleEvidence}
            pollsLoading={Boolean(liveConsensoLoading && !liveConsenso)}
          />

          <details className="fn-source-disclosure">
            <summary>Provenienza degli elettori <span aria-hidden="true">+</span></summary>
            <FlussiMatrix2026Panel
            flussiIpsos={flussiIpsos}
            activeMatrixId={flussiMatrixId}
            onSelectMatrix={handleSelectMatrix}
            />
          </details>
        </TacticalCard>
      </aside>

      <div className="fn-scenario-map relative order-1 flex h-[min(58dvh,440px)] min-h-[300px] flex-col overflow-hidden rounded-xl border border-slate-800/70 bg-[#050912]/70 lg:order-2 lg:h-full lg:min-h-0">
        <div className="flex flex-col gap-1 border-b border-white/[0.06] px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-3.5">
          <p className="font-mono text-[11px] tracking-[0.08em] text-slate-300">
            {selectedRegion ? selectedRegion.toUpperCase() : "ITALIA · 20 REGIONI"}
          </p>
          {selectedRegion ? (
            <button
              type="button"
              onClick={() => onSelectRegion(null)}
              className="w-fit rounded-md border border-white/15 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/5"
            >
              Torna all&apos;Italia
            </button>
          ) : (
            <p className="text-[11px] leading-snug text-[var(--ink-muted)] sm:text-right">
              Tocca una regione per il focus
              <span className="ml-2 font-mono tabular-nums">
                {sopraSoglia}/{poll.length || 20} sopra soglia
              </span>
            </p>
          )}
        </div>
        <div className="relative min-h-0 flex-1">
        <ItalyMap
          variant="hero"
          layout="holographic"
          valuesByRegion={displayMapValues}
          colorMode={mapMode}
          selectedRegion={selectedRegion}
          highlightedRegion={hoveredRegion}
          pollByRegion={pollByRegion}
          votesByRegion={votesByRegion}
          onRegionHover={onHoverRegion}
          onRegionClick={(r) => onSelectRegion(r)}
          onClearSelection={() => onSelectRegion(null)}
          classFilter={classFilter}
          onClassFilterChange={onClassFilterChange}
          zoomControls="none"
          hideStatusPills
          showRegionLabels={false}
          showCapitals={false}
          showLatLonGrid={false}
          energySurgeKey={surgeKey}
          regionalV4ByRegion={regionalV4ByRegion}
          regionalV4AsOf={regionalV4AsOf}
        />
        </div>
      </div>

      <aside
        aria-label="Dettaglio territoriale"
        className={`fn-scenario-detail order-3 h-full min-h-0 overflow-hidden rounded-xl lg:order-3`}
      >
        <TacticalCard className="h-full min-h-0 rounded-xl !p-0">
          <div className="relative z-[2] h-full min-h-0">
            <NationalIntelligencePanel
              poll={poll}
              scenario={scenario}
              selectedRegion={selectedRegion}
              hoveredRegion={hoveredRegion}
              regionalV4ByRegion={regionalV4ByRegion}
              priorityView={priorityView}
              onPriorityViewChange={setPriorityView}
              onSelectRegion={onSelectRegion}
              onAdjustInst={selectedRegion ? handleAdjust : undefined}
              onResetRegion={selectedRegion ? onResetInstRegion : undefined}
              variant="holographic"
              fnConfig={fnConfig}
              region={selectedRegion as Region | undefined}
              regionQuickDelta={regionQuickDelta}
              scenarioRow={scenarioRow}
              baselineRow={baselineRow}
              nationalS={parametri.S}
              newsHeadlines={newsHeadlines}
              onOpenDossier={onOpenDossier}
            />
          </div>
        </TacticalCard>
      </aside>

      </div>
      <div className="fn-scenario-ticker relative flex h-8 shrink-0 items-center overflow-hidden rounded-md border border-[#1B2436] bg-[#080C14]/95 px-3">
        <div className="fn-live-ticker-fade min-w-0 flex-1">
          <LiveTicker poll={poll} />
        </div>
      </div>
    </section>
  );
}
