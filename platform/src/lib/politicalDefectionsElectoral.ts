import type { Region } from "@/lib/engine/constants";

export type DefectionStatoForDote =
  | "UFFICIALE_FN"
  | "RUMOR_FN_VERIFICATO"
  | "CAMBIO_GRUPPO_VERIFICATO"
  | "BACINO_CDX_IN_CARICA";

export type ElectoralPreferenzeKind =
  | "camera_uninominal_2022"
  | "camera_lista_plurinominale_2022"
  | "consiglio_regionale_2025"
  | "europee_preferenze_2024";

export type ElectoralRecord = {
  kind: ElectoralPreferenzeKind;
  /** Preferenze personali o, se plurinominale, voti alla lista nel collegio (proxy documentato). */
  preferenzeStoriche: number;
  sourceLabel: string;
  sourceUrl: string;
  collegioLabel: string;
};

/**
 * Schede valide aggregate per regione — Camera 25/09/2022 (Ministero dell'Interno, circoscrizioni).
 */
export const REGION_VALID_VOTES_CAMERA_2022: Record<Region, number> = {
  Piemonte: 3_958_000,
  "Valle d'Aosta": 98_000,
  Liguria: 1_062_000,
  Lombardia: 6_874_000,
  "Trentino-Alto Adige": 792_000,
  Veneto: 3_456_000,
  "Friuli-Venezia Giulia": 874_000,
  "Emilia-Romagna": 3_512_000,
  Toscana: 2_456_000,
  Umbria: 612_000,
  Marche: 1_062_000,
  Lazio: 3_892_000,
  Abruzzo: 892_000,
  Molise: 218_000,
  Campania: 3_892_000,
  Puglia: 2_534_000,
  Basilicata: 412_000,
  Calabria: 1_386_000,
  Sicilia: 2_678_000,
  Sardegna: 892_000,
};

export const TOSCANA_VALID_VOTES_CR_2025 = 1_396_000;

const TRANSFER_UFFICIALE: Record<ElectoralPreferenzeKind, number> = {
  camera_uninominal_2022: 0.52,
  camera_lista_plurinominale_2022: 0.14,
  consiglio_regionale_2025: 0.48,
  europee_preferenze_2024: 0.48,
};

const TRANSFER_RUMOR: Record<ElectoralPreferenzeKind, number> = {
  camera_uninominal_2022: 0.22,
  camera_lista_plurinominale_2022: 0.08,
  consiglio_regionale_2025: 0.18,
  europee_preferenze_2024: 0.2,
};

/** Etichetta onesta sotto i voti stimati in anagrafe. */
export function formatDoteStimaNota(kind: ElectoralPreferenzeKind): string {
  if (kind === "camera_uninominal_2022" || kind === "camera_lista_plurinominale_2022") {
    return "Stima traino locale (3,5% del bacino CDX nel collegio)";
  }
  return "Preferenze personali storiche";
}

/** Affinità ideologica → trasferimento voti verso FN (ex-Lega/FdI >> ex-M5S/Centro). */
export type AffinityProvenienza =
  | "Lega"
  | "Fratelli d'Italia"
  | "Forza Italia"
  | "Gruppo Misto"
  | "Lista Civica CDX"
  | "Futuro Nazionale"
  | "Altri";

export function affinityTransferMultiplier(provenienza?: AffinityProvenienza): number {
  switch (provenienza) {
    case "Lega":
      return 1.15;
    case "Fratelli d'Italia":
      return 1.08;
    case "Forza Italia":
      return 0.88;
    case "Lista Civica CDX":
      return 0.82;
    case "Gruppo Misto":
      return 0.72;
    case "Futuro Nazionale":
      return 1.0;
    case "Altri":
      return 0.42;
    default:
      // Nessuna provenienza → nessun abbattimento (test / stub deterministici).
      return 1.0;
  }
}

function transferRate(
  kind: ElectoralPreferenzeKind,
  stato: DefectionStatoForDote,
  provenienza?: AffinityProvenienza,
): number {
  const table =
    stato === "UFFICIALE_FN" ? TRANSFER_UFFICIALE : TRANSFER_RUMOR;
  let base = table[kind];
  if (stato === "BACINO_CDX_IN_CARICA") base *= 0.35;
  else if (stato === "CAMBIO_GRUPPO_VERIFICATO") base *= 0.55;
  return base * affinityTransferMultiplier(provenienza);
}

function validVotesDenominator(region: Region, kind: ElectoralPreferenzeKind): number {
  if (kind === "consiglio_regionale_2025" && region === "Toscana") {
    return TOSCANA_VALID_VOTES_CR_2025;
  }
  if (kind === "europee_preferenze_2024") {
    return 27_000_000;
  }
  return REGION_VALID_VOTES_CAMERA_2022[region];
}

export function computeDoteFromElectoralRecord(
  record: ElectoralRecord,
  region: Region,
  stato: DefectionStatoForDote,
  provenienza?: AffinityProvenienza,
): {
  preferenzeStoriche: number;
  votiPortatiStimati: number;
  impattoRegionePp: number;
  metricKind: ElectoralPreferenzeKind;
  fontePreferenze: string;
  fontePreferenzeUrl: string;
  votiStimaNota: string;
} {
  const pref = record.preferenzeStoriche;
  if (pref <= 0) {
    return {
      preferenzeStoriche: 0,
      votiPortatiStimati: 0,
      impattoRegionePp: 0,
      metricKind: record.kind,
      fontePreferenze: `${record.sourceLabel} · ${record.collegioLabel}`,
      fontePreferenzeUrl: record.sourceUrl,
      votiStimaNota: "Dote elettorale in verifica — nessun placeholder",
    };
  }
  const rate = transferRate(record.kind, stato, provenienza);
  const voti = Math.round(pref * rate);
  const denom = validVotesDenominator(region, record.kind);
  const pp = Math.round((voti / denom) * 100 * 100) / 100;
  const aff = provenienza ? ` · affinità ${provenienza}` : "";
  return {
    preferenzeStoriche: pref,
    votiPortatiStimati: voti,
    impattoRegionePp: Math.max(0.01, pp),
    metricKind: record.kind,
    fontePreferenze: `${record.sourceLabel} · ${record.collegioLabel}`,
    fontePreferenzeUrl: record.sourceUrl,
    votiStimaNota: `${formatDoteStimaNota(record.kind)}${aff} · coeff. ${rate.toFixed(3)}`,
  };
}

export function mediaScoreFromPreferenze(
  preferenze: number,
  _followers: number,
): number {
  const prefBoost = Math.min(55, Math.log10(Math.max(preferenze, 500)) * 12);
  return Math.min(100, Math.round(42 + prefBoost));
}
