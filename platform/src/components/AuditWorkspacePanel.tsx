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
      <div className="flex flex-col gap-4">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "snapshots", label: "Situazioni salvate e confronto" },
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
  );
}
