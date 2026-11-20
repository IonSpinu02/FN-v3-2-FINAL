"use client";

import type { Region } from "@/lib/engine/constants";
import { REGIONS } from "@/lib/engine/constants";
import { scopeLabel, TERRITORY_NAZIONALE } from "@/lib/engine/osservatorioTerritoryScope";
import type { TerritoryScope } from "@/lib/engine/osservatorioTerritoryScope";
import type { ScenarioResult } from "@/lib/engine/types";
import { useLiveGoogleTrends } from "@/components/osservatorio/useLiveGoogleTrends";
import {
  computeTrendElectoralImpact,
  defaultSelectedTrendId,
  filterTrendsByCluster,
  resolveTrendRegionForElectoral,
  sortTrendsByAttention,
  TRENDS_CLUSTER_LABELS,
  validVotesFromScenarioRow,
  type TargetedTrendItem,
  type TrendsClusterFilter,
  type TrendsTerritoryMode,
} from "@/lib/googleTrendsIntelligence";
import { useEffect, useMemo, useState } from "react";

const BENTO =
  "rounded-2xl border border-white/[0.08] bg-[#090D16] p-5 md:p-6";

const CLUSTER_PILLS: { id: TrendsClusterFilter; label: string }[] = [
  { id: "SURGE_ALL", label: "Tutte le Ricerche in Impennata" },
  { id: "PARTITO_LEADER", label: "Partito & Vannacci" },
  { id: "SANITA_CUP", label: "Sanità & Liste d'Attesa" },
  { id: "SICUREZZA_CITTA", label: "Sicurezza & Degrado" },
  { id: "LAVORO_AUTO_GREEN", label: "Lavoro, Auto & Norme Green" },
  { id: "FAMIGLIA_CASA", label: "Casa, Mutui & Caro-Vita" },
  { id: "TRASPORTI_PENDOLARI", label: "Treni, Strade & Pendolari" },
  { id: "AGRICOLTURA_TERRITORIO", label: "Agricoltura & Territorio" },
];

function territoryFromScope(
  trendsMode: "NAZIONALE" | "REGIONALE",
  regione: Region,
): TrendsTerritoryMode {
  return trendsMode === "NAZIONALE" ? "NAZIONALE" : regione;
}

function territoryDisplayLabel(mode: TrendsTerritoryMode): string {
  return mode === "NAZIONALE" ? "ITALIA (NAZIONALE)" : mode.toUpperCase();
}

function TrendRow({
  item,
  active,
  onSelect,
}: {
  item: TargetedTrendItem;
  active: boolean;
  onSelect: () => void;
}) {
  const typeShort =
    item.queryType === "Argomento riconosciuto da Google"
      ? "Argomento Google"
      : "Termine testuale";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
        active
          ? "border-violet-500/50 bg-violet-500/[0.08]"
          : "border-white/[0.06] bg-black/20 hover:border-white/15"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[12px] font-medium leading-snug text-slate-100">
          &quot;{item.exactQuery}&quot;
        </p>
        <div className="flex shrink-0 flex-wrap gap-1">
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] uppercase text-slate-400">
            {typeShort}
          </span>
          <span
            className={`rounded-md px-1.5 py-0.5 font-mono text-[9px] font-semibold ${
              item.provenance === "google_rss"
                ? "bg-cyan-500/15 text-cyan-200"
                : "bg-amber-500/15 text-amber-200"
            }`}
          >
            {item.provenance === "google_rss" ? item.surgePct : "scheda, non misura"}
          </span>
          {item.provenance === "google_rss" ? (
            <span className="rounded-md bg-violet-500/15 px-1.5 py-0.5 font-mono text-[9px] text-violet-200">
              {item.currentIndex0100} / 100
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {item.relatedQueries.map((q) => (
          <span
            key={q}
            className="rounded-full border border-white/[0.06] bg-[#0A0E17] px-2 py-0.5 text-[9px] text-slate-500"
          >
            {q}
          </span>
        ))}
      </div>
    </button>
  );
}

export function OsservatorioGoogleTrendsConsole({
  mainTerritory,
  regione,
  setRegione,
  setMainTerritory,
  scenario,
}: {
  mainTerritory: TerritoryScope;
  regione: Region;
  setRegione: (r: Region) => void;
  setMainTerritory: (t: TerritoryScope) => void;
  scenario: ScenarioResult;
}) {
  const [trendsMode, setTrendsMode] = useState<"NAZIONALE" | "REGIONALE">(
    mainTerritory === TERRITORY_NAZIONALE ? "NAZIONALE" : "REGIONALE",
  );
  const [clusterFilter, setClusterFilter] = useState<TrendsClusterFilter>("SURGE_ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (mainTerritory === TERRITORY_NAZIONALE) setTrendsMode("NAZIONALE");
    else setTrendsMode("REGIONALE");
  }, [mainTerritory]);

  const territory = territoryFromScope(trendsMode, regione);

  const { trends: allTrends, loading: trendsLoading, fetchedAt: trendsFetchedAt } =
    useLiveGoogleTrends(territory);

  const filtered = useMemo(() => {
    const base = filterTrendsByCluster(allTrends, clusterFilter);
    return sortTrendsByAttention(base.length ? base : allTrends);
  }, [allTrends, clusterFilter]);

  useEffect(() => {
    const id = defaultSelectedTrendId(filtered);
    setSelectedId((prev) =>
      prev && filtered.some((f) => f.id === prev) ? prev : id,
    );
  }, [filtered]);

  const selected =
    filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null;

  const electoralRegion = resolveTrendRegionForElectoral(territory, regione);
  const row = scenario.righe.find((r) => r.regione === electoralRegion);
  const validVotes = row
    ? validVotesFromScenarioRow(row.voti_di_scenario, row.stima)
    : 1_200_000;

  const electoral = selected
    ? computeTrendElectoralImpact(electoralRegion, selected, validVotes)
    : null;

  const territoryLabel = territoryDisplayLabel(territory);

  function onTrendsModeChange(mode: "NAZIONALE" | "REGIONALE") {
    setTrendsMode(mode);
    if (mode === "NAZIONALE") setMainTerritory(TERRITORY_NAZIONALE);
    else {
      setMainTerritory(regione);
      setRegione(regione);
    }
  }

  return (
    <section id="oss-google-trends" className="scroll-mt-28 space-y-5">
      <header className="px-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-violet-400/90">
          Temi e Domande dei Cittadini · Repertorio operativo
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Ricerche mirate &amp; piani di soluzione
        </h2>
        <p className="mt-1 max-w-3xl text-[12px] text-slate-500">
          Scala 0–100 (interesse relativo). Livello 1 Attenzione (Trends) ≠ Livello 2
          Valutazione (sondaggi) ≠ Livello 3 Voto dichiarato — § 5 Osservatorio.
        </p>
      </header>

      <div className={`${BENTO} space-y-4`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onTrendsModeChange("NAZIONALE")}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium ${
                trendsMode === "NAZIONALE"
                  ? "bg-white text-black"
                  : "border border-white/10 text-slate-400"
              }`}
            >
              Italia · Impostazione nazionale (§6)
            </button>
            <button
              type="button"
              onClick={() => onTrendsModeChange("REGIONALE")}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium ${
                trendsMode === "REGIONALE"
                  ? "bg-white text-black"
                  : "border border-white/10 text-slate-400"
              }`}
            >
              Analisi regionale
            </button>
            {trendsMode === "REGIONALE" && (
              <select
                value={regione}
                onChange={(e) => {
                  const r = e.target.value as Region;
                  setRegione(r);
                  setMainTerritory(r);
                }}
                className="rounded-lg border border-white/10 bg-[#0A0E17] px-2 py-1.5 text-[11px] text-white"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {CLUSTER_PILLS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setClusterFilter(p.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-[10px] ${
                clusterFilter === p.id
                  ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40"
                  : "border border-white/[0.06] text-slate-500 hover:text-slate-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[9px] text-slate-600">
          Territorio attivo: {scopeLabel(mainTerritory)} · Tema:{" "}
          {clusterFilter === "SURGE_ALL"
            ? "Impennate"
            : TRENDS_CLUSTER_LABELS[clusterFilter]}
        </p>
      </div>

      <div className={BENTO}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
            Domande ricorrenti sul territorio (selezione editoriale, non misurazione Google Trends) · {territoryLabel}
          </h3>
          {trendsFetchedAt ? (
            <p className="font-mono text-[9px] text-slate-600">
              Google ·{" "}
              {new Date(trendsFetchedAt).toLocaleString("it-IT", {
                timeZone: "Europe/Rome",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>
        <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {trendsLoading && filtered.length === 0 ? (
            <p className="text-xs text-slate-500">Caricamento trend live…</p>
          ) : null}
          {filtered.map((item) => (
            <TrendRow
              key={item.id}
              item={item}
              active={item.id === selected?.id}
              onSelect={() => setSelectedId(item.id)}
            />
          ))}
        </div>
      </div>

      {selected && (
        <div className={BENTO}>
          <h3 className="font-mono text-[11px] uppercase tracking-wide text-emerald-400">
            Piano di soluzione concreta // Come risolvere: &quot;
            {selected.exactQuery.toUpperCase()}&quot; in {territoryLabel}
          </h3>
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-3 text-[12px] text-slate-400">
              <p className="font-mono text-[9px] uppercase text-slate-500">
                1. Contesto del disagio
                {selected.provenance === "google_rss" ? "" : " · repertorio, non misura"}
              </p>
              <p>
                <strong className="text-slate-200">Causa del picco:</strong>{" "}
                {selected.pianoRisoluzione.causaRadice}
              </p>
              <p>
                <strong className="text-slate-200">
                  {selected.provenance === "google_rss"
                    ? "Cronaca del feed:"
                    : "Nota di scheda, non una misura:"}
                </strong>{" "}
                {selected.datoOggettivoModuloB}
              </p>
              <p>
                <strong className="text-slate-200">Correlati frequenti:</strong>{" "}
                {selected.relatedQueries.join(" · ")}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4 text-[12px] text-slate-300">
              <p className="font-mono text-[9px] uppercase text-slate-500">
                {selected.pianoRisoluzione.bipBadgeLabel}
              </p>
              <p className="mt-2 font-mono text-[9px] uppercase text-emerald-400">
                2. Come si risolve davvero (soluzione pratica e normativa)
              </p>
              <p className="mt-3 leading-relaxed">
                {selected.pianoRisoluzione.soluzionePratica}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-lg border border-emerald-500/30 bg-black/30 px-2 py-1 font-mono text-[9px] text-emerald-200">
                  Competenza: {selected.pianoRisoluzione.enteCompetente}
                </span>
                <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-[9px] text-slate-300">
                  Tempi: {selected.pianoRisoluzione.tempiAttuazione}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-[12px] text-slate-400">
              <p className="font-mono text-[9px] uppercase text-slate-500">
                3. Azione di Futuro Nazionale &amp; ritorno elettorale
              </p>
              <p>
                <strong className="text-slate-200">Prossime 48 ore:</strong>{" "}
                {selected.pianoRisoluzione.azioneSulCampo48h}
              </p>
              {electoral && (
                <div
                  className={`rounded-xl border p-3 font-mono text-[10px] ${
                    electoral.kind === "high"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                  }`}
                >
                  <span
                    className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${
                      electoral.kind === "high" ? "bg-emerald-400" : "bg-rose-500"
                    }`}
                    aria-hidden
                  />
                  {electoral.label}
                  <p className="mt-2 font-sans text-[10px] text-slate-500">
                    {electoral.historyNote}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
