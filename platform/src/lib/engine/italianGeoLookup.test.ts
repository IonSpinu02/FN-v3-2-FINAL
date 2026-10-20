import { describe, expect, it } from "vitest";
import {
  detectInstitutionalRole,
  findComuneInText,
  findRegionInText,
  inferRegionFromFeedUrl,
  resolveGeoFromNews,
} from "./italianGeoLookup";

describe("italianGeoLookup", () => {
  it("inferRegionFromFeedUrl ANSA lombardia", () => {
    expect(
      inferRegionFromFeedUrl(
        "https://www.ansa.it/lombardia/notizie/lombardia_rss.xml",
      ),
    ).toBe("Lombardia");
  });

  it("findComune e regione da testo", () => {
    expect(findComuneInText("Il sindaco di Bergamo annuncia")).toBe("Bergamo");
    expect(findRegionInText("Il sindaco di Bergamo annuncia")).toBe("Lombardia");
    expect(findRegionInText("Consiglio regionale in Toscana")).toBe("Toscana");
  });

  it("detectInstitutionalRole", () => {
    expect(detectInstitutionalRole("eletto sindaco di Parma")).toBe("sind");
    expect(detectInstitutionalRole("consigliere regionale veneto")).toBe(
      "creg",
    );
    expect(detectInstitutionalRole("onorevole deposita ddl")).toBe("dep");
  });

  it("resolveGeoFromNews combina feed e testo", () => {
    const g = resolveGeoFromNews(
      "Dimissioni sindaco di Firenze",
      "La giunta comunale",
      "https://www.ansa.it/toscana/notizie/toscana_rss.xml",
    );
    expect(g.suggestedRegion).toBe("Toscana");
    expect(g.suggestedComune).toBe("Firenze");
    expect(g.suggestedRole).toBe("sind");
  });
});
