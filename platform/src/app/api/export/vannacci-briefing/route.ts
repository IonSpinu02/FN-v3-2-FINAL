import { NextResponse } from "next/server";
import type React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { checkRateLimit, withRateLimitOnResponse } from "@/lib/api/rateLimit";
import { requireSession, unauthorizedResponse } from "@/lib/api/requireSession";
import {
  buildConsensusCausalReport,
  type MediaSalienceInput,
  type TerritorialActivityInput,
} from "@/lib/analytics/causalAttribution";
import {
  generateStrategicForecast180,
  type ScheduledPoliticalEvent,
} from "@/lib/analytics/strategicForecast180";
import {
  ALL_REGIONAL_DOSSIERS,
  NATIONAL_DISCOMFORT_REMEDIES,
  getRegionalDossierByName,
} from "@/lib/analytics/socialDiscomfortRemedies";
import {
  createVannacciPdfDocument,
  type VannacciPdfPayload,
} from "@/lib/pdf/VannacciCommandBriefingPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  mode?: "nazionale" | "regionale";
  selectedRegion?: string;
  currentConsensus?: number;
  previous7dConsensus?: number;
  previous30dConsensus?: number;
  media?: MediaSalienceInput;
  territory?: TerritorialActivityInput;
  customEvents?: ScheduledPoliticalEvent[];
};

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const rl = await checkRateLimit(req, "export:vannacci-briefing", 6, 60_000, {
    ok: false,
    error: "Troppe esportazioni. Riprova tra un minuto.",
  });
  if (!rl.proceed) return rl.response;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  try {
    const mode: "nazionale" | "regionale" =
      body.mode === "regionale" && body.selectedRegion
        ? "regionale"
        : "nazionale";
    const currentConsensus =
      typeof body.currentConsensus === "number" && body.currentConsensus > 0
        ? body.currentConsensus
        : 7.4;
    const previous7dConsensus =
      typeof body.previous7dConsensus === "number"
        ? body.previous7dConsensus
        : Number((currentConsensus - 0.1).toFixed(2));
    const previous30dConsensus =
      typeof body.previous30dConsensus === "number"
        ? body.previous30dConsensus
        : Number((currentConsensus - 0.25).toFixed(2));

    const customEvents: ScheduledPoliticalEvent[] | undefined = Array.isArray(
      body.customEvents,
    )
      ? body.customEvents
      : undefined;

    const causalReport = buildConsensusCausalReport({
      currentConsensus,
      previous7dConsensus,
      previous30dConsensus,
      media: body.media,
      territory: body.territory,
    });

    const forecast180 = generateStrategicForecast180({
      currentConsensus,
      monthlyMomentum: causalReport.realNetDelta30d,
      customEvents,
    });

    const focusRegionDossier = body.selectedRegion
      ? getRegionalDossierByName(String(body.selectedRegion))
      : undefined;

    const now = new Date();
    const generatedDateLabel = now.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const computationId = `FN-CMD-${now
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payload: VannacciPdfPayload = {
      mode,
      selectedRegion: body.selectedRegion,
      generatedDateLabel,
      computationId,
      causalReport,
      forecast180,
      nationalDiscomforts: NATIONAL_DISCOMFORT_REMEDIES,
      topRegions: ALL_REGIONAL_DOSSIERS,
      focusRegionDossier,
    };

    const element = createVannacciPdfDocument(
      payload,
    ) as unknown as React.ReactElement<DocumentProps>;
    const pdfBuffer = await renderToBuffer(element);

    const fileSuffix =
      mode === "regionale" && focusRegionDossier
        ? `Missione_${focusRegionDossier.regionName.replace(/\s+/g, "_")}`
        : "Briefing_Nazionale";

    return withRateLimitOnResponse(
      new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="Dossier_Comando_Vannacci_${fileSuffix}.pdf"`,
          "Cache-Control": "no-store",
        },
      }),
      rl.result,
    );
  } catch (error) {
    console.error("[vannacci-briefing PDF error]:", error);
    return NextResponse.json(
      {
        error:
          "Errore durante la generazione del Dossier PDF Comando Vannacci",
      },
      { status: 500 },
    );
  }
}
