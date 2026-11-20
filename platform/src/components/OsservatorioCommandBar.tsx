"use client";

import {
  isRegionScope,
  nextRegion,
  TERRITORY_NAZIONALE,
  type TerritoryScope,
} from "@/lib/engine/osservatorioTerritoryScope";
import type { Region } from "@/lib/engine/constants";
import { REGIONS } from "@/lib/engine/constants";
import { fmtPctIt } from "@/lib/osservatorioFormatIt";

const ANCHORS_COMPACT = [
  { id: "osservatorio-sec-01", num: "01", label: "Forza Regioni" },
  { id: "osservatorio-sec-03", num: "03", label: "Radar Problemi" },
  { id: "osservatorio-sec-04", num: "04", label: "Bisogni del territorio" },
] as const;

const ANCHORS_FULL = [
  ...ANCHORS_COMPACT.slice(0, 1),
  { id: "osservatorio-sec-02", num: "02", label: "Scheda del consenso" },
  ...ANCHORS_COMPACT.slice(1),
  { id: "osservatorio-sec-05", num: "05", label: "Eventi e calendario 2027" },
] as const;

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function OsservatorioCommandBar({
  mainTerritory,
  setMainTerritory,
  regione,
  setRegione,
  liveS,
  onToggleDataDrawer,
  onSaveCloud,
  onExportPdf,
  nav = "compact",
}: {
  mainTerritory: TerritoryScope;
  setMainTerritory: (t: TerritoryScope) => void;
  regione: Region;
  setRegione: (r: Region) => void;
  liveS: number;
  onToggleDataDrawer: () => void;
  onSaveCloud: () => void;
  onExportPdf: () => void;
  /** compact = senza 02 Scheda e 05 Modulo C (default hub attuale) */
  nav?: "compact" | "full";
}) {
  const anchors = nav === "full" ? ANCHORS_FULL : ANCHORS_COMPACT;
  return (
    <div className="sticky top-0 z-40 mb-6 flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#070A12]/95 px-3 py-2.5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMainTerritory(TERRITORY_NAZIONALE)}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
            mainTerritory === TERRITORY_NAZIONALE
              ? "bg-emerald-500/20 text-emerald-100"
              : "border border-white/10 text-slate-400"
          }`}
        >
          [ ITALIA · Nazionale ]
        </button>
        <select
          className="max-w-[11rem] rounded-lg border border-white/15 bg-[#0A0E17] px-2 py-1 text-[11px] text-white"
          value={isRegionScope(mainTerritory) ? mainTerritory : regione}
          onChange={(e) => {
            const r = e.target.value as Region;
            setRegione(r);
            setMainTerritory(r);
          }}
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {(["Lazio", "Veneto"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRegione(r);
              setMainTerritory(r);
            }}
            className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-400 hover:text-white"
          >
            {r}
          </button>
        ))}
        <button
          type="button"
          className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-500"
          onClick={() => {
            const r = isRegionScope(mainTerritory) ? mainTerritory : regione;
            setRegione(nextRegion(r, 1));
            setMainTerritory(nextRegion(r, 1));
          }}
          aria-label="Regione successiva"
        >
          →
        </button>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {anchors.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => scrollTo(a.id)}
            className="shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.06] hover:text-white"
          >
            <span className="mr-1 font-mono text-[10px] text-emerald-400">{a.num}</span>
            {a.label}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-200">
          Base {fmtPctIt(liveS * 100, 2)}
        </span>
        <button
          type="button"
          onClick={onToggleDataDrawer}
          className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-300 hover:text-white"
        >
          Dati &amp; CSV
        </button>
        <button
          type="button"
          onClick={onSaveCloud}
          className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-300 hover:text-white"
        >
          Salva Cloud
        </button>
        <button
          type="button"
          onClick={onExportPdf}
          className="rounded-md bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Esporta PDF
        </button>
      </div>
    </div>
  );
}
