import type { FlussiIpsos } from "@/lib/engine/defaults";
import type { OperationalRoadmap } from "@/lib/engine/operationalRoadmapBuilder";
import type { HorizonDays, StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import type { ScenarioResult } from "@/lib/engine/types";

export type RoadmapStageId = 1 | 2 | 3 | 4;
export type RoadmapTheme = "dark" | "light";

export type RoadmapEmbedParams = {
  targetPct: number;
  horizonDays: HorizonDays;
  stage: RoadmapStageId;
  theme: RoadmapTheme;
};

export type RoadmapSyncMessage = {
  type: "fn-roadmap-sync";
  params: RoadmapEmbedParams;
  scenario?: ScenarioResult;
  flussiIpsos?: FlussiIpsos;
  /** Roadmap già generata (AI o solver): l'embed non deve ricalcolarla in silenzio. */
  roadmap?: OperationalRoadmap;
  plan?: StrategicBackcastResult;
};

export type RoadmapChildMessage =
  | { type: "fn-roadmap-ready" }
  | { type: "fn-roadmap-close" }
  | { type: "fn-roadmap-stage"; stage: RoadmapStageId };

export const ROADMAP_EMBED_PATH = "/embed/roadmap";

const HORIZONS: readonly HorizonDays[] = [30, 90, 180, 360];

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseRoadmapEmbedParams(raw: RawParams): RoadmapEmbedParams {
  const target = Number(first(raw.target));
  const horizon = Number(first(raw.horizon)) as HorizonDays;
  const stage = Number(first(raw.stage));
  return {
    targetPct: Number.isFinite(target) && target > 0 && target <= 20 ? Math.round(target * 10) / 10 : 12,
    horizonDays: HORIZONS.includes(horizon) ? horizon : 360,
    stage: stage >= 1 && stage <= 4 ? (Math.round(stage) as RoadmapStageId) : 1,
    theme: first(raw.theme) === "light" ? "light" : "dark",
  };
}

export function roadmapEmbedUrl(params: RoadmapEmbedParams): string {
  const query = new URLSearchParams({
    target: params.targetPct.toFixed(1),
    horizon: String(params.horizonDays),
    stage: String(params.stage),
    theme: params.theme,
  });
  return `${ROADMAP_EMBED_PATH}?${query.toString()}`;
}

export function isRoadmapChildMessage(data: unknown): data is RoadmapChildMessage {
  if (!data || typeof data !== "object") return false;
  const type = (data as { type?: unknown }).type;
  return type === "fn-roadmap-ready" || type === "fn-roadmap-close" || type === "fn-roadmap-stage";
}

export function isRoadmapSyncMessage(data: unknown): data is RoadmapSyncMessage {
  return !!data && typeof data === "object" && (data as { type?: unknown }).type === "fn-roadmap-sync";
}
