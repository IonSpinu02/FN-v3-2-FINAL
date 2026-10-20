import * as React from "react";
import type { Region } from "@/lib/engine/constants";

export const CHART_BG = "#080C14";
export const CHART_BORDER = "#1B2436";
export const CHART_GRID = "#111827";

export function fmtPctIt(n: number, digits = 2): string {
  return n.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtNumIt(n: number): string {
  const v = Math.round(n);
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v).toString();
  return sign + abs.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Decimali con virgola italiana (es. 0,8984). */
export function fmtDecimalIt(n: number, digits = 4): string {
  return n.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Moltiplicatore territoriale (es. 1,28x). */
export function fmtMultiplierIt(n: number, digits = 2): string {
  return `${fmtDecimalIt(n, digits)}x`;
}

export const REGION_ABBR: Record<Region, string> = {
  Piemonte: "PIE",
  "Valle d'Aosta": "VDA",
  Liguria: "LIG",
  Lombardia: "LOM",
  "Trentino-Alto Adige": "TAA",
  Veneto: "VEN",
  "Friuli-Venezia Giulia": "FVG",
  "Emilia-Romagna": "EMR",
  Toscana: "TOS",
  Umbria: "UMB",
  Marche: "MAR",
  Lazio: "LAZ",
  Abruzzo: "ABR",
  Molise: "MOL",
  Campania: "CAM",
  Puglia: "PUG",
  Basilicata: "BAS",
  Calabria: "CAL",
  Sicilia: "SIC",
  Sardegna: "SAR",
};

export function pearsonR(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i]! - mx;
    const y = ys[i]! - my;
    num += x * y;
    dx += x * x;
    dy += y * y;
  }
  const den = Math.sqrt(dx * dy);
  return den > 1e-12 ? num / den : 0;
}

export function olsLine(
  xs: number[],
  ys: number[],
): { slope: number; intercept: number } {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const slope = den > 1e-12 ? num / den : 0;
  return { slope, intercept: my - slope * mx };
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function useChartCrosshair(svgRef: React.RefObject<SVGSVGElement | null>) {
  const vLineRef = React.useRef<SVGLineElement>(null);
  const hLineRef = React.useRef<SVGLineElement>(null);
  const labelRef = React.useRef<SVGTextElement>(null);

  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onMove = (e: MouseEvent) => {
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const loc = pt.matrixTransform(ctm.inverse());
      const vb = svg.viewBox.baseVal;
      const x = clamp(loc.x, vb.x, vb.x + vb.width);
      const y = clamp(loc.y, vb.y, vb.y + vb.height);
      vLineRef.current?.setAttribute("x1", String(x));
      vLineRef.current?.setAttribute("x2", String(x));
      vLineRef.current?.setAttribute("y1", String(vb.y));
      vLineRef.current?.setAttribute("y2", String(vb.y + vb.height));
      hLineRef.current?.setAttribute("x1", String(vb.x));
      hLineRef.current?.setAttribute("x2", String(vb.x + vb.width));
      hLineRef.current?.setAttribute("y1", String(y));
      hLineRef.current?.setAttribute("y2", String(y));
      labelRef.current?.setAttribute("x", String(x + 4));
      labelRef.current?.setAttribute("y", String(y - 4));
      if (labelRef.current) {
        labelRef.current.textContent = `CRS ${fmtPctIt(x, 1)} / ${fmtPctIt(y, 1)}`;
      }
    };
    const onLeave = () => {
      vLineRef.current?.setAttribute("opacity", "0");
      hLineRef.current?.setAttribute("opacity", "0");
      labelRef.current?.setAttribute("opacity", "0");
    };
    const onEnter = () => {
      vLineRef.current?.setAttribute("opacity", "0.55");
      hLineRef.current?.setAttribute("opacity", "0.55");
      labelRef.current?.setAttribute("opacity", "1");
    };
    svg.addEventListener("mousemove", onMove);
    svg.addEventListener("mouseleave", onLeave);
    svg.addEventListener("mouseenter", onEnter);
    return () => {
      svg.removeEventListener("mousemove", onMove);
      svg.removeEventListener("mouseleave", onLeave);
      svg.removeEventListener("mouseenter", onEnter);
    };
  }, [svgRef]);

  return { vLineRef, hLineRef, labelRef };
}
