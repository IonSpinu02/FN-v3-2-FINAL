"use client";

import {
  canEmbedIssueArticleUrl,
  cleanIssueHeadline,
  cleanRssText,
} from "@/lib/engine/territoryIssuesEngine";
import {
  categoryPillLabelForIssue,
  fieldActionWhereForIssue,
  fieldStakeholdersForIssue,
  formatIssuePubDateIt,
  bipBadgeForIssue,
  pressDeclarationForIssue,
  provvedimentoForIssue,
  sourceLabelFromUrl,
} from "@/lib/engine/territoryIssueAnalyzeCopy";
import type { TerritoryIssue } from "@/lib/engine/territoryIssuesTypes";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type LeftView = "sintesi" | "iframe";

const SCROLL_HIDE =
  "overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function priorityBadgeClass(score: number): string {
  if (score >= 75) return "border-rose-500/40 bg-rose-500/15 text-rose-100";
  if (score >= 50) return "border-amber-500/40 bg-amber-500/15 text-amber-100";
  return "border-emerald-500/35 bg-emerald-500/10 text-emerald-100";
}

export function OsservatorioIssueAnalyzePanel({
  issue,
  onClose,
  onRegister,
}: {
  issue: TerritoryIssue | null;
  onClose: () => void;
  onRegister: () => void;
}) {
  const [leftView, setLeftView] = useState<LeftView>("sintesi");
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const iframeLoadedRef = useRef(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const articleUrl = issue?.evidence?.url ?? issue?.sourceUrl ?? "";
  const embedAllowed = canEmbedIssueArticleUrl(articleUrl);

  useEffect(() => {
    if (!issue) return;
    setLeftView("sintesi");
  }, [issue?.id]);

  useEffect(() => {
    if (!issue || !embedAllowed || leftView !== "iframe") return;
    iframeLoadedRef.current = false;
    setIframeBlocked(false);
    const t = window.setTimeout(() => {
      if (!iframeLoadedRef.current) setIframeBlocked(true);
    }, 4500);
    return () => window.clearTimeout(t);
  }, [issue, articleUrl, embedAllowed, leftView]);

  useEffect(() => {
    if (!issue) return;
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
  }, [issue, onClose]);

  if (!issue || !portalReady) return null;

  const titolo = cleanIssueHeadline(issue.titoloProblema);
  const sintesi = cleanRssText(issue.sintesiLamentela);
  const evidenceSnippet = issue.evidence?.snippet
    ? cleanRssText(issue.evidence.snippet)
    : null;
  const sourceName =
    issue.evidence?.feedHint?.trim() ||
    sourceLabelFromUrl(articleUrl);
  const pubLabel = formatIssuePubDateIt(
    issue.evidence?.pubDate ?? issue.pubDate,
  );
  const priorityScore = Math.min(
    100,
    Math.max(0, Math.round(issue.categoryStress ?? issue.impattoScore ?? 0)),
  );
  const bipCapRef = bipBadgeForIssue(issue);
  const pressLine = pressDeclarationForIssue(issue, issue.regione, issue.electoralSubTheme);
  const prov = provvedimentoForIssue(issue, issue.electoralSubTheme);
  const dove = fieldActionWhereForIssue(issue);
  const stakeholders = fieldStakeholdersForIssue(issue);
  const localita =
    issue.regione === "NAZIONALE"
      ? issue.provinciaComune
      : `${issue.provinciaComune} · ${issue.regione}`;
  const bacinoFlussi =
    issue.conversion?.voteSourceMix?.trim() ||
    "Bacino sensibile: Ex-Astenuti · Elettori Lega delusi · Elettori FdI (matrice flussi scenario)";

  async function copyDeclaration() {
    try {
      await navigator.clipboard.writeText(pressLine);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md sm:p-6 md:py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analyze-issue-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex w-full max-w-6xl max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#080C14] shadow-[0_25px_80px_rgba(0,0,0,0.85)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 flex-col gap-3 border-b border-white/[0.08] bg-[#0B101B] px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wide text-slate-400">
              <span className="rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 font-semibold text-slate-200">
                {categoryPillLabelForIssue(issue)}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">{localita}</span>
              <span className="text-slate-600">·</span>
              <span>
                {sourceName}
                {pubLabel && pubLabel !== "data n.d."
                  ? ` · Pubblicazione: ${pubLabel}`
                  : " · Data pubblicazione non disponibile"}
              </span>
              {articleUrl ? (
                <a
                  href={articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 hover:underline"
                >
                  Apri articolo
                </a>
              ) : (
                <span className="text-amber-200/90">Link articolo non disponibile</span>
              )}
            </div>
            <h2
              id="analyze-issue-title"
              className="mt-1 text-base font-bold leading-snug text-white sm:text-lg"
            >
              {titolo}
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5">
            <span
              className={`rounded-lg border px-3 py-1.5 font-mono text-xs ${priorityBadgeClass(priorityScore)}`}
            >
              Priorità {priorityScore}/100
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/[0.12]"
            >
              Chiudi ✕
            </button>
          </div>
        </header>

        {/* Barra switch a tutta larghezza — evita il buco nero in colonna sinistra */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-[#0A0F18] px-6 py-2.5">
          <div className="inline-flex rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
            <ViewTab
              active={leftView === "sintesi"}
              onClick={() => setLeftView("sintesi")}
            >
              Dossier Operativo &amp; Analisi
            </ViewTab>
            <ViewTab
              active={leftView === "iframe"}
              onClick={() => setLeftView("iframe")}
              disabled={!articleUrl.startsWith("http")}
            >
              Anteprima Articolo Originale
            </ViewTab>
          </div>
          {articleUrl.startsWith("http") ? (
            <a
              href={articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-emerald-400/90 transition hover:text-emerald-300"
            >
              Apri fonte ↗
            </a>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 items-start overflow-hidden lg:grid-cols-12">
          <section
            className={`flex min-h-0 flex-col border-b border-white/[0.08] lg:col-span-6 lg:border-b-0 lg:border-r ${SCROLL_HIDE} p-6`}
            aria-label="Diagnosi e impatto politico"
          >
            {leftView === "iframe" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {!embedAllowed || iframeBlocked ? (
                  <IframeFallback
                    titolo={titolo}
                    sintesi={sintesi}
                    snippet={evidenceSnippet}
                  />
                ) : (
                  <div className="h-full min-h-[280px] flex-1 overflow-hidden rounded-xl border border-white/10">
                    <iframe
                      key={articleUrl}
                      title="Articolo originale"
                      src={articleUrl}
                      className="h-full w-full bg-[#0a0e14]"
                      referrerPolicy="no-referrer-when-downgrade"
                      onLoad={() => {
                        iframeLoadedRef.current = true;
                        setIframeBlocked(false);
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <DarkCard title="Sintesi della notizia & fatti chiave">
                  <p className="text-sm leading-relaxed text-slate-200">
                    {sintesi}
                  </p>
                  {evidenceSnippet && evidenceSnippet !== sintesi ? (
                    <p className="text-sm leading-relaxed text-slate-400">
                      {evidenceSnippet}
                    </p>
                  ) : null}
                  <p className="text-xs text-slate-500">
                    Fonte: {sourceName}
                    {pubLabel && pubLabel !== "data n.d."
                      ? ` · Data pubblicazione: ${pubLabel}`
                      : " · Data pubblicazione non disponibile"}
                    {" · "}
                    {localita}
                    {issue.canaleVirale ? ` · ${issue.canaleVirale}` : ""}
                    {articleUrl
                      ? " · Link diretto disponibile"
                      : " · Link diretto all'articolo mancante"}
                  </p>
                </DarkCard>

                <DarkCard title="Dato strutturale certificato (ISTAT / AGENAS / OpenCivitas)">
                  <p className="text-xs leading-relaxed text-slate-300">
                    {issue.datoUfficialeModuloB}
                  </p>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[10px] font-mono uppercase tracking-wide text-slate-500">
                      <span>Priorità territoriale</span>
                      <span className="text-slate-300">
                        {priorityScore}/100
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500/80 to-rose-500/90"
                        style={{
                          width: `${Math.min(100, Math.max(4, priorityScore))}%`,
                        }}
                      />
                    </div>
                  </div>
                </DarkCard>

                <DarkCard title="Bacino elettorale sensibile al tema">
                  <p className="text-sm leading-relaxed text-slate-200">
                    Tema ad alta priorità territoriale ({priorityScore}/100). La
                    leva operativa è la misura B.I.P. e la dichiarazione stampa —
                    senza promesse numeriche di nuovi voti.
                  </p>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                    {bacinoFlussi}
                  </p>
                </DarkCard>
              </div>
            )}
          </section>

          <aside
            className={`flex min-h-0 flex-col justify-between gap-3.5 bg-[#060A11] p-6 lg:col-span-6 ${SCROLL_HIDE}`}
            aria-label="Piano d'azione B.I.P. in 3 mosse"
          >
            <div className="space-y-3.5">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
                  Misura B.I.P. (sotto-dossier)
                </p>
                <p className="mt-1 text-[11px] font-medium leading-snug text-emerald-100/95">
                  {bipCapRef}
                </p>
              </div>
              <ActionBox
                num={1}
                title="Dove intervenire sul territorio (sopralluogo / punto stampa)"
              >
                <p className="text-sm leading-relaxed text-slate-100">{dove}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Incontrare sul posto: {stakeholders}
                </p>
              </ActionBox>

              <ActionBox
                num={2}
                title="Cosa dichiarare alla stampa · Bozza"
              >
                <p className="text-sm leading-relaxed text-slate-100 italic">
                  {pressLine}
                </p>
              </ActionBox>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4 space-y-3">
                <h3 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
                  3. Come si risolve concretamente
                </h3>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
                    Intervento immediato (24–72h · Prefettura / Comune / Regione)
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-200">
                    {prov.interventoImmediato}
                  </p>
                </div>
                <div className="border-t border-white/[0.08] pt-3">
                  <p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
                    Riforma strutturale B.I.P. (Parlamento / Governo)
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-200">
                    {prov.riformaStrutturale}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={onRegister}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200"
              >
                Registra intervento nel diario campagna
              </button>
              <button
                type="button"
                onClick={() => void copyDeclaration()}
                className="rounded-lg border border-emerald-500/35 bg-emerald-600/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                {copied ? "Dichiarazione copiata" : "Copia dichiarazione"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ViewTab({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium transition sm:text-[11px] ${
        disabled
          ? "cursor-not-allowed text-slate-600"
          : active
            ? "bg-white/[0.10] text-white"
            : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function DarkCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <h3 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ActionBox({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <h3 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {num}. {title}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function IframeFallback({
  titolo,
  sintesi,
  snippet,
}: {
  titolo: string;
  sintesi: string;
  snippet: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
      <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
        Anteprima non disponibile
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        Paywall, cookie o policy del publisher bloccano l&apos;incorporazione.
        Usa il Dossier Operativo o apri la fonte originale nel browser.
      </p>
      <p className="mt-4 text-sm font-medium text-white">{titolo}</p>
      <p className="mt-2 text-sm text-slate-300">{sintesi}</p>
      {snippet && snippet !== sintesi ? (
        <p className="mt-2 text-sm text-slate-400">{snippet}</p>
      ) : null}
    </div>
  );
}
