import { scaleLinear } from "d3-scale";

export type MapColorMode = "stima" | "probSoglia" | "scartoBenchmark";

export function buildMapColorScale(
  colorMode: MapColorMode,
  min: number,
  max: number,
) {
  if (colorMode === "probSoglia") {
    return scaleLinear<string>()
      .domain([0, 0.35, 0.9, 1])
      .range(["#991b1b", "#ca8a04", "#34d399", "#10b981"])
      .clamp(true);
  }
  if (colorMode === "scartoBenchmark") {
    return scaleLinear<string>()
      .domain([min, 0, max])
      .range(["#2563eb", "#475569", "#fb923c"])
      .clamp(true);
  }
  return scaleLinear<string>()
    .domain([min, max])
    .range(["#0c4a6e", "#059669"])
    .clamp(true);
}

export function mapLegendStops(
  colorMode: MapColorMode,
  min: number,
  max: number,
): string[] {
  if (colorMode === "probSoglia") {
    return ["#991b1b", "#ca8a04", "#34d399", "#10b981"];
  }
  if (colorMode === "scartoBenchmark") {
    return ["#2563eb", "#475569", "#fb923c"];
  }
  return ["#0c4a6e", "#059669"];
}

export function formatMapMetric(
  colorMode: MapColorMode,
  value: number | undefined,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (colorMode === "scartoBenchmark") {
    return `${(value * 100).toFixed(2)} pp`;
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function mapLegendTitle(colorMode: MapColorMode): string {
  if (colorMode === "probSoglia") return "Probabilità superamento soglia";
  if (colorMode === "scartoBenchmark") return "Scarto vs benchmark";
  return "Stima sondaggio";
}

/** 5-band editorial palette for stima % (piHat as 0–1 fraction). */
export function cartographicFill(colorMode: MapColorMode, value: number): string {
  if (colorMode === "stima") {
    const p = value * 100;
    if (p < 5.8) return "#1E293B";
    if (p < 6.6) return "#0369A1";
    if (p < 7.5) return "#0891B2";
    if (p < 8.8) return "#059669";
    return p >= 9.5 ? "#34D399" : "#10B981";
  }
  if (colorMode === "probSoglia") {
    if (value < 0.2) return "#1E293B";
    if (value < 0.45) return "#0369A1";
    if (value < 0.65) return "#0891B2";
    if (value < 0.85) return "#059669";
    return value >= 0.95 ? "#34D399" : "#10B981";
  }
  const pp = value * 100;
  if (pp < -0.5) return "#1E293B";
  if (pp < 0) return "#0369A1";
  if (pp < 0.5) return "#0891B2";
  if (pp < 1.2) return "#059669";
  return pp >= 2 ? "#34D399" : "#10B981";
}

export const STIMA_LEGEND_BANDS = [
  { label: "< 5.8%", color: "#1E293B" },
  { label: "5.8–6.6%", color: "#0369A1" },
  { label: "6.6–7.5%", color: "#0891B2" },
  { label: "7.5–8.8%", color: "#059669" },
  { label: "> 8.8%", color: "#10B981" },
] as const;

export const PROB_LEGEND_BANDS = [
  { label: "< 20%", color: "#1E293B" },
  { label: "20–45%", color: "#0369A1" },
  { label: "45–65%", color: "#0891B2" },
  { label: "65–85%", color: "#059669" },
  { label: "> 85%", color: "#10B981" },
] as const;

export const SCARTO_LEGEND_BANDS = [
  { label: "< −0.5 pp", color: "#1E293B" },
  { label: "−0.5–0 pp", color: "#0369A1" },
  { label: "0–0.5 pp", color: "#0891B2" },
  { label: "0.5–1.2 pp", color: "#059669" },
  { label: "> 1.2 pp", color: "#10B981" },
] as const;

export function legendBandsForMode(colorMode: MapColorMode) {
  if (colorMode === "probSoglia") return PROB_LEGEND_BANDS;
  if (colorMode === "scartoBenchmark") return SCARTO_LEGEND_BANDS;
  return STIMA_LEGEND_BANDS;
}
