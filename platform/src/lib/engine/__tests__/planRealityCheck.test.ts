import { describe, expect, it } from "vitest";
import { assessPlanPlausibility } from "@/lib/engine/planRealityCheck";
import type { StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";

function fakePlan(over: Partial<StrategicBackcastResult>): StrategicBackcastResult {
  return {
    currentPct: 7.2,
    targetPct: 12,
    offensiveCentral: 8.3,
    groundingShare: 0.25,
    regions: [{ addedVotes: 600_000 }, { addedVotes: 500_000 }] as StrategicBackcastResult["regions"],
    ...over,
  } as StrategicBackcastResult;
}

describe("assessPlanPlausibility", () => {
  it("classifica il ritmo di crescita contro gli analoghi", () => {
    expect(assessPlanPlausibility(fakePlan({ targetPct: 7.8 }), 360).verdict).toBe("PLAUSIBILE");
    expect(assessPlanPlausibility(fakePlan({ targetPct: 9.5 }), 360).verdict).toBe("AMBIZIOSO");
    expect(assessPlanPlausibility(fakePlan({ targetPct: 12 }), 360).verdict).toBe("ECCEZIONALE");
    expect(assessPlanPlausibility(fakePlan({ targetPct: 16 }), 360).verdict).toBe("RICHIEDE_SHOCK_ESTERNO");
  });

  it("espone quanta crescita dipende da un fattore esterno", () => {
    const check = assessPlanPlausibility(fakePlan({}), 360);
    expect(check.v4CoveredPp).toBeCloseTo(1.1, 6);
    expect(check.catalystShare).toBeCloseTo(1 - 1.1 / 4.8, 6);
    expect(check.flags.some((flag) => flag.severity === "allarme" || flag.severity === "attenzione")).toBe(true);
  });

  it("traduce la mobilitazione in contatti e persone, con intervallo", () => {
    const check = assessPlanPlausibility(fakePlan({}), 360);
    expect(check.groundGame.mobilizedVotes).toBe(275_000);
    expect(check.groundGame.contactsHigh).toBeGreaterThan(check.groundGame.contactsLow);
    expect(check.groundGame.contactsLow).toBe(275_000 * 14);
    expect(check.groundGame.fullTimeCanvassersHigh).toBeGreaterThan(check.groundGame.fullTimeCanvassersLow);
    expect(check.groundGame.note).toMatch(/persuasione/);
  });

  it("cita fonti per gli analoghi e dichiara i limiti", () => {
    const check = assessPlanPlausibility(fakePlan({}), 360);
    expect(check.analogs.length).toBeGreaterThanOrEqual(2);
    for (const analog of check.analogs) {
      expect(analog.source.length).toBeGreaterThan(3);
      expect(analog.ppPerMonth).toBeCloseTo(analog.gainPp / analog.months, 8);
    }
    expect(check.caveats.length).toBeGreaterThanOrEqual(3);
    expect(check.pollNoise.singlePollSdPp).toBeGreaterThan(0.5);
    expect(check.pollNoise.systematicSdPp).toBeCloseTo(7.2 * 0.12, 6);
  });

  it("non produce testi con le etichette vietate", () => {
    const text = JSON.stringify(assessPlanPlausibility(fakePlan({}), 360));
    for (const rule of [/Conv\.\s*\d/, /Interesse Google \(30[gG]\)/, /Cosa cercano su Google/]) expect(text).not.toMatch(rule);
  });
});
