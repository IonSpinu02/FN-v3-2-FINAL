import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const url =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

if (!url || url.includes("[SENSITIVE]")) {
  console.error(
    "Imposta DATABASE_URL (copia da Vercel → Storage → Neon → .env.local), poi riesegui.",
  );
  process.exit(1);
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(path.join(dir, "../db/schema.sql"), "utf8");
const sql = neon(url);

for (const statement of schema
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean)) {
  await sql(statement);
  console.log("OK:", statement.split("\n")[0].slice(0, 72));
}

console.log("Schema applicato.");
