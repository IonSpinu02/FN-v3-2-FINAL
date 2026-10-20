import { readFileSync } from "fs";
import path from "path";
import type { Region } from "./constants";
import { calculate } from "./calculate";
import type { EuRegion, FnConfig, ScenarioResult } from "./types";

const dataDir = path.join(process.cwd(), "data");

export function loadJson<T>(name: string): T {
  return JSON.parse(
    readFileSync(path.join(dataDir, name), "utf8"),
  ) as T;
}

export function runDefaultScenario(nSim?: number): ScenarioResult {
  const cfg = loadJson<FnConfig>("config_v3_2.json");
  const euRaw = loadJson<{ D: Record<Region, EuRegion> }>("eu2024.json");
  return calculate(cfg, euRaw.D, nSim);
}
