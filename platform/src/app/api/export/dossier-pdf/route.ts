import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { checkRateLimit, withRateLimitOnResponse } from "@/lib/api/rateLimit";
import { requireSession, unauthorizedResponse } from "@/lib/api/requireSession";
import {
  buildStrategicDossierPayload,
  formatDossierFilename,
} from "@/lib/export/buildDossierPayload";
import { resolveDossierExportInput } from "@/lib/export/resolveDossierExportInput";
import { resolveDossierMovementWhy } from "@/lib/export/resolveDossierMovementWhy";
import { StrategicDossierPdfDocument } from "@/lib/export/StrategicDossierPdfDocument";
import { ensureDossierPdfFonts } from "@/lib/export/pdfFonts";
import type { ForecastBriefing } from "@/lib/ai/strategistAgent";
import { parseConsensusTargetRequest } from "@/lib/engine/consensusTargetPlan";
import { parseActiveStrategicRoute } from "@/lib/state/activeStrategicRoute";
import { formatDecimalIt } from "@/lib/formatIt";
import type {
  ForecastBacktestV4,
  ForecastHorizonKey,
  ForecastNetworkDelta,
  ForecastScenarioId,
  ForecastV4Input,
  ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  /** Legacy: accettati solo come hint; il dataset completo è ricostruito server-side. */
  v4?: ForecastV4Result;
  v4Input?: ForecastV4Input;
  networkDelta?: ForecastNetworkDelta;
  newsHeadlines?: string[];
  scenarioMode?: ForecastScenarioId;
  horizonKey?: ForecastHorizonKey;
  excludedEntityIds?: string[];
  briefing?: ForecastBriefing | null;
  backtest?: ForecastBacktestV4 | null;
  consensusTarget?: unknown;
  activeStrategicRoute?: unknown;
};

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const rl = await checkRateLimit(req, "export:dossier-pdf", 6, 60_000, {
    ok: false,
    error: "Troppe esportazioni. Riprova tra un minuto.",
  });
  if (!rl.proceed) return rl.response;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON non valido" }, { status: 400 });
  }

  try {
    // Dataset completo SEMPRE lato server (polls + supermedia + notizie).
    // Dal client si accettano solo scelte esplicite e contesto scenario.
    const resolved = await resolveDossierExportInput({
      startPct: body.v4Input?.startPct ?? body.v4?.startPct,
      regions: body.v4Input?.regions,
      networkDelta: body.networkDelta ?? body.v4Input?.networkDelta,
      horizonKey: body.horizonKey,
      scenarioMode: body.scenarioMode,
      excludedEntityIds: body.excludedEntityIds,
      clientPolls: body.v4Input?.polls,
      clientNewsHeadlines: body.newsHeadlines,
      clientHistory: body.v4Input?.history,
      flussi: body.v4Input?.flussi,
      comitati: body.v4Input?.comitati,
      tesserati: body.v4Input?.tesserati,
      ingressi: body.v4Input?.ingressi,
      profiles: body.v4Input?.profiles,
      asOf: body.v4Input?.asOf ?? body.v4?.asOf,
    });

    const movementWhy = await resolveDossierMovementWhy();
    const activeRoute = parseActiveStrategicRoute(body.activeStrategicRoute);
    const payload = buildStrategicDossierPayload({
      ...resolved,
      briefing: body.briefing ?? null,
      backtest: body.backtest ?? null,
      movementWhy,
      consensusTarget: parseConsensusTargetRequest(body.consensusTarget),
      activeRouteNote: activeRoute
        ? `Rotta operativa (ipotesi) ${formatDecimalIt(activeRoute.targetPct, 1)}% a ${activeRoute.horizonDays} giorni. Non modifica la traiettoria stimata.`
        : null,
    });
    ensureDossierPdfFonts();
    const element = React.createElement(StrategicDossierPdfDocument, {
      data: payload,
    }) as unknown as React.ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);
    const filename = formatDossierFilename(payload.meta.generatedAtISO);

    return withRateLimitOnResponse(
      new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Computation-Id": payload.meta.computationId,
          "Cache-Control": "no-store",
        },
      }),
      rl.result,
    );
  } catch (err) {
    console.error("[dossier-pdf]", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Generazione PDF non riuscita. Riprova tra poco.",
      },
      { status: 500 },
    );
  }
}
