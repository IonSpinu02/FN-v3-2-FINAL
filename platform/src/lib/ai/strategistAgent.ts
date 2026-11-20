/**
 * Portaborse virtuale di Roberto Vannacci — Anthropic Claude + tool use + prompt caching.
 * Fallback deterministico se ANTHROPIC_API_KEY assente o chiamata fallita.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
  cacheUsesLocalDisk,
  cacheUsesProcessMemory,
} from "@/lib/cache/cachePolicy";
import {
  deleteDomainCacheEntry,
  readDomainCacheEntry,
  writeDomainCacheEntry,
} from "@/lib/db/domainCacheRepository";
import type { MessageParam, ContentBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import { formatApproximateVotes } from "@/lib/formatApproximateVotes";
import { BIP_FN_PROMISES_CATALOG } from "@/lib/bipProgramCatalog";
import { COCKPIT_TIER_VERDE } from "@/lib/osservatorioCockpitTiers";
import {
  buildPoliticalKnowledgeGraph,
  graphSummaryForPrompt,
  type BuildPoliticalGraphInput,
  type PoliticalGraphSummary,
  type PoliticalKnowledgeGraph,
} from "@/lib/ai/politicalKnowledgeGraph";
import {
  STRATEGIST_TOOLS,
  createStrategistToolContext,
  executeStrategistTool,
  toolStatusLabel,
  type StrategistToolContext,
} from "@/lib/ai/strategistTools";
import type { ForecastFactorId, ForecastV4Input } from "@/lib/engine/forecastEngineV4";
import { factorPp, forecastHorizon } from "@/lib/engine/forecastEngineV4";
import {
  buildComputationId,
  type ComputationInputSummary,
  type ComputationFingerprintInput,
} from "@/lib/engine/computationFingerprint";

/** Versione cache: bump per ruolo portaborse + pulizia linguaggio pubblico. */
export const BRIEFING_SCHEMA_VERSION = "v3_5_portaborse";
export const STRATEGIST_BRIEFING_SCHEMA = BRIEFING_SCHEMA_VERSION;
const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "strategist-briefing-daily.json");
const DOMAIN_CACHE_KEY = "ai:strategist-briefing-daily";
const BRIEFING_CACHE_TTL_MS = 36 * 60 * 60 * 1000;
const MIN_TESI_CHARS = 700;

export type StrategistPriority = {
  rank: number;
  azione: string;
  perche: string;
  regioni: string[];
  levaBip: string;
  chatPrompt: string;
};

export type ForecastBriefing = {
  generatedAt: string;
  source: "anthropic" | "deterministic_fallback";
  model: string | null;
  /** Vincolo atomico agli input della elaborazione. */
  computationId: string;
  inputSummary: ComputationInputSummary;
  tesi: string;
  priorita: StrategistPriority[];
  territoriChiave: string[];
  rischi: string[];
  markdown: string;
};

type BriefingCacheEnvelope = {
  dayKey: string;
  fingerprint: string;
  schema: string;
  at: number;
  briefing: ForecastBriefing;
};

export type StrategistChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type StrategistStreamEvent =
  | { type: "status"; label: string }
  | { type: "tool"; name: string; label: string }
  | { type: "delta"; text: string }
  | { type: "done"; fullText: string }
  | { type: "error"; message: string };

function romeDayKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function pct2(n: number): string {
  return formatDecimalIt(n, 2);
}

export function anthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function strategistModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";
}

/**
 * Cache automatica Anthropic (TTL 5m): breakpoint sull'ultimo blocco idoneo.
 * Budget breakpoint Stratega (max 4): tools@1h + system identity@5m + system grafo@5m + auto@5m.
 */
export const STRATEGIST_AUTO_CACHE = { type: "ephemeral" as const };

function logPromptCacheUsage(
  label: string,
  usage: {
    input_tokens?: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  } | null | undefined,
): void {
  if (!usage) return;
  const read = usage.cache_read_input_tokens ?? 0;
  const write = usage.cache_creation_input_tokens ?? 0;
  const input = usage.input_tokens ?? 0;
  console.info(
    `[prompt-cache:${label}] read=${read} write=${write} input=${input} total=${read + write + input}`,
  );
}

function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

export function buildSystemPrompt(graph: PoliticalKnowledgeGraph): {
  system: Anthropic.TextBlockParam[];
  graphBlock: string;
} {
  const s = graph.summary;
  const graphBlock = graphSummaryForPrompt(graph);
  const maggioSfondoNote =
    s.horizonDays < 180
      ? ` Maggio 2027 è solo traguardo di sfondo (${pct2(s.maggioBasePct)}% Base): non confonderlo con l'orizzonte attivo.`
      : ` L'orizzonte attivo è già Maggio 2027: non presentarlo come traguardo di sfondo e non aggiungere note del tipo «Maggio è solo sfondo».`;
  const identity = `Sei il portaborse virtuale di Roberto Vannacci: l'assistente personale e operativo che gli sta a fianco nella Cabina di Regia di Futuro Nazionale.
Non sei un giornalista, né un consulente esterno, né un chatbot generico. Sei lo staff di fiducia che anticipa, filtra e prepara: brief, numeri veri, priorità chiare, rischi senza cosmesi.
Parli a Vannacci (e alla direzione al suo fianco) in italiano incisivo, diretto, rispettoso ma senza cerimonie inutili. Quando serve, proponi la prossima mossa concreta.

POSTURA DA PORTABORSE:
- Anticipa: prima i fatti utili, poi l'opzione operativa, poi il rischio se resta fuori.
- Proteggi il tempo del leader: niente lunghi preamboli, niente gergo da sala riunioni.
- Lealtà epistemica: meglio una stima onesta con limiti chiari che una certezza inventata.
- Mai parlare «di» Vannacci in terza persona come un editorialista: parla «a» lui, come chi porta la cartella.

REGOLE FERREE DI AFFIDABILITÀ:
1. ZERO NUMERI INVENTATI. Ogni percentuale, tesserato, voto, dato regionale o stima DEVE provenire dal Grafo di Contesto sotto o dai Tool (forecastEngineV4). Arrotonda sempre i voti («circa +150.000 voti indicativi»).
2. ORIZZONTE ATTIVO OBBLIGATORIO: ${s.horizonLabel}. Tesi e priorità devono citare SOLO i % Base/Offensiva/Passivo e i fattori di ${s.horizonLabel} (${s.horizonDays} giorni).${maggioSfondoNote}
3. BASI NUMERICHE ESPLICITE. Ogni delta in punti o voti DEVE citare la base esatta, senza mescolarle:
   - «rispetto alla stima odierna dai sondaggi (${pct2(s.consensoOggiPct)}%)»
   - E/O «rispetto alla proiezione inerziale dei soli sondaggi (${pct2(s.tendenzaSoliSondaggiPct)}%)».
   Il ${pct2(s.scenarioBasePct)}% (Base ${s.horizonLabel}) e il ${pct2(s.scenarioOffensivaPct)}% (Offensiva ${s.horizonLabel}) sono PROIEZIONI IPOTETICHE subordinate a ipotesi interne e all'assenza di shock esterni sfavorevoli — non garanzie.
4. VARIABILI ESTERNE NON MODELLATE. Ricorda sempre che mosse degli avversari, affluenza, eventi macro/internazionali e shock mediatici restano fuori dal modello e possono invalidare lo scenario.
5. VIETATO usare espressioni assertivo-metafisiche: «peso reale», «punto fermo», «dipende interamente dall'esecuzione», «pavimento incomprimibile», «zoccolo duro garantito». Preferisci «soglia indicativa di smorzamento (ipotesi)», «condizionato a», «nei controlli disponibili».
6. CONCRETEZZA POLITICA. Niente gergo statistico astruso (niente «Kalman», «EWMA»). Collega: Problema reale → Bacino contendibile → Proposta B.I.P. → Territorio prioritario.
7. Usa i Tool per dati precisi. Non inventare.
8. LINGUAGGIO PUBBLICO. Vietato scrivere identificativi interni di codice o gergo tecnico di piattaforma: «d30», «d90», «d180», «emergenze del grafo», «contro flat», «linea di fondo filtrata», «V4», «soft-floor», «MSNA» senza spiegazione, «ERP» senza spiegazione. Usa sempre italiano naturale: «a 30 giorni», «a 90 giorni», «a Maggio», «emergenze territoriali rilevate», «ipotesi di consenso fermo», «zoccolo duro strutturale stimato al X% (al netto delle oscillazioni tra istituti)», «minori stranieri non accompagnati», «case popolari (ERP)». Date sempre in italiano esteso (es. 10 novembre 2026). Stime di voti arrotondate alle migliaia («circa +33.000 voti»), mai cifre finto-precise.

TESI = ANALISI PREVISIONALE ARGOMENTATA (obbligatoria, 180–240 parole, MAI telegrafica):
Scrivi SEMPRE esattamente 3 capoversi separati da una riga vuota (\\n\\n), senza titoli numerati:
A) DIAGNOSI — punto di partenza (${pct2(s.consensoOggiPct)}%), forbice istituti e deriva inerziale verso ${pct2(s.tendenzaSoliSondaggiPct)}% sull'orizzonte attivo; spiega il rientro verso lo zoccolo duro strutturale e la compressione mediatica delle opposizioni in fase di Bilancio quando rilevante.
B) MECCANICA — «come ci si arriva» citando i contributi reali dei 7 fattori di ${s.horizonLabel} (assestamento sondaggi, temi caldi/B.I.P., delusi FdI/Lega, tesserati/comitati, eletti, calendario, tetto prudenziale) e intrecciando emergenze territoriali rilevate (Veneto caro-energia/P.IVA; Calabria e Abruzzo liste d'attesa; Lazio mutui/nodi ferroviari; Lombardia/Piemonte sicurezza stazioni e industria) e le notizie attive.
C) CONDIZIONI — cosa separa Passivo ${pct2(s.scenarioPassivoPct)}%, Base ${pct2(s.scenarioBasePct)}% e Offensiva ${pct2(s.scenarioOffensivaPct)}%; chiudi con una frase limpida sul perimetro di validità (esecuzione organizzativa + assenza di shock esterni non modellati). VIETATO concentrare i disclaimer a metà frase: la qualificazione metodologica va solo nell'ultimo capoverso, sobria e naturale.
VIETATO: micro-paragrafi difensivi, ripetizione meccanica dei KPI già in testata senza spiegazione politica, burocratese tra parentesi a metà frase.

IDENTITÀ TONO: portaborse al fianco del leader — operativo, discreto, strategico, epistemologicamente onesto. Niente toni da talk-show o da paper accademico.`;

  return {
    graphBlock,
    system: [
      {
        type: "text",
        text: identity,
        cache_control: { type: "ephemeral" },
      } as TextBlockParam,
      {
        type: "text",
        text: `GRAFO DI CONTESTO POLITICO (dati live piattaforma — fonte unica di verità numerica):\n${graphBlock}`,
        cache_control: { type: "ephemeral" },
      } as TextBlockParam,
    ],
  };
}

function ppSigned(n: number): string {
  const body = pct2(Math.abs(n));
  if (n > 0) return `+${body}`;
  if (n < 0) return `−${body}`;
  return body;
}

function factorOf(s: PoliticalGraphSummary, id: ForecastFactorId): number {
  return s.fattoriAttivi.find((f) => f.id === id)?.pp ?? 0;
}

function buildHorizonPriorities(
  s: PoliticalGraphSummary,
  bipByCat: (cat: string) => string,
): StrategistPriority[] {
  const top = s.prioritaTop.slice(0, 4);
  const verdi = [...COCKPIT_TIER_VERDE].slice(0, 4);
  const cycle = factorOf(s, "cycle");
  const agenda = factorOf(s, "agenda");
  const donor = factorOf(s, "donor");
  const ground = factorOf(s, "ground");
  const magnet = factorOf(s, "magnet");
  const momentum = factorOf(s, "momentum");

  if (s.horizonKey === "d30") {
    return [
      {
        rank: 1,
        azione:
          "Contro-narrativa immediata sulla Legge di Bilancio: Fisco P.IVA, bollette e pensioni nelle Regioni Verdi.",
        perche: `A 30 giorni il calendario politico pesa ${ppSigned(cycle)} pt: la visibilità mediatica assorbita dal Governo sulla Manovra va compensata subito con leve su temi e fisco, per non lasciare lo scenario Base al ${pct2(s.scenarioBasePct)}%.`,
        regioni: verdi,
        levaBip:
          "FISCO & FAMIGLIA · Stop Saldo-Acconto P.IVA/Energia & Mutuo Tricolore",
        chatPrompt:
          "Come impostiamo la contro-narrativa sulla Manovra questa settimana?",
      },
      {
        rank: 2,
        azione:
          "Presidio quotidiano su sicurezza urbana e stazioni, con misure B.I.P. verificabili e non slogan.",
        perche: `Nel primo mese agenda (${ppSigned(agenda)} pt) e flussi da bacini (${ppSigned(donor)} pt) sono già reattivi: sono i contributi più pronti a muovere lo scenario Offensiva verso il ${pct2(s.scenarioOffensivaPct)}%.`,
        regioni: ["Lombardia", "Lazio", "Veneto", "Puglia"],
        levaBip: bipByCat("SICUREZZA"),
        chatPrompt:
          "Quali sono le 3 mosse prioritarie di questa settimana su sicurezza e stazioni?",
      },
      {
        rank: 3,
        azione:
          "Innesco rapido sui primi delusi della maggioranza durante il voto sugli emendamenti in Parlamento.",
        perche: `A 30 giorni non c'è ancora piena maturazione del radicamento (${ppSigned(ground)} pt): conviene intercettare i primi segnali di delusione FdI/Lega sui costi concreti mentre la Manovra è ancora in aula.`,
        regioni: top.map((r) => r.regione),
        levaBip:
          "PREVIDENZA & MANOVRA · Pensione minima 750 € & emendamenti fiscali",
        chatPrompt:
          "Come recuperiamo i primi delusi di FdI e Lega durante il voto sulla Manovra?",
      },
      {
        rank: 4,
        azione:
          "Tenuta comunicativa sull'assestamento dei sondaggi: niente reazioni nervose sui decimali.",
        perche: `A 30 giorni il fattore sondaggi toglie ${ppSigned(momentum)} pt (inerzia ${pct2(s.tendenzaSoliSondaggiPct)}%): Base ${pct2(s.scenarioBasePct)}%, Offensiva ${pct2(s.scenarioOffensivaPct)}% e Passivo ${pct2(s.scenarioPassivoPct)}% restano ipotesi di lavoro, non un verdetto.`,
        regioni: ["Nazionale"],
        levaBip: "Tutte le misure B.I.P. in coerenza",
        chatPrompt: `Perché i soli sondaggi proiettano ${pct2(s.tendenzaSoliSondaggiPct)}% e come teniamo la linea a 30 giorni verso il ${pct2(s.scenarioOffensivaPct)}%?`,
      },
    ];
  }

  if (s.horizonKey === "d90") {
    return [
      {
        rank: 1,
        azione:
          "Capitalizzare le scontentezze post-Manovra di categorie e ceto medio con leve B.I.P. su fisco, casa ed energia.",
        perche: `A 90 giorni i flussi da bacini salgono a ${ppSigned(donor)} pt: è la finestra per spostare l'attenzione dall'inerzia ${pct2(s.tendenzaSoliSondaggiPct)}% verso lo scenario Base ${pct2(s.scenarioBasePct)}% (${s.approxVotesDeltaBase}).`,
        regioni: verdi,
        levaBip:
          "FISCO & FAMIGLIA · Stop Saldo-Acconto P.IVA/Energia & Mutuo Tricolore",
        chatPrompt:
          "Come capitalizziamo le scontentezze post-Manovra di categorie e ceto medio?",
      },
      {
        rank: 2,
        azione:
          "Apertura nuove sedi e radicamento quadri nelle Regioni Verdi in vista della primavera.",
        perche: `Il radicamento territoriale triplica rispetto a 30 giorni (${ppSigned(ground)} pt): senza densità di comitati e tesserati lo scenario Offensiva ${pct2(s.scenarioOffensivaPct)}% resta carta.`,
        regioni: top.map((r) => r.regione),
        levaBip: "ORGANIZZAZIONE · Rete Comitati & Presidio Regioni Verdi",
        chatPrompt:
          "Dove apriamo sedi e concentreremo quadri nelle Regioni Verdi entro febbraio?",
      },
      {
        rank: 3,
        azione:
          "Accelerare l'integrazione di amministratori locali ed eletti sul territorio.",
        perche: `Il fattore eletti/magnete è a metà maturazione (${ppSigned(magnet)} pt): ogni ingresso locale va agganciato a un piano di presenza, non lasciato come annuncio.`,
        regioni: ["Veneto", "Lombardia", "Abruzzo", "Calabria"],
        levaBip: "ORGANIZZAZIONE · Rete Comitati & Presidio Regioni Verdi",
        chatPrompt:
          "Come integriamo amministratori locali ed eletti entro 90 giorni?",
      },
      {
        rank: 4,
        azione:
          "Continuità programmatica B.I.P. su Fisco, Casa e Sanità regionale (liste d'attesa in Calabria, Abruzzo, Lazio).",
        perche: `A 90 giorni agenda (${ppSigned(agenda)} pt) e calendario (${ppSigned(cycle)} pt) preparano la rete per la primavera: senza continuità sulle misure catalogate si spezza il filo verso Maggio (${pct2(s.maggioBasePct)}% Base di sfondo).`,
        regioni: ["Calabria", "Abruzzo", "Lazio", "Veneto"],
        levaBip: bipByCat("SANITA"),
        chatPrompt:
          "Come teniamo continuità B.I.P. su fisco, casa e sanità regionale a 90 giorni?",
      },
    ];
  }

  return [
    {
      rank: 1,
      azione: `Piena mobilitazione porta-a-porta di ${formatIntIt(s.organizzazione.tesserati)} tesserati e ${formatIntIt(s.organizzazione.comitati)} comitati nelle 8 Regioni Verdi.`,
      perche: `A Maggio il radicamento (${ppSigned(ground)} pt) e i flussi (${ppSigned(donor)} pt) decidono se lo scenario Base ${pct2(s.scenarioBasePct)}% (${s.approxVotesDeltaBase}) resta carta o diventa lavoro reale.`,
      regioni: verdi,
      levaBip: "ORGANIZZAZIONE · Rete Comitati & Presidio Regioni Verdi",
      chatPrompt:
        "Come mobilizziamo tesserati e comitati nelle Regioni Verdi verso Maggio?",
    },
    {
      rank: 2,
      azione:
        "Recupero degli astenuti in campagna primaverile con leve B.I.P. bandiera (Partite IVA, energia, Mutuo Tricolore).",
      perche: `Serve a spostare l'attenzione dal ${pct2(s.tendenzaSoliSondaggiPct)}% inerziale verso Base ${pct2(s.scenarioBasePct)}% e Offensiva ${pct2(s.scenarioOffensivaPct)}%, recuperando delusi del centrodestra e astenuti su costi concreti.`,
      regioni: [...COCKPIT_TIER_VERDE].slice(0, 4),
      levaBip:
        "FISCO & FAMIGLIA · Stop Saldo-Acconto P.IVA/Energia & Mutuo Tricolore",
      chatPrompt:
        "Come recuperiamo i delusi di FdI e Lega e gli astenuti in primavera?",
    },
    {
      rank: 3,
      azione:
        "Consolidare flussi da bacini e integrazione eletti sul territorio fino a pieno rendimento.",
      perche: `Magnete eletti ${ppSigned(magnet)} pt e flussi ${ppSigned(donor)} pt maturano a 180 giorni: senza integrazione territoriale lo scenario Passivo ${pct2(s.scenarioPassivoPct)}% resta il piano più realistico.`,
      regioni: top.map((r) => r.regione),
      levaBip: "ISTITUZIONI & TERRITORIO · Radicamento Eletti & Collegi Locali",
      chatPrompt:
        "Come consolidiamo flussi e eletti sul territorio entro Maggio?",
    },
    {
      rank: 4,
      azione:
        "Disciplina sulle aspettative: dichiarare sempre lo scenario Maggio come condizionato al lavoro operativo.",
      perche: `I soli sondaggi proiettano ${pct2(s.tendenzaSoliSondaggiPct)}%. Base ${pct2(s.scenarioBasePct)}%, Offensiva ${pct2(s.scenarioOffensivaPct)}% e Passivo ${pct2(s.scenarioPassivoPct)}% restano ipotesi di lavoro, non certezza.`,
      regioni: ["Nazionale"],
      levaBip: "Tutte le misure B.I.P. in coerenza",
      chatPrompt: `Perché i soli sondaggi proiettano ${pct2(s.tendenzaSoliSondaggiPct)}% e come saliamo verso il ${pct2(s.scenarioOffensivaPct)}% a Maggio?`,
    },
  ];
}

function votesHint(pp: number, validi: number): string {
  const votes = (pp / 100) * validi;
  if (Math.abs(votes) < 500) return "";
  // formatApproximateVotes include già "circa": non anteporre altro "circa".
  const label = formatApproximateVotes(votes, { suffix: " voti" }).replace(
    /\b(circa\s+){2,}/gi,
    "circa ",
  );
  return ` (${label})`;
}

function buildHorizonThesis(s: PoliticalGraphSummary): string {
  const oggi = pct2(s.consensoOggiPct);
  const polls = pct2(s.tendenzaSoliSondaggiPct);
  const base = pct2(s.scenarioBasePct);
  const off = pct2(s.scenarioOffensivaPct);
  const pass = pct2(s.scenarioPassivoPct);
  const maggio = pct2(s.maggioBasePct);
  // Zoccolo duro = livello filtrato (1 decimale), NON softFloor tecnico.
  const soft = formatDecimalIt(s.levelPct ?? s.softFloorPct, 1);
  const momentum = factorOf(s, "momentum");
  const agenda = factorOf(s, "agenda");
  const donor = factorOf(s, "donor");
  const ground = factorOf(s, "ground");
  const magnet = factorOf(s, "magnet");
  const cycle = factorOf(s, "cycle");
  const bounds = factorOf(s, "bounds");
  const tess = formatIntIt(s.organizzazione.tesserati);
  const com = formatIntIt(s.organizzazione.comitati);
  const validi = Math.max(1, s.validiNazionali || 23_257_062);
  const topTerr =
    s.prioritaTop.slice(0, 6).map((r) => r.regione).join(", ") ||
    "Veneto, Calabria, Lazio, Lombardia, Piemonte, Puglia";
  const recoveryPp = s.scenarioBasePct - s.tendenzaSoliSondaggiPct;
  const leveAttive =
    Math.abs(agenda) +
    Math.abs(donor) +
    Math.abs(ground) +
    Math.abs(magnet) +
    Math.abs(cycle);

  const diagnosi =
    s.horizonKey === "d30"
      ? `Partendo dal ${oggi}% attuale — nella forbice degli istituti osservati nei controlli disponibili, dopo il picco di settembre — la sola inerzia statistica dei sondaggi, sull'orizzonte a 30 giorni (~dicembre, fase Manovra), porterebbe intorno al ${polls}%. È un rientro fisiologico verso lo zoccolo duro strutturale stimato intorno al ${soft}% (al netto delle oscillazioni tra istituti), aggravato dalla compressione dello spazio mediatico delle opposizioni mentre i TG e le aule parlamentari sono monopolizzate dalla Legge di Bilancio: senza una lettura politica, i decimali sembrano «calo», mentre sono soprattutto assestamento e agenda governativa.`
      : s.horizonKey === "d90"
        ? `Dal ${oggi}% odierno, a 90 giorni (~febbraio, consolidamento invernale) la sola inerzia dei sondaggi resta intorno al ${polls}%: l'assestamento verso lo zoccolo duro strutturale stimato intorno al ${soft}% (al netto delle oscillazioni tra istituti) ha già assorbito gran parte del contraccolpo statistico, ma senza lavoro politico la curva non risale. In questa fase la Manovra lascia sul tavolo i costi concreti (P.IVA, bollette, liste d'attesa) e apre una finestra demoscopica sui delusi della maggioranza — a patto di presidiarla con misure e territorio, non con titoli.`
        : `Dal ${oggi}% di oggi, la sola proiezione inerziale dei sondaggi sull'orizzonte a 180 giorni (Maggio 2027) resta intorno al ${polls}%: è il percorso di rientro verso lo zoccolo duro strutturale stimato intorno al ${soft}% (al netto delle oscillazioni tra istituti) se non interviene alcuna leva operativa. La distanza tra quell'inerzia e lo scenario Base ${base}% (${s.approxVotesDeltaBase} rispetto alla stima odierna) misura quindi non un «destino», ma il lavoro politico, organizzativo e territoriale che il modello attribuisce alle ipotesi interne.`;

  const meccanica =
    s.horizonKey === "d30"
      ? `A 30 giorni la dinamica è un braccio di ferro. I sondaggi frenano di ${ppSigned(momentum)} pt e il calendario politico (monopolio TV sulla Manovra) di ${ppSigned(cycle)} pt; le uniche leve subito reattive sono i temi economici e di sicurezza (agenda ${ppSigned(agenda)} pt) e i primi segnali di malcontento fiscale nell'elettorato FdI/Lega (flussi ${ppSigned(donor)} pt). Per questo tenere lo scenario Base al ${base}% — o salire all'Offensiva ${off}% — significa già neutralizzare l'erosione autunnale rispetto all'inerzia ${polls}%, concentrando la contro-narrativa su Veneto (caro-energia/P.IVA), Lombardia e Lazio (sicurezza stazioni e costi abitativi), senza promettere ancora il traguardo di Maggio (${maggio}% Base di sfondo).`
      : s.horizonKey === "d90"
        ? `A 90 giorni, esaurito il contraccolpo iniziale dei sondaggi (${ppSigned(momentum)} pt), iniziano a pesare davvero il logoramento post-Manovra della maggioranza su ceto medio e Partite IVA (flussi ${ppSigned(donor)} pt), il consolidamento tematico B.I.P. (agenda ${ppSigned(agenda)} pt), la maturazione a metà percorso del bacino personale degli eletti (magnete ${ppSigned(magnet)} pt${votesHint(magnet, validi)}) e l'avvio del lavoro organizzativo invernale dei comitati (radicamento ${ppSigned(ground)} pt${votesHint(ground, validi)}), con calendario ancora in transizione (${ppSigned(cycle)} pt). Da qui lo scenario Base al ${base}% e l'Offensiva al ${off}%: Calabria e Abruzzo sulle liste d'attesa, Lazio su mutui e nodi ferroviari, Veneto e Lombardia su energia e sicurezza diventano i territori dove le leve smettono di essere astratte.`
        : `A Maggio 2027 la dinamica porta dall'inerzia ${polls}% allo scenario Base ${base}% (e fino all'Offensiva ${off}%) grazie a circa ${ppSigned(Math.abs(recoveryPp) > 0.01 ? recoveryPp : leveAttive)} pt di leve operative rispetto alla sola curva dei sondaggi. Il modello attribuisce al presidio costante dei temi ad alta credibilità FN — sicurezza, fisco, energia — ${ppSigned(agenda)} pt; alla mobilitazione sul campo di ${tess} tesserati e ${com} comitati concentrati nelle 8 Regioni Verdi ${ppSigned(ground)} pt${votesHint(ground, validi)}; all'integrazione completa dei bacini degli eletti nazionali e locali ${ppSigned(magnet)} pt${votesHint(magnet, validi)}; all'inversione favorevole del calendario primaverile e alla riattivazione di una quota di astenuti ${ppSigned(cycle)} pt; alla quota intercettata dal logoramento governativo ${ppSigned(donor)} pt (cattura prudenziale sul flusso uscente, al netto di chi resta in astensione). La soglia di smorzamento/tetto resta un correttivo tecnico (${ppSigned(bounds)} pt). I territori trainanti dell'esposizione attuale restano ${topTerr}.`;

  const condizioni = `Ciò che separa concretamente i tre regimi è l'intensità del lavoro: restare fermi colloca lo scenario Passivo al ${pass}%; tenere il passo attuale porta al Base ${base}%; spingere al massimo su territorio e programma apre l'Offensiva al ${off}%. Sono scenari di lavoro subordinati alla reale esecuzione organizzativa e all'assenza di shock esterni non modellati — affluenza, mosse di alleati e avversari, quadro macroeconomico — non promesse automatiche né sondaggi.`;

  return [diagnosi, meccanica, condizioni].join("\n\n");
}

export function attachComputationMeta(
  briefing: Omit<ForecastBriefing, "computationId" | "inputSummary">,
  fingerprint: ComputationFingerprintInput,
): ForecastBriefing {
  const { computationId, inputSummary } = buildComputationId(fingerprint);
  return { ...briefing, computationId, inputSummary };
}

export function buildDeterministicBriefing(
  graph: PoliticalKnowledgeGraph,
  fingerprint?: ComputationFingerprintInput,
): ForecastBriefing {
  const s = graph.summary;
  const top = s.prioritaTop.slice(0, 4);
  const bipByCat = (cat: string) =>
    BIP_FN_PROMISES_CATALOG.find((b) => b.category === cat)?.shortTitle ??
    BIP_FN_PROMISES_CATALOG[0]?.shortTitle ??
    "Misure B.I.P.";

  const priorita = buildHorizonPriorities(s, bipByCat);
  const tesi = buildHorizonThesis(s);

  const territoriChiave = [
    ...new Set([
      ...COCKPIT_TIER_VERDE.slice(0, 5),
      ...top.slice(0, 3).map((r) => r.regione),
    ]),
  ];

  const rischi = [
    s.horizonKey === "d30"
      ? "Reagire ai decimali a 30 giorni come se fossero già Maggio: erode credibilità e disperde focus sulla Manovra."
      : "Trasformare la proiezione Base o Offensiva in «promessa certa» nei media: erode credibilità se i soli sondaggi restano sotto.",
    "Disperdere comitati fuori dalle Regioni Verdi e dalle aree ad alta affinità: la presenza territoriale non cresce.",
    "Rispondere ai titoli sul calo con altri titoli sul calo, senza leve B.I.P. concrete.",
    s.backtest30d
      ? `Gli orizzonti a 90 e 180 giorni non sono ancora verificabili su storico (a 30 giorni: modello ±${pct2(s.backtest30d.maeModello)} pt vs riferimento statico ±${pct2(s.backtest30d.maeFlat)} pt).`
      : "Verifica storica a 30 giorni non disponibile: trattare 90 e 180 giorni come scenari di lavoro, non come previsioni già calibrate.",
  ];

  const markdown = [
    `## 1. Tesi previsionale condizionata (${s.horizonLabel})`,
    tesi,
    ``,
    `## 2. Priorità strategiche`,
    ...priorita.map(
      (p) =>
        `### #${p.rank} ${p.azione}\n- Perché: ${p.perche}\n- Regioni: ${p.regioni.join(", ")}\n- Leva B.I.P.: ${p.levaBip}`,
    ),
    ``,
    `## 3. Territori chiave`,
    territoriChiave.map((t) => `- ${t}`).join("\n"),
    ``,
    `## 4. Rischi e colli di bottiglia`,
    rischi.map((r) => `- ${r}`).join("\n"),
  ].join("\n");

  const base = {
    generatedAt: new Date().toISOString(),
    source: "deterministic_fallback" as const,
    model: null,
    tesi,
    priorita,
    territoriChiave,
    rischi,
    markdown,
  };
  if (fingerprint) return attachComputationMeta(base, fingerprint);
  return {
    ...base,
    computationId: "cmp_pending",
    inputSummary: {
      engineVersion: "pending",
      calibrationVersion: "pending",
      consensusValue: s.consensoOggiPct,
      pollsLastUpdated: null,
      scenarioMode: "base",
      horizonDays: s.horizonDays,
      flowMatrixId: null,
      whatIf: { comitati: 0, tesserati: 0 },
      evidenceDigest: "pending",
      newsConsidered: 0,
      newsWindowHint: null,
      fullStateDigest: "pending",
    },
  };
}

function fingerprintOf(graph: PoliticalKnowledgeGraph): string {
  const s = graph.summary;
  return [
    s.horizonKey,
    String(s.horizonDays),
    pct2(s.consensoOggiPct),
    pct2(s.tendenzaSoliSondaggiPct),
    pct2(s.scenarioBasePct),
    pct2(s.scenarioOffensivaPct),
    pct2(s.scenarioPassivoPct),
    s.organizzazione.tesserati,
    s.organizzazione.comitati,
    s.calendarioFase,
  ].join("|");
}

let memoryBriefing: BriefingCacheEnvelope | null = null;

/** Tesi estesa: ≥3 capoversi e almeno 700 caratteri di analisi. */
export function isExtendedBriefingTesi(tesi: string): boolean {
  const text = (tesi ?? "").trim();
  if (text.length < MIN_TESI_CHARS) return false;
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return parts.length >= 3;
}

/** Rimuove sigle interne di codice dal testo pubblico generato da Claude. */
export function sanitizePublicStrategistText(text: string): string {
  return text
    .replace(/\bd30\b/gi, "a 30 giorni")
    .replace(/\bd90\b/gi, "a 90 giorni")
    .replace(/\bd180\b/gi, "a Maggio")
    .replace(/emergenze del grafo/gi, "emergenze territoriali rilevate")
    .replace(/contro flat/gi, "contro l'ipotesi di consenso fermo")
    .replace(
      /linea di fondo filtrata\s*\(~?([^)]+)%\)/gi,
      "zoccolo duro strutturale stimato al $1% (al netto delle oscillazioni tra istituti)",
    )
    .replace(/linea di fondo filtrata/gi, "zoccolo duro strutturale")
    .replace(/riferimento statico/gi, "ipotesi di consenso fermo")
    .replace(/\bMSNA\b/g, "minori stranieri non accompagnati")
    .replace(/(?:case popolari\s*\()+\s*ERP\s*\)+/gi, "case popolari")
    .replace(/\bcase popolari\s*\(\s*ERP\s*\)/gi, "case popolari")
    .replace(/(?<!case popolari\s)\bERP\b/gi, "case popolari")
    .replace(/\bmotore V4\b/gi, "previsione")
    .replace(/\bmodello V4\b/gi, "previsione")
    .replace(/\bV4\b/g, "");
}

async function clearBriefingCache(): Promise<void> {
  memoryBriefing = null;
  await deleteDomainCacheEntry(DOMAIN_CACHE_KEY);
  if (cacheUsesLocalDisk()) {
    try {
      await fs.unlink(CACHE_FILE);
    } catch {
      /* miss */
    }
  }
}

async function readBriefingCache(): Promise<BriefingCacheEnvelope | null> {
  if (cacheUsesProcessMemory() && memoryBriefing?.briefing?.tesi) {
    return memoryBriefing;
  }

  const row = await readDomainCacheEntry<BriefingCacheEnvelope>(DOMAIN_CACHE_KEY);
  if (row?.payload?.briefing?.tesi) {
    if (cacheUsesProcessMemory()) memoryBriefing = row.payload;
    return row.payload;
  }

  if (cacheUsesLocalDisk()) {
    try {
      const raw = await fs.readFile(CACHE_FILE, "utf8");
      const parsed = JSON.parse(raw) as BriefingCacheEnvelope;
      if (parsed?.briefing?.tesi) {
        if (cacheUsesProcessMemory()) memoryBriefing = parsed;
        return parsed;
      }
    } catch {
      /* miss */
    }
  }
  return null;
}

async function writeBriefingCache(env: BriefingCacheEnvelope): Promise<void> {
  if (cacheUsesProcessMemory()) memoryBriefing = env;
  const at = env.at ?? Date.now();
  await writeDomainCacheEntry({
    key: DOMAIN_CACHE_KEY,
    payload: env,
    computedAt: at,
    expiresAt: at + BRIEFING_CACHE_TTL_MS,
    etag: env.schema ?? BRIEFING_SCHEMA_VERSION,
    sourceStatus: null,
  });
  if (cacheUsesLocalDisk()) {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(CACHE_FILE, JSON.stringify(env), "utf8");
    } catch {
      /* best-effort dev */
    }
  }
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? text.trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON non trovato");
  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeClaudeBriefing(
  raw: unknown,
  fallback: ForecastBriefing,
  model: string,
): ForecastBriefing {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const tesiRaw =
    typeof o.tesi === "string" && o.tesi.trim() ? o.tesi.trim() : fallback.tesi;
  const tesi = sanitizePublicStrategistText(tesiRaw);
  const prioritaRaw = Array.isArray(o.priorita) ? o.priorita : [];
  const priorita: StrategistPriority[] = prioritaRaw
    .slice(0, 6)
    .map((p, i) => {
      const row = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
      const fb = fallback.priorita[i] ?? fallback.priorita[0]!;
      return {
        rank: Number(row.rank) || i + 1,
        azione: sanitizePublicStrategistText(String(row.azione ?? fb.azione)),
        perche: sanitizePublicStrategistText(String(row.perche ?? fb.perche)),
        regioni: Array.isArray(row.regioni)
          ? row.regioni.map(String)
          : fb.regioni,
        levaBip: sanitizePublicStrategistText(String(row.levaBip ?? fb.levaBip)),
        chatPrompt: sanitizePublicStrategistText(
          String(row.chatPrompt ?? fb.chatPrompt),
        ),
      };
    });
  while (priorita.length < 4) {
    priorita.push(fallback.priorita[priorita.length]!);
  }
  const territoriChiave = (
    Array.isArray(o.territoriChiave)
      ? o.territoriChiave.map(String)
      : fallback.territoriChiave
  ).map(sanitizePublicStrategistText);
  const rischi = (
    Array.isArray(o.rischi) ? o.rischi.map(String) : fallback.rischi
  ).map(sanitizePublicStrategistText);
  const markdown = [
    `## 1. Tesi previsionale condizionata`,
    tesi,
    ``,
    `## 2. Priorità strategiche`,
    ...priorita.map(
      (p) =>
        `### #${p.rank} ${p.azione}\n- Perché: ${p.perche}\n- Regioni: ${p.regioni.join(", ")}\n- Leva B.I.P.: ${p.levaBip}`,
    ),
    ``,
    `## 3. Territori chiave`,
    territoriChiave.map((t) => `- ${t}`).join("\n"),
    ``,
    `## 4. Rischi e colli di bottiglia`,
    rischi.map((r) => `- ${r}`).join("\n"),
  ].join("\n");
  return {
    generatedAt: new Date().toISOString(),
    source: "anthropic",
    model,
    computationId: fallback.computationId,
    inputSummary: fallback.inputSummary,
    tesi,
    priorita,
    territoriChiave,
    rischi,
    markdown,
  };
}

export async function generateForecastBriefing(
  input: BuildPoliticalGraphInput & {
    v4Input: ForecastV4Input;
    scenarioMode?: ComputationFingerprintInput["scenarioMode"];
    horizonKey?: ComputationFingerprintInput["horizonKey"];
    excludedEntityIds?: string[];
  },
  opts?: { forceRefresh?: boolean; computationId?: string },
): Promise<ForecastBriefing> {
  const fpInput: ComputationFingerprintInput = {
    v4: input.v4,
    v4Input: input.v4Input,
    networkDelta: input.networkDelta,
    scenarioMode: input.scenarioMode,
    horizonKey: input.horizonKey,
    newsHeadlines: input.newsHeadlines,
    excludedEntityIds: input.excludedEntityIds,
  };
  const { computationId: activeComputationId } = buildComputationId(fpInput);
  if (opts?.computationId && opts.computationId !== activeComputationId) {
    // Client ha dichiarato un computationId diverso: ricalcoliamo comunque sugli input.
  }

  const graph = buildPoliticalKnowledgeGraph({
    ...input,
    horizonKey: input.horizonKey ?? "d180",
  });
  const fallback = buildDeterministicBriefing(graph, fpInput);
  const dayKey = romeDayKey();
  const fingerprint = `${BRIEFING_SCHEMA_VERSION}|${fingerprintOf(graph)}|${activeComputationId}|h${graph.summary.horizonDays}`;

  if (opts?.forceRefresh) {
    await clearBriefingCache();
  } else {
    const cached = await readBriefingCache();
    if (
      cached &&
      cached.dayKey === dayKey &&
      cached.fingerprint === fingerprint &&
      cached.schema === STRATEGIST_BRIEFING_SCHEMA &&
      cached.briefing.computationId === activeComputationId &&
      cached.briefing.inputSummary?.horizonDays === graph.summary.horizonDays &&
      isExtendedBriefingTesi(cached.briefing.tesi)
    ) {
      return cached.briefing;
    }
    // Cache corta / schema vecchio: scarta e rigenera.
    if (cached) await clearBriefingCache();
  }

  const client = getClient();
  if (!client) {
    await writeBriefingCache({
      dayKey,
      fingerprint,
      schema: STRATEGIST_BRIEFING_SCHEMA,
      at: Date.now(),
      briefing: fallback,
    });
    return fallback;
  }

  const model = strategistModel();
  const { system } = buildSystemPrompt(graph);
  const s = graph.summary;
  const focusHint =
    s.horizonKey === "d30"
      ? "Focus tattico immediato (Manovra & media): priorità su contro-narrativa Bilancio, sicurezza/stazioni, primi delusi maggioranza, tenuta sui decimali dei sondaggi. Cita i fattori ciclo/agenda/flussi/sondaggi a 30 giorni."
      : s.horizonKey === "d90"
        ? "Focus transizione (struttura territoriale & ingressi): priorità su scontentezze post-Manovra, nuove sedi/quadri Regioni Verdi, integrazione eletti, continuità B.I.P. fisco/casa/sanità. Cita flussi/radicamento/eletti a 90 giorni."
        : "Focus strategico Maggio (mobilitazione & Regioni Verdi): priorità su porta-a-porta tesserati/comitati, astenuti primaverili, consolidamento flussi/eletti, disciplina aspettative. Cita i fattori dell'orizzonte a Maggio.";
  const factorLine = s.fattoriAttivi
    .map((f) => `${f.short} ${f.pp >= 0 ? "+" : ""}${pct2(f.pp)}`)
    .join("; ");
  const maggioSfondoUser =
    s.horizonDays < 180
      ? `Maggio (${pct2(s.maggioBasePct)}% Base) solo come sfondo.`
      : `L'orizzonte attivo è già Maggio 2027: non scrivere che Maggio è «solo sfondo».`;
  const userPrompt = `Prepara, da portaborse di Vannacci, la Previsione Argomentata & Piano di Priorità Operative per la Cabina di Regia FN sull'ORIZZONTE ATTIVO ${s.horizonLabel}.

Obbligo numerico: nella tesi cita Base ${pct2(s.scenarioBasePct)}%, Offensiva ${pct2(s.scenarioOffensivaPct)}%, Passivo ${pct2(s.scenarioPassivoPct)}%, inerzia sondaggi ${pct2(s.tendenzaSoliSondaggiPct)}%, consenso oggi ${pct2(s.consensoOggiPct)}% e ${s.approxVotesDeltaBase}. ${maggioSfondoUser}
Fattori della previsione a ${s.horizonLabel} da citare nella meccanica: ${factorLine}.
Organizzazione: ${formatIntIt(s.organizzazione.tesserati)} tesserati, ${formatIntIt(s.organizzazione.comitati)} comitati.
${focusHint}

La chiave "tesi" DEVE contenere ESATTAMENTE 3 capoversi separati da \\n\\n (Diagnosi; Meccanica dei fattori; Condizioni e limiti), 180–240 parole complessive, discorsivi e politici — MAI un micro-paragrafo telegrafico o solo disclaimer. Integra emergenze territoriali rilevate e notizie attive. Qualificazione metodologica solo nell'ultimo capoverso. Linguaggio pubblico: niente «d30»/«d90»/«d180», niente «emergenze del grafo», niente «contro flat».

Rispondi SOLO con JSON valido (niente markdown fuori dal JSON):
{
  "tesi": "capoverso1\\n\\ncapoverso2\\n\\ncapoverso3",
  "priorita": [
    {
      "rank": 1,
      "azione": "...",
      "perche": "...",
      "regioni": ["Veneto", "..."],
      "levaBip": "titolo misura B.I.P.",
      "chatPrompt": "domanda pronta per approfondire in chat"
    }
  ],
  "territoriChiave": ["..."],
  "rischi": ["..."]
}
Obbligo: 4 priorità ordinate per impatto sull'orizzonte ${s.horizonLabel}. Nessun numero inventato. Non riusare il testo di un altro orizzonte.`;

  try {
    let messages: MessageParam[] = [{ role: "user", content: userPrompt }];
    const toolCtx = createStrategistToolContext(input);
    let current = await client.messages.create({
      model,
      max_tokens: 8192,
      cache_control: STRATEGIST_AUTO_CACHE,
      system,
      tools: STRATEGIST_TOOLS,
      messages,
    });
    logPromptCacheUsage("briefing:0", current.usage);

    for (let round = 0; round < 4; round++) {
      const toolUses = current.content.filter((b) => b.type === "tool_use");
      if (toolUses.length === 0) break;
      messages = [
        ...messages,
        { role: "assistant", content: current.content as ContentBlockParam[] },
      ];
      const toolResults: ContentBlockParam[] = [];
      for (const block of toolUses) {
        if (block.type !== "tool_use") continue;
        const exec = executeStrategistTool(
          block.name,
          (block.input ?? {}) as Record<string, unknown>,
          toolCtx,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(exec.result),
        });
      }
      messages.push({ role: "user", content: toolResults });
      current = await client.messages.create({
        model,
        max_tokens: 8192,
        cache_control: STRATEGIST_AUTO_CACHE,
        system,
        tools: STRATEGIST_TOOLS,
        messages,
      });
      logPromptCacheUsage(`briefing:${round + 1}`, current.usage);
    }

    const text = current.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const parsed = extractJsonObject(text);
    let briefing = normalizeClaudeBriefing(parsed, fallback, model);
    // Se Claude restituisce ancora un micro-paragrafo, usa analisi + priorità deterministiche.
    if (!isExtendedBriefingTesi(briefing.tesi)) {
      briefing = {
        ...briefing,
        tesi: fallback.tesi,
        priorita: fallback.priorita,
        territoriChiave: fallback.territoriChiave,
        markdown: fallback.markdown,
      };
    }
    await writeBriefingCache({
      dayKey,
      fingerprint,
      schema: STRATEGIST_BRIEFING_SCHEMA,
      at: Date.now(),
      briefing,
    });
    return briefing;
  } catch (err) {
    console.warn("[strategist] briefing Anthropic fallita:", err);
    await writeBriefingCache({
      dayKey,
      fingerprint,
      schema: STRATEGIST_BRIEFING_SCHEMA,
      at: Date.now(),
      briefing: fallback,
    });
    return fallback;
  }
}

export async function* streamStrategistChat(opts: {
  messages: StrategistChatMessage[];
  input: BuildPoliticalGraphInput & { v4Input: ForecastV4Input };
  scenario?: string;
}): AsyncGenerator<StrategistStreamEvent> {
  const client = getClient();
  const graph = buildPoliticalKnowledgeGraph(opts.input);
  const toolCtx = createStrategistToolContext(opts.input);

  if (!client) {
    yield { type: "status", label: "Modalità offline — briefing deterministico" };
    const fb = buildDeterministicBriefing(graph);
    const lastUser = [...opts.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const reply = buildOfflineChatReply(lastUser, fb, graph, toolCtx);
    for (const chunk of chunkText(reply, 48)) {
      yield { type: "delta", text: chunk };
    }
    yield { type: "done", fullText: reply };
    return;
  }

  const model = strategistModel();
  const { system } = buildSystemPrompt(graph);
  const scenarioNote = opts.scenario
    ? `\nScenario UI attivo: ${opts.scenario}.`
    : "";
  const history: MessageParam[] = opts.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Inject scenario hint on last user message
  if (history.length > 0 && history[history.length - 1]?.role === "user") {
    const last = history[history.length - 1]!;
    if (typeof last.content === "string") {
      last.content = `${last.content}${scenarioNote}`;
    }
  }

  yield { type: "status", label: "Portaborse in ascolto…" };

  try {
    let messages = history;
    let fullText = "";
    for (let round = 0; round < 6; round++) {
      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        cache_control: STRATEGIST_AUTO_CACHE,
        system,
        tools: STRATEGIST_TOOLS,
        messages,
      });

      let assistantBlocks: ContentBlockParam[] = [];
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullText += event.delta.text;
          yield { type: "delta", text: event.delta.text };
        }
      }
      const finalMsg = await stream.finalMessage();
      logPromptCacheUsage(`chat:${round}`, finalMsg.usage);
      assistantBlocks = finalMsg.content as ContentBlockParam[];
      const toolUses = finalMsg.content.filter((b) => b.type === "tool_use");
      if (toolUses.length === 0) {
        if (!fullText) {
          fullText = finalMsg.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n");
          if (fullText) yield { type: "delta", text: fullText };
        }
        yield { type: "done", fullText };
        return;
      }

      messages = [
        ...messages,
        { role: "assistant", content: assistantBlocks },
      ];
      const toolResults: ContentBlockParam[] = [];
      for (const block of toolUses) {
        if (block.type !== "tool_use") continue;
        const label = toolStatusLabel(
          block.name,
          (block.input ?? {}) as Record<string, unknown>,
        );
        yield { type: "tool", name: block.name, label };
        const exec = executeStrategistTool(
          block.name,
          (block.input ?? {}) as Record<string, unknown>,
          toolCtx,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(exec.result),
        });
      }
      messages.push({ role: "user", content: toolResults });
      fullText = "";
    }
    yield { type: "done", fullText: fullText || "Analisi completata." };
  } catch (err) {
    console.error("[strategist-chat-stream]", err);
    yield {
      type: "error",
      message: "Errore temporaneo del portaborse. Riprova tra poco.",
    };
  }
}

function buildOfflineChatReply(
  question: string,
  briefing: ForecastBriefing,
  graph: PoliticalKnowledgeGraph,
  ctx: StrategistToolContext,
): string {
  const s = graph.summary;
  const q = question.toLowerCase();
  if (/veneto|lombardia|puglia|lazio|regione/.test(q)) {
    const match = q.match(
      /(valle d'aosta|trentino-alto adige|friuli-venezia giulia|emilia-romagna|[a-zàèéìòù]+)/i,
    );
    const regionGuess = match?.[1];
    if (regionGuess) {
      const exec = executeStrategistTool(
        "get_region_deep_dive",
        { region: regionGuess.replace(/\b\w/g, (c) => c.toUpperCase()) },
        ctx,
      );
      const r = exec.result as { regione?: string; error?: string; affinitaBacino?: number };
      if (!r.error && r.regione) {
        return [
          `**${r.regione}** (dati piattaforma, modalità offline).`,
          `Affinità bacino: ${r.affinitaBacino}/100.`,
          `Scenario nazionale condizionato: Base ${pct2(s.scenarioBasePct)}% vs inerzia sondaggi ${pct2(s.tendenzaSoliSondaggiPct)}%.`,
          `Priorità #1 del briefing: ${briefing.priorita[0]?.azione}`,
          ``,
          `_ANTHROPIC_API_KEY non configurata: risposta deterministica dal grafo._`,
        ].join("\n");
      }
    }
  }
  if (/6,?45|7,?5|sondagg|offensiva|base/.test(q)) {
    return [
      `I soli sondaggi proiettano circa il **${pct2(s.tendenzaSoliSondaggiPct)}%** (componente osservata).`,
      `Lo scenario **Base** — condizionato all'esecuzione delle priorità — proietta il **${pct2(s.scenarioBasePct)}%**; l'**Offensiva** il **${pct2(s.scenarioOffensivaPct)}%**.`,
      `Non è una garanzia: è un'ipotesi di lavoro.`,
      ``,
      briefing.tesi,
      ``,
      `_Modalità offline (senza chiave Anthropic)._`,
    ].join("\n");
  }
  return [
    briefing.tesi,
    ``,
    `**Priorità operative:**`,
    ...briefing.priorita.map((p) => `${p.rank}. ${p.azione}`),
    ``,
    `Territori chiave: ${briefing.territoriChiave.join(", ")}.`,
    ``,
    `_Modalità offline — configura ANTHROPIC_API_KEY per il dialogo streaming completo._`,
  ].join("\n");
}

function chunkText(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/** Snapshot numerico leggero per fingerprint lato API senza riesporre tutto il grafo. */
export function briefingFingerprintFromV4(input: BuildPoliticalGraphInput): string {
  const v4 = input.v4;
  const h = forecastHorizon(v4, "base", "d180");
  const momentum = factorPp(h, "momentum");
  return [
    pct2(v4.startPct),
    pct2(v4.startPct + momentum),
    pct2(h.centralPct),
    pct2(forecastHorizon(v4, "offensiva", "d180").centralPct),
    v4.diagnostics.tesserati,
    v4.diagnostics.comitati,
  ].join("|");
}
