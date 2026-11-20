import type { Metadata } from "next";
import { RoadmapBriefing } from "@/components/obiettivo/RoadmapBriefing";
import { loadDashboardBoot } from "@/lib/engine/dashboardBoot";
import { parseRoadmapEmbedParams } from "@/lib/roadmapEmbed";

export const metadata: Metadata = {
  title: "Roadmap Operativa Strategica — Futuro Nazionale",
  robots: { index: false, follow: false },
};

export default async function RoadmapEmbedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseRoadmapEmbedParams(await searchParams);
  const { initialScenario } = loadDashboardBoot();
  return <RoadmapBriefing initialScenario={initialScenario} initialParams={params} />;
}
