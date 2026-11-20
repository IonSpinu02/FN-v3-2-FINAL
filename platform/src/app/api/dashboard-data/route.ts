import { loadDashboardBoot } from "@/lib/engine/dashboardBoot";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(loadDashboardBoot());
}
