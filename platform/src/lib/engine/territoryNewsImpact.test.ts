import { describe, expect, it } from "vitest";
import {
  assessNewsImpatto,
  detectNewsLocality,
  isFreshTerritoryNews,
  liveCandidateScore,
} from "./territoryNewsImpact";

describe("territoryNewsImpact", () => {
  const recent = new Date(Date.now() - 6 * 3600 * 1000).toISOString();

  it("protesta locale recente supera titolo generico", () => {
    const strong = assessNewsImpatto({
      titolo: "Sciopero TPL: 2 ore di ritardo, pendolari in protesta a Milano",
      snippet: "Centinaia di lavoratori bloccano la stazione. Code sui treni regionali.",
      pubDate: recent,
      categoria: "TRASPORTI",
      region: "Lombardia",
      sourceUrl: "https://www.ansa.it/lombardia/notizie/2026/01/01/sciopero",
    });
    const weak = assessNewsImpatto({
      titolo: "Trasporti in Lombardia",
      snippet: "Attualità mobilità.",
      pubDate: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
      categoria: "TRASPORTI",
      region: "Lombardia",
    });
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBeGreaterThanOrEqual(70);
    expect(weak.score).toBeLessThan(60);
    expect(detectNewsLocality("Sciopero a Milano", "protesta in piazza", "Lombardia")).toBe(
      "Milano",
    );
  });

  it("esclude cronaca oltre 31 giorni e preferisce articoli recenti", () => {
    const fresh = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    const stale = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString();
    expect(isFreshTerritoryNews(fresh)).toBe(true);
    expect(isFreshTerritoryNews(stale)).toBe(false);
    const recentScore = liveCandidateScore({ impattoScore: 72, pubDate: fresh });
    const oldScore = liveCandidateScore({ impattoScore: 72, pubDate: stale });
    expect(recentScore).toBeGreaterThan(oldScore);
  });

  it("emergenza sanitaria e numeri aumentano rilevanza", () => {
    const a = assessNewsImpatto({
      titolo: "Code al Pronto Soccorso: 12 ore di attesa, pazienti in allarme",
      snippet: "Liste d'attesa chirurgia fuori controllo in provincia.",
      pubDate: recent,
      categoria: "SANITA",
      region: "Lazio",
    });
    expect(a.score).toBeGreaterThanOrEqual(72);
    expect(a.summaryLabel).toMatch(/Rilevanza notizia/);
  });
});
