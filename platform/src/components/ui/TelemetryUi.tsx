"use client";

import type { RegionPollResult } from "@/lib/engine/regionalPollShared";

export function TricolorMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-[14px] gap-px ${className}`} aria-hidden>
      <span className="w-[6px] rounded-sm bg-[#10B981]" />
      <span className="w-[6px] rounded-sm bg-[#F8FAFC]" />
      <span className="w-[6px] rounded-sm bg-[#F43F5E]" />
    </span>
  );
}

export function ClassStatusMark({
  classificazione,
}: {
  classificazione: RegionPollResult["classificazione"];
}) {
  const color =
    classificazione === "sicura"
      ? "bg-emerald-400"
      : classificazione === "contesa"
        ? "bg-amber-400"
        : "bg-rose-500";
  const label =
    classificazione === "sicura"
      ? "SICURA"
      : classificazione === "contesa"
        ? "CONTESA"
        : "CRITICA";
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-wide text-slate-400">
      <span className={`inline-block h-1.5 w-1.5 rotate-45 ${color}`} aria-hidden />
      {label}
    </span>
  );
}

export function IconLock({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 10V8a5 5 0 0 1 10 0v2"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="square"
      />
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="1"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path d="M12 14v2" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

export function IconTarget({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

export function regionPodiumLabel(region: string): string {
  if (region === "Friuli-Venezia Giulia") return "FRIULI-V.G.";
  return region.toUpperCase();
}
