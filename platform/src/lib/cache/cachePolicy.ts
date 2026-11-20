/** Politica cache: in produzione niente RAM condivisa né disco locale (serverless). */
export function cacheUsesProcessMemory(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function cacheUsesLocalDisk(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function ledgerFileFallbackAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return true;
}