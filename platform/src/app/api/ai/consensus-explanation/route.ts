import { NextResponse } from "next/server";
import { checkRateLimit, withRateLimitOnResponse } from "@/lib/api/rateLimit";
import { requireSession, unauthorizedResponse } from "@/lib/api/requireSession";
import {
  buildConsensusDriversFromLive,
  buildConsensusDriversInput,
  generateConsensusExplanation,
  type ConsensusDriversInput,
  type ConsensusNewsItem,
} from "@/lib/ai/consensusExplanationAgent";
import { resolveConsensoLiveContext } from "@/lib/engine/consensoLiveContext";
import { buildLiveConsensoPayload } from "@/lib/engine/liveConsensoService";
import type { PollRelease } from "@/lib/engine/pollTypes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  drivers?: ConsensusDriversInput;
  forceRefresh?: boolean;
  politicalNews?: ConsensusNewsItem[];
};

async function resolveDrivers(
  politicalNews: ConsensusNewsItem[] = [],
): Promise<{ drivers: ConsensusDriversInput; releases: PollRelease[] }> {
  const ctx = await resolveConsensoLiveContext();
  const releases = ctx.pollReleases ?? [];
  const live = buildLiveConsensoPayload("auto", {
    pollReleases: releases,
    supermediaSeries: ctx.supermediaSeries,
    feedSyncedAt: ctx.feedSyncedAt ?? undefined,
  });
  return {
    drivers: buildConsensusDriversFromLive(live, releases, politicalNews),
    releases,
  };
}

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const rl = await checkRateLimit(req, "ai:consensus-explanation", 20);
  if (!rl.proceed) return rl.response;

  const forceRefresh =
    new URL(req.url).searchParams.get("forceRefresh") === "1";

  try {
    const { drivers } = await resolveDrivers();
    const explanation = await generateConsensusExplanation(drivers, {
      forceRefresh,
    });
    return withRateLimitOnResponse(
      NextResponse.json({
        ok: true,
        explanation,
        drivers,
        cached: explanation.source === "cache",
      }),
      rl.result,
    );
  } catch (err) {
    console.warn("[consensus-explanation GET]", err);
    return NextResponse.json(
      { ok: false, error: "Spiegazione consenso non disponibile" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const rl = await checkRateLimit(req, "ai:consensus-explanation", 20);
  if (!rl.proceed) return rl.response;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON non valido" }, { status: 400 });
  }

  try {
    let drivers = body.drivers;
    if (!drivers) {
      const resolved = await resolveDrivers(body.politicalNews ?? []);
      drivers = resolved.drivers;
    } else if (body.politicalNews?.length) {
      drivers = buildConsensusDriversInput({
        currentConsensus: drivers.currentConsensus,
        previousReferenceValue: drivers.previousReferenceValue,
        previousReferenceDate: drivers.previousReferenceDate,
        deltaPp: drivers.deltaPp,
        supermediaValue: drivers.supermediaValue,
        peakValue: drivers.peakValue,
        peakDate: drivers.peakDate,
        releases: drivers.recentPolls.map((p) => ({
          id: p.id,
          institute: p.institute,
          fieldEnd: p.fieldEnd,
          publishedAt: p.publishedAt,
          fnPct: p.fnPct,
          sourceUrl: p.sourceUrl,
        })),
        politicalNews: body.politicalNews,
      });
    }

    const explanation = await generateConsensusExplanation(drivers, {
      forceRefresh: Boolean(body.forceRefresh),
    });
    return withRateLimitOnResponse(
      NextResponse.json({
        ok: true,
        explanation,
        drivers,
        cached: explanation.source === "cache",
      }),
      rl.result,
    );
  } catch (err) {
    console.warn("[consensus-explanation POST]", err);
    return NextResponse.json(
      { ok: false, error: "Spiegazione consenso non disponibile" },
      { status: 500 },
    );
  }
}
