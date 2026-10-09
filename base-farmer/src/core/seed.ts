const MAX_SEED = 0xffffffff;

/**
 * Reads `?seed=<uint32>` from a query string so a match can be replayed for debugging.
 * Falls back to `fallback` when absent. An invalid seed fails loudly instead of being ignored.
 */
export function parseSeed(search: string, fallback: () => number): number {
  const raw = new URLSearchParams(search).get("seed");
  if (raw === null) return fallback();
  const seed = Number(raw);
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
    throw new Error(`Invalid ?seed= value "${raw}": expected an integer in [0, ${MAX_SEED}]`);
  }
  return seed;
}

export function randomSeed(): number {
  // Non-authoritative: only picks which seed the match uses, never drives gameplay directly.
  return Math.floor(Math.random() * MAX_SEED);
}
