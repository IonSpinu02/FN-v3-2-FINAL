"use client";
import "./forecast-workspace.css";
import "./forecast-material.css";
import "./forecast-dossier.css";
import "./forecast-surface-details.css";
import { ForecastNewsSimulation } from "@/components/ForecastNewsSimulation";
import { buildNationalConsensusForecast } from "@/lib/engine/nationalConsensusForecast";
import { ThemeToggleButton } from "@/components/theme/ThemeProvider";
import {
  getCalibrationMetrics,
  type ForecastCalibrationMetrics,
  type ForecastIntelligencePayload,
} from "@/lib/engine/forecastCalibrationEngine";
import { buildFallbackForecastIntelligence } from "@/lib/engine/forecastIntelligenceBuild";
import {
  FORECAST_SCENARIO_ORDER,
  factorPp,
  cycleMonthLabel,
  forecastV4AtDays,
  forecastStages,
  forecastV4Regional,
  walkForwardBacktestV4,
  type ForecastHorizonKey,
  type ForecastNetworkDelta,
  type ForecastScenarioId,
  type ForecastScenarioResult,
  type ForecastV4Input,
  type ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";
import type { Region } from "@/lib/engine/constants";
import type { PartyGrowthForecast } from "@/lib/engine/partyGrowthForecast";
import {
  horizonMonths,
  projectMonths,
  type HorizonProjection,
  type ProjectMonthsInput,
} from "@/lib/engine/growthTrajectory";
import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import {
  ForecastFactorsUnifiedTable,
  ForecastSimControlBar,
} from "@/components/ForecastOperationalBlocks";
import { ForecastBentoCockpit } from "@/components/ForecastBentoCockpit";
import { ExportDossierPdfButton } from "@/components/ExportDossierPdfButton";
import { seriesWithCurrentPoint } from "@/lib/engine/growthEvidence";
import { newsEntityId } from "@/lib/engine/epistemicStatus";

type ReportTabId = "panoramica" | "fattori";
const REPORT_TABS: { id: ReportTabId; label: string }[] = [
  { id: "panoramica", label: "01 · Panoramica e Priorità" },
  { id: "fattori", label: "02 · Fattori e Simulazioni" },
];
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";


const CARD_SCROLL =
  "min-h-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#334155_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/60";

export function GrowthForecastReport({
  onRefreshData,
  refreshing = false,
  open,
  onClose,
  forecast,
  narrative,
  syncedAt,
  initialHorizon,
  projectionInput,
  v4Input,
  v4,
  networkDelta,
  onNetworkDeltaChange,
  simulatedProfiles,
  initialSelectedRegion = null,
}: {
  onRefreshData?: () => void;
  refreshing?: boolean;
  open: boolean;
  onClose: () => void;
  forecast: PartyGrowthForecast;
  narrative: string | null;
  syncedAt: string | null;
  initialHorizon: ForecastHorizonKey;
  /** Stessi input del riquadro 02: calendario e ventaglio restano coerenti con la cascata. */
  projectionInput: Omit<ProjectMonthsInput, "months" | "mayMonths">;
  v4Input: ForecastV4Input;
  v4: ForecastV4Result;
  networkDelta: ForecastNetworkDelta;
  onNetworkDeltaChange: (next: ForecastNetworkDelta) => void;
  simulatedProfiles: number;
  initialSelectedRegion?: Region | null;
}) {
  const asOf = useMemo(() => projectionInput.asOf ?? new Date(), [projectionInput.asOf]);
  const mayMonths = horizonMonths("may27", asOf);
  const monthsOfKey = useCallback(
    (key: ForecastHorizonKey) => (key === "d30" ? 1 : key === "d90" ? 3 : mayMonths),
    [mayMonths],
  );
  const [months, setMonths] = useState(() => monthsOfKey(initialHorizon));
  const [syncedHorizon, setSyncedHorizon] = useState(initialHorizon);
  if (syncedHorizon !== initialHorizon) {
    setSyncedHorizon(initialHorizon);
    setMonths(monthsOfKey(initialHorizon));
  }
  const [remoteIntelligence, setRemoteIntelligence] =
    useState<ForecastIntelligencePayload | null>(null);
  const [loadingIntelligence, setLoadingIntelligence] = useState(false);
  void narrative;
  void syncedAt;

  const baseEvidence = forecast.evidence;

  const horizonProjection: HorizonProjection = useMemo(
    () => projectMonths({ ...projectionInput, months: Math.max(6, mayMonths), mayMonths }),
    [projectionInput, mayMonths],
  );

  const horizonIndex = months === 1 ? 0 : months === 3 ? 1 : months === mayMonths ? 2 : -1;

  const statistical = useMemo(
    () => buildNationalConsensusForecast(v4Input, baseEvidence.forecastEvents),
    [v4Input, baseEvidence.forecastEvents],
  );
  const [viewScenario, setViewScenario] = useState<ForecastScenarioId>("base");

  const referenceHorizon = useMemo(() => {
    if (horizonIndex >= 0) return v4.scenarios[viewScenario].horizons[horizonIndex]!;
    return forecastV4AtDays(v4Input, months * 30, viewScenario).horizon;
  }, [horizonIndex, v4, v4Input, months, viewScenario]);

  const sampleOutlook = useCallback(
    (sid: ForecastScenarioId, horizonDays: number, endHorizon: typeof referenceHorizon) =>
      Array.from({ length: horizonDays + 1 }, (_, days) => {
        const result =
          days === 0
            ? null
            : days === horizonDays
              ? endHorizon
              : forecastV4AtDays(v4Input, days, sid).horizon;
        const timestamp = new Date(asOf.getTime() + days * 86400000);
        const monthKey = timestamp.toISOString().slice(0, 7);
        return {
          days,
          centralPct: result?.centralPct ?? endHorizon.startPct,
          lo10Pct: result?.lo10Pct ?? endHorizon.startPct,
          hi90Pct: result?.hi90Pct ?? endHorizon.startPct,
          cyclePp: result ? factorPp(result, "cycle") : 0,
          calendarLabel: cycleMonthLabel(monthKey) ?? monthKey,
        };
      }),
    [asOf, v4Input],
  );

  const routeSamples = useMemo(() => {
    if (!open) return { base: [], offensiva: [], passivo: [] };
    const baseH = v4.scenarios.base.horizons.find((row) => row.key === "d180")!;
    const offH = v4.scenarios.offensiva.horizons.find((row) => row.key === "d180")!;
    const pasH = v4.scenarios.passivo.horizons.find((row) => row.key === "d180")!;
    return {
      base: sampleOutlook("base", baseH.days, baseH),
      offensiva: sampleOutlook("offensiva", offH.days, offH),
      passivo: sampleOutlook("passivo", pasH.days, pasH),
    };
  }, [open, sampleOutlook, v4]);

  const verdeGains = useMemo(() => {
    if (!open) return [];
    const baseRows = forecastV4Regional(v4Input, v4, "d180", "base");
    const offRows = forecastV4Regional(v4Input, v4, "d180", "offensiva");
    return offRows
      .filter((r) => r.verde)
      .map((r) => {
        const b = baseRows.find((x) => x.regione === r.regione);
        return {
          regione: r.regione,
          extraVotes: Math.max(0, Math.round(r.addedVotes - (b?.addedVotes ?? 0))),
          centralPct: r.centralPct,
        };
      })
      .sort((a, b) => b.extraVotes - a.extraVotes);
  }, [open, v4Input, v4]);

  const backtest = useMemo(() => {
    if (!open) return null;
    const todayIso = v4.asOf.slice(0, 10);
    const series = (
      v4Input.history ??
      FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({ isoDate: p.isoDate, pct: p.pct }))
    ).filter((p) => p.isoDate < todayIso);
    return walkForwardBacktestV4({ series, polls: v4Input.polls });
  }, [open, v4.asOf, v4Input.history, v4Input.polls]);

  const localCalibration: ForecastCalibrationMetrics = useMemo(
    () =>
      getCalibrationMetrics(
        FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({ isoDate: p.isoDate, pct: p.pct })),
      ),
    [],
  );

  const fallbackIntelligence = useMemo(
    () =>
      open
        ? buildFallbackForecastIntelligence({
            startPct: v4.startPct,
            evidence: baseEvidence,
            projection: horizonProjection,
            calibration: localCalibration,
            source: "fallback_model",
          })
        : null,
    [open, v4.startPct, baseEvidence, horizonProjection, localCalibration],
  );
  const intelligence = remoteIntelligence ?? fallbackIntelligence;

  const loadIntelligence = useCallback(
    async (forceRefresh: boolean, signal?: AbortSignal) => {
      setLoadingIntelligence(true);
      try {
        const res = await fetch("/api/forecast-intelligence", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal,
          body: JSON.stringify({
            startPct: v4.startPct,
            evidence: baseEvidence,
            projection: horizonProjection,
            newsTitles: baseEvidence.newsHeadlines,
            forceRefresh,
            pollSeries: FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({
              isoDate: p.isoDate,
              pct: p.pct,
            })),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          ok?: boolean;
          payload?: ForecastIntelligencePayload;
        };
        if (data.payload?.months?.length && !signal?.aborted) {
          setRemoteIntelligence(data.payload);
        }
      } catch {
        // Resta il modello locale.
      } finally {
        if (!signal?.aborted) setLoadingIntelligence(false);
      }
    },
    [v4.startPct, baseEvidence, horizonProjection],
  );

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadIntelligence(false, controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // Solo all'apertura del modal: evita loop fetch → write cache → HMR
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [reportTab, setReportTab] = useState<ReportTabId>("panoramica");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setReportTab("panoramica");
  }
  const [excludedEntityIds, setExcludedEntityIds] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch("/api/ledger/supervision?limit=50", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { activeExclusions?: string[] };
        if (Array.isArray(json.activeExclusions)) {
          setExcludedEntityIds((prev) => {
            const next = json.activeExclusions!;
            if (
              prev.length === next.length &&
              prev.every((id, i) => id === next[i])
            ) {
              return prev;
            }
            return next;
          });
        }
      })
      .catch(() => {
        /* supervisione opzionale in assenza di sessione */
      });
    return () => controller.abort();
  }, [open]);

  const goToTab = useCallback((id: ReportTabId) => {
    setReportTab(id);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select, textarea, summary, [tabindex="0"]') ?? []).filter(el => el.getClientRects().length > 0);
    (focusable()[0] ?? dialog)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.querySelector("[data-strategist-drawer-open]") || document.querySelector("[data-forecast-crono-open]")) return;
        onClose();
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); dialog?.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  const activeHorizonKey: ForecastHorizonKey =
    months === 1 ? "d30" : months === 3 ? "d90" : "d180";
  const consideredHeadlines = useMemo(
    () => (baseEvidence.newsHeadlines ?? []).slice(0, 24),
    [baseEvidence.newsHeadlines],
  );
  const activeHeadlines = useMemo(
    () =>
      consideredHeadlines.filter((h) => !excludedEntityIds.includes(newsEntityId(h))),
    [consideredHeadlines, excludedEntityIds],
  );
  const forecastStagePlan = useMemo(
    () =>
      forecastStages({
        forecastInput: v4Input,
        result: v4,
        scenarioId: viewScenario,
        networkDelta,
      }),
    [v4Input, v4, viewScenario, networkDelta],
  );

  if (!open || typeof document === "undefined") return null;

  const activeMonthKey = horizonProjection.timeline[0]?.key ?? null;

  const diag = v4.diagnostics;
  const scenarioList: ForecastScenarioResult[] = FORECAST_SCENARIO_ORDER.map(
    (id) => v4.scenarios[id],
  );
  const receiptH30 = v4.scenarios[viewScenario].horizons[0]!;
  const receiptH90 = v4.scenarios[viewScenario].horizons[1]!;
  const receiptH180 = v4.scenarios[viewScenario].horizons[2]!;
  const attackStatement =
    intelligence?.months.find((m) => m.monthKey === activeMonthKey)?.bipResponse
      .readyStatement ??
    intelligence?.months[0]?.bipResponse.readyStatement ??
    "Stop Saldo-Acconto per le Partite IVA, tetto al contante a 10.000 €, Mutuo Tricolore: queste sono le proposte da portare subito nelle piazze prioritarie — Lombardia, Veneto, Calabria, Abruzzo — mentre il Governo discute la Manovra.";
  const historySeries = seriesWithCurrentPoint(
    (v4Input.history?.length ? v4Input.history : FN_SUPERMEDIA_CONSENSO_SERIES).map((point) => ({
      isoDate: point.isoDate,
      pct: point.pct,
    })),
    v4.startPct,
    asOf,
  );

  const factorsDrawer = (
    <>
      <ForecastSimControlBar
        scenarios={scenarioList}
        activeScenario={viewScenario}
        onSelectScenario={setViewScenario}
        networkDelta={networkDelta}
        onNetworkDeltaChange={onNetworkDeltaChange}
        diagnostics={diag}
        groundPp={factorPp(referenceHorizon, "ground")}
        simulatedProfiles={simulatedProfiles}
        verdeGains={verdeGains}
        capacityNotes={forecastStagePlan.filter((stage) => stage.capacity).map((stage) => ({
          label: stage.label,
          feasible: stage.capacity!.feasible,
        }))}
      />
      <ForecastFactorsUnifiedTable
        h30={receiptH30}
        h90={receiptH90}
        h180={receiptH180}
      />
      <ForecastNewsSimulation
        model={statistical}
        evidence={baseEvidence}
        asOf={asOf}
        days={referenceHorizon.days}
        compactChrome
      />
      <p className="forecast-kpi-note mt-1">
        <a
          href="/NOTA-PREVISIONE-CRESCITA.pdf"
          target="_blank"
          rel="noreferrer"
          className="forecast-pdf-link"
        >
          Nota metodologica PDF ↗
        </a>
        {" · "}
        {diag.observations.polls} sondaggi / {diag.observations.supermedia} Supermedia
      </p>
    </>
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Previsione del consenso nazionale"
      className="forecast-modal forecast-workspace forecast-material fixed inset-0 z-[100] h-screen w-screen"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="forecast-workspace-frame flex h-screen w-screen flex-col overflow-hidden rounded-none bg-[var(--surface-canvas)] text-[var(--ink-primary)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 text-[var(--ink-primary)]">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 text-[12px] font-medium text-[var(--ink-secondary)] hover:border-[var(--border-default)] hover:text-[var(--ink-primary)]"
              onClick={onClose}
              aria-label="Torna allo scenario"
            >
              ← Scenario
            </button>
            <div className="flex min-w-0 items-baseline gap-2">
              <h2 id="forecast-report-title" className="truncate text-[14px] font-semibold tracking-tight">
                Consenso nazionale
              </h2>
              <span className="hidden truncate font-mono text-[11px] text-[var(--ink-muted)] sm:inline">
                {referenceHorizon.label}
              </span>
            </div>
          </div>
          <nav className="inline-flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-0.5" aria-label="Sezioni del report">
            {REPORT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={reportTab === tab.id}
                className={`shrink-0 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  reportTab === tab.id
                    ? "bg-[var(--surface-1)] text-[var(--ink-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.24)]"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink-secondary)]"
                }`}
                onClick={() => goToTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 text-[12px] font-medium text-[var(--ink-primary)] hover:bg-emerald-500/15"
              onClick={() => {
                goToTab("panoramica");
                window.setTimeout(() => {
                  window.dispatchEvent(new CustomEvent("fn-open-forecast-crono"));
                  window.setTimeout(() => {
                    window.dispatchEvent(new CustomEvent("fn-open-strategist", { detail: { prompt: null } }));
                  }, 90);
                }, 40);
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
              Portaborse AI
            </button>
            <button
              type="button"
              disabled={loadingIntelligence || refreshing}
              onClick={() => {
                onRefreshData?.();
                void loadIntelligence(true);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[12px] text-[var(--ink-secondary)] hover:border-[var(--border-default)] hover:text-[var(--ink-primary)] disabled:opacity-50"
              aria-label="Aggiorna dati della previsione"
              title="Aggiorna dati"
            >
              {loadingIntelligence || refreshing ? "…" : "↻"}
            </button>
            <ThemeToggleButton />
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 items-center rounded-md border border-[var(--border-default)] bg-[var(--surface-2)] px-2.5 font-mono text-[11px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
            >
              Esc ✕
            </button>
          </div>
        </header>
        <div
          ref={contentRef}
          className={`forecast-report-content min-h-0 flex-1 ${reportTab === "panoramica" ? "is-bento-cockpit overflow-y-auto xl:overflow-hidden [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15" : CARD_SCROLL}`}
        >
          {reportTab === "panoramica" ? (
            <section
              id="forecast-tab-panoramica"
              className="flex h-full min-h-0 flex-col"
              aria-labelledby="forecast-report-title"
            >
              <ForecastBentoCockpit
                measuredPct={v4.startPct}
                viewScenario={viewScenario}
                onScenario={setViewScenario}
                activeKey={activeHorizonKey}
                onStage={(days) => setMonths(days === 30 ? 1 : days === 90 ? 3 : mayMonths)}
                v4={v4}
                v4Input={v4Input}
                horizon={v4.scenarios[viewScenario].horizons.find((row) => row.key === activeHorizonKey) ?? receiptH180}
                mayHorizon={v4.scenarios[viewScenario].horizons.find((row) => row.key === "d180") ?? receiptH180}
                projection={routeSamples[viewScenario]}
                offensiveProjection={viewScenario === "offensiva" ? undefined : routeSamples.offensiva}
                inertialProjection={viewScenario === "passivo" ? undefined : routeSamples.passivo}
                history={historySeries}
                asOf={asOf}
                backtest={backtest}
                stages={forecastStagePlan}
                diagnostics={diag}
                onOpenFattori={() => goToTab("fattori")}
                attackStatement={attackStatement}
                strategist={{
                  open,
                  networkDelta,
                  newsHeadlines: activeHeadlines,
                  excludedEntityIds,
                  onResetNetwork: () => onNetworkDeltaChange({ comitati: 0, tesserati: 0 }),
                }}
                initialSelectedRegion={open ? initialSelectedRegion : null}
              />
            </section>
          ) : null}

          {reportTab === "fattori" ? (
            <section
              id="forecast-tab-fattori"
              className="forecast-detail-view forecast-section-block forecast-section-previsione"
              aria-label="Fattori e simulazioni"
            >
              <header className="forecast-tab-intro">
                <p className="forecast-eyebrow">02 · FATTORI E SIMULAZIONI</p>
                <h3>Leve di spinta e prove what-if</h3>
                <p>
                  Sette leve che spostano il consenso, scenari inerziale/base/offensivo e simulatori
                  di rete e notizie.
                </p>
              </header>
              {factorsDrawer}
            </section>
          ) : null}
        </div>
        <footer className="forecast-report-footer !px-4 !py-1.5">
          <div className="forecast-report-footer-left">
            <ExportDossierPdfButton
              v4={v4}
              v4Input={v4Input}
              networkDelta={networkDelta}
              newsHeadlines={activeHeadlines}
              scenarioMode={viewScenario}
              horizonKey={activeHorizonKey}
              excludedEntityIds={excludedEntityIds}
              backtest={backtest}
              className="forecast-strategist-open"
            />
            <span>
              {diag.observations.polls} sondaggi · {diag.observations.supermedia}{" "}
              Supermedia
            </span>
          </div>
          <span>Stima con ipotesi dichiarate</span>
          <span>ESC per chiudere</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
