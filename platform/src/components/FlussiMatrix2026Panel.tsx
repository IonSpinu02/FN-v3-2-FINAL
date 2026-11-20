"use client";

import {
  FLUSSI_MATRICES,
  type FlussiIpsos,
  type FlussiMatrixId,
  detectFlussiMatrixId,
  flussiFromMatrix,
  flussiQuotesEqual,
} from "@/lib/politicalModel";

function FlussiQuadGrid({
  q,
}: {
  q: { FdI: number; Lega: number; ast: number; altri: number };
}) {
  const cells = [
    { key: "FdI", label: "FdI", value: q.FdI, color: "bg-orange-500", text: "text-orange-300" },
    { key: "Lega", label: "Lega", value: q.Lega, color: "bg-sky-400", text: "text-sky-300" },
    { key: "Ast", label: "Ast.", value: q.ast, color: "bg-slate-400", text: "text-slate-300" },
    { key: "Altri", label: "Altri", value: q.altri, color: "bg-violet-500", text: "text-violet-300" },
  ];
  return (
    <div className="mt-0 grid grid-cols-2 gap-1.5">
      {cells.map((c) => (
        <div
          key={c.key}
          className="rounded border border-white/[0.06] bg-black/25 px-1.5 py-1"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-wide text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-sm ${c.color}`} aria-hidden />
              {c.label}
            </span>
            <span className={`font-mono text-[10px] font-semibold tabular-nums ${c.text}`}>
              {(c.value * 100).toFixed(1).replace(".", ",")}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FlussiMatrix2026Panel({
  flussiIpsos,
  activeMatrixId,
  onSelectMatrix,
  variant = "sidebar",
}: {
  flussiIpsos: FlussiIpsos;
  activeMatrixId?: FlussiMatrixId | null;
  onSelectMatrix: (id: FlussiMatrixId) => void;
  variant?: "sidebar" | "compact";
}) {
  const resolvedId =
    activeMatrixId ?? detectFlussiMatrixId(flussiIpsos) ?? "ipsos_luglio_2026";

  const sectionLabel =
    variant === "sidebar"
      ? "03 // MATRICE FLUSSI 2026"
      : "Matrice flussi 2026";

  const wrapperClass =
    variant === "sidebar"
      ? "relative z-[2] p-4"
      : "rounded-xl border border-[#1B2436] bg-[#080C14]/90 p-4";

  return (
    <div className={wrapperClass}>
      <p className="font-mono text-[10px] tracking-[0.15em] text-slate-500">{sectionLabel}</p>
      <div className={`space-y-1.5 ${variant === "sidebar" ? "mt-2" : "mt-3"}`}>
        {FLUSSI_MATRICES.map((matrix) => {
          const on =
            resolvedId === matrix.id ||
            flussiQuotesEqual(flussiIpsos, flussiFromMatrix(matrix.id));
          return (
            <button
              key={matrix.id}
              type="button"
              onClick={() => onSelectMatrix(matrix.id)}
              className={`flex w-full flex-col border px-2.5 py-2 text-left transition-colors ${
                on
                  ? "border-emerald-500/45 bg-emerald-500/[0.08]"
                  : "border-[#1B2436] hover:bg-[#0C101A]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-mono text-[10px] font-semibold text-slate-200">
                  {matrix.title}
                </p>
                <span
                  className={`shrink-0 font-mono text-[8px] font-bold uppercase tracking-wide ${
                    on ? "text-emerald-300" : "text-slate-600"
                  }`}
                >
                  {on ? "● ATTIVA" : "○"}
                </span>
              </div>
              <span className="mb-2.5 mt-1.5 inline-flex w-fit max-w-full rounded border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wide text-cyan-200/90">
                {matrix.badge}
              </span>
              <FlussiQuadGrid q={matrix.quotes} />
              <p className="mt-1.5 font-mono text-[8px] leading-snug text-slate-600">
                {matrix.sourceShort}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
