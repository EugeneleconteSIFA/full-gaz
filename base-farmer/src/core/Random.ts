/**
 * Seeded, serializable RNG (mulberry32). All authoritative randomness must go through this,
 * never Math.random(), so a match is reproducible from its seed.
 */
export interface RngState {
  state: number;
}

export function createRng(seed: number): RngState {
  if (!Number.isInteger(seed)) throw new Error(`RNG seed must be an integer, got ${seed}`);
  return { state: seed >>> 0 };
}

/** Returns a float in [0, 1) and advances the RNG. */
export function nextFloat(rng: RngState): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Returns an integer in [minInclusive, maxExclusive) and advances the RNG. */
export function nextInt(rng: RngState, minInclusive: number, maxExclusive: number): number {
  if (!(maxExclusive > minInclusive)) {
    throw new Error(`Invalid RNG range [${minInclusive}, ${maxExclusive})`);
  }
  return minInclusive + Math.floor(nextFloat(rng) * (maxExclusive - minInclusive));
}
