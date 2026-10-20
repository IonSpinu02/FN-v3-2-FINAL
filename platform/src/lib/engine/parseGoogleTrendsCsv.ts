import type { GoogleTrendsPoint } from "./osservatorioTypes";

/**
 * Parser minimalista per export CSV Google Trends (colonna data + valore numerico).
 * Accetta separatori , o ; e header con "Data"/"Date"/"Giorno" o prima colonna testuale.
 */
export function parseGoogleTrendsCsv(text: string): GoogleTrendsPoint[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const sep = lines[0]!.includes(";") ? ";" : ",";
  const header = lines[0]!.split(sep).map((h) => h.trim().toLowerCase());
  const valueCol =
    header.findIndex((h) => h === "value" || h.includes("interesse")) >= 0
      ? header.findIndex((h) => h === "value" || h.includes("interesse"))
      : header.length - 1;

  const out: GoogleTrendsPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 2) continue;
    const dateRaw = cols[0]!;
    const valRaw = cols[valueCol >= 0 ? valueCol : 1]!;
    const value = Number(valRaw.replace(",", "."));
    if (Number.isNaN(value)) continue;
    out.push({ date: dateRaw, value });
  }
  return out;
}
