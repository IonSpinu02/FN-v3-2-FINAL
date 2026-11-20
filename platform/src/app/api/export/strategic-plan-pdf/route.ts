import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { requireSession, unauthorizedResponse } from "@/lib/api/requireSession";
import { loadDashboardBoot } from "@/lib/engine/dashboardBoot";
import { buildBackcastRegions } from "@/lib/engine/buildBackcastRegions";
import { computeForecastV4 } from "@/lib/engine/forecastEngineV4";
import { computeStrategicBackcast, type HorizonDays } from "@/lib/engine/strategicBackcastEngine";
import type { OperationalRoadmap } from "@/lib/engine/operationalRoadmapBuilder";
import { StrategicPlanPdfDocument } from "@/lib/export/StrategicPlanPdfDocument";
import { ensureDossierPdfFonts } from "@/lib/export/pdfFonts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HORIZONS: readonly HorizonDays[] = [30, 90, 180, 360];

function parseStrategicPlanRequest(raw: unknown): {
  targetPct: number;
  horizonDays: HorizonDays;
  roadmap?: OperationalRoadmap;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { targetPct?: unknown; horizonDays?: unknown; roadmap?: unknown };
  const targetPct = typeof value.targetPct === "number" ? value.targetPct : Number.NaN;
  if (!Number.isFinite(targetPct) || targetPct < 0 || targetPct > 20) return null;
  if (!HORIZONS.includes(value.horizonDays as HorizonDays)) return null;
  const roadmap =
    value.roadmap && typeof value.roadmap === "object" && Array.isArray((value.roadmap as OperationalRoadmap).stages)
      ? (value.roadmap as OperationalRoadmap)
      : undefined;
  return { targetPct, horizonDays: value.horizonDays as HorizonDays, ...(roadmap ? { roadmap } : {}) };
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON non valido" }, { status: 400 });
  }
  const parsed = parseStrategicPlanRequest(body);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "Parametri del piano non validi" }, { status: 400 });
  }

  try {
    const boot = loadDashboardBoot();
    const built = buildBackcastRegions(boot.initialScenario);
    const forecast = computeForecastV4({
      startPct: boot.initialScenario.parametri.S * 100,
      tesserati: built.currentMembers,
      comitati: built.currentCommittees,
    });
    const plan = computeStrategicBackcast({
      forecast,
      targetPct: parsed.targetPct,
      horizonDays: parsed.horizonDays,
      regions: built.regions,
      currentMembers: built.currentMembers,
      currentCommittees: built.currentCommittees,
    });
    ensureDossierPdfFonts();
    const element = React.createElement(StrategicPlanPdfDocument, {
      plan,
      roadmap: parsed.roadmap,
    }) as unknown as React.ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Piano_Obiettivo_${parsed.targetPct.toFixed(1)}_${parsed.horizonDays}g.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[strategic-plan-pdf]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Generazione PDF non riuscita" },
      { status: 500 },
    );
  }
}
