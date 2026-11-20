import { eq, sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "./client";
import { domainCache } from "./schema";

export type DomainCacheSourceStatus = {
  usedFallback?: boolean;
  errorMessage?: string | null;
  [key: string]: unknown;
};

export type DomainCacheEntry<T = unknown> = {
  key: string;
  payload: T;
  computedAt: number;
  expiresAt: number | null;
  etag: string | null;
  sourceStatus: DomainCacheSourceStatus | null;
};

const tableState = globalThis as typeof globalThis & {
  __fnDomainCacheTableReady?: Promise<boolean>;
};

function ensureTable(): Promise<boolean> {
  const db = getDb();
  if (!db) return Promise.resolve(false);
  tableState.__fnDomainCacheTableReady ??= db
    .execute(sql`
      CREATE TABLE IF NOT EXISTS domain_cache (
        cache_key text PRIMARY KEY,
        payload_json jsonb NOT NULL,
        computed_at timestamp with time zone NOT NULL,
        expires_at timestamp with time zone,
        etag text,
        source_status jsonb,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS domain_cache_expires_at_idx ON domain_cache (expires_at);
    `)
    .then(
      () => true,
      () => {
        tableState.__fnDomainCacheTableReady = undefined;
        return false;
      },
    );
  return tableState.__fnDomainCacheTableReady;
}

export function isDomainCacheFresh(
  entry: Pick<DomainCacheEntry, "computedAt" | "expiresAt">,
  now = Date.now(),
): boolean {
  if (entry.expiresAt != null && now > entry.expiresAt) return false;
  return true;
}

async function readDomainCacheRow<T = unknown>(
  key: string,
): Promise<DomainCacheEntry<T> | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  if (!db || !(await ensureTable())) return null;
  try {
    const rows = await db
      .select()
      .from(domainCache)
      .where(eq(domainCache.cacheKey, key))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      key: row.cacheKey,
      payload: row.payloadJson as T,
      computedAt: row.computedAt.getTime(),
      expiresAt: row.expiresAt?.getTime() ?? null,
      etag: row.etag ?? null,
      sourceStatus: (row.sourceStatus as DomainCacheSourceStatus | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Lettura solo se non scaduta (TTL rispettato). */
export async function getCache<T = unknown>(
  key: string,
): Promise<DomainCacheEntry<T> | null> {
  const entry = await readDomainCacheRow<T>(key);
  if (!entry || !isDomainCacheFresh(entry)) return null;
  return entry;
}

export const readDomainCacheEntry = getCache;

export type StaleOrFreshCache<T> = {
  entry: DomainCacheEntry<T>;
  stale: boolean;
};

/** Lettura anche oltre `expires_at` (per stale-while-revalidate in Step 2). */
export async function getStaleOrFresh<T = unknown>(
  key: string,
  now = Date.now(),
): Promise<StaleOrFreshCache<T> | null> {
  const entry = await readDomainCacheRow<T>(key);
  if (!entry) return null;
  return {
    entry,
    stale: !isDomainCacheFresh(entry, now),
  };
}

export async function setCache<T = unknown>(
  input: Omit<DomainCacheEntry<T>, "key"> & { key: string },
): Promise<boolean> {
  return writeDomainCacheEntry(input);
}

export async function writeDomainCacheEntry<T = unknown>(
  input: Omit<DomainCacheEntry<T>, "key"> & { key: string },
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  if (!db || !(await ensureTable())) return false;
  const computedAt = new Date(input.computedAt);
  const expiresAt =
    input.expiresAt != null ? new Date(input.expiresAt) : null;
  try {
    await db
      .insert(domainCache)
      .values({
        cacheKey: input.key,
        payloadJson: input.payload,
        computedAt,
        expiresAt,
        etag: input.etag,
        sourceStatus: input.sourceStatus ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: domainCache.cacheKey,
        set: {
          payloadJson: input.payload,
          computedAt,
          expiresAt,
          etag: input.etag,
          sourceStatus: input.sourceStatus ?? null,
          updatedAt: new Date(),
        },
      });
    return true;
  } catch {
    return false;
  }
}

export async function deleteDomainCacheEntry(key: string): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  if (!db || !(await ensureTable())) return;
  try {
    await db.delete(domainCache).where(eq(domainCache.cacheKey, key));
  } catch {
    /* best-effort */
  }
}