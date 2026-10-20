"use client";

import { Panel } from "@/components/ui/FnUi";
import { ITALY_CAPITALS } from "@/lib/italyCapitals";
import { ClassStatusMark, regionPodiumLabel } from "@/components/ui/TelemetryUi";
import { cartographicFill, type MapColorMode } from "@/lib/mapDisplay";
import type { Region } from "@/lib/engine/constants";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const GEO_URL = "/geo/regioni-italia.geojson";
const MAP_W = 800;
const MAP_H = 730;
const MAP_SAFE = { minX: 110, maxX: 690, minY: 35, maxY: 695 };
const FIT_EXTENT: [[number, number], [number, number]] = [
  [70, 38],
  [730, 690],
];

export type { MapColorMode };

type GeoCollection = GeoPermissibleObjects & {
  type: "FeatureCollection";
  features: GeoPermissibleObjects[];
};

type RegionGeom = {
  region: string;
  pathD: string;
  centroid: [number, number];
  capitalXY: [number, number];
};

let cachedGeoJson: GeoCollection | null = null;
let geoLoadPromise: Promise<GeoCollection> | null = null;

function loadGeoJson(): Promise<GeoCollection> {
  if (cachedGeoJson) return Promise.resolve(cachedGeoJson);
  if (!geoLoadPromise) {
    geoLoadPromise = fetch(GEO_URL)
      .then((r) => r.json())
      .then((data: GeoCollection) => {
        cachedGeoJson = data;
        return data;
      });
  }
  return geoLoadPromise;
}

const GEO_TO_MODEL: Record<string, string> = {
  "Valle d'Aosta/Vallée d'Aoste": "Valle d'Aosta",
  "Trentino-Alto Adige/Südtirol": "Trentino-Alto Adige",
};

function modelName(geoName: string): string {
  return GEO_TO_MODEL[geoName] ?? geoName;
}

function featureRegionName(f: GeoPermissibleObjects): string {
  const props =
    f && typeof f === "object" && "properties" in f
      ? (f.properties as Record<string, unknown> | null)
      : null;
  const name = String(props?.reg_name ?? props?.name ?? "");
  return modelName(name);
}

/** Tier 0–4 per gradienti `map-tier-*`. */
function tierIndex(value: number): number {
  const p = value * 100;
  if (p < 5.8) return 0;
  if (p < 6.6) return 1;
  if (p < 7.5) return 2;
  if (p < 8.8) return 3;
  return 4;
}

const PODIUM_LEFT_REGIONS = new Set([
  "Lombardia",
  "Piemonte",
  "Toscana",
  "Lazio",
  "Campania",
  "Sardegna",
  "Sicilia",
]);

type PodiumSide = "left" | "right";

type PodiumAnchor = {
  dx1: number;
  dy: number;
  dx2: number;
  side: PodiumSide;
};

const PODIUM_ANCHORS: Partial<Record<Region, PodiumAnchor>> = {
  "Friuli-Venezia Giulia": { dx1: 22, dy: -36, dx2: 52, side: "right" },
  Veneto: { dx1: 26, dy: 24, dx2: 56, side: "right" },
  Calabria: { dx1: 22, dy: -16, dx2: 52, side: "right" },
};

const PODIUM_MIN_Y_GAP = 32;
const PODIUM_COLLISION_PUSH = 18;

type PodiumLayout = {
  region: Region;
  rankCode: string;
  pctLabel: string;
  cityX: number;
  cityY: number;
  targetY: number;
  labelX: number;
  labelY: number;
  anchor: PodiumAnchor;
  side: PodiumSide;
};

const HUB_ARC_REGIONS: Region[] = [
  "Piemonte",
  "Lombardia",
  "Veneto",
  "Emilia-Romagna",
  "Toscana",
  "Campania",
  "Puglia",
  "Calabria",
  "Sicilia",
  "Sardegna",
];

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function hubArcPath(
  from: [number, number],
  to: [number, number],
): string {
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2 - Math.min(48, Math.abs(from[1] - to[1]) * 0.2 + 22);
  return `M ${from[0]} ${from[1]} Q ${mx} ${my} ${to[0]} ${to[1]}`;
}

function defaultPodiumAnchor(side: PodiumSide): PodiumAnchor {
  return side === "right"
    ? { dx1: 22, dy: -10, dx2: 54, side: "right" }
    : { dx1: 22, dy: -10, dx2: 54, side: "left" };
}

function podiumAnchorFor(region: Region, fallbackSide: PodiumSide): PodiumAnchor {
  return PODIUM_ANCHORS[region] ?? defaultPodiumAnchor(fallbackSide);
}

function sideSign(side: PodiumSide): number {
  return side === "right" ? 1 : -1;
}

function resolvePodiumVerticalCollisions(
  items: PodiumLayout[],
  minGap = PODIUM_MIN_Y_GAP,
  push = PODIUM_COLLISION_PUSH,
): void {
  for (const side of ["left", "right"] as const) {
    const group = items.filter((it) => it.side === side);
    if (group.length < 2) continue;
    const maxPasses = group.length * 4;
    for (let pass = 0; pass < maxPasses; pass++) {
      group.sort((a, b) => a.targetY - b.targetY);
      let adjusted = false;
      for (let i = 1; i < group.length; i++) {
        const prev = group[i - 1]!;
        const curr = group[i]!;
        if (curr.targetY - prev.targetY < minGap) {
          prev.targetY -= push;
          prev.labelY -= push;
          curr.targetY += push;
          curr.labelY += push;
          adjusted = true;
        }
      }
      if (!adjusted) break;
    }
  }
}

function PodiumCalloutPlate({
  rankCode,
  regionLine,
  style,
}: {
  rankCode: string;
  regionLine: string;
  style: React.CSSProperties;
}) {
  return (
    <div
      className="pointer-events-none absolute z-30 flex font-mono text-[10px] font-semibold leading-none text-slate-100 shadow-lg"
      style={style}
    >
      <span className="rounded-l border border-r-0 border-[#222E44] bg-[#162032] px-2 py-1.5 tabular-nums text-emerald-400">
        RNK {rankCode}
      </span>
      <span className="rounded-r border border-[#222E44] bg-[#080C14]/95 px-2 py-1.5 tracking-tight">
        {regionLine}
      </span>
    </div>
  );
}

function FloatingTooltip({
  tooltipRef,
  poll,
  rank,
  votes,
}: {
  tooltipRef: React.RefObject<HTMLDivElement | null>;
  poll: RegionPollResult;
  rank: number;
  votes?: number;
}) {
  const pctVal = poll.piHat * 100;
  return (
    <div
      ref={tooltipRef}
      className="pointer-events-none fixed left-0 top-0 z-50 w-56 rounded-lg border border-[#222E44] bg-[#080C14]/95 p-3 shadow-2xl will-change-transform"
      style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] tracking-wide text-slate-400">
          {poll.regione.toUpperCase()} // RANK #{String(rank).padStart(2, "0")} DI 20
        </p>
        <ClassStatusMark classificazione={poll.classificazione} />
      </div>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
        {pctVal.toFixed(2).replace(".", ",")}%
      </p>
      <p className="font-mono text-[10px] tabular-nums text-slate-400">
        ± {(poll.moe * 100).toFixed(1)} pp
        {votes != null && (
          <>
            {" "}
            · {Math.round(votes).toLocaleString("it-IT")} voti stimati
          </>
        )}
      </p>
      <div className="mt-2 flex h-1 overflow-hidden rounded-sm bg-[#162032]">
        <div className="bg-orange-500" style={{ width: `${poll.contribFlussi * 100}%` }} />
        <div className="bg-emerald-500" style={{ width: `${poll.contribPreferenze * 100}%` }} />
        <div className="bg-sky-500" style={{ width: `${poll.contribIscritti * 100}%` }} />
        <div className="bg-violet-500" style={{ width: `${poll.contribIstituzioni * 100}%` }} />
      </div>
      <p className="mt-1 font-mono text-[9px] uppercase text-slate-500">
        F · P · I · M · margine 3%{" "}
        {poll.margineVotiSoglia >= 0 ? "+" : ""}
        {poll.margineVotiSoglia.toLocaleString("it-IT")} voti
      </p>
    </div>
  );
}

export function ItalyMap({
  valuesByRegion,
  colorMode,
  onRegionClick,
  onClearSelection,
  variant = "default",
  selectedRegion,
  highlightedRegion,
  onRegionHover,
  pollByRegion,
  votesByRegion,
  zoomControls = "internal",
  classFilter = "all",
  showRegionLabels = true,
  showCapitals = true,
  showLatLonGrid = false,
}: {
  valuesByRegion: Record<string, number>;
  colorMode: MapColorMode;
  onRegionClick?: (region: string) => void;
  onClearSelection?: () => void;
  variant?: "default" | "hero";
  selectedRegion?: string | null;
  highlightedRegion?: string | null;
  onRegionHover?: (region: string | null) => void;
  pollByRegion?: Record<string, RegionPollResult>;
  votesByRegion?: Record<string, number>;
  nationalS?: number;
  zoomControls?: "internal" | "none";
  classFilter?: "all" | RegionPollResult["classificazione"];
  onClassFilterChange?: (f: "all" | RegionPollResult["classificazione"]) => void;
  hideStatusPills?: boolean;
  hideMapChrome?: boolean;
  layout?: "default" | "holographic";
  showRegionLabels?: boolean;
  showCapitals?: boolean;
  showLatLonGrid?: boolean;
  showPylons?: boolean;
  showFlows?: boolean;
  showRadar?: boolean;
  energySurgeKey?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [geoData, setGeoData] = useState<GeoCollection | null>(() => cachedGeoJson);
  const [hovered, setHovered] = useState<string | null>(null);

  const isHero = variant === "hero";

  useEffect(() => {
    let cancelled = false;
    loadGeoJson().then((data) => {
      if (!cancelled) setGeoData(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const mapPack = useMemo(() => {
    if (!geoData) return null;
    const projection = geoMercator().fitExtent(FIT_EXTENT, geoData);
    const pathGenerator = geoPath().projection(projection);
    const regions: RegionGeom[] = geoData.features.map((f) => {
      const region = featureRegionName(f);
      const pathD = pathGenerator(f) ?? "";
      const centroid = pathGenerator.centroid(f) as [number, number];
      const capMeta = ITALY_CAPITALS[region as Region];
      const projected = capMeta
        ? (projection(capMeta.coordinates) as [number, number] | null)
        : null;
      const capitalXY = projected ?? centroid;
      return { region, pathD, centroid, capitalXY };
    });
    const romeMeta = ITALY_CAPITALS.Lazio;
    const romeXY = projection(romeMeta.coordinates) as [number, number];
    const byRegion = new Map(regions.map((r) => [r.region, r]));
    return { regions, romeXY, byRegion };
  }, [geoData]);

  const setHover = useCallback(
    (region: string | null) => {
      setHovered(region);
      onRegionHover?.(region);
    },
    [onRegionHover],
  );

  const moveTooltip = useCallback((clientX: number, clientY: number) => {
    const el = tooltipRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${clientX + 18}px, ${clientY + 18}px, 0)`;
  }, []);

  const onRootMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!hovered) return;
      moveTooltip(e.clientX, e.clientY);
    },
    [hovered, moveTooltip],
  );

  const onRootMouseLeave = useCallback(() => {
    setHover(null);
  }, [setHover]);

  const ranked = useMemo(() => {
    if (!pollByRegion) return [];
    return Object.values(pollByRegion).sort((a, b) => b.piHat - a.piHat);
  }, [pollByRegion]);

  const rankByRegion = useMemo(
    () => new Map(ranked.map((p, i) => [p.regione, i + 1])),
    [ranked],
  );

  const podiumLayouts = useMemo((): PodiumLayout[] => {
    if (!showRegionLabels || !pollByRegion || !mapPack) return [];
    const top3 = ranked.slice(0, 3);
    const entries: { region: Region; rankCode: string; pct: number }[] = top3.map(
      (p, i) => ({
        region: p.regione as Region,
        rankCode: String(i + 1).padStart(2, "0"),
        pct: p.piHat,
      }),
    );
    if (
      selectedRegion &&
      !top3.some((p) => p.regione === selectedRegion) &&
      pollByRegion[selectedRegion]
    ) {
      entries.push({
        region: selectedRegion as Region,
        rankCode: "SEL",
        pct: pollByRegion[selectedRegion].piHat,
      });
    }

    const layouts: PodiumLayout[] = [];
    for (const e of entries) {
      const geom = mapPack.byRegion.get(e.region);
      if (!geom) continue;
      const fallbackSide: PodiumSide = PODIUM_LEFT_REGIONS.has(e.region) ? "left" : "right";
      const anchor = podiumAnchorFor(e.region, fallbackSide);
      const s = sideSign(anchor.side);
      let labelX = geom.capitalXY[0] + s * anchor.dx2;
      let labelY = geom.capitalXY[1] + anchor.dy;
      labelX = clamp(labelX, MAP_SAFE.minX, MAP_SAFE.maxX);
      labelY = clamp(labelY, MAP_SAFE.minY, MAP_SAFE.maxY);
      layouts.push({
        region: e.region,
        rankCode: e.rankCode,
        pctLabel: `${(e.pct * 100).toFixed(2).replace(".", ",")}%`,
        cityX: geom.capitalXY[0],
        cityY: geom.capitalXY[1],
        targetY: labelY,
        labelX,
        labelY,
        anchor,
        side: anchor.side,
      });
    }

    layouts.sort((a, b) => a.labelY - b.labelY);
    resolvePodiumVerticalCollisions(layouts);
    for (const l of layouts) {
      const s = sideSign(l.side);
      let labelX = l.cityX + s * l.anchor.dx2;
      let labelY = l.targetY;
      labelX = clamp(labelX, MAP_SAFE.minX, MAP_SAFE.maxX);
      labelY = clamp(labelY, MAP_SAFE.minY, MAP_SAFE.maxY);
      l.labelX = labelX;
      l.labelY = labelY;
      l.targetY = labelY;
    }
    return layouts;
  }, [showRegionLabels, pollByRegion, ranked, selectedRegion, mapPack]);

  const renderOrder = useMemo(() => {
    if (!mapPack) return [];
    return [...mapPack.regions].sort((a, b) => {
      const score = (r: string) =>
        selectedRegion === r || hovered === r || highlightedRegion === r ? 1 : 0;
      return score(a.region) - score(b.region);
    });
  }, [mapPack, selectedRegion, hovered, highlightedRegion]);

  const hoverPoll = hovered && pollByRegion ? pollByRegion[hovered] : undefined;

  const hubArcs = useMemo(() => {
    if (!mapPack) return [];
    return HUB_ARC_REGIONS.map((hub) => {
      const g = mapPack.byRegion.get(hub);
      if (!g) return null;
      return {
        hub,
        d: hubArcPath(mapPack.romeXY, g.capitalXY),
      };
    }).filter(Boolean) as { hub: Region; d: string }[];
  }, [mapPack]);

  const mapCore = (
    <div
      ref={rootRef}
      className="relative h-full min-h-[420px] w-full max-w-full overflow-hidden bg-transparent"
      onMouseMove={onRootMouseMove}
      onMouseLeave={onRootMouseLeave}
    >
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="relative z-10 h-full w-full max-h-full max-w-full"
        style={{ display: "block", width: "100%", height: "100%" }}
        role="img"
        aria-label="Mappa regioni Italia"
      >
        <defs>
          <linearGradient id="map-tier-0" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#131C2E" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id="map-tier-1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0C4A6E" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id="map-tier-2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#155E75" />
            <stop offset="100%" stopColor="#0891B2" />
          </linearGradient>
          <linearGradient id="map-tier-3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#065F46" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="map-tier-4" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>

        {!mapPack && (
          <text x={MAP_W / 2} y={MAP_H / 2} textAnchor="middle" className="fill-slate-500 font-mono text-xs">
            CARICAMENTO GEO…
          </text>
        )}

        {mapPack && (
          <>
            {showLatLonGrid && (
              <g pointerEvents="none" stroke="rgba(148,163,184,0.08)" strokeWidth={0.5}>
                {Array.from({ length: 9 }, (_, i) => (
                  <line key={`h-${i}`} x1={0} y1={i * (MAP_H / 8)} x2={MAP_W} y2={i * (MAP_H / 8)} />
                ))}
                {Array.from({ length: 11 }, (_, i) => (
                  <line key={`v-${i}`} x1={i * (MAP_W / 10)} y1={0} x2={i * (MAP_W / 10)} y2={MAP_H} />
                ))}
              </g>
            )}

            <g id="hub-arcs" pointerEvents="none" fill="none">
              {hubArcs.map(({ hub, d }) => (
                <path
                  key={`arc-${hub}`}
                  d={d}
                  stroke="#38BDF8"
                  strokeOpacity={0.22}
                  strokeWidth={1}
                  strokeDasharray="3 5"
                />
              ))}
            </g>

            <g id="italia-regions">
              {renderOrder.map((r) => {
                const val = valuesByRegion[r.region];
                const tier = tierIndex(val ?? 0.05);
                const fill =
                  colorMode === "stima"
                    ? `url(#map-tier-${tier})`
                    : cartographicFill(colorMode, val ?? 0);
                const selected = selectedRegion === r.region;
                const hot = hovered === r.region || highlightedRegion === r.region;
                const active = selected || hot;
                const dim =
                  (selectedRegion && !selected) ||
                  (classFilter !== "all" &&
                    pollByRegion?.[r.region]?.classificazione !== classFilter);

                return (
                  <path
                    key={`${r.region}-${colorMode}`}
                    d={r.pathD}
                    fill={fill}
                    stroke={active ? "#6EE7B7" : "#060A12"}
                    strokeWidth={active ? 1.6 : 1}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-pointer"
                    style={{
                      opacity: dim ? 0.45 : 1,
                      transition: "opacity 180ms ease-out",
                    }}
                    onClick={() => onRegionClick?.(r.region)}
                    onMouseEnter={(e) => {
                      setHover(r.region);
                      moveTooltip(e.clientX, e.clientY);
                    }}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </g>

            {showCapitals &&
              mapPack.regions.map((r) => (
                <circle
                  key={`cap-${r.region}`}
                  cx={r.capitalXY[0]}
                  cy={r.capitalXY[1]}
                  r={2.5}
                  fill="#F8FAFC"
                  pointerEvents="none"
                />
              ))}

            <g pointerEvents="none">
              {podiumLayouts.map((b) => {
                const s = sideSign(b.side);
                const bendX = b.cityX + s * b.anchor.dx1;
                return (
                  <g key={`leader-${b.region}-${b.rankCode}`}>
                    <polyline
                      points={`${b.cityX},${b.cityY} ${bendX},${b.labelY} ${b.labelX},${b.labelY}`}
                      fill="none"
                      stroke="#334155"
                      strokeWidth={1}
                    />
                  </g>
                );
              })}
            </g>
          </>
        )}
      </svg>

      {podiumLayouts.map((b) => {
        const leftPct = (b.labelX / MAP_W) * 100;
        const topPct = (b.labelY / MAP_H) * 100;
        return (
          <PodiumCalloutPlate
            key={`plate-${b.region}-${b.rankCode}`}
            rankCode={b.rankCode}
            regionLine={`${regionPodiumLabel(b.region)} · ${b.pctLabel}`}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              transform: b.side === "left" ? "translate(-100%, -50%)" : "translate(0, -50%)",
            }}
          />
        );
      })}

      <div className="pointer-events-none absolute inset-0 z-[25] font-mono text-[10px] tracking-wider text-slate-500">
        <div className="absolute left-3 top-3">CRS // WGS84 · FIT-EXTENT AUTO</div>
        <div className="absolute right-3 top-3 text-right">20 REGIONI // 20.000 SIM MC</div>
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span>0</span>
          <div className="h-px w-14 bg-slate-600" />
          <span>100</span>
          <div className="h-px w-14 bg-slate-600" />
          <span>200 KM</span>
        </div>
        {onClearSelection && selectedRegion && (
          <button
            type="button"
            className="pointer-events-auto absolute bottom-3 right-3 border border-[#1B2436] bg-[#080C14]/90 px-2 py-1 text-[10px] font-semibold uppercase text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
            onClick={onClearSelection}
          >
            [ × RESET SELEZIONE ]
          </button>
        )}
      </div>

      {hoverPoll && (
        <FloatingTooltip
          tooltipRef={tooltipRef}
          poll={hoverPoll}
          rank={rankByRegion.get(hoverPoll.regione) ?? 0}
          votes={votesByRegion?.[hoverPoll.regione]}
        />
      )}
    </div>
  );

  if (!isHero) {
    return (
      <Panel className="border border-[#1E2638] bg-[#0C101A] p-3">
        {mapCore}
        {zoomControls === "internal" && (
          <p className="mt-2 font-mono text-[10px] text-slate-500">
            Vista fissa · fitExtent automatico
          </p>
        )}
      </Panel>
    );
  }

  return mapCore;
}
