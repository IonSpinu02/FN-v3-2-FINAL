import type { GoogleTrendsSeries } from "./osservatorioTypes";

/** Serie didattica 0–100 per test UI protocollo 14+14 (non dati reali Trends). */
export function buildDemoTrendsSeries(): GoogleTrendsSeries {
  const points: { date: string; value: number }[] = [];
  const start = new Date("2026-10-01T00:00:00Z");
  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const dist = Math.abs(i - 14);
    const value =
      i === 14 ? 100 : Math.max(5, Math.round(100 - dist * 7 + (i % 3)));
    points.push({
      date: d.toISOString().slice(0, 10),
      value,
    });
  }
  return {
    id: "demo-didattico-vannacci",
    query: "Roberto Vannacci",
    queryType: "term",
    territory: "Italia",
    windowStart: points[0]!.date,
    windowEnd: points[points.length - 1]!.date,
    extractedAt: new Date().toISOString(),
    isDemo: true,
    points,
  };
}
