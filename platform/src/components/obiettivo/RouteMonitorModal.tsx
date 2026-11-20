"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { FlussiIpsos } from "@/lib/engine/defaults";
import type { ScenarioResult } from "@/lib/engine/types";
import { buildOperationalRoadmap } from "@/lib/engine/operationalRoadmapBuilder";
import { assessPlanPlausibility } from "@/lib/engine/planRealityCheck";
import {
  monitorRoute,
  planCorridorAt,
  type ConsensoSource,
  type MonitorStatus,
  type PaceStatus,
  type RouteMonitorReport,
} from "@/lib/engine/routeMonitoringEngine";
import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import type { ActiveStrategicRouteState } from "@/lib/state/activeStrategicRoute";
import { useRouteLedger } from "@/lib/state/useRouteLedger";
import { useStrategicPlan } from "@/components/obiettivo/useStrategicPlan";

const CARD = "rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]";
const KICKER = "font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)]";
const INPUT =
  "h-7 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-2)] px-2 font-mono text-[12px] tabular-nums text-[var(--ink-primary)] outline-none focus:border-emerald-400/60";
const BTN =
  "obj-press inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--surface-2)] px-2.5 text-[12px] text-[var(--ink-primary)] hover:border-[var(--ink-muted)]";
const BTN_PRIMARY =
  "obj-press inline-flex h-7 items-center justify-center rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 text-[12px] font-medium text-[var(--signal-positive)] hover:bg-emerald-500/15";

const STATUS_LABEL: Record<MonitorStatus | PaceStatus, string> = {
  IN_ANTICIPO: "In anticipo",
  IN_ROTTA: "In rotta",
  DA_ACCELERARE: "Da accelerare",
  NON_DETERMINABILE: "Non ancora determinabile",
  NESSUN_DATO: "Nessun dato",
  CRITICO: "Critico",
};
const STATUS_TONE: Record<MonitorStatus | PaceStatus, string> = {
  IN_ANTICIPO: "border-emerald-500/40 bg-emerald-500/10 text-[var(--signal-positive)]",
  IN_ROTTA: "border-emerald-500/40 bg-emerald-500/10 text-[var(--signal-positive)]",
  DA_ACCELERARE: "border-amber-400/45 bg-amber-400/10 text-amber-300 light:text-amber-700",
  NON_DETERMINABILE: "border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--ink-secondary)]",
  NESSUN_DATO: "border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--ink-secondary)]",
  CRITICO: "border-red-500/45 bg-red-500/10 text-[var(--signal-danger)]",
};
const SEVERITY_TONE = {
  info: "text-[var(--ink-secondary)]",
  attenzione: "text-amber-300 light:text-amber-700",
  allarme: "text-[var(--signal-danger)]",
} as const;
const SOURCE_LABEL: Record<ConsensoSource, string> = { sondaggio: "Sondaggio", supermedia: "Supermedia", interno: "Rilevazione interna" };
const VERDICT_LABEL = {
  PLAUSIBILE: "Plausibile",
  AMBIZIOSO: "Ambizioso",
  ECCEZIONALE: "Eccezionale",
  RICHIEDE_SHOCK_ESTERNO: "Richiede uno shock esterno",
} as const;

const pp = (value: number, digits = 2) => `${formatDecimalIt(value, digits)}`;
const signed = (value: number, digits = 2) => `${value > 0 ? "+" : ""}${formatDecimalIt(value, digits)}`;
const round2 = (value: number) => Math.round(value * 100) / 100;
const todayIso = (now: Date) => now.toISOString().slice(0, 10);

function Badge({ status }: { status: MonitorStatus | PaceStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wide ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function TrackChart({
  report,
  plan,
  activatedAt,
  observations,
}: {
  report: RouteMonitorReport;
  plan: Parameters<typeof planCorridorAt>[0];
  activatedAt: string;
  observations: { id: string; date: string; pct: number }[];
}) {
  const W = 640;
  const H = 230;
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const horizon = report.horizonDays;
  const steps = 36;
  const days = Array.from({ length: steps + 1 }, (_, i) => (horizon * i) / steps);
  const corridor = days.map((day) => ({ day, ...planCorridorAt(plan, day) }));
  const start = Date.parse(`${activatedAt.slice(0, 10)}T00:00:00Z`);
  const obs = observations
    .map((row) => ({ ...row, day: Math.round((Date.parse(`${row.date}T00:00:00Z`) - start) / 86_400_000) }))
    .filter((row) => row.day >= 0 && row.day <= horizon);
  const values = [...corridor.flatMap((c) => [c.min, c.stretch]), ...obs.map((o) => o.pct), ...report.consenso.filtered.map((f) => f.pct)];
  const lo = Math.floor(Math.min(...values) - 0.3);
  const hi = Math.ceil(Math.max(...values) + 0.3);
  const x = (day: number) => round2(pad.l + (day / horizon) * (W - pad.l - pad.r));
  const y = (value: number) => round2(pad.t + (1 - (value - lo) / (hi - lo)) * (H - pad.t - pad.b));
  const line = (rows: { day: number; v: number }[]) => rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(r.day)},${y(r.v)}`).join(" ");
  const band =
    corridor.map((c, i) => `${i === 0 ? "M" : "L"}${x(c.day)},${y(c.stretch)}`).join(" ") +
    " " +
    [...corridor].reverse().map((c) => `L${x(c.day)},${y(c.min)}`).join(" ") +
    " Z";
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((_, i, arr) => arr.length <= 8 || i % 2 === 0);
  const filtered = report.consenso.filtered;
  const today = Math.min(horizon, report.elapsedDays);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Corridoio del piano e consenso osservato">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border-subtle)" strokeWidth={1} />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--ink-muted)" className="font-mono">
            {t}%
          </text>
        </g>
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <text key={f} x={x(horizon * f)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--ink-muted)" className="font-mono">
          {Math.round(horizon * f)}g
        </text>
      ))}
      <path d={band} fill="rgba(52,211,153,0.12)" />
      <path d={line(corridor.map((c) => ({ day: c.day, v: c.expected })))} fill="none" stroke="rgba(52,211,153,0.85)" strokeWidth={1.5} strokeDasharray="5 4" />
      {filtered.length > 1 ? (
        <>
          <path
            d={
              filtered.map((f, i) => `${i === 0 ? "M" : "L"}${x(f.day)},${y(f.pct + 1.64 * f.sd)}`).join(" ") +
              " " +
              [...filtered].reverse().map((f) => `L${x(f.day)},${y(f.pct - 1.64 * f.sd)}`).join(" ") +
              " Z"
            }
            fill="rgba(34,211,238,0.14)"
          />
          <path d={line(filtered.map((f) => ({ day: f.day, v: f.pct })))} fill="none" stroke="rgb(34,211,238)" strokeWidth={2} />
        </>
      ) : null}
      {obs.map((o) => (
        <circle key={o.id} cx={x(o.day)} cy={y(o.pct)} r={3} fill="var(--surface-1)" stroke="rgb(34,211,238)" strokeWidth={1.5} />
      ))}
      <line x1={x(today)} x2={x(today)} y1={pad.t} y2={H - pad.b} stroke="var(--ink-muted)" strokeWidth={1} strokeDasharray="2 3" />
      <text x={x(today)} y={pad.t + 8} textAnchor={today > horizon * 0.8 ? "end" : "start"} dx={today > horizon * 0.8 ? -4 : 4} fontSize={10} fill="var(--ink-secondary)" className="font-mono">
        oggi
      </text>
    </svg>
  );
}

export function RouteMonitorModal({
  route,
  scenario,
  flussiIpsos,
  onClose,
}: {
  route: ActiveStrategicRouteState;
  scenario: ScenarioResult;
  flussiIpsos: FlussiIpsos;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [now] = useState(() => new Date());
  const routeId = route.activatedAt;
  const { ledger, addConsenso, addRete, remove } = useRouteLedger(routeId);
  const live = useStrategicPlan(scenario, flussiIpsos, route.targetPct, route.horizonDays);
  const frozen = route.frozenPlan != null;
  const plan = route.frozenPlan ?? live.result;
  const roadmap = useMemo(() => (frozen ? buildOperationalRoadmap(plan, route.horizonDays) : live.roadmap), [frozen, plan, route.horizonDays, live.roadmap]);
  const reality = useMemo(() => assessPlanPlausibility(plan, route.horizonDays), [plan, route.horizonDays]);

  const currentNetwork = useMemo(
    () => ({
      committees: live.pack.currentCommittees,
      members: live.pack.currentMembers,
      elected: live.pack.regions.reduce((sum, row) => sum + row.localElected, 0),
    }),
    [live.pack],
  );
  const hasBaseline = route.baselineNetwork != null;
  const report = useMemo(
    () =>
      monitorRoute({
        route: {
          targetPct: route.targetPct,
          horizonDays: route.horizonDays,
          activatedAt: route.activatedAt,
          baselinePctAtActivation: route.baselinePctAtActivation,
          baselineNetwork: route.baselineNetwork ?? currentNetwork,
        },
        plan,
        roadmap,
        ledger,
        now,
        sigmaDailyPp: live.sigmaDailyPp,
      }),
    [route, plan, roadmap, ledger, now, live.sigmaDailyPp, currentNetwork],
  );

  const [cDate, setCDate] = useState(() => todayIso(now));
  const [cPct, setCPct] = useState("");
  const [cN, setCN] = useState("");
  const [cSource, setCSource] = useState<ConsensoSource>("sondaggio");
  const [nDate, setNDate] = useState(() => todayIso(now));
  const [nCommittees, setNCommittees] = useState("");
  const [nMembers, setNMembers] = useState("");
  const [nElected, setNElected] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const num = (value: string) => Number(value.replace(",", "."));

  function submitConsenso(event: FormEvent) {
    event.preventDefault();
    const pct = num(cPct);
    const n = cN.trim() ? num(cN) : undefined;
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 60) return setFormError("Inserisci un consenso tra 0 e 60 per cento.");
    if (n !== undefined && (!Number.isFinite(n) || n < 50)) return setFormError("Il campione deve essere di almeno 50 interviste.");
    if (cSource === "sondaggio" && n === undefined) return setFormError("Per un sondaggio indica il numero di interviste: senza, il peso del dato non si può calcolare.");
    setFormError(null);
    addConsenso({ date: cDate, pct, source: cSource, ...(n !== undefined ? { n } : {}) });
    setCPct("");
    setCN("");
  }

  function submitRete(event: FormEvent) {
    event.preventDefault();
    const committees = num(nCommittees);
    const members = num(nMembers);
    const elected = num(nElected);
    if (![committees, members, elected].every((value) => Number.isFinite(value) && value >= 0)) return setFormError("Inserisci comitati, tesserati ed eletti come totali cumulativi.");
    setFormError(null);
    addRete({ date: nDate, committees: Math.round(committees), members: Math.round(members), elected: Math.round(elected) });
  }

  function importCurrent() {
    setNCommittees(String(currentNetwork.committees));
    setNMembers(String(currentNetwork.members));
    setNElected(String(currentNetwork.elected));
  }

  const c = report.consenso;
  const sdLabel = `± ${pp(c.levelSd)} pp`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/75 p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Monitor di rotta"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="obj-rise flex h-11 shrink-0 items-center justify-between gap-3 rounded-t-xl border border-[var(--border-default)] bg-[var(--surface-1)] px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <p className="truncate font-mono text-[11px] tracking-[0.14em] text-[var(--ink-primary)]">MONITOR DI ROTTA</p>
          <span className="hidden shrink-0 rounded-full border border-[var(--border-default)] px-2 py-0.5 font-mono text-[10px] tabular-nums text-[var(--ink-secondary)] sm:inline">
            {formatDecimalIt(route.targetPct, 1)}% · giorno {report.elapsedDays} di {report.horizonDays}
          </span>
          <span className="hidden shrink-0 rounded-full border border-cyan-400/30 bg-cyan-500/[0.06] px-2 py-0.5 font-mono text-[10px] text-cyan-300 light:text-cyan-800 md:inline">
            Misurato · stima · piano (ipotesi)
          </span>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} className={BTN}>
          <X className="h-3.5 w-3.5" aria-hidden />
          Chiudi (ESC)
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-b-xl border-x border-b border-[var(--border-default)] bg-[var(--surface-canvas)] p-3">
        <div className="mx-auto grid max-w-[1400px] gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <section className={`${CARD} p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={KICKER}>VERDETTO</p>
                  <h2 className="mt-1 text-[18px] font-semibold leading-snug text-[var(--ink-primary)]">{report.diagnosis.headline}</h2>
                </div>
                <Badge status={c.status} />
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-secondary)]">{report.diagnosis.detail}</p>
              {c.observations > 0 ? (
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { k: "Consenso stimato", v: `${pp(c.levelPct)}% ${sdLabel}` },
                    { k: "Atteso oggi", v: `${pp(c.expectedPct)}% (${signed(c.gapToExpectedPp)} pp)` },
                    { k: "Pendenza", v: `${signed(c.slopePpPerMonth)} pp/mese` },
                    { k: "Probabilità di arrivare al traguardo", v: `${Math.round(c.probReachTarget * 100)}%` },
                  ].map((item) => (
                    <div key={item.k} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-2">
                      <dt className="text-[10px] leading-tight text-[var(--ink-muted)]">{item.k}</dt>
                      <dd className="mt-1 font-mono text-[13px] tabular-nums text-[var(--ink-primary)]">{item.v}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {c.status === "NON_DETERMINABILE" ? (
                <p className="mt-2 text-[12px] text-[var(--ink-secondary)]">
                  Serve ancora circa {c.extraPollsToResolve} rilevazioni per poter dire con una certa sicurezza se siamo dentro o fuori corridoio.
                </p>
              ) : null}
            </section>

            <section className={`${CARD} p-4`}>
              <p className={KICKER}>ORDINI DELLA SETTIMANA</p>
              <ol className="mt-2 space-y-1.5">
                {report.weeklyOrders.map((order, index) => (
                  <li key={order} className="flex gap-2 text-[13px] leading-snug text-[var(--ink-primary)]">
                    <span className="mt-0.5 font-mono text-[11px] text-[var(--ink-muted)]">{index + 1}</span>
                    <span>{order}</span>
                  </li>
                ))}
              </ol>
              {report.alerts.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-[var(--border-subtle)] pt-3">
                  {report.alerts.map((alert) => (
                    <li key={alert.code + alert.message} className={`text-[12px] leading-snug ${SEVERITY_TONE[alert.severity]}`}>
                      {alert.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 text-[11px] text-[var(--ink-muted)]">
                Prossima rilevazione entro il {report.nextMeasurement.date}: {report.nextMeasurement.what}
              </p>
            </section>

            <section className={`${CARD} p-4`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className={KICKER}>CORRIDOIO DEL PIANO E CONSENSO OSSERVATO</p>
                <p className="text-[10px] text-[var(--ink-muted)]">
                  Fascia verde: corridoio del piano. Linea azzurra: stima filtrata con intervallo all&apos;80%. Cerchi: rilevazioni.
                </p>
              </div>
              <div className="mt-2">
                <TrackChart report={report} plan={plan} activatedAt={route.activatedAt} observations={ledger.consenso} />
              </div>
            </section>

            <section className={`${CARD} p-4`}>
              <p className={KICKER}>RETE TERRITORIALE</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[12px]">
                  <thead className="text-[10px] text-[var(--ink-muted)]">
                    <tr>
                      <th className="py-1 pr-2 font-normal">Indicatore</th>
                      <th className="py-1 pr-2 font-normal">Stato</th>
                      <th className="py-1 pr-2 text-right font-normal">Fatto</th>
                      <th className="py-1 pr-2 text-right font-normal">Previsto</th>
                      <th className="py-1 pr-2 text-right font-normal">Ritmo attuale / richiesto / massimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.network.map((kpi) => (
                      <tr key={kpi.key} className="border-t border-[var(--border-subtle)]">
                        <td className="py-1.5 pr-2 text-[var(--ink-primary)]">{kpi.label}</td>
                        <td className="py-1.5 pr-2">
                          <Badge status={kpi.status} />
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{kpi.actual == null ? "—" : formatIntIt(Math.round(kpi.actual))}</td>
                        <td className="py-1.5 pr-2 text-right font-mono tabular-nums text-[var(--ink-secondary)]">{formatIntIt(Math.round(kpi.planned))}</td>
                        <td className={`py-1.5 pr-2 text-right font-mono tabular-nums ${kpi.recoverable ? "text-[var(--ink-secondary)]" : "text-[var(--signal-danger)]"}`}>
                          {kpi.currentMonthly == null ? "—" : formatIntIt(Math.round(kpi.currentMonthly))} / {formatIntIt(Math.round(kpi.requiredMonthly))} / {formatIntIt(Math.round(kpi.capMonthly))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-[var(--ink-muted)]">
                Valori mensili. Se il ritmo richiesto supera il massimo, il ritardo non è più recuperabile senza cambiare il piano.
              </p>
            </section>

            <section className={`${CARD} p-4`}>
              <p className={KICKER}>TAPPE</p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {report.gates.map((gate) => (
                  <li key={gate.stageId} className={`rounded-lg border px-3 py-2 ${gate.stageId === report.currentStageId ? "border-cyan-400/40" : "border-[var(--border-subtle)]"} bg-[var(--surface-2)]`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-medium text-[var(--ink-primary)]">
                        {gate.stageId}. {gate.label}
                      </p>
                      <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                        {gate.state === "CHIUSA" ? "chiusa" : gate.state === "IN_CORSO" ? "in corso" : "futura"} · g{gate.toDay}
                      </span>
                    </div>
                    <p
                      className={`mt-1 font-mono text-[10px] tracking-wide ${
                        gate.verdict === "SUPERATO" ? "text-[var(--signal-positive)]" : gate.verdict === "DA_VALUTARE" ? "text-[var(--ink-muted)]" : "text-amber-300 light:text-amber-700"
                      }`}
                    >
                      {gate.verdict.replace("_", " ")}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {gate.criteria.map((criterion) => (
                        <li key={criterion.key} className="flex justify-between gap-2 text-[11px] text-[var(--ink-secondary)]">
                          <span>{criterion.label}</span>
                          <span className="font-mono tabular-nums">
                            {criterion.value == null ? "—" : formatDecimalIt(criterion.value, criterion.key === "consenso" ? 2 : 0)} / {formatDecimalIt(criterion.needed, criterion.key === "consenso" ? 2 : 0)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="space-y-3">
            <section className={`${CARD} p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className={KICKER}>QUANTO È CREDIBILE IL PIANO</p>
                <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] text-amber-300 light:text-amber-700">
                  {VERDICT_LABEL[reality.verdict]}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-primary)]">{reality.headline}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-secondary)]">
                Il modello previsionale copre {pp(reality.v4CoveredPp, 1)} dei {pp(reality.totalGrowthPp, 1)} punti richiesti. Il restante {Math.round(reality.catalystShare * 100)}% dipende da un fattore che non controlliamo.
              </p>
              <ul className="mt-3 space-y-1.5">
                {reality.analogs.map((analog) => (
                  <li key={analog.label} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-2">
                    <p className="flex justify-between gap-2 text-[12px] text-[var(--ink-primary)]">
                      <span>{analog.label}</span>
                      <span className="font-mono tabular-nums">{pp(analog.ppPerMonth)} pp/mese</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--ink-secondary)]">{analog.note}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--ink-muted)]">Fonte: {analog.source}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] leading-relaxed text-[var(--ink-secondary)]">
                Per mobilitare circa {formatIntIt(reality.groundGame.mobilizedVotes)} elettori servono tra {formatIntIt(Math.round(reality.groundGame.contactsLow / 1000) * 1000)} e {formatIntIt(Math.round(reality.groundGame.contactsHigh / 1000) * 1000)} contatti, cioè tra {formatIntIt(Math.round(reality.groundGame.fullTimeCanvassersLow))} e {formatIntIt(Math.round(reality.groundGame.fullTimeCanvassersHigh))} volontari a tempo pieno. {reality.groundGame.note}
              </p>
              <ul className="mt-3 space-y-1">
                {reality.flags.map((flag) => (
                  <li key={flag.text} className={`text-[12px] leading-snug ${SEVERITY_TONE[flag.severity]}`}>
                    {flag.text}
                  </li>
                ))}
              </ul>
              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] text-[var(--ink-muted)]">Limiti di questa valutazione</summary>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] text-[var(--ink-secondary)]">
                  {reality.caveats.map((caveat) => (
                    <li key={caveat}>{caveat}</li>
                  ))}
                </ul>
              </details>
            </section>

            <section className={`${CARD} p-4`}>
              <p className={KICKER}>REGISTRO RILEVAZIONI</p>
              {!frozen ? (
                <p className="mt-2 text-[11px] text-amber-300 light:text-amber-700">
                  Questa rotta è stata attivata prima del monitor: il piano non è congelato e può cambiare con i dati di oggi. Riattivala per fissarlo.
                </p>
              ) : null}
              {!hasBaseline ? (
                <p className="mt-1 text-[11px] text-amber-300 light:text-amber-700">
                  Manca la rete di partenza: la base è presa dai valori di oggi, quindi i progressi precedenti non sono misurabili.
                </p>
              ) : null}

              <form onSubmit={submitConsenso} className="mt-3 grid grid-cols-2 gap-2">
                <p className="col-span-2 text-[12px] font-medium text-[var(--ink-primary)]">Nuovo dato di consenso</p>
                <label className="text-[10px] text-[var(--ink-muted)]">
                  Data
                  <input type="date" value={cDate} onChange={(event) => setCDate(event.target.value)} className={INPUT} required />
                </label>
                <label className="text-[10px] text-[var(--ink-muted)]">
                  Consenso (%)
                  <input inputMode="decimal" value={cPct} onChange={(event) => setCPct(event.target.value)} placeholder="7,4" className={INPUT} required />
                </label>
                <label className="text-[10px] text-[var(--ink-muted)]">
                  Fonte
                  <select value={cSource} onChange={(event) => setCSource(event.target.value as ConsensoSource)} className={INPUT}>
                    {(Object.keys(SOURCE_LABEL) as ConsensoSource[]).map((key) => (
                      <option key={key} value={key}>
                        {SOURCE_LABEL[key]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] text-[var(--ink-muted)]">
                  Interviste
                  <input inputMode="numeric" value={cN} onChange={(event) => setCN(event.target.value)} placeholder="1000" className={INPUT} disabled={cSource === "supermedia"} />
                </label>
                <button type="submit" className={`${BTN_PRIMARY} col-span-2`}>
                  Aggiungi al registro
                </button>
              </form>

              <form onSubmit={submitRete} className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--border-subtle)] pt-3">
                <p className="col-span-3 flex items-center justify-between text-[12px] font-medium text-[var(--ink-primary)]">
                  Rete territoriale (totali)
                  <button type="button" onClick={importCurrent} className={BTN}>
                    Importa dati attuali
                  </button>
                </p>
                <label className="col-span-3 text-[10px] text-[var(--ink-muted)]">
                  Data
                  <input type="date" value={nDate} onChange={(event) => setNDate(event.target.value)} className={INPUT} required />
                </label>
                <label className="text-[10px] text-[var(--ink-muted)]">
                  Comitati
                  <input inputMode="numeric" value={nCommittees} onChange={(event) => setNCommittees(event.target.value)} className={INPUT} required />
                </label>
                <label className="text-[10px] text-[var(--ink-muted)]">
                  Tesserati
                  <input inputMode="numeric" value={nMembers} onChange={(event) => setNMembers(event.target.value)} className={INPUT} required />
                </label>
                <label className="text-[10px] text-[var(--ink-muted)]">
                  Eletti
                  <input inputMode="numeric" value={nElected} onChange={(event) => setNElected(event.target.value)} className={INPUT} required />
                </label>
                <button type="submit" className={`${BTN_PRIMARY} col-span-3`}>
                  Aggiungi al registro
                </button>
              </form>
              {formError ? <p className="mt-2 text-[12px] text-[var(--signal-danger)]">{formError}</p> : null}

              {ledger.consenso.length + ledger.rete.length > 0 ? (
                <ul className="mt-4 space-y-1 border-t border-[var(--border-subtle)] pt-3">
                  {[
                    ...ledger.consenso.map((row) => ({
                      id: row.id,
                      date: row.date,
                      text: `${SOURCE_LABEL[row.source]} ${pp(row.pct)}%${row.n ? ` su ${formatIntIt(row.n)}` : ""}`,
                    })),
                    ...ledger.rete.map((row) => ({
                      id: row.id,
                      date: row.date,
                      text: `Rete: ${formatIntIt(row.committees)} comitati, ${formatIntIt(row.members)} tesserati, ${formatIntIt(row.elected)} eletti`,
                    })),
                  ]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((row) => (
                      <li key={row.id} className="flex items-center justify-between gap-2 text-[11px] text-[var(--ink-secondary)]">
                        <span className="min-w-0 truncate">
                          <span className="font-mono text-[var(--ink-muted)]">{row.date}</span> · {row.text}
                        </span>
                        <button type="button" onClick={() => remove(row.id)} className="shrink-0 text-[var(--ink-muted)] hover:text-[var(--signal-danger)]" aria-label={`Elimina rilevazione del ${row.date}`}>
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </li>
                    ))}
                </ul>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
