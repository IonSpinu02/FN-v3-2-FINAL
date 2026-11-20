"use client";

import { ItalyMap } from "@/components/ItalyMap";
import { OFFICIAL_S } from "@/lib/engine/defaults";
import { buildRegionalGrowthMap, flussiFromMatrix } from "@/lib/politicalModel";
import { scenarioToRegionalGrowthInputs } from "@/lib/regionalGrowthInputs";
import { computePartyGrowthForecast } from "@/lib/engine/partyGrowthForecast";
import { forecastRegionsFromScenario } from "@/lib/engine/forecastEngineV4";
import { useSimulatedEntries } from "@/lib/simulatedEntriesStore";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { ScenarioResult } from "@/lib/engine/types";
import { formatIntIt, formatPctIt, formatPpSignedIt } from "@/lib/formatIt";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { useEffect, useMemo, useRef, useState } from "react";

function LandingStarfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.2,
      a: 0.15 + Math.random() * 0.5,
    }));
    const onMove = (event: MouseEvent) => {
      mouseRef.current = {
        x: event.clientX / Math.max(1, window.innerWidth),
        y: event.clientY / Math.max(1, window.innerHeight),
      };
    };
    window.addEventListener("mousemove", onMove);
    let raf = 0;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const mouse = mouseRef.current;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const px = s.x * w + (mouse.x - 0.5) * 12 * s.r;
        const py = s.y * h + (mouse.y - 0.5) * 12 * s.r;
        ctx.fillStyle = `rgba(148, 163, 184, ${s.a})`;
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
    });
    ro.observe(canvas);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-80"
      aria-hidden
    />
  );
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

function LandingGrowthFanChart({
  startPct,
  endPct,
  monthlyCentral,
  monthlyLow,
  monthlyHigh,
}: {
  startPct: number;
  endPct: number;
  monthlyCentral: number[];
  monthlyLow: number[];
  monthlyHigh: number[];
}) {
  const w = 240;
  const h = 52;
  const padX = 6;
  const padY = 6;
  const plotW = w - padX * 2;
  const plotH = h - padY * 2 - 10;
  const yMin = Math.min(...monthlyLow, startPct) - 0.2;
  const yMax = Math.max(...monthlyHigh, endPct) + 0.2;
  const ySpan = yMax - yMin || 1;
  const n = monthlyCentral.length;
  const xs = monthlyCentral.map((_, i) => padX + (i / (n - 1)) * plotW);
  const yOf = (pct: number) => padY + plotH - ((pct - yMin) / ySpan) * plotH;

  const linePoints = monthlyCentral.map((v, i) => `${xs[i]},${yOf(v)}`).join(" ");
  const last = n - 1;
  const bandTop = monthlyHigh.map((v, i) => `${xs[i]},${yOf(v)}`).join(" ");
  const bandBottom = monthlyLow.map((v, i) => `${xs[i]},${yOf(v)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-[52px] w-full" aria-hidden>
      <polyline
        points={bandTop}
        fill="none"
        stroke="rgba(148,163,184,0.35)"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <polyline
        points={bandBottom}
        fill="none"
        stroke="rgba(148,163,184,0.35)"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <line
        x1={padX}
        y1={yOf(startPct)}
        x2={w - padX}
        y2={yOf(startPct)}
        stroke="#475569"
        strokeWidth={0.8}
        strokeDasharray="3 2"
      />
      <polyline
        points={linePoints}
        fill="none"
        stroke="#10B981"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx={xs[0]} cy={yOf(startPct)} r={2.5} fill="#10B981" />
      <circle cx={xs[last]} cy={yOf(endPct)} r={3.5} fill="#10B981" className="animate-pulse" />
      <text x={padX} y={h - 1} className="fill-slate-500 text-[6px] font-mono">
        OTT &apos;26
      </text>
      <text x={w - padX} y={h - 1} textAnchor="end" className="fill-slate-500 text-[6px] font-mono">
        MAG &apos;27
      </text>
    </svg>
  );
}

function regionShortLabel(name: string): string {
  if (name === "Friuli-Venezia Giulia") return "Friuli-V.G.";
  return name;
}

export function AwwwardsLandingHero({
  scenario,
  poll,
  mapValues,
  onOpenCommandCenter,
}: {
  scenario: ScenarioResult;
  poll: RegionPollResult[];
  mapValues: Record<string, number>;
  onOpenCommandCenter: () => void;
}) {
  const { metriche, parametri } = scenario;
  const totVoti = scenario.righe.reduce((s, r) => s + r.voti_di_scenario, 0);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });

  const simulatedProfiles = useSimulatedEntries();
  const growth = useMemo(
    () =>
      computePartyGrowthForecast({
        startS: parametri.S,
        totVoti,
        regime: "organica",
        flussi: flussiFromMatrix("ipsos_luglio_2026"),
        rows: scenario.righe,
        poll,
        regions: forecastRegionsFromScenario(scenario.righe, poll),
        comitati: parametri.comitati,
        profiles: simulatedProfiles,
      }),
    [parametri.S, parametri.comitati, totVoti, scenario.righe, poll, simulatedProfiles],
  );

  const animVoti = useAnimatedNumber(totVoti);
  const animTarget = useAnimatedNumber(growth.targetS * 100);

  const pollByRegion = useMemo(
    () => Object.fromEntries(poll.map((p) => [p.regione, p])),
    [poll],
  );

  const top3 = useMemo(
    () => [...poll].sort((a, b) => b.piHat - a.piHat).slice(0, 3),
    [poll],
  );

  const regionsAboveThreshold = poll.filter((p) => p.piHat >= 0.03).length;

  const coveragePct = (metriche.H.iscritti * 100).toFixed(1).replace(".", ",");

  const regionalGrowthByRegion = useMemo(
    () =>
      buildRegionalGrowthMap(
        scenarioToRegionalGrowthInputs(scenario, poll),
        parametri.S,
        "organica",
        "ipsos_luglio_2026",
      ),
    [scenario, poll, parametri.S],
  );

  const trainoLine = growth.topGains
    .slice(0, 3)
    .map((g) => `${regionShortLabel(g.regione)} ${g.startPct.toFixed(2).replace(".", ",")}%`)
    .join(" · ");

  return (
    <div
      className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-[#03050A] pb-16 pt-24"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setMouse({
          x: (e.clientX - r.left) / r.width,
          y: (e.clientY - r.top) / r.height,
        });
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(56,189,248,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 65% 40%, black, transparent)",
        }}
      />
      <div className="pointer-events-none absolute left-[55%] top-[20%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute left-[60%] top-[35%] h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[100px]" />
      <LandingStarfield />

      <section className="relative z-10 mx-auto grid max-w-[1400px] gap-10 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] tracking-wider text-emerald-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            DOSSIER STRATEGICO · ODIERNO – MAGGIO 2027
          </span>

          <h1 className="fn-display mt-6 text-5xl font-extrabold leading-[0.95] tracking-tight text-white lg:text-7xl">
            Intelligenza{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-400 bg-clip-text text-transparent">
              Territoriale
            </span>{" "}
            <span className="bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              &amp; Dossier di Consenso.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 lg:text-lg">
            La cabina di regia nazionale per le 20 regioni. Diagnosi sul consenso, fattori
            ponderati e piano di contro-offensiva: dove intervenire, quale atto del programma
            calare e su quali piazze, con sondaggi pubblici, Europee 2024 e tesserati reali.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                value: formatPctIt(OFFICIAL_S, 2),
                title: "STIMA DEL CONSENSO NAZIONALE",
                subtitle: "Riferimento Ott 2026",
              },
              {
                value: formatIntIt(animVoti),
                title: "VOTI ATTUALI DI SCENARIO",
                subtitle: `${regionsAboveThreshold}/20 regioni sopra soglia 3%`,
              },
              {
                value: formatPctIt(animTarget / 100, 2),
                title: "PROIEZIONE MAGGIO 2027",
                subtitle: `${formatPpSignedIt(growth.deltaPp, 2)} · fascia ${growth.bandLowPct.toFixed(1).replace(".", ",")}–${growth.bandHighPct.toFixed(1).replace(".", ",")}%`,
              },
              {
                value: formatIntIt(parametri.iscritti_attribuiti),
                title: "TESSERATI & RETE FN",
                subtitle: `Copertura nazionale ${coveragePct}%`,
              },
            ].map((kpi) => (
              <div
                key={kpi.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
              >
                <p className="font-mono text-lg font-bold tabular-nums text-white">{kpi.value}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {kpi.title}
                </p>
                <p className="mt-0.5 text-[9px] leading-snug text-slate-600">{kpi.subtitle}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={onOpenCommandCenter}
              className="rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_40px_rgba(16,185,129,0.45)] transition-transform hover:scale-[1.02] hover:shadow-[0_0_56px_rgba(16,185,129,0.55)]"
            >
              Apri Command Center Interattivo
            </button>
          </div>
        </div>

        <div className="relative min-h-[520px] lg:min-h-[640px]">
          <div
            className="relative h-full min-h-[480px] overflow-hidden rounded-3xl border border-white/10 bg-[#070A10]/60 shadow-[0_40px_120px_rgba(0,0,0,0.65)]"
            style={{
              transform: `perspective(1400px) rotateX(${8 + (mouse.y - 0.5) * 6}deg) rotateY(${-10 + (mouse.x - 0.5) * 8}deg)`,
              transition: "transform 120ms ease-out",
            }}
          >
            <ItalyMap
              variant="hero"
              layout="holographic"
              valuesByRegion={mapValues}
              colorMode="stima"
              pollByRegion={pollByRegion}
              zoomControls="none"
              hideStatusPills
              showRegionLabels={false}
              showCapitals
            />
          </div>

          <GlassCard className="pointer-events-none absolute right-2 top-3 z-20 w-[220px] sm:right-4">
            <p className="font-mono text-[9px] tracking-widest text-cyan-400">REGIONI CON LA STIMA PIÙ ALTA</p>
            <ul className="mt-2 space-y-2">
              {top3.map((p) => (
                <li key={p.regione}>
                  <div className="flex justify-between gap-2 text-[11px] font-semibold text-slate-100">
                    <span className="truncate">{regionShortLabel(p.regione)}</span>
                    <span className="shrink-0 font-mono text-emerald-300">
                      {(p.piHat * 100).toFixed(2).replace(".", ",")}%
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                      style={{ width: `${Math.min(100, p.piHat * 450)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </GlassCard>

          <div className="pointer-events-none absolute bottom-6 left-2 z-20 w-[275px] rounded-xl border border-emerald-500/30 bg-[#070B14]/90 p-3.5 shadow-2xl backdrop-blur-xl sm:left-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                Traiettoria modello · Mag &apos;27
              </p>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-400">
                ▲ {formatPpSignedIt(growth.deltaPp, 2)}
              </span>
            </div>
            <p className="mt-2 font-mono text-xl font-bold tabular-nums text-white">
              {formatPctIt(growth.startS, 2)}{" "}
              <span className="font-normal text-slate-500">→</span>{" "}
              <span className="text-emerald-400">{formatPctIt(growth.targetS, 2)}</span>
            </p>
            <p className="mt-1 font-mono text-[10px] tabular-nums text-slate-400">
              Fascia di modello {growth.bandLowPct.toFixed(1).replace(".", ",")}–
              {growth.bandHighPct.toFixed(1).replace(".", ",")}%
            </p>
            <LandingGrowthFanChart
              startPct={growth.startS * 100}
              endPct={growth.targetS * 100}
              monthlyCentral={growth.monthlyCentral}
              monthlyLow={growth.monthlyLow}
              monthlyHigh={growth.monthlyHigh}
            />
            <p className="mt-2 font-mono text-[8px] leading-snug text-slate-500">
              Priorità territoriali: {trainoLine}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
