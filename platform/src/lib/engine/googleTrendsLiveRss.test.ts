import { describe, expect, it } from "vitest";
import { parseGoogleTrendsRssFeed } from "./googleTrendsLiveRss";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0">
<channel>
<item>
<title>pronto soccorso code</title>
<ht:approx_traffic>5000+</ht:approx_traffic>
<pubDate>Wed, 21 Oct 2026 06:10:00 -0700</pubDate>
<ht:news_item>
<ht:news_item_title>Code al PS di Milano</ht:news_item_title>
</ht:news_item>
</item>
</channel>
</rss>`;

describe("googleTrendsLiveRss", () => {
  it("parses RSS items with traffic", () => {
    const rows = parseGoogleTrendsRssFeed(SAMPLE);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.query).toBe("pronto soccorso code");
    expect(rows[0]!.approxTraffic).toBeGreaterThan(1000);
  });
});
