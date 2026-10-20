import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function databaseUrl(): string | undefined {
  const url = (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL
  )?.trim();
  if (!url || url.includes("[SENSITIVE]")) return undefined;
  return url;
}

export function isDbConfigured(): boolean {
  return Boolean(databaseUrl());
}

/** @deprecated use isDbConfigured */
export const isDatabaseConfigured = isDbConfigured;

let cached: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> | null {
  const url = databaseUrl();
  if (!url) return null;
  if (!cached) {
    const sql = neon(url);
    cached = drizzle(sql, { schema });
  }
  return cached;
}
