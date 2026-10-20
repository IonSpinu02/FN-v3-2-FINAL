import { describe, expect, it } from "vitest";
import {
  buildObservationWindows,
  compareTrendSeries,
  parseEventDate,
} from "./eventStudyProtocol";

describe("eventStudyProtocol", () => {
  it("parseEventDate accetta ISO", () => {
    const d = parseEventDate("2026-10-15");
    expect(d).not.toBeNull();
  });

  it("buildObservationWindows 14+14", () => {
    const event = new Date("2026-10-15T12:00:00Z");
    const w = buildObservationWindows(event, 14, 14);
    expect(w.pre.label).toContain("14");
    expect(w.post.label).toContain("14");
    expect(w.extra.length).toBe(3);
  });

  it("compareTrendSeries non implica voto", () => {
    const c = compareTrendSeries([20, 30], [80, 90]);
    expect(c.mediaPost).toBeGreaterThan(c.mediaPre);
    expect(c.interpretazione.toLowerCase()).toContain("attenzione");
  });
});
