import { NextResponse } from "next/server";
import { requireSession, unauthorizedResponse } from "@/lib/api/requireSession";
import {
  appendDecisionSnapshot,
  getDecisionSnapshotById,
  ledgerStorageKind,
  listDecisionSnapshots,
} from "@/lib/db/decisionLedger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const row = await getDecisionSnapshotById(id);
    if (!row) {
      return NextResponse.json({ ok: false, error: "Snapshot non trovato" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      storage: ledgerStorageKind(),
      snapshot: row,
    });
  }

  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "40") || 40));
  const snapshots = await listDecisionSnapshots(limit);
  return NextResponse.json({
    ok: true,
    storage: ledgerStorageKind(),
    snapshots,
  });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON non valido" }, { status: 400 });
  }

  const computationId = String(body.computationId ?? "").trim();
  const engineVersion = String(body.engineVersion ?? "").trim();
  if (!computationId || !engineVersion) {
    return NextResponse.json(
      { ok: false, error: "computationId e engineVersion obbligatori" },
      { status: 400 },
    );
  }

  const row = await appendDecisionSnapshot({
    computationId,
    emittedAt: String(body.emittedAt ?? new Date().toISOString()),
    engineVersion,
    calibrationStateJson: body.calibrationStateJson ?? {},
    inputsManifestJson: body.inputsManifestJson ?? {},
    assumptionsJson: body.assumptionsJson ?? {},
    outputsJson: body.outputsJson ?? {},
    subsequentOutcomeJson: body.subsequentOutcomeJson ?? null,
  });

  return NextResponse.json({
    ok: true,
    storage: ledgerStorageKind(),
    snapshot: row,
  });
}
