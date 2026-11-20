"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import type { Region } from "@/lib/engine/constants";
import type { StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import { formatCompactVotes } from "@/lib/formatApproximateVotes";
import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";

const GEO_URL = "/geo/regioni-italia.geojson";
const GEO_TO_MODEL: Record<string, string> = {
  "Valle d'Aosta/Vallée d'Aoste": "Valle d'Aosta",
  "Trentino-Alto Adige/Südtirol": "Trentino-Alto Adige",
};

type GeoCollection = GeoPermissibleObjects & {
  type: "FeatureCollection";
  features: GeoPermissibleObjects[];
};

let cachedGeo: GeoCollection | null = null;

function featureRegionName(feature: GeoPermissibleObjects): string {
  const props =
    feature && typeof feature === "object" && "properties" in feature
      ? (feature.properties as Record<string, unknown> | null)
      : null;
  const name = String(props?.reg_name ?? props?.name ?? "");
  return GEO_TO_MODEL[name] ?? name;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function CipherValue({
  value,
  decimals = 0,
  suffix = "",
  locked,
  scrambleMs = 1200,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  locked: boolean;
  scrambleMs?: number;
}) {
  const [display, setDisplay] = useState("····");
  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(decimals > 0 ? formatDecimalIt(value, decimals) : formatIntIt(Math.round(value)));
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / scrambleMs);
      if (!locked && t < 1) {
        const noise = value * (0.4 + Math.random() * 1.4);
        setDisplay(decimals > 0 ? formatDecimalIt(noise, decimals) : formatIntIt(Math.round(noise)));
        frame = requestAnimationFrame(tick);
        return;
      }
      setDisplay(decimals > 0 ? formatDecimalIt(value, decimals) : formatIntIt(Math.round(value)));
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, decimals, locked, scrambleMs]);
  return (
    <span className="font-mono tabular-nums">
      {display}
      {suffix}
    </span>
  );
}

type TelemetryLine = { t: string; text: string };

function buildTelemetry(preview: StrategicBackcastResult | null, elapsedMs: number, apiReady: boolean): TelemetryLine[] {
  const lines: TelemetryLine[] = [];
  const sec = (ms: number) => `[${(ms / 1000).toFixed(2).padStart(5, "0")}s]`;
  if (elapsedMs >= 80) {
    lines.push({
      t: sec(120),
      text: preview
        ? `ANCORAGGIO TRAIETTORIA · BASELINE ${formatDecimalIt(preview.currentPct, 2)}% VERIFICATA (MISURATO)`
        : "ANCORAGGIO TRAIETTORIA · BASELINE OSSERVATA IN VERIFICA (MISURATO)",
    });
  }
  if (elapsedMs >= 350) {
    lines.push({ t: sec(450), text: "ALLINEAMENTO TRAIETTORIA · CONVERGENZA RAGGIUNTA (stima)" });
  }
  const fronts = [...(preview?.regions ?? [])]
    .filter((row) => row.role === "FRONTE_PRIORITARIO")
    .sort((a, b) => b.addedVotes - a.addedVotes)
    .slice(0, 4);
  fronts.forEach((row, index) => {
    const at = 850 + index * 400;
    if (elapsedMs >= at) {
      lines.push({
        t: sec(at),
        text: `AGGANCIO SERBATOIO #${String(index + 1).padStart(2, "0")}: ${row.region.toUpperCase()} (${formatCompactVotes(row.addedVotes)} · IPOTESI)`,
      });
    }
  });
  if (elapsedMs >= 1700) {
    lines.push({
      t: sec(1700),
      text: `VERIFICA COLLI DI BOTTIGLIA ARIA × TERRA × ELETTI SU ${preview?.horizonDays ?? "—"} GIORNI (IPOTESI)`,
    });
  }
  if (elapsedMs >= 2100) {
    lines.push({
      t: sec(2200),
      text: apiReady
        ? "STRATEGIA OPERATIVA RICEVUTA · ALLINEAMENTO NUMERI SOLVER (IPOTESI)"
        : "ELABORAZIONE STRATEGIA OPERATIVA E PRESIDI TRAMITE MODELLO AI... (IPOTESI)",
    });
  }
  return lines.slice(-6);
}

export function StrategicCalculationCinema({
  preview,
  targetPct,
  horizonDays,
  apiReady,
  onSkip,
}: {
  preview: StrategicBackcastResult | null;
  targetPct: number;
  horizonDays: number;
  apiReady: boolean;
  onSkip: () => void;
}) {
  const [geo, setGeo] = useState<GeoCollection | null>(null);
  const [scanIndex, setScanIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lockedKpis, setLockedKpis] = useState(false);
  const [finale, setFinale] = useState(false);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const startRef = useRef(performance.now());

  const fronts = useMemo(
    () =>
      [...(preview?.regions ?? [])]
        .filter((row) => row.role === "FRONTE_PRIORITARIO")
        .sort((a, b) => b.addedVotes - a.addedVotes),
    [preview],
  );
  const frontSet = useMemo(() => new Set(fronts.map((row) => row.region)), [fronts]);
  const votes = preview?.totalDeltaVotes ?? 0;
  const frontCount = fronts.length;

  useEffect(() => {
    let alive = true;
    if (cachedGeo) {
      setGeo(cachedGeo);
      return () => {
        alive = false;
      };
    }
    fetch(GEO_URL)
      .then((res) => res.json())
      .then((data: GeoCollection) => {
        cachedGeo = data;
        if (alive) setGeo(data);
      })
      .catch(() => {
        if (alive) setGeo(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    startRef.current = performance.now();
    setScanIndex(0);
    setElapsedMs(0);
    setLockedKpis(false);
    setFinale(false);
    if (reduced) {
      setLockedKpis(true);
      setScanIndex(20);
      return;
    }
    const lockTimer = window.setTimeout(() => setLockedKpis(true), 1200);
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      setElapsedMs(elapsed);
      setScanIndex(Math.min(20, Math.floor(elapsed / 110)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(lockTimer);
    };
  }, [preview, reduced]);

  useEffect(() => {
    if (!apiReady) return;
    if (reduced) {
      setFinale(true);
      return;
    }
    const timer = window.setTimeout(() => setFinale(true), 40);
    return () => window.clearTimeout(timer);
  }, [apiReady, reduced]);

  const paths = useMemo(() => {
    if (!geo) return [] as { region: Region; d: string; cx: number; cy: number }[];
    const projection = geoMercator().fitExtent(
      [
        [36, 28],
        [280, 340],
      ],
      geo,
    );
    const path = geoPath(projection);
    return geo.features.map((feature) => {
      const region = featureRegionName(feature) as Region;
      const d = path(feature) ?? "";
      const [cx, cy] = path.centroid(feature) as [number, number];
      return { region, d, cx, cy };
    });
  }, [geo]);

  const scanOrder = useMemo(() => {
    const names = paths.map((row) => row.region);
    const prioritized = [...fronts.map((row) => row.region), ...names.filter((name) => !frontSet.has(name))];
    return prioritized.filter((name, index, all) => all.indexOf(name) === index);
  }, [paths, fronts, frontSet]);

  const lockedFronts = useMemo(() => {
    const scanned = new Set(scanOrder.slice(0, Math.max(0, scanIndex)));
    return fronts.filter((row) => scanned.has(row.region) || lockedKpis || reduced);
  }, [fronts, scanOrder, scanIndex, lockedKpis, reduced]);

  const mcCurves = useMemo(() => {
    const rand = seeded(20261112);
    return Array.from({ length: 28 }, (_, i) => {
      const points: string[] = [];
      const wobble = 0.35 + rand() * 0.9;
      for (let x = 0; x <= 12; x += 1) {
        const t = x / 12;
        const origin = preview?.currentPct ?? targetPct;
        const base = origin + t * (targetPct - origin);
        const spread = (1 - t * 0.72) * wobble * (i / 14 - 1);
        const y = base + spread;
        points.push(`${20 + t * 260},${118 - (y - 5) * 10}`);
      }
      return points.join(" ");
    });
  }, [preview, targetPct]);

  const telemetry = buildTelemetry(preview, elapsedMs, apiReady);
  const progress = Math.min(0.99, reduced ? 0.99 : apiReady ? 0.92 + Math.min(0.07, elapsedMs / 20000) : Math.min(0.9, elapsedMs / 2800));

  return (
    <div
      className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-1)] shadow-2xl"
      role="status"
      aria-live="polite"
      aria-label="Calcolo strategico in corso"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.14),transparent_55%),radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.1),transparent_45%)]"
      />
      <div className="relative z-[1] flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-2.5">
        <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--ink-muted)]">COCKPIT OLOGRAFICO · CALCOLO LIVE · IPOTESI</p>
        <div className="flex items-center gap-2">
          {apiReady ? (
            <button type="button" onClick={onSkip} className="obj-press rounded-md border border-[var(--border-default)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]">
              Salta animazione →
            </button>
          ) : null}
          <span className="font-mono text-[10px] tabular-nums text-cyan-300 light:text-cyan-800">{Math.round(progress * 100)}%</span>
        </div>
      </div>

      <div className="relative z-[1] grid gap-3 p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="relative min-h-[340px] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-2)_80%,transparent)]">
          <svg viewBox="0 0 320 372" className="h-full w-full" role="img" aria-label="Radar geodetico Italia">
            <defs>
              <linearGradient id="scanGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(52,211,153)" stopOpacity="0" />
                <stop offset="50%" stopColor="rgb(52,211,153)" stopOpacity="0.55" />
                <stop offset="100%" stopColor="rgb(52,211,153)" stopOpacity="0" />
              </linearGradient>
              <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g opacity="0.35">
              {[60, 100, 140, 180].map((r) => (
                <circle
                  key={r}
                  cx="160"
                  cy="186"
                  r={r}
                  fill="none"
                  stroke="var(--border-default)"
                  strokeWidth="1"
                  strokeDasharray="4 8"
                  className={reduced ? undefined : r % 80 === 0 ? "fn-cinema-spin-cw" : "fn-cinema-spin-ccw"}
                  style={{ transformOrigin: "160px 186px" }}
                />
              ))}
              {[
                [20, 20],
                [300, 20],
                [20, 352],
                [300, 352],
              ].map(([x, y]) => (
                <path key={`${x}-${y}`} d={`M${x - 6},${y} H${x + 6} M${x},${y - 6} V${y + 6}`} stroke="rgb(34,211,238)" strokeWidth="1" opacity="0.55" />
              ))}
            </g>
            {paths.map((row) => {
              const order = scanOrder.indexOf(row.region);
              const scanned = order >= 0 && order < scanIndex;
              const isFront = frontSet.has(row.region);
              const locked = lockedFronts.some((item) => item.region === row.region);
              return (
                <path
                  key={row.region}
                  d={row.d}
                  fill={locked ? "rgba(52,211,153,0.55)" : scanned ? (isFront ? "rgba(52,211,153,0.28)" : "rgba(100,116,139,0.35)") : "rgba(71,85,105,0.22)"}
                  stroke={locked ? "rgb(52,211,153)" : "rgba(148,163,184,0.45)"}
                  strokeWidth={locked ? 1.4 : 0.8}
                  className="transition-[fill,stroke] duration-300"
                />
              );
            })}
            {!reduced ? (
              <rect x="36" width="248" height="54" fill="url(#scanGlow)" className="animate-[scanY_2.4s_linear_infinite]" style={{ transformOrigin: "center" }}>
                <animate attributeName="y" values="24;300;24" dur="2.4s" repeatCount="indefinite" />
              </rect>
            ) : null}
            {lockedFronts.map((row) => {
              const geom = paths.find((item) => item.region === row.region);
              if (!geom) return null;
              return (
                <g key={`lock-${row.region}`} filter="url(#softGlow)">
                  <circle cx={geom.cx} cy={geom.cy} r="10" fill="none" stroke="rgb(52,211,153)" strokeWidth="1.2" opacity="0.9">
                    {!reduced ? <animate attributeName="r" values="8;22;8" dur="1.6s" repeatCount="indefinite" /> : null}
                    {!reduced ? <animate attributeName="opacity" values="0.9;0.15;0.9" dur="1.6s" repeatCount="indefinite" /> : null}
                  </circle>
                  <circle cx={geom.cx} cy={geom.cy} r="2.8" fill="rgb(52,211,153)" />
                  <text x={geom.cx + 8} y={geom.cy - 8} fill="rgb(167,243,208)" fontSize="9" className="font-mono">
                    {formatCompactVotes(row.addedVotes)}
                  </text>
                </g>
              );
            })}
            {lockedFronts.slice(0, 4).map((row, index, all) => {
              const a = paths.find((item) => item.region === row.region);
              const b = paths.find((item) => item.region === all[(index + 1) % all.length]?.region);
              if (!a || !b || all.length < 2) return null;
              const mx = (a.cx + b.cx) / 2;
              const my = Math.min(a.cy, b.cy) - 28;
              return (
                <path
                  key={`arc-${row.region}`}
                  d={`M${a.cx},${a.cy} Q${mx},${my} ${b.cx},${b.cy}`}
                  fill="none"
                  stroke="rgba(34,211,238,0.65)"
                  strokeWidth="1.2"
                  strokeDasharray="4 6"
                  className={reduced ? undefined : "fn-cinema-dash"}
                />
              );
            })}
          </svg>
        </div>

        <div className="flex min-h-[340px] flex-col gap-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
            <p className="font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)]">AFFIDABILITÀ DEL PIANO · STIMA</p>
            <svg viewBox="0 0 300 130" className="mt-2 h-28 w-full" aria-hidden>
              {mcCurves.map((points, index) => (
                <polyline
                  key={index}
                  fill="none"
                  points={points}
                  stroke={index % 2 === 0 ? "rgba(34,211,238,0.28)" : "rgba(52,211,153,0.22)"}
                  strokeWidth="1"
                  className={reduced ? undefined : "fn-cinema-collapse"}
                  style={{ animationDelay: `${index * 18}ms` }}
                />
              ))}
              <polyline
                fill="none"
                points={`20,${118 - ((preview?.currentPct ?? targetPct) - 5) * 10} 280,${118 - (targetPct - 5) * 10}`}
                stroke="rgb(52,211,153)"
                strokeWidth="2.2"
                opacity="0.95"
              />
            </svg>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Target consenso", node: <CipherValue value={targetPct} decimals={1} suffix="%" locked={lockedKpis} /> },
              { label: "Voti da sbloccare", node: <CipherValue value={votes} locked={lockedKpis} /> },
              { label: "Fronti agganciati", node: <span className="font-mono tabular-nums">{lockedKpis ? `${frontCount}/20` : `${Math.min(frontCount, Math.floor(scanIndex / 3))}/20`}</span> },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-2">
                <p className="text-[10px] text-[var(--ink-muted)]">{item.label}</p>
                <p className={`mt-1 text-[18px] font-semibold text-[var(--ink-primary)] ${lockedKpis ? "drop-shadow-[0_0_10px_rgba(52,211,153,0.45)]" : ""}`}>{item.node}</p>
              </div>
            ))}
          </div>

          <div className="min-h-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)]">STREAM TELEMETRICO MOTORE</p>
              {!apiReady ? (
                <div className="flex h-3 items-end gap-0.5" aria-hidden>
                  {Array.from({ length: 8 }, (_, i) => (
                    <span
                      key={i}
                      className="w-1 rounded-sm bg-cyan-400/80"
                      style={{
                        height: `${6 + ((i * 7 + Math.floor(elapsedMs / 120)) % 10)}px`,
                        animation: reduced ? undefined : `fn-pulseBar 0.8s ease-in-out ${i * 0.05}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <span className="font-mono text-[10px] text-[var(--signal-positive)]">NEURAL LOCK</span>
              )}
            </div>
            <ul className="space-y-1.5">
              {telemetry.map((line) => (
                <li key={line.t + line.text} className="font-mono text-[11px] leading-snug text-[var(--ink-secondary)]">
                  <span className="text-cyan-300 light:text-cyan-800">{line.t}</span> {line.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="relative z-[1] border-t border-[var(--border-subtle)] px-4 py-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border-subtle)]">
          <div
            className={`h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-300 transition-[width] duration-300 ${finale || apiReady ? "shadow-[0_0_16px_rgba(52,211,153,0.55)]" : ""}`}
            style={{ width: `${Math.round((finale ? 1 : progress) * 100)}%` }}
          />
        </div>
        <p className={`mt-2 text-center font-mono text-[11px] tracking-[0.12em] ${finale || (apiReady && reduced) ? "text-[var(--signal-positive)]" : "text-[var(--ink-muted)]"}`}>
          {finale || (apiReady && reduced)
            ? "PIANO STRATEGICO PRONTO · APERTURA SALA COMANDO"
            : `CALCOLO ORIZZONTE ${horizonDays}g · TARGET ${formatDecimalIt(targetPct, 1)}% · IPOTESI`}
        </p>
      </div>

      <style>{`
        @keyframes fn-dash { to { stroke-dashoffset: -40; } }
        @keyframes fn-collapseCurve { from { opacity: 0.55; } to { opacity: 0.12; } }
        @keyframes fn-pulseBar { from { transform: scaleY(0.45); } to { transform: scaleY(1); } }
        @keyframes fn-cinema-cw { to { transform: rotate(360deg); } }
        @keyframes fn-cinema-ccw { to { transform: rotate(-360deg); } }
        .fn-cinema-dash { animation: fn-dash 2.2s linear infinite; }
        .fn-cinema-collapse { animation: fn-collapseCurve 2.8s ease-in-out forwards; transform-origin: left center; }
        .fn-cinema-spin-cw { animation: fn-cinema-cw 28s linear infinite; transform-box: fill-box; transform-origin: center; }
        .fn-cinema-spin-ccw { animation: fn-cinema-ccw 36s linear infinite; transform-box: fill-box; transform-origin: center; }
        @media (prefers-reduced-motion: reduce) {
          .fn-cinema-dash, .fn-cinema-collapse, .fn-cinema-spin-cw, .fn-cinema-spin-ccw { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
