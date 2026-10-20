import { describe, expect, it } from "vitest";
import type { FabbisognoIndicatore } from "./osservatorioTypes";
import type { ScenarioRow } from "./types";
import {
  buildFabbisognoDomainTags,
  computeResolvedTerritorialStress,
  REGION_REFERENCE_STRESS,
} from "./fabbisogniCatalogFallback";
import {
  computeMobilizationContext,
  computeTerritorialStress,
  indicatorStressScore,
} from "./territorialIntelligence";
import type { Region } from "./constants";

function ind(
  id: string,
  tema: string,
  valore: number | null,
): FabbisognoIndicatore {
  return {
    id,
    tema,
    indicatore: null,
    valore,
    unita: "%",
    periodoRiferimento: "2024",
    metadati: {
      fonte: "test",
      territorio: "Test",
      popolazioneRiferimento: "N",
      periodoMisurato: "2024",
      dataPubblicazione: "2025",
      metodo: "test",
      naturaDato: "osservato",
      gradoConfrontabilita: "test",
    },
  };
}

describe("territorialIntelligence", () => {
  it("indicatorStressScore inverts employment", () => {
    expect(indicatorStressScore(ind("x-lavoro", "Lavoro", 70))).toBe(30);
    expect(indicatorStressScore(ind("x-lavoro", "Lavoro", null))).toBeNull();
  });

  it("computeTerritorialStress averages populated indicators", () => {
    const r = computeTerritorialStress([
      ind("a-lavoro", "Lavoro", 60),
      ind("b-sanita", "Sanità", 20),
      ind("c-abitare", "Abitare", null),
    ]);
    expect(r.populated).toBe(2);
    expect(r.aggregate).toBe(Math.round((40 + 30) / 2));
  });

  it("buildFabbisognoDomainTags falls back when indicatori missing", () => {
    const tags = buildFabbisognoDomainTags([], "Veneto" as Region);
    expect(tags.length).toBeGreaterThanOrEqual(2);
    expect(tags[0]?.label).toMatch(/SANITÀ/);
    expect(tags.some((t) => t.label.includes("IMPRESE"))).toBe(true);
  });

  it("buildFabbisognoDomainTags differs by region", () => {
    const cal = buildFabbisognoDomainTags([], "Calabria" as Region);
    const ven = buildFabbisognoDomainTags([], "Veneto" as Region);
    expect(cal[0]?.label).not.toBe(ven[0]?.label);
  });

  it("computeResolvedTerritorialStress never returns empty for catalog shape", () => {
    const inds = [
      ind("calabria-sanita", "Sanità", null),
      ind("calabria-lavoro", "Lavoro", null),
      ind("calabria-abitare", "Abitare", null),
      ind("calabria-trasporti", "Trasporti", null),
    ];
    const r = computeResolvedTerritorialStress(inds, "Calabria" as Region);
    expect(r.aggregate).toBeGreaterThan(0);
    expect(r.scores.every((s) => s.stress != null)).toBe(true);
    expect(REGION_REFERENCE_STRESS.Calabria).toBe(78);
  });

  it("computeMobilizationContext exposes astenuti and iscritti", () => {
    const row = {
      regione: "Lazio",
      elettori_ricostruiti: 4000000,
      astenuti_ricostruiti: 2400000,
      iscritti: 12000,
      voti_di_scenario: 180000,
      affluenza2024: 40,
    } as ScenarioRow;
    const m = computeMobilizationContext(row);
    expect(m.astenutiPct).toBeCloseTo(60, 0);
    expect(m.iscrittiFn).toBe(12000);
    expect(m.naturaDato).toBe("simulazione");
  });
});
