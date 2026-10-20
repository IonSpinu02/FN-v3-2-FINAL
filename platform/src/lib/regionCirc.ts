import { CIRC, type Region } from "@/lib/engine/constants";

const REGION_TO_CIRC: Record<Region, keyof typeof CIRC> = {} as Record<
  Region,
  keyof typeof CIRC
>;

for (const [code, regions] of Object.entries(CIRC)) {
  for (const r of regions) {
    REGION_TO_CIRC[r] = code as keyof typeof CIRC;
  }
}

export function regionCircoscrizione(region: string): keyof typeof CIRC | null {
  return REGION_TO_CIRC[region as Region] ?? null;
}
