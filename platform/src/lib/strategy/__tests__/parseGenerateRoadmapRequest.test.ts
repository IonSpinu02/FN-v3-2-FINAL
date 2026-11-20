import { describe, expect, it } from "vitest";
import { parseGenerateRoadmapRequest } from "@/lib/strategy/parseGenerateRoadmapRequest";

describe("parseGenerateRoadmapRequest", () => {
  it("accetta input valido e tronca la nota", () => {
    const note = "x".repeat(400);
    const parsed = parseGenerateRoadmapRequest({ targetPct: 12.04, horizonDays: 360, strategicFocusNote: note });
    expect(parsed).toEqual({
      targetPct: 12,
      horizonDays: 360,
      strategicFocusNote: "x".repeat(280),
    });
  });

  it("rifiuta target fuori range e orizzonti invalidi", () => {
    expect(parseGenerateRoadmapRequest({ targetPct: 5, horizonDays: 360 })).toEqual({
      error: "targetPct deve essere tra 6,5 e 20",
    });
    expect(parseGenerateRoadmapRequest({ targetPct: 21, horizonDays: 360 })).toEqual({
      error: "targetPct deve essere tra 6,5 e 20",
    });
    expect(parseGenerateRoadmapRequest({ targetPct: 10, horizonDays: 45 })).toEqual({
      error: "horizonDays deve essere 30, 90, 180 o 360",
    });
    expect(parseGenerateRoadmapRequest(null)).toEqual({ error: "JSON non valido" });
  });
});
