import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";
import { loadJson } from "@/lib/engine/loadData";
import type {
  LocaliEventsFile,
  LocaliRegistryFile,
} from "@/lib/engine/localiTypes";

export const instant = false;

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const registry = loadJson<LocaliRegistryFile>("locali_registry.json");
  const events = loadJson<LocaliEventsFile>("locali_events.json");
  return Response.json({ registry, events });
}
