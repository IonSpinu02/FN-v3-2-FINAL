"use client";

import { CinematicBackground } from "@/components/CinematicBackground";
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
      <div className="relative min-h-screen p-8">
        <CinematicBackground />
        <p className="relative z-10 text-sm text-fn-danger" role="alert">
          Impossibile caricare la dashboard ({error}). Ricarica la pagina.
        </p>
      </div>
    );
  }

  if (!boot) {
    return (
      <div className="fn-loader relative min-h-screen">
        <CinematicBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="fn-loader-ring" aria-hidden />
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-fn-text fn-heading-shine">
            Futuro Nazionale
          </p>
          <p className="max-w-sm text-sm text-fn-text-muted">
            Caricamento scenario territoriale e moduli operativi…
          </p>
        </div>
      </div>
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
