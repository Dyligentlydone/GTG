// Seeded PRNG (mulberry32). Never Math.random: the same seed always yields the same sculpture.

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** Uniform in [-1, 1). */
  signed(): number;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    signed: () => next() * 2 - 1,
  };
}

/** Derives an independent 32-bit seed for a named sub-stream (rock, shards, cracks, …). */
export function deriveSeed(seed: number, salt: string | number): number {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  const s = String(salt);
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x85ebca6b);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function rngFor(seed: number, salt: string | number): Rng {
  return mulberry32(deriveSeed(seed, salt));
}
