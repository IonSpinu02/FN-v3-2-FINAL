import { REGIONS, type Region } from "./constants";
import type { PrioritaDichiarateRilevazione } from "./osservatorioTypes";

/**
 * CSV: regione,campioneN,metodoSelezione,mancataRispostaPct,margineIncertezzaPct,periodoRilevazione,q1,q2,q3,q4,q5
 */
export function parsePrioritaSurveyCsv(text: string): PrioritaDichiarateRilevazione[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const sep = lines[0]!.includes(";") ? ";" : ",";
  const header = lines[0]!.split(sep).map((h) => h.trim().toLowerCase());

  function col(...parts: string[]): number {
    return header.findIndex((h) => parts.some((p) => h.includes(p)));
  }

  const out: PrioritaDichiarateRilevazione[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const ri = col("regione");
    const regioneRaw = ri >= 0 ? cols[ri] : cols[0];
    if (!regioneRaw || !REGIONS.includes(regioneRaw as Region)) continue;

    const pick = (idx: number, fallback = "") =>
      idx >= 0 && cols[idx] !== undefined ? cols[idx]! : fallback;
    const num = (idx: number) => {
      const v = pick(idx, "0").replace(",", ".");
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    };

    const campioneN = num(col("campione"));
    if (campioneN <= 0) continue;

    out.push({
      regione: regioneRaw as Region,
      campioneN,
      metodoSelezione: pick(col("metodo"), "non specificato"),
      mancataRispostaPct: num(col("mancata")),
      margineIncertezzaPct: num(col("margine")),
      periodoRilevazione: pick(col("periodo")),
      q1_problemiTerritorio: pick(col("q1")),
      q2_difficoltaPersonali: pick(col("q2")),
      q3_soddisfazioneServizi: pick(col("q3")),
      q4_urgenzaSoluzioni: pick(col("q4")),
      q5_intenzioneVotoFacoltativa: pick(col("q5")),
    });
  }
  return out;
}
