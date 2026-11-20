import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const snapshots = pgTable("snapshots", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  notes: text("notes"),
  isOfficialBaseline: boolean("is_official_baseline").notNull().default(false),
  sha256Hash: text("sha256_hash").notNull(),
  params: jsonb("params").notNull(),
  scenarioData: jsonb("scenario_data").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const localiCloudState = pgTable("locali_cloud_state", {
  id: text("id").primaryKey(),
  registryData: jsonb("registry_data").notNull(),
  eventsData: jsonb("events_data").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const osservatorioCloudState = pgTable("osservatorio_cloud_state", {
  id: text("id").primaryKey(),
  eventsData: jsonb("events_data").notNull(),
  trendsSeriesData: jsonb("trends_series_data").notNull(),
  prioritaDichiarateData: jsonb("priorita_dichiarate_data").notNull(),
  monthlyNotesData: jsonb("monthly_notes_data").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Una riga per scopeKey: l'ultima scansione Tavily (al massimo una al giorno). */
export const tavilyDailyCache = pgTable("tavily_daily_cache", {
  scopeKey: text("scope_key").primaryKey(),
  dayKey: text("day_key").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  payload: jsonb("payload").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  actorEmail: text("actor_email").notNull(),
  summary: text("summary").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Ledger append-only: elaborazioni immutabili point-in-time. */
export const decisionLedgerSnapshots = pgTable("decision_ledger_snapshots", {
  id: text("id").primaryKey(),
  computationId: text("computation_id").notNull(),
  emittedAt: timestamp("emitted_at", { withTimezone: true }).notNull(),
  engineVersion: text("engine_version").notNull(),
  calibrationStateJson: jsonb("calibration_state_json").notNull(),
  inputsManifestJson: jsonb("inputs_manifest_json").notNull(),
  assumptionsJson: jsonb("assumptions_json").notNull(),
  outputsJson: jsonb("outputs_json").notNull(),
  /** Popolabile a posteriori; non sovrascrive outputs_json. */
  subsequentOutcomeJson: jsonb("subsequent_outcome_json"),
  prevHash: text("prev_hash").notNull().default("0".repeat(64)),
  entryHash: text("entry_hash").notNull().default("0".repeat(64)),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Log acquisizioni fonti (controllo vs contenuto nuovo). */
export const sourceIngestionLog = pgTable("source_ingestion_log", {
  id: text("id").primaryKey(),
  sourceKey: text("source_key").notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  lastNewItemAt: timestamp("last_new_item_at", { withTimezone: true }),
  itemsFetched: integer("items_fetched").notNull().default(0),
  itemsAccepted: integer("items_accepted").notNull().default(0),
  itemsRejected: integer("items_rejected").notNull().default(0),
  usedFallback: boolean("used_fallback").notNull().default(false),
  errorMessage: text("error_message"),
  triggerType: text("trigger_type").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Decisioni di supervisione umana tracciate. */
/** Cache dominio condivisa tra istanze serverless (Neon). */
export const domainCache = pgTable("domain_cache", {
  cacheKey: text("cache_key").primaryKey(),
  payloadJson: jsonb("payload_json").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  etag: text("etag"),
  sourceStatus: jsonb("source_status"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Rate limit centralizzato (fallback quando Upstash non è configurato). */
export const apiRateLimitHits = pgTable("api_rate_limit_hits", {
  bucketKey: text("bucket_key").primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  hitCount: integer("hit_count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Lock distribuito anti-sovrapposizione cron (TTL + steal su scaduto). */
export const cronLocks = pgTable("cron_locks", {
  lockKey: text("lock_key").primaryKey(),
  ownerId: text("owner_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acquiredAt: timestamp("acquired_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Puntatore versione/etag per invalidazione client (senza JSONB pesante). */
export const publishedState = pgTable("published_state", {
  domain: text("domain").primaryKey(),
  version: bigint("version", { mode: "number" }).notNull().default(1),
  computationId: text("computation_id"),
  etag: text("etag").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const supervisionAuditLog = pgTable("supervision_audit_log", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  note: text("note"),
  prevHash: text("prev_hash").notNull().default("0".repeat(64)),
  entryHash: text("entry_hash").notNull().default("0".repeat(64)),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
