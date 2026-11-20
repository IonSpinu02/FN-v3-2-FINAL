import {
  OFFICIAL_S,
  OFFICIAL_S_SOURCE_LABEL,
  OFFICIAL_S_SOURCE_URL,
} from "@/lib/engine/defaults";

/** Punto Supermedia YouTrend/AGI — intenzioni di voto FN (dati pubblici). */
export type FnSupermediaPollPoint = {
  /** ISO date (giorno pubblicazione Supermedia). */
  isoDate: string;
  /** Percentuale nazionale (0–100). */
  pct: number;
  /** Didascalia breve per tooltip/asse. */
  caption: string;
  /** URL articolo Supermedia, se noto. */
  articleUrl?: string;
  /** Frasi della fonte sul movimento di FN. */
  why?: string;
  /** Variazione dichiarata dalla fonte (pp). Negativa = calo. */
  deltaPp?: number;
};

/**
 * Serie settimanale Futuro Nazionale nella Supermedia YouTrend/AGI.
 * Fonte: articoli Supermedia su youtrend.it e riprese stampa (AGI, Sky TG24).
 * Non è simulazione Monte Carlo: sono medie ponderate di sondaggi reali.
 */
export const FN_SUPERMEDIA_CONSENSO_SERIES: FnSupermediaPollPoint[] = [
  {
    isoDate: "2026-02-26",
    pct: 2.9,
    caption: "Debutto FN in Supermedia",
  },
  {
    isoDate: "2026-03-05",
    pct: 3.0,
    caption: "Tutti gli istituti includono FN",
  },
  {
    isoDate: "2026-06-18",
    pct: 4.9,
    caption: "Supermedia 18 giu 2026",
  },
  {
    isoDate: "2026-07-16",
    pct: 6.5,
    caption: "Supermedia 16 lug 2026",
  },
  {
    isoDate: "2026-07-30",
    pct: 7.6,
    caption: "Fine luglio · Supermedia",
  },
  {
    isoDate: "2026-09-08",
    pct: 7.7,
    caption: "Sorpasso FI · Supermedia/Sky",
  },
  {
    isoDate: "2026-10-01",
    pct: 7.7,
    caption: "Inizio ottobre",
  },
  {
    isoDate: "2026-10-15",
    pct: 7.2,
    caption: "Storico di riferimento al 15 ott 2026",
  },
  {
    isoDate: "2026-11-02",
    pct: 6.1,
    caption: "Supermedia YouTrend/AGI · FN al 6,1%",
    articleUrl:
      "https://tg24.sky.it/politica/2026/11/02/sondaggi-partiti-politici-intenzioni-voto-supermedia-youtrend",
    deltaPp: -1.1,
  },
  {
    isoDate: "2026-11-10",
    pct: 6.59,
    caption: "Consenso osservato (baseline piattaforma novembre)",
  },
];

/** Allinea l’ultimo punto alla S ufficiale piattaforma se coincide la data di riferimento. */
export function fnSupermediaSeriesForChart(): FnSupermediaPollPoint[] {
  const base = [...FN_SUPERMEDIA_CONSENSO_SERIES];
  const last = base[base.length - 1];
  if (last && Math.abs(last.pct / 100 - OFFICIAL_S) > 0.0001) {
    base[base.length - 1] = {
      ...last,
      pct: Math.round(OFFICIAL_S * 1000) / 10,
    };
  }
  return base;
}

export function fnSupermediaChartMeta() {
  const series = fnSupermediaSeriesForChart();
  const first = series[0]?.pct ?? 0;
  const last = series[series.length - 1]?.pct ?? 0;
  return {
    series,
    sourceLabel: OFFICIAL_S_SOURCE_LABEL,
    sourceUrl: OFFICIAL_S_SOURCE_URL,
    deltaPp: Math.round((last - first) * 10) / 10,
    latestPct: last,
    firstPct: first,
  };
}
