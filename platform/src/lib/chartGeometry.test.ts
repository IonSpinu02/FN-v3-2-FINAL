import { describe, expect, it } from "vitest";
import { niceScale, smoothPath } from "./chartGeometry";

describe("niceScale", () => {
  it("usa tacche tonde che contengono tutti i valori", () => {
    const s = niceScale([6.59, 6.58, 6.76, 7.19], 1);
    expect(s.ticks.map((t) => t.toFixed(2))).toEqual(["6.25", "6.50", "6.75", "7.00", "7.25", "7.50"]);
    expect(s.min).toBeCloseTo(6.25, 9);
    expect(s.max).toBeCloseTo(7.5, 9);
    expect(s.decimals).toBe(2);
  });

  it("rispetta l'escursione minima: pochi centesimi non riempiono il grafico", () => {
    const s = niceScale([6.59, 6.6], 1);
    expect(s.max - s.min).toBeGreaterThanOrEqual(1);
    expect(s.min).toBeLessThanOrEqual(6.59);
    expect(s.max).toBeGreaterThanOrEqual(6.6);
  });

  it("non supera 5 intervalli e non scende sotto zero", () => {
    for (const values of [[0.2, 0.4], [3, 12], [6.4, 7.2], [10, 10], [6.45, 6.66]]) {
      const s = niceScale(values, 0.2);
      expect(s.ticks.length - 1).toBeLessThanOrEqual(5);
      expect(s.ticks.length).toBeGreaterThanOrEqual(2);
      expect(s.min).toBeGreaterThanOrEqual(0);
      expect(s.min).toBeLessThanOrEqual(Math.min(...values));
      expect(s.max).toBeGreaterThanOrEqual(Math.max(...values));
    }
  });

  it("ignora i valori non numerici", () => {
    const s = niceScale([Number.NaN, 6.5, Number.POSITIVE_INFINITY, 6.7], 0.2);
    expect(s.min).toBeLessThanOrEqual(6.5);
    expect(s.max).toBeGreaterThanOrEqual(6.7);
  });
});

describe("smoothPath", () => {
  const points = [
    { x: 0, y: 100 },
    { x: 50, y: 101 },
    { x: 100, y: 80 },
    { x: 150, y: 60 },
    { x: 200, y: 62 },
  ];

  function segments(d: string) {
    return d
      .split(" C")
      .slice(1)
      .map((s) => s.trim().split(" ").map((xy) => xy.split(",").map(Number)));
  }

  it("passa per tutti i punti", () => {
    const d = smoothPath(points);
    expect(d.startsWith("M0.0,100.0")).toBe(true);
    const ends = segments(d).map((seg) => seg[2]);
    expect(ends).toEqual(points.slice(1).map((p) => [p.x, p.y]));
  });

  it("non crea picchi: ogni tratto resta tra i suoi due estremi", () => {
    segments(smoothPath(points)).forEach(([c1, c2], i) => {
      const lo = Math.min(points[i].y, points[i + 1].y);
      const hi = Math.max(points[i].y, points[i + 1].y);
      for (const [, y] of [c1, c2]) {
        expect(y).toBeGreaterThanOrEqual(lo);
        expect(y).toBeLessThanOrEqual(hi);
      }
    });
  });

  it("con due punti disegna un segmento", () => {
    expect(smoothPath([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toBe("M0.0,0.0 L10.0,5.0");
  });
});
