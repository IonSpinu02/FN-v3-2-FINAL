"use client";

import { Segmented } from "@/components/ui/FnUi";
import type { ScenarioResult } from "@/lib/engine/types";
import dynamic from "next/dynamic";
import { useState } from "react";
import { SnapshotsAuditPanel } from "./SnapshotsAuditPanel";

const PostVotePanel = dynamic(
  () => import("./PostVotePanel").then((m) => m.PostVotePanel),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-fn-text-muted">Caricamento post-voto…</p>
    ),
  },
);

type AuditView = "snapshots" | "postvote" | "audit";

export function AuditWorkspacePanel({
  liveScenario,
  onLoadScenario,
  baselineScenario,
  onBaselineChange,
  snapshotCatalog,
  defaultBaselineId,
}: {
  liveScenario: ScenarioResult;
  onLoadScenario: (
    s: ScenarioResult,
    params?: import("./SnapshotsAuditPanel").FreezeSnapshotInput["params"],
  ) => void;
  baselineScenario: ScenarioResult;
  onBaselineChange: (s: ScenarioResult, label: string) => void;
  snapshotCatalog: { id: string; label: string; scenario: ScenarioResult }[];
  defaultBaselineId: string;
}) {
  const [view, setView] = useState<AuditView>("snapshots");

  return (
    <div className="relative min-h-[calc(100vh-7rem)] pb-32">
      <div
        aria-hidden
        className="pointer-events-none select-none blur-lg brightness-[0.5] saturate-[0.45]"
      >
        <div className="flex flex-col gap-4">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "snapshots", label: "Snapshot & Diff SHA-256" },
              { value: "postvote", label: "Validazione Post-Voto" },
              { value: "audit", label: "Registro Audit Cloud/Locale" },
            ]}
          />
          {view === "snapshots" && (
            <SnapshotsAuditPanel
              focus="snapshots"
              liveScenario={liveScenario}
              onLoadScenario={onLoadScenario}
              baselineScenario={baselineScenario}
              onBaselineChange={onBaselineChange}
            />
          )}
          {view === "postvote" && (
            <PostVotePanel
              baselineOptions={snapshotCatalog}
              defaultBaselineId={defaultBaselineId}
            />
          )}
          {view === "audit" && (
            <SnapshotsAuditPanel
              focus="audit"
              liveScenario={liveScenario}
              onLoadScenario={onLoadScenario}
              baselineScenario={baselineScenario}
              onBaselineChange={onBaselineChange}
            />
          )}
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 top-14 bottom-20 z-40 flex flex-col items-center justify-center bg-[#02040A]/55 px-6 text-center backdrop-blur-md"
      >
        <p className="font-mono text-6xl font-bold uppercase tracking-[0.45em] text-amber-300 md:text-8xl">
          WIP
        </p>
        <p className="mt-5 text-base font-semibold tracking-wide text-white/95">
          Audit &amp; Post-Voto
        </p>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          Sezione in lavorazione — contenuto visibile in anteprima sotto overlay.
        </p>
      </div>
    </div>
  );
}
