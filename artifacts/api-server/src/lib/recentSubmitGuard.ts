/**
 * Lightweight duplicate-submit guard for unauthenticated arcade write
 * endpoints whose request body is too coarse for real idempotency keying
 * (board-curse's /record and boss-battles' /attempt both just send
 * `{playerId, format|bossId, won}` — no per-attempt nonce, dart log, or
 * timestamp to hash the way practice.ts's richer session body allows).
 * A pure content hash would incorrectly suppress two genuinely different
 * real results in a row (e.g. losing the same bot fight twice), since the
 * body is identical by design for that case.
 *
 * Instead, this treats the exact same (route, player, opponent/format,
 * outcome) tuple arriving again within a few seconds as a double-tap or a
 * retried request from a dropped response — the realistic cause of a
 * double-counted win/loss here — while leaving two legitimately consecutive
 * real results (always at least several seconds apart, since each is a full
 * match/fight) untouched.
 *
 * In-memory and per-instance, which is fine for this app's single-instance
 * deployment and this bug's severity (inflated arcade counters, no
 * currency/rewards at stake) — it doesn't need to survive a restart or scale
 * across instances the way the schema-backed idempotency keys elsewhere do.
 */

const recentSubmits = new Map<string, number>();
const WINDOW_MS = 4000;
const MAX_TRACKED = 1000;

/**
 * Returns true if this exact key was already seen within the last few
 * seconds (treat as a duplicate — skip the write), false if it's new
 * (proceed, and this call records it). Always records the latest timestamp
 * for the key either way, so a steady stream of genuinely distinct events
 * sharing a key over time never gets stuck comparing against a stale entry.
 */
export function isRecentDuplicateSubmit(key: string): boolean {
  const now = Date.now();
  const last = recentSubmits.get(key);
  recentSubmits.set(key, now);

  if (recentSubmits.size > MAX_TRACKED) {
    for (const [k, t] of recentSubmits) {
      if (now - t > WINDOW_MS) recentSubmits.delete(k);
    }
  }

  return last !== undefined && now - last < WINDOW_MS;
}
