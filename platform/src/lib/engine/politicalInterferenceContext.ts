import type { Region } from "@/lib/engine/constants";
import { REGION_FABBISOGNO_DISPLAY, REGION_REFERENCE_STRESS } from "@/lib/engine/fabbisogniCatalogFallback";
import { catalogIssuesForRegion } from "@/lib/engine/territoryIssuesCatalog";
import { categoryStressForRegion, rankedCategoriesByStress } from "@/lib/engine/territoryIssueStress";
import { categoryLabel, type TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";

export type SocialPainSignal = {
  region: Region;
  category: TerritoryIssueCategory;
  label: string;
  stress: number;
  indicatorLine: string;
  localHeadline: string;
  epistemic: "STIMA MODELLO";
};

export type PressThemeSignal = {
  title: string;
  category: string;
  area: string;
  epistemic: "IPOTESI";
};

export type PoliticalInterferenceContext = {
  regionalDiscontent: SocialPainSignal[];
  competitorDynamics: {
    governmentArena: string;
    oppositionArena: string;
    pressHotThemes: PressThemeSignal[];
  };
  eventsAndCalendar: string[];
  internationalAndEu: string[];
  /** Blocco compatto da iniettare nei prompt AI. */
  summaryForPrompt: string;
};

const EXPORT_REGIONS = new Set<Region>([
  "Lombardia",
  "Veneto",
  "Emilia-Romagna",
  "Piemonte",
  "Friuli-Venezia Giulia",
  "Toscana",
  "Marche",
]);

const AUTO_REGIONS = new Set<Region>(["Piemonte", "Lombardia", "Emilia-Romagna", "Campania", "Basilicata"]);

function waitingDays(region: Region): number {
  const stress = REGION_REFERENCE_STRESS[region];
  return Math.round(36 + (stress - 50) * 0.22);
}

function housingOverload(region: Region): string {
  const stress = REGION_REFERENCE_STRESS[region];
  const value = 10.4 + (stress - 50) * 0.13;
  return value.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function indicatorLineFor(region: Region, category: TerritoryIssueCategory): string {
  const display = REGION_FABBISOGNO_DISPLAY[region];
  if (category === "SANITA") {
    return `Liste d'attesa specialistica ~${waitingDays(region)} giorni (AGENAS/BesT · STIMA MODELLO) · ${display[0]}`;
  }
  if (category === "COSTO_VITA") {
    return `Sovraccarico costo abitazione ~${housingOverload(region)}% (BesT · STIMA MODELLO) · pressione mutui/affitti`;
  }
  if (category === "LAVORO") {
    return `${display[1]} · stress territoriale ${categoryStressForRegion(region, "LAVORO")}/100 (STIMA MODELLO)`;
  }
  if (category === "SICUREZZA") {
    return `Pressione sicurezza urbana/nodi di transito · stress ${categoryStressForRegion(region, "SICUREZZA")}/100 (STIMA MODELLO)`;
  }
  if (category === "TRASPORTI") {
    return `Qualità TPL/pendolarismo sotto pressione · stress ${categoryStressForRegion(region, "TRASPORTI")}/100 (STIMA MODELLO)`;
  }
  return `Aree interne/spopolamento · stress ${categoryStressForRegion(region, "TERRITORIO")}/100 (STIMA MODELLO)`;
}

function painForRegion(region: Region): SocialPainSignal[] {
  const ranked = rankedCategoriesByStress(region).slice(0, 3);
  const issues = catalogIssuesForRegion(region).slice(0, 6);
  return ranked.map((category) => {
    const match = issues.find((issue) => issue.categoria === category);
    return {
      region,
      category,
      label: categoryLabel(category),
      stress: categoryStressForRegion(region, category),
      indicatorLine: indicatorLineFor(region, category),
      localHeadline: match?.titoloProblema ?? `${categoryLabel(category)} in ${region}`,
      epistemic: "STIMA MODELLO" as const,
    };
  });
}

function pressThemesFor(regions: Region[]): PressThemeSignal[] {
  const themes: PressThemeSignal[] = [];
  for (const region of regions.slice(0, 8)) {
    for (const issue of catalogIssuesForRegion(region).slice(0, 2)) {
      themes.push({
        title: issue.titoloProblema,
        category: categoryLabel(issue.categoria),
        area: `${issue.regione} · ${issue.provinciaComune}`,
        epistemic: "IPOTESI",
      });
      if (themes.length >= 8) return themes;
    }
  }
  return themes;
}

function eventsFor(regions: Region[], themes: string[], horizonDays: number): string[] {
  const hasAuto = regions.some((region) => AUTO_REGIONS.has(region));
  const hasExport = regions.some((region) => EXPORT_REGIONS.has(region));
  const hasSouth = regions.some((region) =>
    ["Campania", "Puglia", "Calabria", "Sicilia", "Sardegna", "Basilicata", "Molise", "Abruzzo"].includes(region),
  );
  const out: string[] = [
    `Finestra di ${horizonDays} giorni: tenere il calendario di finanza pubblica e legge di bilancio come cassa di risonanza sui temi ${themes.slice(0, 2).join(" e ") || "prioritari"} (IPOTESI).`,
    "Tornate amministrative e rinnovi comunali: finestra utile per innestare amministratori civici senza apparire come scissionisti del centrodestra (IPOTESI).",
  ];
  if (hasAuto) {
    out.push(
      "Vertenze automotive/metalmeccanica e indotto componentistica: rischio di piazze egemonizzate da sindacati e opposizioni se FN non apre tavoli di ascolto prima delle assemblee (IPOTESI).",
    );
  }
  if (hasExport) {
    out.push(
      "Proteste categorie agricole e artigiane su costi e vincoli ambientali: presidiare i distretti senza farsi confondere con proteste generiche anti-sistema (IPOTESI).",
    );
  }
  if (hasSouth) {
    out.push(
      "Scioperi sanità/trasporti e mobilitazioni sul caro vita al Sud: opportunità di conversione dell'astensione se la presenza è fisica e non solo mediatica (IPOTESI).",
    );
  }
  return out;
}

function internationalFor(regions: Region[]): string[] {
  const hasExport = regions.some((region) => EXPORT_REGIONS.has(region));
  const hasAuto = regions.some((region) => AUTO_REGIONS.has(region));
  const out: string[] = [
    "Crisi energetiche e prezzo dell'energia per famiglie e PMI: tradurre ogni shock esterno in proposta nazionale concreta su bollette e continuità produttiva (IPOTESI).",
    "Flussi migratori e sicurezza dei confini: tenere il nesso tra pressione sui territori e ordine pubblico urbano, evitando la sola retorica nazionale (IPOTESI).",
  ];
  if (hasExport) {
    out.push(
      "Dazi commerciali e mercati di sbocco: impatto diretto sull'export manifatturiero di Lombardia, Veneto, Emilia-Romagna e distretti collegati (IPOTESI).",
    );
    out.push(
      "Vincoli Bruxelles (EPBD Case Green, ETS, costi di adeguamento): rischio di alienare proprietari e PMI se il messaggio resta solo ideologico e non offre scudi pratici (IPOTESI).",
    );
  }
  if (hasAuto) {
    out.push(
      "Stop endotermico e direttive Green Deal sull'auto: minaccia esistenziale per Mirafiori e l'indotto; va trasformata in agenda di salvaguardia industriale e occupazionale (IPOTESI).",
    );
  }
  out.push("Equilibri difesa/NATO e instabilità internazionale: usati dagli avversari per dipingere ogni posizione nazionale come 'voto inutile' o destabilizzante (IPOTESI).");
  return out;
}

/**
 * Snapshot puro delle pressioni sul consenso: Osservatorio (stress/indicatori),
 * temi catalogo/rassegna territoriale, competitor, eventi e vettori UE/internazionali.
 */
export function buildPoliticalInterferenceContext(input: {
  regions: readonly Region[];
  themes?: readonly string[];
  horizonDays: number;
}): PoliticalInterferenceContext {
  const regions = [...new Set(input.regions)];
  const themes = [...(input.themes ?? [])];
  const regionalDiscontent = regions.flatMap((region) => painForRegion(region)).sort((a, b) => b.stress - a.stress);
  const pressHotThemes = pressThemesFor(regions);
  const governmentArena =
    "Nell'area di governo/centrodestra: difesa delle roccaforti produttive del Nord, argine al richiamo del 'voto utile' verso i partiti maggioritari, contesa su amministratori civici e comunali senza apparire come fattore di disgregazione (IPOTESI).";
  const oppositionArena =
    "Opposizione e corpi intermedi: tentativo di egemonizzare le piazze su sanità/salari e di delegittimare mediaticamente ogni avanzata di FN come estremismo o voto dispersivo (IPOTESI).";
  const eventsAndCalendar = eventsFor(regions, themes, input.horizonDays);
  const internationalAndEu = internationalFor(regions);

  const topPains = regionalDiscontent.slice(0, 10).map(
    (row) =>
      `${row.region} · ${row.label} · stress ${row.stress}/100 · ${row.indicatorLine} · segnale: ${row.localHeadline}`,
  );
  const press = pressHotThemes
    .slice(0, 6)
    .map((row) => `${row.area}: ${row.title} [${row.category}]`);

  const summaryForPrompt = [
    "=== CONTESTO DI INTERFERENZA POLITICA (IPOTESI + STIMA MODELLO) ===",
    "DISAGIO SOCIALE REGIONALE:",
    ...topPains,
    "",
    "DINAMICHE PARTITICHE:",
    governmentArena,
    oppositionArena,
    "Temi caldi da rassegna/catalogo territoriale:",
    ...press,
    "",
    "EVENTI / PIAZZE / SCADENZE:",
    ...eventsAndCalendar,
    "",
    "INTERNAZIONALE / UE:",
    ...internationalAndEu,
  ].join("\n");

  return {
    regionalDiscontent,
    competitorDynamics: {
      governmentArena,
      oppositionArena,
      pressHotThemes,
    },
    eventsAndCalendar,
    internationalAndEu,
    summaryForPrompt,
  };
}

/** Seleziona i segnali di disagio più acuti per un sottoinsieme di regioni di tappa. */
export function painsForStageRegions(
  context: PoliticalInterferenceContext,
  regions: readonly Region[],
  limit = 3,
): SocialPainSignal[] {
  const set = new Set(regions);
  return context.regionalDiscontent.filter((row) => set.has(row.region)).slice(0, limit);
}
