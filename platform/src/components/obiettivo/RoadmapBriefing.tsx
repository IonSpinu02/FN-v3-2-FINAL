"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Anchor,
  Building,
  CircleCheck,
  Factory,
  Globe2,
  Hospital,
  Landmark,
  MapPin,
  Megaphone,
  Mountain,
  ShieldAlert,
  Siren,
  TrainFront,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Region } from "@/lib/engine/constants";
import type { FlussiIpsos } from "@/lib/engine/defaults";
import type { ScenarioResult } from "@/lib/engine/types";
import type { HorizonDays } from "@/lib/engine/strategicBackcastEngine";
import {
  ensureOperationalRoadmapDepth,
  type RoadmapLane,
  type RoadmapPlaceKind,
  type RoadmapStage,
} from "@/lib/engine/operationalRoadmapBuilder";
import { DEFAULT_FLUSSI_MATRIX_ID, flussiFromMatrix } from "@/lib/politicalModel";
import { formatApproximateVotes, formatCompactVotes } from "@/lib/formatApproximateVotes";
import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import { isRoadmapSyncMessage, type RoadmapChildMessage, type RoadmapEmbedParams, type RoadmapStageId } from "@/lib/roadmapEmbed";
import { useTheme } from "@/components/theme/ThemeProvider";
import { TacticalItalyMap } from "@/components/obiettivo/TacticalItalyMap";
import { useStrategicPlan } from "@/components/obiettivo/useStrategicPlan";
import { sanitizeRoadmapGenerationDiagnostic } from "@/lib/strategy/generatedStrategicPlan";

const KICKER = "font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)]";
const CARD = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)]";
const BADGE = "inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] text-[var(--signal-positive)]";

const KIND_ICON: Record<RoadmapPlaceKind, LucideIcon> = {
  "Stazione e sicurezza": TrainFront,
  "Distretto produttivo": Factory,
  "Polo sanitario": Hospital,
  "Porto e logistica": Anchor,
  "Periferia urbana": MapPin,
  "Aree interne": Mountain,
  "Area metropolitana": Building,
};

const LANES: Record<RoadmapLane, { title: string; subtitle: string; icon: LucideIcon }> = {
  Aria: { title: "ARIA", subtitle: "Media e dossier", icon: Megaphone },
  Terra: { title: "TERRA & CATEGORIE", subtitle: "Piazze, comitati e categorie", icon: Users },
  Istituzioni: { title: "ISTITUZIONI", subtitle: "Sindaci, eletti e liste civiche", icon: Landmark },
};

function engineBadge(roadmap: { generatedBy: string; generationMeta?: { modelLabel: string; diagnostic: string } }) {
  const label = roadmap.generatedBy === "AI_MODEL" ? "Strategia AI" : "Variante automatica";
  const title =
    sanitizeRoadmapGenerationDiagnostic(roadmap.generationMeta?.diagnostic) ??
    (roadmap.generatedBy === "AI_MODEL"
      ? "Roadmap redatta con assistente AI."
      : "Variante automatica di riserva.");
  return (
    <span className={`${BADGE} border-cyan-400/30 bg-cyan-500/[0.06] text-cyan-300 light:text-cyan-800`} title={title}>
      {label}
    </span>
  );
}

function MetricTable({ stage }: { stage: RoadmapStage }) {
  const rows: [string, string, string][] = [
    ["Voti", formatCompactVotes(stage.stageVotesDelta), formatCompactVotes(stage.cumulativeVotesTarget)],
    ["Comitati", `+${formatIntIt(stage.stageCommitteesDelta)}`, `+${formatIntIt(stage.committees)}`],
    ["Tesserati", `+${formatIntIt(stage.stageMembersDelta)}`, `+${formatIntIt(stage.members)}`],
    ["Eletti", `+${formatIntIt(stage.stageOfficialsDelta)}`, `+${formatIntIt(stage.elected)}`],
  ];
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="text-[10px] text-[var(--ink-muted)]">
          <th className="pb-1 font-normal" />
          <th className="pb-1 text-right font-normal">Di tappa</th>
          <th className="pb-1 text-right font-normal">Cumulati</th>
        </tr>
      </thead>
      <tbody className="font-mono text-[12px] tabular-nums">
        {rows.map(([label, delta, total]) => (
          <tr key={label} className="border-t border-[var(--border-subtle)]">
            <td className="py-1 font-sans text-[12px] text-[var(--ink-secondary)]">{label}</td>
            <td className="py-1 text-right text-[var(--signal-positive)]">{delta}</td>
            <td className="py-1 text-right text-[var(--ink-primary)]">{total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RoadmapBriefing({
  initialScenario,
  initialParams,
}: {
  initialScenario: ScenarioResult;
  initialParams: RoadmapEmbedParams;
}) {
  const { setTheme } = useTheme();
  const [scenario, setScenario] = useState(initialScenario);
  const [flussi, setFlussi] = useState<FlussiIpsos>(() => flussiFromMatrix(DEFAULT_FLUSSI_MATRIX_ID));
  const [target, setTarget] = useState(initialParams.targetPct);
  const [horizon, setHorizon] = useState<HorizonDays>(initialParams.horizonDays);
  const [stageId, setStageId] = useState<RoadmapStageId>(initialParams.stage);
  const [selected, setSelected] = useState<Region | null>(null);
  const [syncedRoadmap, setSyncedRoadmap] = useState<import("@/lib/engine/operationalRoadmapBuilder").OperationalRoadmap | null>(null);
  const [syncedPlan, setSyncedPlan] = useState<import("@/lib/engine/strategicBackcastEngine").StrategicBackcastResult | null>(null);
  const live = useStrategicPlan(scenario, flussi, target, horizon);
  const result = syncedPlan ?? live.result;
  const roadmap = ensureOperationalRoadmapDepth(syncedRoadmap ?? live.roadmap);
  const safeTarget = syncedPlan?.targetPct ?? live.safeTarget;

  const postToParent = useCallback((message: RoadmapChildMessage) => {
    if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
  }, []);

  useEffect(() => {
    setTheme(initialParams.theme);
  }, [initialParams.theme, setTheme]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !isRoadmapSyncMessage(event.data)) return;
      const { params, scenario: nextScenario, flussiIpsos, roadmap: nextRoadmap, plan: nextPlan } = event.data;
      setTarget(params.targetPct);
      setHorizon(params.horizonDays);
      setStageId(params.stage);
      setTheme(params.theme);
      if (nextScenario) setScenario(nextScenario);
      if (flussiIpsos) setFlussi(flussiIpsos);
      if (nextRoadmap) setSyncedRoadmap(nextRoadmap);
      if (nextPlan) setSyncedPlan(nextPlan);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") postToParent({ type: "fn-roadmap-close" });
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);
    postToParent({ type: "fn-roadmap-ready" });
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
    };
  }, [postToParent, setTheme]);

  const selectStage = (id: RoadmapStageId) => {
    setStageId(id);
    setSelected(null);
    postToParent({ type: "fn-roadmap-stage", stage: id });
  };

  const stage = roadmap.stages.find((item) => item.stageId === stageId) ?? roadmap.stages[0];
  const previous = roadmap.stages.filter((item) => item.stageId < stage.stageId).flatMap((item) => item.regions);
  const last = roadmap.stages[3];
  const placesTotal = roadmap.stages.reduce((sum, item) => sum + item.placesToPresidiate.length, 0);
  const kpis: { label: string; value: string; icon: LucideIcon }[] = [
    { label: "Snodi fisici da presidiare", value: formatIntIt(placesTotal), icon: MapPin },
    { label: "Comitati da aprire", value: `+${formatIntIt(last.committees)}`, icon: Users },
    { label: "Nuovi tesserati", value: `+${formatIntIt(last.members)}`, icon: CircleCheck },
    { label: "Amministratori da innestare", value: `+${formatIntIt(last.elected)}`, icon: Landmark },
  ];

  return (
    <main className="custom-scrollbar h-dvh w-full overflow-y-auto bg-[var(--surface-canvas)] text-[var(--ink-primary)]">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4 p-4 sm:p-6">
        <section className="obj-stage obj-rise overflow-hidden rounded-2xl border border-[var(--border-subtle)] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className={KICKER}>MISSIONE</p>
                <span className={BADGE}>IPOTESI</span>
                {engineBadge(roadmap)}
              </div>
              <h1 className="mt-2 text-[clamp(22px,2.4vw,34px)] font-semibold leading-tight tracking-tight">
                Da {formatDecimalIt(result.currentPct, 2)}% a {formatDecimalIt(safeTarget, 1)}% in {horizon} giorni
              </h1>
              <p className="mt-1 text-[14px] text-[var(--ink-secondary)]">
                {formatApproximateVotes(result.totalDeltaVotes)} · da oggi (misurato) alla traiettoria stimata
              </p>
              {roadmap.executiveThesis ? (
                <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-[var(--ink-secondary)]">{roadmap.executiveThesis}</p>
              ) : null}
            </div>
            <dl className="grid w-full grid-cols-2 gap-3 sm:w-auto lg:grid-cols-4">
              {kpis.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <div key={kpi.label} className="min-w-[150px] rounded-xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-1)_70%,transparent)] px-3.5 py-2.5 backdrop-blur-md">
                    <dt className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
                      <Icon className="h-3.5 w-3.5 text-[var(--signal-positive)]" aria-hidden />
                      {kpi.label}
                    </dt>
                    <dd className="mt-1 font-mono text-[20px] font-semibold tabular-nums">{kpi.value}</dd>
                  </div>
                );
              })}
            </dl>
          </div>

          <div className="relative mt-6" role="tablist" aria-label="Tappe della campagna">
            <div className="absolute left-[10%] right-[10%] top-[11px] h-px bg-[var(--border-default)]" aria-hidden />
            <div
              className="absolute left-[10%] top-[11px] h-px bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)] transition-[width] duration-500 ease-out"
              style={{ width: `${(stage.stageId / 4) * 80}%` }}
              aria-hidden
            />
            <ol className="relative grid grid-cols-5">
              <li className="flex flex-col items-center text-center">
                <span className="block h-[22px] w-[22px] rounded-full border-2 border-cyan-400 bg-[var(--surface-1)]" aria-hidden />
                <p className="mt-2 text-[11px] text-[var(--ink-muted)]">Oggi · MISURATO</p>
                <p className="font-mono text-[16px] font-semibold tabular-nums">{formatDecimalIt(result.currentPct, 2)}%</p>
              </li>
              {roadmap.stages.map((item) => {
                const on = item.stageId === stage.stageId;
                const done = item.stageId < stage.stageId;
                return (
                  <li key={item.stageId} className="flex flex-col items-center text-center">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => selectStage(item.stageId)}
                      className="obj-press group flex flex-col items-center"
                    >
                      <span
                        className={`block h-[22px] w-[22px] rounded-full border-2 transition-colors duration-300 ${
                          on
                            ? "border-emerald-400 bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]"
                            : done
                              ? "border-cyan-400 bg-cyan-400/40"
                              : "border-[var(--border-default)] bg-[var(--surface-1)] group-hover:border-emerald-400/60"
                        }`}
                        aria-hidden
                      />
                      <span className={`mt-2 text-[11px] ${on ? "text-[var(--signal-positive)]" : "text-[var(--ink-muted)]"}`}>Tappa {item.stageId}</span>
                      <span className="font-mono text-[16px] font-semibold tabular-nums">{formatDecimalIt(item.targetConsensusPct, 2)}%</span>
                      <span className="hidden text-[11px] text-[var(--ink-muted)] sm:block">{item.dayRangeLabel}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className={`${CARD} obj-rise flex flex-col p-4`} style={{ animationDelay: "80ms" }}>
            <div className="flex items-center justify-between gap-2">
              <p className={KICKER}>ONDA DI ESPANSIONE · TAPPA {stage.stageId}</p>
              <span className={BADGE}>IPOTESI</span>
            </div>
            <div className="relative mt-2 h-[420px]">
              <TacticalItalyMap
                regions={result.regions}
                selected={selected}
                onSelect={setSelected}
                stage
                wave={{ current: stage.regions, previous }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stage.regions.map((region) => (
                <span key={region} className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-[11px] text-[var(--ink-secondary)]">
                  {region}
                </span>
              ))}
            </div>
          </div>

          <article className={`${CARD} obj-rise flex min-w-0 flex-col gap-5 p-5`} style={{ animationDelay: "140ms" }} aria-live="polite">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--signal-positive)]">TAPPA {stage.stageId} · {stage.dayRangeLabel.toUpperCase()}</p>
                  <span className={BADGE}>IPOTESI</span>
                </div>
                <h2 className="mt-1 text-[22px] font-semibold tracking-tight">{stage.label}</h2>
                <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-[var(--ink-secondary)]">{stage.focus}</p>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-[11px] text-[var(--ink-muted)]">Obiettivo di tappa</p>
                  <p className="font-mono text-[28px] font-semibold leading-none tabular-nums">{formatDecimalIt(stage.targetConsensusPct, 2)}%</p>
                  <p className="mt-1 text-[11px] text-[var(--ink-muted)]">In rotta da {formatDecimalIt(stage.verificationMilestone.minOnTrackPct, 2)}%</p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--ink-muted)]">Voti di tappa</p>
                  <p className="font-mono text-[28px] font-semibold leading-none tabular-nums text-[var(--signal-positive)]">{formatCompactVotes(stage.stageVotesDelta)}</p>
                  <p className="mt-1 text-[11px] text-[var(--ink-muted)]">Cumulati {formatCompactVotes(stage.cumulativeVotesTarget)}</p>
                </div>
              </div>
            </header>

            <div>
              <p className={KICKER}>TESI DELLA TAPPA · PERCHÉ QUESTA MOSSA ORA</p>
              <div className="mt-2 grid grid-cols-1 gap-2.5 md:grid-cols-3">
                {[
                  ["Perché in questa finestra", stage.strategicRationale.whyNow],
                  ["Meccanismo di conversione elettorale", stage.strategicRationale.voterPsychologyMechanism],
                  ["Collo di bottiglia risolto", stage.strategicRationale.structuralObjective],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3.5">
                    <p className="font-mono text-[10px] tracking-[0.12em] text-[var(--ink-muted)]">{title}</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-secondary)]">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className={KICKER}>PIANO D&apos;AZIONE DETTAGLIATO · COSA FARE E PERCHÉ FUNZIONA</p>
              <div className="mt-2 grid grid-cols-1 gap-2.5 md:grid-cols-3">
                {stage.detailedMoves.map((move) => {
                  const lane = LANES[move.lane];
                  const Icon = lane.icon;
                  return (
                    <div key={move.lane} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3.5">
                      <p className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-cyan-400" aria-hidden />
                        <span className="font-mono text-[11px] tracking-[0.12em] text-[var(--ink-primary)]">{lane.title}</span>
                      </p>
                      <p className="mt-1 text-[14px] font-semibold leading-snug text-[var(--ink-primary)]">{move.headline}</p>
                      <p className="mt-2 text-[11px] font-medium text-[var(--ink-muted)]">Cosa fare</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--ink-secondary)]">{move.whatToDo}</p>
                      <div className="mt-3 border-l-2 border-emerald-400/70 pl-3">
                        <p className="text-[11px] font-medium text-[var(--signal-positive)]">Perché sposta voti</p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-secondary)]">{move.whyItWorks}</p>
                      </div>
                      <p className="mt-3 text-[11px] font-medium text-[var(--ink-muted)]">Attrito previsto &amp; soluzione</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-secondary)]">{move.expectedFriction}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className={KICKER}>RADAR DELLE INTERFERENZE ESTERNE &amp; CONTROMOSSE</p>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                {(
                  [
                    {
                      title: "Disagio Sociale & Economico da Presidiare",
                      body: stage.interferenceMatrix.socialDiscontentVector,
                      icon: ShieldAlert,
                    },
                    {
                      title: "Mosse & Dichiarazioni Altri Partiti → Contromossa",
                      body: stage.interferenceMatrix.otherPartiesMoves,
                      icon: Megaphone,
                    },
                    {
                      title: "Eventi, Piazze, Scioperi & Calendario",
                      body: stage.interferenceMatrix.eventsAndProtests,
                      icon: Siren,
                    },
                    {
                      title: "Variabili Internazionali, Dazi & UE",
                      body: stage.interferenceMatrix.internationalAndEuFactor,
                      icon: Globe2,
                    },
                  ] as const
                ).map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.title} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3.5">
                      <p className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-cyan-400" aria-hidden />
                        <span className="font-mono text-[10px] tracking-[0.12em] text-[var(--ink-primary)]">{card.title}</span>
                      </p>
                      <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-secondary)]">{card.body}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/[0.06] p-3.5">
                <p className="font-mono text-[10px] tracking-[0.12em] text-amber-200 light:text-amber-800">
                  PROTOCOLLO DI CONTINGENZA (SE LO SCENARIO CAMBIA)
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-secondary)]">
                  {stage.interferenceMatrix.contingencyPlaybook}
                </p>
              </div>
            </div>

            <div>
              <p className={KICKER}>SNODI FISICI DA PRESIDIARE</p>
              <ul className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {stage.placesToPresidiate.map((place) => {
                  const Icon = KIND_ICON[place.kind];
                  return (
                    <li key={place.place}>
                      <button
                        type="button"
                        onClick={() => setSelected(place.region)}
                        className={`obj-press flex h-full w-full items-start gap-3 rounded-xl border p-3 text-left ${
                          selected === place.region ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-[var(--border-subtle)] bg-[var(--surface-2)] hover:border-[var(--border-default)]"
                        }`}
                      >
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
                          <Icon className="h-4 w-4 text-[var(--signal-positive)]" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium leading-snug">{place.place}</span>
                          <span className="mt-0.5 block text-[11px] text-[var(--ink-muted)]">{place.kind} · {place.region}</span>
                          <span className="mt-1 block text-[12px] leading-snug text-[var(--ink-secondary)]">{place.rationale}</span>
                          {place.socialPainPoint ? (
                            <span className="mt-1.5 block text-[11px] leading-snug text-cyan-300 light:text-cyan-800">
                              Crisi locale: {place.socialPainPoint}
                            </span>
                          ) : null}
                          {place.tacticalActionOnSite ? (
                            <span className="mt-1 block text-[11px] leading-snug text-[var(--ink-secondary)]">
                              Sul posto: {place.tacticalActionOnSite}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/[0.05] p-4">
              <p className={KICKER}>GATE DI VERIFICA A FINE TAPPA</p>
              <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] text-[var(--ink-secondary)] sm:grid-cols-2">
                {[
                  ["Consenso almeno al", `${formatDecimalIt(stage.verificationMilestone.minOnTrackPct, 2)}%`],
                  ["Comitati aperti in totale", `+${formatIntIt(stage.committees)}`],
                  ["Tesserati acquisiti in totale", `+${formatIntIt(stage.members)}`],
                  ["Amministratori innestati in totale", `+${formatIntIt(stage.elected)}`],
                ].map(([label, value]) => (
                  <li key={label} className="flex items-center gap-2">
                    <CircleCheck className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
                    <span className="min-w-0 flex-1">{label}</span>
                    <span className="font-mono tabular-nums text-[var(--ink-primary)]">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </section>

        <section className="obj-rise" style={{ animationDelay: "200ms" }}>
          <div className="mb-2 flex items-center gap-2">
            <p className={KICKER}>VISTA SINOTTICA DELLE 4 TAPPE</p>
            <span className={BADGE}>IPOTESI</span>
          </div>
          <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4">
            {roadmap.stages.map((item) => {
              const on = item.stageId === stage.stageId;
              return (
                <article
                  key={item.stageId}
                  className={`flex flex-col justify-between gap-4 rounded-2xl border p-4 transition-colors ${on ? "border-emerald-500/40 bg-emerald-500/[0.05]" : "border-[var(--border-subtle)] bg-[var(--surface-1)]"}`}
                >
                  <div>
                    <button type="button" onClick={() => selectStage(item.stageId)} className="w-full text-left">
                      <p className="font-mono text-[10px] tracking-[0.14em] text-[var(--signal-positive)]">TAPPA {item.stageId} · {item.dayRangeLabel.toUpperCase()}</p>
                      <p className="mt-1 text-[15px] font-semibold leading-snug">{item.label}</p>
                      <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums">{formatDecimalIt(item.targetConsensusPct, 2)}%</p>
                    </button>
                    <p className="mt-3 text-[11px] text-[var(--ink-muted)]">Razionale chiave</p>
                    <p className="mt-1 text-[12px] leading-snug text-[var(--ink-secondary)]">{item.strategicRationale.whyNow}</p>
                    <p className="mt-3 text-[11px] text-[var(--ink-muted)]">Interferenza critica &amp; Contromossa</p>
                    <p className="mt-1 text-[12px] leading-snug text-[var(--ink-secondary)]">{item.interferenceMatrix.otherPartiesMoves}</p>
                    <p className="mt-3 text-[11px] text-[var(--ink-muted)]">Presidi</p>
                    <ul className="mt-1 space-y-1 text-[12px] leading-snug text-[var(--ink-secondary)]">
                      {item.placesToPresidiate.map((place) => (
                        <li key={place.place}>{place.place}</li>
                      ))}
                    </ul>
                    <p className="mt-3 text-[11px] text-[var(--ink-muted)]">Azioni</p>
                    <ul className="mt-1 space-y-1.5 text-[12px] leading-snug text-[var(--ink-secondary)]">
                      {item.detailedMoves.map((move) => (
                        <li key={move.lane}>
                          <span className="text-[var(--ink-primary)]">{move.lane}.</span> {move.headline}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <footer className="border-t border-[var(--border-subtle)] pt-3">
                    <MetricTable stage={item} />
                  </footer>
                </article>
              );
            })}
          </div>
          <p className="mt-3 font-mono text-[10px] text-[var(--ink-muted)]">
            Oggi misurato · traiettoria stimata · tappe, luoghi, azioni e rete (ipotesi). I voti sono arrotondati e indicativi.
          </p>
        </section>
      </div>
    </main>
  );
}
