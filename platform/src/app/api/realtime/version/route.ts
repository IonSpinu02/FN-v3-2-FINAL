import { ifNoneMatchHit, notModifiedResponse } from "@/lib/api/etagRead";
import { listPublishedStatesLight } from "@/lib/db/publishedStateRepository";
import {
  buildRealtimeVersionPayload,
} from "@/lib/realtime/versionEtag";
import { logStructured } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const started = Date.now();
  const rows = await listPublishedStatesLight();
  const payload = buildRealtimeVersionPayload(rows);
  const etag = payload.compositeEtag;

  if (ifNoneMatchHit(req, etag)) {
    logStructured({
      event: "realtime_version_304",
      durationMs: Date.now() - started,
    });
    return notModifiedResponse(etag);
  }

  logStructured({
    event: "realtime_version_200",
    durationMs: Date.now() - started,
  });

  return Response.json(payload, {
    headers: {
      ETag: etag,
      "Cache-Control": "no-store",
    },
  });
}