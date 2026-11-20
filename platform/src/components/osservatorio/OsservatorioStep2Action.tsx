"use client";

import type { Region } from "@/lib/engine/constants";
import type { ScenarioResult } from "@/lib/engine/types";
import type {
  TerritoryIssue,
  TerritoryIssueCategory,
} from "@/lib/engine/territoryIssuesTypes";
import {
  cleanIssueHeadline,
  cleanRssText,
  enrichIssuesWithConversion,
  dedupeIssues,
} from "@/lib/engine/territoryIssuesEngine";
import {
  buildRegionalCampaignSummary,
  getRegionalPartyHistory,
  simulateSelectedIssuesGain,
  validVotesFromScenarioRow,
} from "@/lib/fnProgramAndAffinityEngine";
import { RegionalPartyHistoryBar } from "@/components/RegionalPartyHistoryBar";
import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import { useCallback, useEffect, useMemo, useState } from "react";

const SHELL =
  "rounded-2xl border border-white/[0.08] bg-[#090D16] p-6";

const THEME_FILTERS: { id: TerritoryIssueCategory | "ALL"; label: string }[] = [
  { id: "ALL", label: "Tutti i Temi" },
  { id: "SANITA", label: "Sanità" },
  { id: "SICUREZZA", label: "Sicurezza" },
  { id: "LAVORO", label: "Lavoro & Imprese" },
  { id: "TRASPORTI", label: "Trasporti" },
  { id: "COSTO_VITA", label: "Caro-Vita" },
  { id: "TERRITORIO", label: "Agricoltura" },
];

export function OsservatorioStep2Action({
  regione,
  scenario,
  onRegisterIssueEvent,
}: {
  regione: Region;
  scenario: ScenarioResult;
  onRegisterIssueEvent: (issue: TerritoryIssue) => void;
}) {
  const [issueFilter, setIssueFilter] = useState<TerritoryIssueCategory | "ALL">("ALL");
  const [issues, setIssues] = useState<TerritoryIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulatedIds, setSimulatedIds] = useState<string[]>([]);

  const row = useMemo(
    () => scenario.righe.find((r) => r.regione === regione),
    [scenario.righe, regione],
  );

  const validVotes = useMemo(() => {
    if (!row) return 0;
    return validVotesFromScenarioRow(row.voti_di_scenario, row.stima);
  }, [row]);

  const history = getRegionalPartyHistory(regione);
  const summary = useMemo(
    () =>
      row
        ? buildRegionalCampaignSummary(regione, row.stima * 100, validVotes)
        : null,
    [regione, row, validVotes],
  );

  const simulatedGain = useMemo(() => {
    if (!simulatedIds.length) return { totalPp: 0, totalVotes: 0 };
    return simulateSelectedIssuesGain(regione, simulatedIds, issues, validVotes);
  }, [simulatedIds, regione, issues, validVotes]);

  const currentPct = row ? row.stima * 100 : 0;
  const activeGainPp =
    simulatedIds.length > 0
      ? simulatedGain.totalPp
      : (summary?.maxCumulativeGainPp ?? 0);
  const activeGainVotes =
    simulatedIds.length > 0
      ? simulatedGain.totalVotes
      : (summary?.maxCumulativeNewVotes ?? 0);
  const targetPct = currentPct + activeGainPp;
  const progressPct = Math.min(100, (targetPct / Math.max(currentPct + 2, 12)) * 100);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const catQ = issueFilter === "ALL" ? "" : `&category=${issueFilter}`;
      const res = await fetch(
        `/api/territory/issues?region=${encodeURIComponent(regione)}${catQ}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        issues: TerritoryIssue[];
        liveNews?: TerritoryIssue[];
      };
      const enriched = enrichIssuesWithConversion(
        data.issues ?? [],
        regione,
        validVotes,
      );
      const news = enrichIssuesWithConversion(data.liveNews ?? [], regione, validVotes);
      setIssues(dedupeIssues(enriched));
      setSimulatedIds([]);
    } catch {
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [regione, issueFilter, validVotes]);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  const verdict =
    history.permeabilitaVannacciScore >= 75
      ? `Indice Affinità Bacino alto (${history.permeabilitaVannacciScore}/100 · Lega/FdI affine)`
      : history.permeabilitaVannacciScore < 45
        ? `Indice Affinità Bacino basso (${history.permeabilitaVannacciScore}/100 · regione a trazione PD)`
        : `Indice Affinità Bacino medio (${history.permeabilitaVannacciScore}/100 · intervento mirato)`;

  return (
    <section id="oss-step-2" className={`scroll-mt-28 ${SHELL}`}>
      <header className="mb-5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400/90">
          2 // Piano d&apos;azione
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Piano in {regione}: problemi, promesse FN &amp; voti
        </h2>
      </header>

      <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-[#0D1526] to-[#090D16] p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="font-mono text-[9px] uppercase text-slate-500">Oggi nella regione</p>
                <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-white">
                  {formatDecimalIt(currentPct, 2)}%
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatIntIt(row?.voti_di_scenario ?? 0)} voti ·{" "}
                  {formatIntIt(row?.iscritti ?? 0)} tesserati
                </p>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase text-slate-500">Storico voti partiti</p>
                <div className="mt-2">
                  <RegionalPartyHistoryBar history={history} compact />
                </div>
                <p className="mt-2 text-[11px] leading-snug text-slate-400">{verdict}</p>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase text-slate-500">
                  Se interveniamo sui problemi
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-emerald-400">
                  +{formatDecimalIt(activeGainPp, 2)} pp
                </p>
                <p className="text-sm text-emerald-300/90">
                  +{formatIntIt(activeGainVotes)} nuovi voti
                </p>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase text-slate-500">Obiettivo raggiungibile</p>
                <p className="mt-1 font-mono text-2xl font-bold text-white">
                  {formatDecimalIt(targetPct, 2)}%
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
            {summary && (
              <p className="mt-4 text-sm text-slate-400">{summary.strategicExplanation}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {THEME_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setIssueFilter(f.id)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                  issueFilter === f.id
                    ? "bg-amber-500/20 text-amber-100"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadIssues()}
              className="ml-auto text-[11px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
            >
              Aggiorna radar
            </button>
          </div>

          {loading && issues.length === 0 ? (
            <p className="text-sm text-slate-500">Caricamento problemi…</p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {issues.map((issue) => (
              <IssueBentoCard
                key={issue.id}
                issue={issue}
                simulated={simulatedIds.includes(issue.id)}
                onToggleSimulate={() => {
                  setSimulatedIds((prev) => {
                    if (prev.includes(issue.id)) return prev.filter((id) => id !== issue.id);
                    if (prev.length >= 3) return prev;
                    return [...prev, issue.id];
                  });
                }}
                onRegister={() => onRegisterIssueEvent(issue)}
              />
            ))}
          </div>
      </div>
    </section>
  );
}

function IssueBentoCard({
  issue,
  simulated,
  onToggleSimulate,
  onRegister,
}: {
  issue: TerritoryIssue;
  simulated: boolean;
  onToggleSimulate: () => void;
  onRegister: () => void;
}) {
  const conv = issue.conversion;
  const note =
    conv?.conversionBadge === "MURO_PD"
      ? "Frenato da storico voto PD"
      : "Da elettori Lega/FdI e astenuti";

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border bg-[#0A0E17] ${
        simulated ? "border-emerald-500/50 ring-1 ring-emerald-500/40" : "border-white/[0.08]"
      }`}
    >
      <div className="space-y-2 border-b border-white/[0.06] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-[9px] font-bold text-amber-200">
            {issue.categoria}
          </span>
          <span className="text-[10px] text-slate-500">{issue.provinciaComune}</span>
        </div>
        <span className="inline-block text-[10px] text-rose-300/90">
          {issue.visualizzazioniStimate}
        </span>
        <h3 className="text-sm font-semibold leading-snug text-white">
          {cleanIssueHeadline(issue.titoloProblema)}
        </h3>
        <p className="rounded-lg bg-white/[0.04] px-2 py-1 text-[10px] text-slate-400">
          {issue.datoUfficialeModuloB.slice(0, 120)}
          {issue.datoUfficialeModuloB.length > 120 ? "…" : ""}
        </p>
      </div>
      <div className="space-y-2 border-b border-white/[0.06] p-4">
        {conv && (
          <>
            <p className="font-mono text-[9px] uppercase text-cyan-400">Promessa FN</p>
            <p className="text-xs font-medium text-white">
              {conv.fnPromise.id} · {conv.fnPromise.shortTitle}
            </p>
            <p className="text-[11px] leading-relaxed text-slate-400 line-clamp-2">
              {conv.fnPromise.testo}
            </p>
          </>
        )}
        <p className="text-[11px] text-slate-400">
          <span className="text-slate-300">Dove andare:</span>{" "}
          {issue.azionePoliticaConsigliata.doveAndare.slice(0, 100)}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          {conv && (
            <>
              <p className="font-mono text-lg font-bold text-emerald-300">
                +{formatDecimalIt(conv.potentialGainPp, 2)} pp
              </p>
              <p className="font-mono text-xs text-slate-400">
                +{formatIntIt(conv.potentialNewVotes)} voti · {note}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onToggleSimulate}
            className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${
              simulated
                ? "bg-emerald-500/25 text-emerald-100"
                : "border border-violet-500/40 text-violet-200 hover:bg-violet-500/10"
            }`}
          >
            {simulated
              ? "Intervento incluso nella stima (+voti attivo)"
              : "+ Calcola impatto se interveniamo"}
          </button>
          <button
            type="button"
            onClick={onRegister}
            className="text-[10px] text-slate-500 hover:text-white"
          >
            Registra evento
          </button>
        </div>
      </div>
    </article>
  );
}
