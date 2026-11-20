"use client";

import { useRealtimeSync } from "@/components/realtime/RealtimeSyncProvider";
import {
  EPISTEMIC_BADGES,
  type EpistemicStatus,
  type SupervisionDecision,
  type SupervisionEntityType,
} from "@/lib/engine/epistemicStatus";

export function EpistemicBadge({
  status,
  className = "",
}: {
  status: EpistemicStatus;
  className?: string;
}) {
  const badge = EPISTEMIC_BADGES[status];
  return (
    <span
      className={`epistemic-badge epistemic-${badge.tone} ${className}`.trim()}
      data-epistemic={badge.status}
      title={badge.label}
    >
      {badge.short}
    </span>
  );
}

export function HumanSupervisionControls({
  entityType,
  entityId,
  currentStatus,
  onDecided,
  disabled,
}: {
  entityType: SupervisionEntityType;
  entityId: string;
  currentStatus?: string | null;
  onDecided?: (decision: SupervisionDecision, exclusions: string[]) => void;
  disabled?: boolean;
}) {
  const { requestDomainRefresh } = useRealtimeSync();

  const act = async (newStatus: SupervisionDecision) => {
    const res = await fetch("/api/ledger/supervision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType,
        entityId,
        previousStatus: currentStatus ?? null,
        newStatus,
      }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      ok?: boolean;
      activeExclusions?: string[];
    };
    if (data.ok) {
      onDecided?.(newStatus, data.activeExclusions ?? []);
      void requestDomainRefresh("supervision");
    }
  };

  return (
    <div className="human-supervision" role="group" aria-label="Supervisione umana">
      <button type="button" disabled={disabled} onClick={() => void act("confirmed")}>
        Conferma pertinenza
      </button>
      <button type="button" disabled={disabled} onClick={() => void act("excluded")}>
        Escludi elemento
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void act("flagged_contradiction")}
      >
        Segnala errore
      </button>
    </div>
  );
}
