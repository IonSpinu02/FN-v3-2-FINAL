export type ConversionTier = "alta" | "media" | "bassa";

export type ConversionCardTheme = {
  tier: ConversionTier;
  cardBg: string;
  cardBorder: string;
  badge: string;
  barColor: string;
  dotColor: string;
  tierLabel: string;
  /** Sfondo opaco per box riepilogo (stesso gradiente card). */
  summaryBox: string;
  summaryBorder: string;
  summaryTitle: string;
};

const ALTA: Omit<ConversionCardTheme, "tier"> = {
  cardBg:
    "bg-gradient-to-br from-emerald-500/[0.09] via-emerald-950/[0.22] to-[#090D16] hover:from-emerald-500/[0.14] hover:via-emerald-950/[0.30]",
  cardBorder: "border-emerald-500/25 hover:border-emerald-400/45",
  badge: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
  barColor: "bg-emerald-400/80",
  dotColor: "bg-emerald-400",
  tierLabel: "Alta conv.",
  summaryBox:
    "bg-gradient-to-br from-emerald-500/[0.09] via-emerald-950/[0.22] to-[#090D16]",
  summaryBorder: "border-emerald-500/25",
  summaryTitle: "text-emerald-300",
};

const MEDIA: Omit<ConversionCardTheme, "tier"> = {
  cardBg:
    "bg-gradient-to-br from-yellow-500/[0.08] via-amber-950/[0.22] to-[#090D16] hover:from-yellow-500/[0.13] hover:via-amber-950/[0.30]",
  cardBorder: "border-yellow-500/25 hover:border-yellow-400/45",
  badge: "bg-yellow-500/15 text-yellow-200 border border-yellow-500/25",
  barColor: "bg-yellow-400/80",
  dotColor: "bg-yellow-400",
  tierLabel: "Media conv.",
  summaryBox:
    "bg-gradient-to-br from-yellow-500/[0.08] via-amber-950/[0.22] to-[#090D16]",
  summaryBorder: "border-yellow-500/25",
  summaryTitle: "text-yellow-200",
};

const BASSA: Omit<ConversionCardTheme, "tier"> = {
  cardBg:
    "bg-gradient-to-br from-rose-500/[0.09] via-red-950/[0.24] to-[#090D16] hover:from-rose-500/[0.14] hover:via-red-950/[0.32]",
  cardBorder: "border-rose-500/25 hover:border-rose-400/45",
  badge: "bg-rose-500/15 text-rose-300 border border-rose-500/25",
  barColor: "bg-rose-400/80",
  dotColor: "bg-rose-400",
  tierLabel: "Bassa conv.",
  summaryBox:
    "bg-gradient-to-br from-rose-500/[0.09] via-red-950/[0.24] to-[#090D16]",
  summaryBorder: "border-rose-500/25",
  summaryTitle: "text-rose-300",
};

export function conversionTierFromScore(score: number): ConversionTier {
  if (score >= 80) return "alta";
  if (score >= 50) return "media";
  return "bassa";
}

/** Classi Tailwind per fascia di conversione (permeabilità Vannacci 0–100). */
export function getConversionCardTheme(score: number): ConversionCardTheme {
  const tier = conversionTierFromScore(score);
  const base =
    tier === "alta" ? ALTA : tier === "media" ? MEDIA : BASSA;
  return { tier, ...base };
}

export const ACTIVE_REGION_RING =
  "ring-2 ring-white/70 shadow-[0_0_25px_rgba(255,255,255,0.08)]";
