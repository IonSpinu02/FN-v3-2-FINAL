"use client";

import { Btn } from "@/components/ui/FnUi";
import { TricolorMark } from "@/components/ui/TelemetryUi";
import { FileDown } from "lucide-react";
import type { ReactNode } from "react";

export function StageTopHud({
  brandExtra,
  methodologyPill,
  scenarioControls,
  onExportPdf,
  busy,
  frostedBar = true,
}: {
  brandExtra?: ReactNode;
  methodologyPill: ReactNode;
  scenarioControls?: ReactNode;
  onExportPdf: () => void;
  busy?: boolean;
  /** Barra piena opaca durante lo scroll (disattiva in mappa immersive). */
  frostedBar?: boolean;
}) {
  return (
    <div
      className={`pointer-events-none fixed left-0 right-0 top-0 z-50 border-b px-6 py-2.5 ${
        frostedBar
          ? "border-[#161F30] bg-[#060911]/95 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="pointer-events-auto mx-auto flex max-w-[1600px] items-center justify-between gap-3">
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#070D19]/80 px-4 py-2 shadow-lg backdrop-blur-md">
        <TricolorMark />
        <span className="text-xs font-bold tracking-wide text-white/90">
          FUTURO NAZIONALE · v3.2
        </span>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        {brandExtra}
      </div>

      <div className="pointer-events-auto hidden max-w-md flex-1 justify-center md:flex">
        {methodologyPill}
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
        {scenarioControls}
        <Btn variant="primary" className="fn-btn-glow" disabled={busy} onClick={onExportPdf}>
          <FileDown className="h-4 w-4" aria-hidden />
          Esporta PDF
        </Btn>
      </div>
      </div>
    </div>
  );
}

export type ScenarioViewMode = "showcase" | "map-matrix";

export function ScenarioViewSwitch({
  mode,
  onChange,
}: {
  mode: ScenarioViewMode;
  onChange: (m: ScenarioViewMode) => void;
}) {
  const items: { id: ScenarioViewMode; label: string }[] = [
    { id: "map-matrix", label: "Mappa tattica" },
    { id: "showcase", label: "Showcase" },
  ];
  return (
    <div className="inline-flex max-w-[min(100vw-2rem,560px)] flex-wrap justify-end rounded-full border border-white/15 bg-black/40 p-0.5 text-[10px] font-semibold sm:text-[11px]">
      {items.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-full px-2.5 py-1.5 transition-all sm:px-3 ${
            mode === id
              ? id === "showcase"
                ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.45)]"
                : "bg-emerald-500 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.4)]"
              : "text-slate-400 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** @deprecated Use ScenarioViewSwitch */
export function StageModeSwitch({
  holographic,
  onHolographic,
  onConsole,
}: {
  holographic: boolean;
  onHolographic: () => void;
  onConsole: () => void;
}) {
  return (
    <ScenarioViewSwitch
      mode={holographic ? "map-matrix" : "showcase"}
      onChange={(m) => {
        if (m === "map-matrix") onHolographic();
        if (m === "showcase") onConsole();
      }}
    />
  );
}
