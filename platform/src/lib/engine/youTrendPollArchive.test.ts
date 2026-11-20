import { describe, expect, it } from "vitest";
import { parseYouTrendPollArchive } from "./youTrendPollArchive";

const CARD = `<article class="border"><div><h3 class="font-bold text-ink">Noto</h3>
<p>Campo: <!-- -->20 OTT 2026</p><p>Pubblicato: <!-- -->20 OTT 2026</p></div>
<p>n=1000</p>
<span class="truncate">FdI</span><strong class="tabular-nums text-ink">28,0%</strong>
<span class="truncate">Futuro Nazionale</span><strong class="tabular-nums text-ink">5,8%</strong>
</article>
<article><h3>SWG</h3><p>Campo: 26 OTT 2026</p><p>Pubblicato: 26 OTT 2026</p><p>n=1200</p>
<span class="truncate">Futuro Nazionale</span><strong>5,6%</strong></article>`;

describe("parseYouTrendPollArchive", () => {
  it("estrae istituto, data, campione e % FN", () => {
    const rows = parseYouTrendPollArchive(CARD);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      institute: "Noto",
      fieldEnd: "2026-10-20",
      fnPct: 5.8,
      sampleSize: 1000,
    });
    expect(rows[1]?.fnPct).toBe(5.6);
  });
});
