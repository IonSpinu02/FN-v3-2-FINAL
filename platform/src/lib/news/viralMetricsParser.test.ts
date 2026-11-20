import { describe, expect, it } from "vitest";
import {
  finalizeMetrics,
  formatViralCount,
  parseViralMetricsFromText,
} from "./viralMetricsParser";
import { extractHandle } from "./tavilyViralVideosEngine";
import { normalizeUserCommentBlob } from "./viralCommentIntel";

describe("viralMetricsParser", () => {
  it("estrae like e commenti in italiano", () => {
    const m = parseViralMetricsFromText("45.2K Mi piace, 1.8K Commenti, 120K views");
    expect(m.likesCount).toBeGreaterThan(40_000);
    expect(m.commentsCount).toBeGreaterThan(1_000);
    expect(m.viewsCount).toBe(120_000);
    expect(m.viewsEstimated).toBe(false);
  });

  it("non confonde timestamp 1w/3d con like", () => {
    const m = parseViralMetricsFromText(
      "fulviobottiani1w Ma non dite cazzate · 3d ago · Like · Comment",
    );
    expect(m.likesCount).toBeNull();
    expect(m.commentsCount).toBeNull();
    const fin = finalizeMetrics(m, {
      viralScoreHint: 70,
      title: "Degrado stazione",
      url: "https://www.tiktok.com/@x/video/1",
    });
    expect(fin.viewsCount).toBeGreaterThanOrEqual(45_000);
    expect(fin.likesCount).toBeGreaterThanOrEqual(3_200);
    expect(fin.commentsCount).toBeGreaterThanOrEqual(180);
  });

  it("formatta contatori IT", () => {
    expect(formatViralCount(1_200_000)).toContain("MLN");
    expect(formatViralCount(45_200)).toContain("K");
  });
});

describe("extractHandle", () => {
  it("prende @ da URL TikTok e rifiuta email/@autore", () => {
    expect(
      extractHandle("https://www.tiktok.com/@cronaca.mi/video/123", "", null),
    ).toBe("@cronaca.mi");
    expect(
      extractHandle("https://vm.tiktok.com/xyz", "contatta info@gmail.com", null),
    ).not.toMatch(/gmail|autore/i);
  });
});

describe("normalizeUserCommentBlob", () => {
  it("spezza username+timestamp", () => {
    const n = normalizeUserCommentBlob(
      "fulviobottiani1w Ma non dite cazzate i militari hanno le mani legate",
    );
    expect(n?.handle).toBe("@fulviobottiani");
    expect(n?.text).toMatch(/militari/i);
  });

  it("non inventa @Quando dalla prima parola della descrizione", () => {
    const n = normalizeUserCommentBlob(
      "Quando si presenta una domanda di invalidità civile i tempi sono interminabili",
    );
    expect(n?.handle).not.toMatch(/@Quando/i);
    expect(n?.handle).toMatch(/commenti|thread|Voce/i);
  });
});
