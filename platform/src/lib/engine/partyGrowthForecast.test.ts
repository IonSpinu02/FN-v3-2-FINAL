import { describe, expect, it } from "vitest";
import { OFFICIAL_S } from "./defaults";
import { flussiFromMatrix } from "@/lib/politicalModel";
import {
  computePartyGrowthForecast,
  flussiGrowthBoostPp,
} from "./partyGrowthForecast";
import { calculate } from "./calculate";
import type { Region } from "./constants";
import type { EuRegion, FnConfig } from "./types";
import { readFileSync } from "fs";
import path from "path";
import { computeRegionalPoll } from "./regionalPoll";

const dataDir = path.join(process.cwd(), "data");

function load<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, name), "utf8")) as T;
}

describe("partyGrowthForecast", () => {
  it("regime organica su golden ~ +267k voti da 7,2%", () => {
    const cfg = load<FnConfig>("config_v3_2.json");
    const eu = load<{ D: Record<Region, EuRegion> }>("eu2024.json").D;
    const scenario = calculate(cfg, eu, 500);
    const poll = computeRegionalPoll(scenario);
    const totVoti = scenario.righe.reduce((s, r) => s + r.voti_di_scenario, 0);
    const out = computePartyGrowthForecast({
      startS: OFFICIAL_S,
      totVoti,
      regime: "organica",
      flussi: flussiFromMatrix("ipsos_luglio_2026"),
      rows: scenario.righe,
      poll,
    });
    expect(Number.isFinite(out.deltaPp)).toBe(true);
    expect(out.horizons).toHaveLength(3);
    expect(out.explanation.length).toBeGreaterThan(40);
    expect(out.topGains).toHaveLength(3);
    expect(out.trainanti + out.inCrescita + out.daRecuperare).toBe(20);
  });

  it("matrice Sky TG24 aumenta boost", () => {
    const boost = flussiGrowthBoostPp(flussiFromMatrix("skytg24_ottobre_2026"));
    expect(boost).toBeGreaterThan(0);
  });
});
