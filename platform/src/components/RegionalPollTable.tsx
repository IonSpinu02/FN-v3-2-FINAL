"use client";

import type { RegionPollResult } from "@/lib/engine/regionalPoll";
import { pct } from "@/lib/format";

const CLASS_STYLE: Record<RegionPollResult["classificazione"], string> = {
  sicura: "text-emerald-700 bg-emerald-50",
  contesa: "text-amber-800 bg-amber-50",
  critica: "text-red-700 bg-red-50",
};

export function RegionalPollTable({
  poll,
  selectedRegion,
  onSelect,
}: {
  poll: RegionPollResult[];
  selectedRegion: string | null;
  onSelect: (regione: string) => void;
}) {
  const sorted = [...poll].sort(
    (a, b) => b.probAboveThreshold - a.probAboveThreshold,
  );

  return (
    <div className="fn-table-wrap">
      <table className="fn-table">
        <thead>
          <tr>
            <th>Regione</th>
            <th>Stima</th>
            <th>± MoE</th>
            <th>P(≥ soglia)</th>
            <th>Stato</th>
            <th>Scarto bench.</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr
              key={p.regione}
              data-selected={selectedRegion === p.regione}
              className="cursor-pointer"
              onClick={() => onSelect(p.regione)}
            >
              <td className="font-medium">{p.regione}</td>
              <td className="font-mono">{pct(p.piHat)}</td>
              <td className="font-mono text-xs text-fn-text-muted">
                {pct(p.icLow, 2)} – {pct(p.icHigh, 2)}
              </td>
              <td className="font-mono">
                {(p.probAboveThreshold * 100).toFixed(1)}%
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
