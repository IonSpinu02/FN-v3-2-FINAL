"use client";

import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import type { Region } from "@/lib/engine/constants";
import type { RegionPlan, RegionRole } from "@/lib/engine/strategicBackcastEngine";

const GEO_URL = "/geo/regioni-italia.geojson";
const GEO_TO_MODEL: Record<string, string> = {
  "Valle d'Aosta/Vallée d'Aoste": "Valle d'Aosta",
  "Trentino-Alto Adige/Südtirol": "Trentino-Alto Adige",
};

type GeoCollection = GeoPermissibleObjects & {
  type: "FeatureCollection";
  features: GeoPermissibleObjects[];
};

let cachedGeoJson: GeoCollection | null = null;

function featureRegionName(feature: GeoPermissibleObjects): string {
  const props =
    feature && typeof feature === "object" && "properties" in feature
      ? (feature.properties as Record<string, unknown> | null)
      : null;
  const name = String(props?.reg_name ?? props?.name ?? "");
  return GEO_TO_MODEL[name] ?? name;
}

function roleFill(role: RegionRole | undefined): string {
  if (role === "FRONTE_PRIORITARIO") return "#34d399";
  if (role === "SUPPORTO_ESPANSIONE") return "#22d3ee";
  return "#64748b";
}

export function TacticalItalyMap({
  regions,
  selected,
  onSelect,
  stage = false,
  wave,
  emphasis,
}: {
  regions: RegionPlan[];
  selected: Region | null;
  onSelect: (region: Region) => void;
  stage?: boolean;
  wave?: { current: readonly Region[]; previous: readonly Region[] };
  /** Regioni da accendere in hover, senza cambiare il ruolo permanente. */
  emphasis?: readonly Region[];
}) {
  const [geo, setGeo] = useState<GeoCollection | null>(null);
  const byRegion = useMemo(() => new Map(regions.map((row) => [row.region, row])), [regions]);
  const revealOrder = useMemo(
    () => new Map([...regions].sort((a, b) => b.addedVotes - a.addedVotes).map((row, index) => [row.region, index])),
    [regions],
  );
  useEffect(() => {
    let alive = true;
    const apply = (data: GeoCollection) => {
      cachedGeoJson = data;
      if (alive) setGeo(data);
    };
    if (cachedGeoJson) {
      apply(cachedGeoJson);
      return () => {
        alive = false;
      };
    }
    fetch(GEO_URL)
      .then((response) => response.json())
      .then((data: GeoCollection) => apply(data))
      .catch(() => {
        if (alive) setGeo(null);
      });
    return () => {
      alive = false;
    };
  }, []);
  const paths = useMemo(() => {
    if (!geo) return [];
    const projection = geoMercator().fitExtent(
      stage
        ? [
            [16, 10],
            [300, 360],
          ]
        : [
            [8, 6],
            [212, 248],
          ],
      geo,
    );
    const path = geoPath(projection);
    return geo.features.map((feature) => ({
      region: featureRegionName(feature) as Region,
      d: path(feature) ?? "",
    }));
  }, [geo, stage]);
  return (
    <div className={`relative overflow-hidden ${stage ? "h-full min-h-0" : "rounded-xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface-1)]"}`}>
      {stage ? null : <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.08),transparent_68%)]" />}
      <svg viewBox={stage ? "0 0 316 372" : "0 0 220 256"} className={stage ? "relative h-full w-full" : "relative h-52 w-full"} role="img" aria-label="Mappa tattica delle regioni">
        <defs>
          <filter id="obj-map-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {paths.map((shape) => {
          const plan = byRegion.get(shape.region);
          const active = selected === shape.region;
          const emphasized = emphasis?.includes(shape.region) ?? false;
          const dimmed = emphasis != null && emphasis.length > 0 && !emphasized;
          const waveCurrent = wave?.current.includes(shape.region) ?? false;
          const wavePrevious = !waveCurrent && (wave?.previous.includes(shape.region) ?? false);
          const front = wave ? waveCurrent : plan?.role === "FRONTE_PRIORITARIO";
          const fill = wave ? (waveCurrent ? "#34d399" : wavePrevious ? "#22d3ee" : "#64748b") : roleFill(plan?.role);
          const opacity = wave
            ? waveCurrent
              ? 0.92
              : wavePrevious
                ? 0.42
                : 0.2
            : plan?.role === "PRESIDIO_ORDINARIO"
              ? 0.32
              : front
                ? 0.92
                : 0.7;
          return (
            <path
              key={shape.region}
              d={shape.d}
              fill={fill}
              fillOpacity={dimmed ? 0.16 : opacity}
              stroke={active || emphasized ? "#6ee7b7" : "rgba(148,163,184,0.55)"}
              strokeWidth={active || emphasized ? 1.8 : 0.5}
              filter={stage && front ? "url(#obj-map-glow)" : undefined}
              className="obj-region cursor-pointer"
              style={{ animationDelay: `${180 + (revealOrder.get(shape.region) ?? 0) * 45}ms` }}
              onClick={() => onSelect(shape.region)}
            >
              <title>{shape.region}</title>
            </path>
          );
        })}
      </svg>
      <div className={`flex flex-wrap gap-2 px-2 pb-2 text-[10px] text-[var(--ink-muted)] ${stage ? "absolute bottom-1 left-1" : ""}`}>
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-400" /> {wave ? "Tappa attiva" : "Fronte"}</span>
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-cyan-400" /> {wave ? "Già attivate" : "Supporto"}</span>
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-slate-500" /> {wave ? "Da aprire" : "Presidio"}</span>
      </div>
    </div>
  );
}
