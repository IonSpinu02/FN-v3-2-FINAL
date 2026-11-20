import type { Region } from "./constants";
import {
  matchExactBipSubDossier,
  subDossierToSolutionSlide,
} from "./bipSubDossierMatch";
import { territoryBenchmarkLine } from "./regionBenchmarkMatrix";
import { officialModuloBLine } from "./territoryIssueContext";
import {
  HOUSING_EVICTION_CONTEXT,
  isHousingEvictionContext,
} from "./territoryIssueDisambiguation";
import type {
  ElectoralSubTheme,
  TerritoryIssueCategory,
} from "./territoryIssuesTypes";

export {
  HOUSING_EVICTION_CONTEXT,
  SECURITY_EVICTION_CONTEXT,
  isHousingEvictionContext,
} from "./territoryIssueDisambiguation";

/** Emergenze cittadine con risposta esplicita nel B.I.P. (radar programma-driven). */
export type BipEmergency = {
  id: string;
  label: string;
  keywords: RegExp;
  category: TerritoryIssueCategory;
  electoralSubTheme?: ElectoralSubTheme | null;
  primaryChapter: number;
  chapterTitle: string;
  /** Riferimento pagina per badge (es. «94» o «42–55»). */
  pageRef: string;
  solutionHint: string;
};

export const BIP_EMERGENCIES: BipEmergency[] = [
  {
    id: "E13_EMERGENZA_ABITATIVA",
    label: "Emergenza abitativa, sfratti e ricollocamento famiglie/anziani",
    keywords:
      /sgomber|sfratt|emergenza\s*abitativ|case\s*popolar|\berp\b|inquilin|ributtat.{0,20}strada|proprietari[oa].{0,24}immobil|ordine\s*religios.{0,40}immobil/i,
    category: "COSTO_VITA",
    primaryChapter: 13,
    chapterTitle: "Famiglia, casa e natalità",
    pageRef: "89–96",
    solutionHint:
      "Priorità italiani/anziani fragili nelle graduatorie ERP, fondo emergenza abitativa, recupero immobili pubblici sfitti, Mutuo Tricolore (Cap. 5, 13, 14)",
  },
  {
    id: "E01_BABY_GANG_DEGRADO",
    label: "Baby gang, stazioni, degrado e occupazioni abusive",
    keywords:
      /baby\s*gang|degrad\s*urban|occupazion\s*abusiv|sgomber.{0,40}(campo\s*abusiv|centr[oi]\s*social|migrant|clandestin|spaccio|degrad|criminal)|stazion\s*(centrale|ferrovi)|spaccio\s*(in\s*)?(stazion|perifer)|daspo|zone\s*rosse|cantieri\s*di\s*cittadinanza|minorenni\s*non\s*imputab/i,
    category: "SICUREZZA",
    primaryChapter: 7,
    chapterTitle: "Sicurezza, ordine pubblico e quartieri",
    pageRef: "42–49",
    solutionHint:
      'Protocollo «Modellare, Bonificare, Presidiare e Ricostruire», imputabilità a 12 anni, Daspo 5 anni, Zone Rosse (Cap. 7, 8, 14)',
  },
  {
    id: "E02_FURTI_LEGITTIMA_DIFESA",
    label: "Furti, aggressioni e tutela Forze dell'Ordine",
    keywords:
      /legittima\s*difesa|furto\s*(in\s*)?(casa|appartament|negozi)|rapin|aggression|forze\s*dell['']ordine|poliziotto\s*ferito|scudo\s*legale|speronamento|modello\s*45\s*bis|reati\s*di\s*strada/i,
    category: "SICUREZZA",
    primaryChapter: 7,
    chapterTitle: "Sicurezza, ordine pubblico e quartieri",
    pageRef: "42–55",
    solutionHint:
      "Legittima Difesa artt. 52-55 c.p., scudo art. 53 c.p., tribunali strada 90 giorni, Fondo vittime (Cap. 7 & 8)",
  },
  {
    id: "E03_CARCERI_SOVRAFFOLLAMENTO",
    label: "Sovraffollamento carceri e carcere girevole",
    keywords:
      /san\s*vittore|sovraffollament\s*carcer|carceri\s*al\s*\d+\s*%|carcere\s*girevole|detenuti\s*stranier|polizia\s*penitenziaria|lavoro\s*intramurario|posti\s*carcer/i,
    category: "SICUREZZA",
    primaryChapter: 8,
    chapterTitle: "Giustizia rapida e sistema penitenziario",
    pageRef: "50–57",
    solutionHint:
      "10.000 posti in 36 mesi, rimpatrio 31,5%–35% detenuti stranieri, Dipartimento Polizia Penitenziaria (Cap. 5 & 8)",
  },
  {
    id: "E04_MSNA_ERP_COMUNI",
    label: "MSNA, sbarchi, ERP e bilanci comunali",
    keywords:
      /msna|minori\s*stranier\s*non\s*accompagnat|decreto\s*flusso|ricongiungiment\s*familiar|case\s*popolar|\berp\b|prefettur.*msna|sbarchi|\bong\b|attracco\s*navi|immigr.*comun|non\s*cittadin.*bonus/i,
    category: "SICUREZZA",
    electoralSubTheme: "immigrazione",
    primaryChapter: 5,
    chapterTitle: "Assimilazione e piano di remigrazione (22 misure)",
    pageRef: "24–30",
    solutionHint:
      "MSNA alle Prefetture, accertamento radiografico età, stop Decreti Flusso, priorità italiani ERP (Cap. 5 & 14)",
  },
  {
    id: "E05_BOLLETTE_GREEN_AUTO",
    label: "Caro-bollette, oneri di sistema, Case Green e blocco auto",
    keywords:
      /bollett|oneri\s*di\s*sistema|case\s*green|caldaia\s*obblig|fit\s*for\s*55|blocco\s*auto|euro\s*[45]|2035|motori\s*termic|caro\s*energia|dispacciament|rinnovabil.*bollett|ora\s*legale/i,
    category: "COSTO_VITA",
    electoralSubTheme: "energia",
    primaryChapter: 9,
    chapterTitle: "Energia, bollette e mobilità",
    pageRef: "58–65",
    solutionHint:
      "Taglio oneri bolletta, ora legale permanente, gas Russia, Nucleare SMR, stop Case Green (Cap. 9)",
  },
  {
    id: "E06_MUTUO_NATALITA",
    label: "Mutuo prima casa, crollo nascite e tasse sulla famiglia",
    keywords:
      /mutuo\s*(prima\s*casa|under\s*35|giovani\s*coppie)|fecondit|nascit|figli\s*per\s*donna|quoziente\s*famili|mutuo\s*tricolore|consap.*casa|affitt.*giovani|prima\s*casa\s*requisit/i,
    category: "COSTO_VITA",
    primaryChapter: 13,
    chapterTitle: "Famiglia, casa e natalità",
    pageRef: "89–94",
    solutionHint:
      'Mutuo Tricolore tasso 0% al 3° figlio, Quoziente Familiare, Reddito di Genitorialità (Cap. 1 & 13)',
  },
  {
    id: "E07_FISCO_PMI_CREDITO",
    label: "Fisco PMI, contante, CRIF e burocrazia GDPR",
    keywords:
      /saldo\s*e\s*acconto|iva\s*per\s*cassa|partita\s*iva|flat\s*tax|crif|segnalazion.*credit|contante\s*\d|bollino\s*impresa|gdpr\s*pmi|burocrazia\s*impres|cuneo\s*fiscale|nasp[ií]/i,
    category: "LAVORO",
    electoralSubTheme: "fisco_pmi",
    primaryChapter: 1,
    chapterTitle: "Dottrina economica, fiscalità e previdenza",
    pageRef: "6–11",
    solutionHint:
      "San Paolo, IVA per cassa, tetto contante 10.000 €, Bollino Impresa Sicura MIMIT (Cap. 1, 2, 4, 11)",
  },
  {
    id: "E08_COMUNI_SINDACI",
    label: "Comuni senza risorse per manutenzione e servizi",
    keywords:
      /sindac.*virtuos|compartecipaz.*irpef|aliquota\s*comunal.*negativ|bilancio\s*comun.*crisi|manutenzione\s*strad.*comun|gettito\s*irpef\s*comun|sussidiariet.*comun/i,
    category: "LAVORO",
    primaryChapter: 12,
    chapterTitle: "Regioni, federalismo fiscale e servizi",
    pageRef: "89–93",
    solutionHint:
      "Compartecipazione Comuni al gettito IRPEF e aliquota comunale negativa (Cap. 12)",
  },
  {
    id: "E09_PALLIATIVE_PENSIONI_TRUFFE",
    label: "Cure palliative, pensioni minime e truffe Over 65",
    keywords:
      /legge\s*38\s*\/\s*2010|(?:negat[ae]|mancan[oz]|liste?\s*d['']attesa|collasso|carenza).{0,40}cure\s*palliativ|cure\s*palliativ.{0,40}(?:negat|mancan|liste?\s*d['']attesa|collasso|carenza|legge\s*38)|suicidio\s*assistito|caregiver|pensione\s*minim|619|750\s*€|truff.*online|truff.*over\s*65|consap.*truff|41\s*anni\s*contribut/i,
    category: "SANITA",
    primaryChapter: 13,
    chapterTitle: "Famiglia, casa e natalità",
    pageRef: "94–100",
    solutionHint:
      "Legge 38/2010, pensione minima 750 €, Fondo CONSAP truffe Over 65 (Cap. 1, 11, 13, 14)",
  },
  {
    id: "E10_AGRICOLTURA_TERRITORIO",
    label: "Sottocosto, falso Made in Italy, FV agricolo, Po, cinghiali",
    keywords:
      /vendita\s*sottocosto|falso\s*made\s*in\s*italy|fotovoltaic.*(terra|agricol|campo)|cinghial|legge\s*157|corpo\s*forestale|regimaz.*\bpo\b|piano\s*nazionale\s*acqua|prezzo\s*(latte|grano)|mercosur|pac\b.*agricolt/i,
    category: "TERRITORIO",
    primaryChapter: 15,
    chapterTitle: "Agricoltura, acqua, pesca e caccia",
    pageRef: "101–107",
    solutionHint:
      "Divieto sottocosto, PAC veri agricoltori, divieto FV a terra, Piano Acqua/Po (Cap. 15)",
  },
  {
    id: "E11_SANITA_LISTE",
    label: "Liste d'attesa, CUP e carenza medici",
    // Mai `\bcup\b` nudo: matcha "America's Cup" e sport nautico.
    keywords:
      /liste?\s*d['']attesa|prenotazion[ei]\s+cup|cup\s+(?:sanitar|regionale|asl|aziendale|visite|online)|visite\s*specialistic|pronto\s*soccorso|code\s*(al\s*)?ps|carenza\s*medici|medicina\s*generale|intramoenia|agenas/i,
    category: "SANITA",
    primaryChapter: 12,
    chapterTitle: "Regioni, federalismo fiscale e servizi",
    pageRef: "89–93",
    solutionHint:
      "Deduzioni spese sanitarie, costi standard regionali, compartecipazione IRPEF (Cap. 1, 12, 13)",
  },
  {
    id: "E12_TRASPORTI_DIESEL_TPL",
    label: "Blocco diesel Euro 5, assicurazioni e ritardi TPL",
    keywords:
      /euro\s*[45]|hvo\b|e-fuel|rottamazione\s*forzata|area\s*b\b|ztl\b|ritard.*tren|pendolar|rimborso\s*abbonament|autotrasport|pedaggi|assicuraz.*auto/i,
    category: "TRASPORTI",
    primaryChapter: 9,
    chapterTitle: "Energia, bollette e mobilità",
    pageRef: "65–66",
    solutionHint:
      "HVO ed e-fuels senza rottamazione, potenziamento ferrovia e TPL (Cap. 3, 9)",
  },
];

/** Scioperi «teatrali», politica di partito, cronaca senza leva B.I.P. */
export const BIP_FEED_HARD_BLOCK =
  /congresso\s*(della|del)\s*(lega|pd|m5s|fdi)|candidatura\s*al\s*congresso|raccolta\s*firme\s*per\s*la\s*segreteria|scioper.*\b(teatro|spettacol|generale\s*senza\s*proposta)|vannacci\s*intervist|sondagg.*partit|exit\s*poll|primary\s*elettor/i;

export function formatBipSolutionBadge(
  chapterNum: number,
  chapterTitle: string,
  pageRef: string,
): string {
  return `SOLUZIONE UFFICIALE B.I.P. · CAP. ${chapterNum} (${chapterTitle}, p. ${pageRef})`;
}

export function matchAllBipEmergencies(blob: string): BipEmergency[] {
  const text = blob.normalize("NFC");
  if (BIP_FEED_HARD_BLOCK.test(text)) return [];
  const housing = isHousingEvictionContext(text);
  const out: BipEmergency[] = [];
  const seen = new Set<string>();
  for (const em of BIP_EMERGENCIES) {
    if (!em.keywords.test(text) || seen.has(em.id)) continue;
    // Disambiguazione: sfratti/anziani/donne → casa, mai sicurezza urbana.
    if (housing && em.id === "E01_BABY_GANG_DEGRADO") continue;
    if (housing && em.id !== "E13_EMERGENZA_ABITATIVA" && em.category === "SICUREZZA") {
      // Lascia passare MSNA/carceri solo se il testo lo richiede esplicitamente.
      if (em.id === "E04_MSNA_ERP_COMUNI" && !/msna|sbarc|\bong\b|clandestin/i.test(text)) {
        continue;
      }
      if (em.id !== "E04_MSNA_ERP_COMUNI" && em.id !== "E03_CARCERI_SOVRAFFOLLAMENTO") {
        continue;
      }
    }
    if (!housing && em.id === "E13_EMERGENZA_ABITATIVA") {
      // E13 senza contesto fragile/abitativo resta escluso (evita falsi positivi su «sgombero» criminale).
      if (!HOUSING_EVICTION_CONTEXT.test(text)) continue;
    }
    seen.add(em.id);
    out.push(em);
  }
  if (housing) {
    const e13 = BIP_EMERGENCIES.find((e) => e.id === "E13_EMERGENZA_ABITATIVA")!;
    if (!seen.has(e13.id)) {
      out.unshift(e13);
    } else {
      out.sort((a, b) =>
        a.id === "E13_EMERGENZA_ABITATIVA" ? -1 : b.id === "E13_EMERGENZA_ABITATIVA" ? 1 : 0,
      );
    }
  }
  return out;
}

export function matchBipEmergency(blob: string): BipEmergency | null {
  return matchAllBipEmergencies(blob)[0] ?? null;
}

export function bipSolutionsFromEmergencies(
  emergencies: BipEmergency[],
): import("./territoryIssuesTypes").BipSolutionSlide[] {
  return emergencies.map((em) => ({
    emergencyId: em.id,
    capRef: bipCapRefShort(em),
    measures: em.solutionHint,
  }));
}

export function bipSolutionsForText(
  titolo: string,
  snippet: string,
  fallbackCategory: TerritoryIssueCategory,
  _electoralSubTheme?: ElectoralSubTheme | null,
): import("./territoryIssuesTypes").BipSolutionSlide[] {
  return [
    subDossierToSolutionSlide(
      matchExactBipSubDossier(titolo, snippet, fallbackCategory),
    ),
  ];
}

export function isBipProgrammaticFeedItem(titolo: string, snippet: string): boolean {
  const blob = `${titolo} ${snippet}`;
  return matchBipEmergency(blob) !== null;
}

const REGIONAL_BIP_ANOMALY: Partial<
  Record<
    Region,
    Partial<Record<TerritoryIssueCategory, { titolo: string; dato: string }>>
  >
> = {
  Lombardia: {
    SICUREZZA: {
      titolo:
        "San Vittore >200%, MSNA sui Comuni e degrado stazioni: tripla emergenza lombarda",
      dato:
        "San Vittore >200% vs 138% Italia; onere MSNA comunale (Ministero Giustizia / ISTAT 2025).",
    },
    TRASPORTI: {
      titolo:
        "Blocco auto Euro 5 e caro energia PMI: filiera automotive in stallo",
      dato:
        "Fit for 55 / LEZ su oltre 4,2M veicoli Euro 4–5 (BesT mobilità 2025).",
    },
    TERRITORIO: {
      titolo:
        "Po e fotovoltaico su terreni agricoli: rischio idrico e speculazione",
      dato:
        "Bacino del Po sotto stress idrico; FV a terra in aumento su suolo agricolo (ISPRA / MASAF).",
    },
    COSTO_VITA: {
      titolo:
        "Giovani coppie escluse dal mutuo: fecondità al 1,14 figli/donna",
      dato: "ISTAT fecondità 1,14; casa media 180.000–250.000 € vs redditi giovanili 24.000–28.000 € lordi.",
    },
    SANITA: {
      titolo:
        "Cure palliative negate al 75% e truffe Over 65: gap assistenziale",
      dato:
        "Legge 38/2010 non applicata integralmente; 25.440 truffe online/anno agli Over 65 (CONSAP).",
    },
  },
};

/** Rimuove riferimenti al programma dal titolo notizia (restano in sezione Soluzione B.I.P.). */
export function stripBipFromIssueTitle(raw: string): string {
  let t = raw.trim();
  if (!t) return t;
  t = t.replace(/\s*\[\s*B\.?\s*I\.?\s*P\.[^\]]*\]\s*/gi, " ");
  t = t.replace(/\s*\(\s*B\.?\s*I\.?\s*P\.[^)]*\)\s*/gi, " ");
  t = t.replace(/\s*[—–-]\s*B\.?\s*I\.?\s*P\..*$/i, "");
  t = t.replace(/\s*[—–|]\s*RIFERIMENTO PROGRAMMA.*$/i, "");
  t = t.replace(/\s+/g, " ").trim();
  return t.replace(/\s*[—–\-|:]\s*$/g, "").trim();
}

/** Titolo card: solo anomalia / notizia (riferimento B.I.P. nella sezione dedicata). */
export function bipCardTitleForCategory(
  region: Region | "NAZIONALE",
  cat: TerritoryIssueCategory,
  newsHeadline?: string,
): string {
  if (newsHeadline?.trim()) return stripBipFromIssueTitle(newsHeadline.trim());
  if (region !== "NAZIONALE") {
    const reg = REGIONAL_BIP_ANOMALY[region]?.[cat];
    if (reg?.titolo) return stripBipFromIssueTitle(reg.titolo);
  }
  const em = defaultEmergencyForCategory(cat);
  const place = region === "NAZIONALE" ? "Italia" : region;
  return stripBipFromIssueTitle(`${em.label} · ${place}`);
}

export function bipStructuralDatoForCategory(
  region: Region | "NAZIONALE",
  cat: TerritoryIssueCategory,
): string {
  // Preferisci sempre metriche quantitative certificate (mai descrizioni vaghe).
  const certified = officialModuloBLine(region, cat);
  if (certified && /\d/.test(certified)) return certified;
  if (region !== "NAZIONALE") {
    const reg = REGIONAL_BIP_ANOMALY[region]?.[cat];
    if (reg?.dato && /\d/.test(reg.dato)) return reg.dato;
  }
  const fromMatrix = territoryBenchmarkLine(region, cat);
  if (fromMatrix && /\d/.test(fromMatrix)) return fromMatrix;
  const em = defaultEmergencyForCategory(cat);
  return `ISTAT BesT · ${region === "NAZIONALE" ? "Italia" : region}: indicatore strutturale su «${em.label}» — verificare serie ufficiale più recente.`;
}

export function bipCapRefShort(em: BipEmergency): string {
  return `Cap. ${em.primaryChapter} · p. ${em.pageRef}`;
}

export function bipEmergencyForIssue(input: {
  bipEmergencyId?: string | null;
  categoria: TerritoryIssueCategory;
  electoralSubTheme?: ElectoralSubTheme | null;
}): BipEmergency {
  if (input.bipEmergencyId) {
    const found = BIP_EMERGENCIES.find((e) => e.id === input.bipEmergencyId);
    if (found) return found;
  }
  if (input.electoralSubTheme === "immigrazione") {
    return BIP_EMERGENCIES.find((e) => e.id === "E04_MSNA_ERP_COMUNI")!;
  }
  if (input.electoralSubTheme === "energia") {
    return BIP_EMERGENCIES.find((e) => e.id === "E05_BOLLETTE_GREEN_AUTO")!;
  }
  if (input.electoralSubTheme === "fisco_pmi") {
    return BIP_EMERGENCIES.find((e) => e.id === "E07_FISCO_PMI_CREDITO")!;
  }
  return defaultEmergencyForCategory(input.categoria);
}

/** Testo sezione card: riferimento capitolo + misure (senza ripetere l’intestazione lunga). */
export function bipCardSolutionLines(input: {
  bipEmergencyId?: string | null;
  categoria: TerritoryIssueCategory;
  electoralSubTheme?: ElectoralSubTheme | null;
  bipSolutions?: import("./territoryIssuesTypes").BipSolutionSlide[] | null;
  slideIndex?: number;
}): { capRef: string; measures: string; total: number; index: number } {
  const slides =
    input.bipSolutions && input.bipSolutions.length > 0
      ? input.bipSolutions
      : bipSolutionsFromEmergencies([bipEmergencyForIssue(input)]);
  const total = slides.length;
  const index = Math.min(Math.max(0, input.slideIndex ?? 0), total - 1);
  const slide = slides[index]!;
  return { capRef: slide.capRef, measures: slide.measures, total, index };
}

export function defaultEmergencyForCategory(
  cat: TerritoryIssueCategory,
): BipEmergency {
  const map: Record<TerritoryIssueCategory, string> = {
    SANITA: "E11_SANITA_LISTE",
    TRASPORTI: "E12_TRASPORTI_DIESEL_TPL",
    LAVORO: "E07_FISCO_PMI_CREDITO",
    SICUREZZA: "E01_BABY_GANG_DEGRADO",
    COSTO_VITA: "E06_MUTUO_NATALITA",
    TERRITORIO: "E10_AGRICOLTURA_TERRITORIO",
  };
  return BIP_EMERGENCIES.find((e) => e.id === map[cat]) ?? BIP_EMERGENCIES[0]!;
}

export function bipSolutionBadgeForEmergency(em: BipEmergency): string {
  return formatBipSolutionBadge(em.primaryChapter, em.chapterTitle, em.pageRef);
}

export function bipSolutionBadgeForCategory(
  cat: TerritoryIssueCategory,
  electoralSubTheme?: ElectoralSubTheme | null,
): string {
  if (electoralSubTheme === "immigrazione") {
    const em = BIP_EMERGENCIES.find((e) => e.id === "E04_MSNA_ERP_COMUNI")!;
    return bipSolutionBadgeForEmergency(em);
  }
  if (electoralSubTheme === "energia") {
    const em = BIP_EMERGENCIES.find((e) => e.id === "E05_BOLLETTE_GREEN_AUTO")!;
    return bipSolutionBadgeForEmergency(em);
  }
  if (electoralSubTheme === "fisco_pmi") {
    const em = BIP_EMERGENCIES.find((e) => e.id === "E07_FISCO_PMI_CREDITO")!;
    return bipSolutionBadgeForEmergency(em);
  }
  return bipSolutionBadgeForEmergency(defaultEmergencyForCategory(cat));
}
