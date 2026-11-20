import { NextResponse } from "next/server";
import { requireSession, unauthorizedResponse } from "@/lib/api/requireSession";
import {
  ledgerStorageKind,
  listSourceIngestion,
} from "@/lib/db/decisionLedger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const sourceKey = searchParams.get("sourceKey") ?? undefined;
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "40") || 40));
  const rows = await listSourceIngestion(sourceKey, limit);

  return NextResponse.json({
    ok: true,
    storage: ledgerStorageKind(),
    cronConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    rows,
  });
}
