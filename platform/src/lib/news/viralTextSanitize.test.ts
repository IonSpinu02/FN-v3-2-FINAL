import { describe, expect, it } from "vitest";
import {
  containsBlockedEnglish,
  shortItalianHeadline,
  stripRawScrapeNoise,
} from "./viralTextSanitize";
import { enforceViewsAboveLikes, computeViralScore } from "./viralMetricsParser";
import { extractCommentIntel } from "./viralCommentIntel";

describe("viralTextSanitize", () => {
  it("rimuove markdown CDN Instagram", () => {
    const dirty =
      "[![Image 23: Video by Futuro Nazionale](https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/x.jpg)](https://instagram.com/p/x)";
    const clean = stripRawScrapeNoise(dirty);
    expect(clean).not.toMatch(/cdninstagram|scontent|!\[/);
    expect(clean.length).toBeLessThan(40);
  });

  it("blocca inglese", () => {
    expect(
      containsBlockedEnglish(
        "Who is ROBERTO VANNACCI: why the Italian right has started to be afraid of him",
      ),
    ).toBe(true);
  });

  it("headline max 110", () => {
    const long =
      "Degrado fuori dalla stazione centrale di Milano con baby gang e spaccio davanti ai pendolari. Seconda frase lunga inutilmente.";
    expect(shortItalianHeadline(long, 110).length).toBeLessThanOrEqual(112);
  });
});

describe("metriche coerenti", () => {
  it("views sempre >= likes*10", () => {
    expect(enforceViewsAboveLikes(764, 16_000)).toBeGreaterThanOrEqual(16_000 * 15);
  });

  it("score tra 74 e 97", () => {
    const s = computeViralScore({
      viewsCount: 400_000,
      likesCount: 28_000,
      commentsCount: 2_100,
      salt: "a",
    });
    expect(s).toBeGreaterThanOrEqual(74);
    expect(s).toBeLessThanOrEqual(97);
  });
});

describe("comment intel", () => {
  it("attacco ostile non diventa sostegno", () => {
    const intel = extractCommentIntel(
      "fulviobottiani1w I militari li avete mandati voi e siete tutti uguali alla canna del gas",
      "SICUREZZA",
      "Milano · Lombardia",
    );
    expect(intel.commentSentiment).toBe("ATTACCO / PROVOCAZIONE");
    expect(intel.commentMoodBadge).toMatch(/ATTACCO/i);
    expect(intel.topUserComment).not.toMatch(/cdninstagram|!\[|@utente:/);
  });

  it("non ricopia la descrizione del video come citazione @Quando", () => {
    const desc =
      "Quando si presenta una domanda di invalidità civile i tempi sono interminabili per le famiglie";
    const intel = extractCommentIntel(desc, "SANITA", "Lazio", desc);
    expect(intel.topUserComment).not.toMatch(/@Quando/i);
    expect(intel.topUserComment.toLowerCase()).not.toBe(
      `voce dai commenti: «${desc.toLowerCase()}»`,
    );
  });
});
