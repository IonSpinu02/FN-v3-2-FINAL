import { NextResponse } from "next/server";
import { checkRateLimit, withRateLimitOnResponse } from "@/lib/api/rateLimit";
import { requireSession, unauthorizedResponse } from "@/lib/api/requireSession";
import { generateStrategicRoadmap } from "@/lib/ai/strategicRoadmapAiGenerator";
import { loadDashboardBoot } from "@/lib/engine/dashboardBoot";
import { DEFAULT_FLUSSI_MATRIX_ID, flussiFromMatrix } from "@/lib/engine/flussiMatrices";
import { buildStrategicCommandBrief } from "@/lib/engine/strategicCommandBrief";
import { parseGenerateRoadmapRequest } from "@/lib/strategy/parseGenerateRoadmapRequest";
import { runObiettivoStrategicBackcast } from "@/lib/strategy/strategicObiettivoContext";
import type { ScenarioResult } from "@/lib/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const rl = await checkRateLimit(req, "strategy:generate-roadmap", 8);
  if (!rl.proceed) return rl.response;

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON non valido" }, { status: 400 });
  }

  const parsed = parseGenerateRoadmapRequest(body);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  try {
    const boot = loadDashboardBoot();
  const scenario: ScenarioResult = parsed.liveS
      ? {
          ...boot.initialScenario,
          parametri: { ...boot.initialScenario.parametri, S: parsed.liveS },
        }
      : boot.initialScenario;
    const poll = parsed.regionalPoll ?? [];
    const { plan, forecast, ballots, safeTarget, floor } = runObiettivoStrategicBackcast(
      scenario,
      flussiFromMatrix(DEFAULT_FLUSSI_MATRIX_ID),
      poll,
      parsed.targetPct,
      parsed.horizonDays,
    );
    const brief = buildStrategicCommandBrief(plan, ballots);
    const generated = await generateStrategicRoadmap({
      targetPct: safeTarget,
      horizonDays: parsed.horizonDays,
      strategicFocusNote: parsed.strategicFocusNote,
      backcast: plan,
    });

    return withRateLimitOnResponse(
      NextResponse.json({
        ok: true,
        targetPct: safeTarget,
        horizonDays: parsed.horizonDays,
        strategicFocusNote: parsed.strategicFocusNote ?? null,
        floor,
        ballots,
        plan,
        brief,
        roadmap: generated.roadmap,
        provider: generated.provider,
        usedCombinatorialFallback:
          generated.usedCombinatorialFallback ?? generated.provider === "none",
        v4: {
          startPct: forecast.startPct,
          offensiveCentral: plan.offensiveCentral,
          baseCentral: plan.baseCentral,
          passiveCentral: plan.passiveCentral,
          hi90: plan.offensiveHi90,
        },
      }),
      rl.result,
    );
  } catch (err) {
    console.error("[generate-roadmap]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Generazione non riuscita" },
      { status: 500 },
    );
  }
}
