import { desc, eq } from "drizzle-orm";
import { loadJson } from "@/lib/engine/loadData";
import {
  computeScenarioSha256,
  type SnapshotParams,
} from "@/lib/engine/snapshotDiff";
import type { ScenarioResult } from "@/lib/engine/types";
import { writeAuditLog } from "./auditLog";
import { getDb } from "./client";
import { snapshots } from "./schema";

export type SnapshotRecord = {
  id: string;
  name: string;
  notes: string | null;
  isOfficialBaseline: boolean;
  sha256Hash: string;
  params: SnapshotParams;
  scenarioData: ScenarioResult;
  createdBy: string;
  createdAt: string;
};

const FROZEN_FILE_ID = "file-frozen-18-10-2026";

export function frozenSnapshotFromFile(): SnapshotRecord {
  const scenarioData = loadJson<ScenarioResult>(
    "scenario_congelato_18-10-2026.json",
  );
  return {
    id: FROZEN_FILE_ID,
    name: "Snapshot Ufficiale Congelato (18-10-2026)",
    notes: "Seed da data/scenario_congelato_18-10-2026.json",
    isOfficialBaseline: true,
    sha256Hash: computeScenarioSha256(scenarioData),
    params: {
      S: scenarioData.parametri.S,
      pesi: scenarioData.parametri.pesi,
    },
    scenarioData,
    createdBy: "system@file",
    createdAt: scenarioData.metadati.data,
  };
}

function rowToRecord(row: typeof snapshots.$inferSelect): SnapshotRecord {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    isOfficialBaseline: row.isOfficialBaseline,
    sha256Hash: row.sha256Hash,
    params: row.params as SnapshotParams,
    scenarioData: row.scenarioData as ScenarioResult,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function ensureOfficialSnapshotSeed(
  actorEmail: string,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const existing = await db.select().from(snapshots).limit(1);
    if (existing.length > 0) return;

    const frozen = frozenSnapshotFromFile();
    await db.insert(snapshots).values({
      id: crypto.randomUUID(),
      name: "Snapshot Ufficiale Congelato (18-10-2026)",
      notes: frozen.notes,
      isOfficialBaseline: true,
      sha256Hash: frozen.sha256Hash,
      params: frozen.params,
      scenarioData: frozen.scenarioData,
      createdBy: actorEmail,
    });
    await writeAuditLog(
      "DB_SEEDED",
      actorEmail,
      "Auto-seed snapshot ufficiale 18-10-2026 in tabella snapshots",
      { source: "scenario_congelato_18-10-2026.json" },
    );
  } catch {
    /* tabelle non migrate */
  }
}

export async function listSnapshots(): Promise<{
  dbConnected: boolean;
  snapshots: SnapshotRecord[];
}> {
  const db = getDb();
  if (!db) {
    return { dbConnected: false, snapshots: [frozenSnapshotFromFile()] };
  }
  try {
    const rows = await db
      .select()
      .from(snapshots)
      .orderBy(desc(snapshots.createdAt));
    if (rows.length === 0) {
      return { dbConnected: true, snapshots: [frozenSnapshotFromFile()] };
    }
    return {
      dbConnected: true,
      snapshots: rows.map(rowToRecord),
    };
  } catch {
    return { dbConnected: false, snapshots: [frozenSnapshotFromFile()] };
  }
}

export async function insertSnapshot(input: {
  name: string;
  notes?: string;
  params: SnapshotParams;
  scenarioData: ScenarioResult;
  createdBy: string;
  isOfficialBaseline?: boolean;
}): Promise<SnapshotRecord | null> {
  const db = getDb();
  if (!db) return null;
  const id = crypto.randomUUID();
  const sha256Hash = computeScenarioSha256(input.scenarioData);
  try {
    await db.insert(snapshots).values({
      id,
      name: input.name,
      notes: input.notes ?? null,
      isOfficialBaseline: input.isOfficialBaseline ?? false,
      sha256Hash,
      params: input.params,
      scenarioData: input.scenarioData,
      createdBy: input.createdBy,
    });
    await writeAuditLog(
      "SNAPSHOT_CREATED",
      input.createdBy,
      `Snapshot creato: ${input.name}`,
      { id, sha256Hash: sha256Hash.slice(0, 12) },
    );
    const row = await db
      .select()
      .from(snapshots)
      .where(eq(snapshots.id, id))
      .limit(1);
    return row[0] ? rowToRecord(row[0]) : null;
  } catch {
    return null;
  }
}

export async function deleteSnapshot(
  id: string,
  actorEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: "DB non configurato" };
  try {
    const row = await db
      .select()
      .from(snapshots)
      .where(eq(snapshots.id, id))
      .limit(1);
    if (!row[0]) return { ok: false, error: "Snapshot non trovato" };
    if (row[0].isOfficialBaseline) {
      return { ok: false, error: "Impossibile eliminare baseline ufficiale" };
    }
    await db.delete(snapshots).where(eq(snapshots.id, id));
    await writeAuditLog(
      "SNAPSHOT_DELETED",
      actorEmail,
      `Snapshot eliminato: ${row[0].name}`,
      { id },
    );
    return { ok: true };
  } catch {
    return { ok: false, error: "Errore database" };
  }
}
