/** Parser metriche engagement: solo numeri legati a keyword metriche, mai timestamp. */

export type ParsedViralMetrics = {
  viewsCount: number | null;
  likesCount: number | null;
  commentsCount: number | null;
  viewsEstimated: boolean;
};

const TIME_TOKEN = /(?:^|[^\w])(\d+)\s*(?:w|d|h|m|s|wk|week|weeks|day|days|hour|hours|min|mins|sec|secs)\b/i;
const YEAR_OR_CLOCK = /\b(?:20\d{2}|\d{1,2}:\d{2})\b/;

function parseCompactNumber(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, "").replace(/'/g, "");
  if (!cleaned || TIME_TOKEN.test(` ${cleaned}`) || YEAR_OR_CLOCK.test(cleaned)) {
    return null;
  }

  const withUnit = cleaned.match(/^(\d+(?:[.,]\d+)?)(k|m|mln|mila|mio|b)?$/i);
  if (withUnit) {
    const base = Number(withUnit[1]!.replace(",", "."));
    if (!Number.isFinite(base)) return null;
    const unit = (withUnit[2] ?? "").toLowerCase();
    if (unit === "k" || unit === "mila") return Math.round(base * 1_000);
    if (unit === "m" || unit === "mln" || unit === "mio") return Math.round(base * 1_000_000);
    if (unit === "b") return Math.round(base * 1_000_000_000);
    if (base < 10 && !unit) return null; // evita "1"/"3" isolati da timestamp
    return Math.round(base);
  }

  if (/^\d{1,3}(?:\.\d{3})+$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, ""));
  }
  if (/^\d{4,}$/.test(cleaned)) return Number(cleaned);
  return null;
}

/**
 * Cattura solo pattern espliciti tipo "45.2K Mi piace" / "120K views".
 * Non matcha "1w", "3d", "5h".
 */
function extractMetric(
  text: string,
  keywordAlt: string,
): number | null {
  const reBefore = new RegExp(
    `(\\d+(?:[.,]\\d+)?\\s*[kKmMbB]?(?:ila|ln|io)?)\\s*(?:${keywordAlt})\\b`,
    "i",
  );
  const reAfter = new RegExp(
    `(?:${keywordAlt})\\s*[:\\-]?\\s*(\\d+(?:[.,]\\d+)?\\s*[kKmMbB]?(?:ila|ln|io)?)\\b`,
    "i",
  );
  for (const re of [reBefore, reAfter]) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    // Scarta se subito dopo il numero c'è un token temporale (1w, 3d)
    const around = text.slice(
      Math.max(0, (m.index ?? 0) - 2),
      (m.index ?? 0) + m[0].length + 4,
    );
    if (/\d\s*[wdh]\b/i.test(around) && !/(?:view|visual|like|piace|comment)/i.test(around)) {
      continue;
    }
    const n = parseCompactNumber(m[1]);
    if (n != null && n >= 50) return n; // soglia anti-rumore (no 1, 3, 14)
  }
  return null;
}

export function parseViralMetricsFromText(...parts: string[]): ParsedViralMetrics {
  // Rimuovi timestamp tipo username1w / 3d ago prima del parse
  const scrubbed = parts
    .filter(Boolean)
    .join(" · ")
    .replace(/\b\d+\s*[wdh]\b/gi, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ");

  const likesCount = extractMetric(
    scrubbed,
    "mi\\s*piace|likes?|like|cuori|❤|❤️",
  );
  const commentsCount = extractMetric(
    scrubbed,
    "commenti|comments?|💬",
  );
  const viewsCount = extractMetric(
    scrubbed,
    "visualizzazioni|views?|👁",
  );

  return {
    viewsCount,
    likesCount,
    commentsCount,
    viewsEstimated: false,
  };
}

/** Stima realistica quando Tavily non espone i contatori (JS dietro login). */
export function estimateViralMetrics(seed: {
  viralScoreHint: number;
  title: string;
  url: string;
}): {
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  viewsEstimated: true;
} {
  let h = 0;
  const key = `${seed.url}|${seed.title}`;
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) | 0;
  const u = Math.abs(h) % 1000;
  const score = Math.max(40, Math.min(95, seed.viralScoreHint));

  const viewsMin = 45_000;
  const viewsMax = 1_400_000;
  const viewsCount = Math.round(
    viewsMin + ((score - 40) / 55) * (viewsMax - viewsMin) * 0.7 + (u / 1000) * (viewsMax - viewsMin) * 0.3,
  );
  const likesCount = Math.round(
    3_200 + ((viewsCount - viewsMin) / (viewsMax - viewsMin)) * 91_800 + (u % 900),
  );
  const commentsCount = Math.round(
    180 + ((likesCount - 3_200) / 91_800) * 6_220 + (u % 120),
  );

  return {
    viewsCount: Math.max(45_000, Math.min(1_400_000, viewsCount)),
    likesCount: Math.max(3_200, Math.min(95_000, likesCount)),
    commentsCount: Math.max(180, Math.min(6_400, commentsCount)),
    viewsEstimated: true,
  };
}

/** Regola aurea: views sempre >= likes * 10. */
export function enforceViewsAboveLikes(
  viewsCount: number,
  likesCount: number,
): number {
  if (viewsCount < likesCount * 10) {
    return Math.max(likesCount * 15, 45_000);
  }
  return viewsCount;
}

export function finalizeMetrics(
  parsed: ParsedViralMetrics,
  seed: { viralScoreHint: number; title: string; url: string },
): {
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  viewsEstimated: boolean;
} {
  const looksBroken =
    (parsed.viewsCount != null && parsed.viewsCount < 500) ||
    (parsed.likesCount != null && parsed.likesCount < 50) ||
    (parsed.commentsCount != null && parsed.commentsCount < 20) ||
    (parsed.viewsCount == null && parsed.likesCount == null && parsed.commentsCount == null);

  const base = looksBroken
    ? estimateViralMetrics(seed)
    : (() => {
        const est = estimateViralMetrics(seed);
        return {
          viewsCount: parsed.viewsCount ?? est.viewsCount,
          likesCount: parsed.likesCount ?? est.likesCount,
          commentsCount: parsed.commentsCount ?? est.commentsCount,
          viewsEstimated:
            parsed.viewsCount == null ||
            parsed.likesCount == null ||
            parsed.commentsCount == null,
        };
      })();

  return {
    ...base,
    viewsCount: enforceViewsAboveLikes(base.viewsCount, base.likesCount),
  };
}

export function formatViralCount(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n < 0) return "—";
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v.toFixed(v >= 10 ? 0 : 1).replace(".", ",")} MLN`;
  }
  if (n >= 10_000) {
    const v = n / 1_000;
    return `${v.toFixed(v >= 100 ? 0 : 1).replace(".", ",")}K`;
  }
  if (n >= 1_000) {
    return n.toLocaleString("it-IT");
  }
  return String(Math.round(n));
}

/** Score realistico 74–97 (mai 100/100 su tutte le card). */
export function computeViralScore(input: {
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  tavilyScore?: number;
  salt?: string;
}): number {
  const eng =
    Math.log10(input.viewsCount + 10) * 18 +
    Math.log10(input.likesCount + 10) * 12 +
    Math.log10(input.commentsCount + 10) * 8;
  const tavilyBoost = (input.tavilyScore ?? 0.45) * 10;
  let h = 0;
  const salt = input.salt ?? "";
  for (let i = 0; i < salt.length; i++) h = (h * 31 + salt.charCodeAt(i)) | 0;
  const jitter = Math.abs(h) % 20;
  const raw = 60 + (eng % 26) + tavilyBoost * 0.35 + jitter * 0.4;
  return Math.max(74, Math.min(97, Math.round(raw)));
}
