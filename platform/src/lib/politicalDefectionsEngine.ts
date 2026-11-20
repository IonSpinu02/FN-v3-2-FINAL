import type { Region } from "@/lib/engine/constants";
import { REGIONS } from "@/lib/engine/constants";
import {
  computeDoteFromElectoralRecord,
  mediaScoreFromPreferenze,
  type DefectionStatoForDote,
  type ElectoralPreferenzeKind,
} from "@/lib/politicalDefectionsElectoral";

export type PoliticianRole =
  | "Deputato"
  | "Senatore"
  | "Eurodeputato"
  | "Consigliere Regionale"
  | "Sindaco"
  | "Dirigente / Amministratore";

export type PartitoProvenienza =
  | "Lega"
  | "Fratelli d'Italia"
  | "Forza Italia"
  | "Gruppo Misto"
  | "Lista Civica CDX"
  | "Futuro Nazionale"
  | "Altri";

export type PartitoDestinazione =
  | "Futuro Nazionale"
  | "Gruppo Misto"
  | "Forza Italia"
  | "In carica (nessun passaggio FN)";

/** Categorie anagrafe verificabili — niente stati FN inventati. */
export type PoliticianStato =
  | "UFFICIALE_FN"
  | "CAMBIO_GRUPPO_VERIFICATO"
  | "RUMOR_FN_VERIFICATO"
  | "BACINO_CDX_IN_CARICA";

export type LivelloVisibilita =
  | "Nazionale TV & Stampa"
  | "Forte seguito regionale"
  | "Radicamento locale / Sindaco";

export type BeneficioIngressoFn = {
  votiPortatiStimati: number;
  crescitaRegionePp: number;
  regioneOggiPct: number;
  regioneDopoPct: number;
  potenzaMediatica0100: number;
  affinitaProgrammaticaBip: string;
};

export type FonteIstituzionale = {
  label: string;
  url: string;
  tipo: "Camera XIX Leg." | "Senato XIX Leg." | "Parlamento Europeo" | "Anagrafe Viminale";
};

export type FonteStampa = {
  testata: string;
  titoloArticolo: string;
  data: string;
  url: string;
  estratto: string;
};

export type StatoAdesioneFN =
  | "Ufficiale in FN"
  | "Dialogo / Vicino a FN"
  | "Uscito nel Misto (Contendibile)"
  | "Transitato in altro gruppo CDX/Centro";

export type TrackedPolitician = {
  id: string;
  /** Slug URL dossier (es. manlio-messina). */
  slug?: string;
  nome: string;
  ruolo: PoliticianRole;
  regione: Region;
  /** Raw seed label (legacy); UI usa collegioDisplay. */
  provinciaCollegio: string;
  collegioDisplay: string;
  /** Es. "In carica · Lega" — mai "Ex" se ancora nel partito. */
  caricaEtichetta: string;
  /** Riga neutra/fattuale in colonna Transizione. */
  statoDescrittivo: string;
  partitoProvenienza: PartitoProvenienza;
  partitoDestinazione: PartitoDestinazione;
  stato: PoliticianStato;
  statoAdesioneFN?: StatoAdesioneFN;
  /** Data ISO del cambio gruppo / passaggio (se nota). */
  dataCambioPartito?: string;
  cambioGruppoDa?: string;
  cambioGruppoA?: string;
  cambioGruppoFonte?: string;
  schedaCameraUrl?: string;
  fonteIstituzionale?: FonteIstituzionale;
  fonteStampa?: FonteStampa;
  /** false = stub SPARQL senza preferenze certificate (voti=0). */
  doteVerified?: boolean;
  beneficioIngressoFn?: BeneficioIngressoFn;
  potenzaMediatica: {
    score0100: number;
    livelloVisibilita: LivelloVisibilita;
  };
  doteElettorale: {
    preferenzeStoriche: number;
    votiPortatiStimati: number;
    impattoRegionePp: number;
    metricKind?: ElectoralPreferenzeKind;
    fontePreferenze?: string;
    fontePreferenzeUrl?: string;
    votiStimaNota: string;
  };
  ultimaNotizia: {
    titolo: string;
    fonte: string;
    dataOra: string;
    url: string;
    sintesi: string;
  };
  /** Articolo RSS con cognome + Vannacci/FN (solo RUMOR_FN_VERIFICATO). */
  rumorFnVerificato?: boolean;
};

export type DefectionNewsStato =
  | "PASSAGGIO UFFICIALE"
  | "RUMOR STAMPA"
  | "CAMBIO GRUPPO"
  | "MOVIMENTO ALTRI PARTITI (Esterno a FN)";

export type DefectionNewsItem = {
  id: string;
  titolo: string;
  fonte: string;
  dataOra: string;
  url: string;
  sintesi: string;
  politicianId: string | null;
  statoNotizia: DefectionNewsStato;
  partitoProvenienza?: PartitoProvenienza;
  /** Solo se il passaggio è verso FN; mai per movimenti esterni. */
  beneficioPotenzialeFn?: { voti: number; pp: number };
  /** Cosa è verificato (es. atto Camera) vs ipotesi simulata. */
  verificaEtichetta?: string;
  ipotesiSimulataEtichetta?: string;
};

export type DefectionAggregates = {
  ingressiUfficiali: number;
  parlamentariUfficiali: number;
  consiglieriUfficiali: number;
  sindaciUfficiali: number;
  inAvvicinamento: number;
  profiliInTransizione: number;
  doteVotiPotenziale: number;
  dotePpPotenziale: number;
  doteVotiTotale: number;
  dotePpNazionale: number;
  indiceMedioStampa: number;
};

/** Cariche di garanzia — escluse da radar defezione e match RSS. */
export const DEFECTION_EXCLUDED_GUARANTEE_NAMES = [
  "Lorenzo Fontana",
  "Ignazio La Russa",
  "Giorgia Meloni",
  "Matteo Salvini",
  "Antonio Tajani",
] as const;

export function isExcludedGuaranteePolitician(nome: string): boolean {
  const n = nome.toLowerCase();
  return DEFECTION_EXCLUDED_GUARANTEE_NAMES.some((g) => n.includes(g.toLowerCase()));
}

/** Ripulisce collegi da doppie parentesi e ripetizioni del nome regione. */
export function formatCleanConstituency(regione: string, collegioRaw: string): string {
  let raw = collegioRaw.trim();
  const nestedCityCode = raw.match(
    /\(\s*([^()]+?)\s*\(\s*Camera\s*([UP]\d+)\s*\)\s*\)/i,
  );
  if (nestedCityCode) {
    return `${regione} · ${nestedCityCode[1]!.trim()} (${nestedCityCode[2]!.toUpperCase()})`;
  }
  if (!raw || /verifica scheda camera/i.test(raw)) {
    return `${regione} · Collegio da verificare`;
  }
  if (/circoscrizione|responsabilità nazionale|tutta italia/i.test(raw)) {
    const plain = raw.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    return `${regione} · ${plain}`;
  }

  const reg = regione.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  raw = raw.replace(new RegExp(reg, "gi"), " ");
  raw = raw.replace(/\(\s*[^)]*\(\s*Camera\s*([UP]\d+)\s*\)\s*\)/gi, " ($1)");
  raw = raw.replace(/\(\s*Camera\s*([UP]\d+)\s*\)/gi, " ($1)");
  raw = raw.replace(/\(\s*([UP]\d+)\s*\)/gi, " ($1)");
  raw = raw.replace(/\s+/g, " ").trim();

  const codes = [...raw.matchAll(/\b([UP]\d+)\b/gi)].map((m) => m[1]!.toUpperCase());
  const code = codes[codes.length - 1] ?? null;

  const parenMatches = [...raw.matchAll(/\(([^()]+)\)/g)].map((m) => m[1]!.trim());
  let locality =
    parenMatches
      .filter((p) => !/^[UP]\d+$/i.test(p) && !/plurinominale|uninominale|lista/i.test(p))
      .pop() ?? "";

  if (!locality) {
    locality = raw
      .replace(/\([^)]*\)/g, " ")
      .replace(/\b[UP]\d+\b/gi, " ")
      .replace(/\b\d+-P\d+\b/gi, " ")
      .replace(/Camera|Collegio|plurinominale|uninominale/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const parts = locality.split(/[-·/]/).map((s) => s.trim()).filter(Boolean);
    locality = parts[parts.length - 1] ?? locality;
  }

  locality = locality.replace(/\b[UP]\d+\b/gi, "").replace(/\s+/g, " ").trim();
  if (!locality) locality = "Collegio";

  return code ? `${regione} · ${locality} (${code})` : `${regione} · ${locality}`;
}

export function formatCollegioDisplay(regione: Region, raw: string): string {
  return formatCleanConstituency(regione, raw);
}

/** Solo esterni a FN: cambi gruppo verificati e rumor stampa. */
export function isRassegnaExternalPolitician(p: TrackedPolitician): boolean {
  if (isExcludedGuaranteePolitician(p.nome)) return false;
  if (p.stato === "UFFICIALE_FN" || p.stato === "BACINO_CDX_IN_CARICA") return false;
  return (
    p.stato === "CAMBIO_GRUPPO_VERIFICATO" ||
    p.stato === "RUMOR_FN_VERIFICATO" ||
    Boolean(p.cambioGruppoDa && p.cambioGruppoA)
  );
}

export function filterRassegnaExternalsOnly(list: TrackedPolitician[]): TrackedPolitician[] {
  return list.filter(isRassegnaExternalPolitician);
}

export function compactGruppoLabel(label: string): string {
  if (label === "Fratelli d'Italia") return "FdI";
  if (label === "Gruppo Misto") return "Misto";
  if (label === "Forza Italia") return "FI";
  if (label === "Futuro Nazionale") return "FN";
  return label;
}

export function passaggioCompattoLine(p: TrackedPolitician): string {
  if (p.cambioGruppoDa && p.cambioGruppoA) {
    return `${compactGruppoLabel(p.cambioGruppoDa)} → ${compactGruppoLabel(p.cambioGruppoA)}`;
  }
  const m = p.statoDescrittivo.match(/Da\s+(.+?)\s+→\s+(.+?)(?:\s·|$)/);
  if (m) {
    return `${compactGruppoLabel(m[1]!.trim())} → ${compactGruppoLabel(m[2]!.trim())}`;
  }
  return transizioneLabel(p);
}

export function passaggioMetaLine(p: TrackedPolitician): string {
  if (p.cambioGruppoFonte?.includes("Camera")) {
    return "Cambio gruppo Camera verificato (Atto XIX Leg.)";
  }
  if (p.stato === "RUMOR_FN_VERIFICATO") {
    return "Rumor stampa con menzione FN/Vannacci (fonte media)";
  }
  if (p.dataCambioPartito) return "Open Data · Datato";
  return "Fonte anagrafe";
}

/** Destinazione esplicita verso partiti/figure esterni a FN. */
const EXTERNAL_DESTINATION_PATTERN =
  /\b(rizzo|marco\s*rizzo|democrazia\s*sovrana|dsp\b|forza\s*italia|noi\s*moderati|azione\b|italia\s*viva|partito\s*democratico|\bpd\b|centrosinistra|movimento\s*5\s*stelle|\bm5s\b|lega\b|fratelli\s*d['']italia|\bfdi\b|sud\s*chiama\s*nord|italexit|cateno\s*de\s*luca|\bavs\b|verdi\b|sinistra\s*italiana)\b/i;

/** Solo menzione esplicita — niente abbreviazione ambigua «FN» da sola. */
const FN_DESTINATION_PATTERN =
  /\b(futuro\s*nazionale|vannacci|generale\s*vannacci)\b/i;

/** Ingresso FN solo se titolo/snippet citano esplicitamente Futuro Nazionale o Vannacci. */
export function isExplicitFnDestinationNews(titolo: string, sintesi: string): boolean {
  return FN_DESTINATION_PATTERN.test(`${titolo} ${sintesi}`);
}

/**
 * Se la notizia indica un arruolamento/passaggio verso un soggetto diverso da FN,
 * non attribuire beneficio voti né etichetta PASSAGGIO UFFICIALE FN.
 */
export function detectExternalPartyDestination(
  titolo: string,
  sintesi: string,
): boolean {
  const blob = `${titolo} ${sintesi}`;
  if (isExplicitFnDestinationNews(titolo, sintesi)) return false;
  return EXTERNAL_DESTINATION_PATTERN.test(blob);
}

/** Limiti realistici per carica: un esponente locale non genera centinaia di migliaia di voti. */
export function capBeneficioVotiByRole(
  ruolo: PoliticianRole | undefined,
  voti: number,
): number {
  const abs = Math.abs(voti);
  const maxByRole: Record<PoliticianRole, number> = {
    Deputato: 45_000,
    Senatore: 55_000,
    Eurodeputato: 40_000,
    "Consigliere Regionale": 12_000,
    Sindaco: 8_000,
    "Dirigente / Amministratore": 5_000,
  };
  const cap = ruolo ? maxByRole[ruolo] : 15_000;
  return Math.min(abs, cap) * Math.sign(voti || 1);
}

export function beneficioFnFromPolitician(
  pol: TrackedPolitician,
  titolo: string,
  sintesi: string,
): { voti: number; pp: number } | undefined {
  // Ferrea: zero beneficio FN senza menzione esplicita Futuro Nazionale / Vannacci.
  if (!isExplicitFnDestinationNews(titolo, sintesi)) return undefined;
  if (detectExternalPartyDestination(titolo, sintesi)) return undefined;
  if (pol.partitoDestinazione && pol.partitoDestinazione !== "Futuro Nazionale") {
    return undefined;
  }
  if (
    pol.stato !== "UFFICIALE_FN" &&
    pol.stato !== "RUMOR_FN_VERIFICATO" &&
    !canMarkRumorFnFromNews(pol, titolo, sintesi)
  ) {
    return undefined;
  }
  const raw =
    pol.beneficioIngressoFn?.votiPortatiStimati ?? pol.doteElettorale.votiPortatiStimati;
  const voti = capBeneficioVotiByRole(pol.ruolo, raw);
  const ratio = raw > 0 ? voti / raw : 0;
  const ppRaw =
    pol.beneficioIngressoFn?.crescitaRegionePp ?? pol.doteElettorale.impattoRegionePp;
  return { voti, pp: Math.round(ppRaw * ratio * 100) / 100 };
}

export function ruoloBadgeShort(ruolo: PoliticianRole): string {
  if (ruolo === "Deputato") return "Deputato";
  if (ruolo === "Senatore") return "Senatore";
  if (ruolo === "Eurodeputato") return "Eurodeputato";
  if (ruolo === "Consigliere Regionale") return "Cons. Reg.";
  if (ruolo === "Sindaco") return "Sindaco";
  return "Esp.";
}

export function isPoliticianInTransition(p: TrackedPolitician): boolean {
  return p.stato !== "UFFICIALE_FN";
}

export function transizioneLabel(p: TrackedPolitician): string {
  if (p.cambioGruppoDa && p.cambioGruppoA) {
    const fonte = p.cambioGruppoFonte ? ` (${p.cambioGruppoFonte})` : "";
    return `Da ${p.cambioGruppoDa} → ${p.cambioGruppoA}${fonte}`;
  }
  return p.statoDescrittivo;
}

const FN_REGION_SHARE_BASELINE: Partial<Record<Region, number>> = {
  Piemonte: 7.61,
  Lombardia: 7.45,
  Liguria: 7.52,
  Veneto: 7.38,
  "Emilia-Romagna": 7.28,
  Toscana: 7.85,
  Lazio: 7.72,
  Campania: 7.94,
  Sicilia: 8.05,
  Puglia: 7.68,
  Sardegna: 7.55,
};

const NATIONAL_FN_SHARE_BASELINE = 7.61;

function fnRegionShareBaseline(region: Region): number {
  return FN_REGION_SHARE_BASELINE[region] ?? NATIONAL_FN_SHARE_BASELINE;
}

function affinitaBipForPolitician(p: TrackedPolitician): string {
  const prov = p.partitoProvenienza;
  const r = p.regione;
  if (prov === "Lega" && (r === "Veneto" || r === "Lombardia" || r === "Piemonte")) {
    return "Cap. 15 Agricoltura";
  }
  if (r === "Sicilia" || r === "Calabria" || r === "Campania") {
    return "Cap. 5 Remigrazione";
  }
  if (prov === "Fratelli d'Italia" || prov === "Lega") {
    return "Cap. 7 Sicurezza";
  }
  if (r === "Toscana" || r === "Emilia-Romagna" || r === "Lombardia") {
    return "Cap. 3 Imprese & PMI";
  }
  return "Cap. 2 Lavoro & cuneo fiscale";
}

export function computeBeneficioIngressoFn(p: TrackedPolitician): BeneficioIngressoFn {
  const voti = p.doteElettorale.votiPortatiStimati;
  const pp = p.doteElettorale.impattoRegionePp;
  const regioneOggiPct = fnRegionShareBaseline(p.regione);
  const regioneDopoPct = Math.round((regioneOggiPct + pp) * 100) / 100;
  return {
    votiPortatiStimati: voti,
    crescitaRegionePp: pp,
    regioneOggiPct,
    regioneDopoPct,
    potenzaMediatica0100: p.potenzaMediatica.score0100,
    affinitaProgrammaticaBip: affinitaBipForPolitician(p),
  };
}

export function attachBeneficioIngressoFn(p: TrackedPolitician): TrackedPolitician {
  return { ...p, beneficioIngressoFn: computeBeneficioIngressoFn(p) };
}

export function mediaDisplayLine(p: TrackedPolitician): string {
  const b = p.beneficioIngressoFn ?? computeBeneficioIngressoFn(p);
  return `Indice ${b.potenzaMediatica0100}/100 · ${p.potenzaMediatica.livelloVisibilita} · ${b.affinitaProgrammaticaBip}`;
}

export type DefectionSimulatorAggregates = {
  ultimiCambiCount: number;
  giaInFnCount: number;
  ingressiSimulatiCount: number;
  beneficioVotiTotal: number;
  spintaMediaPp: number;
};

export function computeSimulatorAggregates(
  list: TrackedPolitician[],
  simulatedIds: ReadonlySet<string>,
): DefectionSimulatorAggregates {
  const eligible = filterRassegnaExternalsOnly(list);
  const cambi = eligible.filter(
    (x) =>
      x.stato === "CAMBIO_GRUPPO_VERIFICATO" || x.stato === "RUMOR_FN_VERIFICATO",
  );
  const simulated = eligible.filter((x) => simulatedIds.has(x.id));

  let beneficioVotiTotal: number;
  let ppNumerator: number;
  let ppDenom: number;

  if (simulatedIds.size > 0) {
    const picked = eligible.filter((x) => simulatedIds.has(x.id));
    beneficioVotiTotal = picked.reduce(
      (s, x) => s + (x.beneficioIngressoFn?.votiPortatiStimati ?? x.doteElettorale.votiPortatiStimati),
      0,
    );
    ppNumerator = picked.reduce(
      (s, x) => s + (x.beneficioIngressoFn?.crescitaRegionePp ?? x.doteElettorale.impattoRegionePp),
      0,
    );
    ppDenom = picked.length;
  } else {
    beneficioVotiTotal = cambi.reduce(
      (s, x) => s + (x.beneficioIngressoFn?.votiPortatiStimati ?? x.doteElettorale.votiPortatiStimati),
      0,
    );
    ppNumerator = cambi.reduce(
      (s, x) => s + (x.beneficioIngressoFn?.crescitaRegionePp ?? x.doteElettorale.impattoRegionePp),
      0,
    );
    ppDenom = cambi.length;
  }

  return {
    ultimiCambiCount: cambi.length,
    giaInFnCount: 0,
    ingressiSimulatiCount: simulated.length,
    beneficioVotiTotal,
    spintaMediaPp: ppDenom === 0 ? 0 : Math.round((ppNumerator / ppDenom) * 100) / 100,
  };
}

export function newsLinksFnOrVannacci(titolo: string, sintesi: string): boolean {
  return isExplicitFnDestinationNews(titolo, sintesi);
}

export function canMarkRumorFnFromNews(
  politician: TrackedPolitician,
  titolo: string,
  sintesi: string,
): boolean {
  if (isExcludedGuaranteePolitician(politician.nome)) return false;
  const parts = politician.nome.toLowerCase().split(/\s+/);
  const cognome = parts[parts.length - 1];
  if (!cognome || cognome.length < 3) return false;
  const blob = `${titolo} ${sintesi}`.toLowerCase();
  if (!blob.includes(cognome)) return false;
  return newsLinksFnOrVannacci(titolo, sintesi);
}

function p(
  partial: Omit<
    TrackedPolitician,
    "potenzaMediatica" | "doteElettorale" | "collegioDisplay" | "ultimaNotizia"
  > & {
    score: number;
    visibilita: LivelloVisibilita;
    pref: number;
    voti: number;
    pp: number;
    metricKind?: ElectoralPreferenzeKind;
    fontePreferenze?: string;
    fontePreferenzeUrl?: string;
    votiStimaNota: string;
    newsTitolo: string;
    newsFonte: string;
    newsData: string;
    newsUrl: string;
    newsSintesi: string;
  },
): TrackedPolitician {
  const base: TrackedPolitician = {
    id: partial.id,
    nome: partial.nome,
    ruolo: partial.ruolo,
    regione: partial.regione,
    provinciaCollegio: partial.provinciaCollegio,
    collegioDisplay: formatCollegioDisplay(partial.regione, partial.provinciaCollegio),
    caricaEtichetta: partial.caricaEtichetta,
    statoDescrittivo: partial.statoDescrittivo,
    partitoProvenienza: partial.partitoProvenienza,
    partitoDestinazione: partial.partitoDestinazione,
    stato: partial.stato,
    rumorFnVerificato: partial.rumorFnVerificato,
    potenzaMediatica: {
      score0100: partial.score,
      livelloVisibilita: partial.visibilita,
    },
    doteElettorale: {
      preferenzeStoriche: partial.pref,
      votiPortatiStimati: partial.voti,
      impattoRegionePp: partial.pp,
      metricKind: partial.metricKind,
      fontePreferenze: partial.fontePreferenze,
      fontePreferenzeUrl: partial.fontePreferenzeUrl,
      votiStimaNota: partial.votiStimaNota,
    },
    ultimaNotizia: {
      titolo: partial.newsTitolo,
      fonte: partial.newsFonte,
      dataOra: partial.newsData,
      url: partial.newsUrl,
      sintesi: partial.newsSintesi,
    },
  };
  return attachBeneficioIngressoFn(base);
}

export function formatCompactFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

export function ruoloPrefix(ruolo: PoliticianRole): string {
  if (ruolo === "Deputato" || ruolo === "Senatore" || ruolo === "Eurodeputato") return "On.";
  if (ruolo === "Consigliere Regionale") return "Cons.";
  if (ruolo === "Sindaco") return "Sind.";
  return "Esp.";
}

export function statoLabel(stato: PoliticianStato): string {
  const map: Record<PoliticianStato, string> = {
    UFFICIALE_FN: "Già in Futuro Nazionale",
    CAMBIO_GRUPPO_VERIFICATO: "Cambio gruppo / Camera",
    RUMOR_FN_VERIFICATO: "Rumor stampa verificato (FN)",
    BACINO_CDX_IN_CARICA: "Bacino CDX in carica (simulazione)",
  };
  return map[stato];
}

export function statoDotClass(stato: PoliticianStato): string {
  const map: Record<PoliticianStato, string> = {
    UFFICIALE_FN: "bg-emerald-400",
    CAMBIO_GRUPPO_VERIFICATO: "bg-cyan-400",
    RUMOR_FN_VERIFICATO: "bg-yellow-400",
    BACINO_CDX_IN_CARICA: "bg-sky-400",
  };
  return map[stato];
}

export function rowBgForStato(stato: PoliticianStato): string {
  const map: Record<PoliticianStato, string> = {
    UFFICIALE_FN: "border-emerald-500/25 bg-emerald-500/[0.06]",
    CAMBIO_GRUPPO_VERIFICATO: "border-cyan-500/25 bg-cyan-500/[0.05]",
    RUMOR_FN_VERIFICATO: "border-yellow-500/25 bg-yellow-500/[0.05]",
    BACINO_CDX_IN_CARICA: "border-white/[0.08] bg-white/[0.02]",
  };
  return map[stato];
}

export function computeAggregates(list: TrackedPolitician[]): DefectionAggregates {
  const official = list.filter((x) => x.stato === "UFFICIALE_FN");
  const inTransition = list.filter(isPoliticianInTransition);
  const rumors = list.filter(
    (x) =>
      x.stato === "RUMOR_FN_VERIFICATO" || x.stato === "CAMBIO_GRUPPO_VERIFICATO",
  );
  const isParl = (r: PoliticianRole) =>
    r === "Deputato" || r === "Senatore" || r === "Eurodeputato";
  const parlamentariUfficiali = official.filter((x) => isParl(x.ruolo)).length;
  const consiglieriUfficiali = official.filter((x) => x.ruolo === "Consigliere Regionale").length;
  const sindaciUfficiali = official.filter((x) => x.ruolo === "Sindaco").length;
  const doteVotiPotenziale = inTransition.reduce(
    (s, x) => s + x.doteElettorale.votiPortatiStimati,
    0,
  );
  const dotePpPotenziale = inTransition.reduce(
    (s, x) => s + x.doteElettorale.impattoRegionePp,
    0,
  );
  const doteVotiTotale = official.reduce((s, x) => s + x.doteElettorale.votiPortatiStimati, 0);
  const dotePpNazionale = official.reduce((s, x) => s + x.doteElettorale.impattoRegionePp, 0);
  const indiceMedioStampa =
    inTransition.length === 0
      ? 0
      : inTransition.reduce((s, x) => s + x.potenzaMediatica.score0100, 0) / inTransition.length;
  return {
    ingressiUfficiali: official.length,
    parlamentariUfficiali,
    consiglieriUfficiali,
    sindaciUfficiali,
    inAvvicinamento: rumors.length,
    profiliInTransizione: inTransition.length,
    doteVotiPotenziale,
    dotePpPotenziale: Math.round(dotePpPotenziale * 100) / 100,
    doteVotiTotale,
    dotePpNazionale: Math.round(dotePpNazionale * 100) / 100,
    indiceMedioStampa: Math.round(indiceMedioStampa),
  };
}

export type PoliticianSortKey = "voti" | "media" | "regione" | "data";

export type AnagrafeFilterId = "ALL" | "CAMBIO_GRUPPO" | "RUMOR";

export function filterPoliticians(
  list: TrackedPolitician[],
  opts: {
    regione?: Region | "ALL";
    stato?: AnagrafeFilterId;
    ruolo?: PoliticianRole | "ALL" | "PARLAMENTO" | "CONSIGLIERE" | "SINDACO";
    search?: string;
    rassegnaExternalsOnly?: boolean;
  },
): TrackedPolitician[] {
  let out = opts.rassegnaExternalsOnly
    ? filterRassegnaExternalsOnly(list)
    : list.filter((x) => !isExcludedGuaranteePolitician(x.nome));
  if (opts.regione && opts.regione !== "ALL") {
    out = out.filter((x) => x.regione === opts.regione);
  }
  if (opts.stato && opts.stato !== "ALL") {
    if (opts.stato === "CAMBIO_GRUPPO") {
      out = out.filter((x) => x.stato === "CAMBIO_GRUPPO_VERIFICATO");
    } else if (opts.stato === "RUMOR") {
      out = out.filter((x) => x.stato === "RUMOR_FN_VERIFICATO");
    }
  }
  if (opts.ruolo && opts.ruolo !== "ALL") {
    if (opts.ruolo === "PARLAMENTO") {
      out = out.filter(
        (x) =>
          x.ruolo === "Deputato" || x.ruolo === "Senatore" || x.ruolo === "Eurodeputato",
      );
    } else if (opts.ruolo === "CONSIGLIERE") {
      out = out.filter((x) => x.ruolo === "Consigliere Regionale");
    } else if (opts.ruolo === "SINDACO") {
      out = out.filter(
        (x) => x.ruolo === "Sindaco" || x.ruolo === "Dirigente / Amministratore",
      );
    } else out = out.filter((x) => x.ruolo === opts.ruolo);
  }
  const q = opts.search?.trim().toLowerCase();
  if (q) {
    const provenienzaAlias =
      q === "da lega" || q === "lega"
        ? "Lega"
        : q === "da fdi" || q === "fdi" || q.includes("fratelli")
          ? "Fratelli d'Italia"
          : q.includes("forza")
            ? "Forza Italia"
            : q.includes("m5s") || q === "altri" || q.includes("ex m5s")
              ? "Altri"
              : null;
    out = out.filter((x) => {
      if (provenienzaAlias && x.partitoProvenienza === provenienzaAlias) return true;
      return (
        x.nome.toLowerCase().includes(q) ||
        x.collegioDisplay.toLowerCase().includes(q) ||
        x.regione.toLowerCase().includes(q) ||
        x.partitoProvenienza.toLowerCase().includes(q) ||
        (x.cambioGruppoDa?.toLowerCase().includes(q) ?? false) ||
        (x.slug?.toLowerCase().includes(q) ?? false)
      );
    });
  }
  return out;
}

export function countAnagrafeByFilter(
  list: TrackedPolitician[],
  regione: Region | "ALL",
): Record<AnagrafeFilterId, number> {
  const base = filterPoliticians(list, { regione, stato: "ALL", rassegnaExternalsOnly: true });
  return {
    ALL: base.length,
    CAMBIO_GRUPPO: filterPoliticians(base, { stato: "CAMBIO_GRUPPO" }).length,
    RUMOR: filterPoliticians(base, { stato: "RUMOR" }).length,
  };
}

export function sortPoliticians(
  list: TrackedPolitician[],
  key: PoliticianSortKey,
): TrackedPolitician[] {
  const copy = [...list];
  if (key === "data") {
    copy.sort((a, b) => {
      const da = a.dataCambioPartito ?? a.ultimaNotizia.dataOra;
      const db = b.dataCambioPartito ?? b.ultimaNotizia.dataOra;
      return new Date(db).getTime() - new Date(da).getTime();
    });
  } else if (key === "voti") {
    copy.sort((a, b) => b.doteElettorale.votiPortatiStimati - a.doteElettorale.votiPortatiStimati);
  } else if (key === "media") {
    copy.sort((a, b) => b.potenzaMediatica.score0100 - a.potenzaMediatica.score0100);
  } else {
    copy.sort(
      (a, b) =>
        a.regione.localeCompare(b.regione, "it") ||
        b.doteElettorale.votiPortatiStimati - a.doteElettorale.votiPortatiStimati,
    );
  }
  return copy;
}

const NOISE =
  /ciclismo|tuttobici|calcio|serie a|champions|sanremo|gossip|spettacol|reality|big brother|formula 1|motogp|tennis|nadal|djokovic|nbc\s*news|electoral\s*law|giorgia\s*meloni'?s\s*new/i;

/** Pattern esplicito di transizione partitica (condizione 1). */
export const DEFECTION_TRANSITION_PATTERN =
  /lascia\s+(il\s+)?gruppo|esce\s+da|addio\s+alla\s+lega|lascia\s+(la\s+)?lega|lascia\s+fratelli\s+d['']italia|lascia\s+forza\s+italia|passa\s+al\s+gruppo\s+misto|aderisce\s+a\s+futuro\s+nazionale|passa\s+con\s+vannacci|cambio\s+di\s+casacca|nuovo\s+ingresso\s+in|transfugh[io]|dimissioni\s+dal\s+grupp|passa\s+(alla|al|con)\s+(lega|fdi|fratelli|forza\s+italia|misto|futuro)|abbandona\s+(il\s+)?grupp/i;

/** Partiti / figure monitorate (condizione 2). */
export const DEFECTION_ACTOR_PATTERN =
  /\b(lega|fratelli\s+d['']italia|\bfdi\b|forza\s+italia|futuro\s+nazionale|vannacci|gruppo\s+misto|sud\s+chiama\s+nord|salvini)\b/i;

const ENGLISH_STOP =
  /\b(the|and|with|from|after|their|this|that|which|would|could|should|among|dead|collision|americans?|canadian|electoral\s+law|nbc)\b/i;

const ITALIAN_STRONG =
  /\b(il|lo|la|gli|le|del|della|dei|che|non|è|sono|lascia|passa|gruppo|lega|deputato|senatore|italia|italiano)\b/i;

const FOREIGN_HOST =
  /nbcnews\.com|bbc\.co\.uk|bbc\.com|cnn\.com|nytimes\.com|reuters\.com|theguardian\.com|washingtonpost\.com|apnews\.com|foxnews\.com|bloomberg\.com/i;

export function isForeignEnglishDefectionNoise(titolo: string, sintesi = "", url = ""): boolean {
  if (FOREIGN_HOST.test(url)) return true;
  const blob = `${titolo} ${sintesi}`;
  const enHits = (titolo.match(new RegExp(ENGLISH_STOP.source, "gi")) ?? []).length;
  if (enHits >= 2 && !ITALIAN_STRONG.test(titolo)) return true;
  if (ENGLISH_STOP.test(blob) && !ITALIAN_STRONG.test(titolo)) return true;
  return false;
}

/**
 * Notizia «Cambi di Partito» solo se:
 * 1) pattern di transizione esplicito
 * 2) menzione partito/figura monitorata
 * 3) non inglese / host estero
 */
export function isDefectionNewsRelevant(
  titolo: string,
  sintesi: string,
  url = "",
): boolean {
  const blob = `${titolo} ${sintesi}`;
  if (NOISE.test(blob)) return false;
  if (isForeignEnglishDefectionNoise(titolo, sintesi, url)) return false;
  if (!DEFECTION_TRANSITION_PATTERN.test(blob)) return false;
  if (!DEFECTION_ACTOR_PATTERN.test(blob)) return false;
  return true;
}

export function matchPoliticianFromText(
  titolo: string,
  sintesi: string,
  politicians: TrackedPolitician[],
): TrackedPolitician | null {
  const blob = `${titolo} ${sintesi}`.toLowerCase();
  for (const pol of politicians) {
    if (isExcludedGuaranteePolitician(pol.nome)) continue;
    const parts = pol.nome.toLowerCase().split(/\s+/);
    const cognome = parts[parts.length - 1];
    if (cognome && cognome.length > 3 && blob.includes(cognome)) return pol;
    if (blob.includes(pol.nome.toLowerCase())) return pol;
  }
  return null;
}

export function newsStatoFromPolitician(
  pol: TrackedPolitician | null,
  titolo: string,
  sintesi: string,
): DefectionNewsItem["statoNotizia"] {
  const explicitFn = isExplicitFnDestinationNews(titolo, sintesi);
  if (!explicitFn && detectExternalPartyDestination(titolo, sintesi)) {
    return "MOVIMENTO ALTRI PARTITI (Esterno a FN)";
  }
  // Senza menzione FN/Vannacci non esiste PASSAGGIO UFFICIALE verso FN.
  if (!explicitFn) {
    if (pol?.stato === "CAMBIO_GRUPPO_VERIFICATO") return "CAMBIO GRUPPO";
    if (detectExternalPartyDestination(titolo, sintesi) || EXTERNAL_DESTINATION_PATTERN.test(`${titolo} ${sintesi}`)) {
      return "MOVIMENTO ALTRI PARTITI (Esterno a FN)";
    }
    return "RUMOR STAMPA";
  }
  if (!pol) return "RUMOR STAMPA";
  if (
    pol.partitoDestinazione &&
    pol.partitoDestinazione !== "Futuro Nazionale" &&
    pol.partitoDestinazione !== "In carica (nessun passaggio FN)"
  ) {
    return "MOVIMENTO ALTRI PARTITI (Esterno a FN)";
  }
  if (pol.stato === "UFFICIALE_FN") return "PASSAGGIO UFFICIALE";
  if (canMarkRumorFnFromNews(pol, titolo, sintesi)) return "RUMOR STAMPA";
  if (pol.stato === "CAMBIO_GRUPPO_VERIFICATO") return "CAMBIO GRUPPO";
  return "RUMOR STAMPA";
}

export function confirmPoliticianInFn(pol: TrackedPolitician): TrackedPolitician {
  return {
    ...pol,
    stato: "UFFICIALE_FN",
    partitoDestinazione: "Futuro Nazionale",
    caricaEtichetta: "Già in Futuro Nazionale",
    statoDescrittivo: "Ingresso ufficiale · Futuro Nazionale (conferma operatore)",
    rumorFnVerificato: true,
  };
}

export function estimateDoteFromInputs(opts: {
  regione: Region;
  preferenzeStoriche: number;
  score: number;
  stato?: PoliticianStato;
}): ReturnType<typeof computeDoteFromElectoralRecord> {
  const statoForDote: DefectionStatoForDote =
    opts.stato === "UFFICIALE_FN"
      ? "UFFICIALE_FN"
      : opts.stato === "RUMOR_FN_VERIFICATO"
        ? "RUMOR_FN_VERIFICATO"
        : opts.stato === "CAMBIO_GRUPPO_VERIFICATO"
          ? "CAMBIO_GRUPPO_VERIFICATO"
          : "BACINO_CDX_IN_CARICA";
  return computeDoteFromElectoralRecord(
    {
      kind: "camera_uninominal_2022",
      preferenzeStoriche: opts.preferenzeStoriche,
      sourceLabel: "Registrazione manuale Rassegna",
      sourceUrl: "#",
      collegioLabel: "Preferenze dichiarate",
    },
    opts.regione,
    statoForDote,
  );
}

export function registerManualPassaggio(input: {
  nome: string;
  ruolo: PoliticianRole;
  regione: Region;
  provinciaCollegio: string;
  partitoProvenienza: PartitoProvenienza;
  preferenzeStoriche: number;
}): TrackedPolitician {
  if (isExcludedGuaranteePolitician(input.nome)) {
    throw new Error("Profilo escluso: carica istituzionale di garanzia.");
  }
  const score = mediaScoreFromPreferenze(input.preferenzeStoriche, 0);
  const dote = estimateDoteFromInputs({
    regione: input.regione,
    preferenzeStoriche: input.preferenzeStoriche,
    score,
    stato: "RUMOR_FN_VERIFICATO",
  });
  const id = `def-manual-${Date.now()}`;
  return p({
    id,
    nome: input.nome,
    ruolo: input.ruolo,
    regione: input.regione,
    provinciaCollegio: input.provinciaCollegio,
    caricaEtichetta: `In carica · ${input.partitoProvenienza}`,
    statoDescrittivo:
      "Passaggio registrato manualmente · verificare articolo stampa con Vannacci/FN",
    partitoProvenienza: input.partitoProvenienza,
    partitoDestinazione: "Futuro Nazionale",
    stato: "RUMOR_FN_VERIFICATO",
    rumorFnVerificato: true,
    score,
    visibilita:
      score >= 70
        ? "Nazionale TV & Stampa"
        : score >= 50
          ? "Forte seguito regionale"
          : "Radicamento locale / Sindaco",
    pref: dote.preferenzeStoriche,
    voti: dote.votiPortatiStimati,
    pp: dote.impattoRegionePp,
    metricKind: dote.metricKind,
    fontePreferenze: dote.fontePreferenze,
    fontePreferenzeUrl: dote.fontePreferenzeUrl,
    votiStimaNota: dote.votiStimaNota,
    newsTitolo: `Registrazione passaggio: ${input.nome}`,
    newsFonte: "Registro FN",
    newsData: new Date().toISOString(),
    newsUrl: "#",
    newsSintesi: "Inserimento manuale — allegare fonte stampa con Vannacci o Futuro Nazionale.",
  });
}

export { REGIONS as DEFECTION_REGIONS };
