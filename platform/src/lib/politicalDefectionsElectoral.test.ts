import { describe, expect, it } from "vitest";
import { computeDoteFromElectoralRecord, formatDoteStimaNota } from "@/lib/politicalDefectionsElectoral";
import { INITIAL_TRACKED_POLITICIANS } from "@/lib/politicalDefectionsCatalog";
import {
  countAnagrafeByFilter,
  formatCleanConstituency,
  isExcludedGuaranteePolitician,
  transizioneLabel,
} from "@/lib/politicalDefectionsEngine";

describe("computeDoteFromElectoralRecord", () => {
  it("applica coefficiente rumor su uninominale", () => {
    const d = computeDoteFromElectoralRecord(
      {
        kind: "camera_uninominal_2022",
        preferenzeStoriche: 57_691,
        collegioLabel: "Calabria-U01",
        sourceLabel: "Test",
        sourceUrl: "https://example.com",
      },
      "Calabria",
      "RUMOR_FN_VERIFICATO",
    );
    expect(d.votiPortatiStimati).toBe(Math.round(57_691 * 0.22));
    expect(d.votiStimaNota).toContain(formatDoteStimaNota("camera_uninominal_2022"));
    expect(d.votiStimaNota).toMatch(/coeff\.\s*0\.220/);
  });
});

describe("formatCleanConstituency", () => {
  it("rimuove doppie parentesi e ripetizioni regione", () => {
    expect(formatCleanConstituency("Veneto", "Veneto (Verona (Camera U06))")).toBe(
      "Veneto · Verona (U06)",
    );
    expect(formatCleanConstituency("Lombardia", "Lombardia 3-P02 (Brescia)")).toBe(
      "Lombardia · Brescia (P02)",
    );
    expect(formatCleanConstituency("Sicilia", "Ragusa (Camera U01)")).toBe(
      "Sicilia · Ragusa (U01)",
    );
  });
});

describe("INITIAL_TRACKED_POLITICIANS", () => {
  it("include solo esterni con cambio gruppo (no FN ufficiali)", () => {
    const counts = countAnagrafeByFilter(INITIAL_TRACKED_POLITICIANS, "ALL");
    expect(counts.ALL).toBeGreaterThan(0);
    expect(INITIAL_TRACKED_POLITICIANS.some((p) => p.stato === "UFFICIALE_FN")).toBe(false);
    expect(INITIAL_TRACKED_POLITICIANS.some((p) => p.nome.includes("Vannacci"))).toBe(false);
    expect(INITIAL_TRACKED_POLITICIANS.some((p) => p.nome.includes("Fontana"))).toBe(false);
    expect(INITIAL_TRACKED_POLITICIANS.some((p) => p.nome.includes("Crippa"))).toBe(false);
    expect(INITIAL_TRACKED_POLITICIANS.some((p) => p.nome.includes("Sbardella"))).toBe(false);
  });

  it("espone beneficioIngressoFn su ogni profilo", () => {
    for (const p of INITIAL_TRACKED_POLITICIANS) {
      expect(p.beneficioIngressoFn?.votiPortatiStimati).toBeGreaterThan(0);
      expect(p.beneficioIngressoFn?.affinitaProgrammaticaBip).toMatch(/^Cap\./);
    }
  });

  it("Messina ha etichetta cambio gruppo FdI → Misto", () => {
    const m = INITIAL_TRACKED_POLITICIANS.find((p) => p.nome.includes("Messina"));
    expect(transizioneLabel(m!)).toMatch(/Fratelli d'Italia → Gruppo Misto/);
  });

  it("esclude cariche di garanzia dal radar", () => {
    expect(isExcludedGuaranteePolitician("Lorenzo Fontana")).toBe(true);
  });
});
