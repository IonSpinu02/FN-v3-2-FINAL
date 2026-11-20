"use client";

import { Panel } from "@/components/ui/FnUi";
import { ITALY_CAPITALS } from "@/lib/italyCapitals";
import { ClassStatusMark, regionPodiumLabel } from "@/components/ui/TelemetryUi";
import { cartographicFill, STIMA_LEGEND_BANDS, type MapColorMode } from "@/lib/mapDisplay";
import type { Region } from "@/lib/engine/constants";
import { RegionalGrowthMapTooltip } from "@/components/RegionalGrowthMapTooltip";
import type { ScenarioRegionalV4View } from "@/lib/scenarioRegionalV4";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import { useTheme } from "@/components/theme/ThemeProvider";
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const GEO_URL = "/geo/regioni-italia.geojson";
const MAP_W = 800;
const MAP_H = 730;
const MAP_SAFE = { minX: 100, maxX: 700, minY: 28, maxY: 702 };
/** Padding ridotto → Italia ~6–8% più grande nello stage scenario. */
const FIT_EXTENT: [[number, number], [number, number]] = [
  [48, 24],
  [752, 706],
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
      className="pointer-events-none absolute z-30 flex font-mono text-[11px] font-semibold leading-none text-[var(--ink-primary)] shadow-lg"
      style={style}
    >
      <span className="rounded-l border border-r-0 border-[var(--border-default)] bg-[var(--surface-2)] px-2 py-1.5 tabular-nums text-[var(--signal-positive)]">
        RNK {rankCode}
      </span>
      <span className="rounded-r border border-[var(--border-default)] bg-[var(--surface-1)]/95 px-2 py-1.5 tracking-tight">
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
      className="pointer-events-none fixed left-0 top-0 z-50 w-56 rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)]/95 p-3 text-[var(--ink-primary)] shadow-lg will-change-transform"
      style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold tracking-tight text-[var(--ink-primary)]">
          {poll.regione}
          <span className="ml-1 font-mono text-[11px] font-medium text-[var(--ink-muted)]">
            RANK #{String(rank).padStart(2, "0")}
          </span>
        </p>
        <ClassStatusMark classificazione={poll.classificazione} />
      </div>
      <p className="mt-1 font-mono text-[14px] font-bold tabular-nums text-[var(--ink-primary)]">
        {pctVal.toFixed(2).replace(".", ",")}%
      </p>
      <p className="font-mono text-[11px] tabular-nums text-[var(--ink-muted)]">
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
      <p className="mt-1 font-mono text-[11px] uppercase text-[var(--ink-muted)]">
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
  regionalV4ByRegion,
  regionalV4AsOf,
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
  regionalV4ByRegion?: Record<string, ScenarioRegionalV4View>;
  regionalV4AsOf?: Date;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  /** Sempre `null` al primo render (SSR = client hydrate): la cache GeoJSON si applica solo in effect. */
  const [geoData, setGeoData] = useState<GeoCollection | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const isHero = variant === "hero";
  const reliefFill = theme === "light" ? "#cbd5e1" : "#152033";

  useEffect(() => {
    let cancelled = false;
    void loadGeoJson().then((data) => {
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

  const v4Ranked = useMemo(() => {
    if (!regionalV4ByRegion) return [];
    return Object.values(regionalV4ByRegion).sort((a, b) => b.addedVotes - a.addedVotes);
  }, [regionalV4ByRegion]);

  const v4RankByRegion = useMemo(
    () => new Map(v4Ranked.map((row, i) => [row.regione, i + 1])),
    [v4Ranked],
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
  const hoverRegional =
    hovered && regionalV4ByRegion ? regionalV4ByRegion[hovered] : undefined;

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
      className="fn-italy-map relative h-full min-h-0 w-full max-w-full overflow-hidden bg-[var(--map-canvas)]"
      style={
        theme === "light"
          ? undefined
          : {
              backgroundImage:
                "radial-gradient(ellipse at center, rgba(148,163,184,0.07), transparent 68%)",
            }
      }
      onMouseMove={onRootMouseMove}
      onMouseLeave={onRootMouseLeave}
    >
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="relative z-10 h-full max-h-full w-full max-w-full"
        style={{ display: "block" }}
        role="img"
        aria-label="Mappa regioni Italia"
      >
        <defs>
          <linearGradient id="map-tier-0" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme === "light" ? "#cbd5e1" : "#243044"} />
            <stop offset="100%" stopColor={theme === "light" ? "#94a3b8" : "#34506A"} />
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
          <g aria-hidden>
            <rect
              x={MAP_W / 2 - 120}
              y={MAP_H / 2 - 18}
              width={240}
              height={36}
              rx={8}
              className="fill-slate-800/50"
            />
            <text
              x={MAP_W / 2}
              y={MAP_H / 2 + 5}
              textAnchor="middle"
              className="fill-slate-500 font-mono text-xs"
            >
              Mappa in caricamento…
            </text>
          </g>
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
              {hubArcs.map(({ hub, d }) => {
                const lit = hovered === hub || selectedRegion === hub;
                return (
                  <path
                    key={`arc-${hub}`}
                    d={d}
                    stroke="var(--signal-observed)"
                    strokeOpacity={lit ? 0.55 : 0.06}
                    strokeWidth={lit ? 1.25 : 1}
                  />
                );
              })}
            </g>

            {/* 2.5D extrusion / rilievo */}
            <g
              id="italia-relief"
              pointerEvents="none"
              transform="translate(0, 5)"
              opacity={0.55}
            >
              {mapPack.regions.map((r) => (
                <path
                  key={`relief-${r.region}`}
                  d={r.pathD}
                  fill={reliefFill}
                  stroke="rgba(52,211,153,0.12)"
                  strokeWidth={0.8}
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
                  (selectedRegion != null && selectedRegion !== "" && !selected) ||
                  (classFilter !== "all" &&
                    pollByRegion?.[r.region]?.classificazione !== classFilter);

                return (
                  <path
                    key={`${r.region}-${colorMode}`}
                    d={r.pathD}
                    fill={fill}
                    stroke={
                      active
                        ? theme === "light"
                          ? "rgba(15,23,42,0.72)"
                          : "rgba(226,232,240,0.9)"
                        : theme === "light"
                          ? "rgba(71,85,105,0.45)"
                          : "rgba(148,163,184,0.28)"
                    }
                    strokeWidth={active ? 1.75 : 1}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-pointer"
                    style={{
                      opacity: dim ? 0.55 : 1,
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
                  r={2.2}
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

            {/* Target lock-on reticle + HUD tags (selected + top 3) */}
            <g pointerEvents="none">
              {podiumLayouts.map((b, idx) => {
                const geom = mapPack.byRegion.get(b.region);
                if (!geom) return null;
                const [cx, cy] = geom.centroid;
                const isSel = selectedRegion === b.region || hovered === b.region || b.rankCode === "SEL";
                const ringR = isSel ? 13 : 9;
                const short = regionPodiumLabel(b.region).slice(0, 3).toUpperCase();
                const tagX = b.side === "right" ? cx + 48 : cx - 48;
                const tagY = cy - 18;
                const midX = (cx + tagX) / 2;
                return (
                  <g key={`reticle-${b.region}-${b.rankCode}`}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={ringR}
                      fill="none"
                      stroke={isSel ? "var(--map-stroke-active)" : "var(--ink-muted)"}
                      strokeOpacity={isSel ? 0.9 : 0.7}
                      strokeWidth={isSel ? 1.25 : 0.8}
                      className="fn-map-reticle-ring"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={2.2}
                      fill={isSel ? "var(--map-stroke-active)" : "var(--ink-secondary)"}
                      className="fn-map-reticle-dot"
                    />
                    <polyline
                      points={`${cx},${cy} ${midX},${tagY} ${tagX},${tagY}`}
                      fill="none"
                      stroke={isSel ? "#34d399" : "#64748b"}
                      strokeOpacity={0.7}
                      strokeWidth={1}
                    />
                    <g transform={`translate(${tagX + (b.side === "right" ? 4 : -4)}, ${tagY})`}>
                      <rect
                        x={b.side === "right" ? 0 : -132}
                        y={-10}
                        width={132}
                        height={20}
                        rx={3}
                        fill="#080C14"
                        fillOpacity={0.92}
                        stroke="#1B2436"
                      />
                      <text
                        x={b.side === "right" ? 8 : -124}
                        y={4}
                        className="fill-emerald-300 font-mono"
                        style={{ fontSize: 11 }}
                      >
                        {short} {b.pctLabel}
                      </text>
                    </g>
                    {idx === 0 ? null : null}
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

      <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[25] flex flex-wrap items-end justify-between gap-2 font-mono text-[10px] tabular-nums text-[var(--ink-muted)]">
        <div className="flex max-w-[70%] flex-wrap gap-x-2 gap-y-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]/90 px-3 py-1.5 backdrop-blur-sm">
          {STIMA_LEGEND_BANDS.map((band) => (
            <span key={band.label} className="inline-flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm" style={{ background: band.color }} />
              {band.label.replace(".", ",")}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span>0</span>
          <div className="h-px w-14 bg-[var(--border-default)]" />
          <span>100</span>
          <div className="h-px w-14 bg-[var(--border-default)]" />
          <span>200 KM</span>
        </div>
        {onClearSelection && selectedRegion && (
          <button
            type="button"
            className="pointer-events-auto border border-[var(--border-default)] bg-[var(--surface-1)]/95 px-2 py-1 text-[10px] font-semibold uppercase text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
            onClick={onClearSelection}
          >
            [ × RESET SELEZIONE ]
          </button>
        )}
      </div>

      {hoverRegional && regionalV4AsOf && (
        <RegionalGrowthMapTooltip
          tooltipRef={tooltipRef}
          regional={hoverRegional}
          asOf={regionalV4AsOf}
          rank={v4RankByRegion.get(hoverRegional.regione) ?? 0}
          currentVotes={votesByRegion?.[hoverRegional.regione] ?? 0}
          currentShare={pollByRegion?.[hoverRegional.regione]?.piHat ?? hoverRegional.startPct / 100}
        />
      )}
      {hoverPoll && !hoverRegional && (
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
