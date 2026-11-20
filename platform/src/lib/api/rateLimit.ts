import { sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db/client";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export type RateLimitOutcome =
  | { kind: "ok"; result: RateLimitResult }
  | { kind: "unavailable" };

const tableState = globalThis as typeof globalThis & {
  __fnRateLimitTableReady?: Promise<boolean>;
};

const devHits = new Map<string, { n: number; resetAt: number }>();

let pruneCounter = 0;

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

function productionRateLimitBackendConfigured(): boolean {
  return upstashConfigured() || isDbConfigured();
}

function ensureRateLimitTable(): Promise<boolean> {
  const db = getDb();
  if (!db) return Promise.resolve(false);
  tableState.__fnRateLimitTableReady ??= db
    .execute(sql`
      CREATE TABLE IF NOT EXISTS api_rate_limit_hits (
        bucket_key text PRIMARY KEY,
        window_started_at timestamp with time zone NOT NULL,
        hit_count integer NOT NULL DEFAULT 0,
        reset_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS api_rate_limit_hits_reset_at_idx ON api_rate_limit_hits (reset_at);
    `)
    .then(
      () => true,
      () => {
        tableState.__fnRateLimitTableReady = undefined;
        return false;
      },
    );
  return tableState.__fnRateLimitTableReady;
}

/** Rimuove bucket scaduti (batch leggero, idempotente). */
export async function pruneExpiredRateLimitRows(limit = 500): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  if (!db || !(await ensureRateLimitTable())) return 0;
  try {
    const result = await db.execute(sql`
      DELETE FROM api_rate_limit_hits
      WHERE bucket_key IN (
        SELECT bucket_key FROM api_rate_limit_hits
        WHERE reset_at < now() - interval '1 hour'
        LIMIT ${limit}
      )
    `);
    return Number(result.rowCount ?? 0);
  } catch {
    return 0;
  }
}

function maybePruneRateLimitRows(): void {
  pruneCounter += 1;
  if (pruneCounter % 50 !== 0) return;
  void pruneExpiredRateLimitRows();
}

function consumeRateLimitMemory(
  bucketKey: string,
  limit: number,
  windowMs: number,
  now: number,
): RateLimitResult {
  const row = devHits.get(bucketKey);
  if (!row || now > row.resetAt) {
    devHits.set(bucketKey, { n: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (row.n >= limit) {
    return { allowed: false, remaining: 0, resetAt: row.resetAt };
  }
  row.n += 1;
  return { allowed: true, remaining: limit - row.n, resetAt: row.resetAt };
}

async function consumeRateLimitUpstash(
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!baseUrl || !token) return null;

  const key = `fn:rl:${bucketKey}`;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));

  try {
    const res = await fetch(`${baseUrl}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify([
        ["INCR", key],
        ["TTL", key],
      ]),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: unknown[] };
    const count = Number((body.result?.[0] as { result?: unknown })?.result ?? 0);
    let ttl = Number((body.result?.[1] as { result?: unknown })?.result ?? -1);
    if (ttl < 0) {
      await fetch(`${baseUrl}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(["EXPIRE", key, windowSec]),
      });
      ttl = windowSec;
    }
    const resetAt = Date.now() + ttl * 1000;
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  } catch {
    return null;
  }
}

async function consumeRateLimitPostgres(
  bucketKey: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<RateLimitResult | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  if (!db || !(await ensureRateLimitTable())) return null;

  maybePruneRateLimitRows();

  const resetAt = new Date(now + windowMs);
  const windowStartedAt = new Date(now);

  try {
    const rows = await db.execute(sql`
      INSERT INTO api_rate_limit_hits (bucket_key, window_started_at, hit_count, reset_at, updated_at)
      VALUES (${bucketKey}, ${windowStartedAt}, 1, ${resetAt}, now())
      ON CONFLICT (bucket_key) DO UPDATE SET
        hit_count = CASE
          WHEN api_rate_limit_hits.reset_at <= now() THEN 1
          ELSE api_rate_limit_hits.hit_count + 1
        END,
        window_started_at = CASE
          WHEN api_rate_limit_hits.reset_at <= now() THEN ${windowStartedAt}
          ELSE api_rate_limit_hits.window_started_at
        END,
        reset_at = CASE
          WHEN api_rate_limit_hits.reset_at <= now() THEN ${resetAt}
          ELSE api_rate_limit_hits.reset_at
        END,
        updated_at = now()
      RETURNING hit_count, reset_at
    `);

    const row = rows.rows[0] as { hit_count: number; reset_at: Date } | undefined;
    if (!row) return null;
    const hitCount = Number(row.hit_count);
    const resetAtMs = row.reset_at instanceof Date ? row.reset_at.getTime() : resetAt.getTime();
    return {
      allowed: hitCount <= limit,
      remaining: Math.max(0, limit - hitCount),
      resetAt: resetAtMs,
    };
  } catch {
    return null;
  }
}

/** Rate limit distribuito: Upstash → Postgres → RAM solo in dev. */
export async function consumeRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitOutcome> {
  const now = Date.now();

  if (process.env.NODE_ENV === "production" && !productionRateLimitBackendConfigured()) {
    return { kind: "unavailable" };
  }

  const upstash = await consumeRateLimitUpstash(bucketKey, limit, windowMs);
  if (upstash) return { kind: "ok", result: upstash };

  const pg = await consumeRateLimitPostgres(bucketKey, limit, windowMs, now);
  if (pg) return { kind: "ok", result: pg };

  if (process.env.NODE_ENV === "production") {
    return { kind: "unavailable" };
  }
  return {
    kind: "ok",
    result: consumeRateLimitMemory(bucketKey, limit, windowMs, now),
  };
}

export function clientIpFromRequest(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

export function retryAfterSeconds(resetAt: number, now = Date.now()): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

export function applyRateLimitHeaders(
  init: HeadersInit | undefined,
  result: RateLimitResult,
  options?: { limited?: boolean },
): Headers {
  const headers = new Headers(init);
  headers.set(
    "X-RateLimit-Remaining",
    options?.limited ? "0" : String(Math.max(0, result.remaining)),
  );
  if (options?.limited) {
    headers.set("Retry-After", String(retryAfterSeconds(result.resetAt)));
  }
  return headers;
}

export function rateLimitUnavailableResponse(): Response {
  return Response.json(
    { error: "Rate limiter unavailable" },
    { status: 503, headers: { "Content-Type": "application/json" } },
  );
}

export function rateLimitTooManyResponse(
  result: RateLimitResult,
  body: Record<string, unknown> = {
    ok: false,
    error: "Troppe richieste. Riprova tra un minuto.",
  },
): Response {
  const headers = applyRateLimitHeaders(
    { "Content-Type": "application/json" },
    result,
    { limited: true },
  );
  return Response.json(body, { status: 429, headers });
}

export type RateLimitGate =
  | { proceed: true; result: RateLimitResult }
  | { proceed: false; response: Response };

export async function checkRateLimit(
  req: Request,
  routeId: string,
  limit: number,
  windowMs = 60_000,
  tooManyBody?: Record<string, unknown>,
): Promise<RateLimitGate> {
  const ip = clientIpFromRequest(req);
  const outcome = await consumeRateLimit(`${routeId}:${ip}`, limit, windowMs);
  if (outcome.kind === "unavailable") {
    return { proceed: false, response: rateLimitUnavailableResponse() };
  }
  const { result } = outcome;
  if (!result.allowed) {
    return {
      proceed: false,
      response: rateLimitTooManyResponse(result, tooManyBody),
    };
  }
  return { proceed: true, result };
}

/** @deprecated Preferire checkRateLimit + applyRateLimitHeaders */
export async function rateLimitAllowed(
  req: Request,
  routeId: string,
  limit: number,
  windowMs = 60_000,
): Promise<boolean> {
  const gate = await checkRateLimit(req, routeId, limit, windowMs);
  return gate.proceed;
}

export function withRateLimitOnResponse<T extends Response>(
  res: T,
  result: RateLimitResult,
): T {
  applyRateLimitHeaders(res.headers, result).forEach((value, key) => {
    res.headers.set(key, value);
  });
  return res;
}

export function clearRateLimitMemoryForTests(): void {
  devHits.clear();
  pruneCounter = 0;
}