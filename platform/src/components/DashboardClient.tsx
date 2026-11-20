"use client";

import {
  isOfficialFlussi,
  isOfficialParams,
  OFFICIAL_PESI,
  OFFICIAL_S,
  type FlussiIpsos,
} from "@/lib/engine/defaults";
import {
  buildRegionalGrowthMap,
  DEFAULT_FLUSSI_MATRIX_ID,
  detectFlussiMatrixId,
  flussiFromMatrix,
  type FlussiMatrixId,
  type GrowthRegimeId,
} from "@/lib/politicalModel";
import { scenarioToRegionalGrowthInputs } from "@/lib/regionalGrowthInputs";
import {
  hasNonZeroIstituzioniDelta,
  mergeIstituzioniDeltas,
} from "@/lib/engine/mergeIstituzioniDelta";
import type { Region } from "@/lib/engine/constants";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
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
import { CommandPalette } from "@/components/command/CommandPalette";
import { StageTopHud } from "@/components/StageTopHud";
import { appPath, tabFromPathname, type AppTab } from "@/lib/appRoutes";
import { StrategicGoalWorkspace } from "@/components/obiettivo/StrategicGoalWorkspace";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useLiveConsenso } from "@/components/useLiveConsenso";
import {
  getConsensoLivePrefSnapshot,
  getServerConsensoLivePrefSnapshot,
  subscribeConsensoLivePref,
  writeConsensoLivePref,
} from "@/lib/consensoLiveClient";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { MapColorMode } from "./ItalyMap";
import { ScenarioTerritoryStage } from "./ScenarioTerritoryStage";
import { PrintNotaReport } from "./PrintNotaReport";
import { RegionPollDrawer } from "./RegionPollDrawer";
import { loadLocalSnapshots } from "@/lib/engine/snapshotStorage";

const LocaliPanel = dynamic(
  () => import("./LocaliPanel").then((m) => m.LocaliPanel),
  { ssr: false, loading: () => <p className="text-sm text-fn-text-muted">Caricamento tab…</p> },
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
type Tab = AppTab;

const NAV: { id: Tab; label: string; short: string; desc: string; href: string }[] = [
  {
    id: "scenario",
    label: "01 · Scenario",
    short: "Scenario",
    desc: "Mappa e quadro nazionale",
    href: appPath("scenario"),
  },
  {
    id: "osservatorio",
    label: "02 · Osservatorio",
    short: "Osservatorio",
    desc: "Dati territoriali, scheda mensile e storico iscritti",
    href: appPath("osservatorio"),
  },
  {
    id: "locali",
    label: "03 · Rassegna stampa",
    short: "Rassegna",
    desc: "Notizie, fonti e verifica delle informazioni",
    href: appPath("locali"),
  },
  {
    id: "obiettivo",
    label: "04 · Obiettivo",
    short: "Obiettivo",
    desc: "Piano inverso sul consenso da raggiungere",
    href: appPath("obiettivo"),
  },
];

export function DashboardClient({
  variant = "app",
  initialScenario,
  frozenSnapshot,
  fnConfig,
}: {
  variant?: "app" | "landing";
  initialScenario: ScenarioResult;
  frozenSnapshot: ScenarioResult;
  fnConfig: FnConfig;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = tabFromPathname(pathname);
  const tab: Tab = variant === "app" ? (tabFromUrl ?? "scenario") : "scenario";

  const navigateTab = useCallback(
    (next: Tab) => {
      router.push(appPath(next));
    },
    [router],
  );

  useEffect(() => {
    if (variant !== "app") return;
    if (!pathname.startsWith("/app")) return;
    if (!tabFromUrl) router.replace(appPath("scenario"));
  }, [variant, pathname, tabFromUrl, router]);

  useEffect(() => {
    if (variant !== "app") return;
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setCommandOpen((open) => !open);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  const [scenario, setScenario] = useState(initialScenario);
  const [S, setS] = useState(OFFICIAL_S);
  const sLiveEnabled = useSyncExternalStore(
    subscribeConsensoLivePref,
    getConsensoLivePrefSnapshot,
    getServerConsensoLivePrefSnapshot,
  );
  const {
    data: liveConsenso,
    loading: liveConsensoLoading,
  } = useLiveConsenso({
    enabled: sLiveEnabled,
    mode: "auto",
  });

  const setSLiveEnabledPersist = useCallback((next: boolean) => {
    writeConsensoLivePref(next);
  }, []);

  useEffect(() => {
    if (!sLiveEnabled) return;
    if (liveConsenso?.s == null) return;
    startTransition(() => {
      setS((prev) =>
        Math.abs(prev - liveConsenso.s) < 1e-9 ? prev : liveConsenso.s,
      );
    });
  }, [sLiveEnabled, liveConsenso?.s]);

  const [weights, setWeights] = useState(uiFromPesi(OFFICIAL_PESI));
  const [pollConfig, setPollConfig] = useState<RegionalPollConfig>({
    ...DEFAULT_POLL_CONFIG,
  });
  const [poll, setPoll] = useState<RegionPollResult[]>([]);
  const mapMode: MapColorMode = "stima";
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [mcLoading, setMcLoading] = useState(false);
  const [pollLoading, setPollLoading] = useState(false);
  const mcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  const [growthRegime, setGrowthRegime] = useState<GrowthRegimeId>("organica");
  const [flussiMatrixId, setFlussiMatrixId] = useState<FlussiMatrixId>(
    DEFAULT_FLUSSI_MATRIX_ID,
  );
  const [flussiIpsos, setFlussiIpsos] = useState<FlussiIpsos>(() =>
    flussiFromMatrix(DEFAULT_FLUSSI_MATRIX_ID),
  );

  const applyFlussiMatrix = useCallback((id: FlussiMatrixId) => {
    setFlussiMatrixId(id);
    setFlussiIpsos(flussiFromMatrix(id));
  }, []);

  const handleFlussiChange = useCallback((f: FlussiIpsos) => {
    setFlussiIpsos(f);
    setFlussiMatrixId((prev) => detectFlussiMatrixId(f) ?? prev);
  }, []);
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
    "Situazione di riferimento del 18-10-2026",
  );
  const [baselineId, setBaselineId] = useState("file-frozen-18-10-2026");
  const [snapshotCatalog, setSnapshotCatalog] = useState<
    { id: string; label: string; scenario: ScenarioResult }[]
  >([
    {
      id: "file-frozen-18-10-2026",
      label: "Situazione di riferimento del 18-10-2026",
      scenario: frozenSnapshot,
    },
  ]);
  const [freezeName, setFreezeName] = useState("");
  const [freezeNotes, setFreezeNotes] = useState("");
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

  const regionalGrowthByRegion = useMemo(
    () =>
      buildRegionalGrowthMap(
        scenarioToRegionalGrowthInputs(scenario, poll),
        S,
        growthRegime,
        flussiMatrixId,
      ),
    [scenario, poll, S, growthRegime, flussiMatrixId],
  );

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
        startTransition(() => {
          if ("scenario" in data && data.scenario) {
            setScenario(data.scenario);
            if (data.poll) setPoll(data.poll);
          } else {
            setScenario(data as ScenarioResult);
          }
        });
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
    const immediate = window.setTimeout(() => {
      void fetchScenario(0);
    }, 0);
    if (mcTimer.current) clearTimeout(mcTimer.current);
    mcTimer.current = setTimeout(() => {
      void fetchScenario(20000);
    }, 250);
    return () => {
      clearTimeout(immediate);
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
      .catch(() => undefined);
  }, [tab]);

  const mapValues = useMemo(() => {
    if (!poll.length) {
      return Object.fromEntries(scenario.righe.map((r) => [r.regione, r.stima]));
    }
    return Object.fromEntries(poll.map((p) => [p.regione, p.piHat]));
  }, [poll, scenario.righe]);

  const resetOfficial = () => {
    setS(OFFICIAL_S);
    setWeights(uiFromPesi(OFFICIAL_PESI));
    applyFlussiMatrix(DEFAULT_FLUSSI_MATRIX_ID);
    setGrowthRegime("organica");
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

  if (variant === "landing") {
    return (
      <>
        <div className="relative min-h-screen">
          <header className="fixed left-0 right-0 top-0 z-[60] border-b border-white/10 bg-[#03050A]/80 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
              <Link
                href="/"
                className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight text-white"
              >
                Futuro Nazionale
              </Link>
              <nav
                className="flex flex-wrap items-center gap-2 text-[11px] font-semibold"
                aria-label="Accesso piattaforma"
              >
                <Link
                  href={appPath("scenario")}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-emerald-100 transition hover:bg-emerald-500/25"
                >
                  Command center →
                </Link>
                <Link
                  href={appPath("osservatorio")}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 transition hover:border-white/25 hover:text-white"
                >
                  Osservatorio
                </Link>
                <Link
                  href={appPath("locali")}
                  className="hidden rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 transition hover:border-white/25 hover:text-white sm:inline"
                >
                  Rassegna stampa
                </Link>
              </nav>
            </div>
          </header>
          <AwwwardsLandingHero
            scenario={scenario}
            poll={poll}
            mapValues={mapValues}
            onOpenCommandCenter={() => router.push(appPath("scenario"))}
          />
        </div>
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

  return (
    <>
      <DashboardShell
        nav={NAV}
        tab={tab}
        fullBleed={tab === "scenario" || tab === "obiettivo"}
        contentClassName={
          tab === "scenario" || tab === "obiettivo"
            ? "!m-0 !p-0 !pt-0 max-lg:!h-auto max-lg:!max-h-none max-lg:!overflow-visible lg:!h-dvh lg:!max-h-dvh lg:!overflow-hidden"
            : tab === "locali"
              ? "flex min-h-[calc(100dvh-4rem)] flex-col !max-w-[1440px] !px-3 !pb-6 !pt-14 sm:!px-5 lg:!px-6"
              : tab === "osservatorio"
                ? "space-y-4 !max-w-[1420px] !px-3 !pt-14 sm:!px-5 lg:!px-6"
                : "space-y-4"
        }
        lockViewport={tab === "scenario" || tab === "obiettivo"}
        overrideActive={isCustom || hasInstitutional}
        topHud={
          <StageTopHud
            frostedBar={tab !== "scenario"}
            brandHref="/"
            brandExtra={
              <DashboardSubtitle busy={busy} />
            }
            nav={NAV}
            activeId={tab}
          />
        }
      >
        {tab === "scenario" ? (
            <ScenarioTerritoryStage
              immersive
              hideRegionalTable
              scenario={scenario}
              baselineGolden={frozenSnapshot}
              baselineForTable={baselineScenario}
              poll={poll}
              mapValues={mapValues}
              mapMode={mapMode}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegion}
              freezeName={freezeName}
              freezeNotes={freezeNotes}
              onFreezeNameChange={setFreezeName}
              onFreezeNotesChange={setFreezeNotes}
              S={S}
              weights={weights}
              flussiIpsos={flussiIpsos}
              flussiMatrixId={flussiMatrixId}
              onSelectFlussiMatrix={applyFlussiMatrix}
              growthRegime={growthRegime}
              onGrowthRegimeChange={setGrowthRegime}
              regionalGrowthByRegion={regionalGrowthByRegion}
              onSChange={setS}
              sLiveEnabled={sLiveEnabled}
              onSLiveEnabledChange={setSLiveEnabledPersist}
              liveConsenso={liveConsenso}
              liveConsensoLoading={liveConsensoLoading}
              onOpenDossier={(region: Region, category: TerritoryIssueCategory) => {
                const params = new URLSearchParams({ region, category });
                router.push(`${appPath("osservatorio")}?${params.toString()}`);
              }}
              onWeightsChange={setWeights}
              onFlussiChange={handleFlussiChange}
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

        {tab === "obiettivo" ? (
          <StrategicGoalWorkspace
            scenario={scenario}
            flussiIpsos={flussiIpsos}
            poll={poll}
            initialTarget={searchParams.get("target")}
          />
        ) : null}

        {tab !== "scenario" && tab !== "obiettivo" && (
          <div
            className={
              tab === "osservatorio"
                ? "space-y-4 pb-28"
                : tab === "locali"
                  ? "flex min-h-0 flex-1 flex-col pb-4"
                  : "space-y-4 pb-36"
            }
          >
            {tab === "osservatorio" && (
              <OsservatorioPanel
                scenario={scenario}
                baselineScenario={baselineScenario}
                liveS={S}
                flussiIpsos={flussiIpsos}
                flussiMatrixId={flussiMatrixId}
                onSelectFlussiMatrix={applyFlussiMatrix}
                regionalGrowthByRegion={regionalGrowthByRegion}
                onRestoreBaselineS={() => setS(OFFICIAL_S)}
                onOpenTab={navigateTab}
                dossierRegion={searchParams.get("region")}
                dossierCategory={searchParams.get("category")}
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
          </div>
        )}
      </DashboardShell>
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        poll={poll}
        onSelectRegion={setSelectedRegion}
        onSelectFlussiMatrix={applyFlussiMatrix}
        activeFlussiMatrixId={flussiMatrixId}
      />

      {pollRow &&
        scenarioRow &&
        selectedRegion &&
        tab === "scenario" && (
          <RegionPollDrawer
            key={selectedRegion}
            poll={pollRow}
            row={scenarioRow}
            fnConfig={fnConfig}
            region={selectedRegion as Region}
            nationalS={S}
            allRows={scenario.righe}
            onClose={() => setSelectedRegion(null)}
            onOpenOsservatorio={(region, category) => {
              setSelectedRegion(null);
              const params = new URLSearchParams({ region, category });
              router.push(`${appPath("osservatorio")}?${params.toString()}`);
            }}
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
