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
import { pesiFromUi, uiFromPesi } from "@/components/SensitivityControls";
import { DashboardShell, DashboardSubtitle } from "@/components/DashboardShell";
import { AwwwardsLandingHero } from "@/components/AwwwardsLandingHero";
import {
  ScenarioViewSwitch,
  StageTopHud,
  type ScenarioViewMode,
} from "@/components/StageTopHud";
import { MethodologyStatusBar } from "./MethodologyStatusBar";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapColorMode } from "./ItalyMap";
import { ScenarioTerritoryStage } from "./ScenarioTerritoryStage";
import { exportNotaPdf, PrintNotaReport } from "./PrintNotaReport";
import { RegionPollDrawer } from "./RegionPollDrawer";
import type { SnapshotParams } from "@/lib/engine/snapshotDiff";
import { loadLocalSnapshots } from "@/lib/engine/snapshotStorage";

const LocaliPanel = dynamic(
  () => import("./LocaliPanel").then((m) => m.LocaliPanel),
  { ssr: false, loading: () => <p className="text-sm text-fn-text-muted">Caricamento tab…</p> },
);
const AuditWorkspacePanel = dynamic(
  () =>
    import("./AuditWorkspacePanel").then((m) => m.AuditWorkspacePanel),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-fn-text-muted">Caricamento audit…</p>
    ),
  },
);
const OsservatorioPanel = dynamic(
  () =>
    import("./OsservatorioPanel").then((m) => m.OsservatorioPanel),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-fn-text-muted">Caricamento tab…</p>
    ),
  },
);
const FuturoNazionaleQuadroPanel = dynamic(
  () =>
    import("./FuturoNazionaleQuadroPanel").then(
      (m) => m.FuturoNazionaleQuadroPanel,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-fn-text-muted">Caricamento tab…</p>
    ),
  },
);
type Tab = "scenario" | "quadro" | "osservatorio" | "locali" | "audit";

const NAV: { id: Tab; label: string; desc: string }[] = [
  {
    id: "scenario",
    label: "01 · Scenario",
    desc: "Mappa tattica e showcase",
  },
  {
    id: "quadro",
    label: "02 · Quadro FN",
    desc: "Matrice integrata 20 regioni (Moduli A · B · C)",
  },
  {
    id: "osservatorio",
    label: "03 · Osservatorio",
    desc: "Moduli A/B/C, scheda mensile, storico iscritti",
  },
  {
    id: "locali",
    label: "04 · Rassegna stampa",
    desc: "Scanner RSS, NER istituzionale, dispacci certificati Typeflow",
  },
  {
    id: "audit",
    label: "05 · Audit & Post-Voto (WIP)",
    desc: "Work in progress · anteprima snapshot, post-voto e audit trail",
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
  const [baselineScenario, setBaselineScenario] =
    useState<ScenarioResult>(frozenSnapshot);
  const [baselineLabel, setBaselineLabel] = useState(
    "Snapshot Ufficiale 18-10-2026",
  );
  const [baselineId, setBaselineId] = useState("file-frozen-18-10-2026");
  const [dbCloudConnected, setDbCloudConnected] = useState<boolean | null>(
    null,
  );
  const [snapshotCatalog, setSnapshotCatalog] = useState<
    { id: string; label: string; scenario: ScenarioResult }[]
  >([
    {
      id: "file-frozen-18-10-2026",
      label: "Snapshot Ufficiale 18-10-2026",
      scenario: frozenSnapshot,
    },
  ]);
  const [freezeName, setFreezeName] = useState("");
  const [freezeNotes, setFreezeNotes] = useState("");
  const [scenarioView, setScenarioView] =
    useState<ScenarioViewMode>("showcase");

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

  const pesi = useMemo(() => pesiFromUi(weights), [weights]);
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

  useEffect(() => {
    void fetch("/api/snapshots")
      .then((r) => r.json())
      .then(
        (data: {
          dbConnected?: boolean;
          snapshots?: {
            id: string;
            name: string;
            scenarioData: ScenarioResult;
          }[];
        }) => {
          setDbCloudConnected(Boolean(data.dbConnected));
          const list = data.snapshots ?? [];
          const local = loadLocalSnapshots();
          const merged = [...list];
          for (const l of local) {
            if (!merged.some((m) => m.id === l.id)) {
              merged.push({
                id: l.id,
                name: l.name,
                scenarioData: l.scenarioData,
              });
            }
          }
          if (merged.length) {
            setSnapshotCatalog(
              merged.map((s) => ({
                id: s.id,
                label: s.name,
                scenario: s.scenarioData,
              })),
            );
          }
        },
      )
      .catch(() => setDbCloudConnected(false));
  }, [tab]);

  const loadSnapshotIntoDashboard = useCallback(
    (s: ScenarioResult, params?: SnapshotParams) => {
      setScenario(s);
      if (params) {
        setS(params.S);
        setWeights(uiFromPesi(params.pesi));
        if (params.flussi_ipsos) {
          setFlussiIpsos({ ...params.flussi_ipsos });
        }
      }
    },
    [],
  );

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
      <DashboardShell
        nav={NAV}
        tab={tab}
        onTabChange={(id) => setTab(id as Tab)}
        fullBleed={tab === "scenario" && scenarioView === "map-matrix"}
        contentClassName={
          tab === "scenario" && scenarioView === "map-matrix"
            ? "!m-0 !h-screen !max-h-screen !overflow-hidden !p-0 !pt-0"
            : "space-y-4"
        }
        lockViewport={tab === "scenario" && scenarioView === "map-matrix"}
        overrideActive={isCustom || hasInstitutional}
        topHud={
          <StageTopHud
            frostedBar={
              !(tab === "scenario" && scenarioView === "map-matrix")
            }
            brandExtra={
              <DashboardSubtitle
                busy={busy}
                metaDate={scenario.metadati.data}
                dbCloudConnected={dbCloudConnected}
              />
            }
            methodologyPill={<MethodologyStatusBar hudPill />}
            scenarioControls={
              tab === "scenario" ? (
                <ScenarioViewSwitch mode={scenarioView} onChange={setScenarioView} />
              ) : undefined
            }
            onExportPdf={() => exportNotaPdf()}
            busy={busy}
          />
        }
      >
        {tab === "scenario" && scenarioView === "showcase" ? (
          <AwwwardsLandingHero
            scenario={scenario}
            poll={poll}
            mapValues={mapValues}
            pesi={pesi}
            onSChange={setS}
            onFlussiChange={setFlussiIpsos}
            onOpenCommandCenter={() => setScenarioView("map-matrix")}
            onOpenOsservatorio={() => {
              setTab("osservatorio");
            }}
            onExportPdf={() => exportNotaPdf()}
          />
        ) : null}

        {tab === "scenario" && scenarioView === "map-matrix" ? (
            <ScenarioTerritoryStage
              immersive
              hideRegionalTable
              onOpenMatrixView={() => setTab("quadro")}
              scenario={scenario}
              baselineGolden={frozenSnapshot}
              baselineForTable={baselineScenario}
              poll={poll}
              mapValues={mapValues}
              mapMode={mapMode}
              onMapModeChange={setMapMode}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegion}
              freezeName={freezeName}
              freezeNotes={freezeNotes}
              onFreezeNameChange={setFreezeName}
              onFreezeNotesChange={setFreezeNotes}
              S={S}
              weights={weights}
              flussiIpsos={flussiIpsos}
              onSChange={setS}
              onWeightsChange={setWeights}
              onFlussiChange={setFlussiIpsos}
              onResetOfficial={resetOfficial}
              mcLoading={mcLoading}
              pollConfig={pollConfig}
              onPollConfigChange={setPollConfig}
              baselineLabel={baselineLabel}
              baselineOptions={snapshotCatalog.map((s) => ({
                id: s.id,
                label: s.label,
              }))}
              baselineId={baselineId}
              onBaselineIdChange={(id) => {
                setBaselineId(id);
                const pick = snapshotCatalog.find((s) => s.id === id);
                if (pick) {
                  setBaselineScenario(pick.scenario);
                  setBaselineLabel(pick.label);
                }
              }}
              compareSnapshot={compareSnapshot}
              onCompareSnapshotChange={setCompareSnapshot}
              onAdjustInst={(region, carica, d) =>
                adjustQuickInst(region as Region, carica, d)
              }
              onResetInstRegion={(region) =>
                resetQuickInstRegion(region as Region)
              }
              fnConfig={fnConfig}
              quickInstDelta={quickInstDelta}
              busy={busy}
            />
        ) : null}

        {tab === "quadro" && (
          <div className="pb-36">
            <FuturoNazionaleQuadroPanel
              scenario={scenario}
              poll={poll}
              onOpenTab={setTab}
              onOpenScenarioRegion={(region) => {
                setSelectedRegion(region);
                setTab("scenario");
                setScenarioView("map-matrix");
              }}
            />
          </div>
        )}

        {tab !== "scenario" && tab !== "quadro" && (
          <div className="pb-36 space-y-4">
            {tab === "osservatorio" && (
              <OsservatorioPanel
                scenario={scenario}
                baselineScenario={baselineScenario}
                liveS={S}
                onRestoreBaselineS={() => setS(OFFICIAL_S)}
                onOpenTab={setTab}
              />
            )}

            {tab === "locali" && (
              <LocaliPanel
                newsOnly
                configSnapshot={fnConfig}
                applyToScenario={applyInstitutional}
                onApplyToScenarioChange={setApplyInstitutional}
                onDeltaChange={handleDeltaChange}
              />
            )}
            {tab === "audit" && (
              <AuditWorkspacePanel
                liveScenario={scenario}
                onLoadScenario={loadSnapshotIntoDashboard}
                baselineScenario={baselineScenario}
                onBaselineChange={(s, label) => {
                  setBaselineScenario(s);
                  setBaselineLabel(label);
                  const match = snapshotCatalog.find(
                    (x) => x.label === label,
                  );
                  if (match) setBaselineId(match.id);
                }}
                snapshotCatalog={snapshotCatalog}
                defaultBaselineId={
                  snapshotCatalog.find((s) => s.label.includes("18-10"))
                    ?.id ?? snapshotCatalog[0]!.id
                }
              />
            )}
          </div>
        )}
      </DashboardShell>

      <AnimatePresence>
        {pollRow &&
          scenarioRow &&
          selectedRegion &&
          tab === "scenario" &&
          scenarioView === "map-matrix" && (
          <RegionPollDrawer
            key={selectedRegion}
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
      </AnimatePresence>

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
