"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import type { FlussiIpsos } from "@/lib/engine/defaults";
import type { OperationalRoadmap } from "@/lib/engine/operationalRoadmapBuilder";
import type { HorizonDays, StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import type { ScenarioResult } from "@/lib/engine/types";
import { formatDecimalIt } from "@/lib/formatIt";
import {
  isRoadmapChildMessage,
  roadmapEmbedUrl,
  type RoadmapEmbedParams,
  type RoadmapStageId,
  type RoadmapSyncMessage,
} from "@/lib/roadmapEmbed";
import { sanitizeRoadmapGenerationDiagnostic } from "@/lib/strategy/generatedStrategicPlan";

const HORIZONS: HorizonDays[] = [30, 90, 180, 360];
const SEG = "inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-0.5";
const SEG_ITEM = "obj-press h-6 rounded-md px-2 font-mono text-[11px] tabular-nums";
const GHOST = "obj-press inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--surface-2)] px-2.5 text-[12px] text-[var(--ink-primary)] hover:border-[var(--ink-muted)]";

export function RoadmapIframeModal({
  params,
  scenario,
  flussiIpsos,
  roadmap,
  plan,
  floor,
  pdfBusy,
  lockPlan = false,
  onClose,
  onStageChange,
  onTargetChange,
  onHorizonChange,
  onExportPdf,
}: {
  params: RoadmapEmbedParams;
  scenario: ScenarioResult;
  flussiIpsos: FlussiIpsos;
  roadmap?: OperationalRoadmap;
  plan?: StrategicBackcastResult;
  floor: number;
  pdfBusy: boolean;
  /** Se true, non permette di cambiare %/giorni dal modal: il piano resta quello generato. */
  lockPlan?: boolean;
  onClose: () => void;
  onStageChange: (stage: RoadmapStageId) => void;
  onTargetChange: (target: number) => void;
  onHorizonChange: (horizon: HorizonDays) => void;
  onExportPdf: () => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [src] = useState(() => roadmapEmbedUrl(params));
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onClose, onStageChange });
  useEffect(() => {
    handlers.current = { onClose, onStageChange };
  }, [onClose, onStageChange]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handlers.current.onClose();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (!isRoadmapChildMessage(event.data)) return;
      if (event.data.type === "fn-roadmap-ready") setReady(true);
      else if (event.data.type === "fn-roadmap-close") handlers.current.onClose();
      else handlers.current.onStageChange(event.data.stage);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const { targetPct, horizonDays, stage, theme } = params;

  useEffect(() => {
    if (!ready) return;
    const message: RoadmapSyncMessage = {
      type: "fn-roadmap-sync",
      params: { targetPct, horizonDays, stage, theme },
      scenario,
      flussiIpsos,
      ...(roadmap ? { roadmap } : {}),
      ...(plan ? { plan } : {}),
    };
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
    // Lo scenario completo viaggia solo quando cambia: i parametri hanno un effetto dedicato.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, scenario, flussiIpsos, roadmap, plan]);

  useEffect(() => {
    if (!ready) return;
    const message: RoadmapSyncMessage = {
      type: "fn-roadmap-sync",
      params: { targetPct, horizonDays, stage, theme },
      ...(roadmap ? { roadmap } : {}),
      ...(plan ? { plan } : {}),
    };
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, [ready, targetPct, horizonDays, stage, theme, roadmap, plan]);

  const step = (delta: number) => onTargetChange(Math.round(Math.min(20, Math.max(floor, targetPct + delta)) * 10) / 10);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/75 p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Roadmap Operativa Strategica"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="obj-rise flex h-11 shrink-0 items-center justify-between gap-3 rounded-t-xl border border-[var(--border-default)] bg-[var(--surface-1)] px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <p className="truncate font-mono text-[11px] tracking-[0.14em] text-[var(--ink-primary)]">CRONOPROGRAMMA OPERATIVO E PRESIDI TERRITORIALI</p>
          <span className="hidden shrink-0 rounded-full border border-[var(--border-default)] px-2 py-0.5 font-mono text-[10px] tabular-nums text-[var(--ink-secondary)] md:inline">
            TRAGUARDO {formatDecimalIt(targetPct, 1)}% · {horizonDays}g
          </span>
          <span className="hidden shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-2 py-0.5 font-mono text-[10px] text-[var(--signal-positive)] sm:inline">IPOTESI</span>
          {roadmap ? (
            <span
              className="hidden shrink-0 rounded-full border border-cyan-400/30 bg-cyan-500/[0.06] px-2 py-0.5 font-mono text-[10px] text-cyan-300 light:text-cyan-800 md:inline"
              title={
                sanitizeRoadmapGenerationDiagnostic(roadmap.generationMeta?.diagnostic) ??
                (roadmap.generatedBy === "AI_MODEL"
                  ? "Roadmap redatta con assistente AI."
                  : "Variante automatica di riserva.")
              }
            >
              {roadmap.generatedBy === "AI_MODEL" ? "Strategia AI" : "Variante automatica"}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!lockPlan ? (
            <>
              <div className={`${SEG} hidden lg:inline-flex`} role="group" aria-label="Traguardo">
                <button type="button" onClick={() => step(-0.5)} className={`${SEG_ITEM} text-[var(--ink-muted)] hover:text-[var(--ink-primary)]`} aria-label="Riduci traguardo di mezzo punto">-</button>
                <span className="min-w-[3.4rem] text-center font-mono text-[12px] font-semibold tabular-nums">{formatDecimalIt(targetPct, 1)}%</span>
                <button type="button" onClick={() => step(0.5)} className={`${SEG_ITEM} text-[var(--ink-muted)] hover:text-[var(--ink-primary)]`} aria-label="Aumenta traguardo di mezzo punto">+</button>
              </div>
              <div className={`${SEG} hidden lg:inline-flex`} role="group" aria-label="Orizzonte">
                {HORIZONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onHorizonChange(item)}
                    className={`${SEG_ITEM} ${horizonDays === item ? "bg-[var(--surface-1)] text-[var(--ink-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.22)]" : "text-[var(--ink-muted)] hover:text-[var(--ink-secondary)]"}`}
                  >
                    {item}g
                  </button>
                ))}
              </div>
            </>
          ) : null}
          <button type="button" disabled={pdfBusy} onClick={onExportPdf} className={`${GHOST} disabled:opacity-60`}>
            <Download className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{pdfBusy ? "PDF..." : "Esporta Piano PDF"}</span>
          </button>
          <button ref={closeRef} type="button" onClick={onClose} className={GHOST}>
            <X className="h-3.5 w-3.5" aria-hidden />
            Chiudi (ESC)
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-b-xl border-x border-b border-[var(--border-default)] bg-[var(--surface-canvas)]">
        <iframe ref={frameRef} src={src} title="Roadmap Operativa Strategica" className="block h-full w-full border-0" />
        <div
          className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--surface-canvas)] transition-opacity duration-300 ease-out ${ready ? "opacity-0" : "opacity-100"}`}
          aria-hidden={ready}
        >
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-emerald-400" />
          <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--ink-muted)]">PREPARAZIONE DEL CRONOPROGRAMMA</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
