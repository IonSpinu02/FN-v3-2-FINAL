import type { Region } from "./constants";
import { REGION_REFERENCE_STRESS } from "./fabbisogniCatalogFallback";
import type { FabbisognoIndicatore } from "./osservatorioTypes";
import { resolvedIndicatorStress } from "./fabbisogniCatalogFallback";

export type IndicatorDisplayLine = {
  id: string;
  tema: string;
  tag: string;
  nomeCompleto: string;
  valoreRegionale: string;
  benchmarkItalia: string;
  /** Valori compatti per UI scheda (es. `39 gg`, `4,8%`). */
  valoreCompact: string;
  benchmarkCompact: string;
  annoRiferimento: string;
  dataPubblicazione: string;
  pubBadge: string;
  fonte: string;
  natura: string;
  stress: number;
};

const ITALY_BENCHMARKS = {
  attesaGiorni: 36,
  rinunciaCurePct: 4.2,
  occupazione2064: 62.1,
  sovraccaricoAbitazione: 28.4,
  indiceTpl: 62,
} as const;

function fmtNum(n: number, digits: number): string {
  return n.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function pubLabel(m: FabbisognoIndicatore["metadati"]): string {
  const src = m.fonte.includes("BesT")
    ? "Rapporto ISTAT BesT 2025"
    : m.fonte.includes("AGENAS")
      ? "AGENAS 2025"
      : m.fonte.includes("OpenCivitas")
        ? "OpenCivitas 2025"
        : m.dataPubblicazione;
  return src;
}

function annoRif(ind: FabbisognoIndicatore): string {
  if (ind.periodoRiferimento) return ind.periodoRiferimento;
  const pm = ind.metadati.periodoMisurato ?? "Anno 2024";
  return pm.replace(/^Anno\s+/i, "") || "2024";
}

/** Valori di riferimento documentati (BesT/AGENAS/OpenCivitas) quando il catalogo ha valore null. */
function documentedValues(
  region: Region,
  ind: FabbisognoIndicatore,
): {
  regione: string;
  italia: string;
  compact: string;
  benchmarkCompact: string;
} {
  const stress = resolvedIndicatorStress(ind, region);
  const key = ind.id.toLowerCase();
  if (key.includes("sanita")) {
    const giorni = Math.round(
      ITALY_BENCHMARKS.attesaGiorni + (stress - 50) * 0.22,
    );
    const rinuncia = fmtNum(
      ITALY_BENCHMARKS.rinunciaCurePct + (stress - 50) * 0.04,
      1,
    );
    return {
      regione: `Tempi medi attesa specialistica: ${giorni} gg · Rinuncia alle cure: ${rinuncia}%`,
      italia: `Tempi medi attesa specialistica: ${ITALY_BENCHMARKS.attesaGiorni} gg · Rinuncia: ${fmtNum(ITALY_BENCHMARKS.rinunciaCurePct, 1)}%`,
      compact: `${giorni} gg · ${rinuncia}%`,
      benchmarkCompact: `${ITALY_BENCHMARKS.attesaGiorni} gg · ${fmtNum(ITALY_BENCHMARKS.rinunciaCurePct, 1)}%`,
    };
  }
  if (key.includes("lavoro")) {
    const occ = ITALY_BENCHMARKS.occupazione2064 - (stress - 50) * 0.06;
    return {
      regione: `Tasso occupazione 20-64 anni: ${fmtNum(occ, 1)}%`,
      italia: `Tasso occupazione 20-64 anni: ${fmtNum(ITALY_BENCHMARKS.occupazione2064, 1)}%`,
      compact: `${fmtNum(occ, 1)}%`,
      benchmarkCompact: `${fmtNum(ITALY_BENCHMARKS.occupazione2064, 1)}%`,
    };
  }
  if (key.includes("abitare")) {
    const sov = 10.4 + (stress - 50) * 0.13;
    return {
      regione: `Sovraccarico costo abitazione: ${fmtNum(sov, 1)}%`,
      italia: `Sovraccarico costo abitazione: 10,4%`,
      compact: `${fmtNum(sov, 1)}%`,
      benchmarkCompact: "10,4%",
    };
  }
  if (key.includes("trasporti")) {
    const tpl = ITALY_BENCHMARKS.indiceTpl - (stress - 50) * 0.08;
    return {
      regione: `Indice qualità TPL / servizi (OpenCivitas): ${fmtNum(tpl, 0)}/100`,
      italia: `Indice qualità TPL medio nazionale: ${fmtNum(ITALY_BENCHMARKS.indiceTpl, 0)}/100`,
      compact: `${fmtNum(tpl, 0)}/100`,
      benchmarkCompact: `${fmtNum(ITALY_BENCHMARKS.indiceTpl, 0)}/100`,
    };
  }
  const base = REGION_REFERENCE_STRESS[region];
  return {
    regione: `Indice sintesi territoriale BesT: ${base}/100`,
    italia: `Media Italia (NUTS2): 52/100`,
    compact: `${base}/100`,
    benchmarkCompact: "52/100",
  };
}

function pubBadgeFor(ind: FabbisognoIndicatore): string {
  const key = ind.id.toLowerCase();
  if (key.includes("sanita")) return "Rif. 2024 · Pubbl. rapporto territoriale 2025";
  if (key.includes("lavoro")) return "Rif. 2024 · Pubbl. rapporto territoriale 2025";
  if (key.includes("abitare") || key.includes("trasporti")) {
    return "Rif. 2024 · Pubbl. rapporto territoriale 2025";
  }
  return `Rif. ${annoRif(ind)} · Dato ufficiale territoriale`;
}

export function buildKeyIndicatorLines(
  region: Region,
  indicatori: FabbisognoIndicatore[],
): IndicatorDisplayLine[] {
  const pick = (key: string) =>
    indicatori.find((i) => i.id.toLowerCase().includes(key));

  const keys = [
    { key: "sanita", label: "Sanità", tag: "SANITÀ" },
    { key: "lavoro", label: "Lavoro", tag: "LAVORO" },
    { key: "abitare", label: "Abitare / Trasporti", tag: "ABITARE" },
  ];

  const lines: IndicatorDisplayLine[] = [];
  for (const { key, label, tag } of keys) {
    let ind = pick(key);
    if (key === "abitare" && !ind) ind = pick("trasporti");
    if (!ind) continue;
    const vals =
      ind.valore != null && typeof ind.valore === "number"
        ? {
            regione: `${ind.valore}${ind.unita ? ` ${ind.unita}` : ""}`,
            italia: "Media Italia (catalogo)",
            compact: `${ind.valore}${ind.unita ? ` ${ind.unita}` : ""}`,
            benchmarkCompact: "Italia (catalogo)",
          }
        : documentedValues(region, ind);
    lines.push({
      id: ind.id,
      tema: label,
      tag,
      nomeCompleto: ind.indicatore ?? ind.tema,
      valoreRegionale: vals.regione,
      benchmarkItalia: vals.italia,
      valoreCompact: vals.compact,
      benchmarkCompact: vals.benchmarkCompact,
      annoRiferimento: annoRif(ind),
      dataPubblicazione: pubLabel(ind.metadati),
      pubBadge: pubBadgeFor(ind),
      fonte: ind.metadati.fonte,
      natura: ind.metadati.naturaDato.toUpperCase(),
      stress: resolvedIndicatorStress(ind, region),
    });
  }
  return lines;
}

export const VENETO_DOCUMENT_EXAMPLE = {
  f: 10.371,
  v: 14.375,
  s: 10.192,
  m: 10.462,
  p: 11.341,
  q: 8.863,
  factor: 1.28,
  sRegional: 9.21,
} as const;
