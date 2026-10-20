import { generateText } from "ai";

export function aiGatewayConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
}

export function defaultGatewayModel(): string {
  return (
    process.env.AI_GATEWAY_MODEL?.trim() ||
    "openai/gpt-6-astra"
  );
}

/**
 * Testo via Vercel AI Gateway (AI SDK 7 + AI_GATEWAY_API_KEY).
 * Solo server-side. Non collegare al motore scenario (Modulo A).
 */
export async function generateViaGateway(
  prompt: string,
  model?: string,
): Promise<string> {
  if (!aiGatewayConfigured()) {
    throw new Error("AI_GATEWAY_API_KEY non configurata");
  }

  const { text } = await generateText({
    model: model ?? defaultGatewayModel(),
    prompt,
  });

  return text;
}
