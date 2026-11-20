import { peekTavilyDaily, runTavilyDaily } from "@/lib/cache/tavilyDailyGate";
import { REGIONS, type Region } from "@/lib/engine/constants";
import { findCapoluogoInText, regioneForComune } from "@/lib/engine/capoluoghiToRegione";
import { findRegionInText } from "@/lib/engine/italianGeoLookup";
import { matchExactBipSubDossier } from "@/lib/engine/bipSubDossierMatch";
import { tavilySearchRaw, type TavilyRawResult } from "@/lib/engine/tavilyClient";
import { extractCommentIntel } from "./viralCommentIntel";
import {
  inferDistressPillar,
  isPartySelfReferential,
} from "./viralDistressPillars";
import {
  computeViralScore,
  finalizeMetrics,
  formatViralCount,
  parseViralMetricsFromText,
} from "./viralMetricsParser";
import { viralNationalBatchQueries } from "./viralRegionQueries";
import { memoProcessedViralItems } from "./viralVideosCache";
import { buildViralFallbackCatalog } from "./viralVideosFallback";
import { buildVannacciStitchScript } from "./viralVannacciScript";
import {
  cleanSocialText,
  containsBlockedEnglish,
  isUsableItalianText,
  shortItalianContext,
  shortItalianHeadline,
} from "./viralTextSanitize";
import type {
  ViralPlatform,
  ViralReelsPayload,
  ViralVideoItem,
  ViralVideoScope,
} from "./viralVideoTypes";

const TIKTOK_OEMBED = "https://www.tiktok.com/oembed";

/** Chiave del gate giornaliero: un solo batch per tutta Italia, le regioni filtrano da lì. */
export const VIRAL_REELS_SCOPE_KEY = "viral-reels-italia";

const SOCIAL_DOMAINS = [
  "tiktok.com",
  "instagram.com",
  "youtube.com",
  "www.tiktok.com",
  "www.instagram.com",
  "www.youtube.com",
];
/** Tavily addebita per chiamata, non per risultato: ogni chiamata chiede il massimo. */
const RESULTS_PER_CALL = 20;
/** Tiene leggero il salvataggio su file/Postgres; metriche e commenti stanno in testa alla pagina. */
const RAW_CONTENT_MAX_CHARS = 6_000;
const OEMBED_CONCURRENCY = 4;
const MAX_ITEMS_PER_SCOPE = 12;

type TavilyRawHit = {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string;
  score?: number;
};

/** Risposte Tavily grezze della scansione del giorno, salvate dal gate. */
export type ViralNationalBatch = {
  hits: TavilyRawHit[];
  queryCount: number;
  errors: string[];
};

function detectPlatform(url: string): ViralPlatform | null {
  const u = url.toLowerCase();
  if (u.includes("tiktok.com") || u.includes("vm.tiktok.com")) return "tiktok";
  if (u.includes("instagram.com") && (u.includes("/reel") || u.includes("/reels"))) {
    return "instagram";
  }
  if (u.includes("youtube.com/shorts") || u.includes("youtu.be")) return "youtube_shorts";
  if (u.includes("instagram.com")) return "instagram";
  return null;
}

function isEmailLike(handle: string): boolean {
  return /@(gmail|yahoo|hotmail|outlook|icloud|libero|proton)\./i.test(handle) ||
    /@.+\.(com|it|net|org)$/i.test(handle);
}

const ITALIAN_HANDLE_STOPWORDS =
  /^(quando|quanto|quale|quali|dove|come|perche|perché|dopo|prima|mentre|anche|solo|tutti|tutte|questo|questa|in|un|il|lo|la|con|per|chi|che|non)$/i;

function isValidHandle(handle: string): boolean {
  if (!handle.startsWith("@")) return false;
  const body = handle.slice(1);
  if (body.length < 3 || body.length > 30) return false;
  if (/^(autore|user|utente|admin|null|undefined|gmail|yahoo|hotmail|outlook|icloud|libero|proton)$/i.test(body)) {
    return false;
  }
  if (ITALIAN_HANDLE_STOPWORDS.test(body)) return false;
  if (isEmailLike(handle)) return false;
  if (!/^[a-zA-Z][a-zA-Z0-9._]*$/.test(body)) return false;
  return true;
}

function slugHandle(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24);
  return slug.length >= 2 ? `@${slug}` : "@cronaca.territorio";
}

/** Handle reale da URL / titolo / testata — mai @autore o email. */
export function extractHandle(url: string, text: string, authorName?: string | null): string {
  const tt = url.match(/(?:www\.)?tiktok\.com\/@([^/?]+)/i)?.[1];
  if (tt && isValidHandle(`@${tt}`)) return `@${tt}`;

  const ig = url.match(/instagram\.com\/([^/?]+)/i)?.[1];
  if (
    ig &&
    !["reel", "reels", "p", "tv", "stories", "explore"].includes(ig.toLowerCase()) &&
    isValidHandle(`@${ig}`)
  ) {
    return `@${ig}`;
  }

  const yt = url.match(/youtube\.com\/@([^/?]+)/i)?.[1];
  if (yt && isValidHandle(`@${yt}`)) return `@${yt}`;

  if (authorName?.trim()) {
    const h = slugHandle(authorName.trim());
    if (isValidHandle(h)) return h;
  }

  // Handle esplicito nel testo (solo @username reali, mai prima parola della frase)
  const handles = [...text.matchAll(/(?:^|[\s(])@([a-zA-Z][a-zA-Z0-9._]{2,23})\b/g)];
  for (const m of handles) {
    const h = `@${m[1]}`;
    if (isValidHandle(h)) return h;
  }

  // Testata / titolo utile
  const outlet = text.match(
    /\b(Ansa|Tgcom|Fanpage|Open|Il\s*Giornale|Libero|La\s*Verit[aà]|Sky\s*Tg24|RaiNews)\b/i,
  );
  if (outlet?.[1]) return slugHandle(outlet[1].replace(/\s+/g, ""));

  const place = findCapoluogoInText(text) || findRegionInText(text);
  if (place) return slugHandle(`cronaca.${place}`);

  return "@cronaca.territorio";
}

/** Preferisce il capitolo B.I.P. del filone disagio su match generici Famiglia/Mutuo. */
export function resolveViralBipRefs(
  pillar: ReturnType<typeof inferDistressPillar>,
  title: string,
  raw: string,
): { bipCapRef: string; bipLever: string; pressHook: string } {
  const dossier = matchExactBipSubDossier(
    title,
    cleanSocialText(raw).slice(0, 800),
    pillar.category,
  );

  if (pillar.id === "DISABILITA") {
    const san = matchExactBipSubDossier(title, raw, "SANITA");
    const useSan =
      /disabil|caregiver|104|invalid|non\s*autosuffic|palliativ/i.test(
        `${title} ${raw} ${san.capRef}`,
      ) || san.id === "BIP_SAN_01";
    return {
      bipCapRef: useSan ? san.capRef : pillar.bipCapRef,
      bipLever: useSan ? san.bipReference : pillar.bipCapRef,
      pressHook: useSan ? san.pressDeclaration : pillar.bipHook,
    };
  }

  if (pillar.id === "TASSE_PIVA") {
    const fisco = matchExactBipSubDossier(title, raw, "LAVORO");
    const useFisco =
      /f24|partita\s*iva|p\.?\s*iva|saldo|artigian|commerciant|tasse|fisco|accont|flat\s*tax|contante/i.test(
        `${title} ${raw}`,
      ) || /Saldo-Acconto|Fisco|P\.IVA/i.test(fisco.capRef);
    return {
      bipCapRef: useFisco ? fisco.capRef : pillar.bipCapRef,
      bipLever: useFisco ? fisco.bipReference : pillar.bipCapRef,
      pressHook: useFisco ? fisco.pressDeclaration : pillar.bipHook,
    };
  }

  return {
    bipCapRef: dossier.capRef || pillar.bipCapRef,
    bipLever: dossier.bipReference || pillar.bipCapRef,
    pressHook: dossier.pressDeclaration || pillar.bipHook,
  };
}

function cleanTitle(title: string, raw: string): string | null {
  let t = cleanSocialText(title);
  if (/^(instagram|tiktok|youtube|reel|shorts?)$/i.test(t)) return null;
  if (containsBlockedEnglish(t)) return null;
  if (t.length < 8) {
    const fromRaw = cleanSocialText(raw)
      .split(/\n+/)
      .map((l) => l.trim())
      .find((l) => isUsableItalianText(l));
    if (!fromRaw) return null;
    t = fromRaw;
  }
  if (containsBlockedEnglish(t)) return null;
  if (!isUsableItalianText(t) && !/disabil|f24|ospedale|mutuo|stazione|cassa|ztl|artigian/i.test(t)) {
    return null;
  }
  return shortItalianHeadline(t, 115);
}

function cleanDescription(raw: string, title: string): string {
  const body = cleanSocialText(raw);
  if (!body || containsBlockedEnglish(body)) {
    return shortItalianContext(title, 160);
  }
  const lines = body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => isUsableItalianText(l));
  const pick = lines[0] ?? (isUsableItalianText(body) ? body : title);
  return shortItalianContext(pick, 160);
}

function isJunkHit(title: string, url: string, raw: string): boolean {
  const t = cleanSocialText(title);
  const blob = cleanSocialText(`${title} ${raw}`);
  if (isPartySelfReferential(`${title} ${raw} ${url}`)) return true;
  if (/^(instagram|tiktok|youtube)$/i.test(t)) return true;
  if (containsBlockedEnglish(t) || containsBlockedEnglish(blob.slice(0, 400))) {
    if (!isUsableItalianText(blob)) return true;
  }
  if (/instagram\.com\/[^/]+\/?$/i.test(url) && !/\/reel/i.test(url)) {
    if (!/video|reel|shorts/i.test(`${t} ${raw}`)) return true;
  }
  if (/profile\s+picture/i.test(t) && t.length < 60) return true;
  if (/log\s*in\s*to\s*instagram|sign\s*up\s*for\s*tiktok/i.test(`${t} ${raw}`)) return true;
  return false;
}

function classifyRegion(
  scope: ViralVideoScope,
  title: string,
  content: string,
): { regione: ViralVideoScope; locality: string } {
  const blob = `${title} ${content}`;
  const capoluogo = findCapoluogoInText(blob);
  if (capoluogo) {
    const reg = regioneForComune(capoluogo);
    if (reg) return { regione: reg, locality: `${capoluogo} · ${reg}` };
  }
  const fromText = findRegionInText(blob);
  if (fromText) return { regione: fromText, locality: fromText };
  if (scope === "NAZIONALE") {
    return { regione: "NAZIONALE", locality: "Italia · Quadro Nazionale" };
  }
  return { regione: scope, locality: scope };
}

function hashId(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
  return `viral-${Math.abs(h).toString(36)}`;
}

function socialSearchBody(query: string) {
  return {
    query,
    search_depth: "advanced",
    include_raw_content: true,
    max_results: RESULTS_PER_CALL,
    topic: "general",
    language: "it",
    include_domains: SOCIAL_DOMAINS,
  };
}

function pressSearchBody(query: string) {
  return {
    query,
    search_depth: "advanced",
    include_raw_content: true,
    max_results: RESULTS_PER_CALL,
    topic: "news",
    language: "it",
    time_range: "month",
  };
}

function compactHit(hit: TavilyRawResult): TavilyRawHit {
  return {
    title: hit.title,
    url: hit.url,
    content: hit.content,
    raw_content: hit.raw_content ? hit.raw_content.slice(0, RAW_CONTENT_MAX_CHARS) : undefined,
    score: hit.score,
  };
}

/** Le 3 chiamate del giorno (2 social + 1 stampa). Fallisce solo se falliscono tutte. */
async function fetchNationalViralBatch(fetchImpl: typeof fetch): Promise<ViralNationalBatch> {
  const q = viralNationalBatchQueries();
  const settled = await Promise.allSettled([
    tavilySearchRaw(socialSearchBody(q.socialA), fetchImpl),
    tavilySearchRaw(socialSearchBody(q.socialB), fetchImpl),
    tavilySearchRaw(pressSearchBody(q.press), fetchImpl),
  ]);
  const errors = settled.flatMap((r) =>
    r.status === "rejected"
      ? [r.reason instanceof Error ? r.reason.message : "Errore Tavily viral"]
      : [],
  );
  if (errors.length === settled.length) throw new Error(errors[0]);
  return {
    hits: settled.flatMap((r) => (r.status === "fulfilled" ? r.value.results.map(compactHit) : [])),
    queryCount: settled.length,
    errors,
  };
}

type OembedPayload = {
  author_name?: string;
  title?: string;
  thumbnail_url?: string;
  author_url?: string;
};

async function enrichTikTokOembed(
  url: string,
  fetchImpl: typeof fetch,
): Promise<OembedPayload | null> {
  try {
    const res = await fetchImpl(`${TIKTOK_OEMBED}?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as OembedPayload;
  } catch {
    return null;
  }
}

function hitLooksViralSocial(hit: TavilyRawHit): boolean {
  const url = (hit.url ?? "").toLowerCase();
  const blob = `${hit.title ?? ""} ${hit.content ?? ""} ${hit.raw_content ?? ""}`.toLowerCase();
  if (detectPlatform(url)) return true;
  return /tiktok|instagram\.com\/reel|youtube\.com\/shorts|video virale|reel virale/.test(
    `${url} ${blob}`,
  );
}

/** Per una regione: prima i video localizzati lì, poi quelli nazionali. */
function pickForScope(items: ViralVideoItem[], scope: ViralVideoScope): ViralVideoItem[] {
  if (scope === "NAZIONALE") return items.slice(0, MAX_ITEMS_PER_SCOPE);
  const local = items.filter((item) => item.regione === scope);
  const national = items.filter((item) => item.regione === "NAZIONALE");
  return [...local, ...national].slice(0, MAX_ITEMS_PER_SCOPE);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function mapHitToItem(
  hit: TavilyRawHit,
  scope: ViralVideoScope,
  fetchImpl: typeof fetch,
): Promise<ViralVideoItem | null> {
  const url = (hit.url ?? "").trim();
  const titleRaw = (hit.title ?? "").trim();
  if (!url || !titleRaw) return null;
  if (!hitLooksViralSocial(hit)) return null;

  const raw = `${hit.content ?? ""}\n${hit.raw_content ?? ""}`;
  if (isJunkHit(titleRaw, url, raw)) return null;

  const cleanedTitle = cleanTitle(titleRaw, raw);
  if (!cleanedTitle) return null;

  let platform = detectPlatform(url);
  if (!platform) {
    if (/tiktok/i.test(`${cleanedTitle} ${raw}`)) platform = "tiktok";
    else if (/instagram|reel/i.test(`${cleanedTitle} ${raw}`)) platform = "instagram";
    else if (/youtube|shorts/i.test(`${cleanedTitle} ${raw}`)) platform = "youtube_shorts";
    else platform = "tiktok";
  }

  const { regione, locality } = classifyRegion(scope, cleanedTitle, raw);
  const pillar = inferDistressPillar(`${cleanedTitle} ${raw}`);
  const category = pillar.category;
  const bip = resolveViralBipRefs(pillar, cleanedTitle, raw);

  let authorName: string | null = null;
  let thumbnailUrl: string | null = null;
  let enrichedTitle = cleanedTitle;
  let source: ViralVideoItem["source"] = "tavily";

  if (platform === "tiktok" && /tiktok\.com/i.test(url)) {
    const oembed = await enrichTikTokOembed(url, fetchImpl);
    if (oembed) {
      authorName = oembed.author_name ?? null;
      thumbnailUrl = oembed.thumbnail_url ?? null;
      const oTitle = cleanSocialText(oembed.title?.trim() ?? "");
      if (
        oTitle &&
        !/^(tiktok|instagram)$/i.test(oTitle) &&
        !containsBlockedEnglish(oTitle) &&
        isUsableItalianText(oTitle) &&
        !isPartySelfReferential(oTitle)
      ) {
        enrichedTitle = shortItalianHeadline(oTitle, 115);
      }
      source = "oembed";
    }
  }

  if (containsBlockedEnglish(enrichedTitle) || isPartySelfReferential(enrichedTitle)) {
    return null;
  }

  const handle = extractHandle(url, `${authorName ?? ""} ${raw} ${enrichedTitle}`, authorName);
  if (/futuronazionale|futuro\.nazionale/i.test(handle)) return null;

  const parsed = parseViralMetricsFromText(
    enrichedTitle,
    cleanSocialText(hit.content ?? ""),
    cleanSocialText(hit.raw_content ?? ""),
  );
  const metrics = finalizeMetrics(parsed, {
    viralScoreHint: Math.round((hit.score ?? 0.5) * 100),
    title: enrichedTitle,
    url,
  });
  const viralScore = computeViralScore({
    viewsCount: metrics.viewsCount,
    likesCount: metrics.likesCount,
    commentsCount: metrics.commentsCount,
    tavilyScore: hit.score,
    salt: url,
  });

  const description = cleanDescription(raw, enrichedTitle);
  const commentIntel = extractCommentIntel(raw, category, locality, description);
  if (containsBlockedEnglish(commentIntel.topUserComment)) return null;

  const scriptRispostaVideo = buildVannacciStitchScript({
    locality,
    title: enrichedTitle,
    pillar: {
      ...pillar,
      bipHook: bip.pressHook,
      bipCapRef: bip.bipCapRef,
    },
    topUserComment: commentIntel.topUserComment,
    commentSentiment: commentIntel.commentSentiment,
  });

  return {
    id: hashId(url),
    platform,
    url,
    title: enrichedTitle,
    description,
    authorHandle: handle,
    authorName,
    thumbnailUrl,
    locality,
    regione,
    viewsCount: metrics.viewsCount,
    viewsFormatted: formatViralCount(metrics.viewsCount),
    viewsEstimated: metrics.viewsEstimated,
    likesCount: metrics.likesCount,
    likesFormatted: formatViralCount(metrics.likesCount),
    commentsCount: metrics.commentsCount,
    commentsFormatted: formatViralCount(metrics.commentsCount),
    viralScore,
    bipLever: bip.bipLever,
    bipCapRef: bip.bipCapRef,
    scriptRispostaVideo,
    category,
    distressPillarId: pillar.id,
    distressLabel: pillar.label,
    source,
    ...commentIntel,
  };
}

export function normalizeViralScope(raw: string | null | undefined): ViralVideoScope {
  if (!raw || raw === "NAZIONALE" || raw === "Italia" || /tutta\s*l['']italia/i.test(raw)) {
    return "NAZIONALE";
  }
  if ((REGIONS as readonly string[]).includes(raw)) return raw as Region;
  const found = findRegionInText(raw);
  return found ?? "NAZIONALE";
}

/** Video di tutta Italia, ordinati per viralità; le regioni vengono dal testo. */
async function buildNationalItems(
  batch: ViralNationalBatch,
  fetchImpl: typeof fetch,
): Promise<ViralVideoItem[]> {
  const seen = new Set<string>();
  const unique = batch.hits.filter((hit) => {
    const url = (hit.url ?? "").trim();
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
  const mapped = await mapWithConcurrency(unique, OEMBED_CONCURRENCY, (hit) =>
    mapHitToItem(hit, "NAZIONALE", fetchImpl).catch(() => null),
  );
  return mapped
    .filter((item): item is ViralVideoItem => item != null)
    .sort((a, b) => b.viralScore - a.viralScore);
}

export type ResolveViralReelsOptions = {
  fetchImpl?: typeof fetch;
  /** `cache-only`: ultima scansione salvata (anche di ieri), senza mai chiamare Tavily. */
  mode?: "daily" | "cache-only";
  force?: boolean;
  forceSecret?: string | null;
};

export async function resolveViralReels(
  regionParam: string | null | undefined,
  options: ResolveViralReelsOptions = {},
): Promise<Omit<ViralReelsPayload, "cacheHit">> {
  const scope = normalizeViralScope(regionParam);
  const fetchImpl = options.fetchImpl ?? fetch;
  const { data, meta } =
    options.mode === "cache-only"
      ? await peekTavilyDaily<ViralNationalBatch>(VIRAL_REELS_SCOPE_KEY)
      : await runTavilyDaily<ViralNationalBatch>({
          scopeKey: VIRAL_REELS_SCOPE_KEY,
          force: options.force,
          forceSecret: options.forceSecret,
          fetcher: () => fetchNationalViralBatch(fetchImpl),
        });

  const national =
    data && meta.fetchedAt
      ? await memoProcessedViralItems(meta.fetchedAt, () => buildNationalItems(data, fetchImpl))
      : [];

  let items = pickForScope(national, scope);
  let source: ViralReelsPayload["source"] = "tavily";
  if (items.length === 0) {
    items = buildViralFallbackCatalog(scope).slice(0, MAX_ITEMS_PER_SCOPE);
    source = "fallback";
  } else if (meta.error || (data?.errors.length ?? 0) > 0) {
    source = "mixed";
  }

  return {
    region: scope,
    items,
    fetchedAt: meta.fetchedAt ?? new Date().toISOString(),
    source,
    queryCount: meta.status === "live" ? (data?.queryCount ?? 0) : 0,
    error: meta.error ?? data?.errors[0],
    tavily: meta,
  };
}
