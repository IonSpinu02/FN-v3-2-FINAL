import {
  boolean,
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
