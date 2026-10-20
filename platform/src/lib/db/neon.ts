import { neon } from "@neondatabase/serverless";

function databaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL
  );
}

export function isDatabaseConfigured(): boolean {
  return Boolean(databaseUrl());
}

export function getSql() {
  const url = databaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL (o POSTGRES_URL) non configurato");
  }
  return neon(url);
}
