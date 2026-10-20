import { Random } from "python-random";

const LOG4 = 1.3862943611198906;
const SG_MAGICCONST = 1.0 + Math.log(4.5);

/** gauss / gammavariate allineati a CPython Lib/random.py */
export class PythonRandom extends Random {
  private gaussSpare: number | null = null;

  gauss(mu = 0.0, sigma = 1.0): number {
    let z = this.gaussSpare;
    this.gaussSpare = null;
    if (z === null) {
      const x2pi = this.random() * (2.0 * Math.PI);
      const g2rad = Math.sqrt(-2.0 * Math.log(1.0 - this.random()));
      z = Math.cos(x2pi) * g2rad;
      this.gaussSpare = Math.sin(x2pi) * g2rad;
    }
    return mu + z * sigma;
  }

  gammavariate(alpha: number, beta: number): number {
    if (alpha <= 0.0 || beta <= 0.0) {
      throw new RangeError("gammavariate: alpha and beta must be > 0.0");
    }
    if (alpha > 1.0) {
      const ainv = Math.sqrt(2.0 * alpha - 1.0);
      const bbb = alpha - LOG4;
      const ccc = alpha + ainv;
      while (true) {
        const u1 = this.random();
        if (!(1e-7 < u1 && u1 < 0.9999999)) continue;
        const u2 = 1.0 - this.random();
        const v = Math.log(u1 / (1.0 - u1)) / ainv;
        const x = alpha * Math.exp(v);
        const z = u1 * u1 * u2;
        const r = bbb + ccc * v - x;
        if (
          r + SG_MAGICCONST - 4.5 * z >= 0.0 ||
          r >= Math.log(z)
        ) {
          return x * beta;
        }
      }
    }
    if (alpha === 1.0) {
      return -Math.log(1.0 - this.random()) * beta;
    }
    const e = Math.E;
    let x = 0;
    while (true) {
      const u = this.random();
      const b = (e + alpha) / e;
      const p = b * u;
      if (p <= 1.0) {
        x = p ** (1.0 / alpha);
      } else {
        x = -Math.log((b - p) / alpha);
      }
      const u1 = this.random();
      if (p > 1.0) {
        if (u1 <= x ** (alpha - 1.0)) break;
      } else if (u1 <= Math.exp(-x)) {
        break;
      }
    }
    return x * beta;
  }
}
