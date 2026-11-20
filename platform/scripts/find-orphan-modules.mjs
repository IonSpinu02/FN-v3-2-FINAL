import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "src");
const files = [];

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory() && e.name !== "__tests__") walk(p);
    else if (/\.(tsx|ts)$/.test(e.name) && !e.name.endsWith(".test.ts")) files.push(p);
  }
}
walk(root);

const importers = new Map(files.map((f) => [f, new Set()]));

for (const consumer of files) {
  const t = fs.readFileSync(consumer, "utf8");
  for (const target of files) {
    if (consumer === target) continue;
    const alias = `@/${path.relative(root, target).replace(/\\/g, "/").replace(/\.tsx?$/, "")}`;
  if (t.includes(`"${alias}"`) || t.includes(`'${alias}'`)) {
      importers.get(target).add(consumer);
      continue;
    }
    const rel = path.relative(path.dirname(consumer), target).replace(/\\/g, "/").replace(/\.tsx?$/, "");
    const relImport = rel.startsWith(".") ? rel : `./${rel}`;
    if (t.includes(`"${relImport}"`) || t.includes(`'${relImport}'`)) {
      importers.get(target).add(consumer);
    }
  }
}

const orphans = files
  .filter((f) => {
    const rel = path.relative(root, f).replace(/\\/g, "/");
    if (rel.startsWith("app/")) return false;
    if (rel.endsWith("middleware.ts")) return false;
    return importers.get(f).size === 0;
  })
  .sort();

console.log("ORPHAN COUNT", orphans.length);
for (const o of orphans) console.log(path.relative(root, o));
