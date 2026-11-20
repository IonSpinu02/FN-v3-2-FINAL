import { describe, expect, it } from "vitest";
import { REGIONS } from "./constants";
import { provincesForRegion } from "./italianProvinces";

describe("italianProvinces", () => {
  it("every region has province list including aggregate option", () => {
    for (const r of REGIONS) {
      const list = provincesForRegion(r);
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list[0]).toMatch(/^Tutte le province/);
    }
  });

  it("Lazio includes Roma and province capitals", () => {
    const lazio = provincesForRegion("Lazio");
    expect(lazio).toContain("Roma");
    expect(lazio).toContain("Latina");
    expect(lazio).toContain("Frosinone");
  });

  it("Veneto includes major provinces", () => {
    const veneto = provincesForRegion("Veneto");
    expect(veneto).toContain("Venezia");
    expect(veneto).toContain("Verona");
    expect(veneto).toContain("Padova");
  });
});
