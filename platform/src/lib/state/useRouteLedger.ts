"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConsensoObservation, NetworkObservation, RouteLedger } from "@/lib/engine/routeMonitoringEngine";
import {
  ROUTE_LEDGER_EVENT,
  addConsensoObservation,
  addNetworkObservation,
  emptyLedger,
  readLedger,
  removeObservation,
} from "@/lib/state/routeLedger";

export function useRouteLedger(routeId: string | null): {
  ledger: RouteLedger;
  addConsenso: (entry: Omit<ConsensoObservation, "id">) => void;
  addRete: (entry: Omit<NetworkObservation, "id">) => void;
  remove: (id: string) => void;
} {
  const [ledger, setLedger] = useState<RouteLedger>(emptyLedger);
  useEffect(() => {
    const sync = () => setLedger(routeId ? readLedger(routeId) : emptyLedger());
    sync();
    window.addEventListener(ROUTE_LEDGER_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ROUTE_LEDGER_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [routeId]);
  const addConsenso = useCallback(
    (entry: Omit<ConsensoObservation, "id">) => {
      if (routeId) addConsensoObservation(routeId, entry);
    },
    [routeId],
  );
  const addRete = useCallback(
    (entry: Omit<NetworkObservation, "id">) => {
      if (routeId) addNetworkObservation(routeId, entry);
    },
    [routeId],
  );
  const remove = useCallback(
    (id: string) => {
      if (routeId) removeObservation(routeId, id);
    },
    [routeId],
  );
  return { ledger, addConsenso, addRete, remove };
}
