import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, isDbConfigured } from "./client";

const tableState = globalThis as typeof globalThis & {
  __fnCronLocksTableReady?: Promise<boolean>;
};

function ensureTable(): Promise<boolean> {
  const db = getDb();
  if (!db) return Promise.resolve(false);
  tableState.__fnCronLocksTableReady ??= db
    .execute(sql`
      CREATE TABLE IF NOT EXISTS cron_locks (
        lock_key text PRIMARY KEY,
        owner_id text NOT NULL,
        expires_at timestamptz NOT NULL,
        acquired_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS cron_locks_expires_at_idx ON cron_locks (expires_at);
    `)
    .then(
      () => true,
      () => {
        tableState.__fnCronLocksTableReady = undefined;
        return false;
      },
    );
  return tableState.__fnCronLocksTableReady;
}

export type CronLockHandle = {
  lockKey: string;
  ownerId: string;
};

export async function acquireCronLock(
  lockKey: string,
  ttlMs: number,
): Promise<CronLockHandle | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  if (!db || !(await ensureTable())) return null;

  const ownerId = randomUUID();
  const expiresAt = new Date(Date.now() + Math.max(1_000, ttlMs));

  try {
    const rows = await db.execute(sql`
      INSERT INTO cron_locks (lock_key, owner_id, expires_at, acquired_at)
      VALUES (${lockKey}, ${ownerId}, ${expiresAt}, now())
      ON CONFLICT (lock_key) DO UPDATE SET
        owner_id = EXCLUDED.owner_id,
        expires_at = EXCLUDED.expires_at,
        acquired_at = EXCLUDED.acquired_at
      WHERE cron_locks.expires_at < now()
      RETURNING lock_key, owner_id
    `);
    const row = rows.rows[0] as { lock_key: string; owner_id: string } | undefined;
    if (!row || row.owner_id !== ownerId) return null;
    return { lockKey: row.lock_key, ownerId: row.owner_id };
  } catch {
    return null;
  }
}

export async function releaseCronLock(handle: CronLockHandle): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  if (!db || !(await ensureTable())) return;
  try {
    await db.execute(sql`
      DELETE FROM cron_locks
      WHERE lock_key = ${handle.lockKey} AND owner_id = ${handle.ownerId}
    `);
  } catch {
    /* best-effort */
  }
}