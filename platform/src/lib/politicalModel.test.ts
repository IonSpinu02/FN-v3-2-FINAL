import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/engine/calculate";
import type { Region } from "@/lib/engine/constants";
import type { EuRegion, FnConfig } from "@/lib/engine/types";
import { readFileSync } from "fs";
import path from "path";
import {
  DEFAULT_FLUSSI_MATRIX_ID,
  computeRegionalGrowthForecast,
  detectFlussiMatrixId,
  flussiFromMatrix,
  flussiQuotesEqual,
  isOfficialFlussi,
} from "./politicalModel";

const dataDir = path.join(process.cwd(), "data");

function load<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, name), "utf8")) as T;
}

describe("politicalModel", () => {
  it("due matrici ufficiali con residuo esplicito", () => {
    const ipsos = flussiFromMatrix("ipsos_luglio_2026");
    const sky = flussiFromMatrix("skytg24_ottobre_2026");
    expect(ipsos.FdI + ipsos.Lega + ipsos.ast + (ipsos.altri ?? 0)).toBeCloseTo(1, 6);
    expect(sky.FdI + sky.Lega + sky.ast + (sky.altri ?? 0)).toBeCloseTo(1, 6);
    expect(detectFlussiMatrixId(ipsos)).toBe("ipsos_luglio_2026");
    expect(detectFlussiMatrixId(sky)).toBe("skytg24_ottobre_2026");
    expect(isOfficialFlussi(ipsos)).toBe(true);
    expect(isOfficialFlussi(sky)).toBe(false);
  });

  it("Sky TG24 alza il bacino f_i vs Ipsos (astensione 57,4%)", () => {
    const cfg = JSON.parse(
      readFileSync(path.join(dataDir, "config_v3_2.json"), "utf8"),
    ) as FnConfig;
    const eu = JSON.parse(
      readFileSync(path.join(dataDir, "eu2024.json"), "utf8"),
    ).D as Record<Region, EuRegion>;
    const base = calculate(cfg, eu, 0);
    const sky = calculate(cfg, eu, 0, {
      flussi_ipsos: flussiFromMatrix("skytg24_ottobre_2026"),
    });
    const r = "Lombardia" as Region;
    expect(sky.righe.find((x) => x.regione === r)!.f).not.toBeCloseTo(
      base.righe.find((x) => x.regione === r)!.f,
      5,
    );
  });

  it("computeRegionalGrowthForecast produce traiettoria 8 mesi", () => {
    const cfg = load<FnConfig>("config_v3_2.json");
    const eu = load<{ D: Record<Region, EuRegion> }>("eu2024.json").D;
    const scenario = calculate(cfg, eu, 500);
    const row = scenario.righe.find((r) => r.regione === "Veneto")!;
    const out = computeRegionalGrowthForecast(
      {
        regione: row.regione,
        stima: row.stima,
        p: row.p,
        q: row.q,
        f: row.f,
        voti_di_scenario: row.voti_di_scenario,
        iscritti: row.iscritti,
        piHat: row.stima,
      },
      0.072,
      "organica",
      "ipsos_luglio_2026",
    );
    expect(out.monthlyTrajectory).toHaveLength(8);
    expect(Number.isFinite(out.deltaPp)).toBe(true);
    expect(Number.isFinite(out.addedVotes)).toBe(true);
  });

  it("default matrix id è Ipsos luglio", () => {
    expect(DEFAULT_FLUSSI_MATRIX_ID).toBe("ipsos_luglio_2026");
    expect(flussiQuotesEqual(flussiFromMatrix("ipsos_luglio_2026"), flussiFromMatrix("ipsos_luglio_2026"))).toBe(
      true,
    );
  });
});
