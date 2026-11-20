import { describe, expect, it } from "vitest";
import {
  containsCredibilityBanned,
  sanitizeStrategicRoadmapText,
  scrubCredibilityBanned,
} from "@/lib/ai/strategicRoadmapSanitizer";

describe("strategicRoadmapSanitizer", () => {
  it("rimuove le stringhe vietate dall'audit di credibilità", () => {
    const dirty = "Conv. 12 e Interesse Google (30G) più Cosa cercano su Google oggi";
    expect(containsCredibilityBanned(dirty)).toBe(true);
    const clean = scrubCredibilityBanned(dirty);
    expect(containsCredibilityBanned(clean)).toBe(false);
    expect(clean).not.toMatch(/Conv\.\s*\d/);
    expect(clean).not.toMatch(/Interesse Google \(30[gG]\)/);
    expect(clean).not.toMatch(/Cosa cercano su Google/);
  });

  it("sanifica anche le sigle interne dello strategist", () => {
    const text = sanitizeStrategicRoadmapText("Apri il fronte d30 e V4 su ERP");
    expect(text).toMatch(/30 giorni/i);
    expect(text).not.toMatch(/\bV4\b/);
    expect(text.toLowerCase()).toContain("case popolari");
  });
});
