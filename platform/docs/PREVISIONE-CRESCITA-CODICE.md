# Previsione di crescita — codice

Formula: `S(t) = S0 + pendenza smorzata + shock notizie + boost B.I.P.`, poi moltiplicata per la sensibilità (0,7 / 1 / 1,3).

Preview a 30, 90 e 180 giorni in `ScenarioGrowthForecastPanel`. Report sulla mappa in `GrowthForecastReport`. API: `GET /api/forecast/growth?sPct=&regime=`.

Il collegamento allo scenario è in `src/lib/engine/partyGrowthForecast.ts` (`computePartyGrowthForecast` usa `projectHorizon` e `buildGrowthEvidence`).

## `src/lib/engine/growthTrajectory.ts`

```ts
/** Sensibilità sul delta del modello. Non è più un incremento fisso in punti. */
export type GrowthSensitivityId = "organica" | "territori" | "massima";

export const REGIME_SENSITIVITY: Record<GrowthSensitivityId, number> = {
  organica: 0.7,
  territori: 1,
  massima: 1.3,
};

export type GrowthHorizonId = "d30" | "d90" | "may27";

export const HORIZON_ORDER: GrowthHorizonId[] = ["d30", "d90", "may27"];

export const HORIZON_LABEL: Record<GrowthHorizonId, string> = {
  d30: "30 giorni",
  d90: "90 giorni",
  may27: "Maggio 2027",
};

const SLOPE_TAU_MONTHS = 3;
const SLOPE_CAP_PP = 2.5;
const NEWS_CAP_PP = 0.3;
const NEWS_MAY_CAP_PP = 0.45;
const BIP_CAP_PP = 0.2;

export type ConsensusPoint = { isoDate: string; pct: number };

export type GrowthEvidence = {
  /** Pendenza recente, punti percentuali al mese. */
  slopePpPerMonth: number;
  /** Da −1 (notizie negative) a +1. */
  newsScore: number;
  /** Quante misure B.I.P. combaciano con le notizie in agenda. 0 se non ci sono notizie. */
  bipMatches: number;
  newsHeadlines: string[];
  bipLabels: string[];
  slopeFrom: string | null;
  slopeTo: string | null;
};

export type HorizonProjection = {
  id: GrowthHorizonId;
  label: string;
  months: number;
  deltaPp: number;
  slopePp: number;
  newsPp: number;
  bipPp: number;
  centralPct: number;
  bandLowPct: number;
  bandHighPct: number;
};

const NEWS_HORIZON_SCALE: Record<GrowthHorizonId, number> = {
  d30: 0.5,
  d90: 1,
  may27: NEWS_MAY_CAP_PP / NEWS_CAP_PP,
};

const BIP_HORIZON_SCALE: Record<GrowthHorizonId, number> = {
  d30: 0.4,
  d90: 0.7,
  may27: 1,
};

const BAND_BASE_PP: Record<GrowthHorizonId, number> = {
  d30: 0.25,
  d90: 0.45,
  may27: 0.8,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function monthsUntilMay2027(asOf: Date): number {
  const months = (2027 - asOf.getUTCFullYear()) * 12 + (4 - asOf.getUTCMonth());
  return Math.max(1, months);
}

export function horizonMonths(id: GrowthHorizonId, asOf = new Date()): number {
  if (id === "d30") return 1;
  if (id === "d90") return 3;
  return monthsUntilMay2027(asOf);
}

/** Pendenza tra il punto più recente e quello di circa 2–4 mesi prima. */
export function consensusSlopePpPerMonth(points: ConsensusPoint[]): {
  slopePpPerMonth: number;
  from: string | null;
  to: string | null;
} {
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.pct))
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  if (sorted.length < 2) {
    return { slopePpPerMonth: 0, from: sorted[0]?.isoDate ?? null, to: sorted[0]?.isoDate ?? null };
  }
  const last = sorted[sorted.length - 1]!;
  const lastMs = Date.parse(`${last.isoDate}T12:00:00Z`);
  let earlier = sorted[0]!;
  for (let i = sorted.length - 2; i >= 0; i--) {
    const candidate = sorted[i]!;
    const days = (lastMs - Date.parse(`${candidate.isoDate}T12:00:00Z`)) / 86400000;
    earlier = candidate;
    if (days >= 45) break;
  }
  const days = Math.max(
    1,
    (lastMs - Date.parse(`${earlier.isoDate}T12:00:00Z`)) / 86400000,
  );
  const months = days / 30.44;
  return {
    slopePpPerMonth: (last.pct - earlier.pct) / months,
    from: earlier.isoDate,
    to: last.isoDate,
  };
}

export function dampedSlopePp(slopePpPerMonth: number, months: number): number {
  const raw = slopePpPerMonth * SLOPE_TAU_MONTHS * (1 - Math.exp(-months / SLOPE_TAU_MONTHS));
  return clamp(raw, -SLOPE_CAP_PP, SLOPE_CAP_PP);
}

export function newsShockPp(newsScore: number, horizon: GrowthHorizonId): number {
  const cap = horizon === "may27" ? NEWS_MAY_CAP_PP : NEWS_CAP_PP * NEWS_HORIZON_SCALE[horizon];
  return clamp(newsScore, -1, 1) * cap;
}

/** Senza notizie il contributo B.I.P. è zero. */
export function bipBoostPp(bipMatches: number, newsCount: number, horizon: GrowthHorizonId): number {
  if (newsCount <= 0 || bipMatches <= 0) return 0;
  const raw = Math.min(BIP_CAP_PP, bipMatches * 0.08) * BIP_HORIZON_SCALE[horizon];
  return clamp(raw, 0, BIP_CAP_PP);
}

export function componentsAtMonths(
  evidence: GrowthEvidence,
  months: number,
  mayMonths: number,
): { slopePp: number; newsPp: number; bipPp: number } {
  const slopePp = dampedSlopePp(evidence.slopePpPerMonth, months);
  const span = Math.max(1, mayMonths);
  const newsMay = newsShockPp(evidence.newsScore, "may27");
  const newsPp = newsMay * Math.min(1, months / span);
  const bipMay = bipBoostPp(evidence.bipMatches, evidence.newsHeadlines.length, "may27");
  const bipPp = bipMay * Math.min(1, months / span);
  return { slopePp, newsPp, bipPp };
}

export function projectHorizon(input: {
  startPct: number;
  evidence: GrowthEvidence;
  horizon: GrowthHorizonId;
  sensitivity?: number;
  asOf?: Date;
}): HorizonProjection {
  const sensitivity = input.sensitivity ?? 1;
  const months = horizonMonths(input.horizon, input.asOf);
  const slopePp = dampedSlopePp(input.evidence.slopePpPerMonth, months);
  const newsPp = newsShockPp(input.evidence.newsScore, input.horizon);
  const bipPp = bipBoostPp(
    input.evidence.bipMatches,
    input.evidence.newsHeadlines.length,
    input.horizon,
  );
  const deltaPp = (slopePp + newsPp + bipPp) * sensitivity;
  const centralPct = input.startPct + deltaPp;
  const bandHalf = BAND_BASE_PP[input.horizon] + Math.abs(deltaPp) * 0.1;
  return {
    id: input.horizon,
    label: HORIZON_LABEL[input.horizon],
    months,
    deltaPp,
    slopePp: slopePp * sensitivity,
    newsPp: newsPp * sensitivity,
    bipPp: bipPp * sensitivity,
    centralPct,
    bandLowPct: centralPct - bandHalf,
    bandHighPct: centralPct + bandHalf,
  };
}

export function projectMonths(input: {
  startPct: number;
  evidence: GrowthEvidence;
  months: number;
  sensitivity?: number;
  mayMonths?: number;
}): HorizonProjection {
  const sensitivity = input.sensitivity ?? 1;
  const months = Math.max(0.25, input.months);
  const mayMonths = input.mayMonths ?? 7;
  const parts = componentsAtMonths(input.evidence, months, mayMonths);
  const deltaPp = (parts.slopePp + parts.newsPp + parts.bipPp) * sensitivity;
  const centralPct = input.startPct + deltaPp;
  const bandHalf =
    0.2 + Math.min(1.1, months / mayMonths) * 0.7 + Math.abs(deltaPp) * 0.1;
  const id: GrowthHorizonId =
    months <= 1.2 ? "d30" : months <= 3.2 ? "d90" : "may27";
  return {
    id,
    label:
      months <= 1.05
        ? "30 giorni"
        : Math.round(months) === Math.round(mayMonths)
          ? "Maggio 2027"
          : `${Math.round(months)} mesi`,
    months,
    deltaPp,
    slopePp: parts.slopePp * sensitivity,
    newsPp: parts.newsPp * sensitivity,
    bipPp: parts.bipPp * sensitivity,
    centralPct,
    bandLowPct: centralPct - bandHalf,
    bandHighPct: centralPct + bandHalf,
  };
}

export function projectAllHorizons(input: {
  startPct: number;
  evidence: GrowthEvidence;
  sensitivity?: number;
  asOf?: Date;
}): HorizonProjection[] {
  return HORIZON_ORDER.map((horizon) =>
    projectHorizon({ ...input, horizon }),
  );
}

export function explainGrowth(input: {
  startPct: number;
  evidence: GrowthEvidence;
  horizons: HorizonProjection[];
}): string {
  const d30 = input.horizons.find((h) => h.id === "d30");
  const slope = input.evidence.slopePpPerMonth;
  const slopeTxt =
    slope < -0.05
      ? `negativa, ${slope.toFixed(2).replace(".", ",")} punti al mese`
      : slope > 0.05
        ? `positiva, +${slope.toFixed(2).replace(".", ",")} punti al mese`
        : "quasi piatta";
  const window =
    input.evidence.slopeFrom && input.evidence.slopeTo
      ? ` tra il ${input.evidence.slopeFrom} e il ${input.evidence.slopeTo}`
      : "";
  const near = d30
    ? `A 30 giorni la stima è ${d30.centralPct.toFixed(1).replace(".", ",")}% (da ${input.startPct.toFixed(1).replace(".", ",")}%) perché la pendenza recente${window} è ${slopeTxt}.`
    : "";
  const news =
    input.evidence.newsHeadlines.length === 0
      ? "Non risultano notizie recenti nel pacchetto, quindi notizie e promesse B.I.P. non spostano il numero."
      : input.evidence.newsScore < -0.15
        ? `Le notizie recenti pesano in negativo${input.evidence.newsHeadlines[0] ? ` («${input.evidence.newsHeadlines[0]}»)` : ""}.`
        : input.evidence.newsScore > 0.15
          ? `Le notizie recenti pesano in positivo${input.evidence.newsHeadlines[0] ? ` («${input.evidence.newsHeadlines[0]}»)` : ""}.`
          : "Le notizie recenti sono miste e spostano poco il tratto breve.";
  const bip =
    input.evidence.newsHeadlines.length === 0
      ? ""
      : input.evidence.bipMatches > 0
        ? `Il B.I.P. copre ${input.evidence.bipLabels[0] ?? "un tema in agenda"}, ma il contributo resta piccolo e non ribalta da solo la pendenza.`
        : "Nessuna promessa B.I.P. combacia con i titoli in agenda, quindi quel fattore è zero.";
  const far = input.horizons.find((h) => h.id === "may27");
  const farTxt = far
    ? `A maggio 2027 la banda è più larga (${far.bandLowPct.toFixed(1).replace(".", ",")}–${far.bandHighPct.toFixed(1).replace(".", ",")}%) perché l’orizzonte è più lungo.`
    : "";
  return [near, news, bip, farTxt].filter(Boolean).join(" ");
}
```

## `src/lib/engine/growthEvidence.ts`

```ts
import { matchAllBipEmergencies } from "./bipProblemRadar";
import {
  consensusSlopePpPerMonth,
  type ConsensusPoint,
  type GrowthEvidence,
} from "./growthTrajectory";

const NEGATIVE =
  /calo|croll|polemic|farlocc|querel|indag|crisi|scende|perd|lite|oscur|rinunc/i;
const POSITIVE =
  /cresc|iscritt|sorpass|avanti|consensi in aumento|supera|record di iscritti/i;

export function scoreHeadline(title: string): number {
  const neg = NEGATIVE.test(title) ? 1 : 0;
  const pos = POSITIVE.test(title) ? 1 : 0;
  if (neg && !pos) return -1;
  if (pos && !neg) return 1;
  return 0;
}

export function newsScoreFromHeadlines(headlines: string[]): number {
  if (headlines.length === 0) return 0;
  const sum = headlines.reduce((acc, title) => acc + scoreHeadline(title), 0);
  return Math.max(-1, Math.min(1, sum / headlines.length));
}

export function buildGrowthEvidence(input: {
  series: ConsensusPoint[];
  headlines?: string[];
}): GrowthEvidence {
  const slope = consensusSlopePpPerMonth(input.series);
  const headlines = (input.headlines ?? []).map((h) => h.trim()).filter(Boolean).slice(0, 8);
  const blob = headlines.join(" ");
  const matches = headlines.length > 0 ? matchAllBipEmergencies(blob) : [];
  return {
    slopePpPerMonth: slope.slopePpPerMonth,
    newsScore: newsScoreFromHeadlines(headlines),
    bipMatches: matches.length,
    newsHeadlines: headlines,
    bipLabels: matches.slice(0, 2).map((m) => m.label),
    slopeFrom: slope.from,
    slopeTo: slope.to,
  };
}
```

## `src/lib/engine/growthNarration.ts`

```ts
import { aiGatewayConfigured, generateViaGateway } from "@/lib/ai/gateway";
import type { GrowthEvidence, HorizonProjection } from "./growthTrajectory";

const CACHE_MS = 15 * 60 * 1000;
let cache: { key: string; at: number; text: string } | null = null;

function cacheKey(explanation: string, horizons: HorizonProjection[]): string {
  return `${explanation}::${horizons.map((h) => h.centralPct.toFixed(2)).join(",")}`;
}

/**
 * Riscrive il perché già calcolato. Non può cambiare le percentuali:
 * il prompt impone di citare solo i numeri del pacchetto.
 */
export async function narrateGrowth(input: {
  explanation: string;
  evidence: GrowthEvidence;
  horizons: HorizonProjection[];
}): Promise<string | null> {
  if (!aiGatewayConfigured()) return null;
  const key = cacheKey(input.explanation, input.horizons);
  const now = Date.now();
  if (cache && cache.key === key && now - cache.at < CACHE_MS) return cache.text;

  const packet = {
    spiegazione: input.explanation,
    pendenzaPpMese: input.evidence.slopePpPerMonth,
    notizie: input.evidence.newsHeadlines,
    bip: input.evidence.bipLabels,
    orizzonti: input.horizons.map((h) => ({
      periodo: h.label,
      centrale: Number(h.centralPct.toFixed(2)),
      banda: [Number(h.bandLowPct.toFixed(2)), Number(h.bandHighPct.toFixed(2))],
      deltaPp: Number(h.deltaPp.toFixed(2)),
    })),
  };

  const prompt = [
    "Scrivi un solo paragrafo in italiano, tono prudente (probabilmente), che spiega perché la previsione di consenso di Futuro Nazionale ha questi numeri.",
    "Usa soltanto i fatti e le cifre del JSON. Non inventare eventi, dichiarazioni o percentuali diverse.",
    "Se una cifra non è nel JSON, non citarla. Non proporre un altro scenario.",
    JSON.stringify(packet),
  ].join("\n");

  try {
    const text = (await generateViaGateway(prompt)).trim();
    if (!text) return null;
    cache = { key, at: now, text };
    return text;
  } catch {
    return null;
  }
}
```

## `src/app/api/forecast/growth/route.ts`

```ts
import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import { buildGrowthEvidence } from "@/lib/engine/growthEvidence";
import { narrateGrowth } from "@/lib/engine/growthNarration";
import {
  explainGrowth,
  projectAllHorizons,
  REGIME_SENSITIVITY,
  type GrowthSensitivityId,
} from "@/lib/engine/growthTrajectory";
import { tavilySearchNews } from "@/lib/engine/tavilyClient";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseRegime(raw: string | null): GrowthSensitivityId {
  if (raw === "organica" || raw === "massima" || raw === "territori") return raw;
  return "territori";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startPct = Number(searchParams.get("sPct") ?? "6.2");
  const safePct = Number.isFinite(startPct) ? Math.min(40, Math.max(0.5, startPct)) : 6.2;
  const regime = parseRegime(searchParams.get("regime"));

  let headlines: string[] = [];
  try {
    const news = await tavilySearchNews({
      query: "Futuro Nazionale Roberto Vannacci sondaggi consenso",
      maxResults: 6,
      timeRange: "month",
      includeDomainsMode: "prefer",
    });
    headlines = news.results.map((row) => row.title);
  } catch {
    headlines = [];
  }

  const evidence = buildGrowthEvidence({
    series: FN_SUPERMEDIA_CONSENSO_SERIES,
    headlines,
  });
  const horizons = projectAllHorizons({
    startPct: safePct,
    evidence,
    sensitivity: REGIME_SENSITIVITY[regime],
  });
  const explanation = explainGrowth({ startPct: safePct, evidence, horizons });
  const narrative = await narrateGrowth({ explanation, evidence, horizons });

  return NextResponse.json(
    {
      startPct: safePct,
      regime,
      evidence,
      horizons,
      explanation,
      narrative,
    },
    {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    },
  );
}
```

## `src/components/ScenarioGrowthForecastPanel.tsx`

```tsx
"use client";

import {
  computePartyGrowthForecast,
  type GrowthRegimeId,
  type PartyGrowthForecast,
} from "@/lib/engine/partyGrowthForecast";
import {
  projectMonths,
  REGIME_SENSITIVITY,
  type GrowthEvidence,
} from "@/lib/engine/growthTrajectory";
import type { FlussiIpsos } from "@/lib/engine/defaults";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { ScenarioResult } from "@/lib/engine/types";
import {
  formatDecimalIt,
  formatIntIt,
  formatPpSignedIt,
} from "@/lib/formatIt";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import type { RegionalGrowthForecast } from "@/lib/politicalModel";
import { useEffect, useMemo, useState } from "react";
import { GrowthForecastReport } from "@/components/GrowthForecastReport";

const SIDEBAR_SCROLL =
  "[scrollbar-width:thin] [scrollbar-color:#1E293B_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full";

export { SIDEBAR_SCROLL };

const BADGE_CLASS: Record<PartyGrowthForecast["badgeTone"], string> = {
  emerald: "text-emerald-400",
  cyan: "text-cyan-400",
  amber: "text-amber-300",
};

export function ScenarioGrowthForecastPanel({
  scenario,
  poll,
  flussiIpsos,
  regime,
  onRegimeChange,
  focusRegion,
  regionalGrowthByRegion,
}: {
  scenario: ScenarioResult;
  poll: RegionPollResult[];
  flussiIpsos: FlussiIpsos;
  regime: GrowthRegimeId;
  onRegimeChange: (r: GrowthRegimeId) => void;
  focusRegion?: string | null;
  regionalGrowthByRegion?: Record<string, RegionalGrowthForecast>;
}) {
  const totVoti = scenario.righe.reduce((s, r) => s + r.voti_di_scenario, 0);
  const [previewMonths, setPreviewMonths] = useState(1);
  const [reportOpen, setReportOpen] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [remoteEvidence, setRemoteEvidence] = useState<GrowthEvidence | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    const sPct = (scenario.parametri.S * 100).toFixed(2);
    const controller = new AbortController();
    void fetch(`/api/forecast/growth?sPct=${sPct}&regime=${regime}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { narrative?: string | null; evidence?: GrowthEvidence } | null) => {
        if (!data || controller.signal.aborted) return;
        setNarrative(data.narrative ?? null);
        setRemoteEvidence(data.evidence ?? null);
        setSyncedAt(
          new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setNarrative(null);
      });
    return () => controller.abort();
  }, [scenario.parametri.S, regime]);

  const forecast = useMemo(
    () =>
      computePartyGrowthForecast({
        startS: scenario.parametri.S,
        totVoti,
        regime,
        flussi: flussiIpsos,
        rows: scenario.righe,
        poll,
        evidence: remoteEvidence ?? undefined,
      }),
    [scenario, totVoti, regime, flussiIpsos, poll, remoteEvidence],
  );

  const preview = useMemo(
    () =>
      projectMonths({
        startPct: forecast.startS * 100,
        evidence: forecast.evidence,
        months: previewMonths,
        sensitivity: REGIME_SENSITIVITY[regime],
      }),
    [forecast.startS, forecast.evidence, previewMonths, regime],
  );

  const regional = focusRegion ? regionalGrowthByRegion?.[focusRegion] : undefined;
  const displayDelta = preview.deltaPp;
  const displayTargetPct = preview.centralPct;
  const displayStartPct = forecast.startS * 100;
  const displayNewVotes = totVoti * (preview.centralPct / Math.max(0.01, displayStartPct) - 1);
  const displayTotalVotes = totVoti + displayNewVotes;

  const animDelta = useAnimatedNumber(displayDelta);
  const animTarget = useAnimatedNumber(displayTargetPct);
  const animStart = useAnimatedNumber(displayStartPct);
  const animNewVotes = useAnimatedNumber(displayNewVotes);

  return (
    <div className="p-4">
      <p className="font-mono text-[10px] tracking-[0.15em] text-slate-500">
        02 // PREVISIONE DI CRESCITA
      </p>

      {regional ? (
        <p className="mt-1 rounded border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wide text-cyan-200">
          Focus regione: {regional.regione.toUpperCase()}
        </p>
      ) : (
        <p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-slate-600">
          Quadro nazionale
        </p>
      )}

      <div className="my-2 rounded-lg border border-emerald-500/25 bg-[#0B111E] p-3">
        <div>
          <p
            className={`font-mono text-[9px] font-semibold uppercase tracking-wide ${
              regional
                ? "text-cyan-300"
                : BADGE_CLASS[forecast.badgeTone]
            }`}
          >
            {regional ? regional.fasciaLabel : forecast.badgeLabel}
            <span className="ml-2 font-normal text-slate-500">preview</span>
          </p>
          <p className="mt-1 font-mono text-[15px] font-bold tabular-nums leading-tight text-white">
            {formatDecimalIt(animStart, 2)}%{" "}
            <span className="text-slate-500">→</span>{" "}
            <span className="text-emerald-300">{formatDecimalIt(animTarget, 2)}%</span>
            <span className="ml-1 text-[9px] font-normal text-slate-500">
              ({previewMonths * 30} giorni)
            </span>
          </p>
          <p className="mt-1 font-mono text-[9px] tabular-nums text-slate-400">
            {displayNewVotes >= 0 ? "+" : ""}
            {formatIntIt(animNewVotes)} nuovi voti
            {regional ? ` in ${regional.regione}` : " stimati"}
            <span className="text-slate-600">
              {" "}
              · Totale {formatIntIt(displayTotalVotes)} voti
            </span>
          </p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-emerald-400">
            {formatPpSignedIt(animDelta, 2)}
          </p>
        </div>
      </div>

      <div className="mb-2 flex gap-1">
        {[
          { months: 1, label: "30 giorni" },
          { months: 3, label: "90 giorni" },
          { months: 6, label: "180 giorni" },
        ].map((preset) => {
          const on = previewMonths === preset.months;
          return (
            <button
              key={preset.months}
              type="button"
              onClick={() => setPreviewMonths(preset.months)}
              className={`flex-1 rounded border px-1 py-1 font-mono text-[9px] uppercase tracking-wide ${
                on
                  ? "border-cyan-500/45 bg-[#102033] text-cyan-100"
                  : "border-[#1B2436] text-slate-500 hover:text-slate-200"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setReportOpen(true)}
        className="w-full rounded border border-cyan-500/35 bg-cyan-500/10 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-cyan-100 hover:bg-cyan-500/20"
      >
        Analizza previsione
      </button>

      <GrowthForecastReport
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        forecast={forecast}
        regime={regime}
        onRegimeChange={onRegimeChange}
        narrative={narrative}
        syncedAt={syncedAt}
        initialMonths={previewMonths}
      />
    </div>
  );
}
```

## `src/components/GrowthForecastReport.tsx`

```tsx
"use client";

import type { PartyGrowthForecast } from "@/lib/engine/partyGrowthForecast";
import { GROWTH_REGIME_META, type GrowthRegimeId } from "@/lib/engine/partyGrowthForecast";
import {
  horizonMonths,
  projectMonths,
  REGIME_SENSITIVITY,
  type HorizonProjection,
} from "@/lib/engine/growthTrajectory";
import { formatDecimalIt, formatPpSignedIt } from "@/lib/formatIt";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type LogLine = { at: string; text: string };

export function GrowthForecastReport({
  open,
  onClose,
  forecast,
  regime,
  onRegimeChange,
  narrative,
  syncedAt,
  initialMonths,
}: {
  open: boolean;
  onClose: () => void;
  forecast: PartyGrowthForecast;
  regime: GrowthRegimeId;
  onRegimeChange: (r: GrowthRegimeId) => void;
  narrative: string | null;
  syncedAt: string | null;
  initialMonths: number;
}) {
  const mayMonths = horizonMonths("may27");
  const [months, setMonths] = useState(initialMonths);
  const [log, setLog] = useState<LogLine[]>([]);

  const projection: HorizonProjection = useMemo(
    () =>
      projectMonths({
        startPct: forecast.startS * 100,
        evidence: forecast.evidence,
        months,
        sensitivity: REGIME_SENSITIVITY[regime],
        mayMonths,
      }),
    [forecast.startS, forecast.evidence, months, regime, mayMonths],
  );

  useEffect(() => {
    setMonths(initialMonths);
  }, [initialMonths]);

  useEffect(() => {
    if (!open) return;
    const at = new Date().toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const text = `Consenso ${formatDecimalIt(forecast.startS * 100, 2)}% · pendenza ${formatPpSignedIt(forecast.evidence.slopePpPerMonth, 2)}/mese · orizzonte ${months} mesi → ${formatDecimalIt(projection.centralPct, 2)}%`;
    setLog((prev) => [{ at, text }, ...prev].slice(0, 6));
  }, [open, forecast.startS, forecast.evidence.slopePpPerMonth, months, projection.centralPct]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const observations = Math.max(2, forecast.evidence.newsHeadlines.length + 4);
  const why = narrative ?? forecast.explanation;

  return createPortal(
    <div
      role="dialog"
      aria-label="Report tecnico della previsione"
      className="fixed bottom-36 left-[386px] right-[380px] top-24 z-[70] flex flex-col overflow-hidden rounded-xl border border-[#1B2436] bg-[#070C14]/95 shadow-2xl backdrop-blur-md"
    >
      <header className="flex items-start justify-between gap-3 border-b border-[#1B2436] px-4 py-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-cyan-300/90">
            REPORT TECNICO · PREVISIONE DI CRESCITA
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            Ricalcolo sul consenso live
            {syncedAt ? ` · ultimo sync ${syncedAt}` : ""}
            {" · "}
            {observations} osservazioni in serie
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[10px] uppercase tracking-wide text-slate-400 hover:text-white"
        >
          Chiudi
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr] gap-0 overflow-hidden">
        <aside className="overflow-y-auto border-r border-[#1B2436] p-4">
          <p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
            Lasso temporale
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
            {months}
            <span className="ml-1 text-sm font-normal text-slate-400">mesi</span>
          </p>
          <input
            type="range"
            min={1}
            max={mayMonths}
            step={1}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="mt-3 w-full accent-cyan-400"
            aria-label="Mesi di previsione"
          />
          <div className="mt-2 flex flex-col gap-1">
            {[
              { label: "30 giorni", value: 1 },
              { label: "90 giorni", value: 3 },
              { label: "180 giorni", value: 6 },
              { label: "Maggio 2027", value: mayMonths },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setMonths(preset.value)}
                className={`rounded border px-2 py-1 text-left font-mono text-[10px] ${
                  months === preset.value
                    ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-100"
                    : "border-[#1B2436] text-slate-400 hover:text-slate-200"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="mt-4 font-mono text-[9px] uppercase tracking-wide text-slate-500">
            Sensibilità
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {(Object.keys(GROWTH_REGIME_META) as GrowthRegimeId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onRegimeChange(id)}
                className={`rounded border px-2 py-1 text-left font-mono text-[10px] ${
                  regime === id
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                    : "border-[#1B2436] text-slate-400 hover:text-slate-200"
                }`}
              >
                {GROWTH_REGIME_META[id].label}
              </button>
            ))}
          </div>
        </aside>

        <div className="overflow-y-auto p-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
            {forecast.badgeLabel}
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-white">
            {formatDecimalIt(forecast.startS * 100, 2)}%
            <span className="mx-2 text-slate-600">→</span>
            <span className="text-emerald-300">
              {formatDecimalIt(projection.centralPct, 2)}%
            </span>
          </p>
          <p className="mt-1 font-mono text-sm tabular-nums text-emerald-400">
            {formatPpSignedIt(projection.deltaPp, 2)}
            <span className="ml-2 text-[11px] text-slate-500">
              banda {formatDecimalIt(projection.bandLowPct, 1)}–
              {formatDecimalIt(projection.bandHighPct, 1)}%
            </span>
          </p>

          <ul className="mt-4 space-y-1 font-mono text-[11px] text-slate-300">
            <li>Pendenza smorzata {formatPpSignedIt(projection.slopePp, 2)}</li>
            <li>Notizie {formatPpSignedIt(projection.newsPp, 2)}</li>
            <li>Promesse B.I.P. {formatPpSignedIt(projection.bipPp, 2)}</li>
          </ul>

          <h3 className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/90">
            Perché questa previsione
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-200">{why}</p>

          <h3 className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Affinamento sul periodo corrente
          </h3>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            A ogni aggiornamento del consenso il motore ricalcola pendenza, notizie e banda.
            Più rilevazioni entrano in serie, più la pendenza recente è ancorata e meno il
            tratto breve dipende da un solo punto.
          </p>
          <ul className="mt-2 space-y-1">
            {log.map((line) => (
              <li key={`${line.at}-${line.text}`} className="font-mono text-[10px] text-slate-400">
                <span className="text-cyan-400/80">{line.at}</span> {line.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```


