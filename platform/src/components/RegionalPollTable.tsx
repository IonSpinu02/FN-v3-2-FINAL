"use client";

import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { ScenarioResult } from "@/lib/engine/types";
import { regionCircoscrizione } from "@/lib/regionCirc";
import { pct } from "@/lib/format";
import { Btn } from "@/components/ui/FnUi";
import { useMemo, useState } from "react";

const CLASS_STYLE: Record<RegionPollResult["classificazione"], string> = {
  sicura: "text-emerald-300 bg-emerald-950/50 ring-1 ring-emerald-500/30",
  contesa: "text-amber-200 bg-amber-950/40 ring-1 ring-amber-500/30",
  critica: "text-red-300 bg-red-950/45 ring-1 ring-red-500/35",
};

const TESSERE_STYLE: Record<RegionPollResult["statoTesseramento"], string> = {
  equilibrato: "text-emerald-300 bg-emerald-950/45 ring-1 ring-emerald-500/25",
  da_strutturare: "text-sky-300 bg-sky-950/45 ring-1 ring-sky-500/30",
  anomalia_tessere: "text-amber-200 bg-amber-950/40 ring-1 ring-amber-500/30",
};

const TESSERE_LABEL: Record<RegionPollResult["statoTesseramento"], string> = {
  equilibrato: "Equilibrato",
  da_strutturare: "Aprire sedi (alti flussi)",
  anomalia_tessere: "Verifica conversione",
};

type SortKey =
  | "regione"
  | "piHat"
  | "margineVotiSoglia"
  | "probAboveThreshold"
  | "iscritti"
  | "votiPerIscritto";

function formatMargineVoti(n: number): string {
  const abs = Math.abs(n).toLocaleString("it-IT");
  return n >= 0 ? `+${abs}` : `-${abs}`;
}

export function RegionalPollTable({
  poll,
  scenario,
  selectedRegion,
  onSelect,
  baselineSnapshot,
  baselineLabel,
  baselineOptions,
  baselineId,
  onBaselineIdChange,
  compareSnapshot,
  onCompareSnapshotChange,
  hoveredRegion,
  onHoverRegion,
  classFilter = "all",
  onClassFilterChange,
}: {
  poll: RegionPollResult[];
  scenario?: ScenarioResult;
  selectedRegion: string | null;
  onSelect: (regione: string) => void;
  baselineSnapshot: ScenarioResult;
  baselineLabel: string;
  baselineOptions?: { id: string; label: string }[];
  baselineId?: string;
  onBaselineIdChange?: (id: string) => void;
  compareSnapshot: boolean;
  onCompareSnapshotChange: (v: boolean) => void;
  hoveredRegion?: string | null;
  onHoverRegion?: (region: string | null) => void;
  classFilter?: "all" | RegionPollResult["classificazione"];
  onClassFilterChange?: (f: "all" | RegionPollResult["classificazione"]) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("probAboveThreshold");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [semaforo, setSemaforo] = useState<
    "all" | RegionPollResult["classificazione"]
  >(classFilter);
  const [circ, setCirc] = useState<"all" | "NO" | "NE" | "C" | "S" | "I">("all");

  const iscrittiMap = useMemo(
    () =>
      Object.fromEntries(
        (scenario?.righe ?? []).map((r) => [r.regione, r.iscritti]),
      ),
    [scenario],
  );

  const frozenMap = Object.fromEntries(
    baselineSnapshot.righe.map((r) => [r.regione, r.stima]),
  );

  const maxPi = useMemo(() => Math.max(...poll.map((p) => p.piHat), 0.01), [poll]);
  const threshold = 0.03;

  const rows = useMemo(() => {
    let list = [...poll];
    if (semaforo !== "all") {
      list = list.filter((p) => p.classificazione === semaforo);
    }
    if (circ !== "all") {
      list = list.filter((p) => regionCircoscrizione(p.regione) === circ);
    }
    list.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case "regione":
          av = a.regione;
          bv = b.regione;
          break;
        case "piHat":
          av = a.piHat;
          bv = b.piHat;
          break;
        case "margineVotiSoglia":
          av = a.margineVotiSoglia;
          bv = b.margineVotiSoglia;
          break;
        case "probAboveThreshold":
          av = a.probAboveThreshold;
          bv = b.probAboveThreshold;
          break;
        case "iscritti":
          av = iscrittiMap[a.regione] ?? 0;
          bv = iscrittiMap[b.regione] ?? 0;
          break;
        case "votiPerIscritto":
          av = a.votiPerIscritto;
          bv = b.votiPerIscritto;
          break;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return list;
  }, [poll, semaforo, circ, sortKey, sortDir, iscrittiMap]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function setSemaforoFilter(
    v: "all" | RegionPollResult["classificazione"],
  ) {
    setSemaforo(v);
    onClassFilterChange?.(v);
  }

  const SortTh = ({
    label,
    col,
  }: {
    label: string;
    col: SortKey;
  }) => (
    <th>
      <button
        type="button"
        className="fn-th-sort"
        onClick={() => toggleSort(col)}
      >
        {label}
        {sortKey === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {baselineOptions && baselineOptions.length > 1 && onBaselineIdChange && (
          <select
            className="fn-input py-1 text-xs"
            value={baselineId}
            onChange={(e) => onBaselineIdChange(e.target.value)}
          >
            {baselineOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <Btn
          variant={compareSnapshot ? "primary" : "secondary"}
          className="text-xs"
          onClick={() => onCompareSnapshotChange(!compareSnapshot)}
        >
          Confronta con {baselineLabel}
        </Btn>
        <div className="fn-segment text-[10px]">
          {(
            [
              ["all", "Tutte"],
              ["sicura", "Sicure"],
              ["contesa", "Contese"],
              ["critica", "Critiche"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-active={semaforo === id}
              onClick={() => setSemaforoFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          className="fn-input w-auto py-1 text-xs"
          value={circ}
          onChange={(e) => setCirc(e.target.value as typeof circ)}
        >
          <option value="all">Tutte circ.</option>
          <option value="NO">NO</option>
          <option value="NE">NE</option>
          <option value="C">C</option>
          <option value="S">S</option>
          <option value="I">I</option>
        </select>
      </div>
      <div className="fn-table-wrap">
        <table className="fn-table">
          <thead>
            <tr>
              <SortTh label="Regione" col="regione" />
              <SortTh label="Stima %" col="piHat" />
              <th>± MoE</th>
              <SortTh label="P(≥ soglia)" col="probAboveThreshold" />
              <SortTh label="Margine voti" col="margineVotiSoglia" />
              <SortTh label="Iscritti" col="iscritti" />
              <SortTh label="Voti/isc." col="votiPerIscritto" />
              <th>Salute</th>
              <th>Stato</th>
              <th>Scarto bench.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const snap = frozenMap[p.regione];
              const deltaSnap =
                compareSnapshot && snap !== undefined
                  ? (p.piHat - snap) * 100
                  : null;
              const barW = (p.piHat / maxPi) * 100;
              const threshPos = (threshold / maxPi) * 100;
              return (
                <tr
                  key={p.regione}
                  data-selected={selectedRegion === p.regione}
                  data-hovered={hoveredRegion === p.regione}
                  className="fn-table-row-interactive cursor-pointer"
                  onClick={() => onSelect(p.regione)}
                  onMouseEnter={() => onHoverRegion?.(p.regione)}
                  onMouseLeave={() => onHoverRegion?.(null)}
                >
                  <td className="font-medium">{p.regione}</td>
                  <td className="relative min-w-[120px] font-mono tabular-nums">
                    <div
                      className="pointer-events-none absolute inset-y-1 left-0 rounded-sm bg-emerald-500/15"
                      style={{ width: `${barW}%` }}
                    />
                    <div
                      className="pointer-events-none absolute bottom-1 top-1 w-px bg-amber-400/80"
                      style={{ left: `${threshPos}%` }}
                      title="Soglia 3%"
                    />
                    <span className="relative z-[1]">{pct(p.piHat)}</span>
                    {deltaSnap !== null && (
                      <span
                        className={`relative z-[1] ml-1 text-[10px] ${
                          deltaSnap >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {deltaSnap >= 0 ? "+" : ""}
                        {deltaSnap.toFixed(2)} pp
                      </span>
                    )}
                  </td>
                  <td className="font-mono text-xs tabular-nums text-fn-text-muted">
                    {pct(p.icLow, 2)} – {pct(p.icHigh, 2)}
                  </td>
                  <td className="font-mono tabular-nums">
                    {(p.probAboveThreshold * 100).toFixed(1)}%
                  </td>
                  <td
                    className={`font-mono text-sm tabular-nums ${
                      p.margineVotiSoglia >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {formatMargineVoti(p.margineVotiSoglia)}
                  </td>
                  <td className="font-mono text-xs tabular-nums">
                    {(iscrittiMap[p.regione] ?? 0).toLocaleString("it-IT")}
                  </td>
                  <td className="font-mono text-xs tabular-nums">
                    {p.votiPerIscritto.toFixed(2)}
                  </td>
                  <td>
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[10px] leading-snug ${TESSERE_STYLE[p.statoTesseramento]}`}
                    >
                      {TESSERE_LABEL[p.statoTesseramento]}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-xs capitalize ${CLASS_STYLE[p.classificazione]}`}
                    >
                      {p.classificazione}
                    </span>
                  </td>
                  <td className="font-mono text-xs tabular-nums">
                    {(p.scartoVsBenchmark * 100).toFixed(2)} pp
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
