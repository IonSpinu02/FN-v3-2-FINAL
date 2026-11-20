import { cacheUsesProcessMemory } from "@/lib/cache/cachePolicy";
import {
  readDomainCacheEntry,
  writeDomainCacheEntry,
} from "@/lib/db/domainCacheRepository";
import type { PollRelease } from "./pollTypes";

const POLLYTICO_URL = "https://pollytico.it/sondaggi";

const IT_MONTH_SHORT: Record<string, string> = {
  gen: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  mag: "05",
  giu: "06",
  lug: "07",
  ago: "08",
  set: "09",
  ott: "10",
  nov: "11",
  dic: "12",
};

/** «10 nov» / «30 ott» → ISO (anno di riferimento = anno corrente UTC se omesso). */
export function parsePollyticoShortDate(
  raw: string,
  refYear = new Date().getUTCFullYear(),
): string | null {
  const m = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})$/);
  if (!m) return null;
  const month = IT_MONTH_SHORT[m[2]!.toLowerCase()];
  if (!month) return null;
  return `${refYear}-${month}-${m[1]!.padStart(2, "0")}`;
}

function instituteSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bistituto\b/g, " ")
    .replace(/\bs\.?r\.?l\.?\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function displayInstitute(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (/^istituto\s+piepoli$/i.test(trimmed)) return "Piepoli";
  if (/^lab21/i.test(trimmed)) return "LAB21";
  if (/^bidimedia/i.test(trimmed)) return "BiDiMedia";
  return trimmed;
}

/** Card Pollytico → rilevazioni FN (esclude Supermedia e aggregati). */
export function parsePollyticoPolls(
  html: string,
  options?: { refYear?: number },
): PollRelease[] {
  const refYear = options?.refYear ?? new Date().getUTCFullYear();
  const blocks = html
    .split(/<span style="font-weight:700; font-size:14px;">/)
    .slice(1);
  const releases: PollRelease[] = [];

  for (const block of blocks) {
    const instituteRaw = block.match(/^([^<]+)</)?.[1]?.trim();
    if (!instituteRaw) continue;
    if (/supermedia/i.test(instituteRaw)) continue;

    const dateRaw = block.match(/color:#8a8880;">([^<]+)</)?.[1]?.trim();
    if (!dateRaw) continue;
    const iso = parsePollyticoShortDate(dateRaw, refYear);
    if (!iso) continue;

    const fnMatch = block.match(
      />FN<\/span>\s*<span[^>]*>\s*([\d]+(?:[.,][\d]+)?)\s*%/i,
    );
    if (!fnMatch?.[1]) continue;
    const fnPct = Number(fnMatch[1].replace(",", "."));
    if (!Number.isFinite(fnPct) || fnPct <= 0 || fnPct > 100) continue;

    const institute = displayInstitute(instituteRaw);
    const slug = instituteSlug(institute);
    if (!slug) continue;

    releases.push({
      id: `${slug}-${iso}`,
      institute,
      fieldEnd: iso,
      publishedAt: iso,
      fnPct,
      method: "unknown",
      sourceUrl: POLLYTICO_URL,
    });
  }

  return releases;
}

const DOMAIN_CACHE_KEY = "consenso:pollytico:archive";
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

export async function fetchPollyticoPollArchive(options?: {
  force?: boolean;
  now?: number;
  refYear?: number;
}): Promise<PollRelease[]> {
  const now = options?.now ?? Date.now();
  if (!options?.force) {
    const hit = await readArchiveCache(now);
    if (hit) return hit;
  }
  const res = await fetch(POLLYTICO_URL, {
    headers: { "User-Agent": "FN-Platform-ConsensoSync/1.0" },
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`Pollytico sondaggi HTTP ${res.status}`);
  const releases = parsePollyticoPolls(await res.text(), {
    refYear: options?.refYear,
  });
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

export function clearPollyticoPollArchiveCacheForTests(): void {
  archiveCache = null;
}
