import { LandingPageClient } from "@/components/LandingPageClient";
import { loadDashboardBoot } from "@/lib/engine/dashboardBoot";
import { Suspense } from "react";

export default function Home() {
  const boot = loadDashboardBoot();
  return (
    <Suspense fallback={null}>
      <LandingPageClient
        initialScenario={boot.initialScenario}
        frozenSnapshot={boot.frozenSnapshot}
        fnConfig={boot.fnConfig}
      />
    </Suspense>
  );
}
