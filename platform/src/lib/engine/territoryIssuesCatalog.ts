import type { Region } from "./constants";
import { REGIONS } from "./constants";
import { REGION_REFERENCE_STRESS } from "./fabbisogniCatalogFallback";
import {
  bipCardTitleForCategory,
  stripBipFromIssueTitle,
  bipStructuralDatoForCategory,
  defaultEmergencyForCategory,
} from "./bipProblemRadar";
import { applySubDossierToIssueFields } from "./bipSubDossierMatch";
import {
  officialModuloBLine,
  politicalActionForCategory,
  REGION_TRANSPORT_HUB,
} from "./territoryIssueContext";
import type {
  TerritoryIssue,
  TerritoryIssueCategory,
} from "./territoryIssuesTypes";
import { REGIONAL_ELECTORAL_CATS } from "./territoryIssuesTypes";

const CAP: Record<Region, string> = {
  Piemonte: "Torino",
  "Valle d'Aosta": "Aosta",
  Liguria: "Genova",
  Lombardia: "Milano",
  "Trentino-Alto Adige": "Trento",
  Veneto: "Padova",
  "Friuli-Venezia Giulia": "Trieste",
  "Emilia-Romagna": "Bologna",
  Toscana: "Firenze",
  Umbria: "Perugia",
  Marche: "Ancona",
  Lazio: "Roma",
  Abruzzo: "Pescara",
  Molise: "Campobasso",
  Campania: "Napoli",
  Puglia: "Bari",
  Basilicata: "Potenza",
  Calabria: "Reggio Calabria",
  Sicilia: "Palermo",
  Sardegna: "Cagliari",
};

const REGIONAL_CATS: TerritoryIssueCategory[] = [
  "SANITA",
  "TRASPORTI",
  "LAVORO",
  "SICUREZZA",
  "COSTO_VITA",
];

/** @deprecated Usare REGIONAL_ELECTORAL_CATS — mantenuto per test legacy. */
export const STRUCTURAL_PILLAR_CATS: TerritoryIssueCategory[] = [
  "SANITA",
  "TRASPORTI",
  "LAVORO",
  "SICUREZZA",
];

const VIEW_BY_CAT: Record<TerritoryIssueCategory, string> = {
  SANITA: "145.000+ visualizzazioni",
  TRASPORTI: "92.000+ interazioni",
  LAVORO: "68.000+ visualizzazioni",
  SICUREZZA: "120.000+ letture e condivisioni",
  COSTO_VITA: "210.000+ letture e condivisioni",
  TERRITORIO: "84.000+ visualizzazioni",
};

const NATIONAL_ISSUES: {
  cat: TerritoryIssueCategory;
  area: string;
  titolo: string;
  sintesi: string;
  views: string;
  score: number;
}[] = [
  {
    cat: "SANITA",
    area: "Campania · Area Nord / Cardarelli",
    titolo: "Liste d'attesa e PS saturi: sanità al collasso nel Sud",
    sintesi:
      "Petizioni e video denuncia su code notturne al pronto soccorso e rinuncia alle visite specialistiche.",
    views: "215.000+ visualizzazioni",
    score: 94,
  },
  {
    cat: "TRASPORTI",
    area: "Sicilia · Autotrasportatori e tratte autostradali",
    titolo: "Caro gasolio e blocchi autotrasporto: proteste lungo le dorsali",
    sintesi:
      "Comitati autotrasportatori e pendolari denunciano rincari e disservizi sulle tratte meridionali.",
    views: "180.000+ interazioni",
    score: 91,
  },
  {
    cat: "LAVORO",
    area: "Piemonte · Mirafiori / distretto automotive",
    titolo: "Crisi industriale e cassa integrazione: lavoratori in allarme",
    sintesi:
      "Assemblee sindacali e live social su tagli produzione e incertezza stipendi.",
    views: "142.000+ visualizzazioni",
    score: 86,
  },
  {
    cat: "SICUREZZA",
    area: "Lazio · Stazione Termini / periferie RM",
    titolo: "Degrado urbano e microcriminalità nelle stazioni",
    sintesi:
      "Video virali su aggressioni e spaccio nelle stazioni ferroviarie e nei quartieri periferici.",
    views: "118.000+ letture e condivisioni",
    score: 83,
  },
  {
    cat: "COSTO_VITA",
    area: "Lombardia · Mercati rionali Milano hinterland",
    titolo: "Caro-vita, affitti e mutui: famiglie al limite",
    sintesi:
      "Thread social su carrello spesa e affitti che assorbono oltre il 40% del reddito.",
    views: "96.000+ condivisioni",
    score: 80,
  },
  {
    cat: "TERRITORIO",
    area: "Emilia-Romagna · Reti idriche e campagna",
    titolo: "Siccità, reti idriche e costo carburante agricolo",
    sintesi:
      "Agricoltori denunciano rubinetti a secco e margini azzerati dal costo gasolio.",
    views: "84.000+ visualizzazioni",
    score: 77,
  },
];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function regionalTitle(cat: TerritoryIssueCategory, region: Region): string {
  return bipCardTitleForCategory(region, cat);
}

function regionalZona(cat: TerritoryIssueCategory, region: Region): string {
  const c = CAP[region];
  switch (cat) {
    case "SANITA":
      return `${c} · Ospedale hub regionale`;
    case "TRASPORTI":
      return REGION_TRANSPORT_HUB[region];
    case "LAVORO":
      return `${c} · Distretto produttivo`;
    case "SICUREZZA":
      return `${c} · Quartiere periferico / stazione FS`;
    case "COSTO_VITA":
      return `${c} · Mercato rionale / centro residenziale`;
    default:
      return `${region} · Area interna / bacino idrico`;
  }
}

function buildIssue(
  region: Region | "NAZIONALE",
  cat: TerritoryIssueCategory,
  partial: Partial<TerritoryIssue> & Pick<TerritoryIssue, "id" | "titoloProblema" | "sintesiLamentela" | "impattoScore">,
): TerritoryIssue {
  const headline = stripBipFromIssueTitle(partial.titoloProblema);
  const subFields = applySubDossierToIssueFields(
    headline,
    partial.sintesiLamentela,
    cat,
  );
  const action = {
    ...politicalActionForCategory(region, cat),
    cosaDire: subFields.cosaDire,
  };
  return {
    id: partial.id,
    regione: region,
    provinciaComune: partial.provinciaComune ?? regionalZona(cat, region as Region),
    categoria: cat,
    titoloProblema: headline,
    sintesiLamentela: partial.sintesiLamentela,
    canaleVirale:
      partial.canaleVirale ??
      "Cronaca locale · TikTok/Reels & gruppi Facebook territoriali",
    visualizzazioniStimate:
      partial.visualizzazioniStimate ?? VIEW_BY_CAT[cat],
    impattoScore: partial.impattoScore,
    datoUfficialeModuloB:
      partial.datoUfficialeModuloB ?? bipStructuralDatoForCategory(region, cat),
    azionePoliticaConsigliata: action,
    sourceUrl:
      partial.sourceUrl ??
      `https://news.google.com/search?q=${encodeURIComponent(`${region} ${cat}`)}&hl=it&gl=IT&ceid=IT:it`,
    pubDate: partial.pubDate ?? null,
    live: partial.live ?? false,
    contentSource: partial.contentSource ?? "catalog",
    verification: partial.verification ?? "fallback",
    electoralSubTheme:
      partial.electoralSubTheme ??
      defaultEmergencyForCategory(cat).electoralSubTheme ??
      null,
    evidence: partial.evidence,
    bipEmergencyId: partial.bipEmergencyId ?? subFields.bipEmergencyId,
    bipSolutionBadge: partial.bipSolutionBadge ?? subFields.bipSolutionBadge,
    bipSolutions: partial.bipSolutions ?? subFields.bipSolutions,
  };
}

function regionalSintesi(cat: TerritoryIssueCategory, region: Region): string {
  const em = defaultEmergencyForCategory(cat);
  return `${em.label}: anomalia strutturale in ${region} — ${em.solutionHint}`;
}

/** Sei macro-temi elettorali certificati per regione (pool completo radar). */
export function electoralThemesForRegion(region: Region): TerritoryIssue[] {
  const stress = REGION_REFERENCE_STRESS[region];
  return REGIONAL_ELECTORAL_CATS.map((cat, idx) =>
    buildIssue(region, cat, {
      id: `${slug(region)}-elettorale-${cat.toLowerCase()}`,
      provinciaComune: regionalZona(cat, region),
      titoloProblema: regionalTitle(cat, region),
      sintesiLamentela: regionalSintesi(cat, region),
      impattoScore: Math.min(96, 90 - idx + (stress % 6)),
      live: false,
      contentSource: "catalog",
      verification: "fallback",
    }),
  );
}

export function structuralPillarIssuesForRegion(region: Region): TerritoryIssue[] {
  const stress = REGION_REFERENCE_STRESS[region];
  return STRUCTURAL_PILLAR_CATS.map((cat, idx) =>
    buildIssue(region, cat, {
      id: `${slug(region)}-pillar-${cat.toLowerCase()}`,
      provinciaComune: regionalZona(cat, region),
      titoloProblema: regionalTitle(cat, region),
      sintesiLamentela: `Emergenza strutturale certificata su ${cat === "LAVORO" ? "lavoro e imprese" : cat === "SICUREZZA" ? "sicurezza urbana e stazioni" : cat.toLowerCase().replace("_", " ")} — segnalazioni ricorrenti da cittadini, sindacati e stampa locale.`,
      impattoScore: Math.min(96, 92 - idx * 2 + (stress % 5)),
      live: false,
    }),
  );
}

export function catalogIssuesForRegion(
  region: Region | "NAZIONALE",
): TerritoryIssue[] {
  if (region === "NAZIONALE") {
    return NATIONAL_ISSUES.map((n, i) =>
      buildIssue("NAZIONALE", n.cat, {
        id: `naz-${n.cat.toLowerCase()}-${i}`,
        provinciaComune: n.area,
        titoloProblema: n.titolo,
        sintesiLamentela: n.sintesi,
        visualizzazioniStimate: n.views,
        impattoScore: n.score,
      }),
    );
  }

  const stress = REGION_REFERENCE_STRESS[region];
  return REGIONAL_ELECTORAL_CATS.map((cat, idx) =>
    buildIssue(region, cat, {
      id: `${slug(region)}-${cat.toLowerCase()}`,
      provinciaComune: regionalZona(cat, region),
      titoloProblema: regionalTitle(cat, region),
      sintesiLamentela: regionalSintesi(cat, region),
      impattoScore: Math.min(96, 88 + (stress % 7) - idx * 2),
    }),
  );
}

export function allCatalogRegions(): Region[] {
  return [...REGIONS];
}
