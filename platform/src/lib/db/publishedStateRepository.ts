import { eq, sql } from "drizzle-orm";
import { sha256Hex } from "@/lib/engine/sha256Canonical";
import { getDb, isDbConfigured } from "./client";
import { publishedState } from "./schema";

export type PublishedDomain = "consenso" | "news" | "supervision" | "locali";

export type PublishedStateRow = {
  domain: PublishedDomain;
  version: number;
  computationId: string | null;
  etag: string;
  updatedAt: number;
};

const tableState = globalThis as typeof globalThis & {
  __fnPublishedStateTableReady?: Promise<boolean>;
};

function ensureTable(): Promise<boolean> {
  const db = getDb();
  if (!db) return Promise.resolve(false);
  tableState.__fnPublishedStateTableReady ??= db
    .execute(sql`
      CREATE TABLE IF NOT EXISTS published_state (
        domain text PRIMARY KEY,
        version bigint NOT NULL DEFAULT 1,
        computation_id text,
        etag text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `)
    .then(
      () => true,
      () => {
        tableState.__fnPublishedStateTableReady = undefined;
        return false;
      },
    );
  return tableState.__fnPublishedStateTableReady;
}

export function formatEtag(version: number, digest: string): string {
  const short = digest.replace(/[^a-f0-9]/gi, "").slice(0, 12) || "0";
  return `"fn-${version}-${short}"`;
}

export async function getPublishedState(
  domain: PublishedDomain,
): Promise<PublishedStateRow | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  if (!db || !(await ensureTable())) return null;
  try {
    const rows = await db
      .select()
      .from(publishedState)
      .where(eq(publishedState.domain, domain))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      domain: row.domain as PublishedDomain,
      version: Number(row.version),
      computationId: row.computationId ?? null,
      etag: row.etag,
      updatedAt: row.updatedAt.getTime(),
    };
  } catch {
    return null;
  }
}

export type PublishedStateLight = {
  domain: PublishedDomain;
  version: number;
  computationId: string | null;
  updatedAt: number;
};

const ALL_DOMAINS: PublishedDomain[] = [
  "consenso",
  "news",
  "supervision",
  "locali",
];

export async function listPublishedStatesLight(): Promise<PublishedStateLight[]> {
  if (!isDbConfigured()) {
    return ALL_DOMAINS.map((domain) => ({
      domain,
      version: 0,
      computationId: null,
      updatedAt: 0,
    }));
  }
  const db = getDb();
  if (!db || !(await ensureTable())) {
    return ALL_DOMAINS.map((domain) => ({
      domain,
      version: 0,
      computationId: null,
      updatedAt: 0,
    }));
  }
  try {
    const rows = await db
      .select({
        domain: publishedState.domain,
        version: publishedState.version,
        computationId: publishedState.computationId,
        updatedAt: publishedState.updatedAt,
      })
      .from(publishedState);

    const byDomain = new Map<string, PublishedStateLight>();
    for (const row of rows) {
      byDomain.set(row.domain, {
        domain: row.domain as PublishedDomain,
        version: Number(row.version),
        computationId: row.computationId ?? null,
        updatedAt: row.updatedAt.getTime(),
      });
    }
    return ALL_DOMAINS.map(
      (domain) =>
        byDomain.get(domain) ?? {
          domain,
          version: 0,
          computationId: null,
          updatedAt: 0,
        },
    );
  } catch {
    return ALL_DOMAINS.map((domain) => ({
      domain,
      version: 0,
      computationId: null,
      updatedAt: 0,
    }));
  }
}

/** Bump leggero dopo mutazioni API (senza ridefinire digest contenuto). */
export async function touchPublishedDomain(
  domain: PublishedDomain,
  computationId?: string | null,
): Promise<void> {
  const seed = `${domain}:${Date.now()}:${computationId ?? "mutation"}`;
  await bumpPublishedState({
    domain,
    computationId: computationId ?? `mutation-${Date.now()}`,
    digest: sha256Hex(seed),
  });
}

export async function bumpPublishedState(input: {
  domain: PublishedDomain;
  computationId?: string | null;
  digest: string;
}): Promise<PublishedStateRow | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  if (!db || !(await ensureTable())) return null;

  try {
    const existing = await getPublishedState(input.domain);
    const nextVersion = (existing?.version ?? 0) + 1;
    const etag = formatEtag(nextVersion, input.digest);
    const computationId = input.computationId ?? null;

    await db
      .insert(publishedState)
      .values({
        domain: input.domain,
        version: nextVersion,
        computationId,
        etag,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: publishedState.domain,
        set: {
          version: nextVersion,
          computationId,
          etag,
          updatedAt: new Date(),
        },
      });

    return {
      domain: input.domain,
      version: nextVersion,
      computationId,
      etag,
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}