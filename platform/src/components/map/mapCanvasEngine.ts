import type { Region } from "@/lib/engine/constants";

export type Shockwave = {
  x: number;
  y: number;
  born: number;
  region: Region;
};

export type Particle = {
  t: number;
  speed: number;
  hue: "cyan" | "emerald";
  pathIndex: number;
};

const PATH_REGIONS: Region[] = [
  "Piemonte",
  "Lombardia",
  "Veneto",
  "Emilia-Romagna",
  "Toscana",
  "Lazio",
  "Campania",
  "Puglia",
  "Sicilia",
];

export function createParticles(count = 80): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    t: Math.random(),
    speed: 0.00035 + Math.random() * 0.00045,
    hue: i % 3 === 0 ? "cyan" : "emerald",
    pathIndex: i % PATH_REGIONS.length,
  }));
}

export { PATH_REGIONS };

function quadPoint(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
}

export function drawMapCanvasFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  cx: number,
  cy: number,
  particles: Particle[],
  pathPoints: [number, number][],
  shockwaves: Shockwave[],
  surgeMultiplier: number,
  includeParticles = true,
) {
  ctx.clearRect(0, 0, w, h);

  const ringBase = Math.min(w, h) * 0.38;
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 3; i++) {
    const r = ringBase * (0.55 + i * 0.22);
    const dir = i % 2 === 0 ? 1 : -1;
    const rot = time * 0.002 * dir + i * 0.4;
    ctx.save();
    ctx.rotate(rot);
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.08 + i * 0.04})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(Math.cos(rad) * (r - 8), Math.sin(rad) * (r - 8));
      ctx.lineTo(Math.cos(rad) * r, Math.sin(rad) * r);
      ctx.stroke();
    }
    ctx.restore();
  }
  const sweep = (time * 0.0015) % (Math.PI * 2);
  ctx.strokeStyle = "rgba(16, 185, 129, 0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(sweep) * ringBase * 1.05, Math.sin(sweep) * ringBase * 1.05);
  ctx.stroke();
  ctx.restore();

  if (includeParticles && pathPoints.length >= 3) {
    for (const p of particles) {
      p.t += p.speed * surgeMultiplier;
      if (p.t > 1) p.t -= 1;
      const seg = Math.floor(p.t * (pathPoints.length - 1));
      const localT = (p.t * (pathPoints.length - 1)) % 1;
      const i0 = Math.min(seg, pathPoints.length - 2);
      const i1 = i0 + 1;
      const i2 = Math.min(i0 + 2, pathPoints.length - 1);
      const [x, y] = quadPoint(pathPoints[i0]!, pathPoints[i1]!, pathPoints[i2]!, localT);
      const col = p.hue === "cyan" ? "56, 189, 248" : "16, 185, 129";
      ctx.fillStyle = `rgba(${col}, 0.85)`;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${col}, 0.25)`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y + 4);
      ctx.stroke();
    }
  }

  const now = performance.now();
  for (const sw of shockwaves) {
    const age = now - sw.born;
    if (age > 1400) continue;
    const progress = age / 1400;
    const radius = 4 + progress * 106;
    const alpha = 0.85 * (1 - progress);
    ctx.strokeStyle = `rgba(52, 211, 153, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}
