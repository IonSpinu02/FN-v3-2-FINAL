import { describe, expect, it } from "vitest";
import {
  cleanFeedLabel,
  hasInstitutionalNewsSignals,
  isElectionOrSeggiNews,
  matchesSearchQuery,
} from "./newsArticleFormat";

describe("cleanFeedLabel", () => {
  it("non va in stack overflow su URL RSS ANSA cronaca", () => {
    const label = cleanFeedLabel(
      "https://www.ansa.it/sito/notizie/cronaca/cronaca_rss.xml",
    );
    expect(label).toBe("ANSA · CRONACA NAZIONALE");
  });

  it("lascia invariata un etichetta editoriale già pulita", () => {
    expect(cleanFeedLabel("ANSA · REDAZIONE VENETO")).toBe(
      "ANSA · REDAZIONE VENETO",
    );
  });
});

describe("matchesSearchQuery", () => {
  const bologna = {
    titolo: "Sciopero generale a Bologna",
    sommario: "Tensione in Emilia-Romagna",
    suggestedComune: "Bologna",
    suggestedRegion: "Emilia-Romagna",
    source: "BOLOGNA TODAY",
  };

  it("Roma non matcha Emilia-Romagna", () => {
    expect(matchesSearchQuery(bologna, "Roma")).toBe(false);
  });

  it("accetta notizie su seggi e elezioni", () => {
    expect(
      isElectionOrSeggiNews(
        "Palermo, elezioni amministrative: piano seggi",
        "Presidenti di seggio in formazione",
      ),
    ).toBe(true);
    expect(
      hasInstitutionalNewsSignals(
        "Solo meteo in citta",
        "Pioggia prevista domani",
      ),
    ).toBe(false);
    expect(
      hasInstitutionalNewsSignals(
        "Consultazioni referendarie",
        "Urne e scrutinio domenica",
      ),
    ).toBe(true);
  });

  it("Roma matcha articolo capitolino", () => {
    expect(
      matchesSearchQuery(
        {
          titolo: "Comune di Roma, piano Atac",
          sommario: "Assemblea Capitolina",
          suggestedComune: "Roma",
          suggestedRegion: "Lazio",
          source: "ANSA",
        },
        "Roma",
      ),
    ).toBe(true);
  });
});
