import { sanitizePublicStrategistText } from "@/lib/ai/strategistAgent";

/** Regole allineate a auditCredibilityAccept: vietate nelle UI e nei testi generati. */
export const CREDIBILITY_BANNED: readonly RegExp[] = [
  /Conv\.\s*\d/gi,
  /Interesse Google \(30[gG]\)/gi,
  /Cosa cercano su Google/gi,
];

export function scrubCredibilityBanned(text: string): string {
  let out = text;
  for (const rule of CREDIBILITY_BANNED) {
    out = out.replace(rule, "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Sanifica testo strategico pubblico: sigle interne + banlist credibilità. */
export function sanitizeStrategicRoadmapText(text: string): string {
  return scrubCredibilityBanned(sanitizePublicStrategistText(String(text ?? "")));
}

export function containsCredibilityBanned(text: string): boolean {
  return CREDIBILITY_BANNED.some((rule) => {
    rule.lastIndex = 0;
    return rule.test(text);
  });
}
