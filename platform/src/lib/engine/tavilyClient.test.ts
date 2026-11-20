import { describe, expect, it } from "vitest";
import {
  tavilyResultsToRssLike,
  tavilySearchNews,
  type TavilySearchResponse,
} from "./tavilyClient";

describe("tavilyClient", () => {
  it("tavilyResultsToRssLike mappa titolo e snippet", () => {
    const rows = tavilyResultsToRssLike([
      {
        title: "Bologna, daspo urbano",
        url: "https://www.ansa.it/test",
        content: "Sintesi articolo",
        published_date: "2026-10-01T12:00:00.000Z",
      },
    ]);
    expect(rows[0]?.titolo).toContain("Bologna");
    expect(rows[0]?.link).toContain("ansa.it");
    expect(rows[0]?.feedUrl).toContain("tavily");
  });

  it("tavilySearchNews senza chiave restituisce vuoto", async () => {
    const prev = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;
    const out = await tavilySearchNews({ query: "test" });
    expect(out.results).toEqual([]);
    if (prev) process.env.TAVILY_API_KEY = prev;
  });

  it("parse risposta mock HTTP", async () => {
    process.env.TAVILY_API_KEY = "tvly-test";
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          query: "Lombardia sicurezza",
          results: [
            {
              title: "Titolo",
              url: "https://repubblica.it/a",
              content: "testo",
              published_date: "Wed, 07 Oct 2026 07:10:34 +0000",
            },
          ],
        } satisfies TavilySearchResponse),
        { status: 200 },
      );

    const out = await tavilySearchNews({
      query: "Lombardia sicurezza",
      fetchImpl: mockFetch,
    });
    expect(out.results).toHaveLength(1);
    expect(out.results[0]?.published_date).toMatch(/^2026-/);
    delete process.env.TAVILY_API_KEY;
  });
});
