/** Tab interni della shell operativa */
export type AppTab =
  | "scenario"
  | "quadro"
  | "osservatorio"
  | "locali"
  | "audit";

const APP_PATH: Record<AppTab, string> = {
  scenario: "/app/scenario",
  quadro: "/app/quadro",
  osservatorio: "/app/osservatorio",
  locali: "/app/news",
  audit: "/app/audit",
};

const SECTION_TO_TAB: Record<string, AppTab> = {
  scenario: "scenario",
  quadro: "quadro",
  osservatorio: "osservatorio",
  news: "locali",
  audit: "audit",
};

export const APP_SECTIONS = Object.keys(SECTION_TO_TAB);

export function appPath(tab: AppTab): string {
  return APP_PATH[tab];
}

export function tabFromPathname(pathname: string): AppTab | null {
  if (!pathname.startsWith("/app/")) return null;
  const segment = pathname.split("/").filter(Boolean)[1] ?? "";
  return SECTION_TO_TAB[segment] ?? null;
}
