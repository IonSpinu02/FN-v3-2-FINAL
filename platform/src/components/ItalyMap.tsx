"use client";

import { Panel } from "@/components/ui/FnUi";
import { scaleLinear } from "d3-scale";
import { useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";

const GEO_URL = "/geo/regioni-italia.geojson";

export type MapColorMode = "stima" | "probSoglia" | "scartoBenchmark";

const GEO_TO_MODEL: Record<string, string> = {
  "Valle d'Aosta/Vallée d'Aoste": "Valle d'Aosta",
  "Trentino-Alto Adige/Südtirol": "Trentino-Alto Adige",
  "Friuli-Venezia Giulia": "Friuli-Venezia Giulia",
};

function modelName(geoName: string): string {
  return GEO_TO_MODEL[geoName] ?? geoName;
}

export function ItalyMap({
  valuesByRegion,
  colorMode,
  onRegionClick,
}: {
  valuesByRegion: Record<string, number>;
  colorMode: MapColorMode;
  onRegionClick?: (region: string) => void;
}) {
  const values = Object.values(valuesByRegion);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const color = useMemo(() => {
    if (colorMode === "probSoglia") {
      return scaleLinear<string>()
        .domain([0, 0.35, 0.9, 1])
        .range(["#fecaca", "#fde68a", "#86efac", "#059669"])
        .clamp(true);
    }
    if (colorMode === "scartoBenchmark") {
      return scaleLinear<string>()
        .domain([min, 0, max])
        .range(["#1e40af", "#a8a29e", "#ea580c"])
        .clamp(true);
    }
    return scaleLinear<string>()
      .domain([min, max])
      .range(["#dbeafe", "#0f5c48"])
      .clamp(true);
  }, [colorMode, min, max]);

  const legend =
    colorMode === "probSoglia"
      ? "Probabilità superamento soglia"
      : colorMode === "scartoBenchmark"
        ? "Scarto vs benchmark (pp)"
        : "Stima % sondaggio";

  return (
    <Panel className="p-3">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [12.5, 42.5], scale: 2200 }}
        width={400}
        height={520}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const props = geo.properties ?? {};
              const name =
                (props.reg_name as string) || (props.name as string) || "";
              const region = modelName(name);
              const val = valuesByRegion[region];
              const fill = val != null ? color(val) : "#e7e2d9";
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="#ffffff"
                  strokeWidth={0.6}
                  onClick={() => onRegionClick?.(region)}
                  aria-label={
                    val != null
                      ? `${region}: ${(val * 100).toFixed(2)}%`
                      : region
                  }
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  style={
                    {
                      default: { outline: "none", cursor: "pointer" },
                      hover: { fill: "#d4a017", outline: "none" },
                      pressed: { outline: "none" },
                    } as any
                  }
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      <div className="mt-2 flex items-center justify-between px-2 text-xs text-fn-text-muted">
        <span className="font-mono">
          {colorMode === "scartoBenchmark"
            ? `${(min * 100).toFixed(2)} pp`
            : `${(min * 100).toFixed(1)}%`}
        </span>
        <span>{legend}</span>
        <span className="font-mono">
          {colorMode === "scartoBenchmark"
            ? `${(max * 100).toFixed(2)} pp`
            : `${(max * 100).toFixed(1)}%`}
        </span>
      </div>
    </Panel>
  );
}
