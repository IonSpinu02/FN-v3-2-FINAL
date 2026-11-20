import { describe, expect, it } from "vitest";
import golden from "../../../data/risultati_v3_2.json";
import type { ScenarioResult } from "./types";
import {
  computeIndiceForzaTerritoriale,
  strengthBandFromIndex,
} from "./regionalPartyStrength";

const scenario = golden as unknown as ScenarioResult;

describe("regionalPartyStrength", () => {
  it("Veneto and Umbria indices match dirigenziale banding", () => {
    const righe = scenario.righe;
    const veneto = righe.find((r) => r.regione === "Veneto")!;
    const umbria = righe.find((r) => r.regione === "Umbria")!;
    const iVen = computeIndiceForzaTerritoriale(veneto, righe);
    const iUmb = computeIndiceForzaTerritoriale(umbria, righe);
    expect(iVen).toBeGreaterThanOrEqual(0.85);
    expect(iUmb).toBeLessThanOrEqual(0.25);
    expect(strengthBandFromIndex(iVen)).toBe("FORTE");
    expect(strengthBandFromIndex(iUmb)).toBe("DEBOLE");
  });
});
