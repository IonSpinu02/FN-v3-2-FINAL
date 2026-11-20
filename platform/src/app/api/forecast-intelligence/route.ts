import { promises as fs } from "node:fs";
import path from "node:path";
import { requireSession, unauthorizedResponse } from "@/lib/api/requireSession";
import { NextResponse } from "next/server";
import {
  cacheUsesLocalDisk,
  cacheUsesProcessMemory,
} from "@/lib/cache/cachePolicy";
import {
  readDomainCacheEntry,
  writeDomainCacheEntry,
} from "@/lib/db/domainCacheRepository";
import { getCalibrationMetrics } from "@/lib/engine/forecastCalibrationEngine";
import type {
  ForecastCalibrationMetrics,
  ForecastIntelligencePayload,
  ForecastMonthIntelligence,
} from "@/lib/engine/forecastCalibrationEngine";
import {
  bipCatalogSnapshot,
  buildFallbackForecastIntelligence,
  regionScoresSnapshot,
} from "@/lib/engine/forecastIntelligenceBuild";
import type { GrowthEvidence, HorizonProjection } from "@/lib/engine/growthTrajectory";
import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const CACHE_SCHEMA = "v3-news-politica";
/** Fuori da `.next/` per non far ripartire Turbopack a ogni scrittura. */
const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "forecast-intelligence.json");
const DOMAIN_CACHE_KEY = `ai:forecast-intelligence:${CACHE_SCHEMA}`;

const ANTHROPIC_MODELS = [
  "claude-3-7-sonnet-latest",
  "claude-3-5-sonnet-latest",
] as const;

type CacheEnvelope = {
  at: number;
  fingerprint: string;
  schema?: string;
  payload: ForecastIntelligencePayload;
};

type RequestBody = {
  startPct?: number;
  evidence?: GrowthEvidence;
  projection?: HorizonProjection;
  newsTitles?: string[];
  forceRefresh?: boolean;
  pollSeries?: Array<{ isoDate: string; pct: number }>;
};

let memoryCache: CacheEnvelope | null = null;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fingerprintOf(body: RequestBody): string {
  const monthKeys = body.projection?.timeline?.map((t) => t.monthKey).join("|") ?? "";
  const news = (body.newsTitles ?? body.evidence?.newsHeadlines ?? []).slice(0, 6).join("|");
  return `${round2(body.startPct ?? 0)}|${monthKeys}|${news}`;
}

async function readCache(): Promise<CacheEnvelope | null> {
  if (cacheUsesProcessMemory() && memoryCache?.payload?.months?.length) {
    return memoryCache;
  }

  const row = await readDomainCacheEntry<CacheEnvelope>(DOMAIN_CACHE_KEY);
  if (row?.payload?.payload?.months?.length) {
    if (cacheUsesProcessMemory()) memoryCache = row.payload;
    return row.payload;
  }

  if (cacheUsesLocalDisk()) {
    try {
      const raw = await fs.readFile(CACHE_FILE, "utf8");
      const parsed = JSON.parse(raw) as CacheEnvelope;
      if (parsed?.payload?.months?.length) {
        if (cacheUsesProcessMemory()) memoryCache = parsed;
        return parsed;
      }
    } catch {
      /* miss */
    }
  }
  return null;
}

async function writeCache(envelope: CacheEnvelope): Promise<void> {
  if (cacheUsesProcessMemory()) memoryCache = envelope;
  await writeDomainCacheEntry({
    key: DOMAIN_CACHE_KEY,
    payload: envelope,
    computedAt: envelope.at,
    expiresAt: envelope.at + CACHE_TTL_MS,
    etag: envelope.fingerprint,
    sourceStatus: null,
  });
  if (!cacheUsesLocalDisk()) return;
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    try {
      const existing = await fs.readFile(CACHE_FILE, "utf8");
      const prev = JSON.parse(existing) as CacheEnvelope;
      if (
        prev.fingerprint === envelope.fingerprint &&
        prev.schema === envelope.schema &&
        Date.now() - prev.at < CACHE_TTL_MS
      ) {
        return;
      }
    } catch {
      /* create */
    }
    await fs.writeFile(CACHE_FILE, JSON.stringify(envelope), "utf8");
  } catch {
    /* best-effort dev */
  }
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? text.trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON non trovato nella risposta Claude");
  return JSON.parse(candidate.slice(start, end + 1));
}

function isForbiddenTemplate(text: string): boolean {
  return (
    /Incalzare il Governo sul tema\s*«/i.test(text) ||
    /Futuro Nazionale chiede atti concreti\s*:/i.test(text) ||
    /Su\s*«[^»]+»\s*Futuro Nazionale chiede/i.test(text)
  );
}

function normalizeMonth(
  raw: Partial<ForecastMonthIntelligence> & { monthKey?: string },
  fallback: ForecastMonthIntelligence,
): ForecastMonthIntelligence {
  const drivers = Array.isArray(raw.whyItMoves?.newsOrWebDrivers)
    ? raw.whyItMoves!.newsOrWebDrivers.slice(0, 2).map((d) => ({
        title: String(d?.title ?? "Evento web"),
        source: String(d?.source ?? "Web"),
        impactPp: clamp(round2(Number(d?.impactPp) || 0), -0.15, 0.2),
        whyItMatters: String(d?.whyItMatters ?? "Rilevanza per l'agenda FN."),
      }))
    : fallback.whyItMoves.newsOrWebDrivers;

  const movesRaw = Array.isArray(raw.actionPlan?.moves) ? raw.actionPlan!.moves : [];
  const movesCandidate =
    movesRaw.length >= 3 ? movesRaw.slice(0, 3).map(String) : fallback.actionPlan.moves;
  const moves = movesCandidate.some(isForbiddenTemplate)
    ? fallback.actionPlan.moves
    : movesCandidate;

  const levers = Array.isArray(raw.bipResponse?.levers)
    ? raw.bipResponse!.levers.slice(0, 2).map((l) => ({
        category: String(l?.category ?? "B.I.P."),
        title: String(l?.title ?? "Misura"),
        concreteMeasure: String(l?.concreteMeasure ?? ""),
      }))
    : fallback.bipResponse.levers;

  const targets = Array.isArray(raw.bipResponse?.targetRegions)
    ? raw.bipResponse!.targetRegions.slice(0, 3).map((t) => ({
        region: String(t?.region ?? "Lombardia"),
        cdxPct: round2(Number(t?.cdxPct) || 0),
      }))
    : fallback.bipResponse.targetRegions;

  return {
    monthKey: String(raw.monthKey ?? fallback.monthKey),
    monthShort: String(raw.monthShort ?? fallback.monthShort),
    eventTitle: String(raw.eventTitle ?? fallback.eventTitle),
    calendarImpactPp: clamp(
      round2(Number(raw.calendarImpactPp ?? fallback.calendarImpactPp) || 0),
      -0.15,
      0.2,
    ),
    whyItMoves: {
      inertiaExplanation: String(
        raw.whyItMoves?.inertiaExplanation ?? fallback.whyItMoves.inertiaExplanation,
      ),
      calendarExplanation: String(
        raw.whyItMoves?.calendarExplanation ?? fallback.whyItMoves.calendarExplanation,
      ),
      newsOrWebDrivers: drivers.length ? drivers : fallback.whyItMoves.newsOrWebDrivers,
    },
    actionPlan: {
      conflictTitle: String(
        raw.actionPlan?.conflictTitle ?? fallback.actionPlan.conflictTitle,
      ),
      strategicSummary: String(
        raw.actionPlan?.strategicSummary ?? fallback.actionPlan.strategicSummary,
      ),
      triggerCondition: String(
        raw.actionPlan?.triggerCondition ?? fallback.actionPlan.triggerCondition,
      ),
      moves,
    },
    bipResponse: {
      levers: levers.length ? levers : fallback.bipResponse.levers,
      readyStatement: (() => {
        const statement = String(
          raw.bipResponse?.readyStatement ?? fallback.bipResponse.readyStatement,
        );
        return isForbiddenTemplate(statement)
          ? fallback.bipResponse.readyStatement
          : statement;
      })(),
      targetRegions: targets.length ? targets : fallback.bipResponse.targetRegions,
    },
  };
}

function mergeClaudeMonths(
  claudeMonths: unknown,
  fallback: ForecastIntelligencePayload,
): ForecastMonthIntelligence[] {
  const list = Array.isArray(claudeMonths) ? claudeMonths : [];
  return fallback.months.map((fb) => {
    const match =
      list.find(
        (m) =>
          m &&
          typeof m === "object" &&
          String((m as ForecastMonthIntelligence).monthKey) === fb.monthKey,
      ) ?? list[fallback.months.indexOf(fb)];
    if (!match || typeof match !== "object") return fb;
    return normalizeMonth(match as Partial<ForecastMonthIntelligence>, fb);
  });
}

async function callAnthropicWithWebSearch(input: {
  startPct: number;
  evidence: GrowthEvidence;
  projection: HorizonProjection;
  calibration: ForecastCalibrationMetrics;
  newsTitles: string[];
}): Promise<ForecastIntelligencePayload | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const regions = regionScoresSnapshot(input.newsTitles);
  const bip = bipCatalogSnapshot().slice(0, 12);
  const monthKeys = input.projection.timeline.map((t) => ({
    monthKey: t.monthKey,
    monthShort: t.monthShort,
    seedTitle: t.ordinary.title,
    seedWhy: t.ordinary.why,
    seedConflict: t.extraordinary.title,
    seedTrigger: t.extraordinary.triggerCondition,
    seedBip: t.extraordinary.bipLever,
    modelNetPp: t.fullMonthNetPp,
  }));

  const system = `Sei il Motore Predittivo dello staff politico di Futuro Nazionale (Roberto Vannacci).
Usa web_search per trovare eventi istituzionali, scadenze economiche/sociali ed imprevisti reali mese per mese in Italia (Novembre 2026 → Maggio 2027).

DIVIETI ASSOLUTI:
- VIETATO concatenare etichette di calendario (es. «Pausa festiva», «Precampagna sui territori», «Manovra di bilancio») dentro frasi tipo «Incalzare il Governo sul tema «…»» o «Su «…» Futuro Nazionale chiede…».
- VIETATO riusare lo stesso strategicSummary, la stessa mossa TV o gli stessi driver su mesi diversi.
- VIETATO troncare frasi a metà parola nelle leve B.I.P. (niente testi tagliati).
- Ogni mese deve avere driver, summary, trigger, moves, leve e dichiarazione SPECIFICI di quel mese.

Rispondi SOLO con un unico oggetto JSON valido (niente markdown) con esattamente 7 mesi (2026-11 … 2027-05):
{
  "months": [
    {
      "monthKey": "2026-11",
      "monthShort": "NOV '26",
      "eventTitle": "...",
      "calendarImpactPp": 0.05,
      "whyItMoves": {
        "inertiaExplanation": "...",
        "calendarExplanation": "...",
        "newsOrWebDrivers": [
          { "title": "...", "source": "...", "impactPp": 0.02, "whyItMatters": "..." }
        ]
      },
      "actionPlan": {
        "conflictTitle": "...",
        "strategicSummary": "...",
        "triggerCondition": "...",
        "moves": ["1. Attacco politico: ...", "2. Presidio TV & media: ...", "3. Piazze prioritarie: ..."]
      },
      "bipResponse": {
        "levers": [
          { "category": "...", "title": "...", "concreteMeasure": "..." }
        ],
        "readyStatement": "«...»",
        "targetRegions": [{ "region": "Lombardia", "cdxPct": 54 }]
      }
    }
  ]
}
Vincoli: calendarImpactPp/impactPp in [-0.15,+0.20]; 2 newsOrWebDrivers per mese (mai ripetuti tra mesi); 3 moves; 2 levers con concreteMeasure completa; readyStatement tra «…»; italiano staff operativo.`

  const user = JSON.stringify(
    {
      compito: "Scansiona web agenda Italia e genera intelligence mensile FN",
      consensoAttualePct: input.startPct,
      pendenzaPpMese: input.evidence.slopePpPerMonth,
      calibrazione: input.calibration,
      titoliNewsLive: input.newsTitles.slice(0, 8),
      regioni: regions,
      bipCatalog: bip,
      mesiOrizzonte: monthKeys,
    },
    null,
    2,
  );

  let lastError: unknown = null;
  for (const model of ANTHROPIC_MODELS) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          temperature: 0.2,
          system,
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 8,
            },
          ],
          messages: [{ role: "user", content: user }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastError = new Error(`Anthropic ${model} HTTP ${res.status}: ${errText.slice(0, 240)}`);
        continue;
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const textBlocks = (data.content ?? [])
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text!)
        .join("\n");
      if (!textBlocks.trim()) {
        lastError = new Error(`Anthropic ${model}: nessun testo finale`);
        continue;
      }

      const parsed = extractJsonObject(textBlocks) as { months?: unknown };
      const fallback = buildFallbackForecastIntelligence({
        startPct: input.startPct,
        evidence: input.evidence,
        projection: input.projection,
        calibration: input.calibration,
        source: "fallback_model",
      });
      return {
        generatedAt: new Date().toISOString(),
        source: "anthropic_web",
        calibration: input.calibration,
        months: mergeClaudeMonths(parsed.months, fallback),
      };
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) {
    console.warn("[forecast-intelligence] Anthropic fallita:", lastError);
  }
  return null;
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON non valido" }, { status: 400 });
  }

  if (!body.evidence || !body.projection) {
    return NextResponse.json(
      { ok: false, error: "evidence e projection obbligatori" },
      { status: 400 },
    );
  }

  const startPct = Number.isFinite(body.startPct) ? Number(body.startPct) : 0;
  const newsTitles =
    body.newsTitles?.length
      ? body.newsTitles
      : body.evidence.newsHeadlines ?? [];
  const pollSeries =
    body.pollSeries?.length
      ? body.pollSeries
      : FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({ isoDate: p.isoDate, pct: p.pct }));
  const calibration = getCalibrationMetrics(pollSeries);
  const fingerprint = fingerprintOf(body);
  const forceRefresh = Boolean(body.forceRefresh);

  const cached = await readCache();
  if (
    !forceRefresh &&
    cached &&
    cached.schema === CACHE_SCHEMA &&
    cached.fingerprint === fingerprint &&
    Date.now() - cached.at < CACHE_TTL_MS
  ) {
    return NextResponse.json({
      ok: true,
      cached: true,
      latencyHintMs: 0,
      payload: { ...cached.payload, source: "cache" as const },
    });
  }

  const live = await callAnthropicWithWebSearch({
    startPct,
    evidence: body.evidence,
    projection: body.projection,
    calibration,
    newsTitles,
  });

  const payload =
    live ??
    buildFallbackForecastIntelligence({
      startPct,
      evidence: body.evidence,
      projection: body.projection,
      calibration,
      source: "fallback_model",
    });

  await writeCache({ at: Date.now(), fingerprint, schema: CACHE_SCHEMA, payload });

  return NextResponse.json({
    ok: true,
    cached: false,
    usedAnthropic: payload.source === "anthropic_web",
    payload,
  });
}
