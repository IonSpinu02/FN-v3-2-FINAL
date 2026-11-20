import { describe, expect, it } from "vitest";
import { newsScanPayloadSchema, parseWithSchema, pollReleaseSchema } from "./validators";

describe("ingestion validators", () => {
  it("rifiuta sondaggio con fnPct fuori range", () => {
    const result = parseWithSchema(pollReleaseSchema, {
      id: "x",
      institute: "Test",
      fieldEnd: "2026-01-01",
      publishedAt: "2026-01-02",
      fnPct: 150,
    });
    expect(result.ok).toBe(false);
  });

  it("accetta payload news minimo", () => {
    const result = parseWithSchema(newsScanPayloadSchema, {
      candidates: [
        {
          id: "1",
          titolo: "Titolo",
          link: "https://example.com",
          pubDate: null,
          snippet: "test",
          matchedKeywords: [],
          feedUrl: "https://feed.example/rss",
        },
      ],
      scannedFeeds: 1,
      fromDefaultCatalog: true,
      perFeedLimit: 10,
    });
    expect(result.ok).toBe(true);
  });
});