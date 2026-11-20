"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, MoreHorizontal, Route } from "lucide-react";
import { useActiveStrategicRoute } from "@/lib/state/useActiveStrategicRoute";
import type { FlussiIpsos } from "@/lib/engine/defaults";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { ScenarioResult } from "@/lib/engine/types";
import type { Region } from "@/lib/engine/constants";
import type { HorizonDays, StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import { parliamentSeatRange } from "@/lib/engine/strategicCommandBrief";
import { formatCompactVotes } from "@/lib/formatApproximateVotes";
import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import { THEME_ATTACK, localCommitteeNeed } from "@/lib/engine/vannacciDirective";
import type { RoadmapStageId } from "@/lib/roadmapEmbed";
import {
  clearGeneratedStrategicPlan,
  readGeneratedStrategicPlan,
  writeGeneratedStrategicPlan,
  type GeneratedStrategicPlan,
} from "@/lib/strategy/generatedStrategicPlan";
import { previewStrategicBackcast } from "@/lib/strategy/previewStrategicBackcast";
import { useTheme } from "@/components/theme/ThemeProvider";
import { TacticalItalyMap } from "@/components/obiettivo/TacticalItalyMap";
import { RoadmapIframeModal } from "@/components/obiettivo/RoadmapIframeModal";
import { RouteMonitorModal } from "@/components/obiettivo/RouteMonitorModal";
import { StrategicCalculationCinema } from "@/components/obiettivo/StrategicCalculationCinema";
import { StrategicStageRoadmap } from "@/components/obiettivo/StrategicStageRoadmap";
import { StrategicGoalIntakeCard } from "@/components/obiettivo/StrategicGoalIntakeCard";
import { roundTenth } from "@/components/obiettivo/useStrategicPlan";
import { useStrategicAnchors } from "@/components/obiettivo/useStrategicAnchors";
import {
  BasinRing,
  FanChart,
  HemicycleChart,
  RegionRadar,
  WaterfallChart,
  basinTotalsForDisplay,
} from "@/components/obiettivo/goalCharts";

function stripThesisSuffix(text: string): string {
  return text.replace(/\s*\.?\s*IPOTESI\.?\s*$/i, "").trim();
}

const CINEMA_MIN_MS = 2400;
const CINEMA_FINALE_MS = 380;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type ViewState = "INTAKE" | "PLAN_READY";

const HORIZONS: HorizonDays[] = [30, 90, 180, 360];
const KICKER = "font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)]";
const CARD = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)]";
const SEG = "inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-0.5";
const GHOST = "obj-press h-7 rounded-md border border-[var(--border-default)] bg-[var(--surface-2)] px-3 text-[12px] text-[var(--ink-primary)] hover:border-[var(--ink-muted)]";
const ROADMAP = "obj-press inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-cyan-400/35 bg-cyan-500/10 px-3 text-[12px] font-medium text-cyan-200 hover:bg-cyan-500/15 light:text-cyan-800";
const MONITOR = "obj-press inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-violet-400/35 bg-violet-500/10 px-3 text-[12px] font-medium text-violet-200 hover:bg-violet-500/15 light:text-violet-800";
const GLASS = "rounded-xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-1)_72%,transparent)] backdrop-blur-md";

function segItem(on: boolean, accent = false): string {
  const tone = on
    ? `bg-[var(--surface-1)] shadow-[0_1px_2px_rgba(0,0,0,0.22)] ${accent ? "text-[var(--signal-positive)]" : "text-[var(--ink-primary)]"}`
    : "text-[var(--ink-muted)] hover:text-[var(--ink-secondary)]";
  return `obj-press h-6 rounded-md px-2 font-mono text-[11px] tabular-nums ${tone}`;
}

export function StrategicGoalWorkspace({
  scenario,
  flussiIpsos,
  poll,
  initialTarget,
}: {
  scenario: ScenarioResult;
  flussiIpsos: FlussiIpsos;
  poll: RegionPollResult[];
  initialTarget?: string | null;
}) {
  const anchors = useStrategicAnchors(scenario, flussiIpsos, poll);
  const { route, activate, clear } = useActiveStrategicRoute();
  const { theme } = useTheme();

  const [view, setView] = useState<ViewState>("INTAKE");
  const [committed, setCommitted] = useState<GeneratedStrategicPlan | null>(null);
  const [pendingTarget, setPendingTarget] = useState(12);
  const [pendingHorizon, setPendingHorizon] = useState<HorizonDays>(360);
  const [focusNote, setFocusNote] = useState("");
  const [selected, setSelected] = useState<Region | null>(null);
  const [phaseId, setPhaseId] = useState<RoadmapStageId>(1);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [cinemaPreview, setCinemaPreview] = useState<StrategicBackcastResult | null>(null);
  const [cinemaTarget, setCinemaTarget] = useState(12);
  const [cinemaHorizon, setCinemaHorizon] = useState<HorizonDays>(360);
  const [apiReady, setApiReady] = useState(false);
  const skipRef = useRef(false);
  const finaleResolveRef = useRef<(() => void) | null>(null);
  const finaleTimerRef = useRef<number | null>(null);
  const minTimerRef = useRef<number | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (finaleTimerRef.current != null) window.clearTimeout(finaleTimerRef.current);
      if (minTimerRef.current != null) window.clearTimeout(minTimerRef.current);
      finaleResolveRef.current = null;
    };
  }, []);

  useEffect(() => {
    const stored = readGeneratedStrategicPlan();
    if (stored) {
      setCommitted(stored);
      setPendingTarget(stored.targetPct);
      setPendingHorizon(stored.horizonDays);
      setFocusNote(stored.strategicFocusNote ?? "");
      setView("PLAN_READY");
      return;
    }
    if (route) {
      setPendingTarget(route.targetPct);
      setPendingHorizon(route.horizonDays);
      return;
    }
    const parsed = Number(initialTarget);
    if (initialTarget && Number.isFinite(parsed)) setPendingTarget(roundTenth(parsed));
    const horizon = Number(new URLSearchParams(window.location.search).get("horizon"));
    if (horizon === 30 || horizon === 90 || horizon === 180 || horizon === 360) {
      setPendingHorizon(horizon);
    }
  }, [initialTarget, route]);

  const dirty =
    committed != null &&
    (roundTenth(pendingTarget) !== roundTenth(committed.targetPct) || pendingHorizon !== committed.horizonDays);

  const commitPlan = useCallback((next: GeneratedStrategicPlan) => {
    const clean: GeneratedStrategicPlan = { ...next };
    delete clean.warning;
    writeGeneratedStrategicPlan(clean);
    setCommitted(clean);
    setPendingTarget(next.targetPct);
    setPendingHorizon(next.horizonDays);
    setFocusNote(next.strategicFocusNote ?? "");
    setView("PLAN_READY");
    setGenerateError(null);
  }, []);

  const clearCinema = useCallback(() => {
    setCinemaPreview(null);
    setApiReady(false);
    skipRef.current = false;
    if (finaleTimerRef.current != null) {
      window.clearTimeout(finaleTimerRef.current);
      finaleTimerRef.current = null;
    }
    if (minTimerRef.current != null) {
      window.clearTimeout(minTimerRef.current);
      minTimerRef.current = null;
    }
    finaleResolveRef.current = null;
  }, []);

  const skipCinema = useCallback(() => {
    skipRef.current = true;
    if (finaleTimerRef.current != null) {
      window.clearTimeout(finaleTimerRef.current);
      finaleTimerRef.current = null;
    }
    const resolve = finaleResolveRef.current;
    finaleResolveRef.current = null;
    resolve?.();
  }, []);

  async function generatePlan(input: {
    targetPct: number;
    horizonDays: HorizonDays;
    strategicFocusNote?: string;
  }) {
    if (isGenerating) return;
    const reduced = prefersReducedMotion();
    skipRef.current = false;
    setIsGenerating(true);
    setGenerateError(null);
    setApiReady(false);
    setCinemaTarget(input.targetPct);
    setCinemaHorizon(input.horizonDays);
    setCinemaPreview(previewStrategicBackcast(scenario, flussiIpsos, input.targetPct, input.horizonDays, poll));

    const minMs = reduced ? 0 : CINEMA_MIN_MS;
    const minDelay = new Promise<void>((resolve) => {
      if (minMs <= 0) {
        resolve();
        return;
      }
      minTimerRef.current = window.setTimeout(() => {
        minTimerRef.current = null;
        resolve();
      }, minMs);
    });

    const fetchPromise = (async (): Promise<GeneratedStrategicPlan> => {
      const res = await fetch("/api/strategy/generate-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          liveS: scenario.parametri.S,
          regionalPoll: poll.map((row) => ({ regione: row.regione, piHat: row.piHat })),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        targetPct?: number;
        horizonDays?: HorizonDays;
        strategicFocusNote?: string | null;
        plan?: GeneratedStrategicPlan["plan"];
        brief?: GeneratedStrategicPlan["brief"];
        roadmap?: GeneratedStrategicPlan["roadmap"];
        ballots?: number;
        floor?: number;
        usedCombinatorialFallback?: boolean;
      };
      if (!res.ok || !json.ok || !json.plan || !json.brief || !json.roadmap) {
        throw new Error(json.error || "Generazione del piano non riuscita.");
      }
      return {
        targetPct: json.targetPct ?? input.targetPct,
        horizonDays: json.horizonDays ?? input.horizonDays,
        ...(input.strategicFocusNote ? { strategicFocusNote: input.strategicFocusNote } : {}),
        plan: json.plan,
        brief: json.brief,
        roadmap: json.roadmap,
        ballots: json.ballots ?? anchors.ballots,
        floor: json.floor ?? anchors.floor,
        ...(json.usedCombinatorialFallback ? { usedCombinatorialFallback: true } : {}),
        savedAt: new Date().toISOString(),
      };
    })();

    try {
      const [plan] = await Promise.all([fetchPromise, minDelay]);
      if (!aliveRef.current) return;
      setApiReady(true);

      if (!reduced && !skipRef.current) {
        await new Promise<void>((resolve) => {
          finaleResolveRef.current = resolve;
          finaleTimerRef.current = window.setTimeout(() => {
            finaleTimerRef.current = null;
            finaleResolveRef.current = null;
            resolve();
          }, CINEMA_FINALE_MS);
        });
      }
      if (!aliveRef.current) return;
      commitPlan(plan);
    } catch (err) {
      if (aliveRef.current) {
        const raw = err instanceof Error ? err.message : "Generazione non riuscita.";
        setGenerateError(/JSON|property name|syntax/i.test(raw) ? "Generazione non riuscita. Riprova tra poco." : raw);
      }
    } finally {
      if (aliveRef.current) {
        setIsGenerating(false);
        clearCinema();
      }
    }
  }

  function openIntake() {
    setView("INTAKE");
    setRoadmapOpen(false);
  }

  function resetObjective() {
    clearGeneratedStrategicPlan();
    setCommitted(null);
    setGenerateError(null);
    openIntake();
  }

  const openRoadmap = (stageId?: RoadmapStageId) => {
    if (stageId) setPhaseId(stageId);
    setRoadmapOpen(true);
  };
  const closeRoadmap = useCallback(() => setRoadmapOpen(false), []);
  const closeMonitor = useCallback(() => setMonitorOpen(false), []);

  if (isGenerating) {
    return (
      <section className="h-dvh w-full overflow-hidden bg-[var(--surface-canvas)] pt-14 text-[var(--ink-primary)]" aria-label="Calcolo strategico">
        <div className="relative flex min-h-[calc(100dvh-3.5rem)] w-full items-center justify-center overflow-hidden px-5 py-8 sm:px-6 lg:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.14),transparent_55%),radial-gradient(ellipse_at_top,rgba(71,85,105,0.2),transparent_45%)]"
          />
          <div className="relative z-[1] w-full">
            <StrategicCalculationCinema
              preview={cinemaPreview}
              targetPct={cinemaTarget}
              horizonDays={cinemaHorizon}
              apiReady={apiReady}
              onSkip={skipCinema}
            />
          </div>
        </div>
      </section>
    );
  }

  if (view === "INTAKE" || !committed) {
    return (
      <section className="h-dvh w-full overflow-y-auto bg-[var(--surface-canvas)] px-4 pt-14 text-[var(--ink-primary)] sm:px-5 lg:px-6" aria-label="Scheda obiettivo">
        <StrategicGoalIntakeCard
          floor={anchors.floor}
          currentPct={anchors.currentPct}
          bandFor={anchors.bandFor}
          ballots={anchors.ballots}
          initialTarget={pendingTarget}
          initialHorizon={pendingHorizon}
          initialNote={focusNote}
          isGenerating={false}
          error={generateError}
          onGenerate={(input) => void generatePlan(input)}
        />
      </section>
    );
  }

  const result = committed.plan;
  const brief = committed.brief;
  const roadmap = committed.roadmap;
  const ballots = committed.ballots;
  const floor = committed.floor;
  const safePending = Math.min(20, Math.max(floor, roundTenth(pendingTarget)));
  const stage = roadmap.stages.find((item) => item.stageId === phaseId) ?? roadmap.stages[0];
  const ranked = [...result.regions].sort((a, b) => b.addedVotes - a.addedVotes || b.ceilingPct - a.ceilingPct);
  const focus = result.regions.find((row) => row.region === selected) ?? ranked[0] ?? null;
  const fronts = result.regions.filter((row) => row.role === "FRONTE_PRIORITARIO").length;
  const sameRoute = route != null && route.targetPct === committed.targetPct && route.horizonDays === committed.horizonDays;
  const deltaPp = committed.targetPct - result.currentPct;
  const donutVotes = brief.payout.netNewVotesFromToday;
  const totals = basinTotalsForDisplay(result, donutVotes);
  const routeStale =
    route != null &&
    (roundTenth(route.targetPct) !== roundTenth(safePending) || route.horizonDays !== pendingHorizon);
  const seats = brief.payout.estimatedParliamentSeatsRange;
  const guideTheme = result.themes[0]?.theme ?? focus?.theme ?? "Sicurezza";
  const focusIndex = focus ? ranked.findIndex((row) => row.region === focus.region) : 0;
  const usedCombinatorialFallback =
    committed.usedCombinatorialFallback === true || roadmap.generatedBy !== "AI_MODEL";

  function stepRegion(delta: -1 | 1) {
    if (!ranked.length) return;
    const idx = focus ? ranked.findIndex((row) => row.region === focus.region) : 0;
    const next = ranked[(idx + delta + ranked.length) % ranked.length]!;
    setSelected(next.region);
  }

  function activateRoute(targetPct = committed!.targetPct, horizonDays = committed!.horizonDays) {
    activate({
      targetPct,
      horizonDays,
      activatedAt: new Date().toISOString(),
      baselinePctAtActivation: committed!.plan.currentPct,
      baselineNetwork: {
        committees: anchors.pack.currentCommittees,
        members: anchors.pack.currentMembers,
        elected: anchors.pack.regions.reduce((sum, row) => sum + row.localElected, 0),
      },
      frozenPlan: committed!.plan,
    });
  }

  async function exportPlan() {
    if (pdfBusy || !committed) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const res = await fetch("/api/export/strategic-plan-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPct: committed.targetPct,
          horizonDays: committed.horizonDays,
          roadmap: committed.roadmap,
          executiveThesis: committed.roadmap.executiveThesis,
        }),
      });
      if (!res.ok) throw new Error("Esportazione PDF non riuscita.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Piano_Obiettivo_${committed.targetPct.toFixed(1)}_${committed.horizonDays}g.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Esportazione PDF non riuscita.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <section className="flex h-dvh w-full max-w-[1600px] flex-col gap-4 overflow-hidden bg-[var(--surface-canvas)] px-5 py-4 pt-[calc(3.5rem+env(safe-area-inset-top))] text-[var(--ink-primary)] sm:px-6 lg:mx-auto lg:px-8 max-xl:overflow-y-auto max-xl:pb-[calc(5.5rem+env(safe-area-inset-bottom))]" aria-label="Cabina obiettivo">
      <header className={`${CARD} obj-rise flex h-12 shrink-0 items-center gap-3 px-4`}>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <p className={`${KICKER} hidden sm:block`}>Piano obiettivo</p>
          <div className={SEG}>
            <button type="button" onClick={() => setPendingTarget(roundTenth(Math.max(floor, safePending - 0.1)))} className={`${segItem(false)} w-6 px-0 text-[13px]`} aria-label="Diminuisci traguardo">-</button>
            <p className="min-w-[3.2rem] text-center font-mono text-[14px] font-semibold tabular-nums">{formatDecimalIt(safePending, 1)}%</p>
            <button type="button" onClick={() => setPendingTarget(roundTenth(Math.min(20, safePending + 0.1)))} className={`${segItem(false)} w-6 px-0 text-[13px]`} aria-label="Aumenta traguardo">+</button>
          </div>
          <input type="range" min={Math.min(floor, 16)} max={16} step={0.1} value={Math.min(16, safePending)} onChange={(event) => setPendingTarget(Number(event.target.value))} aria-label="Consenso obiettivo" className="hidden h-1 w-24 accent-emerald-400 md:block" />
          <div className={SEG} role="group" aria-label="Orizzonte">
            {HORIZONS.map((item) => (
              <button key={item} type="button" onClick={() => setPendingHorizon(item)} className={segItem(pendingHorizon === item)}>
                {item}g
              </button>
            ))}
          </div>
        </div>
        <div className="mx-auto hidden items-center gap-2 lg:flex">
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] tabular-nums text-[var(--ink-secondary)]">
            Realismo <span className="text-[var(--ink-primary)]">{result.feasibilityIndex}/100</span>
          </span>
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] tabular-nums text-[var(--ink-secondary)]">
            Tenuta avversa <span className="text-[var(--ink-primary)]">{formatDecimalIt(result.cvar10, 2)}%</span>
          </span>
          <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-violet-200 light:text-violet-800">
            IPOTESI
          </span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {route ? (
            <button type="button" onClick={() => setMonitorOpen(true)} className={MONITOR}>
              <Activity className="h-3.5 w-3.5" aria-hidden />
              Monitor di rotta
            </button>
          ) : null}
          {routeStale ? (
            <button
              type="button"
              className="obj-press inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 text-[12px] font-medium text-amber-200 hover:bg-amber-500/15 light:text-amber-900"
              onClick={() => activateRoute(safePending, pendingHorizon)}
            >
              Fissa come Rotta attiva
            </button>
          ) : null}
          <div className="relative">
            <button
              type="button"
              className={`${GHOST} gap-1.5 pr-2`}
              aria-expanded={actionsOpen}
              onClick={() => setActionsOpen((open) => !open)}
            >
              Azioni ▾
              {usedCombinatorialFallback ? (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-amber-400"
                  title="Variante testuale dal motore combinatorio"
                />
              ) : null}
              <MoreHorizontal className="h-3.5 w-3.5 opacity-60 lg:hidden" aria-hidden />
            </button>
            {actionsOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[200px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-1 shadow-xl">
                {dirty ? (
                  <button
                    type="button"
                    disabled={isGenerating}
                    className="flex w-full rounded-lg px-3 py-2 text-left text-[12px] text-[var(--ink-primary)] hover:bg-[var(--surface-2)] disabled:opacity-50"
                    onClick={() => {
                      setActionsOpen(false);
                      void generatePlan({
                        targetPct: safePending,
                        horizonDays: pendingHorizon,
                        ...(focusNote.trim() ? { strategicFocusNote: focusNote.trim() } : {}),
                      });
                    }}
                  >
                    Ricalcola piano ({formatDecimalIt(safePending, 1)}% · {pendingHorizon}g)
                  </button>
                ) : null}
                <button type="button" className="flex w-full rounded-lg px-3 py-2 text-left text-[12px] hover:bg-[var(--surface-2)]" onClick={() => { setActionsOpen(false); resetObjective(); }}>
                  Nuovo obiettivo
                </button>
                <button
                  type="button"
                  disabled={isGenerating}
                  className="flex w-full rounded-lg px-3 py-2 text-left text-[12px] hover:bg-[var(--surface-2)] disabled:opacity-50"
                  onClick={() => {
                    setActionsOpen(false);
                    void generatePlan({
                      targetPct: committed.targetPct,
                      horizonDays: committed.horizonDays,
                      ...(committed.strategicFocusNote ? { strategicFocusNote: committed.strategicFocusNote } : {}),
                    });
                  }}
                >
                  Rigenera variante AI
                </button>
                {sameRoute ? (
                  <button type="button" className="flex w-full rounded-lg px-3 py-2 text-left text-[12px] hover:bg-[var(--surface-2)]" onClick={() => { setActionsOpen(false); clear(); }}>
                    Disattiva rotta attiva
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={dirty}
                    className="flex w-full rounded-lg px-3 py-2 text-left text-[12px] hover:bg-[var(--surface-2)] disabled:opacity-50"
                    onClick={() => { setActionsOpen(false); activateRoute(); }}
                  >
                    {route ? "Aggiorna rotta" : "Attiva rotta operativa"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pdfBusy || dirty}
                  className="flex w-full rounded-lg px-3 py-2 text-left text-[12px] hover:bg-[var(--surface-2)] disabled:opacity-50"
                  onClick={() => { setActionsOpen(false); void exportPlan(); }}
                >
                  {pdfBusy ? "Esportazione PDF..." : "Esporta PDF"}
                </button>
                {usedCombinatorialFallback ? (
                  <p className="border-t border-[var(--border-subtle)] px-3 py-2 text-[10px] leading-snug text-[var(--ink-muted)]">
                    Testi da motore combinatorio (AI assente o risposta non valida).
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {pdfError ? <p className="text-[12px] text-[var(--signal-danger)]">{pdfError}</p> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-12">
        <aside className={`${CARD} obj-rise custom-scrollbar col-span-12 flex min-h-0 flex-col divide-y divide-[var(--border-subtle)] overflow-y-auto xl:col-span-4 xl:h-full 2xl:col-span-3`} style={{ animationDelay: "120ms" }}>
          <section className="p-4">
            <p className={KICKER}>Ponte verso il traguardo</p>
            <WaterfallChart current={result.currentPct} offensive={result.offensiveCentral} target={committed.targetPct} groundingShare={result.groundingShare} maxEndogenous={result.maxEndogenousPct} />
          </section>
          <section className="p-4">
            <p className={KICKER}>Peso in Aula</p>
            <HemicycleChart todaySeats={parliamentSeatRange(result.currentPct)[1]} planSeats={seats[1]} rangeLabel={`${seats[0]}–${seats[1]}`} caption="SEGGI CAMERA" />
          </section>
          <section className="p-4">
            <p className={KICKER}>Da dove arrivano i voti</p>
            <div className="mt-2">
              <BasinRing totals={totals} totalVotes={donutVotes} />
            </div>
          </section>
        </aside>

        <div className="col-span-12 flex min-h-0 flex-col gap-4 xl:col-span-8 xl:h-full 2xl:col-span-9">
          <div className="obj-stage obj-rise flex min-h-[360px] flex-[1.35] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)]" style={{ animationDelay: "60ms" }}>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(200px,0.9fr)_minmax(0,1.2fr)_minmax(240px,0.85fr)]">
              <div className="flex min-w-0 flex-col justify-center gap-4">
                <div>
                  <p className={KICKER}>Traguardo</p>
                  <p className="obj-hero-num mt-2 font-mono text-[clamp(48px,4.6vw,84px)] font-semibold leading-[0.85] tracking-[-0.05em] tabular-nums">
                    {formatDecimalIt(committed.targetPct, 1)}
                    <span className="ml-1 align-top text-[0.4em] font-medium tracking-normal text-[var(--ink-muted)]">%</span>
                  </p>
                  <p className="mt-2 max-w-[26ch] text-[12px] leading-snug text-[var(--ink-secondary)]">
                    {committed.horizonDays}g · da {formatDecimalIt(result.currentPct, 2)}% oggi (MISURATO)
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-5 gap-y-3 2xl:border-t 2xl:border-[var(--border-subtle)] 2xl:pt-4">
                  <div>
                    <dt className="text-[11px] text-[var(--ink-muted)]">Nuovi voti, circa</dt>
                    <dd className="mt-0.5 font-mono text-[16px] font-semibold tabular-nums text-[var(--signal-positive)]">{formatCompactVotes(brief.payout.netNewVotesFromToday)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-[var(--ink-muted)]">Salto</dt>
                    <dd className="mt-0.5 font-mono text-[16px] font-semibold tabular-nums">{deltaPp >= 0 ? "+" : ""}{formatDecimalIt(deltaPp, 2)} pp</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-[var(--ink-muted)]">Fronti prioritari</dt>
                    <dd className="mt-0.5 font-mono text-[16px] font-semibold tabular-nums">{fronts}<span className="text-[12px] font-normal text-[var(--ink-muted)]"> su 20</span></dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-[var(--ink-muted)]">Regioni oltre 10%</dt>
                    <dd className="mt-0.5 font-mono text-[16px] font-semibold tabular-nums">{brief.payout.regionsAboveDoubleDigit.today}<span className="mx-1 text-[12px] font-normal text-[var(--ink-muted)]">a</span>{brief.payout.regionsAboveDoubleDigit.atTarget}</dd>
                  </div>
                </dl>
                <p className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1 text-[11px] text-[var(--signal-positive)]">
                  <i className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                  {brief.payout.strategicTierLabel}
                </p>
              </div>
              <div className="relative min-h-[260px] min-w-0">
                <TacticalItalyMap regions={result.regions} selected={focus?.region ?? null} onSelect={setSelected} stage />
              </div>
              <div className={`${GLASS} custom-scrollbar flex min-w-0 flex-col self-stretch overflow-y-auto p-4`}>
                {focus ? (
                  <>
                    <p className={KICKER}>Scheda regione</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button type="button" aria-label="Regione precedente" className={`${GHOST} h-7 w-7 p-0`} onClick={() => stepRegion(-1)}>
                        <ChevronLeft className="mx-auto h-4 w-4" />
                      </button>
                      <p className="text-center text-[15px] font-semibold tracking-tight">
                        {focus.region}
                        <span className="ml-1.5 font-mono text-[11px] font-normal text-[var(--ink-muted)]">
                          ({focusIndex + 1}/{ranked.length})
                        </span>
                      </p>
                      <button type="button" aria-label="Regione successiva" className={`${GHOST} h-7 w-7 p-0`} onClick={() => stepRegion(1)}>
                        <ChevronRight className="mx-auto h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-2">
                      <p className="font-mono text-[12px] tabular-nums text-[var(--ink-secondary)]">
                        {formatDecimalIt(focus.todayPct, 2)}% → {formatDecimalIt(focus.targetPct, 2)}%
                      </p>
                      <p className="font-mono text-[14px] font-semibold tabular-nums text-[var(--signal-positive)]">{formatCompactVotes(focus.addedVotes)}</p>
                    </div>
                    <RegionRadar plan={focus} />
                    <p className="mt-2 text-[11px] text-[var(--ink-muted)]">Tema prioritario</p>
                    <p className="text-[12px] leading-snug text-[var(--ink-secondary)]">{THEME_ATTACK[focus.theme]}</p>
                    <p className="mt-2 text-[11px] text-[var(--ink-muted)]">Carico rete locale</p>
                    <p className="font-mono text-[11px] tabular-nums text-[var(--ink-primary)]">
                      Comitati +{formatIntIt(localCommitteeNeed(focus.addedVotes))} · Tesserati +{formatIntIt(Math.max(0, Math.round(focus.addedVotes / 40)))}
                    </p>
                    <p className="mt-auto border-t border-[var(--border-subtle)] pt-2 font-mono text-[10px] tabular-nums text-[var(--ink-muted)]">
                      Totale piano: +{formatIntIt(result.network.deltaCommittees)} comitati · Tema guida: {guideTheme}
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className={`${CARD} obj-rise flex shrink-0 flex-col`} style={{ animationDelay: "180ms" }}>
            <div className="px-5 pt-4">
              <p className={KICKER}>Traiettoria del piano</p>
              {roadmap.executiveThesis ? (
                <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[var(--ink-secondary)]">
                  {stripThesisSuffix(roadmap.executiveThesis)}
                </p>
              ) : null}
            </div>
            <div className="px-3">
              <FanChart result={result} electorate={ballots} activePhase={stage ? { fromDay: stage.fromDay, toDay: stage.toDay } : null} />
            </div>
            <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] px-4 py-2.5 lg:flex-row lg:items-center">
              <StrategicStageRoadmap
                mode="backcast"
                stages={roadmap.stages}
                activeStageId={stage?.stageId}
                onSelect={(stageId) => openRoadmap(stageId)}
              />
              <button type="button" onClick={() => openRoadmap(phaseId)} className={ROADMAP}>
                <Route className="h-3.5 w-3.5" aria-hidden />
                Apri Roadmap Operativa AI ↗
              </button>
            </div>
          </div>
        </div>
      </div>

      {roadmapOpen ? (
        <RoadmapIframeModal
          params={{ targetPct: committed.targetPct, horizonDays: committed.horizonDays, stage: phaseId, theme }}
          scenario={scenario}
          flussiIpsos={flussiIpsos}
          roadmap={committed.roadmap}
          plan={committed.plan}
          floor={floor}
          pdfBusy={pdfBusy}
          lockPlan
          onClose={closeRoadmap}
          onStageChange={setPhaseId}
          onTargetChange={setPendingTarget}
          onHorizonChange={setPendingHorizon}
          onExportPdf={() => void exportPlan()}
        />
      ) : null}
      {monitorOpen && route ? <RouteMonitorModal route={route} scenario={scenario} flussiIpsos={flussiIpsos} onClose={closeMonitor} /> : null}
    </section>
  );
}
