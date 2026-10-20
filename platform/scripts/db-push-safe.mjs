import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");

config({ path: path.join(platformRoot, ".env.local") });
config({ path: path.join(platformRoot, ".env") });

const dbUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL?.trim() ||
  process.env.POSTGRES_PRISMA_URL?.trim() ||
  "";

if (!dbUrl) {
  console.error(`
[db:push] DATABASE_URL non configurato.

Aggiungi in platform/.env.local:
  DATABASE_URL="postgresql://user:pass@host/neondb?sslmode=require"

Oppure sincronizza da Vercel (nella cartella platform/):
  npx vercel env pull .env.local
  npm run db:push

Tabelle attese: snapshots, locali_cloud_state, osservatorio_cloud_state, audit_logs.
`);
  process.exit(0);
}

const result = spawnSync("npx", ["drizzle-kit", "push"], {
  cwd: platformRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
