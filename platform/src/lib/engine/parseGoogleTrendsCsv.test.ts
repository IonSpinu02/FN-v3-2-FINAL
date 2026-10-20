import { describe, expect, it } from "vitest";
import { parseGoogleTrendsCsv } from "./parseGoogleTrendsCsv";

describe("parseGoogleTrendsCsv", () => {
  it("parse export semplice", () => {
    const csv = `Date,Interesse
2026-10-01,20
2026-10-02,100`;
    const pts = parseGoogleTrendsCsv(csv);
    expect(pts).toHaveLength(2);
    expect(pts[1]!.value).toBe(100);
  });
});
