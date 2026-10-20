"use client";

import { applyEventToEntry } from "@/lib/engine/localInstitutions";
import { analyzeInstitutionalArticle } from "@/lib/engine/newsInstitutionalAnalyzer";
import {
  NEWS_RSS_REFRESH_INTERVAL_MS,
  type NewsScanMeta,
} from "@/lib/engine/newsScanCache";
import { CIRC, REGIONS, type Region } from "@/lib/engine/constants";
import type {
  CaricaLocale,
  LocalRegistryEntry,
  NewsCandidate,
} from "@/lib/engine/localiTypes";
import {
  caricaBadgeClass,
  caricaLabel,
  type BroadsheetArticle,
} from "@/components/newsBroadsheetData";
import {
  RssTelemetryScannerHUD,
  RSS_SCAN_MIN_MS,
} from "@/components/TypeflowNewspaperStage";
import {
  articleDisplaySource,
  cleanArticleSummary,
  escapeRegExp,
  formatDispaccioWireDate,
  hasInstitutionalNewsSignals,
  isElectionOrSeggiNews,
  isNewsJunk,
  matchesSearchQuery,
  passesClientNewsFilter,
  regionFromComuneName,
  resolveBroadsheetGeo,
} from "@/lib/newsArticleFormat";
import { Btn } from "@/components/ui/FnUi";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function ArticleFullReader({
  article,
  highlightOpts,
}: {
  article: BroadsheetArticle;
  highlightOpts: HighlightOpts;
}) {
  const [loading, setLoading] = useState(false);
  const [remoteBody, setRemoteBody] = useState<string | null>(null);
  const [remoteTitle, setRemoteTitle] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fallbackBody = cleanArticleSummary(article.sommario);

  useEffect(() => {
    if (!isHttpUrl(article.link)) {
      setRemoteBody(null);
      setFetchError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    setRemoteBody(null);
    fetch(`/api/news/read?url=${encodeURIComponent(article.link)}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          body?: string;
          title?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Lettura non disponibile");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setRemoteBody(data.body?.trim() || null);
        setRemoteTitle(data.title?.trim() || null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setFetchError(
          e instanceof Error ? e.message : "Impossibile caricare il testo",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [article.id, article.link]);

  const displayBody =
    remoteBody && remoteBody.length > fallbackBody.length
      ? remoteBody
      : fallbackBody;
  const displayTitle = remoteTitle || article.titolo;

  return (
    <div className="mt-3 rounded-lg border border-[#1B2436] bg-[#0C101A]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1B2436] px-3 py-2">
        <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
          Lettura completa // dispaccio
        </p>
        {loading ? (
          <span className="font-mono text-[9px] text-amber-300">
            Acquisizione testo…
          </span>
        ) : null}
      </div>
      <div className="max-h-[min(58vh,520px)] overflow-y-auto px-4 py-3">
        <h3 className="text-base font-semibold leading-snug text-white">
          {highlightTextDark(displayTitle, highlightOpts)}
        </h3>
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
          {highlightTextDark(displayBody, highlightOpts)}
        </div>
        {fetchError ? (
          <p className="mt-3 font-mono text-[9px] text-slate-500">
            Estrazione remota non riuscita ({fetchError}). Testo da feed RSS /
            seed sotto.
          </p>
        ) : null}
      </div>
      {isHttpUrl(article.link) ? (
        <div className="border-t border-[#1B2436] px-3 py-2">
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-emerald-400 hover:underline"
          >
            [ Apri articolo sulla testata ↗ ]
          </a>
        </div>
      ) : null}
    </div>
  );
}

type CircFilter = "ALL" | "NO" | "NE" | "C" | "S" | "I";

const CIRC_LABELS: Record<CircFilter, string> = {
  ALL: "TUTTE",
  NO: "NORD-OVEST",
  NE: "NORD-EST",
  C: "CENTRO",
  S: "SUD",
  I: "ISOLE",
};

const ROLE_PILL: Record<string, CaricaLocale | "ALL"> = {
  "TUTTE LE CARICHE": "ALL",
  SINDACI: "sind",
  "CONS. REGIONALI": "creg",
  "CONS. COMUNALI": "com",
  DEPUTATI: "dep",
};

function regionInCirc(region: Region, circ: CircFilter): boolean {
  if (circ === "ALL") return true;
  return (CIRC[circ] as readonly Region[]).includes(region);
}

function certifyBroadsheet(b: BroadsheetArticle): BroadsheetArticle {
  const analyzed = analyzeInstitutionalArticle({
    titolo: b.titolo,
    snippet: b.sommario,
    feedUrl: b.link,
    sourceLabel: b.source,
    feedRegionHint: b.suggestedRegion,
  });
  if (!analyzed) return b;
  return {
    ...b,
    suggestedComune: analyzed.comune || b.suggestedComune,
    suggestedRegion: analyzed.regione,
    suggestedRole: analyzed.role,
    confidenceScore: analyzed.confidenceScore,
    matchedRoleKeyword: analyzed.matchedRoleKeyword,
    matchedGeoKeyword: analyzed.matchedGeoKeyword,
  };
}

function normalizeBroadsheet(b: BroadsheetArticle): BroadsheetArticle {
  const feedSource = b.feedSource ?? b.link ?? b.source;
  const base = {
    ...b,
    feedSource,
    source: articleDisplaySource({ source: b.source, feedSource }),
    sommario: cleanArticleSummary(b.sommario),
  };
  return certifyBroadsheet({
    ...base,
    suggestedComune: base.suggestedComune.trim(),
    suggestedRegion:
      regionFromComuneName(base.suggestedComune.trim()) ?? base.suggestedRegion,
  });
}

function candidateToBroadsheet(c: NewsCandidate): BroadsheetArticle {
  const geo = resolveBroadsheetGeo(c);
  const feedSource = c.feedUrl;
  return normalizeBroadsheet({
    id: c.id,
    source: feedSource,
    feedSource,
    titolo: c.titolo,
    sommario: c.snippet,
    pubDate: c.pubDate ?? new Date().toISOString(),
    suggestedRegion: geo.regione,
    suggestedComune: geo.comune,
    suggestedRole: geo.carica,
    link: c.link,
    confidenceScore: c.confidenceScore,
    matchedRoleKeyword: c.matchedRoleKeyword,
    matchedGeoKeyword: c.matchedGeoKeyword,
  });
}

function shortItDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d
    .toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
    .toUpperCase()
    .replace(".", "");
}

type HighlightOpts = {
  searchQuery: string;
  comune: string;
  regione: string;
};

function highlightTextDark(text: string, opts: HighlightOpts): ReactNode {
  if (!text) return null;
  const spans: { start: number; end: number; kind: "query" | "geo" }[] = [];
  const q = opts.searchQuery.trim();
  const lower = text.toLowerCase();

  if (q.length >= 2) {
    let hay = lower;
    const qLower = q.toLowerCase();
    if (
      qLower === "roma" ||
      (qLower.includes("roma") && !qLower.includes("romagna"))
    ) {
      hay = hay.replace(/emilia-romagna|romagna/gi, " ");
    }
    const tokens = qLower.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const re = new RegExp(
        `(?:^|[^a-zà-ÿ])(${escapeRegExp(token)})`,
        "gi",
      );
      let m: RegExpExecArray | null;
      while ((m = re.exec(hay)) !== null) {
        const start = m.index + (m[0].length - m[1]!.length);
        spans.push({ start, end: start + m[1]!.length, kind: "query" });
      }
    }
  }

  for (const geo of [opts.comune, opts.regione]) {
    if (!geo || geo.length < 2) continue;
    const idx = lower.indexOf(geo.toLowerCase());
    if (idx >= 0) {
      spans.push({ start: idx, end: idx + geo.length, kind: "geo" });
    }
  }

  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: typeof spans = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start < last.end) continue;
    merged.push(s);
  }

  if (!merged.length) return text;

  const out: ReactNode[] = [];
  let cursor = 0;
  merged.forEach((s, i) => {
    if (s.start > cursor) out.push(text.slice(cursor, s.start));
    const chunk = text.slice(s.start, s.end);
    if (s.kind === "query") {
      out.push(
        <span
          key={`q-${i}-${s.start}`}
          className="rounded border border-amber-400/50 bg-amber-400/25 px-1 font-semibold text-amber-200"
        >
          {chunk}
        </span>,
      );
    } else {
      out.push(
        <span
          key={`g-${i}-${s.start}`}
          className="text-emerald-300 underline decoration-emerald-500/60 underline-offset-4"
        >
          {chunk}
        </span>,
      );
    }
    cursor = s.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function Chart09RegionBars({
  articles,
}: {
  articles: BroadsheetArticle[];
}) {
  const counts = useMemo(() => {
    const m = new Map<Region, number>();
    for (const a of articles) {
      m.set(a.suggestedRegion, (m.get(a.suggestedRegion) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [articles]);

  const max = counts[0]?.[1] ?? 1;

  return (
    <svg
      viewBox={`0 0 320 ${Math.max(120, counts.length * 28 + 16)}`}
      className="w-full"
      role="img"
      aria-label="Distribuzione dispacci per regione"
    >
      {counts.map(([region, n], i) => {
        const w = (n / max) * 200;
        const y = 12 + i * 28;
        return (
          <g key={region}>
            <text
              x={0}
              y={y + 12}
              fill="#94A3B8"
              fontSize={10}
              fontFamily="ui-monospace, monospace"
            >
              {region.slice(0, 12)}
            </text>
            <rect
              x={88}
              y={y}
              width={w}
              height={14}
              fill="url(#chart09grad)"
              rx={2}
            />
            <text
              x={294}
              y={y + 12}
              fill="#6EE7B7"
              fontSize={10}
              fontFamily="ui-monospace, monospace"
              textAnchor="end"
            >
              {n}
            </text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="chart09grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function KpiCell({
  code,
  title,
  value,
  sub,
  valueClass = "text-white",
}: {
  code: string;
  title: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="p-4">
      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
        {code} // {title}
      </p>
      <p className={`mt-1 font-mono text-2xl font-bold tabular-nums ${valueClass}`}>
        {value}
      </p>
      <p className="mt-1 font-mono text-[9px] text-slate-500">{sub}</p>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide transition ${
        active
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
          : "border-[#1B2436] bg-[#0C101A] text-slate-400 hover:border-slate-600"
      }`}
    >
      {children}
    </button>
  );
}

export function NewsReviewPanel({
  entries,
  onApplyToRegistry,
}: {
  entries: LocalRegistryEntry[];
  onApplyToRegistry: (entries: LocalRegistryEntry[]) => void;
}) {
  const [liveCandidates, setLiveCandidates] = useState<NewsCandidate[]>([]);
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [scanLog, setScanLog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheLabel, setCacheLabel] = useState<string | null>(null);
  const [scanMeta, setScanMeta] = useState<NewsScanMeta | null>(null);
  const [circFilter, setCircFilter] = useState<CircFilter>("ALL");
  const [regionFilter, setRegionFilter] = useState("Tutte");
  const [roleFilter, setRoleFilter] = useState<string>("TUTTE LE CARICHE");
  const [searchQuery, setSearchQuery] = useState("");
  const [electionFocus, setElectionFocus] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [editRegione, setEditRegione] = useState<Region>("Lazio");
  const [editComune, setEditComune] = useState("Roma");
  const [editCarica, setEditCarica] = useState<CaricaLocale>("sind");
  const inspectorRef = useRef<HTMLDivElement>(null);

  const catalog = useMemo((): BroadsheetArticle[] => {
    return liveCandidates
      .filter((c) => !c.id.startsWith("seed-"))
      .filter((c) =>
        passesClientNewsFilter(c.titolo, c.snippet, c.matchedKeywords),
      )
      .map(candidateToBroadsheet);
  }, [liveCandidates]);

  const allArticles = useMemo(
    () =>
      catalog.filter(
        (a) =>
          !archived.has(a.id) &&
          !isNewsJunk(a.titolo, a.sommario) &&
          hasInstitutionalNewsSignals(a.titolo, a.sommario),
      ),
    [catalog, archived],
  );

  const filteredArticles = useMemo(() => {
    const roleKey = ROLE_PILL[roleFilter] ?? "ALL";
    return allArticles.filter((a) => {
      if (!regionInCirc(a.suggestedRegion, circFilter)) return false;
      if (regionFilter !== "Tutte" && a.suggestedRegion !== regionFilter) {
        return false;
      }
      if (roleKey !== "ALL" && a.suggestedRole !== roleKey) return false;
      if (
        electionFocus &&
        !isElectionOrSeggiNews(a.titolo, a.sommario)
      ) {
        return false;
      }
      return matchesSearchQuery(a, searchQuery);
    });
  }, [
    allArticles,
    circFilter,
    regionFilter,
    roleFilter,
    searchQuery,
    electionFocus,
  ]);

  const selectedArticle =
    filteredArticles.find((a) => a.id === selectedId) ??
    filteredArticles[0] ??
    null;

  useEffect(() => {
    if (!filteredArticles.length) return;
    if (!filteredArticles.some((a) => a.id === selectedId)) {
      setSelectedId(filteredArticles[0]!.id);
    }
  }, [filteredArticles, selectedId]);

  useEffect(() => {
    if (!selectedArticle) return;
    setEditRegione(selectedArticle.suggestedRegion);
    setEditComune(selectedArticle.suggestedComune);
    setEditCarica(selectedArticle.suggestedRole);
  }, [selectedArticle?.id]);

  function selectArticle(a: BroadsheetArticle) {
    setSelectedId(a.id);
    requestAnimationFrame(() => {
      inspectorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  const uniqueRegionsCount = useMemo(
    () => new Set(allArticles.map((a) => a.suggestedRegion)).size,
    [allArticles],
  );
  const uniqueComuniCount = useMemo(
    () => new Set(allArticles.map((a) => a.suggestedComune)).size,
    [allArticles],
  );

  const approvedCount = useMemo(
    () => entries.filter((e) => e.note?.includes("Rassegna:")).length,
    [entries],
  );

  const avgConfidence = useMemo(() => {
    const scores = filteredArticles
      .map((a) => a.confidenceScore)
      .filter((n): n is number => typeof n === "number");
    if (!scores.length) return 0;
    return Math.round(
      scores.reduce((s, n) => s + n, 0) / scores.length,
    );
  }, [filteredArticles]);

  const rejectedCount = scanMeta?.rejectedNoiseCount ?? 0;

  const applyScanPayload = useCallback(
    (
      data: {
        candidates?: NewsCandidate[];
        error?: string;
        cachedAt?: string;
        meta?: NewsScanMeta;
      },
      opts?: { selectFirstLive?: boolean },
    ) => {
      const cleaned = (data.candidates ?? []).filter((c) =>
        passesClientNewsFilter(c.titolo, c.snippet, c.matchedKeywords),
      );
      setLiveCandidates(cleaned);
      if (opts?.selectFirstLive && cleaned[0]) {
        const b = candidateToBroadsheet(cleaned[0]);
        setSelectedId(b.id);
        setScanLog(
          `NER.EXTRACTOR >> Rilevato [${b.suggestedRegion} · ${b.suggestedComune}] -> Carica: ${caricaLabel(b.suggestedRole)}`,
        );
      } else if (opts?.selectFirstLive) {
        setScanLog("NER.EXTRACTOR >> Nessun nuovo match editoriale in coda.");
      }
      setScanMeta(data.meta ?? null);
      setCacheLabel(
        data.cachedAt
          ? `Feed RSS live · ${formatDispaccioWireDate(data.cachedAt)} · refresh ogni 30 min`
          : "Feed RSS live · scan in corso",
      );
    },
    [],
  );

  const scan = useCallback(
    async (forceRefresh = true) => {
      setIsScanning(true);
      setError(null);
      setScanLog("NER.EXTRACTOR >> Avvio pipeline 31 feed…");
      const started = Date.now();
      try {
        const res = await fetch("/api/news/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries, forceRefresh }),
        });
        const data = (await res.json()) as {
          candidates?: NewsCandidate[];
          error?: string;
          cachedAt?: string;
          meta?: NewsScanMeta;
        };
        const elapsed = Date.now() - started;
        if (elapsed < RSS_SCAN_MIN_MS) {
          await new Promise((r) => setTimeout(r, RSS_SCAN_MIN_MS - elapsed));
        }
        if (!res.ok) {
          setError(data.error ?? "Scan fallito");
          return;
        }
        applyScanPayload(data, { selectFirstLive: forceRefresh });
      } catch {
        setError("Errore di rete");
      } finally {
        setIsScanning(false);
      }
    },
    [entries, applyScanPayload],
  );

  useEffect(() => {
    void scan(true);
    const timer = window.setInterval(() => {
      void scan(true);
    }, NEWS_RSS_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [scan]);

  function approveArticle(
    article: BroadsheetArticle,
    regione: Region,
    comune: string,
    carica: CaricaLocale,
  ) {
    if (!comune.trim()) {
      alert("Indica comune o ente.");
      return;
    }
    let list = entries;
    const existing = list.find(
      (e) =>
        e.comune.toLowerCase() === comune.trim().toLowerCase() &&
        e.regione === regione &&
        e.carica === carica,
    );
    if (existing) {
      list = list.map((e) =>
        e.id === existing.id ? applyEventToEntry(e, "cambio_giunta") : e,
      );
    } else {
      list = [
        ...list,
        {
          id: `local-news-${Date.now()}`,
          comune: comune.trim(),
          regione,
          carica,
          partito_fn: true,
          note: `Rassegna: ${article.titolo.slice(0, 72)}`,
          ultimo_aggiornamento: new Date().toISOString().slice(0, 10),
        },
      ];
    }
    onApplyToRegistry(list);
    setApprovedIds((s) => new Set(s).add(article.id));
  }

  function discardArticle(id: string) {
    setArchived((s) => new Set(s).add(id));
  }

  const highlightOpts: HighlightOpts = {
    searchQuery,
    comune: selectedArticle?.suggestedComune ?? "",
    regione: selectedArticle?.suggestedRegion ?? "",
  };

  return (
    <div className="pb-36">
      <RssTelemetryScannerHUD isScanning={isScanning} liveLog={scanLog ?? undefined} />

      <div className="mb-4 grid grid-cols-1 divide-y divide-[#1B2436] rounded-xl border border-[#1B2436] bg-[#080C14] sm:grid-cols-2 lg:grid-cols-5 sm:divide-x sm:divide-y-0">
        <KpiCell
          code="01"
          title="SORGENTI RSS PRESIDIATE"
          value="31 / 31"
          sub="20 redazioni ANSA + 11 nazionali"
        />
        <KpiCell
          code="02"
          title="ARTICOLI RSS LIVE"
          value={`${filteredArticles.length} / ${allArticles.length}`}
          valueClass="text-emerald-400"
          sub="Solo feed reali · no seed editoriali"
        />
        <KpiCell
          code="03"
          title="RUMORE SCARTATO (BLACKLIST)"
          value={`${rejectedCount} ART.`}
          valueClass="text-rose-300"
          sub="Meteo, cronaca, sindacati esclusi"
        />
        <KpiCell
          code="04"
          title="AFFIDABILITÀ MEDIA NER"
          value={avgConfidence ? `${avgConfidence}%` : "—"}
          valueClass="text-cyan-300"
          sub="Match geografico + carica verificato"
        />
        <KpiCell
          code="05"
          title="INSERITI NEL REGISTRO"
          value={String(approvedCount)}
          valueClass="text-amber-300"
          sub="Sincronizzati con Modulo A"
        />
      </div>

      <div className="mb-4 space-y-3 rounded-xl border border-[#1B2436] bg-[#080C14] p-3.5">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(CIRC_LABELS) as CircFilter[]).map((c) => (
            <FilterPill
              key={c}
              active={circFilter === c}
              onClick={() => setCircFilter(c)}
            >
              [ {CIRC_LABELS[c]}
              {c === "ALL" ? ` (${allArticles.length})` : ""} ]
            </FilterPill>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            { q: "", label: "TUTTI" },
            { q: "Roma", label: "Roma · Lazio" },
            { q: "Milano", label: "Milano · Lombardia" },
            { q: "Brescia", label: "Brescia · Lombardia" },
            { q: "Verona", label: "Verona · Veneto" },
            { q: "Bologna", label: "Bologna · Emilia-Romagna" },
            { q: "Bari", label: "Bari · Puglia" },
            { q: "Catania", label: "Catania · Sicilia" },
          ].map((pill) => (
            <FilterPill
              key={pill.label}
              active={
                pill.q === ""
                  ? !searchQuery.trim()
                  : searchQuery.trim().toLowerCase() === pill.q.toLowerCase()
              }
              onClick={() => setSearchQuery(pill.q)}
            >
              [ {pill.label} ]
            </FilterPill>
          ))}
          <FilterPill
            active={electionFocus}
            onClick={() => setElectionFocus((v) => !v)}
          >
            [ ELEZIONI & SEGGI ]
          </FilterPill>
          {Object.keys(ROLE_PILL).map((label) => (
            <FilterPill
              key={label}
              active={roleFilter === label}
              onClick={() => setRoleFilter(label)}
            >
              [ {label} ]
            </FilterPill>
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(200px, 1fr) auto 160px auto",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <input
            className="fn-input w-full py-1.5 font-mono text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtra ed evidenzia parola chiave, comune o testata (es. Roma, Verona, Bari, Sindaco)…"
          />
          {searchQuery.trim() ? (
            <button
              type="button"
              className="font-mono text-[10px] text-slate-400 hover:text-slate-200"
              onClick={() => setSearchQuery("")}
            >
              [ × Reset ]
            </button>
          ) : (
            <span />
          )}
          <select
            className="fn-input w-full py-1 font-mono text-xs"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <option value="Tutte">Tutte le 20 regioni</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Btn
            variant="primary"
            className="whitespace-nowrap font-mono text-xs"
            disabled={isScanning}
            onClick={() => void scan(true)}
          >
            {isScanning ? "…" : "[ SCANSIONA 31 RSS LIVE ]"}
          </Btn>
        </div>
        {cacheLabel ? (
          <p className="font-mono text-[10px] text-emerald-400">{cacheLabel}</p>
        ) : null}
      </div>

      {error ? (
        <p className="mb-4 text-sm text-fn-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <section className="xl:col-span-8">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            FILO DIRETTO AGENZIE // VISTA OPERATIVA
          </p>
          <div className="overflow-hidden rounded-xl border border-[#1B2436] bg-[#080C14]">
            {filteredArticles.length === 0 ? (
              <p className="p-6 font-mono text-xs leading-relaxed text-slate-500">
                {isScanning
                  ? "Acquisizione feed RSS in corso (31 sorgenti)…"
                  : allArticles.length === 0
                    ? "Nessun articolo istituzionale dai feed RSS al momento. Prossimo refresh automatico entro 30 minuti, oppure usa [ SCANSIONA 31 RSS LIVE ]."
                    : "Nessun dispaccio in coda con i filtri attivi."}
              </p>
            ) : (
              <ul className="divide-y divide-[#1B2436]">
                {filteredArticles.map((a) => {
                  const selected = a.id === selectedId;
                  const approved = approvedIds.has(a.id);
                  const hl: HighlightOpts = {
                    searchQuery,
                    comune: a.suggestedComune,
                    regione: a.suggestedRegion,
                  };
                  return (
                    <li key={a.id}>
                      <div
                        className={`grid cursor-pointer grid-cols-1 gap-3 p-3 transition md:grid-cols-12 md:items-center ${
                          selected ? "bg-[#0E1626]" : "hover:bg-[#0C101A]"
                        }`}
                        onClick={() => selectArticle(a)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") selectArticle(a);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="md:col-span-2">
                          <p className="font-mono text-[9px] font-semibold uppercase text-slate-300">
                            {articleDisplaySource(a)}
                          </p>
                          <p className="font-mono text-[10px] tabular-nums text-slate-500">
                            {shortItDate(a.pubDate)}
                          </p>
                          {a.confidenceScore ? (
                            <span className="mt-1 inline-block rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
                              NER {a.confidenceScore}%
                            </span>
                          ) : null}
                        </div>
                        <div className="md:col-span-5">
                          <p className="text-[15px] font-semibold leading-snug text-white">
                            {highlightTextDark(a.titolo, hl)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                            {highlightTextDark(
                              cleanArticleSummary(a.sommario),
                              hl,
                            )}
                          </p>
                          <p className="mt-1 font-mono text-[8px] leading-relaxed text-slate-500">
                            PROVA NER: GEO:{" "}
                            {a.matchedGeoKeyword ??
                              `${a.suggestedComune} -> ${a.suggestedRegion}`}{" "}
                            // RUOLO: &quot;
                            {a.matchedRoleKeyword ?? caricaLabel(a.suggestedRole)}
                            &quot; → {caricaLabel(a.suggestedRole)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 md:col-span-3">
                          <span className="font-mono text-[9px] text-slate-400">
                            [{a.suggestedRegion} · {a.suggestedComune}]
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 font-mono text-[9px] ${caricaBadgeClass(a.suggestedRole)}`}
                          >
                            {caricaLabel(a.suggestedRole)}
                          </span>
                        </div>
                        <div className="md:col-span-2 md:text-right">
                          {approved ? (
                            <span className="font-mono text-[9px] font-bold text-emerald-400">
                              APPROVATO
                            </span>
                          ) : (
                            <Btn
                              variant="primary"
                              className="text-[10px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                approveArticle(
                                  a,
                                  a.suggestedRegion,
                                  a.suggestedComune,
                                  a.suggestedRole,
                                );
                              }}
                            >
                              [ + Approva ]
                            </Btn>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <aside ref={inspectorRef} className="space-y-4 xl:col-span-4">
          <div className="rounded-xl border border-[#1B2436] bg-[#080C14] p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              DOSSIER ARTICOLO &amp; VERIFICA NER
            </p>
            {selectedArticle ? (
              <>
                <p className="mt-2 font-mono text-[9px] uppercase text-slate-500">
                  {articleDisplaySource(selectedArticle)} ·{" "}
                  {formatDispaccioWireDate(selectedArticle.pubDate)}
                </p>
                <ArticleFullReader
                  article={selectedArticle}
                  highlightOpts={highlightOpts}
                />
                <div className="mt-4 space-y-2">
                  <label className="block font-mono text-[9px] text-slate-500">
                    Regione
                    <select
                      className="fn-input mt-0.5 block w-full py-1 text-xs"
                      value={editRegione}
                      onChange={(e) =>
                        setEditRegione(e.target.value as Region)
                      }
                    >
                      {REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block font-mono text-[9px] text-slate-500">
                    Comune / Ente
                    <input
                      className="fn-input mt-0.5 block w-full py-1 text-xs"
                      value={editComune}
                      onChange={(e) => setEditComune(e.target.value)}
                    />
                  </label>
                  <label className="block font-mono text-[9px] text-slate-500">
                    Carica
                    <select
                      className="fn-input mt-0.5 block w-full py-1 text-xs"
                      value={editCarica}
                      onChange={(e) =>
                        setEditCarica(e.target.value as CaricaLocale)
                      }
                    >
                      <option value="sind">Sindaco</option>
                      <option value="creg">Consigliere regionale</option>
                      <option value="com">Consigliere comunale</option>
                      <option value="dep">Deputato</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <Btn
                    variant="primary"
                    className="text-xs"
                    onClick={() =>
                      approveArticle(
                        selectedArticle,
                        editRegione,
                        editComune,
                        editCarica,
                      )
                    }
                  >
                    [ + APPROVA E REGISTRA ]
                  </Btn>
                  <Btn
                    variant="secondary"
                    className="text-xs"
                    onClick={() => discardArticle(selectedArticle.id)}
                  >
                    [ SCARTA DALLA CODA ]
                  </Btn>
                </div>
              </>
            ) : (
              <p className="mt-3 font-mono text-xs text-slate-500">
                Seleziona un dispaccio dal filo agenzie.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[#1B2436] bg-[#080C14] p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              CHART.09 // DISTRIBUZIONE DISPACCI PER REGIONE (SVG)
            </p>
            <div className="mt-3">
              <Chart09RegionBars articles={allArticles} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
