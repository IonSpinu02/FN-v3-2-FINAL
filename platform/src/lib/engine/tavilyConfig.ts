/** Domini editoriali italiani (preferiti, non certificazione giuridica). */
export const TAVILY_DEFAULT_TRUSTED_DOMAINS = [
  "ansa.it",
  "agi.it",
  "repubblica.it",
  "ilsole24ore.com",
  "rainews.it",
  "adnkronos.com",
  "quotidiano.net",
  "corriere.it",
  "ilfattoquotidiano.it",
  "sky.it",
  "tg24.sky.it",
  "youtrend.it",
] as const;

export function tavilyApiKey(): string | null {
  const key = process.env.TAVILY_API_KEY?.trim();
  return key || null;
}

/**
 * Default on quando la chiave è presente. Imposta `TAVILY_ENABLED=false` per disattivare.
 * Le fonti RSS gratuite restano sempre attive; Tavily passa solo dal gate giornaliero
 * (`@/lib/cache/tavilyDailyGate`).
 */
export function isTavilyEnabled(): boolean {
  if (process.env.TAVILY_ENABLED === "false") return false;
  return tavilyApiKey() != null;
}

export function parseTavilyDomainList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [...TAVILY_DEFAULT_TRUSTED_DOMAINS];
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, ""))
    .filter(Boolean);
}

export function tavilyMaxResultsPerQuery(): number {
  const n = parseInt(process.env.TAVILY_MAX_RESULTS ?? "8", 10);
  return Math.max(3, Math.min(15, Number.isFinite(n) ? n : 8));
}
