import fs from "fs";
import path from "path";

const root = process.cwd();
const outName = "docs/PIATTAFORMA-CODICE-COMPLETO-2026-11-20.md";
const outPath = path.join(root, outName);

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".cache",
  "coverage",
  "dist",
  "build",
  "docs",
  "design-system",
  "public",
  ".vercel",
  "tmp",
  "__pycache__",
]);
const SKIP_FILES = new Set(["package-lock.json", ".DS_Store", "Thumbs.db"]);
const CODE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".json",
  ".md",
  ".sql",
  ".yml",
  ".yaml",
]);
const INCLUDE_ROOT = ["src", "scripts", "data"];
const ROOT_FILES = [
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "next-env.d.ts",
  "eslint.config.mjs",
  "postcss.config.mjs",
  "vercel.json",
  "AGENTS.md",
  "drizzle.config.ts",
  "components.json",
  ".gitignore",
  ".env.example",
];

function langFor(file) {
  const ext = path.extname(file).toLowerCase();
  return (
    {
      ".ts": "ts",
      ".tsx": "tsx",
      ".js": "js",
      ".mjs": "js",
      ".cjs": "js",
      ".css": "css",
      ".json": "json",
      ".md": "md",
      ".sql": "sql",
      ".yml": "yaml",
      ".yaml": "yaml",
    }[ext] ?? ""
  );
}

function shouldSkipFile(rel, abs) {
  const base = path.basename(rel);
  if (SKIP_FILES.has(base)) return true;
  if (base.startsWith(".env") && base !== ".env.example") return true;
  const ext = path.extname(base).toLowerCase();
  const normalized = rel.replace(/\\/g, "/");
  if (!CODE_EXT.has(ext) && !ROOT_FILES.includes(normalized)) return true;
  if (fs.statSync(abs).size > 2_000_000) return true;
  return false;
}

function walk(dir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (
      ent.name.startsWith(".") &&
      ent.name !== ".env.example" &&
      ent.name !== ".gitignore"
    ) {
      if (ent.isDirectory()) continue;
    }
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(path.join(dir, ent.name), acc);
      continue;
    }
    const abs = path.join(dir, ent.name);
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    if (shouldSkipFile(rel, abs)) continue;
    acc.push(rel);
  }
}

const files = [];
for (const f of ROOT_FILES) {
  if (fs.existsSync(path.join(root, f))) files.push(f);
}
for (const d of INCLUDE_ROOT) {
  const abs = path.join(root, d);
  if (fs.existsSync(abs)) walk(abs, files);
}

const unique = [...new Set(files)]
  .filter((f) => f !== "scripts/dump-platform-code.mjs")
  .sort((a, b) => a.localeCompare(b, "en"));
const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);

let md = "";
md += "# Futuro Nazionale v3.2 — codice completo della piattaforma\n\n";
md += `Generato: ${stamp} UTC\n\n`;
md += "Root: `platform/`\n\n";
md +=
  "Include: sorgenti `src/`, script `scripts/` (tranne questo dumper), dataset `data/`, config di radice.\n\n";
md +=
  "Esclusi: `node_modules`, `.next`, `.env*` (tranne `.env.example`), `package-lock.json`, `docs/`, `public/`, `design-system/`, file > 2 MB.\n\n";
md += `File inclusi: **${unique.length}**\n\n`;
md += "## Indice\n\n";
for (const f of unique) {
  md += `- \`${f}\`\n`;
}
md += "\n---\n\n";

for (const f of unique) {
  const abs = path.join(root, f);
  let body = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
  const fence = langFor(f);
  md += `## \`${f}\`\n\n`;
  md += "```" + fence + "\n";
  md += body;
  if (!body.endsWith("\n")) md += "\n";
  md += "```\n\n";
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, md, "utf8");
const mb = (Buffer.byteLength(md, "utf8") / (1024 * 1024)).toFixed(2);
console.log(`Wrote ${outName}`);
console.log(`Files: ${unique.filter((f) => f !== "scripts/dump-platform-code.mjs").length}`);
console.log(`Size: ${mb} MB`);
