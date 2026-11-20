"use client";

import { useState } from "react";
import type { GrowthEvidence, HorizonProjection } from "@/lib/engine/growthTrajectory";
import {
  buildExecutiveStrategicBriefing,
  type FactorStatus,
} from "@/lib/engine/strategicBriefingEngine";
import { scoreHeadline } from "@/lib/engine/growthEvidence";
import { formatDecimalIt, formatPpSignedIt } from "@/lib/formatIt";
import type { Region } from "@/lib/engine/constants";

function statusClass(status: FactorStatus): string {
  if (status === "CRITICO") return "border-rose-400/40 text-rose-200";
  if (status === "FAVOREVOLE") return "border-emerald-400/40 text-emerald-200";
  return "border-[#243044] text-slate-300";
}

function wordBadge(title: string): string {
  const score = scoreHeadline(title);
  if (score < 0) return "[-1 calo/scende/perde]";
  if (score > 0) return "[+1 cresce/supera]";
  return "[0 neutro]";
}

export function StrategicBriefingPanel({
  startPct,
  evidence,
  projection,
  abstentionShare,
  scenarioRows,
  simulated,
  onSimulate,
}: {
  startPct: number;
  evidence: GrowthEvidence;
  projection: HorizonProjection;
  abstentionShare: number;
  scenarioRows?: {
    regione: Region;
    preferenze: number;
    tipo_preferenze: "osservato" | "ricostruito";
    iscritti: number;
  }[];
  simulated: boolean;
  onSimulate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const brief = buildExecutiveStrategicBriefing({
    startPct,
    evidence,
    projection,
    abstentionShare,
    scenarioRows,
  });
  const stories: { title: string; url?: string }[] =
    evidence.newsItems ?? evidence.newsHeadlines.map((title) => ({ title }));

  async function copyDeclaration() {
    try {
      await navigator.clipboard.writeText(brief.remediationPlan.dichiarazione);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="mt-6 space-y-4">
      <div>
        <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/90">
          Diagnosi strategica · perché il consenso si muove così
        </h3>
        <article className="mt-3 rounded-xl border border-[#1B2436] bg-[#0B111E] p-3.5">
          <p className="text-[15px] font-medium leading-relaxed text-white">
            {brief.causalDiagnosis.sintesiEsecutiva}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
            {brief.causalDiagnosis.anatomiaDelMovimento}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
            {brief.causalDiagnosis.analisiRischioOpportunita}
          </p>
        </article>
        <p className="mt-3 text-[11px] leading-snug text-slate-500">
          Congiuntura e servizi sono contesto macro: descrivono il clima e non entrano nel saldo dei punti.
        </p>
        <div className="mt-3 grid gap-2">
          {brief.macroFactors.map((factor) => (
            <article key={factor.id} className="rounded-xl border border-[#1B2436] bg-[#0B111E] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13px] font-medium text-white">{factor.name}</p>
                <span className="border border-cyan-500/30 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">
                  Peso di lettura {factor.weightPct}%
                </span>
                <span className={`border px-1.5 py-0.5 font-mono text-[9px] ${statusClass(factor.status)}`}>
                  {factor.status}
                </span>
                <span className="font-mono text-[10px] text-slate-300">
                  {factor.impactPp == null
                    ? "CONTESTO MACRO (NON SOMMATO)"
                    : formatPpSignedIt(factor.impactPp, 2)}
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-slate-300">{factor.evidence}</p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-slate-500">{factor.sourceLabel}</p>
            </article>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-300/90">
          Piano di contro-offensiva
        </h3>
        <div className="mt-3 space-y-3">
          <article className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5">
            <p className="font-mono text-[10px] text-emerald-200">01 · Regola di ingaggio</p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-100">{brief.remediationPlan.regolaAurea}</p>
          </article>
          <article className="rounded-xl border border-[#1B2436] bg-[#0B111E] p-3.5">
            <p className="font-mono text-[10px] text-slate-400">02 · Tre leve da scheda di programma</p>
            <ul className="mt-2 space-y-3">
              {brief.remediationPlan.atti.map((act) => (
                <li key={act.title}>
                  <p className="text-[13px] font-medium text-white">{act.title}</p>
                  <p className="mt-1 font-mono text-[10px] text-cyan-200/80">{act.chapter} · {act.ente} · {act.tempi}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-300">{act.body}</p>
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border border-amber-400/30 bg-amber-500/[0.06] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] text-amber-200">03 · Dichiarazione per agenzie e TV · Bozza</p>
              <button
                type="button"
                onClick={() => void copyDeclaration()}
                className="border border-amber-400/40 px-2 py-1 font-mono text-[10px] text-amber-100"
              >
                {copied ? "Copiata" : "Copia dichiarazione"}
              </button>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-white">{brief.remediationPlan.dichiarazione}</p>
          </article>
          <article className="rounded-xl border border-[#1B2436] bg-[#0B111E] p-3.5">
            <p className="font-mono text-[10px] text-slate-400">04 · Dove andare · stima</p>
            <ul className="mt-2 space-y-3">
              {brief.remediationPlan.direttrici.map((row) => (
                <li key={row.region} className="text-[13px] leading-snug text-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white">{row.region}</span>
                    <span className="border border-[#243044] px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
                      {row.basin}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      Stima di permeabilità {row.permeabilita}/100
                    </span>
                  </div>
                  <p className="mt-1">Piazza: {row.piazza}</p>
                  <p className="mt-1 text-slate-300">Leva: {row.leva}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-300">
                    Europee 2024 · FdI {formatDecimalIt(row.fdiPct, 1)}% + Lega{" "}
                    {formatDecimalIt(row.legaPct, 1)}% = centrodestra {formatDecimalIt(row.cdxPct, 1)}%
                    {" · "}PD {formatDecimalIt(row.pdPct, 1)}%
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">
                    {row.preferenze == null
                      ? "Preferenze europee non disponibili in questo scenario."
                      : row.preferenzeTipo === "osservato"
                        ? `Preferenze Vannacci certificate: ${row.preferenze.toLocaleString("it-IT")}.`
                        : `Preferenze Vannacci ripartite dalla circoscrizione, non un conteggio regionale pubblicato: ${row.preferenze.toLocaleString("it-IT")}.`}
                    {row.iscritti != null
                      ? ` Tesserati FN: ${row.iscritti.toLocaleString("it-IT")}.`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onSimulate}
              className="mt-3 border border-cyan-400/40 px-2 py-1 font-mono text-[10px] text-cyan-100"
            >
              {simulated ? "Contro-offensiva già sulla curva" : "Simula effetto contro-offensiva sulla curva"}
            </button>
          </article>
        </div>
      </div>

      <div>
        <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          Titoli in finestra e fonti verificate
          {evidence.newsHeadlines.length > 0
            ? ` · segno dalle parole del titolo ${evidence.newsScore.toFixed(2).replace(".", ",")}`
            : ""}
        </h3>
        <ul className="mt-2 space-y-1.5">
          {evidence.sources
            ?.filter((source) => source.kind !== "notizia")
            .map((source) => (
              <li key={`${source.kind}-${source.label}`}>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-cyan-400 underline decoration-cyan-500/30 underline-offset-2">
                    {source.label} ↗
                  </a>
                ) : (
                  <span className="font-mono text-[10px] text-slate-500">{source.label}</span>
                )}
              </li>
            ))}
          {stories.map((story) => (
            <li key={story.url ?? story.title} className="flex items-start justify-between gap-2">
              {story.url ? (
                <a href={story.url} target="_blank" rel="noopener noreferrer" className="min-w-0 font-mono text-[10px] text-cyan-400 underline decoration-cyan-500/30 underline-offset-2">
                  {story.title} ↗
                </a>
              ) : (
                <span className="min-w-0 font-mono text-[10px] text-slate-400">{story.title}</span>
              )}
              <span className="shrink-0 border border-[#243044] px-1 py-0.5 font-mono text-[9px] text-slate-300">
                {wordBadge(story.title)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
