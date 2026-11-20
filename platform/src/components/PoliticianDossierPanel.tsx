"use client";

import { buildPoliticianDossierAnalytics } from "@/lib/politicalDefectionsDossier";
import {
  passaggioCompattoLine,
  ruoloBadgeShort,
  ruoloPrefix,
  type TrackedPolitician,
} from "@/lib/politicalDefectionsEngine";
import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import Link from "next/link";
import { useMemo, useState } from "react";

function formatDateIt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("it-IT", {
      timeZone: "Europe/Rome",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function statoBadge(p: TrackedPolitician): { label: string; className: string } {
  if (p.statoAdesioneFN === "Ufficiale in FN") {
    return { label: "In FN", className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200" };
  }
  if (p.statoAdesioneFN === "Uscito nel Misto (Contendibile)") {
    return {
      label: "Contendibile nel Misto",
      className: "border-cyan-500/40 bg-cyan-500/15 text-cyan-200",
    };
  }
  if (p.partitoProvenienza === "Lega" || p.partitoProvenienza === "Fratelli d'Italia") {
    return {
      label: `Uscito da ${p.partitoProvenienza === "Lega" ? "Lega" : "FdI"}`,
      className: "border-amber-500/40 bg-amber-500/15 text-amber-100",
    };
  }
  return {
    label: p.statoAdesioneFN ?? "Monitorato",
    className: "border-white/15 bg-white/5 text-slate-300",
  };
}

export function PoliticianDossierPanel({
  politician,
  onSimula,
  simulated = false,
}: {
  politician: TrackedPolitician;
  onSimula?: () => void;
  simulated?: boolean;
}) {
  const analytics = useMemo(
    () => buildPoliticianDossierAnalytics(politician),
    [politician],
  );
  const badge = statoBadge(politician);
  const [scenarioId, setScenarioId] = useState<"min" | "base" | "max">("base");
  const scenario = analytics.scenari.find((s) => s.id === scenarioId) ?? analytics.scenari[1]!;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app/news"
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white"
        >
          ← Torna a tutti i cambi di partito
        </Link>
        <button
          type="button"
          onClick={onSimula}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            simulated
              ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
              : "border-emerald-500/35 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
          }`}
        >
          {simulated ? "In simulazione FN" : "+ Simula Ingresso in Futuro Nazionale"}
        </button>
      </div>

      <header className="rounded-2xl border border-white/[0.08] bg-[#090D16] p-5 lg:p-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Dossier esponente · Beneficio FN
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
              {ruoloPrefix(politician.ruolo)} {politician.nome}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {politician.ruolo} · {politician.regione} · {politician.collegioDisplay}
              <span className="ml-2 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                {ruoloBadgeShort(politician.ruolo)}
              </span>
            </p>
          </div>
          <span
            className={`shrink-0 rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <TimelineCard
            label="Partito / collegio di elezione"
            value={analytics.timeline.elezione}
          />
          <TimelineCard
            label="Gruppo attuale"
            value={analytics.timeline.gruppoAttuale}
          />
          <TimelineCard
            label="Data atto / cambio"
            value={formatDateIt(analytics.timeline.dataAtto)}
          />
        </div>
        <p className="mt-3 text-sm text-slate-300">
          Transizione: <span className="font-medium text-white">{passaggioCompattoLine(politician)}</span>
        </p>
      </header>

      <section className="rounded-2xl border border-white/[0.08] bg-[#090D16] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
          Fonti certificate del cambio partito
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {politician.fonteIstituzionale?.url ? (
            <a
              href={politician.fonteIstituzionale.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.07] p-4 transition hover:border-cyan-400/40"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/80">
                Atto istituzionale
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {politician.fonteIstituzionale.label}
              </p>
              <p className="mt-2 text-xs text-cyan-200/90">
                Verifica Atto Parlamentare ↗ · {politician.fonteIstituzionale.tipo}
              </p>
            </a>
          ) : (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              Fonte istituzionale mancante
            </p>
          )}
          {politician.fonteStampa?.url ? (
            <a
              href={politician.fonteStampa.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4 transition hover:border-amber-400/40"
              title={politician.fonteStampa.titoloArticolo}
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-amber-300/80">
                Fonte stampa · {politician.fonteStampa.testata}
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {politician.fonteStampa.titoloArticolo}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">{politician.fonteStampa.data}</p>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-300">
                «{politician.fonteStampa.estratto}»
              </p>
              <p className="mt-2 text-xs text-amber-200/90">Apri articolo originale ↗</p>
            </a>
          ) : (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              Fonte stampa obbligatoria mancante
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#090D16] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
          Quale beneficio porterebbe a Futuro Nazionale?
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {analytics.scenari.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenarioId(s.id)}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
                scenarioId === s.id
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                  : "border-white/10 text-slate-400 hover:text-slate-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Metric
            label="Voti stimati"
            value={`+${formatIntIt(scenario.voti)}`}
            sub={scenario.descrizione}
          />
          <Metric
            label="Spinta regionale"
            value={`+${formatDecimalIt(scenario.pp, 2)} pp`}
            sub={`${politician.regione}: ${formatDecimalIt(politician.beneficioIngressoFn?.regioneOggiPct ?? 0, 2)}% → ${formatDecimalIt((politician.beneficioIngressoFn?.regioneOggiPct ?? 0) + scenario.pp, 2)}%`}
          />
          <Metric
            label="Prob. soglia 3%"
            value={`${analytics.probabilitaSoglia3Pct.prima}% → ${analytics.probabilitaSoglia3Pct.dopo}%`}
            sub={`Δ consenso scenario: +${formatDecimalIt(analytics.probabilitaSoglia3Pct.deltaPp, 2)} pp`}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Impatto Indice Presenze (m_r)
            </p>
            <p className="mt-2 font-mono text-2xl font-bold text-emerald-400">
              +{analytics.pilastroMr.puntiPesoMr} punti peso
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {analytics.pilastroMr.note}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Scomposizione del bacino
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
              <li>Recupero da {politician.partitoProvenienza}: {analytics.bacino.recuperoExPartitoPct}%</li>
              <li>Mobilitazione astenuti locali: {analytics.bacino.astenutiLocaliPct}%</li>
              <li>Radicamento associativo/categorie: {analytics.bacino.radicamentoAssociativoPct}%</li>
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">{analytics.bacino.note}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#090D16] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
          Affinità B.I.P. & rischi di acquisizione
        </h2>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Indice affinità FN
            </p>
            <p className="mt-1 font-mono text-3xl font-bold text-white">
              {analytics.affinita.score0100}
              <span className="text-lg text-slate-400">/100</span>
            </p>
          </div>
          <p className="max-w-xl flex-1 text-sm leading-relaxed text-slate-400">
            {analytics.affinita.motivazione}
          </p>
        </div>
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Capitoli B.I.P. valorizzabili
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {analytics.capitoliBip.map((c) => (
              <span
                key={c}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-200"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <p className="text-sm font-medium text-slate-200">
            {analytics.tattiche.beneficioFnSintesi}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Rischio attrito base locale: {analytics.tattiche.rischioAttritoBaseLocale}
          </p>
          {analytics.tattiche.cautele.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-100/90">
              {analytics.tattiche.cautele.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function TimelineCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium leading-snug text-slate-100">{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold text-emerald-400">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{sub}</p>
    </div>
  );
}
