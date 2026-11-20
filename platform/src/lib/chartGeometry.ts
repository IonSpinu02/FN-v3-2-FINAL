export type NiceScale = { min: number; max: number; ticks: number[]; decimals: number };

const NICE_STEPS = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];

/**
 * Scala verticale con tacche tonde (al massimo 5 intervalli). `minSpan` è l'escursione minima:
 * con una scala più stretta, pochi centesimi sembrerebbero un salto.
 */
export function niceScale(values: number[], minSpan: number): NiceScale {
  const finite = values.filter((v) => Number.isFinite(v));
  const lo = finite.length ? Math.min(...finite) : 0;
  const hi = finite.length ? Math.max(...finite) : 0;
  const mid = (lo + hi) / 2;
  const half = Math.max(((hi - lo) / 2) * 1.2, minSpan / 2);
  const from = Math.max(0, mid - half);
  const to = mid + half;
  for (const step of NICE_STEPS) {
    const min = Math.floor(from / step + 1e-9) * step;
    const max = Math.ceil(to / step - 1e-9) * step;
    const count = Math.round((max - min) / step);
    if (count <= 5) {
      return {
        min,
        max,
        ticks: Array.from({ length: count + 1 }, (_, i) => min + i * step),
        decimals: step < 0.1 || step === 0.25 ? 2 : 1,
      };
    }
  }
  return { min: from, max: to, ticks: [from, to], decimals: 1 };
}

/** Spline monotona (come d3.curveMonotoneX): passa per ogni punto senza creare picchi che i dati non hanno. */
export function smoothPath(points: { x: number; y: number }[]): string {
  const n = points.length;
  const f = (v: number) => v.toFixed(1);
  if (n < 3) return points.map((p, i) => `${i ? "L" : "M"}${f(p.x)},${f(p.y)}`).join(" ");
  const secant = points
    .slice(1)
    .map((p, i) => (p.y - points[i].y) / (p.x - points[i].x || 1));
  const tangent = points.map((p, i) => {
    if (i === 0 || i === n - 1) return 0;
    const s0 = secant[i - 1];
    const s1 = secant[i];
    const h0 = p.x - points[i - 1].x;
    const h1 = points[i + 1].x - p.x;
    const mid = (s0 * h1 + s1 * h0) / (h0 + h1 || 1);
    return (
      (Math.sign(s0) + Math.sign(s1)) *
        Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(mid)) || 0
    );
  });
  tangent[0] = (3 * secant[0] - tangent[1]) / 2;
  tangent[n - 1] = (3 * secant[n - 2] - tangent[n - 2]) / 2;
  let d = `M${f(points[0].x)},${f(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = (b.x - a.x) / 3;
    d += ` C${f(a.x + dx)},${f(a.y + dx * tangent[i])} ${f(b.x - dx)},${f(b.y - dx * tangent[i + 1])} ${f(b.x)},${f(b.y)}`;
  }
  return d;
}
