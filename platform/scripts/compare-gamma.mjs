import { PythonRandom } from "../src/lib/engine/pythonDistributions.ts";

const r = new PythonRandom(42);
for (let i = 0; i < 5; i++) {
  console.log(r.gammavariate(7, 1));
}
r.seed(42);
for (let i = 0; i < 3; i++) {
  console.log("gauss", r.gauss(0.072, 0.012));
}
