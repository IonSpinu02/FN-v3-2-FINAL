"use client";

import type { Region } from "@/lib/engine/constants";
import { REGIONS } from "@/lib/engine/constants";
import { provincesForRegion } from "@/lib/engine/italianProvinces";
import { buildModuloBViewModel } from "@/lib/engine/moduloBFabbisogniView";
import {
  isRegionScope,
  TERRITORY_NAZIONALE,
  type TerritoryScope,
} from "@/lib/engine/osservatorioTerritoryScope";
import type { FabbisogniCatalogFile } from "@/lib/engine/osservatorioTypes";
import { useEffect, useMemo, useState } from "react";

type TerritoryMode = "nazionale" | "regionale";

export function OsservatorioModuloBPanel({
  fabbisogni,
  regione,
  setRegione,
  setMainTerritory,
}: {
  fabbisogni: FabbisogniCatalogFile | null;
  regione: Region;
  setRegione: (r: Region) => void;
  setMainTerritory: (t: TerritoryScope) => void;
}) {
  const [mode, setMode] = useState<TerritoryMode>("regionale");
  const [province, setProvince] = useState(() => provincesForRegion(regione)[0]!);
  const [period] = useState<"2024_vs_2023">("2024_vs_2023");

  useEffect(() => {
    setProvince(provincesForRegion(regione)[0]!);
  }, [regione]);

  const model = useMemo(
    () =>
      buildModuloBViewModel({
        mode,
        region: regione,
        province,
        period,
        fabbisogni,
      }),
    [mode, regione, province, period, fabbisogni],
  );

  return (
    <section
      id="osservatorio-sec-04"
      className="scroll-mt-28 rounded-2xl border border-white/10 bg-[#060910]/95 shadow-2xl backdrop-blur-md"
    >
      {/* Header + selettore territoriale */}
      <header className="border-b border-white/[0.07] px-6 py-5">
        <p className="font-mono text-[10px] tracking-[0.22em] text-cyan-400">
          MODULO B · I FABBISOGNI DEI CITTADINI
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-400">
          Quadro economico e sociale su base regionale e provinciale, confrontabile nel tempo,
          utile per analizzare la fattibilità e gli effetti delle politiche pubbliche.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("nazionale");
              setMainTerritory(TERRITORY_NAZIONALE);
            }}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
              mode === "nazionale"
                ? "bg-cyan-500/20 text-cyan-100"
                : "border border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            [ Italia · Quadro Nazionale ]
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("regionale");
              if (isRegionScope(regione)) setMainTerritory(regione);
            }}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
              mode === "regionale"
                ? "bg-cyan-500/20 text-cyan-100"
                : "border border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            [ Analisi Regionale &amp; Provinciale ]
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-[10px] text-slate-500">
            Regione
            <select
              disabled={mode === "nazionale"}
              value={regione}
              onChange={(e) => {
                const r = e.target.value as Region;
                setRegione(r);
                setMainTerritory(r);
              }}
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0A0E17] px-2 py-2 text-xs text-white disabled:opacity-40"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[10px] text-slate-500">
            Provincia / Area metropolitana
            <select
              disabled={mode === "nazionale"}
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0A0E17] px-2 py-2 text-xs text-white disabled:opacity-40"
            >
              {provincesForRegion(regione).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[10px] text-slate-500">
            Confronto temporale
            <select
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0A0E17] px-2 py-2 text-xs text-white"
              value={period}
              disabled
            >
              <option value="2024_vs_2023">2024 vs 2023 · Pubbl. BesT 2025</option>
            </select>
          </label>
          <div className="flex items-end">
            <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[10px] text-slate-300">
              Focus: <span className="text-white">{model.territoryLabel}</span>
            </p>
          </div>
        </div>
      </header>

      <div className="border-t border-white/[0.07] p-6">
          <p className="font-mono text-[9px] uppercase tracking-wider text-emerald-400">
            Famiglia 1 // Dati di contesto (indicatori oggettivi)
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            ISTAT, AGENAS, amministrazioni, ARPA, OpenCivitas
          </p>
          <ul className="mt-4 space-y-4">
            {model.objectives.map((d) => (
              <li
                key={d.id}
                className="rounded-xl border border-white/[0.06] bg-[#0A0E17] p-4"
              >
                <p className="text-sm font-semibold text-white">{d.title}</p>
                <p className="mt-0.5 font-mono text-[9px] text-slate-600">{d.sources}</p>
                <p className="mt-2 text-xs text-slate-300">{d.valoreLocale}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Media Italia: {d.mediaItalia}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] text-cyan-200">
                    Δ temporale {d.deltaTemporale}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    Stress {d.stress}/100
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-amber-500"
                    style={{ width: `${d.stress}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
      </div>
    </section>
  );
}
