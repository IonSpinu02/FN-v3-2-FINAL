"use client";

import { useMemo, useState } from "react";
import type { ScenarioRow } from "@/lib/engine/types";
import { pct } from "@/lib/format";

type SortKey = keyof Pick<
  ScenarioRow,
  "regione" | "stima" | "benchmark" | "w" | "iscritti"
>;

export function RegionTable({ rows }: { rows: ScenarioRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: "stima",
    asc: false,
  });

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string" && typeof bv === "string") {
        return sort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sort.asc
        ? Number(av) - Number(bv)
        : Number(bv) - Number(av);
    });
    return copy;
  }, [rows, sort]);

  function toggle(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, asc: !s.asc } : { key, asc: false },
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-700/80">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
          <tr>
            <th className="cursor-pointer px-3 py-2" onClick={() => toggle("regione")}>
              Regione
            </th>
            <th className="cursor-pointer px-3 py-2" onClick={() => toggle("stima")}>
              Stima %
            </th>
            <th className="px-3 py-2" onClick={() => toggle("benchmark")}>
              Benchmark %
            </th>
            <th className="px-3 py-2">Sensibilità (lo–hi)</th>
            <th className="px-3 py-2" onClick={() => toggle("w")}>
              Indice w
            </th>
            <th className="px-3 py-2" onClick={() => toggle("iscritti")}>
              Iscritti
            </th>
            <th className="px-3 py-2">Preferenze</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.regione}
              className="border-t border-zinc-800/80 odd:bg-zinc-950/40"
            >
              <td className="px-3 py-2 font-medium text-zinc-100">{r.regione}</td>
              <td className="px-3 py-2 font-mono">{pct(r.stima)}</td>
              <td className="px-3 py-2 font-mono text-zinc-400">
                {pct(r.benchmark)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                {pct(r.lo10, 2)} – {pct(r.hi90, 2)}
              </td>
              <td className="px-3 py-2 font-mono">{r.w.toFixed(3)}</td>
              <td className="px-3 py-2 font-mono">
                {r.iscritti.toLocaleString("it-IT")}
              </td>
              <td className="px-3 py-2">
                <span
                  className={
                    r.tipo_preferenze === "osservato"
                      ? "rounded bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-200"
                      : "rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                  }
                >
                  {r.tipo_preferenze}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
