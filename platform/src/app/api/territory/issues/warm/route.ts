import { randomUUID } from "node:crypto";
import {
  authorizeCronRequest,
  isCronSecretConfigured,
} from "@/lib/security/cronAuth";
import { acquireCronLock, releaseCronLock } from "@/lib/db/cronLockRepository";
import { ingestTerritoryDomain } from "@/lib/ingestion/runDomainIngestion";
import { NextResponse } from "next/server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const LOCK_KEY = "cron:territory-warm";
const LOCK_TTL_MS = 10 * 60 * 1000;

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

  const lock = await acquireCronLock(LOCK_KEY, LOCK_TTL_MS);
  if (!lock) {
    return NextResponse.json(
      { ok: false, error: "Warm già in corso", runId },
      { status: 409 },
    );
  }

  try {
    await ingestTerritoryDomain({ runId, triggerType });
    return NextResponse.json({
      ok: true,
      runId,
      at: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Warm radar fallito";
    return NextResponse.json({ error: message, runId }, { status: 500 });
  } finally {
    await releaseCronLock(lock);
  }
}