import type { Region } from "@/lib/engine/constants";

export type RegionCockpitMetrics = {
  currentPct: number;
  conversionScore: number;
};

export type CockpitTier = "verde" | "giallo" | "rosso";

export type CockpitTierFilter = "all" | CockpitTier;

/** Classificazione operativa Vannacci (non ISTAT). */
export const COCKPIT_TIER_VERDE: readonly Region[] = [
  "Lombardia",
  "Veneto",
  "Piemonte",
  "Puglia",
  "Calabria",
  "Friuli-Venezia Giulia",
  "Marche",
  "Abruzzo",
] as const;

export const COCKPIT_TIER_GIALLO: readonly Region[] = [
  "Lazio",
  "Sicilia",
  "Liguria",
  "Sardegna",
  "Basilicata",
  "Trentino-Alto Adige",
  "Molise",
] as const;

export const COCKPIT_TIER_ROSSO: readonly Region[] = [
  "Emilia-Romagna",
  "Toscana",
  "Campania",
  "Umbria",
  "Valle d'Aosta",
] as const;

const TIER_MAP = new Map<Region, CockpitTier>(
  [
    ...COCKPIT_TIER_VERDE.map((r) => [r, "verde"] as const),
    ...COCKPIT_TIER_GIALLO.map((r) => [r, "giallo"] as const),
    ...COCKPIT_TIER_ROSSO.map((r) => [r, "rosso"] as const),
  ],
);

export function cockpitTierForRegion(region: Region): CockpitTier {
  return TIER_MAP.get(region) ?? "giallo";
}

export const COCKPIT_MENU_CARD: Record<
  CockpitTier,
  { idle: string; selected: string; tierDotClass: string; accentBarClass: string }
> = {
  verde: {
    idle:
      "bg-gradient-to-r from-emerald-500/[0.07] via-emerald-950/[0.18] to-[#0A0F1A] border-emerald-500/20 hover:border-emerald-400/40 opacity-85 hover:opacity-100",
    selected:
      "bg-gradient-to-r from-emerald-500/[0.18] via-emerald-950/[0.35] to-[#0D1524] border-emerald-400/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16),0_4px_20px_-4px_rgba(16,185,129,0.28)] opacity-100",
    tierDotClass: "bg-emerald-400",
    accentBarClass: "bg-emerald-400",
  },
  giallo: {
    idle:
      "bg-gradient-to-r from-yellow-500/[0.06] via-amber-950/[0.18] to-[#0A0F1A] border-yellow-500/20 hover:border-yellow-400/40 opacity-85 hover:opacity-100",
    selected:
      "bg-gradient-to-r from-yellow-500/[0.16] via-amber-950/[0.32] to-[#0D1524] border-yellow-400/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16),0_4px_20px_-4px_rgba(234,179,8,0.25)] opacity-100",
    tierDotClass: "bg-yellow-400",
    accentBarClass: "bg-yellow-400",
  },
  rosso: {
    idle:
      "bg-gradient-to-r from-rose-500/[0.07] via-rose-950/[0.20] to-[#0A0F1A] border-rose-500/20 hover:border-rose-400/40 opacity-85 hover:opacity-100",
    selected:
      "bg-gradient-to-r from-rose-500/[0.16] via-rose-950/[0.35] to-[#0D1524] border-rose-400/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16),0_4px_20px_-4px_rgba(244,63,94,0.25)] opacity-100",
    tierDotClass: "bg-rose-500",
    accentBarClass: "bg-rose-400",
  },
};

/** Stile selezione bottone «Tutta l'Italia» (fascia verde / nazionale). */
export const COCKPIT_NAZIONALE_CARD = {
  idle:
    "bg-gradient-to-r from-emerald-500/[0.07] via-emerald-950/[0.18] to-[#0A0F1A] border-emerald-500/20 hover:border-emerald-400/40 opacity-85 hover:opacity-100 text-slate-300",
  selected:
    "bg-gradient-to-r from-emerald-500/[0.18] via-emerald-950/[0.35] to-[#0D1524] border-emerald-400/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16),0_4px_20px_-4px_rgba(16,185,129,0.28)] opacity-100 text-emerald-100",
  accentBarClass: "bg-emerald-400",
} as const;

export const COCKPIT_HEADER_BG: Record<CockpitTier, string> = {
  verde:
    "bg-gradient-to-br from-emerald-500/[0.09] via-emerald-950/[0.22] to-[#090D16] border-emerald-500/25",
  giallo:
    "bg-gradient-to-br from-yellow-500/[0.08] via-amber-950/[0.22] to-[#090D16] border-yellow-500/25",
  rosso:
    "bg-gradient-to-br from-rose-500/[0.09] via-red-950/[0.24] to-[#090D16] border-rose-500/25",
};

export const COCKPIT_VERDICT: Record<CockpitTier, string> = {
  verde:
    "CONVIENE ANDARE SUBITO — Forte bacino Lega e Fratelli d'Italia ricettivo a Vannacci",
  giallo:
    "TERRENO CONTENDIBILE — Molti astenuti recuperabili sui problemi concreti",
  rosso:
    "BASSA PRIORITÀ — Regione storicamente a sinistra (PD), bassa conversione di voti",
};

export function regionsForCockpitFilter(filter: CockpitTierFilter): Region[] {
  if (filter === "all") {
    return [
      ...COCKPIT_TIER_VERDE,
      ...COCKPIT_TIER_GIALLO,
      ...COCKPIT_TIER_ROSSO,
    ];
  }
  if (filter === "verde") return [...COCKPIT_TIER_VERDE];
  if (filter === "giallo") return [...COCKPIT_TIER_GIALLO];
  return [...COCKPIT_TIER_ROSSO];
}

const TIER_SORT_ORDER: Record<CockpitTier, number> = {
  verde: 0,
  giallo: 1,
  rosso: 2,
};

export function sortRegionsByAddedVotes(
  regions: Region[],
  addedVotesByRegion: Map<Region, number>,
): Region[] {
  return [...regions].sort(
    (a, b) => (addedVotesByRegion.get(b) ?? 0) - (addedVotesByRegion.get(a) ?? 0),
  );
}

/** Prima fascia semaforo (verde → giallo → rosso), poi voti decrescenti. */
export function sortRegionsByTierThenVotes(
  regions: Region[],
  addedVotesByRegion: Map<Region, number>,
): Region[] {
  return [...regions].sort((a, b) => {
    const ta = TIER_SORT_ORDER[cockpitTierForRegion(a)];
    const tb = TIER_SORT_ORDER[cockpitTierForRegion(b)];
    if (ta !== tb) return ta - tb;
    return (addedVotesByRegion.get(b) ?? 0) - (addedVotesByRegion.get(a) ?? 0);
  });
}

/** Scroll interno menu regioni (altezza dal contenitore flex, niente cap fisso). */
export const COCKPIT_MENU_SCROLL =
  "min-h-0 flex-1 overflow-y-auto px-1 py-1 space-y-1.5 [scrollbar-width:thin] [scrollbar-color:#1E293B_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent";
