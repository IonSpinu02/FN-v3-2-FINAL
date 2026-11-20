"use client";

import {
  matchExactBipSubDossier,
  provvedimentoFromSubDossier,
} from "@/lib/engine/bipSubDossierMatch";
import { DISTRESS_PILLARS } from "@/lib/news/viralDistressPillars";
import { buildVannacciStitchActs } from "@/lib/news/viralVannacciScript";
import type { ViralPlatform, ViralVideoItem } from "@/lib/news/viralVideoTypes";
import { cleanSocialText } from "@/lib/news/viralTextSanitize";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const SCROLL_HIDE =
  "overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function platformLabel(p: ViralPlatform): string {
  if (p === "tiktok") return "TikTok";
  if (p === "instagram") return "Instagram Reels";
  return "YouTube Shorts";
}

function engagementRate(item: ViralVideoItem): string {
  if (item.viewsCount <= 0) return "—";
  const rate = ((item.likesCount + item.commentsCount) / item.viewsCount) * 100;
  return `${rate.toFixed(1).replace(".", ",")}%`;
}

export function OsservatorioViralReelAnalyzePanel({
  item,
  onClose,
}: {
  item: ViralVideoItem | null;
  onClose: () => void;
}) {
  const [portalReady, setPortalReady] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [item, onClose]);

  const acts = useMemo(() => {
    if (!item) return null;
    const pillar =
      DISTRESS_PILLARS.find((p) => p.id === item.distressPillarId) ??
      DISTRESS_PILLARS[4]!;
    return buildVannacciStitchActs({
      locality: item.locality,
      title: item.title,
      pillar: {
        ...pillar,
        bipHook: pillar.bipHook,
        bipCapRef: item.bipCapRef || pillar.bipCapRef,
      },
      topUserComment: item.topUserComment,
      commentSentiment: item.commentSentiment,
    });
  }, [item]);

  if (!item || !portalReady || !acts) return null;

  const titolo = cleanSocialText(item.title);
  const sintesi = cleanSocialText(item.description);
  const comment = cleanSocialText(item.topUserComment);
  const dossier = matchExactBipSubDossier(titolo, sintesi, item.category);
  const prov = provvedimentoFromSubDossier(dossier);
  const scriptFull = item.scriptRispostaVideo || acts.full;
  const caption = acts.socialCaption;

  async function copyText(text: string, kind: "script" | "caption") {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "script") {
        setCopiedScript(true);
        window.setTimeout(() => setCopiedScript(false), 1600);
      } else {
        setCopiedCaption(true);
        window.setTimeout(() => setCopiedCaption(false), 1600);
      }
    } catch {
      /* ignore */
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md sm:p-6 md:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="viral-reel-dossier-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#080C14] shadow-[0_25px_80px_rgba(0,0,0,0.85)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 flex-col gap-3 border-b border-white/[0.08] bg-[#0B101B] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-slate-400">
              <span className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 font-semibold text-fuchsia-200">
                {platformLabel(item.platform)}
              </span>
              <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-semibold text-cyan-100">
                {item.distressLabel}
              </span>
              <span className="text-slate-300">{item.locality}</span>
              <span className="rounded border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-amber-200">
                Viral Score {item.viralScore}/100
              </span>
            </div>
            <h2
              id="viral-reel-dossier-title"
              className="mt-1.5 text-base font-bold leading-snug text-white sm:text-lg"
            >
              {titolo}
            </h2>
            <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] tabular-nums text-slate-300">
              <span>
                Views <strong className="text-white">{item.viewsFormatted}</strong>
              </span>
              <span>
                Like <strong className="text-rose-300">{item.likesFormatted}</strong>
              </span>
              <span>
                Commenti{" "}
                <strong className="text-cyan-300">{item.commentsFormatted}</strong>
              </span>
              <span>
                Eng. rate <strong className="text-emerald-300">{engagementRate(item)}</strong>
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {item.url.startsWith("http") ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
              >
                Apri video originale
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/[0.12]"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Chiudi
            </button>
          </div>
        </header>

        <div className={`min-h-0 flex-1 space-y-4 p-5 ${SCROLL_HIDE}`}>
          <Section title="01 // Problemi segnalati e orientamento dei commenti">
            <p className="text-sm leading-relaxed text-slate-200">{sintesi}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-amber-500/25 border-l-2 border-l-amber-400/80 bg-amber-500/[0.05] p-3">
                <p className="font-mono text-[9px] uppercase tracking-wider text-amber-200/90">
                  Polarizzazione commenti
                </p>
                <p className="mt-1 font-mono text-sm tabular-nums text-white">
                  Pro {item.sentimentProPct}%{" "}
                  <span className="text-slate-500">vs</span> Critici{" "}
                  {item.sentimentControPct}%
                </p>
                <p className="mt-1 text-[11px] text-amber-100/90">{item.commentMoodBadge}</p>
                <p className="mt-2 text-sm italic leading-relaxed text-slate-100">{comment}</p>
              </div>
              <div className="rounded-xl border border-cyan-500/25 border-l-2 border-l-cyan-400/80 bg-cyan-500/[0.05] p-3">
                <p className="font-mono text-[9px] uppercase tracking-wider text-cyan-200/90">
                  Bacino elettorale contendibile
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-100">
                  {item.staffDiagnosis}
                </p>
              </div>
            </div>
          </Section>

          <Section title="02 // Regia stitch / Reel di risposta (script 20s · 3 atti)">
            <div className="space-y-2">
              <ActBlock
                label="00–03s · HOOK VISIVO (Aggancio sullo Stitch)"
                body={acts.hook}
              />
              <ActBlock
                label="03–15s · DATO REALE & DENUNCIA"
                body={acts.dato}
              />
              <ActBlock
                label="15–20s · SOLUZIONE B.I.P. & CHIUSURA"
                body={acts.soluzione}
              />
            </div>
            <p className="mt-3 rounded-lg border border-white/[0.06] bg-black/25 p-3 text-sm leading-relaxed text-slate-200">
              {scriptFull}
            </p>
          </Section>

          <Section title="03 // Inquadramento B.I.P. & azione sul campo">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
                <p className="font-mono text-[9px] uppercase tracking-wider text-emerald-300/90">
                  Capitolo B.I.P.
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-50">
                  {item.bipCapRef || dossier.capRef}
                </p>
                <p className="mt-1 text-[11px] text-slate-300">
                  {item.bipLever || dossier.bipReference}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
                <p className="font-mono text-[9px] uppercase tracking-wider text-emerald-300/90">
                  Misura normativa concreta
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-100">
                  {prov.attoConcreto}
                </p>
                <p className="mt-2 font-mono text-[10px] text-slate-400">
                  {prov.enteCompetente} · {prov.tempiAttuazione}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/[0.06] p-3">
              <p className="font-mono text-[9px] uppercase tracking-wider text-fuchsia-300/90">
                Bozza caption social
              </p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-100">
                {caption}
              </pre>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyText(scriptFull, "script")}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  copiedScript
                    ? "border-emerald-300/60 bg-emerald-400/25 text-emerald-50"
                    : "border-emerald-500/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                }`}
              >
                {copiedScript ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
                {copiedScript ? "Script Copiato" : "Copia Script Video"}
              </button>
              <button
                type="button"
                onClick={() => void copyText(caption, "caption")}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  copiedCaption
                    ? "border-cyan-300/60 bg-cyan-400/25 text-cyan-50"
                    : "border-cyan-500/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25"
                }`}
              >
                {copiedCaption ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
                {copiedCaption ? "Caption Copiata" : "Copia Caption Social"}
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ActBlock({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5">
      <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-fuchsia-300/90">
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-100">{body}</p>
    </div>
  );
}
