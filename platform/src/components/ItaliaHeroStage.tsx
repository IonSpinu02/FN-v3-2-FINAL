"use client";

import { ItalyMap, type MapColorMode } from "@/components/ItalyMap";
import { NationalIntelligencePanel } from "@/components/NationalIntelligencePanel";
import {
  FLUSSI_PRESETS,
  OFFICIAL_S,
  type FlussiIpsos,
} from "@/lib/engine/defaults";
import type { InstitutionalRow } from "@/lib/engine/calculate";
import type { Region } from "@/lib/engine/constants";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { FnConfig, ScenarioResult } from "@/lib/engine/types";
import { pp } from "@/lib/format";
import { STIMA_LEGEND_BANDS } from "@/lib/mapDisplay";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { useMemo, useState } from "react";

const FLUSSI_UI: { key: string; label: string; match: FlussiIpsos }[] = [
  {
    key: "default",
    label: "Default v3.2",
    match: FLUSSI_PRESETS["Default Ipsos v3.2 (31% / 25% / 36%)"],
  },
  {
    key: "lega",
    label: "Spinta Ex-Lega Nord",
    match: FLUSSI_PRESETS["Spinta Ex-Lega Nord (26% / 38% / 28%)"],
  },
  {
    key: "ast",
    label: "Recupero Astensione",
    match: FLUSSI_PRESETS["Recupero Astensione (25% / 20% / 48%)"],
  },
];

const MAP_LAYER_MODES: { id: MapColorMode; label: string }[] = [
  { id: "stima", label: "Stima %" },
  { id: "probSoglia", label: "Prob. Soglia" },
  { id: "scartoBenchmark", label: "Scarto" },
];

function flussiEqual(a: FlussiIpsos, b: FlussiIpsos): boolean {
  return (
    Math.abs(a.FdI - b.FdI) < 0.002 &&
    Math.abs(a.Lega - b.Lega) < 0.002 &&
    Math.abs(a.ast - b.ast) < 0.002
  );
}

const FLUSSI_PRESET_LABELS: Record<
  string,
  { title: string; f: FlussiIpsos; caption: string }
> = {
  default: {
    title: "DEFAULT V3.2",
    f: FLUSSI_PRESETS["Default Ipsos v3.2 (31% / 25% / 36%)"],
    caption: "FdI 31 · Lega 25 · Ast 36",
  },
  lega: {
    title: "SPINTA EX-LEGA NORD",
    f: FLUSSI_PRESETS["Spinta Ex-Lega Nord (26% / 38% / 28%)"],
    caption: "FdI 26 · Lega 38 · Ast 28",
  },
  ast: {
    title: "RECUPERO ASTENSIONE",
    f: FLUSSI_PRESETS["Recupero Astensione (25% / 20% / 48%)"],
    caption: "FdI 25 · Lega 20 · Ast 48",
  },
};

function EntropyGauge({ h }: { h: number }) {
  const uniform = Math.min(1, Math.max(0, h)) * 100;
  const circ = 2 * Math.PI * 34;
  const dash = (uniform / 100) * circ;
  return (
    <svg width={76} height={76} className="shrink-0 -rotate-90" aria-hidden>
      <circle cx={38} cy={38} r={34} fill="none" stroke="#162032" strokeWidth={6} />
      <circle
        cx={38}
        cy={38}
        r={34}
        fill="none"
        stroke="#10B981"
        strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="butt"
      />
    </svg>
  );
}

function FlussiTripBar({ f }: { f: FlussiIpsos }) {
  return (
    <div className="mt-2 flex h-[3px] overflow-hidden bg-[#162032]">
      <div className="bg-orange-500" style={{ width: `${f.FdI * 100}%` }} />
      <div className="bg-sky-400" style={{ width: `${f.Lega * 100}%` }} />
      <div className="bg-slate-500" style={{ width: `${f.ast * 100}%` }} />
    </div>
  );
}

function TickerStatusMark({
  classificazione,
}: {
  classificazione: RegionPollResult["classificazione"];
}) {
  const color =
    classificazione === "sicura"
      ? "bg-emerald-400"
      : classificazione === "contesa"
        ? "bg-amber-400"
        : "bg-rose-500";
  return <span className={`mr-2 inline-block h-1.5 w-1.5 rotate-45 ${color}`} aria-hidden />;
}

function LiveTicker({ poll }: { poll: RegionPollResult[] }) {
  const sorted = useMemo(
    () => [...poll].sort((a, b) => b.piHat - a.piHat),
    [poll],
  );
  const segment = (
    <span className="inline-flex items-center">
      {sorted.map((p, i) => (
        <span key={p.regione} className="inline-flex items-center">
          <TickerStatusMark classificazione={p.classificazione} />
          <span className="font-semibold text-slate-300">{p.regione.toUpperCase()}</span>
          <span className="ml-1.5 font-mono text-emerald-400">
            {(p.piHat * 100).toFixed(2).replace(".", ",")}%
          </span>
          {i < sorted.length - 1 && <span className="mx-3 text-slate-700">//</span>}
        </span>
      ))}
    </span>
  );
  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <div className="fn-live-ticker flex whitespace-nowrap font-mono text-[10px]">
        <span className="pr-12">{segment}</span>
        <span className="pr-12" aria-hidden>
          {segment}
        </span>
      </div>
    </div>
  );
}

export function ItaliaHeroStage({
  scenario,
  poll,
  mapValues,
  mapMode,
  onMapModeChange,
  selectedRegion,
  onSelectRegion,
  hoveredRegion,
  onHoverRegion,
  classFilter,
  onClassFilterChange,
  pollByRegion,
  votesByRegion,
  S,
  flussiIpsos,
  onSChange,
  onFlussiPreset,
  onAdjustInst,
  onResetInstRegion,
  onScrollToTable,
  fnConfig,
  regionQuickDelta,
  baselineScenario,
}: {
  scenario: ScenarioResult;
  poll: RegionPollResult[];
  mapValues: Record<string, number>;
  mapMode: MapColorMode;
  onMapModeChange: (m: MapColorMode) => void;
  selectedRegion: string | null;
  onSelectRegion: (r: string | null) => void;
  hoveredRegion: string | null;
  onHoverRegion: (r: string | null) => void;
  classFilter: "all" | RegionPollResult["classificazione"];
  onClassFilterChange: (f: "all" | RegionPollResult["classificazione"]) => void;
  pollByRegion: Record<string, RegionPollResult>;
  votesByRegion: Record<string, number>;
  S: number;
  flussiIpsos: FlussiIpsos;
  onSChange: (s: number) => void;
  onFlussiPreset: (f: FlussiIpsos) => void;
  onAdjustInst?: (carica: keyof InstitutionalRow, delta: number) => void;
  onResetInstRegion?: () => void;
  onScrollToTable: () => void;
  fnConfig?: FnConfig;
  regionQuickDelta?: Partial<InstitutionalRow>;
  baselineScenario?: ScenarioResult;
}) {
  const { parametri, metriche } = scenario;
  const totVoti = scenario.righe.reduce((s, r) => s + r.voti_di_scenario, 0);
  const [showRegionLabels, setShowRegionLabels] = useState(true);
  const [showCapitals, setShowCapitals] = useState(true);
  const [showLatLonGrid, setShowLatLonGrid] = useState(false);
  const [surgeKey, setSurgeKey] = useState(0);

  const animS = useAnimatedNumber(parametri.S * 100);
  const animVoti = useAnimatedNumber(totVoti);
  const animH = useAnimatedNumber(metriche.H.scenario);
  const animBench = useAnimatedNumber(metriche.differenza_media_ponderata_scenario_benchmark_punti);

  const handleSChange = (v: number) => {
    setSurgeKey((k) => k + 1);
    onSChange(v);
  };

  const handleFlussi = (f: FlussiIpsos) => {
    setSurgeKey((k) => k + 1);
    onFlussiPreset(f);
  };

  const handleAdjust = (carica: keyof InstitutionalRow, delta: number) => {
    onAdjustInst?.(carica, delta);
  };

  const segBtn =
    "px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors";
  const toggle =
    "border border-[#1B2436] px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors";
  const toggleOn = "bg-[#162032] text-slate-100";
  const toggleOff = "bg-transparent text-slate-500 hover:text-slate-200";

  const scenarioRow = selectedRegion
    ? scenario.righe.find((r) => r.regione === selectedRegion)
    : undefined;
  const baselineRow = selectedRegion
    ? baselineScenario?.righe.find((r) => r.regione === selectedRegion)
    : undefined;

  return (
    <section
      className="relative flex h-screen min-h-[760px] w-full max-w-full overflow-hidden bg-[#070A10] bg-[linear-gradient(to_right,#111622_1px,transparent_1px),linear-gradient(to_bottom,#111622_1px,transparent_1px)] bg-[size:32px_32px]"
      aria-label="Stage cartografico Italia"
    >
      <aside className="absolute bottom-28 left-6 top-20 z-20 w-[330px] overflow-y-auto">
        <div className="overflow-hidden rounded-xl border border-[#1B2436] bg-[#080C14]/90 divide-y divide-[#1B2436]">
          <div className="p-4">
            <p className="font-mono text-[10px] tracking-[0.15em] text-slate-500">
              01 // CONSENSO NAZIONALE (MODULO A)
            </p>
            <div className="mt-3 flex items-start gap-3">
              <p className="font-mono text-[44px] font-bold leading-none tracking-tighter tabular-nums text-white">
                {animS.toFixed(2).replace(".", ",")}%
              </p>
              <div>
                <p className="font-mono text-[9px] uppercase text-slate-500">Entropia H</p>
                <EntropyGauge h={metriche.H.scenario} />
                <p className="font-mono text-[10px] tabular-nums text-slate-400">
                  {animH.toFixed(4).replace(".", ",")}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-[#1B2436] font-mono text-[10px] tabular-nums">
              <div className="pr-2">
                <p className="text-slate-500">VOTI SCENARIO</p>
                <p className="mt-1 text-slate-100">
                  {Math.round(animVoti).toLocaleString("it-IT")}
                </p>
              </div>
              <div className="px-2">
                <p className="text-slate-500">H ISCRITTI</p>
                <p className="mt-1 text-slate-100">{animH.toFixed(4).replace(".", ",")}</p>
              </div>
              <div className="pl-2">
                <p className="text-slate-500">SCARTO BENCH.</p>
                <p className="mt-1 text-[#34D399]">{pp(animBench, 2)}</p>
              </div>
            </div>
          </div>

          <div className="p-4">
            <p className="font-mono text-[10px] tracking-[0.15em] text-slate-500">
              02 // CALIBRAZIONE S NAZIONALE
            </p>
            <input
              type="range"
              min={1}
              max={20}
              step={0.1}
              value={S * 100}
              onChange={(e) => handleSChange(Number(e.target.value) / 100)}
              className="mt-3 h-1 w-full cursor-pointer appearance-none bg-[#162032] accent-emerald-500"
            />
            <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-600">
              <span>4%</span>
              <span>6%</span>
              <span>7,2%</span>
              <span>9%</span>
              <span>12%</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1">
              <button
                type="button"
                className={`${toggle} ${toggleOff}`}
                onClick={() => handleSChange(Math.max(0.01, S - 0.005))}
              >
                -0,5 pp
              </button>
              <button
                type="button"
                className={`${toggle} ${toggleOn}`}
                onClick={() => handleSChange(OFFICIAL_S)}
              >
                BASE 7,20%
              </button>
              <button
                type="button"
                className={`${toggle} ${toggleOff}`}
                onClick={() => handleSChange(Math.min(0.2, S + 0.005))}
              >
                +0,5 pp
              </button>
            </div>
          </div>

          <div className="p-4">
            <p className="font-mono text-[10px] tracking-[0.15em] text-slate-500">
              03 // MATRICE FLUSSI 2026
            </p>
            <div className="mt-2 space-y-1">
              {FLUSSI_UI.map(({ key, match }) => {
                const meta = FLUSSI_PRESET_LABELS[key]!;
                const on = flussiEqual(flussiIpsos, match);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleFlussi({ ...match })}
                    className={`flex w-full items-center justify-between border px-2 py-2 text-left ${
                      on ? "border-emerald-500/40 bg-[#162032]" : "border-[#1B2436] hover:bg-[#0C101A]"
                    }`}
                  >
                    <div>
                      <p className="font-mono text-[10px] font-semibold text-slate-200">
                        {meta.title}
                      </p>
                      <p className="font-mono text-[9px] text-slate-500">{meta.caption}</p>
                      <FlussiTripBar f={meta.f} />
                    </div>
                    <span
                      className={`ml-2 h-2 w-2 shrink-0 ${on ? "bg-emerald-400" : "border border-slate-600"}`}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4">
            <p className="font-mono text-[10px] tracking-[0.15em] text-slate-500">
              04 // STRATI CARTOGRAFICI
            </p>
            <div className="mt-2 grid grid-cols-3 border border-[#1B2436]">
              {MAP_LAYER_MODES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onMapModeChange(id)}
                  className={`${segBtn} ${
                    mapMode === id ? "bg-[#162032] text-white" : "text-slate-500 hover:text-slate-200"
                  }`}
                >
                  {label.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <button
                type="button"
                className={`${toggle} ${showRegionLabels ? toggleOn : toggleOff}`}
                onClick={() => setShowRegionLabels((v) => !v)}
              >
                PODIO TOP 3
              </button>
              <button
                type="button"
                className={`${toggle} ${showCapitals ? toggleOn : toggleOff}`}
                onClick={() => setShowCapitals((v) => !v)}
              >
                NODI CAPOLUOGHI
              </button>
              <button
                type="button"
                className={`${toggle} ${showLatLonGrid ? toggleOn : toggleOff}`}
                onClick={() => setShowLatLonGrid((v) => !v)}
              >
                RETICOLO GEO
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="mt-2 text-left font-mono text-[10px] uppercase text-slate-500 hover:text-slate-300"
          onClick={onScrollToTable}
        >
          Tabella 20 regioni
        </button>
      </aside>

      <div className="absolute inset-x-[370px] top-20 bottom-36 z-10 flex min-w-0 flex-col overflow-hidden border-none bg-transparent px-2 shadow-none">
        <ItalyMap
          variant="hero"
          layout="holographic"
          valuesByRegion={mapValues}
          colorMode={mapMode}
          selectedRegion={selectedRegion}
          highlightedRegion={hoveredRegion}
          pollByRegion={pollByRegion}
          votesByRegion={votesByRegion}
          onRegionHover={onHoverRegion}
          onRegionClick={(r) => onSelectRegion(r)}
          onClearSelection={() => onSelectRegion(null)}
          classFilter={classFilter}
          onClassFilterChange={onClassFilterChange}
          zoomControls="none"
          hideStatusPills
          showRegionLabels={showRegionLabels}
          showCapitals={showCapitals}
          showLatLonGrid={showLatLonGrid}
          energySurgeKey={surgeKey}
        />
      </div>

      <aside className="absolute bottom-28 right-6 top-20 z-20 w-[350px] overflow-y-auto">
        <NationalIntelligencePanel
          poll={poll}
          selectedRegion={selectedRegion}
          onSelectRegion={onSelectRegion}
          onAdjustInst={selectedRegion ? handleAdjust : undefined}
          onResetRegion={selectedRegion ? onResetInstRegion : undefined}
          variant="holographic"
          fnConfig={fnConfig}
          region={selectedRegion as Region | undefined}
          regionQuickDelta={regionQuickDelta}
          scenarioRow={scenarioRow}
          baselineRow={baselineRow}
          nationalS={parametri.S}
        />
      </aside>

      <div className="absolute bottom-20 left-6 right-6 z-30 flex max-w-full items-center gap-3 overflow-hidden border border-[#1B2436] bg-[#080C14]/95 px-4 py-2 shadow-lg backdrop-blur-sm">
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-emerald-400">
          Stima %
        </span>
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          {STIMA_LEGEND_BANDS.map((b) => (
            <span
              key={b.label}
              className="h-2 w-6 rounded-sm"
              style={{ background: b.color }}
              title={b.label}
            />
          ))}
        </div>
        <LiveTicker poll={poll} />
      </div>
    </section>
  );
}
