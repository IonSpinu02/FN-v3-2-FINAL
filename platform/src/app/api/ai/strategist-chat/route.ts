import { applyRateLimitHeaders, checkRateLimit } from "@/lib/api/rateLimit";
import { requireSession, unauthorizedResponse } from "@/lib/api/requireSession";
import {
  streamStrategistChat,
  type StrategistChatMessage,
  type StrategistStreamEvent,
} from "@/lib/ai/strategistAgent";
import {
  sanitizeForecastV4Input,
  type ForecastBacktestV4,
  type ForecastNetworkDelta,
  type ForecastV4Input,
  type ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  messages?: StrategistChatMessage[];
  scenario?: string;
  v4?: ForecastV4Result;
  v4Input?: ForecastV4Input;
  backtest?: ForecastBacktestV4 | null;
  networkDelta?: ForecastNetworkDelta;
  newsHeadlines?: string[];
  grievances?: Array<{
    id: string;
    title: string;
    category: TerritoryIssueCategory;
    region: string;
  }>;
};

function sse(event: StrategistStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const rl = await checkRateLimit(req, "ai:strategist-chat", 20);
  if (!rl.proceed) {
    if (rl.response.status === 503) return rl.response;
    const headers = new Headers(rl.response.headers);
    headers.set("content-type", "text/event-stream; charset=utf-8");
    headers.set("cache-control", "no-cache, no-transform");
    return new Response(sse({ type: "error", message: "Troppe richieste. Riprova tra un minuto." }), {
      status: 429,
      headers,
    });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(sse({ type: "error", message: "JSON non valido" }), {
      status: 400,
      headers: { "content-type": "text/event-stream; charset=utf-8" },
    });
  }

  if (!body.v4 || !body.v4Input) {
    return new Response(sse({ type: "error", message: "v4 e v4Input obbligatori" }), {
      status: 400,
      headers: { "content-type": "text/event-stream; charset=utf-8" },
    });
  }

  const messages = (body.messages ?? [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20);

  if (!messages.some((m) => m.role === "user")) {
    return new Response(sse({ type: "error", message: "Serve almeno un messaggio utente" }), {
      status: 400,
      headers: { "content-type": "text/event-stream; charset=utf-8" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (ev: StrategistStreamEvent) => {
        controller.enqueue(encoder.encode(sse(ev)));
      };
      try {
        for await (const ev of streamStrategistChat({
          messages,
          scenario: body.scenario,
          input: {
            v4: body.v4!,
            v4Input: sanitizeForecastV4Input(body.v4Input!),
            backtest: body.backtest ?? null,
            networkDelta: body.networkDelta,
            newsHeadlines: body.newsHeadlines ?? [],
            grievances: body.grievances ?? [],
          },
        })) {
          push(ev);
        }
      } catch (err) {
        console.error("[strategist-chat]", err);
        push({
          type: "error",
          message: "Errore temporaneo del Consigliere strategico. Riprova tra poco.",
        });
      } finally {
        controller.close();
      }
    },
  });

  const streamHeaders = applyRateLimitHeaders(
    {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
    rl.result,
  );
  return new Response(stream, { headers: streamHeaders });
}
