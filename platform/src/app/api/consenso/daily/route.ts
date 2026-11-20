import { resolveConsensoLiveContext } from "@/lib/engine/consensoLiveContext";
import {
  buildConsensoDailyTimeline,
  type DailyConsensoPoint,
} from "@/lib/engine/consensoDailyTimeline";
import {
  buildLiveConsensoPayload,
  type LiveConsensoMode,
} from "@/lib/engine/liveConsensoService";
import { normalizeToUtcNoon } from "@/lib/engine/fnNationalAggregate";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseMode(raw: string | null): LiveConsensoMode {
  if (raw === "aggregate" || raw === "supermedia" || raw === "auto") return raw;
  return "auto";
}

function parseDays(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 90;
  return Math.max(7, Math.min(366, Math.floor(n)));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = parseMode(searchParams.get("mode"));
  const days = parseDays(searchParams.get("days"));
  const ctx = await resolveConsensoLiveContext();
  const asOf = normalizeToUtcNoon(new Date());

  const series: DailyConsensoPoint[] = buildConsensoDailyTimeline({
    mode,
    asOf,
    days,
    pollReleases: ctx.pollReleases,
    supermediaSeries: ctx.supermediaSeries,
  });

  const today = buildLiveConsensoPayload(mode, {
    pollReleases: ctx.pollReleases,
    supermediaSeries: ctx.supermediaSeries,
    feedSyncedAt: ctx.feedSyncedAt,
  });

  return NextResponse.json(
    {
      mode,
      days,
      asOf: asOf.toISOString(),
      feedSyncedAt: ctx.feedSyncedAt,
      today,
      series,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    },
  );
}
