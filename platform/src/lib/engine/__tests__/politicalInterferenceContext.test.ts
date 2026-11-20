import { describe, expect, it } from "vitest";
import { buildPoliticalInterferenceContext } from "@/lib/engine/politicalInterferenceContext";

describe("buildPoliticalInterferenceContext", () => {
  it("costruisce disagio regionale, competitor, eventi e vettori UE dai dati Osservatorio/catalogo", () => {
    const ctx = buildPoliticalInterferenceContext({
      regions: ["Lombardia", "Veneto", "Piemonte", "Campania"],
      themes: ["Sicurezza", "Liste d'attesa Sanità"],
      horizonDays: 360,
    });
    expect(ctx.regionalDiscontent.length).toBeGreaterThan(4);
    expect(ctx.regionalDiscontent.every((row) => row.epistemic === "STIMA MODELLO")).toBe(true);
    expect(ctx.competitorDynamics.governmentArena.length).toBeGreaterThan(40);
    expect(ctx.competitorDynamics.oppositionArena.length).toBeGreaterThan(40);
    expect(ctx.competitorDynamics.pressHotThemes.length).toBeGreaterThan(0);
    expect(ctx.eventsAndCalendar.length).toBeGreaterThan(1);
    expect(ctx.internationalAndEu.length).toBeGreaterThan(1);
    expect(ctx.summaryForPrompt).toMatch(/DISAGIO SOCIALE/);
    expect(ctx.summaryForPrompt).toMatch(/AGENAS|BesT|stress/i);
    expect(JSON.stringify(ctx).toLowerCase()).not.toMatch(/\bsolver\b/);
  });
});
