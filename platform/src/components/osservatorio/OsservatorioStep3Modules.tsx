"use client";

import { FlussiMatrix2026Panel } from "@/components/FlussiMatrix2026Panel";
import { buildModuloBViewModel } from "@/lib/engine/moduloBFabbisogniView";
import { provincesForRegion } from "@/lib/engine/italianProvinces";
import type { Region } from "@/lib/engine/constants";
import type { FabbisogniCatalogFile } from "@/lib/engine/osservatorioTypes";
import type { ScenarioResult } from "@/lib/engine/types";
import type { FlussiIpsos, FlussiMatrixId } from "@/lib/politicalModel";
import { FLUSSI_MATRICES, formatFlussiPctIt } from "@/lib/politicalModel";
import type { SchedaMensileRiga } from "@/lib/engine/osservatorioTypes";
import { useMemo, useState } from "react";

const BENTO =
  "rounded-2xl border border-white/[0.08] bg-[#090D16] p-6";

export function OsservatorioStep3Modules({
  regione,
  scenario,
  fabbisogni,
  flussiIpsos,
  flussiMatrixId,
  onSelectFlussiMatrix,
  schedaRows,
}: {
  regione: Region;
  scenario: ScenarioResult;
  fabbisogni: FabbisogniCatalogFile | null;
  flussiIpsos: FlussiIpsos;
  flussiMatrixId: FlussiMatrixId;
  onSelectFlussiMatrix: (id: FlussiMatrixId) => void;
  schedaRows: SchedaMensileRiga[];
}) {
  const [province, setProvince] = useState(() => provincesForRegion(regione)[0]!);

  const moduloB = useMemo(
    () =>
      buildModuloBViewModel({
        mode: "regionale",
        region: regione,
        province,
        period: "2024_vs_2023",
        fabbisogni,
      }),
    [regione, province, fabbisogni],
  );

  const hIscrittiPct = (scenario.metriche.H.iscritti * 100).toFixed(1).replace(".", ",");

  const ipsos = FLUSSI_MATRICES.find((m) => m.id === "ipsos_luglio_2026")!;
  const sky = FLUSSI_MATRICES.find((m) => m.id === "skytg24_ottobre_2026")!;

  return (
    <section id="oss-step-3" className="scroll-mt-28 space-y-5">
      <header className="px-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          3 // Quadro dati ufficiali
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Dati ufficiali — {regione}
        </h2>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className={BENTO}>
          <p className="font-mono text-[9px] uppercase text-emerald-400">Flussi elettorali</p>
          <h3 className="mt-1 text-sm font-semibold text-white">Ipsos vs Sky TG24</h3>
          <div className="mt-4 space-y-2 text-[11px] text-slate-400">
            <p>
              <strong className="text-slate-200">Ipsos luglio:</strong>{" "}
              {formatFlussiPctIt(ipsos.quotes.ast)} ast · {formatFlussiPctIt(ipsos.quotes.FdI)} FdI ·{" "}
              {formatFlussiPctIt(ipsos.quotes.Lega)} Lega
            </p>
            <p>
              <strong className="text-slate-200">Sky ottobre:</strong>{" "}
              {formatFlussiPctIt(sky.quotes.ast)} ast · {formatFlussiPctIt(sky.quotes.FdI)} FdI ·{" "}
              {formatFlussiPctIt(sky.quotes.Lega)} Lega
            </p>
          </div>
          <div className="mt-4">
            <FlussiMatrix2026Panel
              variant="compact"
              flussiIpsos={flussiIpsos}
              activeMatrixId={flussiMatrixId}
              onSelectMatrix={onSelectFlussiMatrix}
            />
          </div>
          <p className="mt-4 font-mono text-[10px] text-slate-500">
            Equilibrio nazionale tesseramento H: {hIscrittiPct}%
          </p>
        </div>

        <div className={BENTO}>
          <p className="font-mono text-[9px] uppercase text-cyan-400">ISTAT / AGENAS</p>
          <label className="mt-2 block text-[10px] text-slate-500">
            Provincia
            <select
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0A0E17] px-2 py-1.5 text-xs text-white"
            >
              {provincesForRegion(regione).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <ul className="mt-4 space-y-3">
            {moduloB.objectives.slice(0, 5).map((dim) => (
              <li key={dim.id}>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-slate-200">{dim.title}</span>
                  <span className="font-mono text-[10px] text-slate-500">{dim.stress}/100</span>
                </div>
                <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-cyan-500/80"
                    style={{ width: `${Math.min(100, dim.stress)}%` }}
                  />
                  <div
                    className="h-full bg-slate-600/50"
                    style={{ width: `${Math.min(100, 100 - dim.stress)}%` }}
                    title="Benchmark Italia"
                  />
                </div>
                <p className="mt-0.5 text-[9px] text-slate-600 line-clamp-1">{dim.valoreLocale}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className={BENTO}>
          <p className="font-mono text-[9px] uppercase text-violet-400">Scheda mensile §8</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Google Trends e piani di soluzione nella console sopra.
          </p>
          <ul className="mt-4 space-y-2 text-[11px] text-slate-400">
            {schedaRows.slice(0, 6).map((r) => (
              <li
                key={r.dimensione}
                className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
              >
                <span className="font-medium text-slate-300">
                  {r.dimensione.split("(")[0]?.trim()}:
                </span>{" "}
                {r.indicatoreStato}
                {r.nota ? (
                  <p className="mt-0.5 text-[10px] text-slate-600 line-clamp-2">{r.nota}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
