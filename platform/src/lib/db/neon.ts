import { neon } from "@neondatabase/serverless";
export { getDb, isDbConfigured, isDatabaseConfigured } from "./client";

function databaseUrl(): string | undefined {
  const url = (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL
  )?.trim();
  if (!url || url.includes("[SENSITIVE]")) return undefined;
  return url;
}

/** Legacy raw SQL (health check). */
export function getSql() {
  const url = databaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL non configurato");
  }
  return neon(url);
}
