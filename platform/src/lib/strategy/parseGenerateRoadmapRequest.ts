import type { Region } from "@/lib/engine/constants";
import type { HorizonDays } from "@/lib/engine/strategicBackcastEngine";
import { REGIONS } from "@/lib/engine/constants";

const HORIZONS: readonly HorizonDays[] = [30, 90, 180, 360];
const REGION_SET = new Set<string>(REGIONS);

export type GenerateRoadmapRequest = {
  targetPct: number;
  horizonDays: HorizonDays;
  strategicFocusNote?: string;
  regionalPoll?: { regione: Region; piHat: number }[];
  /** Consenso nazionale Oggi (frazione 0–1) allineato alla dashboard live. */
  liveS?: number;
};

function parseRegionalPoll(raw: unknown): { regione: Region; piHat: number }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const rows: { regione: Region; piHat: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const regione = (item as { regione?: unknown }).regione;
    const piHat = Number((item as { piHat?: unknown }).piHat);
    if (typeof regione !== "string" || !REGION_SET.has(regione) || !Number.isFinite(piHat) || piHat <= 0 || piHat > 1) {
      continue;
    }
    rows.push({ regione: regione as Region, piHat });
  }
  return rows.length ? rows : undefined;
}

export function parseGenerateRoadmapRequest(raw: unknown): GenerateRoadmapRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "JSON non valido" };
  const value = raw as { targetPct?: unknown; horizonDays?: unknown; strategicFocusNote?: unknown };
  const targetPct = typeof value.targetPct === "number" ? value.targetPct : Number(value.targetPct);
  if (!Number.isFinite(targetPct) || targetPct < 6.5 || targetPct > 20) {
    return { error: "targetPct deve essere tra 6,5 e 20" };
  }
  if (!HORIZONS.includes(value.horizonDays as HorizonDays)) {
    return { error: "horizonDays deve essere 30, 90, 180 o 360" };
  }
  let strategicFocusNote: string | undefined;
  if (value.strategicFocusNote != null) {
    if (typeof value.strategicFocusNote !== "string") return { error: "strategicFocusNote non valida" };
    strategicFocusNote = value.strategicFocusNote.trim().slice(0, 280);
    if (!strategicFocusNote) strategicFocusNote = undefined;
  }
  const regionalPoll = parseRegionalPoll((value as { regionalPoll?: unknown }).regionalPoll);
  const liveS = Number((value as { liveS?: unknown }).liveS);
  const safeLiveS =
    Number.isFinite(liveS) && liveS > 0.005 && liveS < 0.35 ? Math.round(liveS * 10000) / 10000 : undefined;
  return {
    targetPct: Math.round(targetPct * 10) / 10,
    horizonDays: value.horizonDays as HorizonDays,
    ...(strategicFocusNote ? { strategicFocusNote } : {}),
    ...(regionalPoll ? { regionalPoll } : {}),
    ...(safeLiveS != null ? { liveS: safeLiveS } : {}),
  };
}
