import type { LocalRegistryEntry } from "./localiTypes";

const REGISTRY_KEY = "fn_locali_registry_v1";

export function loadRegistryFromBrowser(): LocalRegistryEntry[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { entries?: LocalRegistryEntry[] };
    if (!Array.isArray(parsed.entries)) return null;
    return parsed.entries;
  } catch {
    return null;
  }
}

export function saveRegistryToBrowser(entries: LocalRegistryEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REGISTRY_KEY, JSON.stringify({ version: 1, entries }));
}

export function clearRegistryBrowser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REGISTRY_KEY);
}
