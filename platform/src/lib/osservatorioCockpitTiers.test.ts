import { describe, expect, it } from "vitest";
import type { Region } from "@/lib/engine/constants";
import {
  COCKPIT_TIER_GIALLO,
  COCKPIT_TIER_ROSSO,
  COCKPIT_TIER_VERDE,
  cockpitTierForRegion,
  regionsForCockpitFilter,
  sortRegionsByTierThenVotes,
} from "@/lib/osservatorioCockpitTiers";

describe("osservatorioCockpitTiers", () => {
  it("Calabria è verde e Emilia-Romagna rossa", () => {
    expect(cockpitTierForRegion("Calabria")).toBe("verde");
    expect(cockpitTierForRegion("Emilia-Romagna")).toBe("rosso");
  });

  it("copre 20 regioni", () => {
    expect(COCKPIT_TIER_VERDE.length).toBe(8);
    expect(COCKPIT_TIER_GIALLO.length).toBe(7);
    expect(COCKPIT_TIER_ROSSO.length).toBe(5);
  });

  it("ordina menu: verdi prima delle rosse (Campania dopo Abruzzo)", () => {
    const votes = new Map<Region, number>();
    for (const r of regionsForCockpitFilter("all")) {
      votes.set(r, r === "Campania" ? 999_999 : 1);
    }
    const sorted = sortRegionsByTierThenVotes(regionsForCockpitFilter("all"), votes);
    expect(sorted.indexOf("Abruzzo")).toBeLessThan(sorted.indexOf("Campania"));
    expect(cockpitTierForRegion(sorted[0]!)).toBe("verde");
    expect(cockpitTierForRegion(sorted[sorted.length - 1]!)).toBe("rosso");
  });
});
