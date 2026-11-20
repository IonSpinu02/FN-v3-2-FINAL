import { cacheUsesProcessMemory } from "@/lib/cache/cachePolicy";
import {
  readDomainCacheEntry,
  writeDomainCacheEntry,
} from "@/lib/db/domainCacheRepository";
import type { PollRelease } from "./pollTypes";

const ARCHIVE_URL = "https://supermedia.youtrend.it/sondaggi/";

const IT_MONTH: Record<string, string> = {
  GEN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAG: "05",
  GIU: "06",
  LUG: "07",
  AGO: "08",
  SET: "09",
  OTT: "10",
  NOV: "11",
  DIC: "12",
};

export function parseItalianArchiveDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!m) return null;
  const month = IT_MONTH[m[2]!.toUpperCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1]!.padStart(2, "0")}`;
}

/** Card dell’archivio Supermedia → una rilevazione FN per istituto. */
export function parseYouTrendPollArchive(html: string): PollRelease[] {
  const releases: PollRelease[] = [];
  const articles = html.split("<article").slice(1);

  for (const block of articles) {
    const institute = block.match(/<h3[^>]*>([^<]+)<\/h3>/)?.[1]?.trim();
    if (!institute) continue;
    const campo = block.match(/Campo:[\s\S]{0,80}?(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/)?.[1];
    const pubblicato = block.match(
      /Pubblicato:[\s\S]{0,80}?(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/,
    )?.[1];
    const fieldEnd = parseItalianArchiveDate(campo ?? pubblicato ?? "");
    const publishedAt = parseItalianArchiveDate(pubblicato ?? campo ?? "");
    if (!fieldEnd || !publishedAt) continue;

    const sample = block.match(/n=(\d+)/)?.[1];
    const parties = [
      ...block.matchAll(
        /<span class="truncate">([^<]+)<\/span>[\s\S]*?<strong[^>]*>([\d]+,[\d]+)%</g,
      ),
    ];
    const fn = parties.find((row) => /futuro nazionale/i.test(row[1] ?? ""));
    if (!fn?.[2]) continue;
    const fnPct = Number(fn[2].replace(",", "."));
    if (!Number.isFinite(fnPct)) continue;

    releases.push({
      id: `${institute.toLowerCase().replace(/\s+/g, "-")}-${fieldEnd}`,
      institute,
      fieldEnd,
      publishedAt,
      fnPct,
      sampleSize: sample ? Number(sample) : undefined,
      method: "unknown",
      sourceUrl: ARCHIVE_URL,
    });
  }

  return releases;
}

const DOMAIN_CACHE_KEY = "consenso:youtrend:archive";
const ARCHIVE_TTL_MS = 15 * 60 * 1000;

type ArchiveCacheEntry = { at: number; releases: PollRelease[] };

let archiveCache: ArchiveCacheEntry | null = null;

async function readArchiveCache(now: number): Promise<PollRelease[] | null> {
  if (cacheUsesProcessMemory() && archiveCache && now - archiveCache.at < ARCHIVE_TTL_MS) {
    return archiveCache.releases;
  }
  const row = await readDomainCacheEntry<ArchiveCacheEntry>(DOMAIN_CACHE_KEY);
  if (!row?.payload || now - row.payload.at >= ARCHIVE_TTL_MS) return null;
  if (cacheUsesProcessMemory()) archiveCache = row.payload;
  return row.payload.releases;
}

function archiveAuthHeader(): Record<string, string> {
  const user = process.env.YOUTREND_ARCHIVE_USER?.trim();
  const pass = process.env.YOUTREND_ARCHIVE_PASS?.trim();
  if (!user || !pass) return {};
  const token = Buffer.from(`${user}:${pass}`, "utf8").toString("base64");
  return { Authorization: `Basic ${token}` };
}

export async function fetchYouTrendPollArchive(options?: {
  force?: boolean;
  now?: number;
}): Promise<PollRelease[]> {
  const now = options?.now ?? Date.now();
  if (!options?.force) {
    const hit = await readArchiveCache(now);
    if (hit) return hit;
  }
  const res = await fetch(ARCHIVE_URL, {
    headers: {
      "User-Agent": "FN-Platform-ConsensoSync/1.0",
      ...archiveAuthHeader(),
    },
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`Archivio sondaggi HTTP ${res.status}`);
  const releases = parseYouTrendPollArchive(await res.text());
  const entry: ArchiveCacheEntry = { at: now, releases };
  if (cacheUsesProcessMemory()) archiveCache = entry;
  await writeDomainCacheEntry({
    key: DOMAIN_CACHE_KEY,
    payload: entry,
    computedAt: now,
    expiresAt: now + ARCHIVE_TTL_MS,
    etag: null,
    sourceStatus: null,
  });
  return releases;
}

export function clearYouTrendPollArchiveCacheForTests(): void {
  archiveCache = null;
}
