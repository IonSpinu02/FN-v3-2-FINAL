import { describe, expect, it } from "vitest";
import { regioneForComune } from "@/lib/engine/capoluoghiToRegione";
import {
  analyzeInstitutionalArticle,
  matchesNewsSearch,
} from "@/lib/engine/newsInstitutionalAnalyzer";

describe("newsReliability", () => {
  it("Roma non matcha Emilia-Romagna in matchesNewsSearch", () => {
    const bologna = {
      titolo: "Bologna, consiglio comunale su urbanistica",
      sommario: "Dibattito in Emilia-Romagna",
      suggestedComune: "Bologna",
      suggestedRegion: "Emilia-Romagna",
      source: "IL RESTO DEL CARLINO",
    };
    const roma = {
      titolo: "Comune di Roma, assemblea capitolina",
      sommario: "Sindaco e consiglio comunale nel Lazio",
      suggestedComune: "Roma",
      suggestedRegion: "Lazio",
      source: "ANSA LAZIO",
    };
    expect(matchesNewsSearch(bologna, "Roma")).toBe(false);
    expect(matchesNewsSearch(roma, "Roma")).toBe(true);
  });

  it("Bologna forza Emilia-Romagna anche con feed Lazio", () => {
    const analyzed = analyzeInstitutionalArticle({
      titolo: "Bologna, consiglio comunale approva il piano",
      snippet: "I consiglieri comunali votano in aula",
      feedUrl: "https://www.ansa.it/lazio/notizie/lazio_rss.xml",
      feedRegionHint: "Lazio",
    });
    expect(analyzed).not.toBeNull();
    expect(analyzed!.regione).toBe("Emilia-Romagna");
    expect(regioneForComune("Bologna")).toBe("Emilia-Romagna");
  });

  it("scarta sindacalista sciopero e sindacati", () => {
    expect(
      analyzeInstitutionalArticle({
        titolo: "Addio a Simone Foresti, storico sindacalista",
        snippet: "Funeral house",
        feedUrl: "https://feed.test",
      }),
    ).toBeNull();
    expect(
      analyzeInstitutionalArticle({
        titolo: "Sciopero generale, sindacati in piazza",
        snippet: "CGIL e UIL",
        feedUrl: "https://feed.test",
      }),
    ).toBeNull();
  });

  it("scarta meteo arpal e funeral house", () => {
    expect(
      analyzeInstitutionalArticle({
        titolo: "Allerta arancione per temporali in Liguria - Arpal",
        snippet: "Meteo",
        feedUrl: "https://feed.test",
      }),
    ).toBeNull();
  });

  it("accetta Verona con geo e confidence >= 85", () => {
    const analyzed = analyzeInstitutionalArticle({
      titolo:
        "Verona, giunta e sindaco approvano il piano trasporti in consiglio comunale",
      snippet: "Consiglieri comunali presenti in aula",
      feedUrl: "https://www.ansa.it/veneto/notizie/veneto_rss.xml",
    });
    expect(analyzed).not.toBeNull();
    expect(analyzed!.comune).toBe("Verona");
    expect(analyzed!.regione).toBe("Veneto");
    expect(analyzed!.confidenceScore).toBeGreaterThanOrEqual(85);
  });
});
