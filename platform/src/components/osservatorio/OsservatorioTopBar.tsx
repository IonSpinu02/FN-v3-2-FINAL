"use client";

import {
  nextRegion,
  TERRITORY_NAZIONALE,
  type TerritoryScope,
} from "@/lib/engine/osservatorioTerritoryScope";
import type { Region } from "@/lib/engine/constants";
import { REGIONS } from "@/lib/engine/constants";

const STEPS = [
  { id: "oss-step-1", label: "1. Dove Andare (Regioni)" },
  { id: "oss-step-2", label: "2. Problemi & Programma B.I.P." },
  { id: "oss-step-3", label: "3. Dati ufficiali & Trends" },
] as const;

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function OsservatorioTopBar({
  mainTerritory,
  setMainTerritory,
  regione,
  setRegione,
  onOpenMethodology,
  onOpenData,
}: {
  mainTerritory: TerritoryScope;
  setMainTerritory: (t: TerritoryScope) => void;
  regione: Region;
  setRegione: (r: Region) => void;
  onOpenMethodology: () => void;
  onOpenData: () => void;
}) {
  const isNazionale = mainTerritory === TERRITORY_NAZIONALE;
  const activeLabel = isNazionale ? "Italia" : regione;

  return (
    <div className="sticky top-0 z-40 flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#090D16]/90 px-5 py-3 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMainTerritory(TERRITORY_NAZIONALE)}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            isNazionale
              ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
              : "border-transparent bg-white/[0.04] text-slate-300 hover:text-white"
          }`}
        >
          Italia · Quadro Nazionale
        </button>
        <button
          type="button"
          onClick={() => {
            const r = nextRegion(regione, -1);
            setRegione(r);
            setMainTerritory(r);
          }}
          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-white"
          aria-label="Regione precedente"
        >
          ←
        </button>
        <select
          value={regione}
          onChange={(e) => {
            const r = e.target.value as Region;
            setRegione(r);
            setMainTerritory(r);
          }}
          className={`max-w-[12rem] rounded-lg border px-3 py-1.5 text-sm ${
            !isNazionale
              ? "border-emerald-500/50 bg-emerald-500/10 font-semibold text-white"
              : "border-white/10 bg-[#0A0E17] font-medium text-white"
          }`}
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            const r = nextRegion(regione, 1);
            setRegione(r);
            setMainTerritory(r);
          }}
          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-white"
          aria-label="Regione successiva"
        >
          →
        </button>
      </div>

      <nav className="hidden flex-wrap items-center justify-center gap-1 md:flex">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollTo(s.id)}
            className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => scrollTo("oss-step-2")}
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25"
        >
          Vai ai Problemi di {activeLabel} ↓
        </button>
        <button
          type="button"
          onClick={onOpenMethodology}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.04]"
        >
          Programma B.I.P. &amp; Metodologia
        </button>
        <button
          type="button"
          onClick={onOpenData}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.04]"
        >
          Dati &amp; CSV
        </button>
      </div>
    </div>
  );
}
