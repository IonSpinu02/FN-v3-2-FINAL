import { describe, expect, it } from "vitest";
import { REGIONS } from "./constants";
import { buildExecutiveStrategicBriefing } from "./strategicBriefingEngine";
import { projectMonths, type GrowthEvidence } from "./growthTrajectory";

const evidence: GrowthEvidence = {
  slopePpPerMonth: -0.75,
  newsScore: -0.5,
  bipMatches: 0,
  newsHeadlines: [
    "Vannacci e Futuro Nazionale, quanto valgono in Liguria?",
    "Vannacci perde pezzi nei sondaggi di novembre",
  ],
  bipLabels: [],
  slopeFrom: "2026-09-08",
  slopeTo: "2026-11-04",
};

describe("strategicBriefingEngine", () => {
  it("i sei pesi sommano 100 e economia e sociale non inventano punti", () => {
    const asOf = new Date("2026-11-04T12:00:00Z");
    const projection = projectMonths({
      startPct: 6.29,
      evidence,
      months: 1,
      sensitivity: 0.7,
      asOf,
      abstentionShare: 0.36,
    });
    const brief = buildExecutiveStrategicBriefing({
      startPct: 6.29,
      evidence,
      projection,
      abstentionShare: 0.36,
      scenarioRows: REGIONS.map((regione) => ({
        regione,
        preferenze: 1_000,
        tipo_preferenze: "ricostruito" as const,
        iscritti: 500,
      })),
    });
    expect(brief.macroFactors).toHaveLength(6);
    expect(brief.macroFactors.reduce((sum, row) => sum + row.weightPct, 0)).toBe(100);
    expect(brief.macroFactors.find((row) => row.id === "economia")?.impactPp).toBeNull();
    expect(brief.macroFactors.find((row) => row.id === "sociale")?.impactPp).toBeNull();
    expect(brief.macroFactors.find((row) => row.id === "demoscopia")?.impactPp).toBe(projection.slopePp);
    expect(brief.remediationPlan.atti).toHaveLength(3);
    expect(brief.remediationPlan.direttrici).toHaveLength(3);
    expect(brief.causalDiagnosis.sintesiEsecutiva).not.toMatch(/voti/i);
    expect(brief.remediationPlan.dichiarazione.startsWith("Bozza per lo staff")).toBe(true);
    expect(brief.remediationPlan.dichiarazione).not.toContain("Quoziente Familiare");
    expect(brief.causalDiagnosis.anatomiaDelMovimento).not.toContain("Pagnoncelli");
    expect(brief.causalDiagnosis.anatomiaDelMovimento).not.toContain("Radio Cusano");
    const demoscopia = brief.macroFactors.find((row) => row.id === "demoscopia");
    expect(demoscopia?.evidence).toContain("Pagnoncelli");
    expect(demoscopia?.evidence).toContain("Radio Cusano");
    const stampa = brief.macroFactors.find((row) => row.id === "stampa");
    expect(stampa?.evidence).toContain("1 con parole di calo, 1 neutro");
    expect(stampa?.evidence).toContain("Titolo trainante sul segno: «Vannacci perde pezzi");
    expect(stampa?.evidence).not.toContain("Primo titolo");
    expect(stampa?.evidence).not.toContain("Liguria");
    const economia = brief.macroFactors.find((row) => row.id === "economia");
    expect(economia?.evidence).not.toMatch(/riga di punti/i);
    const demoscopiaText = brief.macroFactors.find((row) => row.id === "demoscopia")?.evidence ?? "";
    expect(demoscopiaText).not.toMatch(/% \./);
    for (const row of brief.remediationPlan.direttrici) {
      expect(row.piazza.length).toBeGreaterThan(10);
      expect(row.cdxPct).toBeCloseTo(row.fdiPct + row.legaPct, 1);
      expect(row.iscritti).toBe(500);
      expect(row.preferenzeTipo).toBe("ricostruito");
    }
    for (const act of brief.remediationPlan.atti) {
      expect(act.body.startsWith(act.title)).toBe(false);
    }
  });
});
