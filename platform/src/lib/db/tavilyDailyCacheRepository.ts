import { eq, sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "./client";
import { tavilyDailyCache } from "./schema";

export type TavilyDailyDbEntry = {
  scopeKey: string;
  dayKey: string;
  fetchedAt: number;
  payload: unknown;
};

const tableState = globalThis as typeof globalThis & {
  __fnTavilyDailyTableReady?: Promise<boolean>;
};

/** Il gate non deve dipendere da un `db:push` manuale: la tabella si crea al primo uso. */
function ensureTable(): Promise<boolean> {
  const db = getDb();
  if (!db) return Promise.resolve(false);
  tableState.__fnTavilyDailyTableReady ??= db
    .execute(
      sql`CREATE TABLE IF NOT EXISTS tavily_daily_cache (
        scope_key text PRIMARY KEY,
        day_key text NOT NULL,
        fetched_at timestamp with time zone NOT NULL,
        payload jsonb NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      )`,
    )
    .then(
      () => true,
      () => {
        tableState.__fnTavilyDailyTableReady = undefined;
        return false;
      },
    );
  return tableState.__fnTavilyDailyTableReady;
}

export async function readTavilyDailyFromDb(
  scopeKey: string,
): Promise<TavilyDailyDbEntry | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  if (!db || !(await ensureTable())) return null;
  try {
    const rows = await db
      .select()
      .from(tavilyDailyCache)
      .where(eq(tavilyDailyCache.scopeKey, scopeKey))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      scopeKey: row.scopeKey,
      dayKey: row.dayKey,
      fetchedAt: row.fetchedAt.getTime(),
      payload: row.payload,
    };
  } catch {
    return null;
  }
}

export async function writeTavilyDailyToDb(entry: TavilyDailyDbEntry): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  if (!db || !(await ensureTable())) return false;
  const fetchedAt = new Date(entry.fetchedAt);
  try {
    await db
      .insert(tavilyDailyCache)
      .values({
        scopeKey: entry.scopeKey,
        dayKey: entry.dayKey,
        fetchedAt,
        payload: entry.payload,
      })
      .onConflictDoUpdate({
        target: tavilyDailyCache.scopeKey,
        set: {
          dayKey: entry.dayKey,
          fetchedAt,
          payload: entry.payload,
          updatedAt: new Date(),
        },
      });
    return true;
  } catch {
    return false;
  }
}
