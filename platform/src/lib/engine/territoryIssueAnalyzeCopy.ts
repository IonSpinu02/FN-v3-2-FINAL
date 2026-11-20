import type { Region } from "./constants";
import {
  matchExactBipSubDossier,
  provvedimentoFromSubDossier,
} from "./bipSubDossierMatch";
import {
  isHousingEvictionContext,
  SECURITY_EVICTION_CONTEXT,
} from "./territoryIssueDisambiguation";
import type {
  ElectoralSubTheme,
  TerritoryIssue,
  TerritoryIssueCategory,
} from "./territoryIssuesTypes";

export type AnalyzeProvvedimento = {
  enteCompetente: string;
  tempiAttuazione: string;
  attoConcreto: string;
  /** Intervento operativo locale (Prefettura/Comune/Regione), 24–72h. */
  interventoImmediato: string;
  /** Riforma strutturale B.I.P. (Parlamento/Governo). */
  riformaStrutturale: string;
};

const STAKEHOLDERS: Record<TerritoryIssueCategory, string> = {
  SANITA:
    "Direttori di PS, rappresentanze medici/infermieri, comitati pazienti e associazioni consumatori.",
  TRASPORTI:
    "Comitati pendolari, autotrasportatori, sindacati ferrovieri, commercianti dei nodi stazione.",
  LAVORO:
    "Imprenditori distretto, rappresentanze sindacali di categoria, consulenti del lavoro locali.",
  SICUREZZA:
    "Sindacati di Polizia SAP/SIULP, commercianti e residenti del quartiere, referenti Polfer e Prefettura.",
  COSTO_VITA:
    "Famiglie in difficoltà documentata, associazioni consumatori, CAF e cooperative abitative.",
  TERRITORIO:
    "Coldiretti/Confagricoltura locali, consorzi di bonifica, amministratori comunali delle aree interne.",
};

function placeLabel(issue: Pick<TerritoryIssue, "provinciaComune" | "regione">): string {
  const loc = issue.provinciaComune?.trim();
  if (loc && !/^ambito/i.test(loc) && !/^italia/i.test(loc)) {
    const first = loc.split("·")[0]?.trim();
    if (first) return first;
  }
  return issue.regione === "NAZIONALE" ? "Italia" : issue.regione;
}

function stripRedundantQuotes(s: string): string {
  let t = s.trim();
  // Rimuove involucri tipo "«...»" o «"..."»
  t = t.replace(/^["“”]+\s*«/, "«").replace(/»\s*["“”]+$/, "»");
  t = t.replace(/^["“”]+/, "").replace(/["“”]+$/, "");
  if (!t.startsWith("«") && !t.endsWith("»")) {
    t = `«${t.replace(/^«|»$/g, "").trim()}»`;
  }
  return t;
}

function issueBlob(
  issue: Pick<TerritoryIssue, "titoloProblema" | "sintesiLamentela">,
): string {
  return `${issue.titoloProblema} ${issue.sintesiLamentela}`;
}

export function categoryPillLabel(cat: TerritoryIssueCategory): string {
  const map: Record<TerritoryIssueCategory, string> = {
    SANITA: "SANITÀ",
    TRASPORTI: "TRASPORTI",
    LAVORO: "LAVORO · IMPRESE",
    SICUREZZA: "SICUREZZA",
    COSTO_VITA: "CARO-VITA",
    TERRITORIO: "AGRICOLTURA · TERRITORIO",
  };
  return map[cat];
}

export function categoryPillLabelForIssue(
  issue: Pick<TerritoryIssue, "categoria" | "titoloProblema" | "sintesiLamentela">,
): string {
  if (isHousingEvictionContext(issueBlob(issue))) {
    return "CASA & FAMIGLIA · EMERGENZA ABITATIVA";
  }
  return categoryPillLabel(issue.categoria);
}

function resolveSubDossierFromIssue(
  issue: Pick<
    TerritoryIssue,
    "titoloProblema" | "sintesiLamentela" | "categoria" | "bipEmergencyId"
  >,
) {
  const blob = issueBlob(issue);
  if (isHousingEvictionContext(blob)) {
    return matchExactBipSubDossier(issue.titoloProblema, issue.sintesiLamentela, "COSTO_VITA");
  }
  return matchExactBipSubDossier(
    issue.titoloProblema,
    issue.sintesiLamentela,
    issue.categoria,
  );
}

export function bipBadgeForIssue(
  issue: Pick<
    TerritoryIssue,
    | "categoria"
    | "electoralSubTheme"
    | "bipSolutionBadge"
    | "titoloProblema"
    | "sintesiLamentela"
  >,
): string {
  if (isHousingEvictionContext(issueBlob(issue))) {
    return resolveSubDossierFromIssue(issue).bipReference;
  }
  if (issue.bipSolutionBadge?.trim()) return issue.bipSolutionBadge.trim();
  return resolveSubDossierFromIssue(issue).bipReference;
}

export function pressDeclarationForIssue(
  issue: Pick<
    TerritoryIssue,
    | "categoria"
    | "titoloProblema"
    | "sintesiLamentela"
    | "bipSolutions"
    | "provinciaComune"
    | "regione"
  >,
  _region?: Region | "NAZIONALE",
  _electoralSubTheme?: ElectoralSubTheme | null,
): string {
  const place = placeLabel(issue);
  const blob = issueBlob(issue);
  const dossier = resolveSubDossierFromIssue(issue);

  if (isHousingEvictionContext(blob)) {
    return stripRedundantQuotes(
      `«A ${place} anziani, donne e famiglie non possono essere ributtati in strada: Futuro Nazionale chiede priorità agli italiani e agli anziani fragili nelle assegnazioni ERP, un fondo di emergenza abitativa e il recupero degli immobili pubblici sfitti.»`,
    );
  }

  const slidePress = issue.bipSolutions?.[0]?.pressDeclaration;
  const base = (slidePress?.trim() || dossier.pressDeclaration).trim();
  // Ancora la bozza al comune/regione se manca un riferimento locale.
  if (place && !base.toLowerCase().includes(place.toLowerCase().slice(0, 5))) {
    const inner = base.replace(/^«|»$/g, "").trim();
    return stripRedundantQuotes(`«A ${place}: ${inner}»`);
  }
  return stripRedundantQuotes(base);
}

/** @deprecated Preferire overload con issue completo. */
export function pressDeclarationForCategoryOnly(
  cat: TerritoryIssueCategory,
  _region: Region | "NAZIONALE",
  _electoralSubTheme?: ElectoralSubTheme | null,
  title = "",
  summary = "",
): string {
  return stripRedundantQuotes(
    matchExactBipSubDossier(title, summary, cat).pressDeclaration,
  );
}

function immediateInterventionForIssue(
  issue: Pick<
    TerritoryIssue,
    "categoria" | "titoloProblema" | "sintesiLamentela" | "provinciaComune" | "regione"
  >,
): string {
  const place = placeLabel(issue);
  const blob = issueBlob(issue);

  if (isHousingEvictionContext(blob)) {
    return `Tavolo prefettizio di salvaguardia alloggiativa a ${place}: sospensione/ricollocamento protetto, coinvolgimento Assessorato Politiche Sociali e Casa, curia/ente proprietario e comitati inquilini (24–72h).`;
  }
  if (issue.categoria === "SANITA" || /ospedal|pronto\s*soccorso|liste?\s*d['']attesa|asl/i.test(blob)) {
    return `Ispezione congiunta ASL/Direzione sanitaria sul caso a ${place} e richiesta tempi certi di presa in carico (24–72h).`;
  }
  if (
    issue.categoria === "SICUREZZA" ||
    SECURITY_EVICTION_CONTEXT.test(blob) ||
    /stazion|spaccio|baby\s*gang|degrad/i.test(blob)
  ) {
    return `Presidio interforze e sopralluogo Prefettura sul punto caldo a ${place}, con verbale operativo entro 24–72 ore.`;
  }
  if (issue.categoria === "TRASPORTI" || /tren|pendolar|ztl|pedagg/i.test(blob)) {
    return `Tavolo urgente con gestore TPL/RFI e comitato pendolari a ${place} per piano ripristino entro 72 ore.`;
  }
  if (issue.categoria === "LAVORO") {
    return `Incontro Camera di Commercio / distretto produttivo a ${place} e richiesta ammortizzatori mirati (24–72h).`;
  }
  if (issue.categoria === "TERRITORIO") {
    return `Sopralluogo con Coldiretti/Consorzio di bonifica a ${place} e richiesta intervento Regione/ARPA (24–72h).`;
  }
  return `Convocazione Prefettura/Comune di ${place} sul caso specifico entro 24–72 ore.`;
}

export function provvedimentoForIssue(
  issue: Pick<
    TerritoryIssue,
    | "categoria"
    | "titoloProblema"
    | "sintesiLamentela"
    | "bipSolutions"
    | "provinciaComune"
    | "regione"
  >,
  _electoralSubTheme?: ElectoralSubTheme | null,
): AnalyzeProvvedimento {
  const dossier = resolveSubDossierFromIssue(issue);
  const base = provvedimentoFromSubDossier(dossier);
  const slide = issue.bipSolutions?.[0];
  const housing = isHousingEvictionContext(issueBlob(issue));
  const slideMeasures = slide?.measures?.trim() ?? "";
  const riformaStrutturale = housing
    ? dossier.provvedimentoAtto
    : slideMeasures && !/imputabilit.\s*a\s*12/i.test(slideMeasures)
      ? slideMeasures
      : base.attoConcreto;
  return {
    enteCompetente: housing
      ? "Prefettura / Comune / Regione (immediato) · Parlamento / Governo (B.I.P.)"
      : base.enteCompetente,
    tempiAttuazione: housing
      ? "24–72h operativo · riforma B.I.P. 60–90 giorni"
      : base.tempiAttuazione,
    attoConcreto: riformaStrutturale,
    interventoImmediato: immediateInterventionForIssue(issue),
    riformaStrutturale,
  };
}

export function fieldStakeholdersForCategory(
  cat: TerritoryIssueCategory,
): string {
  return STAKEHOLDERS[cat];
}

/** Stakeholder coerenti col fatto (non stampino stazioni/Polfer su sfratti). */
export function fieldStakeholdersForIssue(
  issue: Pick<
    TerritoryIssue,
    "categoria" | "titoloProblema" | "sintesiLamentela"
  >,
): string {
  const blob = issueBlob(issue);
  if (isHousingEvictionContext(blob)) {
    return "Residenti/anziani coinvolti, comitati inquilini, curia/ente proprietario, Assessorato Politiche Sociali e Casa, Prefettura.";
  }
  if (/stazion|polfer|pendolar/i.test(blob) && issue.categoria === "SICUREZZA") {
    return STAKEHOLDERS.SICUREZZA;
  }
  if (issue.categoria === "SICUREZZA" && !/stazion/i.test(blob)) {
    return "Sindacati di Polizia SAP/SIULP, residenti e commercianti del quartiere, Prefettura.";
  }
  return STAKEHOLDERS[issue.categoria];
}

/** Luogo di intervento ancorato al fatto reale (niente stazione FS se la notizia non ne parla). */
export function fieldActionWhereForIssue(
  issue: Pick<
    TerritoryIssue,
    | "categoria"
    | "titoloProblema"
    | "sintesiLamentela"
    | "provinciaComune"
    | "regione"
    | "azionePoliticaConsigliata"
  >,
): string {
  const place = placeLabel(issue);
  const blob = issueBlob(issue);
  if (isHousingEvictionContext(blob)) {
    return `Presidio presso lo stabile interessato a ${place} / Assessorato Politiche Sociali e Casa — Incontrare i residenti/anziani coinvolti, comitati inquilini, curia/ente proprietario e Prefettura per tavolo sospensione/ricollocamento.`;
  }
  if (/stazion/i.test(blob)) {
    return `${place} · stazione FS e area limitrofa segnalata — punto stampa con Polfer e comitati pendolari.`;
  }
  if (issue.categoria === "SANITA" || /ospedal|pronto\s*soccorso|asl/i.test(blob)) {
    return `Sopralluogo ingresso PS / direzione sanitaria a ${place}.`;
  }
  if (issue.categoria === "LAVORO") {
    return `Distretto produttivo / Camera di Commercio a ${place}.`;
  }
  if (issue.categoria === "TERRITORIO") {
    return `${place} · area agricola / bacino idrico segnalato.`;
  }
  if (issue.categoria === "TRASPORTI") {
    return `Nodo TPL / comitato pendolari a ${place}.`;
  }
  if (issue.categoria === "SICUREZZA") {
    return `${place} · quartiere / punto caldo segnalato dalla cronaca (no template stazione se assente dal fatto).`;
  }
  const fallback = issue.azionePoliticaConsigliata?.doveAndare?.trim();
  if (fallback && !/stazione FS/i.test(fallback)) return fallback;
  return `${place} · punto stampa sul fatto segnalato.`;
}

export function sourceLabelFromUrl(url: string): string {
  if (!url) return "Fonte certificata";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("ansa.it")) return "ANSA";
    if (host.includes("repubblica")) return "la Repubblica";
    if (host.includes("corriere")) return "Corriere";
    if (host.includes("ilsole24ore")) return "Il Sole 24 Ore";
    return host.split(".")[0]?.toUpperCase() ?? "Web";
  } catch {
    return "Web";
  }
}

export function formatIssuePubDateIt(iso: string | null | undefined): string {
  if (!iso) return "data n.d.";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "data n.d.";
  return d.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
