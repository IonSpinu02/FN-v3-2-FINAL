/** Tab interni della shell operativa */
export type AppTab = "scenario" | "osservatorio" | "locali" | "obiettivo";

const APP_PATH: Record<AppTab, string> = {
  scenario: "/app/scenario",
  osservatorio: "/app/osservatorio",
  locali: "/app/news",
  obiettivo: "/app/obiettivo",
};

const SECTION_TO_TAB: Record<string, AppTab> = {
  scenario: "scenario",
  osservatorio: "osservatorio",
  news: "locali",
  obiettivo: "obiettivo",
};

export const APP_SECTIONS = Object.keys(SECTION_TO_TAB);

export function appPath(tab: AppTab): string {
  return APP_PATH[tab];
}

export function tabFromPathname(pathname: string): AppTab | null {
  if (!pathname.startsWith("/app/")) return null;
  const segment = pathname.split("/").filter(Boolean)[1] ?? "";
  if (segment === "audit") return null;
  return SECTION_TO_TAB[segment] ?? null;
}
