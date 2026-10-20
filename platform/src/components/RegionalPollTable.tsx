"use client";

import type { RegionPollResult } from "@/lib/engine/regionalPoll";
import type { ScenarioResult } from "@/lib/engine/types";
import { pct } from "@/lib/format";
import { Btn } from "@/components/ui/FnUi";

const CLASS_STYLE: Record<RegionPollResult["classificazione"], string> = {
  sicura: "text-emerald-700 bg-emerald-50",
  contesa: "text-amber-800 bg-amber-50",
  critica: "text-red-700 bg-red-50",
};

const TESSERE_STYLE: Record<RegionPollResult["statoTesseramento"], string> = {
  equilibrato: "text-emerald-800 bg-emerald-50",
  da_strutturare: "text-sky-800 bg-sky-50",
  anomalia_tessere: "text-amber-900 bg-amber-50",
};

const TESSERE_LABEL: Record<RegionPollResult["statoTesseramento"], string> = {
  equilibrato: "Equilibrato",
  da_strutturare: "Aprire sedi (alti flussi)",
  anomalia_tessere: "Verifica conversione",
};

function formatMargineVoti(n: number): string {
  const abs = Math.abs(n).toLocaleString("it-IT");
  return n >= 0 ? `+${abs}` : `-${abs}`;
}

export function RegionalPollTable({
  poll,
  selectedRegion,
  onSelect,
  frozenSnapshot,
  compareSnapshot,
  onCompareSnapshotChange,
}: {
  poll: RegionPollResult[];
  selectedRegion: string | null;
  onSelect: (regione: string) => void;
  frozenSnapshot: ScenarioResult;
  compareSnapshot: boolean;
  onCompareSnapshotChange: (v: boolean) => void;
}) {
  const frozenMap = Object.fromEntries(
    frozenSnapshot.righe.map((r) => [r.regione, r.stima]),
  );
  const sorted = [...poll].sort(
    (a, b) => b.probAboveThreshold - a.probAboveThreshold,
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Btn
          variant={compareSnapshot ? "primary" : "secondary"}
          className="text-xs"
          onClick={() => onCompareSnapshotChange(!compareSnapshot)}
        >
          Confronta con Snapshot 18-10-2026
        </Btn>
        {compareSnapshot && (
          <span className="text-xs text-fn-text-muted">
            Scarto in punti percentuali vs snapshot congelato
          </span>
        )}
      </div>
      <div className="fn-table-wrap">
        <table className="fn-table">
          <thead>
            <tr>
              <th>Regione</th>
              <th>Stima</th>
              <th>± MoE</th>
              <th>P(≥ soglia)</th>
              <th
                title="Sotto la soglia di sbarramento la lista ottiene zero seggi e i voti vanno agli alleati"
              >
                Margine Soglia (Voti)
              </th>
              <th>Salute Tessere</th>
              <th>Stato</th>
              <th>Scarto bench.</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const snap = frozenMap[p.regione];
              const deltaSnap =
                compareSnapshot && snap !== undefined
                  ? (p.piHat - snap) * 100
                  : null;
              return (
                <tr
                  key={p.regione}
                  data-selected={selectedRegion === p.regione}
                  className="cursor-pointer"
                  onClick={() => onSelect(p.regione)}
                >
                  <td className="font-medium">{p.regione}</td>
                  <td className="font-mono">
                    {pct(p.piHat)}
                    {deltaSnap !== null && (
                      <span
                        className={`ml-1 text-[10px] ${
                          deltaSnap >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {deltaSnap >= 0 ? "+" : ""}
                        {deltaSnap.toFixed(2)} pp
                      </span>
                    )}
                  </td>
                  <td className="font-mono text-xs text-fn-text-muted">
                    {pct(p.icLow, 2)} – {pct(p.icHigh, 2)}
                  </td>
                  <td className="font-mono">
                    {(p.probAboveThreshold * 100).toFixed(1)}%
                  </td>
                  <td
                    className={`font-mono text-sm ${
                      p.margineVotiSoglia >= 0
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                    title="Sotto la soglia di sbarramento la lista ottiene zero seggi e i voti vanno agli alleati"
                  >
                    {formatMargineVoti(p.margineVotiSoglia)}
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
                  <td className="font-mono text-xs">
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
