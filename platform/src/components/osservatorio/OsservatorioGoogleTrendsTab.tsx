"use client";

import type { Region } from "@/lib/engine/constants";
import type { ScenarioResult } from "@/lib/engine/types";
import type { TerritoryScope } from "@/lib/engine/osservatorioTerritoryScope";
import {
  breakoutRelatedQueries,
  bipPillarLabelForTrend,
  computeTrendElectoralImpact,
  ensureTrendSeries30d,
  filterTrendsByCluster,
  type TargetedTrendItem,
  type TrendsClusterFilter,
} from "@/lib/googleTrendsIntelligence";
import type { CockpitTierFilter } from "@/lib/osservatorioCockpitTiers";
import { useEffect, useMemo, useState } from "react";

const SCROLL_HIDDEN =
  "flex-1 min-h-0 space-y-2 overflow-y-auto pr-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const CLUSTER_PILLS: { id: TrendsClusterFilter; label: string }[] = [
  { id: "SURGE_ALL", label: "Tutte" },
  { id: "SANITA_CUP", label: "Sanità" },
  { id: "SICUREZZA_CITTA", label: "Sicurezza" },
  { id: "TRASPORTI_PENDOLARI", label: "Trasporti" },
  { id: "LAVORO_AUTO_GREEN", label: "Lavoro" },
  { id: "FAMIGLIA_CASA", label: "Famiglia" },
  { id: "AGRICOLTURA_TERRITORIO", label: "Agricoltura" },
];

function TrendSparkline({ points }: { points: { value: number }[] }) {
  const w = 112;
  const h = 34;
  const vals = points.slice(-30).map((p) => p.value);
  if (vals.length < 2) return null;
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  const d = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 text-emerald-400/90" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function OsservatorioGoogleTrendsTab({
  regione,
  trendsTerritoryLabel,
  trends,
  loading,
  fetchedAt,
  source,
  validVotes,
  simulatedTrendIds: _simulatedTrendIds,
  onToggleTrendSimulate: _onToggleTrendSimulate,
  mainTerritory: _mainTerritory,
  liveS: _liveS,
  scenario: _scenario,
  tierFilter: _tierFilter,
  setTierFilter: _setTierFilter,
  metricsByRegion: _metricsByRegion,
  activeRegionMetrics: _activeRegionMetrics,
  setRegione: _setRegione,
  setMainTerritory: _setMainTerritory,
}: {
  regione: Region;
  /** Etichetta header (es. «Italia» in quadro nazionale). */
  trendsTerritoryLabel?: string;
  trends: TargetedTrendItem[];
  loading: boolean;
  fetchedAt: string | null;
  source: "google_rss" | "fallback";
  validVotes: number;
  simulatedTrendIds: string[];
  onToggleTrendSimulate: (trendId: string) => void;
  mainTerritory: TerritoryScope;
  liveS: number;
  scenario: ScenarioResult;
  tierFilter: CockpitTierFilter;
  setTierFilter: (f: CockpitTierFilter) => void;
  metricsByRegion: Map<Region, import("@/lib/osservatorioCockpitTiers").RegionCockpitMetrics>;
  activeRegionMetrics: import("@/lib/osservatorioCockpitTiers").RegionCockpitMetrics;
  setRegione: (r: Region) => void;
  setMainTerritory: (t: TerritoryScope) => void;
}) {
  void _simulatedTrendIds;
  void _onToggleTrendSimulate;
  void _mainTerritory;
  void _liveS;
  void _scenario;
  void _tierFilter;
  void _setTierFilter;
  void _metricsByRegion;
  void _activeRegionMetrics;
  void _setRegione;
  void _setMainTerritory;
  const [clusterFilter, setClusterFilter] = useState<TrendsClusterFilter>("SURGE_ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const base =
      clusterFilter === "SURGE_ALL"
        ? trends
        : filterTrendsByCluster(trends, clusterFilter);
    return base.length ? base : trends;
  }, [trends, clusterFilter]);

  useEffect(() => {
    setSelectedId((prev) => {
      if (prev && filtered.some((t) => t.id === prev)) return prev;
      return filtered[0]?.id ?? null;
    });
  }, [filtered]);

  const selected = useMemo(
    () => filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const selectedEnriched = useMemo(
    () => (selected ? ensureTrendSeries30d(selected) : null),
    [selected],
  );

  const breakouts = useMemo(
    () => (selected ? breakoutRelatedQueries(selected) : []),
    [selected],
  );

  const electoral = useMemo(
    () =>
      selectedEnriched
        ? computeTrendElectoralImpact(regione, selectedEnriched, validVotes)
        : null,
    [selectedEnriched, regione, validVotes],
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[5fr_7fr]">
        <div className="min-w-0">
          <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3.5">
            <div className="mb-2.5 shrink-0 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                  Temi ricorrenti e domande dei cittadini · Repertorio operativo B.I.P. ·{" "}
                  {(trendsTerritoryLabel ?? regione).toUpperCase()}
                </p>
                {fetchedAt ? (
                  <p className="font-mono text-[9px] text-slate-500">
                    {source === "google_rss"
                      ? `Aggiornamento feed · ${new Date(fetchedAt).toLocaleString("it-IT", {
                          timeZone: "Europe/Rome",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : "Selezione editoriale · non misurazione"}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1">
                {CLUSTER_PILLS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setClusterFilter(p.id)}
                    className={`rounded-md px-2 py-0.5 text-[9px] font-medium ${
                      clusterFilter === p.id
                        ? "border border-white/20 bg-white/12 text-white"
                        : "border border-transparent text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {loading && filtered.length === 0 ? (
              <p className="text-xs text-slate-500">Caricamento trend…</p>
            ) : (
              <div className={SCROLL_HIDDEN}>
                {filtered.map((t) => {
                  const active = t.id === selected?.id;
                  const idx = t.currentIndex0100;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={`relative w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-emerald-400/80 bg-emerald-500/[0.10]"
                          : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14]"
                      }`}
                    >
                      {active ? (
                        <span
                          className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-emerald-400"
                          aria-hidden
                        />
                      ) : null}
                      <div className="flex items-center justify-between gap-2 pl-1">
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase text-slate-300">
                          {bipPillarLabelForTrend(t)}
                        </span>
                        <div className="flex shrink-0 items-center gap-2 font-mono">
                          {t.provenance === "google_rss" ? (
                            <span className="max-w-[8.5rem] text-right text-[10px] leading-tight text-cyan-200">
                              {t.surgePct}
                            </span>
                          ) : (
                            <span className="text-right text-[9px] uppercase tracking-wide text-slate-400">
                              scheda, non misura
                            </span>
                          )}
                          {t.provenance === "google_rss" ? (
                            <span className="text-[11px] text-slate-400">Indice {idx}/100</span>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-1.5 pl-0.5 text-xs font-semibold leading-snug text-white">
                        {t.exactQuery}
                      </p>
                      <div className="mt-2 h-1 rounded-full bg-white/[0.06] pl-0.5">
                        <div
                          className="h-1 rounded-full bg-emerald-400/80"
                          style={{ width: `${idx}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Colonna centrale — h-auto, nessuna compressione flex */}
        <div className="flex h-auto min-w-0 flex-col gap-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
          {selectedEnriched ? (
            <>
              <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.06] pb-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    {bipPillarLabelForTrend(selectedEnriched)}
                    {selectedEnriched.provenance === "google_rss"
                      ? " · traffico dal feed Google"
                      : " · repertorio operativo B.I.P."}
                  </p>
                  <h3 className="mt-0.5 text-lg font-bold leading-snug text-white">
                    &quot;{selectedEnriched.exactQuery}&quot;
                  </h3>
                </div>
                <div className="shrink-0 text-right font-mono">
                  {selectedEnriched.provenance === "google_rss" ? (
                    <>
                      <p className="max-w-[10rem] text-[11px] leading-tight text-cyan-200">
                        {selectedEnriched.surgePct}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Indice {selectedEnriched.currentIndex0100}/100
                      </p>
                    </>
                  ) : (
                    <p className="max-w-[9rem] text-[10px] uppercase leading-tight tracking-wide text-slate-400">
                      scheda, non misura
                    </p>
                  )}
                </div>
              </header>

              <section className="shrink-0">
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Domande ricorrenti sul territorio (selezione editoriale, non
                  misurazione Google Trends)
                </p>
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {breakouts.map((b) => (
                    <li
                      key={b.query}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-xs"
                      title={b.query}
                    >
                      <span className="min-w-0 truncate text-slate-200">
                        &quot;{b.query}&quot;
                      </span>
                      <span className="shrink-0 text-right font-mono text-[9px] uppercase tracking-wide text-slate-500">
                        domanda tipica
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="shrink-0 space-y-1.5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Contesto del disagio &amp; dato ufficiale
                </p>
                <p className="text-xs leading-relaxed text-slate-200">
                  <strong className="text-white">Causa:</strong>{" "}
                  {selectedEnriched.pianoRisoluzione.causaRadice}
                </p>
                <p className="text-xs leading-relaxed text-slate-300">
                  <strong className="text-white">
                    {selectedEnriched.provenance === "google_rss" ? "Cronaca del feed:" : "Nota di scheda:"}
                  </strong>{" "}
                  {selectedEnriched.datoOggettivoModuloB}
                </p>
              </section>

              <section className="shrink-0 space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5">
                <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                  {selectedEnriched.pianoRisoluzione.bipBadgeLabel}
                </p>
                <div className="space-y-2 rounded-lg border border-white/[0.06] bg-black/20 p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Cosa dichiarare alla stampa · Bozza
                  </p>
                  <p className="text-xs italic leading-relaxed text-slate-200">
                    &ldquo;{selectedEnriched.pianoRisoluzione.messaggioStampa}&rdquo;
                  </p>
                </div>
                <div className="space-y-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                    Come si risolve concretamente
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                    <span className="rounded border border-white/10 bg-black/40 px-2 py-0.5 text-slate-200">
                      Competenza: {selectedEnriched.pianoRisoluzione.enteCompetente}
                    </span>
                    <span className="rounded border border-white/10 bg-black/40 px-2 py-0.5 text-emerald-300">
                      Tempi: {selectedEnriched.pianoRisoluzione.tempiAttuazione}
                    </span>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-slate-100">
                  <strong className="text-emerald-300">1. Soluzione pratica:</strong>{" "}
                  {selectedEnriched.pianoRisoluzione.soluzionePratica}
                </p>
                <p className="text-xs leading-relaxed text-slate-200">
                  <strong className="text-emerald-300">2. Azione sul territorio:</strong>{" "}
                  {selectedEnriched.pianoRisoluzione.azioneSulCampo48h}
                </p>
                </div>
              </section>

              <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] pt-2">
                <div className="flex min-w-0 items-center gap-3">
                  <TrendSparkline points={selectedEnriched.series30d} />
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                      Domande ricorrenti sul territorio
                    </p>
                    <p className="text-sm text-slate-300">
                      {electoral?.label ?? "Serie live · nessun voto promesso"}
                    </p>
                  </div>
                </div>
              </footer>
            </>
          ) : (
            <p className="py-12 text-center text-sm text-slate-500">Seleziona una ricerca a sinistra</p>
          )}
        </div>

    </div>
  );
}
