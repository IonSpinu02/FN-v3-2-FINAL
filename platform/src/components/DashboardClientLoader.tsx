"use client";

import type { FnConfig, ScenarioResult } from "@/lib/engine/types";
import { useEffect, useState } from "react";
import { DashboardClient } from "./DashboardClient";

type Boot = {
  initialScenario: ScenarioResult;
  frozenSnapshot: ScenarioResult;
  fnConfig: FnConfig;
};

export function DashboardClientLoader() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard-data", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Boot;
        if (!cancelled) setBoot(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Caricamento fallito");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="p-8 text-sm text-fn-danger" role="alert">
        Impossibile caricare la dashboard ({error}). Ricarica la pagina.
      </p>
    );
  }

  if (!boot) {
    return (
      <p className="p-8 text-fn-text-muted">Caricamento scenario territoriale…</p>
    );
  }

  return (
    <DashboardClient
      initialScenario={boot.initialScenario}
      frozenSnapshot={boot.frozenSnapshot}
      fnConfig={boot.fnConfig}
    />
  );
}
