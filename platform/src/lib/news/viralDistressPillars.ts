import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";

/** 7 filoni di disagio sociale — bacini elettorali per stitch Vannacci. */
export type DistressPillarId =
  | "DISABILITA"
  | "TASSE_PIVA"
  | "SANITA"
  | "CARO_VITA"
  | "SICUREZZA"
  | "LAVORO"
  | "GREEN_ZTL";

export type DistressPillar = {
  id: DistressPillarId;
  label: string;
  category: TerritoryIssueCategory;
  queryTerms: string;
  bipHook: string;
  bipCapRef: string;
};

export const DISTRESS_PILLARS: DistressPillar[] = [
  {
    id: "DISABILITA",
    label: "DISABILITÀ & WELFARE",
    category: "SANITA",
    queryTerms:
      "caregiver OR disabile OR autismo OR invalidità OR \"legge 104\" OR \"barriera architettonica\" OR \"pensione invalidità\" OR \"non autosufficiente\" OR INPS invalidi",
    bipHook:
      "Fondo Priorità Disabili e Caregiver Italiani: prima i fondi per chi assiste un figlio o un genitore fragile, prima di ogni spesa per MSNA e ONG.",
    bipCapRef: "B.I.P. Cap. 13 · Sanità, Welfare & Tutela Disabilità/Caregiver",
  },
  {
    id: "TASSE_PIVA",
    label: "TASSE & P.IVA",
    category: "LAVORO",
    queryTerms:
      "F24 OR \"partita IVA\" OR artigiano OR commerciante OR \"cartella esattoriale\" OR acconti OR \"chiudo il negozio\" OR \"pressione fiscale\"",
    bipHook:
      "Stop Saldo-Acconto: basta anticipare tasse non ancora maturate. Chi produce non deve finanziare lo Stato in anticipo per restare aperto.",
    bipCapRef: "B.I.P. Cap. 1–2 · Fisco, P.IVA & Imprese · Stop Saldo-Acconto",
  },
  {
    id: "SANITA",
    label: "SANITÀ",
    category: "SANITA",
    queryTerms:
      "\"pronto soccorso\" OR \"liste d'attesa\" OR CUP OR oncologic OR \"visita privata\" OR \"manca il medico\" OR ospedale collasso",
    bipHook:
      "Detrazione 100% della sanità privata oltre i tempi di legge del CUP: se lo Stato non visita in tempo, non deve far pagare due volte la famiglia.",
    bipCapRef: "B.I.P. Cap. 11 · Liste d'attesa & CUP",
  },
  {
    id: "CARO_VITA",
    label: "CARO-VITA",
    category: "COSTO_VITA",
    queryTerms:
      "mutuo OR affitto OR \"caro vita\" OR bollette OR \"carrello della spesa\" OR \"stipendio fermo\" OR \"non arrivo a fine mese\"",
    bipHook:
      "Mutuo Tricolore e tetto agli oneri: casa e bollette non possono restare una condanna per chi lavora.",
    bipCapRef: "B.I.P. Cap. 13 · Mutuo Tricolore",
  },
  {
    id: "SICUREZZA",
    label: "SICUREZZA",
    category: "SICUREZZA",
    queryTerms:
      "stazione OR borseggio OR \"baby gang\" OR spaccio OR \"casa occupata\" OR aggressione treno OR degrado OR \"sotto casa\"",
    bipHook:
      "DASPO urbano, tutela vera delle divise e sgombero delle case occupate: la legalità torna prima di ogni scusa ideologica.",
    bipCapRef: "B.I.P. Cap. 7–8 · Sicurezza & stazioni",
  },
  {
    id: "LAVORO",
    label: "LAVORO & FABBRICHE",
    category: "LAVORO",
    queryTerms:
      "\"cassa integrazione\" OR automotive OR agricoltori OR allevatori OR gasolio OR manifattura OR \"chiudono la fabbrica\" OR trasportatori",
    bipHook:
      "Priorità a chi produce: difesa della filiera industriale e agricola, no a regole che strozzano operai, agricoltori e trasportatori.",
    bipCapRef: "B.I.P. Cap. 9–10 · Lavoro & agricoltura",
  },
  {
    id: "GREEN_ZTL",
    label: "ZTL & AUTOVELOX",
    category: "TERRITORIO",
    queryTerms:
      "ZTL OR autovelox OR \"Euro 4\" OR \"Euro 5\" OR \"Case Green\" OR multa diesel OR \"area B\" OR \"area C\"",
    bipHook:
      "Basta ZTL e autovelox usati come bancomat: chi va a lavorare con un diesel Euro 4 non è un criminale climatico.",
    bipCapRef: "B.I.P. · Stop follie green punitive",
  },
];

export function inferDistressPillar(blob: string): DistressPillar {
  const t = blob.toLowerCase();
  const scored = DISTRESS_PILLARS.map((p) => {
    let score = 0;
    if (/disabil|caregiver|autism|invalid|barriere|non autosufficient/.test(t)) {
      if (p.id === "DISABILITA") score += 5;
    }
    if (/f24|partita\s*iva|artigian|commerciant|cartella|esattorial|accont/.test(t)) {
      if (p.id === "TASSE_PIVA") score += 5;
    }
    if (/pronto\s*soccorso|lista.?attesa|cup|ospedale|oncolog|visita/.test(t)) {
      if (p.id === "SANITA") score += 5;
    }
    if (/mutuo|affitto|caro.?vita|bollett|carrello|stipendio|fine\s*mese/.test(t)) {
      if (p.id === "CARO_VITA") score += 4;
    }
    if (/stazione|borsegg|baby\s*gang|spaccio|occupat|aggressione|degrado/.test(t)) {
      if (p.id === "SICUREZZA") score += 5;
    }
    if (/cassa\s*integrazione|automotive|agricol|allevator|gasolio|fabbric|manifattur/.test(t)) {
      if (p.id === "LAVORO") score += 5;
    }
    if (/ztl|autovelox|euro\s*[45]|case\s*green|diesel|area\s*[bc]/.test(t)) {
      if (p.id === "GREEN_ZTL") score += 5;
    }
    return { p, score };
  }).sort((a, b) => b.score - a.score);

  return scored[0]!.score > 0 ? scored[0]!.p : DISTRESS_PILLARS[4]!; // default sicurezza
}

/** Escludi auto-promo partito / comunicati FN. */
export function isPartySelfReferential(blob: string): boolean {
  const t = blob.toLowerCase();
  if (/futuro\s*nazionale\s+on\s+instagram/.test(t)) return true;
  if (/@futuronazionale\b|@futuro_nazionale\b|\/futuronazionale\b/.test(t)) return true;
  if (
    /\bfuturo\s*nazionale\b/.test(t) &&
    /(comunicato|diretta|congresso|candidato|programma elettorale|iscriviti al partito|tesseramento)/i.test(
      t,
    )
  ) {
    return true;
  }
  // Solo propaganda senza disagio cittadino
  if (
    /\bfuturo\s*nazionale\b/.test(t) &&
    !/(disabil|caregiver|f24|ospedale|lista|mutuo|stazione|cassa integrazione|ztl|artigian|pendolar)/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}
