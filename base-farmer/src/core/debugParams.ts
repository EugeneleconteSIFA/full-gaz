/**
 * Reads `?skip=<seconds>` (development only): starts the match clock later, to test phases and
 * the end of the match without waiting 7 minutes. Invalid values fail loudly.
 */
export function parseStartAtSeconds(search: string): number {
  const raw = new URLSearchParams(search).get("skip");
  if (raw === null) return 0;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error(`Invalid ?skip= value "${raw}": expected a number of seconds >= 0`);
  }
  return seconds;
}

/** Reads `?map=<id|random>` (development only). Unknown ids fail loudly. */
export function parseMap(search: string, knownIds: readonly string[]): string | null {
  const raw = new URLSearchParams(search).get("map");
  if (raw === null) return null;
  if (raw !== "random" && !knownIds.includes(raw)) {
    throw new Error(
      `Invalid ?map= value "${raw}": expected random or one of ${knownIds.join(", ")}`,
    );
  }
  return raw;
}

/**
 * Reads `?character=<id>` (development only): skips the selection screen. Unknown ids fail loudly.
 */
export function parseCharacter(search: string, knownIds: readonly string[]): string | null {
  const raw = new URLSearchParams(search).get("character");
  if (raw === null) return null;
  if (!knownIds.includes(raw)) {
    throw new Error(`Invalid ?character= value "${raw}": expected one of ${knownIds.join(", ")}`);
  }
  return raw;
}

/** Reads `?opponent=<easy|normal|hard|dummy>` (development only). Unknown values fail loudly. */
export function parseOpponent(search: string, known: readonly string[]): string | null {
  const raw = new URLSearchParams(search).get("opponent");
  if (raw === null) return null;
  if (!known.includes(raw)) {
    throw new Error(`Invalid ?opponent= value "${raw}": expected one of ${known.join(", ")}`);
  }
  return raw;
}
