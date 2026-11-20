"use client";

import { OsservatorioViralReelAnalyzePanel } from "@/components/osservatorio/OsservatorioViralReelAnalyzePanel";
import { TavilyDailyBadge, tavilyScanButtonState } from "@/components/TavilyDailyBadge";
import { isTavilyDailyScanDone } from "@/lib/cache/tavilyDailyMeta";
import type {
  CommentSentiment,
  ViralPlatform,
  ViralReelsPayload,
  ViralVideoItem,
} from "@/lib/news/viralVideoTypes";
import { Check, Copy, ScanSearch } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

function platformBadge(platform: ViralPlatform): { label: string; className: string } {
  switch (platform) {
    case "tiktok":
      return {
        label: "[ ♪ TikTok ]",
        className: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200",
      };
    case "instagram":
      return {
        label: "[ ◎ Reels ]",
        className: "border-rose-500/40 bg-rose-500/15 text-rose-200",
      };
    default:
      return {
        label: "[ ▶ Shorts ]",
        className: "border-red-500/40 bg-red-500/15 text-red-200",
      };
  }
}

function moodBadgeClass(sentiment: CommentSentiment): string {
  switch (sentiment) {
    case "ATTACCO / PROVOCAZIONE":
      return "border-rose-500/50 bg-rose-500/20 text-rose-200";
    case "RABBIA SOCIALE":
      return "border-amber-500/50 bg-amber-500/20 text-amber-200";
    case "SOSTEGNO":
      return "border-emerald-500/50 bg-emerald-500/20 text-emerald-200";
    default:
      return "border-violet-500/50 bg-violet-500/20 text-violet-200";
  }
}

function moodPrefix(sentiment: CommentSentiment): string {
  switch (sentiment) {
    case "ATTACCO / PROVOCAZIONE":
      return "⚡";
    case "RABBIA SOCIALE":
      return "🔥";
    case "SOSTEGNO":
      return "✓";
    default:
      return "⚔";
  }
}

function ViralVideoCard({
  item,
  onAnalyze,
}: {
  item: ViralVideoItem;
  onAnalyze: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const badge = platformBadge(item.platform);
  const score = Math.min(100, Math.max(0, Math.round(item.viralScore)));

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(item.scriptRispostaVideo);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="flex h-full min-h-[380px] flex-col justify-between overflow-hidden rounded-xl border border-white/[0.08] bg-[#090D16]/95">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-1.5 border-b border-white/[0.06] px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wide ${badge.className}`}
              >
                {badge.label}
              </span>
              <span className="shrink-0 rounded border border-cyan-500/35 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-cyan-100">
                {item.distressLabel}
              </span>
              <span className="truncate text-[10px] text-slate-500">{item.locality}</span>
            </div>
            <span className="shrink-0 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-amber-200">
              VIRAL SCORE {score}/100
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 font-mono text-[10px] tabular-nums">
            <p className="text-center text-slate-300">
              <span className="block text-[8px] uppercase text-slate-500">Visualizzazioni</span>
              <span className="font-bold text-white">{item.viewsFormatted}</span>
            </p>
            <p className="text-center text-rose-300">
              <span className="block text-[8px] uppercase text-slate-500">Like</span>
              <span className="font-bold">{item.likesFormatted}</span>
            </p>
            <p className="text-center text-cyan-300">
              <span className="block text-[8px] uppercase text-slate-500">Commenti</span>
              <span className="font-bold">{item.commentsFormatted}</span>
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <div>
            <p className="font-mono text-[8px] uppercase tracking-wider text-slate-500">
              Disagio denunciato nel video
            </p>
            <h3 className="mt-0.5 min-h-[2.5em] text-sm font-semibold leading-snug text-white">
              {item.title}
            </h3>
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-400">
              {item.description}
            </p>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block font-mono text-[10px] font-semibold text-emerald-400 underline decoration-emerald-500/30 underline-offset-2 hover:text-emerald-300"
            >
              [ Guarda il video originale ↗ ]
            </a>
          </div>

          <div className="mt-auto space-y-2">
            <div className="rounded-lg border border-amber-500/30 border-l-2 border-l-amber-400/80 bg-amber-500/[0.05] px-2.5 py-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[8px] font-semibold uppercase tracking-wider text-amber-200/90">
                    Umore nei commenti
                  </span>
                  <span
                    className={`rounded border px-1 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide ${moodBadgeClass(item.commentSentiment)}`}
                  >
                    {moodPrefix(item.commentSentiment)} {item.commentMoodBadge}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[8px] tabular-nums text-slate-400">
                  Pro {item.sentimentProPct}% · Critici {item.sentimentControPct}%
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs italic leading-snug text-slate-200">
                {item.topUserComment}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-amber-300">
                {item.staffDiagnosis}
              </p>
            </div>

            <div className="rounded-lg border border-emerald-500/35 border-l-2 border-l-emerald-400/80 bg-emerald-500/[0.06] px-2.5 py-2">
              <p className="font-mono text-[8px] font-semibold uppercase tracking-wider text-emerald-300/90">
                Script Stitch / Risposta video (20 sec)
              </p>
              <p className="mt-0.5 font-mono text-[8px] text-emerald-200/70">{item.bipCapRef}</p>
              <p className="mt-1.5 line-clamp-3 text-[11px] leading-snug text-slate-100">
                {item.scriptRispostaVideo}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex shrink-0 gap-1.5 border-t border-white/[0.08] p-2">
        <button
          type="button"
          onClick={onAnalyze}
          className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-cyan-500/35 bg-gradient-to-r from-cyan-500/12 to-violet-500/12 px-2 py-2 text-[11px] font-semibold text-cyan-100 transition hover:from-cyan-500/22 hover:to-violet-500/22"
        >
          <ScanSearch className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">Analizza Video &amp; Strategia</span>
        </button>
        <button
          type="button"
          onClick={() => void copyScript()}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-wide transition ${
            copied
              ? "border-emerald-300/60 bg-emerald-400/25 text-emerald-50"
              : "border-emerald-500/35 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
          }`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
          {copied ? "Script Copiato" : "Copia Script 20s"}
        </button>
      </div>
    </article>
  );
}

type ReelsFetchMode = "cache" | "daily" | "force";

export function OsservatorioViralReelsTab({
  regionParam,
  territoryLabel,
  onItemsCount,
}: {
  regionParam: string;
  territoryLabel: string;
  onItemsCount?: (count: number) => void;
}) {
  const [data, setData] = useState<ViralReelsPayload | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzeItem, setAnalyzeItem] = useState<ViralVideoItem | null>(null);

  const fetchReels = useCallback(
    async (mode: ReelsFetchMode): Promise<ViralReelsPayload> => {
      const qs = new URLSearchParams({ region: regionParam });
      if (mode === "cache") qs.set("mode", "cache");
      if (mode === "force") qs.set("force", "1");
      const res = await fetch(`/api/viral-reels?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as ViralReelsPayload & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Errore caricamento");
      return json;
    },
    [regionParam],
  );

  const show = useCallback(
    (payload: ViralReelsPayload) => {
      setData(payload);
      setReceivedAt(Date.now());
      onItemsCount?.(payload.items.length);
    },
    [onItemsCount],
  );

  /** Prima i dati salvati (o il catalogo statico), poi la scansione del giorno solo se manca. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cached = await fetchReels("cache");
        if (cancelled) return;
        setError(null);
        show(cached);
        if (cached.tavily.status === "disabled" || isTavilyDailyScanDone(cached.tavily, Date.now())) {
          return;
        }
        setLoading(true);
        const daily = await fetchReels("daily");
        if (!cancelled) show(daily);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Errore rete");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchReels, show]);

  const scan = useCallback(
    async (force: boolean) => {
      setLoading(true);
      setError(null);
      try {
        show(await fetchReels(force ? "force" : "daily"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore rete");
      } finally {
        setLoading(false);
      }
    },
    [fetchReels, show],
  );

  const count = data?.items.length ?? 0;
  const button = tavilyScanButtonState(
    data?.tavily,
    receivedAt,
    "[ ↻ Scansiona TikTok/Reels Live con Tavily ]",
  );

  return (
    <div className="flex min-w-0 flex-col gap-3 pb-4">
      <OsservatorioViralReelAnalyzePanel
        item={analyzeItem}
        onClose={() => setAnalyzeItem(null)}
      />

      <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#0A0E17] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            03 // TikTok &amp; Reels Virali
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-white">
            Disagi reali dei cittadini — {territoryLabel}
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {count} video · 7 filoni di rabbia sociale · no post di partito
            {data?.source ? ` · ${data.source}` : ""}
            {data?.fetchedAt
              ? ` · ${new Date(data.fetchedAt).toLocaleString("it-IT")}`
              : ""}
          </p>
          {data?.tavily.forceBlocked && data.tavily.message ? (
            <p className="mt-1 text-xs text-emerald-300/90">{data.tavily.message}</p>
          ) : null}
          {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <button
            type="button"
            disabled={loading || button.disabled}
            title={button.title}
            onClick={() => void scan(button.force)}
            className="shrink-0 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/15 px-3 py-1.5 text-left text-[11px] font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "[ Scansione in corso… ]" : button.label}
          </button>
          <TavilyDailyBadge meta={data?.tavily} nowMs={receivedAt} />
        </div>
      </div>

      {loading && !data?.items.length ? (
        <p className="text-sm text-slate-500">Ricerca denunce cittadine in corso…</p>
      ) : null}

      <div className="grid grid-cols-1 content-start gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
        {(data?.items ?? []).map((item) => (
          <ViralVideoCard
            key={item.id}
            item={item}
            onAnalyze={() => setAnalyzeItem(item)}
          />
        ))}
      </div>

      {!loading && data && data.items.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nessuna denuncia cittadina trovata. Verifica{" "}
          <span className="font-mono text-slate-400">TAVILY_API_KEY</span> e riesegui la
          scansione.
        </p>
      ) : null}
    </div>
  );
}

export function viralReelsTabLabel(count: number | null): string {
  const n = count != null ? ` (${count})` : "";
  return `3. TikTok & Reels Virali sul Territorio${n}`;
}
