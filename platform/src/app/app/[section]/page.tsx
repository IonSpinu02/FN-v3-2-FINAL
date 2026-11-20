import { DashboardClient } from "@/components/DashboardClient";
import { APP_SECTIONS } from "@/lib/appRoutes";
import { loadDashboardBoot } from "@/lib/engine/dashboardBoot";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function AppSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!APP_SECTIONS.includes(section)) {
    redirect("/app/scenario");
  }

  const { initialScenario, frozenSnapshot, fnConfig } = loadDashboardBoot();

  return (
    <Suspense fallback={null}>
      <DashboardClient
        variant="app"
        initialScenario={initialScenario}
        frozenSnapshot={frozenSnapshot}
        fnConfig={fnConfig}
      />
    </Suspense>
  );
}
