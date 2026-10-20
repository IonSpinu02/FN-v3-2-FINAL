import { describe, expect, it } from "vitest";
import { calculate } from "./calculate";
import { loadJson } from "./loadData";
import type { Region } from "./constants";
import type { EuRegion, FnConfig, ScenarioResult } from "./types";

describe("calculate overrides (non golden default)", () => {
  const cfg = loadJson<FnConfig>("config_v3_2.json");
  const eu = loadJson<{ D: Record<Region, EuRegion> }>("eu2024.json").D;
  const golden = loadJson<ScenarioResult>("risultati_v3_2.json");

  it("default senza overrides = golden stima Piemonte", () => {
    const out = calculate(cfg, eu, 20000);
    const g = golden.righe.find((r) => r.regione === "Piemonte")!;
    const o = out.righe.find((r) => r.regione === "Piemonte")!;
    expect(o.stima).toBeCloseTo(g.stima, 10);
    expect(o.p).toBeCloseTo(g.p, 10);
  });

  it("istituzioniDelta aumenta punti istituzionali Lombardia", () => {
    const base = calculate(cfg, eu, 0);
    const lombBase = base.righe.find((r) => r.regione === "Lombardia")!;
    const bumped = calculate(cfg, eu, 0, {
      istituzioniDelta: {
        Lombardia: { com: 5 },
      },
    });
    const lombNew = bumped.righe.find((r) => r.regione === "Lombardia")!;
    expect(lombNew.punti_istituzionali).toBeGreaterThan(
      lombBase.punti_istituzionali,
    );
    expect(lombNew.stima).not.toBeCloseTo(lombBase.stima, 8);
  });

  it("flussi_ipsos override cambia mix flussi", () => {
    const base = calculate(cfg, eu, 0);
    const alt = calculate(cfg, eu, 0, {
      flussi_ipsos: { FdI: 0.5, Lega: 0.2, ast: 0.2 },
    });
    const r = "Veneto" as Region;
    expect(alt.righe.find((x) => x.regione === r)!.f).not.toBeCloseTo(
      base.righe.find((x) => x.regione === r)!.f,
      6,
    );
  });
});
