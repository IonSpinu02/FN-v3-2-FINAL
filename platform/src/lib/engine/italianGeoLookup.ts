import { REGIONS, type Region } from "./constants";
import type { CaricaLocale } from "./localiTypes";
import { ANSA_REGION_SLUG } from "./newsFeedCatalog";
import { GEO_COMUNI, GEO_PROVINCE } from "./italianGeoData";
import {
  findCapoluogoInText,
  regioneForComune,
} from "./capoluoghiToRegione";

const SLUG_TO_REGION: Record<string, Region> = Object.fromEntries(
  Object.entries(ANSA_REGION_SLUG).map(([r, slug]) => [slug, r as Region]),
);

const COMUNE_SORTED = [...GEO_COMUNI].sort(
  (a, b) => b[0].length - a[0].length,
);
const PROVINCE_SORTED = [...GEO_PROVINCE].sort(
  (a, b) => b[0].length - a[0].length,
);

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/'/g, " ");
}

export function inferRegionFromFeedUrl(feedUrl: string): Region | undefined {
  const m = feedUrl.match(/ansa\.it\/([a-z0-9-]+)\/notizie\//i);
  if (!m?.[1]) return undefined;
  return SLUG_TO_REGION[m[1]];
}

export function findComuneInText(text: string): string | undefined {
  const fromCapoluoghi = findCapoluogoInText(text);
  if (fromCapoluoghi) return fromCapoluoghi;
  const norm = normalizeForMatch(text);
  for (const [name] of COMUNE_SORTED) {
    const n = normalizeForMatch(name);
    if (n.length >= 4 && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(norm)) {
      return name;
    }
  }
  return undefined;
}

export function findProvinceInText(text: string): Region | undefined {
  const norm = normalizeForMatch(text);
  for (const [prov, region] of PROVINCE_SORTED) {
    const p = normalizeForMatch(prov);
    if (
      norm.includes(`provincia di ${p}`) ||
      norm.includes(`provincia ${p}`) ||
      norm.includes(`(${p})`)
    ) {
      return region;
    }
  }
  return undefined;
}

export function findRegionInText(text: string): Region | undefined {
  const norm = normalizeForMatch(text);
  for (const r of REGIONS) {
    if (norm.includes(normalizeForMatch(r))) return r;
  }
  const fromProv = findProvinceInText(text);
  if (fromProv) return fromProv;
  const comune = findComuneInText(text);
  if (comune) {
    const hit = GEO_COMUNI.find(([n]) => n === comune);
    if (hit) return hit[1];
  }
  return undefined;
}

export function resolveGeoFromNews(
  titolo: string,
  snippet: string,
  feedUrl: string,
): {
  suggestedRegion?: Region;
  suggestedComune?: string;
  suggestedRole?: CaricaLocale;
} {
  const blob = `${titolo} ${snippet}`;
  const fromFeed = inferRegionFromFeedUrl(feedUrl);
  const suggestedComune = findComuneInText(blob);
  const regionFromComune = suggestedComune
    ? (regioneForComune(suggestedComune) ??
      GEO_COMUNI.find(([n]) => n === suggestedComune)?.[1])
    : undefined;
  const suggestedRegion =
    regionFromComune ?? fromFeed ?? findRegionInText(blob);
  const suggestedRole = detectInstitutionalRole(blob);
  return { suggestedRegion, suggestedComune, suggestedRole };
}

export function detectInstitutionalRole(text: string): CaricaLocale | undefined {
  const lower = normalizeForMatch(text);
  if (
    /\bdeputat[oa]\b/.test(lower) ||
    /\bonorevole\b/.test(lower) ||
    /\bparlamentare\b/.test(lower)
  ) {
    return "dep";
  }
  if (
    /\bconsiglier[ea]\s+regionale\b/.test(lower) ||
    /\bconsiglio\s+regionale\b/.test(lower) ||
    /\bassessor[ea]\s+regionale\b/.test(lower)
  ) {
    return "creg";
  }
  if (
    (/\bsindac[oa]\b/.test(lower) || /\bsindaci\b/.test(lower)) &&
    !/\bsindacat/i.test(lower) &&
    !/\bsindacalist/i.test(lower)
  ) {
    return "sind";
  }
  if (/\bgiunta\b/.test(lower)) {
    return "sind";
  }
  if (
    /\bconsiglier[ea]\s+comunal[e]?\b/.test(lower) ||
    /\bconsiglio\s+comunale\b/.test(lower) ||
    /\bassessor[ea]\b/.test(lower)
  ) {
    return "com";
  }
  return undefined;
}
