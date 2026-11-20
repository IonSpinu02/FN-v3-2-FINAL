import { describe, expect, it } from "vitest";
import {
  buildCampaignPriorityLists,
  computeIssueConversionGain,
  computePermeabilitaVannacciScore,
  getRegionalPartyHistory,
  REGIONAL_PARTY_HISTORY,
  simulateSelectedIssuesGain,
} from "./fnProgramAndAffinityEngine";
import { REGIONS } from "@/lib/engine/constants";

describe("fnProgramAndAffinityEngine", () => {
  it("covers all 20 regions", () => {
    for (const r of REGIONS) {
      expect(REGIONAL_PARTY_HISTORY[r]).toBeDefined();
    }
  });

  it("calibrates permeabilità on reference regions", () => {
    expect(getRegionalPartyHistory("Veneto").permeabilitaVannacciScore).toBeGreaterThanOrEqual(
      88,
    );
    expect(getRegionalPartyHistory("Lombardia").permeabilitaVannacciScore).toBeGreaterThanOrEqual(
      85,
    );
    expect(getRegionalPartyHistory("Emilia-Romagna").permeabilitaVannacciScore).toBeLessThanOrEqual(
      32,
    );
    expect(getRegionalPartyHistory("Toscana").permeabilitaVannacciScore).toBeLessThanOrEqual(35);
  });

  it("yields higher pp gain in Veneto vs Emilia for same issue", () => {
    const ven = computeIssueConversionGain("Veneto", "SICUREZZA", 80, 2_000_000);
    const emi = computeIssueConversionGain("Emilia-Romagna", "SICUREZZA", 80, 2_000_000);
    expect(ven.potentialGainPp).toBeGreaterThan(emi.potentialGainPp * 2);
    expect(ven.campaignVerdict).toBe("PRIORITA_ASSOLUTA");
    expect(emi.campaignVerdict).toBe("SCONSIGLIATO_MURO_PD");
  });

  it("builds priority lists", () => {
    const rows = REGIONS.map((regione) => ({
      regione,
      stima: 0.07,
      voti_di_scenario: 200_000,
    }));
    const { altaConversione, bassaConversione } = buildCampaignPriorityLists(rows);
    expect(altaConversione.some((r) => r.regione === "Veneto")).toBe(true);
    expect(bassaConversione.some((r) => r.regione === "Emilia-Romagna")).toBe(true);
  });

  it("simulateSelectedIssuesGain somma esattamente le card In stima", () => {
    const conv = (pp: number, votes: number) => ({
      potentialGainPp: pp,
      potentialNewVotes: votes,
    });
    const issues = [
      { id: "a", categoria: "SANITA" as const, impattoScore: 90, conversion: conv(0.59, 24_808) },
      { id: "b", categoria: "TRASPORTI" as const, impattoScore: 88, conversion: conv(0.57, 23_959) },
    ];
    const sum = simulateSelectedIssuesGain("Lombardia", ["a", "b"], issues, 4_000_000);
    expect(sum.totalPp).toBeCloseTo(1.16, 5);
    expect(sum.totalVotes).toBe(48_767);
  });

  it("computePermeabilitaVannacciScore is stable", () => {
    const h = getRegionalPartyHistory("Piemonte");
    expect(computePermeabilitaVannacciScore(h)).toBe(h.permeabilitaVannacciScore);
  });
});
