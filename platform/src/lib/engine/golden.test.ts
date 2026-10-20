import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { calculate } from "./calculate";
import type { Region } from "./constants";
import type { EuRegion, FnConfig, ScenarioResult } from "./types";

const dataDir = path.join(process.cwd(), "data");

function load<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, name), "utf8")) as T;
}

describe("engine golden vs risultati_v3_2.json", () => {
  const golden = load<ScenarioResult>("risultati_v3_2.json");
  const cfg = load<FnConfig>("config_v3_2.json");
  const eu = load<{ D: Record<Region, EuRegion> }>("eu2024.json").D;

  it("metriche H e diff media benchmark", () => {
    const out = calculate(cfg, eu, 500);
    expect(out.metriche.H.iscritti).toBeCloseTo(
      golden.metriche.H.iscritti,
      6,
    );
    expect(out.metriche.H.scenario).toBeCloseTo(
      golden.metriche.H.scenario,
      6,
    );
    expect(out.metriche.H.elettorato).toBeCloseTo(
      golden.metriche.H.elettorato,
      6,
    );
    expect(
      out.metriche.differenza_media_ponderata_scenario_benchmark_punti,
    ).toBeCloseTo(
      golden.metriche.differenza_media_ponderata_scenario_benchmark_punti,
      3,
    );
  });

  it("stima e p per ogni regione (deterministico)", () => {
    const out = calculate(cfg, eu, 100);
    for (const g of golden.righe) {
      const row = out.righe.find((r) => r.regione === g.regione)!;
      expect(row.stima).toBeCloseTo(g.stima, 10);
      expect(row.p).toBeCloseTo(g.p, 10);
      expect(row.benchmark).toBeCloseTo(g.benchmark, 10);
    }
  });

  it("Monte Carlo completo seme 42 (20000 sim)", () => {
    const out = calculate(cfg, eu, 20000);
    expect(out.metriche.H.iscritti).toBeCloseTo(
      golden.metriche.H.iscritti,
      6,
    );
    const piemonte = out.righe.find((r) => r.regione === "Piemonte")!;
    const gPiemonte = golden.righe.find((r) => r.regione === "Piemonte")!;
    expect(piemonte.lo10).toBeCloseTo(gPiemonte.lo10, 3);
    expect(piemonte.hi90).toBeCloseTo(gPiemonte.hi90, 3);
  });
});

const SYNC_FILES = [
  "config_v3_2.json",
  "eu2024.json",
  "risultati_v3_2.json",
  "scenario_congelato_18-10-2026.json",
] as const;

function sha256File(filePath: string): string {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

describe("verifica allineamento byte-per-byte tra JSON in radice e platform/data/", () => {
  it("hash SHA-256 identico quando il monorepo include i file in radice", () => {
    for (const name of SYNC_FILES) {
      const platformPath = path.join(dataDir, name);
      const rootPath = path.resolve(process.cwd(), "..", name);
      expect(existsSync(platformPath)).toBe(true);
      if (!existsSync(rootPath)) {
        continue;
      }
      expect(sha256File(platformPath)).toBe(sha256File(rootPath));
    }
  });
});
