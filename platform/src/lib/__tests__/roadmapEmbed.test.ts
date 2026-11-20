import { describe, expect, it } from "vitest";
import { isRoadmapChildMessage, parseRoadmapEmbedParams, roadmapEmbedUrl } from "@/lib/roadmapEmbed";

describe("roadmapEmbed", () => {
  it("legge i parametri dell'iframe con valori di ripiego sicuri", () => {
    expect(parseRoadmapEmbedParams({ target: "12.0", horizon: "360", stage: "3", theme: "light" })).toEqual({
      targetPct: 12,
      horizonDays: 360,
      stage: 3,
      theme: "light",
    });
    expect(parseRoadmapEmbedParams({ target: "abc", horizon: "45", stage: "9" })).toEqual({
      targetPct: 12,
      horizonDays: 360,
      stage: 1,
      theme: "dark",
    });
    expect(parseRoadmapEmbedParams({ target: ["9.54"], horizon: ["90"] }).targetPct).toBe(9.5);
  });

  it("costruisce un URL che rilegge gli stessi parametri", () => {
    const url = roadmapEmbedUrl({ targetPct: 12, horizonDays: 360, stage: 2, theme: "dark" });
    expect(url).toBe("/embed/roadmap?target=12.0&horizon=360&stage=2&theme=dark");
    const query = Object.fromEntries(new URLSearchParams(url.split("?")[1]));
    expect(parseRoadmapEmbedParams(query)).toEqual({ targetPct: 12, horizonDays: 360, stage: 2, theme: "dark" });
  });

  it("riconosce solo i messaggi del protocollo", () => {
    expect(isRoadmapChildMessage({ type: "fn-roadmap-stage", stage: 2 })).toBe(true);
    expect(isRoadmapChildMessage({ type: "altro" })).toBe(false);
    expect(isRoadmapChildMessage(null)).toBe(false);
  });
});
