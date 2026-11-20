import { describe, expect, it } from "vitest";
import {
  conversionTierFromScore,
  getConversionCardTheme,
} from "@/lib/osservatorioConversionTheme";
import { getRegionalPartyHistory } from "@/lib/fnProgramAndAffinityEngine";
import { REGIONS } from "@/lib/engine/constants";

describe("getConversionCardTheme", () => {
  it("classifica soglie 80 / 50", () => {
    expect(conversionTierFromScore(85)).toBe("alta");
    expect(conversionTierFromScore(80)).toBe("alta");
    expect(conversionTierFromScore(79)).toBe("media");
    expect(conversionTierFromScore(50)).toBe("media");
    expect(conversionTierFromScore(49)).toBe("bassa");
  });

  it("allinea Veneto alta e Emilia bassa", () => {
    expect(getConversionCardTheme(getRegionalPartyHistory("Veneto").permeabilitaVannacciScore).tier).toBe(
      "alta",
    );
    expect(
      getConversionCardTheme(getRegionalPartyHistory("Emilia-Romagna").permeabilitaVannacciScore).tier,
    ).toBe("bassa");
  });

  it("20 regioni mappano su una delle 3 fasce", () => {
    for (const r of REGIONS) {
      const t = getConversionCardTheme(getRegionalPartyHistory(r).permeabilitaVannacciScore);
      expect(["alta", "media", "bassa"]).toContain(t.tier);
      expect(t.cardBg).toContain("gradient-to-br");
    }
  });
});
