import { APP_SECTIONS } from "@/lib/appRoutes";
import { DashboardClientLoader } from "@/components/DashboardClientLoader";
import { redirect } from "next/navigation";

export default async function AppSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!APP_SECTIONS.includes(section)) {
    redirect("/app/scenario");
  }
  return <DashboardClientLoader />;
}
