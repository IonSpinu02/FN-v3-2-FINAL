import { NextResponse } from "next/server";
import { checkRateLimit, withRateLimitOnResponse } from "@/lib/api/rateLimit";
import { requireSession, unauthorizedResponse } from "@/lib/api/requireSession";
import {
  BRIEFING_SCHEMA_VERSION,
  generateForecastBriefing,
  type ForecastBriefing,
} from "@/lib/ai/strategistAgent";
import {
  buildComputationId,
  type ComputationInputSummary,
} from "@/lib/engine/computationFingerprint";
import type {
  ForecastBacktestV4,
  ForecastHorizonKey,
  ForecastNetworkDelta,
  ForecastScenarioId,
  ForecastV4Input,
  ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  v4?: ForecastV4Result;
  v4Input?: ForecastV4Input;
  backtest?: ForecastBacktestV4 | null;
  networkDelta?: ForecastNetworkDelta;
  newsHeadlines?: string[];
  scenario?: ForecastScenarioId;
  horizonKey?: ForecastHorizonKey;
  computationId?: string;
  excludedEntityIds?: string[];
  grievances?: Array<{
    id: string;
    title: string;
    category: TerritoryIssueCategory;
    region: string;
  }>;
  forceRefresh?: boolean;
};

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const rl = await checkRateLimit(req, "ai:forecast-briefing", 12);
  if (!rl.proceed) return rl.response;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON non valido" }, { status: 400 });
  }

  if (!body.v4 || !body.v4Input) {
    return NextResponse.json(
      { ok: false, error: "v4 e v4Input obbligatori" },
      { status: 400 },
    );
  }

  try {
    const { computationId, inputSummary } = buildComputationId({
      v4: body.v4,
      v4Input: body.v4Input,
      networkDelta: body.networkDelta,
      scenarioMode: body.scenario,
      horizonKey: body.horizonKey,
      newsHeadlines: body.newsHeadlines ?? [],
      excludedEntityIds: body.excludedEntityIds,
    });

    const briefing: ForecastBriefing = await generateForecastBriefing(
      {
        v4: body.v4,
        v4Input: body.v4Input,
        backtest: body.backtest ?? null,
        networkDelta: body.networkDelta,
        newsHeadlines: body.newsHeadlines ?? [],
        grievances: body.grievances ?? [],
        scenarioMode: body.scenario,
        horizonKey: body.horizonKey,
        excludedEntityIds: body.excludedEntityIds,
      },
      {
        forceRefresh: Boolean(body.forceRefresh),
        computationId: body.computationId ?? computationId,
      },
    );

    // Garantisce vincolo atomico anche se la cache/LLM omette i campi.
    const bound: ForecastBriefing = {
      ...briefing,
      computationId,
      inputSummary: briefing.inputSummary ?? inputSummary,
      generatedAt: briefing.generatedAt || new Date().toISOString(),
    };

    return withRateLimitOnResponse(
      NextResponse.json({
        ok: true,
        briefing: bound,
        activeComputationId: computationId,
        inputSummary: bound.inputSummary as ComputationInputSummary,
        generatedAt: bound.generatedAt,
        schemaVersion: BRIEFING_SCHEMA_VERSION,
        forceRefresh: Boolean(body.forceRefresh),
      }),
      rl.result,
    );
  } catch (err) {
    console.warn("[forecast-briefing]", err);
    return NextResponse.json(
      { ok: false, error: "Generazione briefing non riuscita" },
      { status: 500 },
    );
  }
}
