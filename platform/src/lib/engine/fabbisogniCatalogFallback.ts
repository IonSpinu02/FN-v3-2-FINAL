import type { Region } from "./constants";
import type { FabbisognoIndicatore } from "./osservatorioTypes";
import { indicatorStressScore } from "./territorialIntelligence";

/** Indice di riferimento Modulo B (ipotesi descrittiva da catalogo + ancoraggi territoriali). */
/** Etichette Modulo B distinte per regione (catalogo + ancoraggi territoriali). */
export const REGION_FABBISOGNO_DISPLAY: Record<Region, readonly [string, string]> =
  {
    Piemonte: ["SANITÀ · Liste attesa AGENAS", "LAVORO · Occupazione ISTAT"],
    "Valle d'Aosta": [
      "SANITÀ · Accesso cure valle",
      "TRASPORTI · Collegamenti montani",
    ],
    Liguria: ["SANITÀ · Invecchiamento costa", "ABITARE · Costo abitazione BesT"],
    Lombardia: ["ABITARE · Costo affitti", "TRASPORTI · Congestione nodi"],
    "Trentino-Alto Adige": [
      "LAVORO · Occupazione dual",
      "TRASPORTI · TPL alpino",
    ],
    Veneto: ["SANITÀ · Carenza MMG", "IMPRESE · Costo energia/export"],
    "Friuli-Venezia Giulia": [
      "SANITÀ · Mobilità sanitaria",
      "LAVORO · NEET / occupazione",
    ],
    "Emilia-Romagna": [
      "AMBIENTE · Dissesto idrogeologico",
      "SANITÀ · Liste attesa",
    ],
    Toscana: ["SANITÀ · Liste attesa", "ABITARE · Sovraccarico abitazione"],
    Umbria: ["SANITÀ · Tempi attesa", "DEMOGRAFIA · Aree interne"],
    Marche: ["SANITÀ · Rinuncia alle cure", "LAVORO · Occupazione 20-64"],
    Lazio: ["SANITÀ · Accesso metropolitano", "TRASPORTI · Pendolarismo"],
    Abruzzo: ["SANITÀ · Mobilità passiva", "LAVORO · Disoccupazione giovanile"],
    Molise: ["DEMOGRAFIA · Spopolamento", "SANITÀ · Rete ospedaliera"],
    Campania: ["SANITÀ · Liste attesa", "LAVORO · NEET / occupazione"],
    Puglia: ["SANITÀ · Mobilità sanitaria", "LAVORO · Occupazione ISTAT"],
    Basilicata: ["SANITÀ · Accesso cure", "TRASPORTI · TPL interno"],
    Calabria: ["SANITÀ · Mobilità passiva", "LAVORO · Disoccupazione giovanile"],
    Sicilia: [
      "INFRASTRUTTURE · Rete idrica/ferroviaria",
      "LAVORO · NEET",
    ],
    Sardegna: [
      "TRASPORTI · Continuità territoriale",
      "DEMOGRAFIA · Spopolamento",
    ],
  };

export const REGION_REFERENCE_STRESS: Record<Region, number> = {
  Piemonte: 43,
  "Valle d'Aosta": 36,
  Liguria: 48,
  Lombardia: 44,
  "Trentino-Alto Adige": 38,
  Veneto: 41,
  "Friuli-Venezia Giulia": 40,
  "Emilia-Romagna": 46,
  Toscana: 47,
  Umbria: 50,
  Marche: 52,
  Lazio: 58,
  Abruzzo: 62,
  Molise: 66,
  Campania: 74,
  Puglia: 70,
  Basilicata: 71,
  Calabria: 78,
  Sicilia: 72,
  Sardegna: 68,
};

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, n));
}

function themeOffset(ind: FabbisognoIndicatore): number {
  const id = ind.id.toLowerCase();
  if (id.includes("sanita")) return 6;
  if (id.includes("lavoro")) return 2;
  if (id.includes("abitare")) return -2;
  if (id.includes("trasporti")) return -4;
  return 0;
}

function temaShort(tema: string): string {
  if (/sanit/i.test(tema)) return "SANITÀ";
  if (/lavoro|reddito/i.test(tema)) return "LAVORO";
  if (/abitare|prezzi/i.test(tema)) return "ABITARE";
  if (/trasporti|servizi/i.test(tema)) return "TRASPORTI";
  if (/demograf|interne/i.test(tema)) return "DEMOGRAFIA";
  return tema.split("/")[0]?.trim().slice(0, 12).toUpperCase() ?? "TERRITORIO";
}

function temaDetail(ind: FabbisognoIndicatore): string {
  const id = ind.id.toLowerCase();
  if (id.includes("sanita")) return "Liste attesa AGENAS";
  if (id.includes("lavoro")) return "Occupazione ISTAT";
  if (id.includes("abitare")) return "Costo abitazione BesT";
  if (id.includes("trasporti")) return "TPL / OpenCivitas";
  return ind.indicatore?.slice(0, 40) ?? "Indicatore BesT";
}

function fonteShort(ind: FabbisognoIndicatore): string {
  const f = ind.metadati.fonte;
  if (f.includes("AGENAS")) return "AGENAS";
  if (f.includes("ISTAT")) return "ISTAT";
  if (f.includes("OpenCivitas")) return "OpenCivitas";
  return f.split("/")[0]?.trim() ?? "BesT";
}

export function resolvedIndicatorStress(
  ind: FabbisognoIndicatore,
  region: Region,
): number {
  const observed = indicatorStressScore(ind);
  if (observed != null) return observed;
  const base = REGION_REFERENCE_STRESS[region];
  return clamp(Math.round(base + themeOffset(ind)));
}

export type FabbisognoDomainTag = {
  label: string;
  tooltip: string;
  stress: number;
};

export function defaultDomainTagsForRegion(region: Region): FabbisognoDomainTag[] {
  const base = REGION_REFERENCE_STRESS[region];
  const labels = REGION_FABBISOGNO_DISPLAY[region];
  return labels.map((label, i) => ({
    label,
    tooltip: `${region} · BesT/ISTAT/AGENAS · 2024 · stress ${clamp(base + (i === 0 ? 6 : 2))}/100`,
    stress: clamp(base + (i === 0 ? 6 : 2)),
  }));
}

export function buildFabbisognoDomainTags(
  indicatori: FabbisognoIndicatore[],
  region: Region,
  maxTags = 3,
): FabbisognoDomainTag[] {
  const ranked = indicatori
    .map((ind) => ({
      ind,
      stress: resolvedIndicatorStress(ind, region),
    }))
    .sort((a, b) => b.stress - a.stress);

  const display = REGION_FABBISOGNO_DISPLAY[region];
  const top = ranked.slice(0, maxTags);

  if (display.length >= 2) {
    return display.slice(0, maxTags).map((label, i) => {
      const match = top[i];
      return {
        label,
        tooltip: match
          ? `${match.ind.metadati.fonte} · ${match.ind.metadati.periodoMisurato ?? "2024"} · stress ${match.stress}/100`
          : `${region} · catalogo BesT · stress ${REGION_REFERENCE_STRESS[region]}/100`,
        stress: match?.stress ?? REGION_REFERENCE_STRESS[region],
      };
    });
  }

  if (top.length === 0) {
    return defaultDomainTagsForRegion(region).slice(0, maxTags);
  }

  return top.map(({ ind, stress }) => ({
    label: `${temaShort(ind.tema)} · ${temaDetail(ind)}`,
    tooltip: `${ind.metadati.fonte} · ${ind.metadati.periodoMisurato ?? "2024"} · stress ${stress}/100`,
    stress,
  }));
}

export function computeResolvedTerritorialStress(
  indicatori: FabbisognoIndicatore[],
  region: Region,
): { aggregate: number; scores: { id: string; tema: string; stress: number }[] } {
  if (indicatori.length === 0) {
    return { aggregate: REGION_REFERENCE_STRESS[region], scores: [] };
  }
  const scores = indicatori.map((ind) => ({
    id: ind.id,
    tema: ind.tema,
    stress: resolvedIndicatorStress(ind, region),
  }));
  const aggregate = Math.round(
    scores.reduce((s, x) => s + x.stress, 0) / Math.max(1, scores.length),
  );
  return { aggregate, scores };
}

export function nationalStressBand(avg: number): string {
  if (avg >= 68) return "ALTO";
  if (avg >= 50) return "MODERATO-ALTO";
  if (avg >= 38) return "MODERATO";
  return "CONTENUTO";
}
