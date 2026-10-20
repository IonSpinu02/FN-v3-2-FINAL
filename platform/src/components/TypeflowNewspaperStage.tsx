"use client";

import { useEffect, useState } from "react";

export const RSS_SCAN_MIN_MS = 1600;
const NODE_TICK_MS = 80;
const NODE_COUNT = 31;

const SCAN_NODES = [
  "PIE",
  "VDA",
  "LOM",
  "TAA",
  "VEN",
  "FVG",
  "LIG",
  "EMR",
  "TOS",
  "UMB",
  "MAR",
  "LAZ",
  "ABR",
  "MOL",
  "CAM",
  "PUG",
  "BAS",
  "CAL",
  "SIC",
  "SAR",
  "ANSA-POL",
  "ANSA-ECO",
  "SOLE24",
  "CORRIERE",
  "REPUBBLICA",
  "MESSAGGERO",
  "GAZZETTINO",
  "MATTINO",
  "CARLINO",
  "STAMPA",
  "ADNKRONOS",
] as const;

type NodePhase = "idle" | "scanning" | "done";

function nodePhase(index: number, activeIndex: number): NodePhase {
  if (index < activeIndex) return "done";
  if (index === activeIndex) return "scanning";
  return "idle";
}

function nodeClass(phase: NodePhase): string {
  switch (phase) {
    case "done":
      return "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
    case "scanning":
      return "border border-amber-400 bg-amber-500/20 text-amber-300";
    default:
      return "border border-transparent bg-[#0D1320] text-slate-600";
  }
}

export function RssTelemetryScannerHUD({
  isScanning,
  liveLog,
}: {
  isScanning: boolean;
  liveLog?: string;
}) {
  const [scanStep, setScanStep] = useState(0);

  useEffect(() => {
    if (!isScanning) {
      setScanStep(0);
      return;
    }
    setScanStep(0);
    const id = window.setInterval(() => {
      setScanStep((s) => (s >= NODE_COUNT - 1 ? s : s + 1));
    }, NODE_TICK_MS);
    return () => clearInterval(id);
  }, [isScanning]);

  if (!isScanning) return null;

  const progress = Math.min(
    100,
    Math.round(((scanStep + 1) / NODE_COUNT) * 100),
  );

  return (
    <div className="relative mb-4 overflow-hidden rounded-xl border border-emerald-500/40 bg-[#080C14] p-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(16,185,129,0.4) 2px, rgba(16,185,129,0.4) 3px)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-300">
          SYS.SCANNER // ACQUISIZIONE PARALLELA 31 FLUSSI RSS &amp; PARSING NER
          GEOGRAFICO
        </p>
        <p className="font-mono text-lg tabular-nums text-emerald-400">
          {progress}%
        </p>
      </div>

      <div className="my-3 grid grid-cols-4 gap-1.5 sm:grid-cols-8 lg:grid-cols-11">
        {SCAN_NODES.map((label, i) => (
          <div
            key={label}
            className={`rounded px-1 py-1 text-center font-mono text-[9px] font-semibold tabular-nums ${nodeClass(nodePhase(i, scanStep))}`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="relative h-1.5 overflow-hidden rounded-sm bg-[#0D1320]">
        <div
          className="h-full bg-gradient-to-r from-emerald-600 to-cyan-500 transition-[width] duration-75"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-3 truncate font-mono text-[10px] text-slate-400">
        {liveLog ??
          "NER.EXTRACTOR >> In attesa primo match territoriale…"}
      </p>
    </div>
  );
}

/** Compatibilità import legacy. */
export function TypeflowNewspaperStage(props: {
  isScanning?: boolean;
  active?: boolean;
  liveLog?: string;
}) {
  const scanning = Boolean(props.isScanning ?? props.active);
  return (
    <RssTelemetryScannerHUD isScanning={scanning} liveLog={props.liveLog} />
  );
}

export const MatchCutLoadingOverlay = TypeflowNewspaperStage;
export const MATCH_CUT_SCAN_MS = RSS_SCAN_MIN_MS;
export const MATCH_CUT_SEARCH_MS = RSS_SCAN_MIN_MS;
