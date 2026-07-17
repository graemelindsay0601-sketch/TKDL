/**
 * Card Clash match logger.
 *
 * Accumulates structured, timestamped events during a Card Clash match
 * (darts thrown, cards drawn/activated, Board Mark placements/triggers,
 * score adjustments, leg/match transitions) so a match can be downloaded
 * and inspected afterward instead of relying on someone describing what
 * they saw from memory. One logger instance per match (created fresh on
 * mount by each scorer).
 */

export interface MatchLogEntry {
  /** Milliseconds since the logger was created (i.e. since the match/leg started). */
  t: number;
  type: string;
  data: Record<string, unknown>;
}

export interface MatchLogger {
  log(type: string, data?: Record<string, unknown>): void;
  getEntries(): MatchLogEntry[];
  toText(): string;
  toJSON(): string;
}

export function createMatchLogger(meta: Record<string, unknown> = {}): MatchLogger {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  const entries: MatchLogEntry[] = [];

  return {
    log(type: string, data: Record<string, unknown> = {}) {
      entries.push({ t: Date.now() - startTime, type, data });
    },
    getEntries() {
      return entries;
    },
    toText() {
      const header = [
        `TKDL Card Clash match log`,
        `Started: ${startedAt}`,
        ...Object.entries(meta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
        `Events: ${entries.length}`,
        `${"=".repeat(60)}`,
      ].join("\n");
      const body = entries
        .map((e) => `[+${(e.t / 1000).toFixed(2)}s] ${e.type.padEnd(28)} ${JSON.stringify(e.data)}`)
        .join("\n");
      return `${header}\n${body}\n`;
    },
    toJSON() {
      return JSON.stringify({ startedAt, meta, entries }, null, 2);
    },
  };
}

/** Triggers a browser download of the given text as a file. No backend involved — works for any match, including Solo vs CPU which has no server-side match record at all. */
export function downloadMatchLog(logger: MatchLogger, filenamePrefix = "card-clash-log") {
  const text = logger.toText();
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `${filenamePrefix}-${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
