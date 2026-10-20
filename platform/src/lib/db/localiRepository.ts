import { eq } from "drizzle-orm";
import { loadJson } from "@/lib/engine/loadData";
import type {
  LocalApprovedEvent,
  LocaliEventsFile,
  LocaliRegistryFile,
  LocalRegistryEntry,
} from "@/lib/engine/localiTypes";
import { writeAuditLog } from "./auditLog";
import { getDb, isDbConfigured } from "./client";
import { localiCloudState } from "./schema";

export interface LocaliDbState {
  registry: LocalRegistryEntry[];
  events: LocalApprovedEvent[];
  updatedAt: string | null;
  updatedBy: string | null;
  source: "db" | "seed" | "file";
}

const SINGLETON_ID = "default";

export async function loadLocaliFromDb(): Promise<LocaliDbState | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  if (!db) return null;

  const fileRegistry = loadJson<LocaliRegistryFile>("locali_registry.json");
  const fileEvents = loadJson<LocaliEventsFile>("locali_events.json");

  try {
    let rows = await db
      .select()
      .from(localiCloudState)
      .where(eq(localiCloudState.id, SINGLETON_ID))
      .limit(1);

    if (rows.length === 0) {
      await db.insert(localiCloudState).values({
        id: SINGLETON_ID,
        registryData: fileRegistry,
        eventsData: fileEvents,
        updatedBy: "system@seed",
      });
      rows = await db
        .select()
        .from(localiCloudState)
        .where(eq(localiCloudState.id, SINGLETON_ID))
        .limit(1);
    }

    const row = rows[0];
    if (!row) return null;

    const reg = row.registryData as LocaliRegistryFile;
    const ev = row.eventsData as LocaliEventsFile;
    return {
      registry: reg.entries ?? [],
      events: ev.events ?? [],
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
      source: "db",
    };
  } catch {
    return null;
  }
}

export async function saveLocaliToDb(
  registry: LocalRegistryEntry[],
  events: LocalApprovedEvent[] = [],
  updatedBy: string,
  summary?: string,
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  if (!db) return false;

  const registryData: LocaliRegistryFile = { version: 1, entries: registry };
  const eventsData: LocaliEventsFile = { version: 1, events };

  try {
    await db
      .insert(localiCloudState)
      .values({
        id: SINGLETON_ID,
        registryData,
        eventsData,
        updatedBy,
      })
      .onConflictDoUpdate({
        target: localiCloudState.id,
        set: {
          registryData,
          eventsData,
          updatedBy,
          updatedAt: new Date(),
        },
      });

    await writeAuditLog(
      "LOCALI_REGISTRY_SAVED",
      updatedBy,
      summary ?? `Registro locali salvato (${registry.length} voci)`,
      { entries: registry.length, events: events.length },
    );
    return true;
  } catch {
    return false;
  }
}
