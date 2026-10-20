import { describe, expect, it } from "vitest";
import {
  enrichNewsCandidates,
  filterRelevantCandidates,
  parseRssItems,
  perFeedItemLimit,
  resolveNewsRssUrls,
} from "./newsIngest";
import { DEFAULT_NEWS_RSS_URLS } from "./newsFeedCatalog";

const SAMPLE_RSS = `<?xml version="1.0"?>
<rss><channel>
<item><title>Sindaco di Bergamo: passa a Futuro Nazionale</title>
<link>https://example.com/1</link>
<pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
<description>La giunta del comune annuncia il passaggio.</description>
</item>
<item><title>Meteo: pioggia in Lombardia</title>
<link>https://example.com/2</link>
<description>Sole e nuvole.</description>
</item>
</channel></rss>`;

describe("newsIngest", () => {
  it("parseRssItems estrae titoli", () => {
    const raw = parseRssItems(SAMPLE_RSS, "https://feed.test", 10);
    expect(raw).toHaveLength(2);
    expect(raw[0].titolo).toContain("Bergamo");
  });

  it("enrich con geo lookup regione/comune/ruolo", () => {
    const raw = parseRssItems(
      `<?xml version="1.0"?><rss><channel><item><title>Sindaco di Firenze: novità</title><link>https://x</link><description>Giunta comunale</description></item></channel></rss>`,
      "https://www.ansa.it/toscana/notizie/toscana_rss.xml",
      5,
    );
    const enriched = enrichNewsCandidates(raw, ["sindaco", "giunta"], []);
    expect(enriched[0].suggestedRegion).toBe("Toscana");
    expect(enriched[0].suggestedComune).toBe("Firenze");
    expect(enriched[0].suggestedRole).toBe("sind");
  });

  it("enrich + filter lascia solo keyword rilevanti", () => {
    const raw = parseRssItems(SAMPLE_RSS, "https://feed.test", 10);
    const enriched = enrichNewsCandidates(raw, ["sindaco", "giunta", "passa a"], [
      "Bergamo",
    ]);
    const relevant = filterRelevantCandidates(enriched);
    expect(relevant.length).toBeGreaterThanOrEqual(1);
    expect(relevant[0].comuneGuess).toBe("Bergamo");
    expect(relevant.some((c) => c.titolo.includes("Meteo"))).toBe(false);
  });

  it("include articoli elezioni e seggi con segnale istituzionale", () => {
    const raw = parseRssItems(
      `<?xml version="1.0"?><rss><channel><item><title>Trieste, consiglio comunale e commissione elettorale: ripartizione seggi suppletive</title><link>https://x</link><description>Giunta comunale e scrutinio.</description></item></channel></rss>`,
      "https://feed.test",
      5,
    );
    const enriched = enrichNewsCandidates(raw, ["seggi", "elezioni"], []);
    expect(filterRelevantCandidates(enriched)).toHaveLength(1);
  });

  it("esclude necrologi e sindacalista", () => {
    const raw = parseRssItems(
      `<?xml version="1.0"?><rss><channel><item><title>Addio a Simone Foresti, storico sindacalista</title><link>https://x</link><description>Funeral house.</description></item></channel></rss>`,
      "https://feed.test",
      5,
    );
    const enriched = enrichNewsCandidates(raw, ["sindaco", "consiglio"], []);
    expect(filterRelevantCandidates(enriched)).toHaveLength(0);
  });

  it("esclude allerta meteo e arpal anche con geo Liguria", () => {
    const raw = parseRssItems(
      `<?xml version="1.0"?><rss><channel><item><title>Allerta arancione per temporali estesa in Liguria fino a domani — Arpal</title><link>https://x</link><description>Previsioni meteo Liguria.</description></item></channel></rss>`,
      "https://www.ansa.it/liguria/notizie/liguria_rss.xml",
      5,
    );
    const enriched = enrichNewsCandidates(
      raw,
      ["sindaco", "comune", "consiglio", "giunta"],
      [],
    );
    const relevant = filterRelevantCandidates(enriched);
    expect(relevant).toHaveLength(0);
  });

  it("resolveNewsRssUrls usa catalogo se env vuoto", () => {
    const d = resolveNewsRssUrls(undefined);
    expect(d.fromDefaultCatalog).toBe(true);
    expect(d.urls.length).toBe(DEFAULT_NEWS_RSS_URLS.length);
    expect(d.urls.length).toBeGreaterThanOrEqual(30);
  });

  it("resolveNewsRssUrls rispetta env", () => {
    const d = resolveNewsRssUrls("https://a.test/rss,https://b.test/rss");
    expect(d.fromDefaultCatalog).toBe(false);
    expect(d.urls).toEqual(["https://a.test/rss", "https://b.test/rss"]);
  });

  it("perFeedItemLimit riduce con molti feed", () => {
    expect(perFeedItemLimit(31, 30)).toBeLessThanOrEqual(12);
    expect(perFeedItemLimit(1, 30)).toBe(30);
  });
});
