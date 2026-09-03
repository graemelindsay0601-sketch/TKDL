// TKDL LIVE — deterministic hash + PRNG (handover doc section 12.5 / 20.1's
// own file map: "Deterministic hash/PRNG and Poisson sampling helpers").
//
// POISSON SAMPLING ALREADY EXISTS: title-predictor-math.ts's poissonSample()
// (Phase C, section 8) already covers the doc's "Poisson sampling helpers"
// half of this file's description — it's not duplicated here. What's
// actually new, and genuinely needed starting with the Director/Commentary
// Engine (sections 10-12), is the deterministic hash -> seed -> PRNG
// construction this file provides: section 12.5's own requirement is
// "Selection uses a seeded PRNG based on Edition slotKey + storyKey +
// commentaryVersion, so the same Edition is stable for every viewer" — a
// genuinely different need from the Title Predictor's Monte Carlo simulation
// (which explicitly wants a NEW random draw every run, defaulting to
// Math.random() with an injectable override for its own tests). Both
// title-predictor-math.ts's sampling functions AND this file's seededRng()
// share the exact same `() => number` shape, so a seeded generator from here
// can be passed anywhere those functions accept an `rng` override — the two
// modules are compatible, not competing implementations of the same thing.
//
// Deliberately dependency-free (no npm RNG/hash package) per section 16.5's
// "do not add heavyweight runtime packages where a small pure TypeScript
// function suffices" — both algorithms below are small, well-known, public-
// domain constructions (FNV-1a for the hash, mulberry32 for the generator),
// chosen for determinism and speed, not cryptographic strength (nothing here
// needs to resist an adversary — only to be the same sequence every time for
// the same key, across every server instance and every viewer).

/**
 * FNV-1a, 32-bit. A fast, simple, non-cryptographic string hash with good
 * avalanche behaviour (a one-character change anywhere in the input
 * produces an unrelated-looking output) — exactly what's needed to turn an
 * arbitrary composite key (e.g. "2026-09-02:evening|singles:WIN_STREAK:...|1")
 * into a well-distributed 32-bit seed.
 */
export function hashStringToSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * mulberry32 — a small, fast, deterministic PRNG. Given the same 32-bit
 * seed, produces the exact same sequence of [0, 1) floats every time, on
 * every machine (no reliance on platform Math.random() internals). Good
 * enough statistical quality for phrase/story selection; not suitable for
 * anything security-sensitive (this app has no such use for it).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The one function callers actually reach for: join every part of a
 * composite identity key (e.g. slotKey, storyKey, commentaryVersion) and
 * derive a PRNG from it. Same parts, in the same order -> the exact same
 * generator, every time, everywhere — the determinism section 12.5 asks for.
 * A "|" separator (rather than concatenation) avoids two different part
 * splits accidentally colliding on the same joined string (e.g. parts
 * ["ab", "c"] vs ["a", "bc"]) — vanishingly unlikely to matter for real
 * keys here, but free to rule out.
 */
export function seededRng(...parts: (string | number)[]): () => number {
  const key = parts.map(String).join("|");
  return mulberry32(hashStringToSeed(key));
}

/**
 * Deterministically pick one element of a non-empty array using an already-
 * seeded rng. Shared here (rather than duplicated in director.ts and
 * commentary-engine.ts, both of which need "pick one of several valid
 * candidates deterministically") because it's the one piece of selection
 * logic every seeded-PRNG consumer in this folder needs identically.
 */
export function pickFrom<T>(items: readonly T[], rng: () => number): T {
  if (items.length === 0) throw new Error("pickFrom: items must be non-empty");
  const idx = Math.floor(rng() * items.length);
  // Guard the astronomically unlikely rng() === 1 (or floating-point
  // rounding landing exactly on items.length) edge case rather than risk an
  // out-of-bounds read.
  return items[Math.min(idx, items.length - 1)];
}

/**
 * Deterministic Fisher-Yates shuffle using an already-seeded rng — same
 * "same key -> same result, everywhere" contract as pickFrom, just
 * returning a full reordering instead of one pick. Never mutates `items`.
 * director-math.ts's own applyVarietyShuffle is the one real caller: it
 * reorders only within a tied priority/score band, so this never needs to
 * be (and isn't) anything more sophisticated than a plain full shuffle of
 * whatever short band it's handed.
 */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}
