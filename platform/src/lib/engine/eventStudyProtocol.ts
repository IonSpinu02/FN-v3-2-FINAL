/** Finestre osservazione pre/post evento (Modulo C — protocollo doc Osservatorio). */

export interface ObservationWindow {
  label: string;
  start: Date;
  end: Date;
}

export function parseEventDate(isoDate: string): Date | null {
  const d = new Date(isoDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildObservationWindows(
  eventDate: Date,
  preDays = 14,
  postDays = 14,
): { pre: ObservationWindow; post: ObservationWindow; extra: ObservationWindow[] } {
  const preStart = addDays(eventDate, -preDays);
  const preEnd = addDays(eventDate, -1);
  const postStart = addDays(eventDate, 1);
  const postEnd = addDays(eventDate, postDays);

  const extra: ObservationWindow[] = [3, 7, 30].map((n) => ({
    label: `${n}g post-evento`,
    start: eventDate,
    end: addDays(eventDate, n),
  }));

  return {
    pre: {
      label: `${preDays}g pre-evento`,
      start: preStart,
      end: preEnd,
    },
    post: {
      label: `${postDays}g post-evento`,
      start: postStart,
      end: postEnd,
    },
    extra,
  };
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface TrendComparison {
  mediaPre: number;
  mediaPost: number;
  deltaRelativoPct: number;
  interpretazione: string;
}

/** Confronto medie Trends (indice 0–100 relativo) — non implica variazione elettorale. */
export function compareTrendSeries(
  preValues: number[],
  postValues: number[],
): TrendComparison {
  const mediaPre = mean(preValues);
  const mediaPost = mean(postValues);
  const deltaRelativoPct =
    mediaPre > 0 ? ((mediaPost - mediaPre) / mediaPre) * 100 : 0;

  let interpretazione =
    "Variazione dell'indice di attenzione relativa (Google Trends); non misura gradimento né intenzioni di voto.";
  if (preValues.length === 0 || postValues.length === 0) {
    interpretazione =
      "Dati insufficienti per confronto pre/post; conservare estrazione originale Trends.";
  } else if (Math.abs(deltaRelativoPct) < 5) {
    interpretazione +=
      " Variazione contenuta nel periodo considerato.";
  } else if (deltaRelativoPct > 0) {
    interpretazione +=
      " Attenzione media post-evento superiore al periodo pre-evento (concomitanza, non causalità).";
  } else {
    interpretazione +=
      " Attenzione media post-evento inferiore al picco pre/post (normalizzazione relativa).";
  }

  return { mediaPre, mediaPost, deltaRelativoPct, interpretazione };
}
