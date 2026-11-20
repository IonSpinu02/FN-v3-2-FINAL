"use client";

import type { LiveConsensoPayload } from "@/lib/engine/pollTypes";
import type { ConsensusExplanationUiBlocks } from "@/lib/ai/consensusExplanationAgent";
import { formatDecimalIt, formatIsoDateIt } from "@/lib/formatIt";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Brief = NonNullable<LiveConsensoPayload["movementBrief"]>;

type ExplanationPayload = {
  headline?: string;
  plainWhy?: string;
  paragraph?: string;
  citedSources?: Array<{ label: string; url: string; date?: string }>;
  disclaimer?: string;
  explanationHash?: string;
  headlineDirection?: "SALITO" | "SCESO" | "STABILE";
  uiBlocks?: ConsensusExplanationUiBlocks;
};

function formatPct(n: number, digits = 1): string {
  return `${formatDecimalIt(n, digits)}%`;
}

function formatSignedPp(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "n/d";
  const body = formatDecimalIt(Math.abs(n), 1);
  if (n > 0) return `+${body} pp`;
  if (n < 0) return `−${body} pp`;
  return `${body} pp`;
}

const SCROLLBAR_CLASS =
  "[scrollbar-width:thin] [scrollbar-color:#334155_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 hover:[&::-webkit-scrollbar-thumb]:bg-slate-600";

function briefFingerprint(brief: Brief): string {
  const polls = (brief.inputs ?? [])
    .map((r) => `${r.institute}:${r.fieldEnd}:${r.fnPct}`)
    .join("|");
  return [
    brief.pct,
    brief.previousPct ?? "",
    brief.deltaPp ?? "",
    brief.isoDate,
    polls,
  ].join("·");
}

function capitalizeFirst(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return t;
  const out = t.charAt(0).toLocaleUpperCase("it-IT") + t.slice(1);
  return /[.!?…]$/.test(out) ? out : `${out}.`;
}

/** Fallback se manca uiBlocks / plainWhy (cache vecchia o stub). */
function parseLegacyUiBlocks(
  paragraph: string,
  brief: Brief,
): ConsensusExplanationUiBlocks {
  const plainWhy = capitalizeFirst(
    paragraph.split(/(?<=\.)\s+/)[0] ||
      brief.why ||
      "Il movimento di consenso va letto insieme alle uscite pubbliche della settimana.",
  );

  const newsBullets = (brief.sources ?? []).slice(0, 4).map((s) => {
    const outlet = (s.label.split(/[·|,]/)[0] ?? s.label).trim();
    return {
      badge: outlet,
      text: capitalizeFirst(s.label.replace(outlet, "").replace(/^[\s·|,–—-]+/, "") || s.label),
      sourceDate: outlet,
      summary: s.label,
    };
  });

  let spreadInfo: ConsensusExplanationUiBlocks["spreadInfo"];
  if ((brief.inputs?.length ?? 0) >= 2) {
    const sorted = [...(brief.inputs ?? [])].sort((a, b) => a.fnPct - b.fnPct);
    const lo = sorted[0]!;
    const hi = sorted[sorted.length - 1]!;
    spreadInfo = {
      highLabel: hi.institute,
      highVal: hi.fnPct,
      lowLabel: lo.institute,
      lowVal: lo.fnPct,
      widthPp: Math.round((hi.fnPct - lo.fnPct) * 10) / 10,
    };
  }

  const pollstersNote = spreadInfo
    ? capitalizeFirst(
        `${spreadInfo.highLabel} stima FN al ${formatPct(spreadInfo.highVal)} mentre ${spreadInfo.lowLabel} al ${formatPct(spreadInfo.lowVal)}: quando esce ${spreadInfo.highLabel} la media sale più facilmente`,
      )
    : "In questa finestra ci sono poche rilevazioni: la media va presa con cautela.";

  return {
    plainWhy,
    rawDeltaPp: brief.deltaPp ?? null,
    sameInstituteDeltaPp: null,
    houseEffectPp: null,
    spreadInfo,
    newsBullets,
    coreThemes: ["Sicurezza", "Immigrazione", "Fisco / Caro-vita", "Vincoli UE / Industria"],
    pollstersNote,
    flowsSummary: plainWhy,
    teamDirective: capitalizeFirst(
      "Insistere in TV e sui social su sicurezza, bollette e tasse, lavorando su elettori delusi del centrodestra e sull’astensione",
    ),
  };
}

export function ConsensoMovementInfo({ brief }: { brief: Brief }) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; maxHeight: number } | null>(
    null,
  );
  const [explanation, setExplanation] = useState<ExplanationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const panelId = useId();
  const delta = brief.deltaPp;
  const fingerprint = useMemo(() => briefFingerprint(brief), [brief]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setExplanation(null);
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/ai/consensus-explanation", {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          ok?: boolean;
          explanation?: ExplanationPayload;
        };
        if (controller.signal.aborted) return;
        if (data.explanation) setExplanation(data.explanation);
      } catch {
        if (controller.signal.aborted) return;
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [fingerprint]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const margin = 12;
      const panelW = Math.min(460, window.innerWidth * 0.92);
      const maxHeight = Math.min(window.innerHeight * 0.78, window.innerHeight - margin * 2);
      let left = rect.right + 10;
      if (left + panelW > window.innerWidth - margin) {
        left = Math.max(margin, rect.left - panelW - 10);
      }
      let top = rect.top;
      if (top + maxHeight > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - maxHeight - margin);
      }
      setBox({ top, left, maxHeight });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const direction: "up" | "down" | "flat" =
    explanation?.headlineDirection === "SALITO" || (delta != null && delta > 0.1)
      ? "up"
      : explanation?.headlineDirection === "SCESO" || (delta != null && delta < -0.1)
        ? "down"
        : "flat";

  const headline =
    explanation?.headline ??
    (direction === "up"
      ? "PERCHÉ IL CONSENSO È SALITO"
      : direction === "down"
        ? "PERCHÉ IL CONSENSO È SCESO"
        : "PERCHÉ IL CONSENSO È STABILE");

  const uiBlocks =
    explanation?.uiBlocks ??
    parseLegacyUiBlocks(explanation?.paragraph ?? brief.why, brief);

  const plainWhy = capitalizeFirst(
    explanation?.plainWhy || uiBlocks.plainWhy || brief.why,
  );

  const newsItems = uiBlocks.newsBullets.map((n) => ({
    badge: n.badge || n.sourceDate || "Stampa",
    text: capitalizeFirst(n.text || n.summary || ""),
  }));

  const sources =
    explanation?.citedSources && explanation.citedSources.length > 0
      ? explanation.citedSources
      : brief.sources ?? [];

  const disclaimer =
    explanation?.disclaimer ??
    (direction === "up"
      ? "Ipotesi basate su analisi stampa e composizione dei sondaggi. La piattaforma non dimostra un legame causale diretto con la risalita."
      : direction === "down"
        ? "Ipotesi basate su analisi stampa e composizione dei sondaggi. La piattaforma non dimostra un legame causale diretto con il calo."
        : "Ipotesi basate su analisi stampa e composizione dei sondaggi. La piattaforma non dimostra un legame causale diretto con la variazione.");

  const prevDateIt = brief.previousIsoDate
    ? formatIsoDateIt(brief.previousIsoDate)
    : null;

  const dotClass =
    direction === "up"
      ? "bg-emerald-400"
      : direction === "down"
        ? "bg-rose-400"
        : "bg-amber-400";

  const deltaPillClass =
    direction === "up"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
      : direction === "down"
        ? "border-rose-500/30 bg-rose-500/15 text-rose-300"
        : "border-amber-500/30 bg-amber-500/15 text-amber-300";

  const panel =
    open && box
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={headline}
            style={{ top: box.top, left: box.left, maxHeight: box.maxHeight }}
            className={`fixed z-[80] w-[400px] max-w-[92vw] space-y-3.5 overflow-y-auto rounded-xl border border-slate-800/90 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-md sm:w-[460px] ${SCROLLBAR_CLASS}`}
          >
            {/* 1. Header KPI */}
            <div className="sticky top-0 z-10 -mx-4 -mt-4 space-y-2 border-b border-slate-800/80 bg-slate-950/95 px-4 pb-3 pt-4 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                  {headline}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2.5">
                <p className="text-2xl font-bold tracking-tight text-white">
                  {formatPct(brief.pct, 1)}
                </p>
                {delta != null ? (
                  <span
                    className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${deltaPillClass}`}
                  >
                    {formatSignedPp(delta)}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] leading-snug text-slate-400">
                {brief.previousPct != null ? (
                  <>
                    rispetto al {formatPct(brief.previousPct)}
                    {prevDateIt ? ` del ${prevDateIt}` : ""}
                  </>
                ) : (
                  "riferimento precedente n/d"
                )}
                {brief.benchmarkPct != null ? (
                  <> · Media sondaggi {formatPct(brief.benchmarkPct)}</>
                ) : null}
              </p>
            </div>

            {loading && !explanation ? (
              <div className="space-y-2" aria-busy="true" aria-label="Generazione analisi">
                <div className="h-24 animate-pulse rounded-lg bg-slate-800/60" />
                <div className="h-16 animate-pulse rounded-lg bg-slate-800/50" />
                <div className="h-14 animate-pulse rounded-lg bg-slate-800/40" />
              </div>
            ) : (
              <>
                {/* 2. In parole semplici */}
                <div className="rounded-lg border border-slate-700/80 bg-slate-900/90 p-3.5">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    In parole semplici
                  </p>
                  <p className="text-[13px] leading-relaxed text-slate-100">{plainWhy}</p>
                </div>

                {/* 3. Fatti & uscite */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Fatti e uscite che hanno inciso
                  </p>
                  {newsItems.length > 0 ? (
                    <ul className="space-y-2">
                      {newsItems.map((n, i) => (
                        <li key={`${n.badge}-${i}`} className="text-[12px] leading-snug">
                          <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-400">
                            {n.badge.replace(/^fonte\s*[—–-]\s*/i, "")}
                          </span>
                          <span className="mt-1 block text-slate-200 sm:mt-0 sm:ml-1.5 sm:inline">
                            {n.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-slate-400">
                      Nessuna uscita stampa verificata in finestra; resta il quadro pubblico generale.
                    </p>
                  )}
                  {uiBlocks.coreThemes.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {uiBlocks.coreThemes.map((theme) => (
                        <span
                          key={theme}
                          className="rounded-full border border-slate-700/80 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* 4. Stime sondaggisti */}
                {uiBlocks.spreadInfo ? (
                  <div className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-2.5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Stime dei sondaggisti (da chi dipende il numero)
                    </p>
                    <div className="mb-2 flex items-center gap-2">
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate font-mono text-[10px] text-amber-300/90">
                          {uiBlocks.spreadInfo.lowLabel}
                        </p>
                        <p className="font-mono text-xs font-semibold text-white">
                          {formatPct(uiBlocks.spreadInfo.lowVal)}
                        </p>
                      </div>
                      <div className="h-1.5 min-w-[72px] flex-1 rounded-full bg-gradient-to-r from-amber-500/70 via-sky-500/70 to-emerald-500/70" />
                      <div className="min-w-0 flex-1 text-right">
                        <p className="truncate font-mono text-[10px] text-emerald-300/90">
                          {uiBlocks.spreadInfo.highLabel}
                        </p>
                        <p className="font-mono text-xs font-semibold text-white">
                          {formatPct(uiBlocks.spreadInfo.highVal)}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      {capitalizeFirst(uiBlocks.pollstersNote)}
                    </p>
                  </div>
                ) : null}

                {/* 5. Cosa fare ora */}
                <div className="rounded-lg border-l-2 border-amber-400 bg-amber-500/10 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    Cosa fare ora (Team FN)
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-100">
                    {capitalizeFirst(uiBlocks.teamDirective)}
                  </p>
                </div>
              </>
            )}

            {sources.length > 0 ? (
              <ul className="space-y-1 border-t border-slate-800/80 pt-2">
                {sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-cyan-400 underline decoration-cyan-500/30 underline-offset-2 hover:text-cyan-300"
                    >
                      {source.label.replace(/^fonte\s*[—–-]\s*/i, "")} ↗
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="text-[10px] leading-snug text-slate-500">{disclaimer}</p>
            {brief.articleUrl ? (
              <a
                href={brief.articleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-mono text-[10px] text-cyan-400 underline decoration-cyan-500/30 underline-offset-2 hover:text-cyan-300"
              >
                Articolo YouTrend ↗
              </a>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative mt-1 shrink-0">
      <button
        ref={buttonRef}
        type="button"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-cyan-400/40 font-serif text-[11px] italic leading-none text-cyan-300 hover:border-cyan-300 hover:bg-cyan-400/10"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={headline}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {panel}
    </div>
  );
}
