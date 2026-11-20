import { describe, expect, it } from "vitest";
import { extractFnMovement, parseYouTrendSupermediaRss } from "./consensoYouTrendIngest";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0">
<channel>
<item>
<title>Supermedia Youtrend/Agi: il PD scende al 20,4%</title>
<link>https://www.youtrend.it/2026/10/07/supermedia-youtrend-agi-il-pd-scende-al-204/</link>
<pubDate>Wed, 07 Oct 2026 07:10:34 +0000</pubDate>
<description><![CDATA[<p>Nella Supermedia Youtrend/Agi del 1° ottobre il PD perde 0,7 punti.</p>
<p>Stabili Futuro Nazionale al 7,7% e Forza Italia al 7,4%.</p>]]></description>
</item>
</channel></rss>`;

describe("parseYouTrendSupermediaRss", () => {
  it("estrae FN % e data di riferimento Supermedia", () => {
    const points = parseYouTrendSupermediaRss(SAMPLE);
    expect(points).toHaveLength(1);
    expect(points[0]?.isoDate).toBe("2026-10-01");
    expect(points[0]?.pct).toBe(7.7);
    expect(points[0]?.why).toMatch(/Futuro Nazionale/i);
  });

  it("legge il calo dichiarato da YouTrend", () => {
    const { why, deltaPp } = extractFnMovement(
      "Il calo più marcato è quello di Futuro Nazionale, che perde 1,1 punti e scende al 6,1%. Il partito di Roberto Vannacci viene così raggiunto dalla Lega, anch'essa al 6,1%.",
    );
    expect(deltaPp).toBe(-1.1);
    expect(why).toMatch(/raggiunto dalla Lega/i);
  });
});
