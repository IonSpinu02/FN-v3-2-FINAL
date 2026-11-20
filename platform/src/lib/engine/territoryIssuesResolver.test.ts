import { describe, expect, it } from "vitest";
import { electoralThemesForRegion } from "./territoryIssuesCatalog";
import {
  assembleRegionalIssueCards,
  computeElectionScore,
  mergeThemeWithLiveEvidence,
  rankNationalLiveIssues,
  selectRegionalDisplayIssues,
} from "./territoryIssuesResolver";
import { detectElectoralSubTheme } from "./territoryIssuesEngine";
import { REGIONAL_ELECTORAL_CATS } from "./territoryIssuesTypes";

describe("territoryIssuesResolver", () => {
  it("electoralThemesForRegion espone 6 macro-temi", () => {
    const themes = electoralThemesForRegion("Campania");
    expect(themes).toHaveLength(6);
    expect(themes.map((t) => t.categoria).sort()).toEqual(
      [...REGIONAL_ELECTORAL_CATS].sort(),
    );
  });

  it("mergeThemeWithLiveEvidence mantiene categoria pilastro", () => {
    const base = electoralThemesForRegion("Lazio")[0]!;
    const live = {
      ...base,
      id: "live-x",
      titoloProblema: "Protesta cittadini al PS: code notturne",
      sintesiLamentela: "Disservizi sanità metropolitana",
      impattoScore: 88,
      pubDate: new Date().toISOString(),
      contentSource: "live" as const,
    };
    const merged = mergeThemeWithLiveEvidence(base, live);
    expect(merged.categoria).toBe(base.categoria);
    expect(merged.contentSource).toBe("blended");
    expect(merged.titoloProblema).toContain("Protesta");
  });

  it("assembleRegionalIssueCards: tutte le live + fallback catalogo per temi vuoti", () => {
    const themes = electoralThemesForRegion("Veneto");
    const liveOnly = {
      ...themes[0]!,
      id: "live-a",
      titoloProblema: "Protesta pendolari Treviso",
      contentSource: "live" as const,
      live: true,
    };
    const { display, meta } = assembleRegionalIssueCards(
      [
        liveOnly,
        {
          ...liveOnly,
          id: "live-b",
          titoloProblema: "Altro disservizio bus",
          sourceUrl: "https://news.google.com/rss/articles/TEST_BUS_1",
        },
      ],
      themes,
      "Veneto",
      500_000,
    );
    expect(display.length).toBeGreaterThanOrEqual(6);
    expect(display.filter((d) => d.contentSource === "live")).toHaveLength(2);
    expect(meta.topStressCategory).toBeTruthy();
    const scores = display.map((d) => d.electionScore ?? 0);
    expect(scores[0]).toBeGreaterThanOrEqual(scores[scores.length - 1] ?? 0);
  });

  it("selectRegionalDisplayIssues senza live restituisce 6 schede catalogo", () => {
    const merged = electoralThemesForRegion("Veneto");
    const { display } = selectRegionalDisplayIssues(merged, "Veneto", 500_000);
    expect(display).toHaveLength(6);
  });

  it("detectElectoralSubTheme immigrazione ed energia", () => {
    expect(
      detectElectoralSubTheme(
        "Sbarchi e rimpatri",
        "immigrazione clandestina",
        "SICUREZZA",
      ),
    ).toBe("immigrazione");
    expect(
      detectElectoralSubTheme("Bollette gas", "caro energia", "COSTO_VITA"),
    ).toBe("energia");
  });

  it("rankNationalLiveIssues ordina per priorità e deduplica storie", () => {
    const themes = electoralThemesForRegion("Lazio");
    const campania = electoralThemesForRegion("Campania");
    const liveA = {
      ...themes[0]!,
      id: "live-lazio",
      regione: "Lazio" as const,
      titoloProblema: "Code pronto soccorso Roma",
      contentSource: "live" as const,
      live: true,
      impattoScore: 70,
      sourceUrl: "https://news.google.com/rss/articles/AAA",
    };
    const liveB = {
      ...campania[0]!,
      id: "live-camp",
      regione: "Campania" as const,
      titoloProblema: "Emergenza Cardarelli Napoli",
      contentSource: "live" as const,
      live: true,
      impattoScore: 92,
      sourceUrl: "https://news.google.com/rss/articles/BBB",
    };
    const ranked = rankNationalLiveIssues(
      [liveA, liveB],
      { Lazio: 400_000, Campania: 500_000 } as Record<
        import("./constants").Region,
        number
      >,
    );
    // Live + padding catalogo fino a 6 dossier minimi per il cockpit nazionale.
    expect(ranked.length).toBeGreaterThanOrEqual(2);
    expect(ranked).toHaveLength(6);
    expect(ranked[0]!.regione).toBe("Campania");
    expect(ranked[0]!.electionScore).toBeGreaterThanOrEqual(
      ranked[1]!.electionScore ?? 0,
    );
  });

  it("computeElectionScore differenzia regioni", () => {
    const lazio = electoralThemesForRegion("Lazio")[0]!;
    const emilia = electoralThemesForRegion("Emilia-Romagna")[0]!;
    const sLazio = computeElectionScore(lazio, "Lazio", 400_000);
    const sEmilia = computeElectionScore(emilia, "Emilia-Romagna", 400_000);
    expect(sLazio).not.toBe(sEmilia);
  });
});
