"use client";

import { ItaliaHeroStage } from "@/components/ItaliaHeroStage";
import { ItalyMap, type MapColorMode } from "@/components/ItalyMap";
import { MethodologyStatusBar } from "@/components/MethodologyStatusBar";
import { NationalIntelligencePanel } from "@/components/NationalIntelligencePanel";
import { QuickControlDock } from "@/components/QuickControlDock";
import { RegionalPollTable } from "@/components/RegionalPollTable";
import { Segmented } from "@/components/ui/FnUi";
import type { InstitutionalRow } from "@/lib/engine/calculate";
import type { Region } from "@/lib/engine/constants";
import type { FlussiIpsos } from "@/lib/engine/defaults";
import type {
  RegionPollResult,
  RegionalPollConfig,
} from "@/lib/engine/regionalPollShared";
import type { FnConfig, ScenarioResult } from "@/lib/engine/types";
import type { CalculateOverrides } from "@/lib/engine/calculate";
import { pct, pp } from "@/lib/format";
import type { WeightUi } from "@/components/SensitivityControls";
import { motion } from "framer-motion";
import { useMemo, useRef, useState, type ReactNode } from "react";

function deltaLabel(current: number, base: number, asPct = false): string {
  const d = current - base;
  if (Math.abs(d) < 1e-6) return "";
  const sign = d >= 0 ? "+" : "";
  if (asPct) return `${sign}${(d * 100).toFixed(2)} pp`;
  return `${sign}${d.toFixed(4)}`;
}

function ppDelta(current: number, base: number): string {
  const d = current - base;
  if (Math.abs(d) < 1e-6) return "";
  return `${d >= 0 ? "+" : ""}${d.toFixed(2)} pp`;
}

function KpiBento({
  label,
  value,
  delta,
  barPct,
  barLabel,
}: {
  label: string;
  value: string;
  delta?: string;
  barPct?: number;
  barLabel?: string;
}) {
  return (
    <div className="fn-bento fn-kpi-bento">
      <p className="fn-label">{label}</p>
      <div className="flex items-baseline gap-2">
        <motion.p
          key={value}
          className="font-mono text-lg tabular-nums text-fn-text"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
        >
          {value}
        </motion.p>
        {delta && (
          <span className="font-mono text-[10px] tabular-nums text-emerald-400/90">
            {delta}
          </span>
        )}
      </div>
      {barPct != null && (
        <div className="mt-2">
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-500/70 transition-all duration-300"
              style={{ width: `${Math.min(100, barPct * 100)}%` }}
            />
          </div>
          {barLabel && (
            <p className="mt-1 text-[10px] text-fn-text-muted">{barLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ScenarioTerritoryStage({
  immersive,
  hideRegionalTable = false,
  onOpenMatrixView,
  scenario,
  baselineGolden,
  baselineForTable,
  poll,
  mapValues,
  mapMode,
  onMapModeChange,
  selectedRegion,
  onSelectRegion,
  customAlert,
  freezeName,
  freezeNotes,
  onFreezeNameChange,
  onFreezeNotesChange,
  S,
  weights,
  flussiIpsos,
  onSChange,
  onWeightsChange,
  onFlussiChange,
  onResetOfficial,
  mcLoading,
  pollConfig,
  onPollConfigChange,
  baselineLabel,
  baselineOptions,
  baselineId,
  onBaselineIdChange,
  compareSnapshot,
  onCompareSnapshotChange,
  onAdjustInst,
  onResetInstRegion,
  busy,
  fnConfig,
  quickInstDelta,
}: {
  scenario: ScenarioResult;
  baselineGolden: ScenarioResult;
  baselineForTable: ScenarioResult;
  poll: RegionPollResult[];
  mapValues: Record<string, number>;
  mapMode: MapColorMode;
  onMapModeChange: (m: MapColorMode) => void;
  selectedRegion: string | null;
  onSelectRegion: (r: string | null) => void;
  customAlert?: ReactNode;
  freezeName: string;
  freezeNotes: string;
  onFreezeNameChange: (v: string) => void;
  onFreezeNotesChange: (v: string) => void;
  S: number;
  weights: WeightUi;
  flussiIpsos: FlussiIpsos;
  onSChange: (s: number) => void;
  onWeightsChange: (w: WeightUi) => void;
  onFlussiChange: (f: FlussiIpsos) => void;
  onResetOfficial: () => void;
  mcLoading: boolean;
  pollConfig: RegionalPollConfig;
  onPollConfigChange: (c: RegionalPollConfig) => void;
  baselineLabel: string;
  baselineOptions: { id: string; label: string }[];
  baselineId: string;
  onBaselineIdChange: (id: string) => void;
  compareSnapshot: boolean;
  onCompareSnapshotChange: (v: boolean) => void;
  onAdjustInst?: (region: string, carica: keyof InstitutionalRow, delta: number) => void;
  onResetInstRegion?: (region: string) => void;
  busy?: boolean;
  immersive: boolean;
  hideRegionalTable?: boolean;
  onOpenMatrixView?: () => void;
  onImmersiveChange?: (v: boolean) => void;
  fnConfig?: FnConfig;
  quickInstDelta?: CalculateOverrides["istituzioniDelta"];
}) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<
    "all" | RegionPollResult["classificazione"]
  >("all");
  const tableRef = useRef<HTMLElement>(null);

  const pollByRegion = useMemo(
    () => Object.fromEntries(poll.map((p) => [p.regione, p])),
    [poll],
  );
  const votesByRegion = useMemo(
    () => Object.fromEntries(scenario.righe.map((r) => [r.regione, r.voti_di_scenario])),
    [scenario.righe],
  );

  const { parametri, metriche } = scenario;
  const baseM = baselineGolden.metriche;
  const baseP = baselineGolden.parametri;
  const totVoti = scenario.righe.reduce((s, r) => s + r.voti_di_scenario, 0);
  const baseVoti = baselineGolden.righe.reduce(
    (s, r) => s + r.voti_di_scenario,
    0,
  );

  const handleAdjust = (carica: keyof InstitutionalRow, delta: number) => {
    if (selectedRegion && onAdjustInst) {
      onAdjustInst(selectedRegion, carica, delta);
    }
  };

  return (
    <div
      className={
        immersive
          ? "h-full max-h-full overflow-hidden"
          : "fn-scenario-zero"
      }
    >
      {immersive && (
        <ItaliaHeroStage
          scenario={scenario}
          poll={poll}
          mapValues={mapValues}
          mapMode={mapMode}
          onMapModeChange={onMapModeChange}
          selectedRegion={selectedRegion}
          onSelectRegion={onSelectRegion}
          hoveredRegion={hoveredRegion}
          onHoverRegion={setHoveredRegion}
          classFilter={classFilter}
          onClassFilterChange={setClassFilter}
          pollByRegion={pollByRegion}
          votesByRegion={votesByRegion}
          S={S}
          flussiIpsos={flussiIpsos}
          onSChange={onSChange}
          onFlussiPreset={onFlussiChange}
          onAdjustInst={
            selectedRegion && onAdjustInst
              ? (c, d) => onAdjustInst(selectedRegion, c, d)
              : undefined
          }
          onResetInstRegion={
            selectedRegion && onResetInstRegion
              ? () => onResetInstRegion(selectedRegion)
              : undefined
          }
          onScrollToTable={() => {
            if (hideRegionalTable && onOpenMatrixView) {
              onOpenMatrixView();
              return;
            }
            tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          fnConfig={fnConfig}
          regionQuickDelta={
            selectedRegion
              ? quickInstDelta?.[selectedRegion as Region]
              : undefined
          }
          baselineScenario={baselineGolden}
        />
      )}

      {!immersive && customAlert}

      {!immersive && (
      <section className="fn-bento-grid-above-fold" aria-label="Command center scenario">
        {!immersive && <MethodologyStatusBar />}
        <div className="fn-bento-col-left space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <KpiBento
              label="S nazionale"
              value={pct(parametri.S)}
              delta={deltaLabel(parametri.S, baseP.S, true)}
            />
            <KpiBento
              label="Voti scenario"
              value={totVoti.toLocaleString("it-IT", { maximumFractionDigits: 0 })}
              delta={
                totVoti !== baseVoti
                  ? `${totVoti - baseVoti >= 0 ? "+" : ""}${(totVoti - baseVoti).toLocaleString("it-IT")}`
                  : undefined
              }
            />
            <KpiBento
              label="H scenario"
              value={metriche.H.scenario.toFixed(4)}
              delta={deltaLabel(metriche.H.scenario, baseM.H.scenario)}
              barPct={metriche.H.scenario}
              barLabel={`Distribuzione alta: ${(metriche.H.scenario * 100).toFixed(1)}%`}
            />
            <KpiBento
              label="Diff. vs benchmark"
              value={pp(metriche.differenza_media_ponderata_scenario_benchmark_punti, 2)}
              delta={ppDelta(
                metriche.differenza_media_ponderata_scenario_benchmark_punti,
                baseM.differenza_media_ponderata_scenario_benchmark_punti,
              )}
            />
          </div>

          <div className="fn-bento p-3">
            <p className="fn-label mb-2">Layer mappa</p>
            <Segmented
              value={mapMode}
              onChange={onMapModeChange}
              options={[
                { value: "stima", label: "Stima %" },
                { value: "probSoglia", label: "Prob. soglia" },
                { value: "scartoBenchmark", label: "Scarto bench." },
              ]}
            />
          </div>

          <QuickControlDock
            S={S}
            weights={weights}
            flussiIpsos={flussiIpsos}
            pollConfig={pollConfig}
            mcLoading={mcLoading}
            onSChange={onSChange}
            onWeightsChange={onWeightsChange}
            onFlussiChange={onFlussiChange}
            onPollConfigChange={onPollConfigChange}
            onReset={onResetOfficial}
          />
        </div>

        <div className="fn-bento-col-map">
          <div className="fn-map-hero-frame fn-bento h-full">
            <div className="fn-map-hero-chrome">
              <span className="fn-label">Italia · HUD territoriale</span>
              {selectedRegion ? (
                <button
                  type="button"
                  className="fn-map-region-chip"
                  onClick={() => onSelectRegion(null)}
                >
                  {selectedRegion} ×
                </button>
              ) : (
                <span className="font-mono text-xs tabular-nums text-fn-text-muted">
                  20 regioni
                </span>
              )}
            </div>
            <ItalyMap
              variant="hero"
              valuesByRegion={mapValues}
              colorMode={mapMode}
              selectedRegion={selectedRegion}
              highlightedRegion={hoveredRegion}
              pollByRegion={pollByRegion}
              votesByRegion={votesByRegion}
              nationalS={parametri.S}
              onRegionHover={setHoveredRegion}
              onRegionClick={(r) => onSelectRegion(r)}
              classFilter={classFilter}
              onClassFilterChange={setClassFilter}
            />
          </div>
        </div>

        <div className="fn-bento-col-right min-h-0">
          <NationalIntelligencePanel
            poll={poll}
            selectedRegion={selectedRegion}
            onSelectRegion={onSelectRegion}
            onAdjustInst={selectedRegion ? handleAdjust : undefined}
            onResetRegion={
              selectedRegion && onResetInstRegion
                ? () => onResetInstRegion(selectedRegion)
                : undefined
            }
          />
        </div>
      </section>
      )}

      <details className="fn-bento fn-scenario-details mt-4">
        <summary className="fn-scenario-details-summary">Snapshot &amp; congelamento</summary>
        <div className="fn-scenario-details-body grid gap-3 sm:grid-cols-2">
          <div>
            <label className="fn-label block">Nome snapshot</label>
            <input
              className="fn-input mt-1 text-sm"
              value={freezeName}
              onChange={(e) => onFreezeNameChange(e.target.value)}
            />
          </div>
          <div>
            <label className="fn-label block">Nota</label>
            <input
              className="fn-input mt-1 text-sm"
              value={freezeNotes}
              onChange={(e) => onFreezeNotesChange(e.target.value)}
            />
          </div>
        </div>
      </details>

      {!hideRegionalTable && (
      <section
        ref={tableRef}
        className="fn-bento mt-4 p-4"
        aria-label="Tabella regioni"
        id="region-table"
      >
        <h2 className="fn-label mb-3">Terminale regionale · 20 regioni</h2>
        {poll.length > 0 ? (
          <RegionalPollTable
            poll={poll}
            scenario={scenario}
            selectedRegion={selectedRegion}
            onSelect={(r) => onSelectRegion(r)}
            baselineSnapshot={baselineForTable}
            baselineLabel={baselineLabel}
            baselineOptions={baselineOptions}
            baselineId={baselineId}
            onBaselineIdChange={onBaselineIdChange}
            compareSnapshot={compareSnapshot}
            onCompareSnapshotChange={onCompareSnapshotChange}
            hoveredRegion={hoveredRegion}
            onHoverRegion={setHoveredRegion}
            classFilter={classFilter}
            onClassFilterChange={setClassFilter}
          />
        ) : (
          <p className="text-sm text-fn-text-muted">Calcolo sondaggio…</p>
        )}
      </section>
      )}
    </div>
  );
}
