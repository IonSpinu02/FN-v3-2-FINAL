/**
 * MT19937 + gauss/gammavariate allineati a CPython Lib/random.py.
 * Implementazione browser-safe (no import da `python-random` / node:crypto).
 */

const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

const LOG4 = 1.3862943611198906;
const SG_MAGICCONST = 1.0 + Math.log(4.5);

function toBigInt(v: unknown, what: string): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new TypeError(`${what} must be an integer, got ${String(v)}`);
  }
  if (!Number.isSafeInteger(v)) {
    throw new RangeError(`${what} ${v} is not a safe integer; pass a bigint`);
  }
  return BigInt(v);
}

/** Nucleo MT19937 — stesso algoritmo del pacchetto python-random (seed intero). */
class Mt19937 {
  mt = new Uint32Array(N);
  mti = N;

  constructor(seed?: number | null) {
    if (seed !== undefined && seed !== null) this.seed(seed);
    else this.seedFromEntropy();
  }

  seed(a: number): void {
    let n = toBigInt(a, "seed");
    const zero = BigInt(0);
    const mask = BigInt(0xffffffff);
    const shift = BigInt(32);
    if (n < zero) n = -n;
    const key: number[] = [];
    do {
      key.push(Number(n & mask));
      n >>= shift;
    } while (n > zero);
    this.initByArray(Uint32Array.from(key));
  }

  private seedFromEntropy(): void {
    const key = new Uint32Array(N);
    const g = globalThis.crypto?.getRandomValues;
    if (typeof g === "function") {
      g.call(globalThis.crypto, key);
    } else {
      for (let i = 0; i < N; i++) {
        key[i] = (Math.random() * 0x100000000) >>> 0;
      }
    }
    this.initByArray(key);
  }

  private initByArray(key: Uint32Array): void {
    const mt = this.mt;
    mt[0] = 19650218;
    for (let i = 1; i < N; i++) {
      const prev = mt[i - 1]! ^ (mt[i - 1]! >>> 30);
      mt[i] = (Math.imul(1812433253, prev) + i) >>> 0;
    }
    let i = 1;
    let j = 0;
    for (let k = Math.max(N, key.length); k; k--) {
      const prev = mt[i - 1]! ^ (mt[i - 1]! >>> 30);
      mt[i] =
        ((mt[i]! ^ Math.imul(prev, 1664525)) + key[j]! + j) >>> 0;
      i++;
      j++;
      if (i >= N) {
        mt[0] = mt[N - 1]!;
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = N - 1; k; k--) {
      const prev = mt[i - 1]! ^ (mt[i - 1]! >>> 30);
      mt[i] = ((mt[i]! ^ Math.imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= N) {
        mt[0] = mt[N - 1]!;
        i = 1;
      }
    }
    mt[0] = 0x80000000;
    this.mti = N;
  }

  /** random.random(): float in [0, 1) con 53 bit (CPython). */
  random(): number {
    const a = this.next32() >>> 5;
    const b = this.next32() >>> 6;
    return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
  }

  private next32(): number {
    const mt = this.mt;
    let y: number;
    if (this.mti >= N) {
      let kk = 0;
      for (; kk < N - M; kk++) {
        y = (mt[kk]! & UPPER_MASK) | (mt[kk + 1]! & LOWER_MASK);
        mt[kk] = mt[kk + M]! ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      for (; kk < N - 1; kk++) {
        y = (mt[kk]! & UPPER_MASK) | (mt[kk + 1]! & LOWER_MASK);
        mt[kk] = mt[kk + (M - N)]! ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      y = (mt[N - 1]! & UPPER_MASK) | (mt[0]! & LOWER_MASK);
      mt[N - 1] = mt[M - 1]! ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      this.mti = 0;
    }
    y = mt[this.mti++]!;
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }
}

/** gauss / gammavariate allineati a CPython Lib/random.py */
export class PythonRandom extends Mt19937 {
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
