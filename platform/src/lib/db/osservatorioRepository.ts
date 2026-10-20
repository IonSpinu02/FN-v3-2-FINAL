import { eq } from "drizzle-orm";
import { loadJson } from "@/lib/engine/loadData";
import type {
  OsservatorioCloudPayload,
  OsservatorioEventsFile,
} from "@/lib/engine/osservatorioTypes";
import { writeAuditLog } from "./auditLog";
import { getDb, isDbConfigured } from "./client";
import { osservatorioCloudState } from "./schema";

const SINGLETON_ID = "default";

function emptyPayload(): OsservatorioCloudPayload {
  return {
    events: [],
    trendsSeries: [],
    prioritaDichiarate: {},
    monthlyNotes: {},
  };
}

function seedEvents(): OsservatorioCloudPayload["events"] {
  const file = loadJson<OsservatorioEventsFile>("osservatorio_events.json");
  return file.events ?? [];
}

export async function loadOsservatorioFromDb(): Promise<{
  payload: OsservatorioCloudPayload;
  updatedAt: string | null;
  updatedBy: string | null;
  source: "db" | "seed";
} | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  if (!db) return null;

  try {
    let rows = await db
      .select()
      .from(osservatorioCloudState)
      .where(eq(osservatorioCloudState.id, SINGLETON_ID))
      .limit(1);

    if (rows.length === 0) {
      const seed: OsservatorioCloudPayload = {
        events: seedEvents(),
        trendsSeries: [],
        prioritaDichiarate: {},
        monthlyNotes: {},
      };
      await db.insert(osservatorioCloudState).values({
        id: SINGLETON_ID,
        eventsData: seed.events,
        trendsSeriesData: seed.trendsSeries,
        prioritaDichiarateData: seed.prioritaDichiarate,
        monthlyNotesData: seed.monthlyNotes,
        updatedBy: "system@seed",
      });
      rows = await db
        .select()
        .from(osservatorioCloudState)
        .where(eq(osservatorioCloudState.id, SINGLETON_ID))
        .limit(1);
    }

    const row = rows[0];
    if (!row) return null;

    return {
      payload: {
        events: row.eventsData as OsservatorioCloudPayload["events"],
        trendsSeries:
          row.trendsSeriesData as OsservatorioCloudPayload["trendsSeries"],
        prioritaDichiarate:
          row.prioritaDichiarateData as OsservatorioCloudPayload["prioritaDichiarate"],
        monthlyNotes:
          row.monthlyNotesData as OsservatorioCloudPayload["monthlyNotes"],
      },
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
      source: "db",
    };
  } catch {
    return null;
  }
}

export async function saveOsservatorioToDb(
  payload: OsservatorioCloudPayload,
  updatedBy: string,
  summary?: string,
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .insert(osservatorioCloudState)
      .values({
        id: SINGLETON_ID,
        eventsData: payload.events,
        trendsSeriesData: payload.trendsSeries,
        prioritaDichiarateData: payload.prioritaDichiarate,
        monthlyNotesData: payload.monthlyNotes,
        updatedBy,
      })
      .onConflictDoUpdate({
        target: osservatorioCloudState.id,
        set: {
          eventsData: payload.events,
          trendsSeriesData: payload.trendsSeries,
          prioritaDichiarateData: payload.prioritaDichiarate,
          monthlyNotesData: payload.monthlyNotes,
          updatedBy,
          updatedAt: new Date(),
        },
      });

    await writeAuditLog(
      "OSSERVATORIO_UPDATED",
      updatedBy,
      summary ?? "Stato Osservatorio salvato su cloud",
      {
        events: payload.events.length,
        trends: payload.trendsSeries.length,
        priorita: Object.keys(payload.prioritaDichiarate).length,
      },
    );
    return true;
  } catch {
    return false;
  }
}

export { emptyPayload };
