import type { Region } from "@/lib/engine/constants";
import { isHousingEvictionContext } from "@/lib/engine/territoryIssueDisambiguation";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";

export type RegionOrNational = Region | "NAZIONALE";

export type StaffBipLever = {
  badge: string;
  measure: string;
  declaration: (scope: RegionOrNational) => string;
};

const PLACE = (scope: RegionOrNational) =>
  scope === "NAZIONALE" ? "Italia" : scope;

function normalizeCopy(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Titolo capitolo sintetico + direttiva operativa senza ripetere il titolo.
 */
export function bipCardDisplayLines(
  badge: string,
  measure: string,
): { title: string; body: string } {
  const segs = badge
    .split(/\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chapter = segs[0] ?? "B.I.P.";
  const detail = segs.slice(1).join(" · ").trim();
  const shortDetail = detail
    ? detail.split(/,/)[0]!.trim().replace(/\s+e\s+/gi, " & ").slice(0, 52)
    : "";
  const title = shortDetail ? `${chapter} · ${shortDetail}` : chapter;

  let body = measure.trim();
  const nTitle = normalizeCopy(title);
  const nDetail = normalizeCopy(detail || badge);
  const nBody = normalizeCopy(body);
  if (
    !body ||
    nBody === nTitle ||
    nBody === nDetail ||
    (nDetail.length > 24 &&
      (nBody.includes(nDetail) || nDetail.includes(nBody.slice(0, 48))))
  ) {
    body = body
      ? `Direttiva: ${body.charAt(0).toLowerCase()}${body.slice(1)}`
      : "Attivare la misura B.I.P. sul territorio con monitoraggio staff.";
    if (normalizeCopy(body) === nTitle || normalizeCopy(body).includes(nDetail)) {
      body =
        "Passare dalla denuncia alla direttiva operativa: tempi, responsabili e controllo pubblico.";
    }
  }
  return { title, body };
}

const LEVER_MSNA: StaffBipLever = {
  badge: "CONFINI & COMUNI · Blocco ONG & Sgravio MSNA",
  measure:
    "Fermare gli sbarchi gestiti da ONG, accertare l'età dei falsi minori e togliere i costi MSNA dai bilanci comunali.",
  declaration: (scope) =>
    `«In ${PLACE(scope)} i Comuni non possono più pagare rette da 100 euro al giorno mentre tagliano servizi agli italiani. Futuro Nazionale: blocco ONG, accertamento età e rimpatri.»`,
};

const LEVER_SICUREZZA: StaffBipLever = {
  badge: "SICUREZZA URBANA · Protocollo Stazioni & Imputabilità",
  measure:
    "Estendere l'imputabilità a 12 anni, applicare il Daspo urbano e presidiare stazioni e punti caldi con le Forze Armate sulle emergenze pubbliche.",
  declaration: (scope) =>
    `«In ${PLACE(scope)} stazioni e periferie non possono restare terra di nessuno. Futuro Nazionale chiede imputabilità a 12 anni, Daspo urbano e presidio stabile dei punti caldi.»`,
};

const LEVER_SANITA: StaffBipLever = {
  badge: "SANITÀ · Liste d'Attesa & Medici sul Territorio",
  measure:
    "Detrazione al 100% delle spese sanitarie private oltre i tempi di legge e rafforzamento dei medici di territorio.",
  declaration: (scope) =>
    `«In ${PLACE(scope)} chi paga le tasse non può aspettare un anno per un esame. Con Futuro Nazionale: detrazione al 100% delle spese private oltre i tempi di legge e medici sul territorio.»`,
};

const LEVER_ENERGIA: StaffBipLever = {
  badge: "ENERGIA & INDUSTRIA · Stop Green Deal 2035",
  measure:
    "Tagliare subito gli oneri di sistema in bolletta, sospendere il bando motori 2035 e avviare Nucleare SMR/AMR per famiglie e fabbriche.",
  declaration: (scope) =>
    `«In ${PLACE(scope)} le bollette e le chiusure di fabbrica non sono fatalità: sono il prezzo delle follie green imposte da Bruxelles. Futuro Nazionale chiede stop al bando motori 2035, taglio immediato degli oneri in bolletta e Nucleare SMR.»`,
};

const LEVER_FISCO: StaffBipLever = {
  badge: "FISCO & PENSIONI · Stop Saldo-Acconto P.IVA",
  measure:
    "Abolire saldo e acconto per le Partite IVA, alzare il tetto al contante a 10.000 € e portare la pensione minima a 750 €.",
  declaration: (scope) =>
    `«In ${PLACE(scope)} artigiani, Partite IVA e pensionati pagano il conto di una fiscalità punitiva. Con Futuro Nazionale: stop a saldo e acconto, tetto al contante a 10.000 euro e pensione minima a 750 euro.»`,
};

const LEVER_CASA: StaffBipLever = {
  badge: "CASA & FAMIGLIA · Mutuo Tricolore & ERP",
  measure:
    "Attivare il Mutuo Tricolore Consap a tasso 0% dal terzo figlio e riservare priorità assoluta agli italiani nelle graduatorie ERP.",
  declaration: (scope) =>
    `«In ${PLACE(scope)} le giovani famiglie italiane sono escluse dalla casa. Futuro Nazionale: Mutuo Tricolore azzerato al terzo figlio e priorità ERP agli italiani.»`,
};

const LEVER_EMERGENZA_ABITATIVA: StaffBipLever = {
  badge: "CASA & FAMIGLIA · Emergenza abitativa & ERP",
  measure:
    "Priorità agli italiani e agli anziani fragili nelle assegnazioni ERP, fondo emergenza abitativa e recupero degli immobili pubblici sfitti.",
  declaration: (scope) =>
    `«In ${PLACE(scope)} anziani, donne e famiglie italiane non possono finire in strada: Futuro Nazionale chiede priorità ERP, fondo emergenza abitativa e recupero degli immobili pubblici sfitti.»`,
};

const LEVER_TRASPORTI: StaffBipLever = {
  badge: "TRASPORTI & PENDOLARI · Ferrovia Prima",
  measure:
    "Priorità agli investimenti ferroviari per i pendolari, taglio dei pedaggi punitivi e stop alle ZTL che colpiscono chi lavora.",
  declaration: (scope) =>
    `«In ${PLACE(scope)} i pendolari pagano ritardi e pedaggi mentre le ZTL puniscono chi lavora. Futuro Nazionale mette i lavoratori al centro della mobilità.»`,
};

const LEVER_TERRITORIO: StaffBipLever = {
  badge: "AGRICOLTURA & TERRITORIO · Filiera Italia",
  measure:
    "Garantire prezzo minimo sopra i costi di produzione, fermare Mercosur e tutelare i distretti agricoli e manifatturieri.",
  declaration: (scope) =>
    `«In ${PLACE(scope)} chi produce cibo e lavoro italiano viene schiacciato da importazioni sleali. Futuro Nazionale difende Filiera Italia e i distretti.»`,
};

const LEVER_LAVORO: StaffBipLever = {
  badge: "LAVORO & IMPRESE · Fisco Produttivo",
  measure:
    "Abolire saldo e acconto P.IVA, alzare il tetto al contante a 10.000 € e sgravare PMI e artigiani dalla fiscalità punitiva.",
  declaration: (scope) =>
    `«In ${PLACE(scope)} artigiani e PMI chiedono meno fisco punitivo e più produzione. Futuro Nazionale: stop saldo-acconto e tetto contante a 10.000 euro.»`,
};

/**
 * Leve B.I.P. staff-facing.
 * La categoria della card ha priorità assoluta: le keyword raffinano solo
 * dentro la stessa famiglia (mai Sanità → Sicurezza / Fisco).
 */
export function staffBipLeverForCategory(
  category: TerritoryIssueCategory,
  titleBlob = "",
): StaffBipLever {
  const blob = titleBlob.toLowerCase();

  if (isHousingEvictionContext(blob)) {
    return LEVER_EMERGENZA_ABITATIVA;
  }

  if (category === "SICUREZZA") {
    if (/sbarco|msna|\bong\b|confine|rotta\s*balcan|minori\s*stranier/.test(blob)) {
      return LEVER_MSNA;
    }
    return LEVER_SICUREZZA;
  }

  if (category === "SANITA") {
    return LEVER_SANITA;
  }

  if (category === "COSTO_VITA") {
    if (
      /bollett|energia|green\s*deal|2035|case\s*green|oneri\s*di\s*sistema/.test(blob)
    ) {
      return LEVER_ENERGIA;
    }
    if (/sfratt|sgomber|erp\b|case\s*popolar|inquilin|allogg/i.test(blob)) {
      return LEVER_EMERGENZA_ABITATIVA;
    }
    return LEVER_CASA;
  }

  if (category === "LAVORO") {
    if (
      /automotive|mirafiori|stellantis|fabbric|bollett|energia|green\s*deal|2035|cig\b|cassa\s*integraz|auto|industria|metalmeccan/.test(
        blob,
      )
    ) {
      return LEVER_ENERGIA;
    }
    if (/manovra|pension|tasse|fisco|partita\s*iva|saldo\s*e\s*acconto/.test(blob)) {
      return LEVER_FISCO;
    }
    return LEVER_LAVORO;
  }

  if (category === "TRASPORTI") {
    return LEVER_TRASPORTI;
  }

  if (category === "TERRITORIO") {
    return LEVER_TERRITORIO;
  }

  // Fallback senza categoria forte: keyword, poi fisco.
  if (/sbarco|msna|\bong\b|rotta\s*balcan/.test(blob)) return LEVER_MSNA;
  if (/baby\s*gang|stazion|spaccio|rapin|degrad|daspo/.test(blob)) return LEVER_SICUREZZA;
  if (/ospedal|liste?\s*d['']attesa|pronto\s*soccorso|agenas/.test(blob)) return LEVER_SANITA;
  if (/bollett|energia|green\s*deal|2035|case\s*green/.test(blob)) return LEVER_ENERGIA;
  if (/mutuo|affitt|famigl|casa|consap|fecondit/.test(blob)) return LEVER_CASA;
  if (/pendolar|tren|pedagg|autostrada|ztl/.test(blob)) return LEVER_TRASPORTI;
  return LEVER_FISCO;
}

/** Evita che «banche/manovra/pensioni» finiscano sulla Moneta Fiscale. */
export function shouldPreferFiscoOverMonetaFiscale(title: string, snippet = ""): boolean {
  const blob = `${title} ${snippet}`.toLowerCase();
  return /manovra|legge\s*di\s*bilancio|pension|tasse|fisco|partita\s*iva|saldo\s*e\s*acconto|acconti\s*fiscali/.test(
    blob,
  );
}
