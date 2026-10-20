import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pkgs = ["@stdlib/random-base-mt19937", "random-seed", "seedrandom"];
for (const p of pkgs) {
  try {
    require.resolve(p);
    console.log("has", p);
  } catch {
    console.log("no", p);
  }
}
