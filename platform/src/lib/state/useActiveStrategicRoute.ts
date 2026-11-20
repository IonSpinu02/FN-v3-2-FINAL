"use client";

import { useEffect, useState } from "react";
import {
  ACTIVE_ROUTE_EVENT,
  clearActiveStrategicRoute,
  getActiveStrategicRoute,
  setActiveStrategicRoute,
  type ActiveStrategicRouteState,
} from "@/lib/state/activeStrategicRoute";

export function useActiveStrategicRoute(): {
  route: ActiveStrategicRouteState | null;
  activate: (value: ActiveStrategicRouteState) => void;
  clear: () => void;
} {
  const [route, setRoute] = useState<ActiveStrategicRouteState | null>(null);
  useEffect(() => {
    const sync = () => setRoute(getActiveStrategicRoute());
    sync();
    window.addEventListener(ACTIVE_ROUTE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ACTIVE_ROUTE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { route, activate: setActiveStrategicRoute, clear: clearActiveStrategicRoute };
}
