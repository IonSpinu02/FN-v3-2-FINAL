import type { StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";

/**
 * Verifica di plausibilità del piano contro evidenze esterne.
 * Non modifica il piano: lo confronta con analoghi storici e con la letteratura sul campo.
 * Le soglie del verdetto sono un giudizio calibrato sugli analoghi elencati, non un risultato del modello.
 */

export type RealityVerdict = "PLAUSIBILE" | "AMBIZIOSO" | "ECCEZIONALE" | "RICHIEDE_SHOCK_ESTERNO";

export type Analog = {
  label: string;
  gainPp: number;
  months: number;
  ppPerMonth: number;
  note: string;
  source: string;
};

export type RealityFlag = { severity: "info" | "attenzione" | "allarme"; text: string };

export type RealityCheck = {
  verdict: RealityVerdict;
  headline: string;
  totalGrowthPp: number;
  months: number;
  growthPpPerMonth: number;
  /** Quota della crescita oltre la proiezione offensiva V4: richiede un fattore esterno. */
  catalystShare: number;
  v4CoveredPp: number;
  analogs: Analog[];
  groundGame: {
    mobilizedVotes: number;
    contactsLow: number;
    contactsHigh: number;
    contactsPerDayLow: number;
    contactsPerDayHigh: number;
    fullTimeCanvassersLow: number;
    fullTimeCanvassersHigh: number;
    note: string;
  };
  pollNoise: {
    singlePollSdPp: number;
    systematicSdPp: number;
    note: string;
  };
  flags: RealityFlag[];
  caveats: string[];
};

const ANALOGS: Omit<Analog, "ppPerMonth">[] = [
  {
    label: "Fratelli d'Italia, 2019",
    gainPp: 5.5,
    months: 12,
    note: "Più che raddoppiata nell'anno, da circa 4–5% a oltre 10%, con crisi di governo come catalizzatore.",
    source: "YouTrend/AGI, 30 dicembre 2019",
  },
  {
    label: "Reform UK, ottobre 2023 – giugno 2024",
    gainPp: 13,
    months: 8,
    note: "Dal 6% al 19% con il crollo dei Conservatori come fattore esterno. Dodici mesi dopo ha perso circa 9 punti dal picco.",
    source: "YouGov, Telegraph, AllPolls",
  },
];

/** Contatti per voto aggiuntivo da mobilitazione: da 1 ogni 14 (porta a porta) a 1 ogni 25 (contatti indiretti). */
const CONTACTS_PER_VOTE = { low: 14, high: 25 };
/** Contatti a ora per un canvasser (12 secondo la letteratura sul campo). */
const CONTACTS_PER_HOUR = 12;
const HOURS_PER_DAY = 8;
/** Errore sistematico dei sondaggi italiani in quota del consenso: 1,9 pp medi su partiti al 15,6% di media nel 2022. */
const SYSTEMATIC_ERROR_SHARE = 0.12;

function singlePollSd(pct: number, n = 1000, deff = 1.15): number {
  const p = Math.min(0.5, Math.max(0.005, pct / 100));
  return Math.sqrt((p * (1 - p) * deff) / n) * 100;
}

function verdictFor(ratePerMonth: number): RealityVerdict {
  const tier = ratePerMonth <= 0.15 ? 0 : ratePerMonth <= 0.35 ? 1 : ratePerMonth <= 0.7 ? 2 : 3;
  return (["PLAUSIBILE", "AMBIZIOSO", "ECCEZIONALE", "RICHIEDE_SHOCK_ESTERNO"] as const)[tier]!;
}

export function assessPlanPlausibility(plan: StrategicBackcastResult, horizonDays: number): RealityCheck {
  const months = Math.max(1, horizonDays / 30);
  const totalGrowthPp = Math.max(0, plan.targetPct - plan.currentPct);
  const growthPpPerMonth = totalGrowthPp / months;
  const v4CoveredPp = Math.max(0, Math.min(totalGrowthPp, plan.offensiveCentral - plan.currentPct));
  const catalystShare = totalGrowthPp > 0 ? 1 - v4CoveredPp / totalGrowthPp : 0;
  const verdict = verdictFor(growthPpPerMonth);

  const analogs: Analog[] = ANALOGS.map((item) => ({ ...item, ppPerMonth: item.gainPp / item.months }));

  const addedVotes = plan.regions.reduce((sum, row) => sum + row.addedVotes, 0);
  const mobilizedVotes = Math.round(addedVotes * plan.groundingShare);
  const contactsLow = mobilizedVotes * CONTACTS_PER_VOTE.low;
  const contactsHigh = mobilizedVotes * CONTACTS_PER_VOTE.high;
  const perDay = (contacts: number) => contacts / Math.max(1, horizonDays);
  const canvassers = (contacts: number) => perDay(contacts) / (CONTACTS_PER_HOUR * HOURS_PER_DAY);

  const systematicSdPp = plan.currentPct * SYSTEMATIC_ERROR_SHARE;
  const singleSd = singlePollSd(plan.currentPct);

  const headlines: Record<RealityVerdict, string> = {
    PLAUSIBILE: `Crescita di ${growthPpPerMonth.toFixed(2).replace(".", ",")} pp al mese: dentro l'ordinario per un partito in espansione.`,
    AMBIZIOSO: `Crescita di ${growthPpPerMonth.toFixed(2).replace(".", ",")} pp al mese: alta ma raggiungibile con esecuzione quasi perfetta.`,
    ECCEZIONALE: `Crescita di ${growthPpPerMonth.toFixed(2).replace(".", ",")} pp al mese: nel range dei migliori casi osservati, quasi sempre trainati da un evento esterno.`,
    RICHIEDE_SHOCK_ESTERNO: `Crescita di ${growthPpPerMonth.toFixed(2).replace(".", ",")} pp al mese: oltre ogni caso ordinario, serve uno shock esterno.`,
  };

  const flags: RealityFlag[] = [];
  if (catalystShare >= 0.5) {
    flags.push({
      severity: catalystShare >= 0.7 ? "allarme" : "attenzione",
      text: `Il ${Math.round(catalystShare * 100)}% della crescita sta oltre lo scenario offensivo: la stima ne copre solo ${v4CoveredPp.toFixed(1).replace(".", ",")} punti. Il resto dipende da un fattore che non controlliamo.`,
    });
  }
  if (growthPpPerMonth > 0.35) {
    flags.push({
      severity: "attenzione",
      text: "I casi italiani di crescita simile (Fratelli d'Italia 2019) hanno avuto una crisi di governo come detonatore. Senza un evento analogo la probabilità reale è inferiore a quella indicata dalla previsione.",
    });
  }
  flags.push({
    severity: "attenzione",
    text: "Il numero di comitati (un comitato ogni 12.000 voti) e di tesserati (uno ogni 40 voti) è un coefficiente interno non validato: non ha una fonte empirica.",
  });
  flags.push({
    severity: "info",
    text: `Un sondaggio da 1.000 interviste ha un errore di campionamento di circa ±${singleSd.toFixed(1).replace(".", ",")} pp, e gli istituti sbagliano in media di quasi 2 pp per partito: il monitoraggio non deve reagire a un singolo dato.`,
  });

  return {
    verdict,
    headline: headlines[verdict],
    totalGrowthPp,
    months,
    growthPpPerMonth,
    catalystShare,
    v4CoveredPp,
    analogs,
    groundGame: {
      mobilizedVotes,
      contactsLow,
      contactsHigh,
      contactsPerDayLow: perDay(contactsLow),
      contactsPerDayHigh: perDay(contactsHigh),
      fullTimeCanvassersLow: canvassers(contactsLow),
      fullTimeCanvassersHigh: canvassers(contactsHigh),
      note: "Stima prudente del lavoro di mobilitazione sul territorio. La persuasione di elettori nuovi con i contatti diretti, in elezioni generali, ha un effetto medio vicino a zero: il collo di bottiglia non è il numero di contatti ma il messaggio e il catalizzatore.",
    },
    pollNoise: {
      singlePollSdPp: singleSd,
      systematicSdPp,
      note: "Errore di campionamento di un sondaggio da 1.000 interviste con effetto di disegno 1,15, e errore sistematico stimato al 12% del consenso (scarto medio dei sondaggi finali del 2022).",
    },
    flags,
    caveats: [
      "Gli analoghi sono due casi selezionati: indicano un ordine di grandezza, non una distribuzione statistica.",
      "I rendimenti dei contatti sul campo derivano da esperimenti statunitensi (Green e Gerber, Kalla e Broockman) e vanno trasferiti all'Italia con cautela.",
      "Le soglie del verdetto sono un giudizio calibrato sugli analoghi, non un risultato del modello.",
      "La probabilità di successo del motore (Realismo) misura solo il rumore interno: non include il rischio di mancato catalizzatore né l'errore dei sondaggi.",
    ],
  };
}
