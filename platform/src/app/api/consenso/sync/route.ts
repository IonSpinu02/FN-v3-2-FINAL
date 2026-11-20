import { randomUUID } from "node:crypto";
import {
  authorizeCronRequest,
  isCronSecretConfigured,
} from "@/lib/security/cronAuth";
import { acquireCronLock, releaseCronLock } from "@/lib/db/cronLockRepository";
import { ingestConsensoDomain } from "@/lib/ingestion/runDomainIngestion";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LOCK_KEY = "cron:consenso-sync";
const LOCK_TTL_MS = 5 * 60 * 1000;

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
      { ok: false, error: "Sync consenso già in corso", runId },
      { status: 409 },
    );
  }

  try {
    await ingestConsensoDomain({ runId, triggerType });
    return NextResponse.json({ ok: true, runId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync consenso fallito";
    return NextResponse.json({ error: message, runId }, { status: 500 });
  } finally {
    await releaseCronLock(lock);
  }
}