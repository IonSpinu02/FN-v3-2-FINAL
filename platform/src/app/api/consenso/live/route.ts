import {
  CONSENSO_LIVE_SNAPSHOT_KEY,
  loadConsensoLiveContextFromSeed,
  type ConsensoLiveContext,
} from "@/lib/engine/consensoLiveContext";
import {
  buildLiveConsensoPayload,
  type LiveConsensoMode,
} from "@/lib/engine/liveConsensoService";
import { buildConsensoDailyTimeline } from "@/lib/engine/consensoDailyTimeline";
import { normalizeToUtcNoon } from "@/lib/engine/fnNationalAggregate";
import { getStaleOrFresh } from "@/lib/db/domainCacheRepository";
import { getPublishedState } from "@/lib/db/publishedStateRepository";
import {
  ifNoneMatchHit,
  jsonWithEtag,
  notModifiedResponse,
  publishedEtag,
} from "@/lib/api/etagRead";
import { logStructured } from "@/lib/observability/logger";
import { consensoLiveContextSchema } from "@/lib/ingestion/validators";

export const dynamic = "force-dynamic";

function parseMode(raw: string | null): LiveConsensoMode {
  if (raw === "aggregate" || raw === "supermedia" || raw === "auto") return raw;
  return "auto";
}

function parseAsOf(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const d = normalizeToUtcNoon(new Date(`${raw.slice(0, 10)}T12:00:00.000Z`));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function readConsensoContext(): Promise<ConsensoLiveContext> {
  const row = await getStaleOrFresh<ConsensoLiveContext>(CONSENSO_LIVE_SNAPSHOT_KEY);
  if (row?.entry.payload) {
    const parsed = consensoLiveContextSchema.safeParse(row.entry.payload);
    if (parsed.success) return parsed.data;
  }
  return loadConsensoLiveContextFromSeed();
}

export async function GET(req: Request) {
  const started = Date.now();
  const published = await getPublishedState("consenso");
  const etag = publishedEtag(published);
  if (ifNoneMatchHit(req, etag)) {
    return notModifiedResponse(etag);
  }

  const { searchParams } = new URL(req.url);
  const mode = parseMode(searchParams.get("mode"));
  const asOf = parseAsOf(searchParams.get("asOf"));
  const ctx = await readConsensoContext();

  let dailyDeltaPp: number | null = null;
  if (asOf == null) {
    const ref = normalizeToUtcNoon(new Date());
    const timeline = buildConsensoDailyTimeline({
      mode,
      asOf: ref,
      days: 2,
      pollReleases: ctx.pollReleases,
      supermediaSeries: ctx.supermediaSeries,
    });
    if (timeline.length >= 2) {
      dailyDeltaPp =
        Math.round(
          (timeline[timeline.length - 1]!.sPct - timeline[timeline.length - 2]!.sPct) *
            10,
        ) / 10;
    }
  }

  const payload = buildLiveConsensoPayload(mode, {
    asOf,
    pollReleases: ctx.pollReleases,
    supermediaSeries: ctx.supermediaSeries,
    feedSyncedAt: ctx.feedSyncedAt,
    dailyDeltaPp,
  });

  logStructured({
    event: "read_consenso_live",
    domain: "consenso",
    durationMs: Date.now() - started,
  });

  return jsonWithEtag(payload, etag, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}