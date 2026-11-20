export type LogLevel = "debug" | "info" | "warn" | "error";

export type StructuredLogFields = {
  level?: LogLevel;
  event: string;
  runId?: string;
  domain?: string;
  durationMs?: number;
  usedFallback?: boolean;
  error?: string | null;
  [key: string]: unknown;
};

export function logStructured(fields: StructuredLogFields): void {
  const line = {
    ts: new Date().toISOString(),
    level: fields.level ?? "info",
    ...fields,
  };
  const level = line.level;
  if (level === "error") {
    console.error(JSON.stringify(line));
    return;
  }
  if (level === "warn") {
    console.warn(JSON.stringify(line));
    return;
  }
  console.log(JSON.stringify(line));
}