"use client";

import {
  isOfficialFlussi,
  isOfficialParams,
  OFFICIAL_FLUSSI,
  OFFICIAL_PESI,
  OFFICIAL_S,
  type FlussiIpsos,
} from "@/lib/engine/defaults";
import {
  hasNonZeroIstituzioniDelta,
  mergeIstituzioniDeltas,
} from "@/lib/engine/mergeIstituzioniDelta";
import type { Region } from "@/lib/engine/constants";
import type { InstitutionalRow } from "@/lib/engine/calculate";
import {
  DEFAULT_POLL_CONFIG,
  type RegionPollResult,
  type RegionalPollConfig,
} from "@/lib/engine/regionalPollShared";
import type { CalculateOverrides } from "@/lib/engine/calculate";
import type { IstituzioniDeltaSummary } from "@/lib/engine/localiTypes";
import type { FnConfig, ScenarioResult } from "@/lib/engine/types";
import { pesiFromUi, SensitivityControls, uiFromPesi } from "@/components/SensitivityControls";
import { Btn, Panel, Segmented, StatusDot } from "@/components/ui/FnUi";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DisclaimerBanner } from "./DisclaimerBanner";
import { ItalyMap, type MapColorMode } from "./ItalyMap";
import { MetricCards } from "./MetricCards";
import { exportNotaPdf, PrintNotaReport } from "./PrintNotaReport";
import { RegionPollDrawer } from "./RegionPollDrawer";
import { RegionalPollControls } from "./RegionalPollControls";
import { RegionalPollTable } from "./RegionalPollTable";

const LocaliPanel = dynamic(
  () => import("./LocaliPanel").then((m) => m.LocaliPanel),
  { ssr: false, loading: () => <p className="text-sm text-fn-text-muted">Caricamento tab…</p> },
);
const HistoryPanel = dynamic(
  () => import("./HistoryPanel").then((m) => m.HistoryPanel),
  { ssr: false, loading: () => <p className="text-sm text-fn-text-muted">Caricamento tab…</p> },
);
const PostVotePanel = dynamic(
  () => import("./PostVotePanel").then((m) => m.PostVotePanel),
  { ssr: false, loading: () => <p className="text-sm text-fn-text-muted">Caricamento tab…</p> },
);

type Tab = "scenario" | "storico" | "postvoto" | "locali";

const NAV: { id: Tab; label: string; desc: string }[] = [
  {
    id: "scenario",
    label: "Scenario",
    desc: "Mappa, sensibilità, sondaggio simulato",
  },
  {
    id: "locali",
    label: "Locali & News",
    desc: "Registro comuni, RSS, delta istituzionale",
  },
  {
    id: "storico",
    label: "Storico iscritti",
    desc: "Monitoraggio mensile CSV",
  },
  {
    id: "postvoto",
    label: "Post-voto",
    desc: "Confronto con snapshot 18/10",
  },
];

export function DashboardClient({
  initialScenario,
  frozenSnapshot,
  fnConfig,
}: {
  initialScenario: ScenarioResult;
  frozenSnapshot: ScenarioResult;
  fnConfig: FnConfig;
}) {
  const [tab, setTab] = useState<Tab>("scenario");
  const [scenario, setScenario] = useState(initialScenario);
  const [S, setS] = useState(OFFICIAL_S);
  const [weights, setWeights] = useState(uiFromPesi(OFFICIAL_PESI));
  const [pollConfig, setPollConfig] = useState<RegionalPollConfig>({
    ...DEFAULT_POLL_CONFIG,
  });
  const [poll, setPoll] = useState<RegionPollResult[]>([]);
  const [mapMode, setMapMode] = useState<MapColorMode>("stima");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [mcLoading, setMcLoading] = useState(false);
  const [pollLoading, setPollLoading] = useState(false);
  const mcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  const [flussiIpsos, setFlussiIpsos] = useState<FlussiIpsos>({
    ...OFFICIAL_FLUSSI,
  });
  const [applyInstitutional, setApplyInstitutional] = useState(false);
  const [registryIstituzioniDelta, setRegistryIstituzioniDelta] = useState<
    CalculateOverrides["istituzioniDelta"]
  >();
  const [quickInstDelta, setQuickInstDelta] = useState<
    CalculateOverrides["istituzioniDelta"]
  >();
  const [compareSnapshot, setCompareSnapshot] = useState(false);

  const handleDeltaChange = useCallback(
    (
      delta: CalculateOverrides["istituzioniDelta"] | undefined,
      summary: IstituzioniDeltaSummary | null,
    ) => {
      setRegistryIstituzioniDelta(delta);
      if (!summary?.hasChanges) setApplyInstitutional(false);
    },
    [],
  );

  const effectiveIstituzioniDelta = useMemo(
    () =>
      mergeIstituzioniDeltas(
        applyInstitutional ? registryIstituzioniDelta : undefined,
        quickInstDelta,
      ),
    [applyInstitutional, registryIstituzioniDelta, quickInstDelta],
  );

  const pesi = pesiFromUi(weights);
  const hasInstitutional = hasNonZeroIstituzioniDelta(
    effectiveIstituzioniDelta,
  );
  const customFlussi = !isOfficialFlussi(flussiIpsos);
  const isCustom = !isOfficialParams(
    S,
    pesi,
    flussiIpsos,
    effectiveIstituzioniDelta,
  );
  const busy = mcLoading || pollLoading;

  const fetchScenario = useCallback(
    async (nSim: number) => {
      const id = ++reqId.current;
      if (nSim > 0) setMcLoading(true);
      setPollLoading(true);
      try {
        const res = await fetch("/api/scenario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            S,
            pesi,
            nSim,
            includePoll: true,
            pollConfig,
            ...(customFlussi ? { flussi_ipsos: flussiIpsos } : {}),
            ...(hasInstitutional
              ? { istituzioniDelta: effectiveIstituzioniDelta }
              : {}),
          }),
        });
        if (!res.ok) throw new Error("Calcolo fallito");
        const data = (await res.json()) as
          | ScenarioResult
          | { scenario: ScenarioResult; poll: RegionPollResult[] };
        if (id !== reqId.current) return;
        if ("scenario" in data && data.scenario) {
          setScenario(data.scenario);
          if (data.poll) setPoll(data.poll);
        } else {
          setScenario(data as ScenarioResult);
        }
      } finally {
        if (id === reqId.current) {
          if (nSim > 0) setMcLoading(false);
          setPollLoading(false);
        }
      }
    },
    [
      S,
      pesi,
      pollConfig,
      customFlussi,
      flussiIpsos,
      hasInstitutional,
      effectiveIstituzioniDelta,
    ],
  );

  useEffect(() => {
    fetchScenario(0);
    if (mcTimer.current) clearTimeout(mcTimer.current);
    mcTimer.current = setTimeout(() => fetchScenario(20000), 250);
    return () => {
      if (mcTimer.current) clearTimeout(mcTimer.current);
    };
  }, [fetchScenario]);

  const mapValues = useMemo(() => {
    if (!poll.length) {
      return Object.fromEntries(scenario.righe.map((r) => [r.regione, r.stima]));
    }
    if (mapMode === "probSoglia") {
      return Object.fromEntries(
        poll.map((p) => [p.regione, p.probAboveThreshold]),
      );
    }
    if (mapMode === "scartoBenchmark") {
      return Object.fromEntries(
        poll.map((p) => [p.regione, p.scartoVsBenchmark]),
      );
    }
    return Object.fromEntries(poll.map((p) => [p.regione, p.piHat]));
  }, [poll, mapMode, scenario.righe]);

  const resetOfficial = () => {
    setS(OFFICIAL_S);
    setWeights(uiFromPesi(OFFICIAL_PESI));
    setFlussiIpsos({ ...OFFICIAL_FLUSSI });
    setPollConfig({ ...DEFAULT_POLL_CONFIG });
    setApplyInstitutional(false);
    setQuickInstDelta(undefined);
  };

  const adjustQuickInst = useCallback(
    (region: Region, carica: keyof InstitutionalRow, delta: number) => {
      setQuickInstDelta((prev) => {
        const base = { ...(prev ?? {}) };
        const row = { ...(base[region] ?? {}) };
        row[carica] = (row[carica] ?? 0) + delta;
        if (row[carica] === 0) delete row[carica];
        if (Object.keys(row).length === 0) {
          delete base[region];
        } else {
          base[region] = row;
        }
        return Object.keys(base).length ? base : undefined;
      });
    },
    [],
  );

  const resetQuickInstRegion = useCallback((region: Region) => {
    setQuickInstDelta((prev) => {
      if (!prev?.[region]) return prev;
      const next = { ...prev };
      delete next[region];
      return Object.keys(next).length ? next : undefined;
    });
  }, []);

  const pollRow = poll.find((p) => p.regione === selectedRegion);
  const scenarioRow = scenario.righe.find((r) => r.regione === selectedRegion);

  return (
    <>
      <div className="screen-only flex min-h-full flex-col lg:flex-row">
        <aside className="hidden w-64 shrink-0 flex-col bg-fn-sidebar text-white/90 lg:flex lg:w-72">
          <div className="border-b border-white/10 p-6">
            <div className="mb-3 flex gap-1">
              <span className="h-0.5 w-6 rounded-full bg-[var(--fn-italy-green)]" />
              <span className="h-0.5 w-6 rounded-full bg-white/80" />
              <span className="h-0.5 w-6 rounded-full bg-[var(--fn-italy-red)]" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
              Futuro Nazionale
            </p>
            <p className="font-[family-name:var(--font-fraunces)] text-lg font-semibold leading-snug">
              Scenario v3.2
            </p>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-xl px-4 py-3 text-left transition-colors ${
                  tab === item.id
                    ? "bg-fn-sidebar-active text-white shadow-inner"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug opacity-70">
                  {item.desc}
                </span>
              </button>
            ))}
          </nav>
          <div className="border-t border-white/10 p-4 text-xs text-white/45">
            <p>Uso interno · accesso aperto (auth disabilitato)</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex gap-1 overflow-x-auto border-b border-fn-border-subtle bg-fn-sidebar p-2 lg:hidden">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${
                  tab === item.id
                    ? "bg-fn-sidebar-active text-white"
                    : "text-white/70"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <header className="border-b border-fn-border-subtle bg-fn-surface/80 px-4 py-4 backdrop-blur-sm sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-fn-text">
                  {NAV.find((n) => n.id === tab)?.label}
                </h1>
                <p className="mt-0.5 flex items-center gap-2 text-sm text-fn-text-muted">
                  <StatusDot active={busy} />
                  Base {scenario.metadati.data}
                  {busy ? " · aggiornamento in corso" : " · pronto"}
                </p>
              </div>
              <Btn variant="primary" onClick={() => exportNotaPdf()}>
                Esporta report PDF
              </Btn>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
            <DisclaimerBanner />

            {tab === "scenario" && (
              <>
                {isCustom && (
                  <div className="fn-alert fn-alert-custom" role="status">
                    <strong>Scenario personalizzato</strong> — non certificato
                    golden v3.2
                    {!isOfficialParams(S, pesi, OFFICIAL_FLUSSI)
                      ? " (S o pesi diversi dal default ufficiale)"
                      : ""}
                    {customFlussi ? " · flussi Ipsos personalizzati" : ""}
                    {hasInstitutional
                      ? " · adeguamento istituzionale (registro e/o campagna)"
                      : ""}
                    .
                  </div>
                )}

                <MetricCards scenario={scenario} />

                <div className="grid gap-5 xl:grid-cols-2">
                  <SensitivityControls
                    S={S}
                    weights={weights}
                    flussiIpsos={flussiIpsos}
                    onSChange={setS}
                    onWeightsChange={setWeights}
                    onFlussiChange={setFlussiIpsos}
                    onReset={resetOfficial}
                    mcLoading={mcLoading}
                  />
                  <RegionalPollControls
                    config={pollConfig}
                    onChange={setPollConfig}
                  />
                </div>

                <Panel className="p-4">
                  <p className="fn-label mb-3">Legenda mappa</p>
                  <Segmented
                    value={mapMode}
                    onChange={setMapMode}
                    options={[
                      { value: "stima", label: "Stima sondaggio" },
                      { value: "probSoglia", label: "Prob. soglia" },
                      { value: "scartoBenchmark", label: "Scarto benchmark" },
                    ]}
                  />
                </Panel>

                <div className="grid gap-6 xl:grid-cols-[minmax(300px,420px)_1fr]">
                  <ItalyMap
                    valuesByRegion={mapValues}
                    colorMode={mapMode}
                    onRegionClick={setSelectedRegion}
                  />
                  <div>
                    <h2 className="fn-label mb-3">Scheda sondaggio regionale</h2>
                    {poll.length > 0 ? (
                      <RegionalPollTable
                        poll={poll}
                        selectedRegion={selectedRegion}
                        onSelect={setSelectedRegion}
                        frozenSnapshot={frozenSnapshot}
                        compareSnapshot={compareSnapshot}
                        onCompareSnapshotChange={setCompareSnapshot}
                      />
                    ) : (
                      <p className="text-sm text-fn-text-muted">
                        Calcolo sondaggio…
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {tab === "locali" && (
              <LocaliPanel
                configSnapshot={fnConfig}
                applyToScenario={applyInstitutional}
                onApplyToScenarioChange={setApplyInstitutional}
                onDeltaChange={handleDeltaChange}
              />
            )}
            {tab === "storico" && <HistoryPanel snapshot={frozenSnapshot} />}
            {tab === "postvoto" && <PostVotePanel snapshot={frozenSnapshot} />}
          </div>
        </div>
      </div>

      {pollRow && scenarioRow && (
        <RegionPollDrawer
          poll={pollRow}
          row={scenarioRow}
          fnConfig={fnConfig}
          region={selectedRegion as Region}
          quickDelta={quickInstDelta?.[selectedRegion as Region]}
          mergedDelta={effectiveIstituzioniDelta?.[selectedRegion as Region]}
          onAdjustInst={(carica, d) =>
            adjustQuickInst(selectedRegion as Region, carica, d)
          }
          onResetRegion={() =>
            resetQuickInstRegion(selectedRegion as Region)
          }
          onClose={() => setSelectedRegion(null)}
        />
      )}

      <PrintNotaReport
        scenario={scenario}
        S={S}
        pesi={pesi}
        flussiIpsos={flussiIpsos}
        istituzioniDelta={effectiveIstituzioniDelta}
        poll={poll}
        pollConfig={pollConfig}
      />
    </>
  );
}
