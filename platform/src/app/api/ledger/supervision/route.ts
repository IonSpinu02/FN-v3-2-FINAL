import { NextResponse } from "next/server";
import { requireSession, unauthorizedResponse } from "@/lib/api/requireSession";
import {
  appendSupervisionDecision,
  listActiveExclusions,
  listSupervisionDecisions,
  ledgerStorageKind,
} from "@/lib/db/decisionLedger";
import type {
  SupervisionDecision,
  SupervisionEntityType,
} from "@/lib/engine/epistemicStatus";

export const dynamic = "force-dynamic";

const ENTITY_TYPES: SupervisionEntityType[] = [
  "news_item",
  "party_switch",
  "event",
  "claim",
];
const DECISIONS: SupervisionDecision[] = [
  "confirmed",
  "excluded",
  "flagged_contradiction",
];

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "100") || 100));
  const [decisions, exclusions] = await Promise.all([
    listSupervisionDecisions(limit),
    listActiveExclusions(),
  ]);

  return NextResponse.json({
    ok: true,
    storage: ledgerStorageKind(),
    decisions,
    activeExclusions: exclusions,
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

  const entityType = String(body.entityType ?? "") as SupervisionEntityType;
  const entityId = String(body.entityId ?? "").trim();
  const newStatus = String(body.newStatus ?? "") as SupervisionDecision;

  if (!ENTITY_TYPES.includes(entityType) || !entityId || !DECISIONS.includes(newStatus)) {
    return NextResponse.json(
      { ok: false, error: "entityType, entityId e newStatus non validi" },
      { status: 400 },
    );
  }

  const row = await appendSupervisionDecision({
    entityType,
    entityId,
    previousStatus: body.previousStatus ? String(body.previousStatus) : null,
    newStatus,
    note: body.note ? String(body.note) : null,
  });

  const activeExclusions = await listActiveExclusions();

  const { touchPublishedDomain } = await import(
    "@/lib/db/publishedStateRepository"
  );
  await touchPublishedDomain("supervision", `${entityType}:${entityId}`);

  return NextResponse.json({
    ok: true,
    storage: ledgerStorageKind(),
    decision: row,
    activeExclusions,
  });
}
