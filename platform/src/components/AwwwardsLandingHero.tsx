"use client";

import { ItalyMap } from "@/components/ItalyMap";
import {
  FLUSSI_PRESETS,
  OFFICIAL_FLUSSI,
  OFFICIAL_S,
  type FlussiIpsos,
} from "@/lib/engine/defaults";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { FnConfig, ScenarioResult } from "@/lib/engine/types";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ScenarioChipId = "baseline" | "expansion" | "lega" | "astensione";

const SCENARIO_CHIPS: { id: ScenarioChipId; label: string }[] = [
  { id: "baseline", label: "Baseline 7,2%" },
  { id: "expansion", label: "Scenario Espansione 8,5%" },
  { id: "lega", label: "Spinta Nord Ex-Lega" },
  { id: "astensione", label: "Recupero Astensione" },
];

function LandingStarfield({ mouse }: { mouse: { x: number; y: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    let raf = 0;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
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
    };
  }, [mouse.x, mouse.y]);
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

function BentoModuleCard({
  title,
  subtitle,
  children,
  cta,
  onCta,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  cta: string;
  onCta: () => void;
}) {
  return (
    <motion.article
      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0C101A] to-[#070A10] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]"
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl transition-opacity group-hover:opacity-100" />
      <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-400/90">{subtitle}</p>
      <h3 className="mt-2 text-xl font-bold tracking-tight text-white">{title}</h3>
      <div className="mt-4 text-sm text-slate-400">{children}</div>
      <button
        type="button"
        onClick={onCta}
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition-all hover:bg-emerald-500/20 hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]"
      >
        {cta}
      </button>
    </motion.article>
  );
}

export function AwwwardsLandingHero({
  scenario,
  poll,
  mapValues,
  pesi,
  onSChange,
  onFlussiChange,
  onOpenCommandCenter,
  onOpenOsservatorio,
  onExportPdf,
}: {
  scenario: ScenarioResult;
  poll: RegionPollResult[];
  mapValues: Record<string, number>;
  pesi: FnConfig["pesi"];
  onSChange: (s: number) => void;
  onFlussiChange: (f: FlussiIpsos) => void;
  onOpenCommandCenter: () => void;
  onOpenOsservatorio: (section?: "b" | "c") => void;
  onExportPdf: () => void;
}) {
  const { metriche, metadati, parametri } = scenario;
  const totVoti = scenario.righe.reduce((s, r) => s + r.voti_di_scenario, 0);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const [activeChip, setActiveChip] = useState<ScenarioChipId>("baseline");
  const [surgeKey, setSurgeKey] = useState(0);
  const moduliRef = useRef<HTMLElement>(null);

  const animS = useAnimatedNumber(parametri.S * 100);
  const animVoti = useAnimatedNumber(totVoti);
  const animH = useAnimatedNumber(metriche.H.scenario);
  const animMc = useAnimatedNumber(metadati.simulazioni);

  const pollByRegion = useMemo(
    () => Object.fromEntries(poll.map((p) => [p.regione, p])),
    [poll],
  );

  const top3 = useMemo(
    () => [...poll].sort((a, b) => b.piHat - a.piHat).slice(0, 3),
    [poll],
  );

  const avgBand = useMemo(() => {
    if (!poll.length) return { lo: 0.05, hi: 0.1 };
    const lo = poll.reduce((s, p) => s + p.icLow, 0) / poll.length;
    const hi = poll.reduce((s, p) => s + p.icHigh, 0) / poll.length;
    return { lo, hi };
  }, [poll]);

  const applyChip = useCallback(
    (id: ScenarioChipId) => {
      setActiveChip(id);
      setSurgeKey((k) => k + 1);
      if (id === "baseline") {
        onSChange(OFFICIAL_S);
        onFlussiChange({ ...OFFICIAL_FLUSSI });
      } else if (id === "expansion") {
        onSChange(0.085);
        onFlussiChange({ ...OFFICIAL_FLUSSI });
      } else if (id === "lega") {
        onSChange(OFFICIAL_S);
        onFlussiChange({ ...FLUSSI_PRESETS["Spinta Ex-Lega Nord (26% / 38% / 28%)"] });
      } else {
        onSChange(OFFICIAL_S);
        onFlussiChange({ ...FLUSSI_PRESETS["Recupero Astensione (25% / 20% / 48%)"] });
      }
    },
    [onFlussiChange, onSChange],
  );

  const scrollToModuli = () => {
    moduliRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-[#03050A] pb-28 pt-24"
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
      <LandingStarfield mouse={mouse} />

      <section className="relative z-10 mx-auto grid max-w-[1400px] gap-10 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] tracking-wider text-emerald-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            OSSERVATORIO INTEGRATO · OTTOBRE 2026 – MAGGIO 2027
          </span>

          <h1 className="fn-display mt-6 text-5xl font-extrabold leading-[0.95] tracking-tight text-white lg:text-7xl">
            Intelligenza{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-400 bg-clip-text text-transparent">
              Territoriale
            </span>{" "}
            <span className="bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              &amp; Scenari di Consenso.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 lg:text-lg">
            Simulazione stocastica a 20.000 iterazioni Monte Carlo sulle 20 regioni italiane.
            Integrazione metodologica tra distribuzione elettorale (Modulo A), fabbisogni pubblici
            ISTAT/AGENAS (Modulo B) e attenzione mediatica (Modulo C).
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Input Nazionale Base", value: `${animS.toFixed(2).replace(".", ",")}%` },
              {
                label: "Voti Scenario Stimati",
                value: Math.round(animVoti).toLocaleString("it-IT"),
              },
              {
                label: "Entropia Iscritti H",
                value: animH.toFixed(4).replace(".", ","),
              },
              {
                label: "Simulazioni MC Seme 42",
                value: Math.round(animMc).toLocaleString("it-IT"),
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
              >
                <p className="font-mono text-lg font-bold tabular-nums text-white">{kpi.value}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
                  {kpi.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onOpenCommandCenter}
              className="rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_0_40px_rgba(16,185,129,0.45)] transition-transform hover:scale-[1.02] hover:shadow-[0_0_56px_rgba(16,185,129,0.55)]"
            >
              Apri Command Center Interattivo
            </button>
            <button
              type="button"
              onClick={scrollToModuli}
              className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 backdrop-blur-md hover:bg-white/10"
            >
              Esplora Architettura Moduli A · B · C ↓
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              className="rounded-full border border-white/10 px-5 py-3 text-sm text-slate-400 hover:text-white"
            >
              Esporta Dossier PDF
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
              showRegionLabels
              showCapitals
              energySurgeKey={surgeKey}
            />
          </div>

          <GlassCard className="pointer-events-none absolute -right-2 top-4 z-20 w-[220px] sm:right-4">
            <p className="font-mono text-[9px] tracking-widest text-cyan-400">PODIO LIVE</p>
            <ul className="mt-2 space-y-2">
              {top3.map((p, i) => (
                <li key={p.regione}>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-100">
                    <span className="font-mono">
                      RNK {String(i + 1).padStart(2, "0")}{" "}
                      {p.regione === "Friuli-Venezia Giulia" ? "FRIULI-V.G." : p.regione.toUpperCase()}
                    </span>
                    <span className="font-mono text-emerald-300">
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

          <GlassCard className="pointer-events-none absolute bottom-16 left-0 z-20 w-[240px] sm:left-2">
            <p className="font-mono text-[9px] text-slate-500">MIX TERRITORIALE</p>
            <p className="mt-1 font-mono text-[11px] leading-snug text-slate-200">
              p<sub>i</sub> = 0,35 f<sub>i</sub> + 0,25 v<sub>i</sub> + 0,25 s<sub>i</sub> + 0,15 m<sub>i</sub>
            </p>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full">
              <div className="bg-orange-500" style={{ width: `${pesi.flussi * 100}%` }} />
              <div className="bg-emerald-500" style={{ width: `${pesi.pref * 100}%` }} />
              <div className="bg-sky-500" style={{ width: `${pesi.isc * 100}%` }} />
              <div className="bg-violet-500" style={{ width: `${pesi.ist * 100}%` }} />
            </div>
            <p className="mt-2 font-mono text-[9px] text-slate-400">
              F {(pesi.flussi * 100).toFixed(0)}% · P {(pesi.pref * 100).toFixed(0)}% · I{" "}
              {(pesi.isc * 100).toFixed(0)}% · M {(pesi.ist * 100).toFixed(0)}%
            </p>
          </GlassCard>

          <div className="absolute -bottom-2 left-1/2 z-30 flex w-[min(100%,520px)] -translate-x-1/2 flex-wrap justify-center gap-1.5 rounded-2xl border border-white/10 bg-[#0C101A]/90 p-2 backdrop-blur-xl">
            {SCENARIO_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => applyChip(chip.id)}
                className={`rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all sm:text-[11px] ${
                  activeChip === chip.id
                    ? "bg-emerald-500 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.5)]"
                    : "border border-white/10 text-slate-300 hover:border-emerald-500/40 hover:text-white"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        ref={moduliRef}
        id="moduli-osservatorio"
        className="relative z-10 mx-auto mt-24 max-w-[1400px] px-6 pb-12"
      >
        <p className="font-mono text-[10px] tracking-[0.25em] text-slate-500">
          ARCHITETTURA OSSERVATORIO
        </p>
        <h2 className="fn-display mt-2 text-3xl font-bold text-white lg:text-4xl">
          Tre moduli integrati · Metodologia v3.2
        </h2>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <BentoModuleCard
            subtitle="MODULO A"
            title="Distribuzione Elettorale & Sondaggio Regionale"
            cta="Apri Simulatore Scenario →"
            onCta={onOpenCommandCenter}
          >
            <svg viewBox="0 0 280 80" className="mb-3 h-20 w-full text-emerald-400/80">
              <path
                d="M10 60 Q 70 20, 140 35 T 270 25"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <rect
                x="40"
                y="28"
                width="200"
                height="24"
                rx="4"
                fill="rgba(16,185,129,0.12)"
                stroke="rgba(52,211,153,0.4)"
              />
              <text x="48" y="44" fill="rgb(148,163,184)" fontSize="10">
                MC lo10–hi90 · media {(avgBand.lo * 100).toFixed(1)}–{(avgBand.hi * 100).toFixed(1)}%
              </text>
            </svg>
            <p>
              Semaforo soglia 3% · {poll.filter((p) => p.classificazione === "sicura").length} regioni
              sicure · {poll.filter((p) => p.classificazione === "critica").length} critiche.
            </p>
          </BentoModuleCard>

          <BentoModuleCard
            subtitle="MODULO B"
            title="Fabbisogni dei Cittadini (20 Regioni)"
            cta="Esplora Catalogo Fabbisogni →"
            onCta={() => onOpenOsservatorio("b")}
          >
            <div className="flex flex-wrap gap-1.5">
              {["ISTAT BesT 2025", "AGENAS", "OpenCivitas", "ARPA"].map((b) => (
                <span
                  key={b}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300"
                >
                  {b}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed">
              8 metadati obbligatori per indicatore · avvertenza contro l&apos;errore ecologico nelle
              letture cross-regione.
            </p>
          </BentoModuleCard>

          <BentoModuleCard
            subtitle="MODULO C"
            title="Eventi, Cronologia ±14gg & Google Trends (0–100)"
            cta="Apri Registro Eventi & Trends →"
            onCta={() => onOpenOsservatorio("c")}
          >
            <svg viewBox="0 0 280 72" className="mb-2 h-16 w-full">
              <polyline
                points="10,50 40,45 70,48 100,30 130,35 160,22 190,28 220,18 250,25 270,15"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2"
              />
              <line x1="100" y1="8" x2="100" y2="64" stroke="rgba(251,191,36,0.5)" strokeDasharray="4 3" />
              <line x1="160" y1="8" x2="160" y2="64" stroke="rgba(251,191,36,0.5)" strokeDasharray="4 3" />
              <text x="12" y="68" fill="rgb(100,116,139)" fontSize="9">
                −14gg · evento · +14gg
              </text>
            </svg>
            <p className="text-xs">Finestra pre/post evento e normalizzazione attenzione 0–100.</p>
          </BentoModuleCard>
        </div>
      </section>
    </div>
  );
}
