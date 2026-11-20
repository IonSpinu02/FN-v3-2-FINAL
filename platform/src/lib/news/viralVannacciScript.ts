import type { CommentSentiment } from "./viralVideoTypes";
import type { DistressPillar } from "./viralDistressPillars";
import { cleanSocialText } from "./viralTextSanitize";

export type VannacciStitchActs = {
  hook: string;
  dato: string;
  soluzione: string;
  full: string;
  socialCaption: string;
};

/**
 * Script stitch 20s: caso umano del video → ragione alla rabbia → leva B.I.P.
 */
export function buildVannacciStitchScript(input: {
  locality: string;
  title: string;
  pillar: DistressPillar;
  topUserComment: string;
  commentSentiment: CommentSentiment;
}): string {
  return buildVannacciStitchActs(input).full;
}

export function buildVannacciStitchActs(input: {
  locality: string;
  title: string;
  pillar: DistressPillar;
  topUserComment: string;
  commentSentiment: CommentSentiment;
}): VannacciStitchActs {
  const place = input.locality.split("·")[0]?.trim() || input.locality;
  const hook = caseFromTitle(cleanSocialText(input.title), input.pillar, place);
  const dato = rageAckFromComment(
    cleanSocialText(input.topUserComment),
    input.commentSentiment,
    place,
    input.pillar,
  );
  const bip = cleanFullSentence(input.pillar.bipHook);
  const close =
    "Io sono Roberto Vannacci: con Futuro Nazionale questa rabbia diventa un atto di legge, non uno slogan. Chi vuole fatti sa dove trovarci.";
  const soluzione = `${bip} ${close}`.replace(/\s+/g, " ").trim();
  const full = `${hook} ${dato} ${soluzione}`.replace(/\s+/g, " ").trim();
  const socialCaption = [
    full,
    "",
    `#FuturoNazionale #Vannacci #ItaliaPrima ${hashtagsForPillar(input.pillar)}`,
  ].join("\n");

  return { hook, dato, soluzione, full, socialCaption };
}

function hashtagsForPillar(pillar: DistressPillar): string {
  switch (pillar.id) {
    case "DISABILITA":
      return "#Disabilità #Caregiver #Legge104";
    case "TASSE_PIVA":
      return "#PartiteIVA #StopSaldoAcconto #Artigiani";
    case "SANITA":
      return "#Sanità #ListeAttesa #CUP";
    case "CARO_VITA":
      return "#CaroVita #MutuoTricolore #Famiglie";
    case "SICUREZZA":
      return "#Sicurezza #Stazioni #Legalità";
    case "LAVORO":
      return "#Lavoro #Fabbriche #FilieraItalia";
    case "GREEN_ZTL":
      return "#ZTL #Autovelox #Lavoratori";
    default:
      return "#Italia";
  }
}

function caseFromTitle(title: string, pillar: DistressPillar, place: string): string {
  const t = title.toLowerCase();
  if (pillar.id === "DISABILITA" || /disabil|caregiver|autism|invalid|104/.test(t)) {
    return `In questo video una famiglia di ${place} denuncia tagli e burocrazia su disabilità e caregiver: non è un dettaglio, è lo Stato che abbandona chi è già in difficoltà.`;
  }
  if (pillar.id === "TASSE_PIVA" || /f24|partita\s*iva|artigian|commerciant/.test(t)) {
    return `Questo artigiano o commerciante di ${place} mostra F24, tasse e bollette che strozzano chi tiene aperta l'attività: è la voce di chi produce e non arriva a fine mese.`;
  }
  if (pillar.id === "SANITA" || /ospedale|lista|cup|pronto\s*soccorso/.test(t)) {
    return `Questo video da ${place} racconta liste d'attesa e pronto soccorso al collasso: famiglie costrette ad aspettare mesi o a pagare il privato.`;
  }
  if (pillar.id === "CARO_VITA" || /mutuo|affitto|bollett|caro/.test(t)) {
    return `Famiglie e lavoratori di ${place} schiacciati da mutuo, affitti e carrello della spesa: lo vedete in questo video, non in un comunicato.`;
  }
  if (pillar.id === "SICUREZZA" || /stazione|degrado|spaccio|baby\s*gang|occupat/.test(t)) {
    return `Pendolari, donne e commercianti di ${place} denunciano stazioni, spaccio e illegalità sotto casa: è la quotidianità, non un caso isolato.`;
  }
  if (pillar.id === "LAVORO" || /cassa|fabbric|agricol|gasolio/.test(t)) {
    return `Operai, agricoltori o trasportatori di ${place} raccontano cassa integrazione, prezzi e regole che uccidono il lavoro: questa è l'Italia produttiva che chiede ascolto.`;
  }
  if (pillar.id === "GREEN_ZTL" || /ztl|autovelox|euro|diesel/.test(t)) {
    return `Lavoratori di ${place} bloccati da ZTL, autovelox e divieti sul diesel: multe da bancomat mentre devono solo andare a lavorare.`;
  }
  return `Questo video da ${place} mostra un disagio reale di cittadini comuni: non propaganda di partito, ma vita quotidiana.`;
}

function rageAckFromComment(
  comment: string,
  sentiment: CommentSentiment,
  place: string,
  pillar: DistressPillar,
): string {
  const c = comment.toLowerCase();
  if (/poltron|abbandon|tutti\s*uguali|canna\s*del\s*gas|pense.*se\s*stess/.test(c)) {
    return `Nei commenti da ${place} la gente ha ragione a dire che troppa politica pensa alle poltrone e abbandona gli italiani.`;
  }
  if (sentiment === "ATTACCO / PROVOCAZIONE" || /vergogna|schifo|andatevene/.test(c)) {
    return "Do ragione a chi nei commenti sfoga rabbia e insulti: non è odio gratuito, è la prova che i palazzi non ascoltano.";
  }
  if (pillar.id === "DISABILITA") {
    return `Il dato reale è questo: a ${place} caregiver e famiglie con disabilità pagano tagli e attese mentre lo Stato guarda altrove.`;
  }
  if (pillar.id === "TASSE_PIVA") {
    return `Il dato reale è questo: a ${place} Partite IVA e artigiani anticipano tasse non ancora maturate e rischiano di chiudere.`;
  }
  return "Do ragione a chi nei commenti chiede fatti e non chiacchiere: questa rabbia è legittima.";
}

function cleanFullSentence(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) {
    return "La risposta di Futuro Nazionale è concreta: priorità agli italiani in difficoltà e atti di legge, non tweet.";
  }
  if (/[.!?]$/.test(t)) return t;
  return `${t}.`;
}
