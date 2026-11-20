import { describe, expect, it } from "vitest";
import {
  parsePollyticoPolls,
  parsePollyticoShortDate,
} from "./pollyticoPollArchive";

const CARD = `
<span style="font-weight:700; font-size:14px;">SWG</span>
<span style="font-size:12px; color:#8a8880;">10 nov</span>
per La7 · campione —
<span style="font-weight:700; color:#003366;">FN</span>
<span style="color:#6b6a63;"> 5.5%</span>
<span style="font-weight:700; font-size:14px;">YouTrend/AGI - Supermedia</span>
<span style="font-size:12px; color:#8a8880;">2 nov</span>
<span style="font-weight:700; color:#003366;">FN</span>
<span style="color:#6b6a63;"> 6.1%</span>
<span style="font-weight:700; font-size:14px;">Istituto Piepoli</span>
<span style="font-size:12px; color:#8a8880;">5 nov</span>
<span style="font-weight:700; color:#003366;">FN</span>
<span style="color:#6b6a63;"> 6.5%</span>
`;

describe("parsePollyticoShortDate", () => {
  it("converte giorno+mese corto", () => {
    expect(parsePollyticoShortDate("10 nov", 2026)).toBe("2026-11-10");
    expect(parsePollyticoShortDate("30 ott", 2026)).toBe("2026-10-30");
  });
});

describe("parsePollyticoPolls", () => {
  it("estrae FN ed esclude Supermedia", () => {
    const rows = parsePollyticoPolls(CARD, { refYear: 2026 });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      institute: "SWG",
      fieldEnd: "2026-11-10",
      fnPct: 5.5,
      id: "swg-2026-11-10",
    });
    expect(rows[1]).toMatchObject({
      institute: "Piepoli",
      fieldEnd: "2026-11-05",
      fnPct: 6.5,
    });
  });
});
