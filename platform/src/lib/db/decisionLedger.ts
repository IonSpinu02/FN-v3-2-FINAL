/**
 * Memoria immutabile append-only con:
 * - Postgres (produzione) + campi prev_hash/entry_hash
 * - fallback locale `.ledger/*.jsonl` (ndjson) senza truncamento, coda serializzata
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db/client";
import {
  decisionLedgerSnapshots,
  sourceIngestionLog,
  supervisionAuditLog,
} from "@/lib/db/schema";
import type { SupervisionDecision, SupervisionEntityType } from "@/lib/engine/epistemicStatus";
import { canonicalJson, sha256Hex } from "@/lib/engine/sha256Canonical";
import { ledgerFileFallbackAllowed } from "@/lib/cache/cachePolicy";
import { LEDGER_FILE_BADGE } from "@/lib/db/ledgerLabels";

function assertLedgerFileWritable(): void {
  if (!ledgerFileFallbackAllowed()) {
    throw new Error(
      "DATABASE_URL richiesto in produzione: il ledger non può usare file locali (.ledger).",
    );
  }
}

function mayReadLedgerFiles(): boolean {
  return ledgerFileFallbackAllowed();
}

export type LedgerStorageKind = "postgres" | "file";

let ledgerDirOverride: string | null = null;

/** Solo test: directory isolata per evitare race tra file Vitest paralleli. */
export function __setLedgerDirForTests(dir: string | null): void {
  ledgerDirOverride = dir ? path.resolve(dir) : null;
}

function resolveLedgerDir(): string {
  if (ledgerDirOverride) return ledgerDirOverride;
  const override = process.env.LEDGER_DIR?.trim();
  return override && override.length > 0
    ? path.resolve(override)
    : path.join(process.cwd(), ".ledger");
}
const GENESIS_HASH = "0".repeat(64);

/** Code di scrittura per directory (isolamento parallelo). */
const writeChains = new Map<string, Promise<void>>();

export { LEDGER_FILE_BADGE } from "@/lib/db/ledgerLabels";

export function ledgerStorageKind(): LedgerStorageKind {
  if (isDbConfigured() && getDb()) return "postgres";
  return mayReadLedgerFiles() ? "file" : "postgres";
}

export function ledgerStorageLabel(): string {
  return ledgerStorageKind() === "postgres"
    ? "PostgreSQL (append-only + trigger anti-mutation)"
    : LEDGER_FILE_BADGE;
}

async function ensureLedgerDir(): Promise<void> {
  await fs.mkdir(resolveLedgerDir(), { recursive: true });
}

function enqueueWrite<T>(job: () => Promise<T>): Promise<T> {
  const dir = resolveLedgerDir();
  const prev = writeChains.get(dir) ?? Promise.resolve();
  const run = prev.then(job, job);
  writeChains.set(
    dir,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

async function appendJsonl(file: string, row: unknown): Promise<void> {
  await ensureLedgerDir();
  const line = `${JSON.stringify(row)}\n`;
  await fs.appendFile(path.join(resolveLedgerDir(), file), line, "utf8");
}

async function readJsonl<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(path.join(resolveLedgerDir(), file), "utf8");
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    const out: T[] = [];
    for (const line of lines) {
      try {
        out.push(JSON.parse(line) as T);
      } catch {
        /* riga corrotta: salta ma non tronca il resto */
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Migrazione one-shot da vecchi JSON array a jsonl (senza perdita). */
async function migrateJsonArrayToJsonl(jsonName: string, jsonlName: string): Promise<void> {
  const jsonPath = path.join(resolveLedgerDir(), jsonName);
  const jsonlPath = path.join(resolveLedgerDir(), jsonlName);
  try {
    await fs.access(jsonlPath);
    return; // già migrato / presente
  } catch {
    /* continua */
  }
  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed) || !parsed.length) return;
    await ensureLedgerDir();
    const body = parsed.map((r) => JSON.stringify(r)).join("\n") + "\n";
    await fs.writeFile(jsonlPath, body, "utf8");
  } catch {
    /* nessun file legacy */
  }
}

function hashPayload(parts: Record<string, unknown>, prevHash: string): string {
  return sha256Hex(canonicalJson({ ...parts, prevHash }));
}

export type DecisionSnapshotRecord = {
  id: string;
  computationId: string;
  emittedAt: string;
  engineVersion: string;
  calibrationStateJson: unknown;
  inputsManifestJson: unknown;
  assumptionsJson: unknown;
  outputsJson: unknown;
  subsequentOutcomeJson: unknown | null;
  createdAt: string;
  prevHash: string;
  entryHash: string;
};

export type SourceIngestionRecord = {
  id: string;
  sourceKey: string;
  checkedAt: string;
  lastNewItemAt: string | null;
  itemsFetched: number;
  itemsAccepted: number;
  itemsRejected: number;
  usedFallback: boolean;
  errorMessage: string | null;
  triggerType: "cron" | "manual" | "page_lifecycle";
  metadata?: unknown;
  createdAt: string;
  prevHash?: string;
  entryHash?: string;
};

export type SupervisionAuditRecord = {
  id: string;
  entityType: SupervisionEntityType;
  entityId: string;
  previousStatus: string | null;
  newStatus: SupervisionDecision;
  note: string | null;
  createdAt: string;
  prevHash: string;
  entryHash: string;
};

function snapshotHashBody(row: Omit<DecisionSnapshotRecord, "prevHash" | "entryHash">) {
  return {
    id: row.id,
    computationId: row.computationId,
    emittedAt: row.emittedAt,
    engineVersion: row.engineVersion,
    calibrationStateJson: row.calibrationStateJson,
    inputsManifestJson: row.inputsManifestJson,
    assumptionsJson: row.assumptionsJson,
    outputsJson: row.outputsJson,
    createdAt: row.createdAt,
  };
}

function supervisionHashBody(row: Omit<SupervisionAuditRecord, "prevHash" | "entryHash">) {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    note: row.note,
    createdAt: row.createdAt,
  };
}

async function lastSnapshotHash(): Promise<string> {
  const db = getDb();
  if (db) {
    const rows = await db
      .select()
      .from(decisionLedgerSnapshots)
      .orderBy(desc(decisionLedgerSnapshots.createdAt))
      .limit(1);
    return (rows[0] as { entryHash?: string } | undefined)?.entryHash ?? GENESIS_HASH;
  }
  if (!mayReadLedgerFiles()) return GENESIS_HASH;
  await migrateJsonArrayToJsonl(
    "decision_ledger_snapshots.json",
    "decision_ledger_snapshots.jsonl",
  );
  const rows = await readJsonl<DecisionSnapshotRecord>("decision_ledger_snapshots.jsonl");
  return rows.at(-1)?.entryHash ?? GENESIS_HASH;
}

async function lastSupervisionHash(): Promise<string> {
  const db = getDb();
  if (db) {
    const rows = await db
      .select()
      .from(supervisionAuditLog)
      .orderBy(desc(supervisionAuditLog.createdAt))
      .limit(1);
    return (rows[0] as { entryHash?: string } | undefined)?.entryHash ?? GENESIS_HASH;
  }
  if (!mayReadLedgerFiles()) return GENESIS_HASH;
  await migrateJsonArrayToJsonl("supervision_audit_log.json", "supervision_audit_log.jsonl");
  const rows = await readJsonl<SupervisionAuditRecord>("supervision_audit_log.jsonl");
  return rows.at(-1)?.entryHash ?? GENESIS_HASH;
}

export async function appendDecisionSnapshot(
  input: Omit<
    DecisionSnapshotRecord,
    "id" | "createdAt" | "subsequentOutcomeJson" | "prevHash" | "entryHash"
  > & {
    subsequentOutcomeJson?: unknown | null;
  },
): Promise<DecisionSnapshotRecord> {
  return enqueueWrite(async () => {
    const base = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      subsequentOutcomeJson: input.subsequentOutcomeJson ?? null,
      computationId: input.computationId,
      emittedAt: input.emittedAt,
      engineVersion: input.engineVersion,
      calibrationStateJson: input.calibrationStateJson,
      inputsManifestJson: input.inputsManifestJson,
      assumptionsJson: input.assumptionsJson,
      outputsJson: input.outputsJson,
    };
    const prevHash = await lastSnapshotHash();
    const entryHash = hashPayload(snapshotHashBody(base), prevHash);
    const row: DecisionSnapshotRecord = { ...base, prevHash, entryHash };

    const db = getDb();
    if (db) {
      await db.insert(decisionLedgerSnapshots).values({
        id: row.id,
        computationId: row.computationId,
        emittedAt: new Date(row.emittedAt),
        engineVersion: row.engineVersion,
        calibrationStateJson: row.calibrationStateJson,
        inputsManifestJson: row.inputsManifestJson,
        assumptionsJson: row.assumptionsJson,
        outputsJson: row.outputsJson,
        subsequentOutcomeJson: row.subsequentOutcomeJson,
        createdAt: new Date(row.createdAt),
        prevHash: row.prevHash,
        entryHash: row.entryHash,
      });
      return row;
    }
    assertLedgerFileWritable();
    await migrateJsonArrayToJsonl(
      "decision_ledger_snapshots.json",
      "decision_ledger_snapshots.jsonl",
    );
    await appendJsonl("decision_ledger_snapshots.jsonl", row);
    return row;
  });
}

export async function listDecisionSnapshots(limit = 50): Promise<DecisionSnapshotRecord[]> {
  const db = getDb();
  if (db) {
    const rows = await db
      .select()
      .from(decisionLedgerSnapshots)
      .orderBy(desc(decisionLedgerSnapshots.emittedAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      computationId: r.computationId,
      emittedAt: r.emittedAt.toISOString(),
      engineVersion: r.engineVersion,
      calibrationStateJson: r.calibrationStateJson,
      inputsManifestJson: r.inputsManifestJson,
      assumptionsJson: r.assumptionsJson,
      outputsJson: r.outputsJson,
      subsequentOutcomeJson: r.subsequentOutcomeJson,
      createdAt: r.createdAt.toISOString(),
      prevHash: (r as { prevHash?: string }).prevHash ?? GENESIS_HASH,
      entryHash: (r as { entryHash?: string }).entryHash ?? GENESIS_HASH,
    }));
  }
  if (!mayReadLedgerFiles()) return [];
  await migrateJsonArrayToJsonl(
    "decision_ledger_snapshots.json",
    "decision_ledger_snapshots.jsonl",
  );
  const rows = await readJsonl<DecisionSnapshotRecord>("decision_ledger_snapshots.jsonl");
  return [...rows].reverse().slice(0, limit);
}

export async function getDecisionSnapshotById(
  id: string,
): Promise<DecisionSnapshotRecord | null> {
  const db = getDb();
  if (db) {
    const rows = await db
      .select()
      .from(decisionLedgerSnapshots)
      .where(eq(decisionLedgerSnapshots.id, id))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      computationId: r.computationId,
      emittedAt: r.emittedAt.toISOString(),
      engineVersion: r.engineVersion,
      calibrationStateJson: r.calibrationStateJson,
      inputsManifestJson: r.inputsManifestJson,
      assumptionsJson: r.assumptionsJson,
      outputsJson: r.outputsJson,
      subsequentOutcomeJson: r.subsequentOutcomeJson,
      createdAt: r.createdAt.toISOString(),
      prevHash: (r as { prevHash?: string }).prevHash ?? GENESIS_HASH,
      entryHash: (r as { entryHash?: string }).entryHash ?? GENESIS_HASH,
    };
  }
  if (!mayReadLedgerFiles()) return null;
  await migrateJsonArrayToJsonl(
    "decision_ledger_snapshots.json",
    "decision_ledger_snapshots.jsonl",
  );
  const rows = await readJsonl<DecisionSnapshotRecord>("decision_ledger_snapshots.jsonl");
  return rows.find((r) => r.id === id) ?? null;
}

export async function appendSourceIngestion(
  input: Omit<SourceIngestionRecord, "id" | "createdAt" | "prevHash" | "entryHash">,
): Promise<SourceIngestionRecord> {
  return enqueueWrite(async () => {
    const row: SourceIngestionRecord = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...input,
    };
    const db = getDb();
    if (db) {
      await db.insert(sourceIngestionLog).values({
        id: row.id,
        sourceKey: row.sourceKey,
        checkedAt: new Date(row.checkedAt),
        lastNewItemAt: row.lastNewItemAt ? new Date(row.lastNewItemAt) : null,
        itemsFetched: row.itemsFetched,
        itemsAccepted: row.itemsAccepted,
        itemsRejected: row.itemsRejected,
        usedFallback: row.usedFallback,
        errorMessage: row.errorMessage,
        triggerType: row.triggerType,
        metadata: row.metadata ?? null,
        createdAt: new Date(row.createdAt),
      });
      return row;
    }
    assertLedgerFileWritable();
    await migrateJsonArrayToJsonl("source_ingestion_log.json", "source_ingestion_log.jsonl");
    await appendJsonl("source_ingestion_log.jsonl", row);
    return row;
  });
}

export async function listSourceIngestion(
  sourceKey?: string,
  limit = 40,
): Promise<SourceIngestionRecord[]> {
  const db = getDb();
  if (db) {
    const rows = sourceKey
      ? await db
          .select()
          .from(sourceIngestionLog)
          .where(eq(sourceIngestionLog.sourceKey, sourceKey))
          .orderBy(desc(sourceIngestionLog.checkedAt))
          .limit(limit)
      : await db
          .select()
          .from(sourceIngestionLog)
          .orderBy(desc(sourceIngestionLog.checkedAt))
          .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      sourceKey: r.sourceKey,
      checkedAt: r.checkedAt.toISOString(),
      lastNewItemAt: r.lastNewItemAt?.toISOString() ?? null,
      itemsFetched: r.itemsFetched,
      itemsAccepted: r.itemsAccepted,
      itemsRejected: r.itemsRejected,
      usedFallback: r.usedFallback,
      errorMessage: r.errorMessage,
      triggerType: r.triggerType as SourceIngestionRecord["triggerType"],
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    }));
  }
  if (!mayReadLedgerFiles()) return [];
  await migrateJsonArrayToJsonl("source_ingestion_log.json", "source_ingestion_log.jsonl");
  const rows = await readJsonl<SourceIngestionRecord>("source_ingestion_log.jsonl");
  const filtered = sourceKey ? rows.filter((r) => r.sourceKey === sourceKey) : rows;
  return [...filtered].reverse().slice(0, limit);
}

export async function appendSupervisionDecision(input: {
  entityType: SupervisionEntityType;
  entityId: string;
  previousStatus?: string | null;
  newStatus: SupervisionDecision;
  note?: string | null;
}): Promise<SupervisionAuditRecord> {
  return enqueueWrite(async () => {
    const base = {
      id: randomUUID(),
      entityType: input.entityType,
      entityId: input.entityId,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus,
      note: input.note ?? null,
      createdAt: new Date().toISOString(),
    };
    const prevHash = await lastSupervisionHash();
    const entryHash = hashPayload(supervisionHashBody(base), prevHash);
    const row: SupervisionAuditRecord = { ...base, prevHash, entryHash };

    const db = getDb();
    if (db) {
      await db.insert(supervisionAuditLog).values({
        id: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        previousStatus: row.previousStatus,
        newStatus: row.newStatus,
        note: row.note,
        createdAt: new Date(row.createdAt),
        prevHash: row.prevHash,
        entryHash: row.entryHash,
      });
      return row;
    }
    assertLedgerFileWritable();
    await migrateJsonArrayToJsonl("supervision_audit_log.json", "supervision_audit_log.jsonl");
    await appendJsonl("supervision_audit_log.jsonl", row);
    return row;
  });
}

export async function listSupervisionDecisions(
  limit = 100,
): Promise<SupervisionAuditRecord[]> {
  const db = getDb();
  if (db) {
    const rows = await db
      .select()
      .from(supervisionAuditLog)
      .orderBy(desc(supervisionAuditLog.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      entityType: r.entityType as SupervisionEntityType,
      entityId: r.entityId,
      previousStatus: r.previousStatus,
      newStatus: r.newStatus as SupervisionDecision,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      prevHash: (r as { prevHash?: string }).prevHash ?? GENESIS_HASH,
      entryHash: (r as { entryHash?: string }).entryHash ?? GENESIS_HASH,
    }));
  }
  if (!mayReadLedgerFiles()) return [];
  await migrateJsonArrayToJsonl("supervision_audit_log.json", "supervision_audit_log.jsonl");
  const rows = await readJsonl<SupervisionAuditRecord>("supervision_audit_log.jsonl");
  return [...rows].reverse().slice(0, limit);
}

/** Entità attualmente escluse (ultima decisione per entityId = excluded). */
export async function listActiveExclusions(): Promise<string[]> {
  const rows = await listSupervisionDecisions(500);
  const latest = new Map<string, SupervisionDecision>();
  for (const row of rows) {
    if (!latest.has(row.entityId)) latest.set(row.entityId, row.newStatus);
  }
  return [...latest.entries()]
    .filter(([, status]) => status === "excluded")
    .map(([id]) => id);
}

export type LedgerIntegrityReport = {
  ok: boolean;
  snapshotsChecked: number;
  supervisionChecked: number;
  brokenAt?: { table: string; id: string; reason: string };
};

/** Verifica hash-chain: nessuna riga alterata o rimossa nella catena. */
export async function verifyLedgerIntegrity(): Promise<LedgerIntegrityReport> {
  if (mayReadLedgerFiles()) {
    await migrateJsonArrayToJsonl(
      "decision_ledger_snapshots.json",
      "decision_ledger_snapshots.jsonl",
    );
    await migrateJsonArrayToJsonl("supervision_audit_log.json", "supervision_audit_log.jsonl");
  }

  const snapshots =
    ledgerStorageKind() === "file"
      ? await readJsonl<DecisionSnapshotRecord>("decision_ledger_snapshots.jsonl")
      : (await listDecisionSnapshots(10_000)).reverse();

  let prev = GENESIS_HASH;
  for (const row of snapshots) {
    const expected = hashPayload(
      snapshotHashBody({
        id: row.id,
        computationId: row.computationId,
        emittedAt: row.emittedAt,
        engineVersion: row.engineVersion,
        calibrationStateJson: row.calibrationStateJson,
        inputsManifestJson: row.inputsManifestJson,
        assumptionsJson: row.assumptionsJson,
        outputsJson: row.outputsJson,
        subsequentOutcomeJson: row.subsequentOutcomeJson,
        createdAt: row.createdAt,
      }),
      row.prevHash,
    );
    if (row.prevHash !== prev) {
      return {
        ok: false,
        snapshotsChecked: snapshots.length,
        supervisionChecked: 0,
        brokenAt: {
          table: "decision_ledger_snapshots",
          id: row.id,
          reason: `prev_hash non collima con entry precedente (atteso ${prev.slice(0, 12)}…)`,
        },
      };
    }
    if (row.entryHash !== expected) {
      return {
        ok: false,
        snapshotsChecked: snapshots.length,
        supervisionChecked: 0,
        brokenAt: {
          table: "decision_ledger_snapshots",
          id: row.id,
          reason: "entry_hash non corrisponde al contenuto canonico",
        },
      };
    }
    prev = row.entryHash;
  }

  const supervision =
    ledgerStorageKind() === "file"
      ? await readJsonl<SupervisionAuditRecord>("supervision_audit_log.jsonl")
      : (await listSupervisionDecisions(10_000)).reverse();

  prev = GENESIS_HASH;
  for (const row of supervision) {
    const expected = hashPayload(
      supervisionHashBody({
        id: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        previousStatus: row.previousStatus,
        newStatus: row.newStatus,
        note: row.note,
        createdAt: row.createdAt,
      }),
      row.prevHash,
    );
    if (row.prevHash !== prev || row.entryHash !== expected) {
      return {
        ok: false,
        snapshotsChecked: snapshots.length,
        supervisionChecked: supervision.length,
        brokenAt: {
          table: "supervision_audit_log",
          id: row.id,
          reason: "catena hash interrotta o contenuto alterato",
        },
      };
    }
    prev = row.entryHash;
  }

  return {
    ok: true,
    snapshotsChecked: snapshots.length,
    supervisionChecked: supervision.length,
  };
}
