import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { acquireCronLock, releaseCronLock } from "@/lib/db/cronLockRepository";
import {
  authorizeCronRequest,
  isCronSecretConfigured,
} from "@/lib/security/cronAuth";
import {
  ingestConsensoDomain,
  ingestGoogleTrendsSample,
  ingestNewsDomain,
  ingestTerritoryDomain,
} from "@/lib/ingestion/runDomainIngestion";
import { logStructured } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LOCK_KEY = "cron:ingest-domains";
const LOCK_TTL_MS = 8 * 60 * 1000;

export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: auth.error,
        secretConfigured: auth.secretConfigured,
        cronConfigured: isCronSecretConfigured(),
      },
      { status: auth.status },
    );
  }

  const runId = randomUUID();
  const triggerType =
    req.headers.get("x-vercel-cron") != null ? "cron" : "manual";
  const started = Date.now();

  const lock = await acquireCronLock(LOCK_KEY, LOCK_TTL_MS);
  if (!lock) {
    logStructured({
      event: "ingest_domains_skipped",
      runId,
      level: "warn",
      error: "lock held",
    });
    return NextResponse.json(
      { ok: false, error: "Ingestion già in corso", runId },
      { status: 409 },
    );
  }

  try {
    await ingestConsensoDomain({ runId, triggerType });
    await ingestNewsDomain([], { runId, triggerType });
    await ingestTerritoryDomain({ runId, triggerType });
    await ingestGoogleTrendsSample({ runId, triggerType });

    logStructured({
      event: "ingest_domains_complete",
      runId,
      durationMs: Date.now() - started,
    });

    return NextResponse.json({
      ok: true,
      runId,
      durationMs: Date.now() - started,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ingest failed";
    logStructured({
      event: "ingest_domains_error",
      runId,
      durationMs: Date.now() - started,
      level: "error",
      error: message,
    });
    return NextResponse.json({ ok: false, error: message, runId }, { status: 500 });
  } finally {
    await releaseCronLock(lock);
  }
}