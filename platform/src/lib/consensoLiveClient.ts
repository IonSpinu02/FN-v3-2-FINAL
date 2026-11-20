/** Preferenza utente: consenso S sincronizzato da API live (default attivo). */
export const CONSENSO_LIVE_PREF_KEY = "fn-s-live-enabled";

const PREF_EVENT = "fn-s-live-pref";

export function readConsensoLivePref(): boolean {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(CONSENSO_LIVE_PREF_KEY) !== "0";
}

export function writeConsensoLivePref(enabled: boolean): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CONSENSO_LIVE_PREF_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event(PREF_EVENT));
}

/** Subscribe per `useSyncExternalStore` (SSR snapshot = true). */
export function subscribeConsensoLivePref(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONSENSO_LIVE_PREF_KEY || e.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(PREF_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PREF_EVENT, onStoreChange);
  };
}

export function getConsensoLivePrefSnapshot(): boolean {
  return readConsensoLivePref();
}

export function getServerConsensoLivePrefSnapshot(): boolean {
  return true;
}

/** Intervallo refresh con tab visibile (ms). */
export const CONSENSO_LIVE_POLL_VISIBLE_MS = 60_000;

/** Intervallo con tab in background (ms). */
export const CONSENSO_LIVE_POLL_HIDDEN_MS = 300_000;
