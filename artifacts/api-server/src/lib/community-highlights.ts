/**
 * "League moments" for Off the Oche: a short, curated list of the things worth
 * talking about (a 180, a ton-plus finish, an upset, a record, a run of wins,
 * the League Target, the Gaffer) posted as their own card type, `highlight`.
 *
 * Routine results stay where they are (post_type 'auto', shown on the Hub's
 * League Pulse only): the feed was deliberately cleared of those in Sept 2026
 * because every result made it read like a log. These are the exceptions:
 * rare by design, each one keyed so it can only ever be posted once.
 */
export type HighlightKind =
  | "max" | "big_finish" | "upset" | "record" | "streak" | "elimination"
  | "target_hit" | "gaffer" | "callout_result"
  | "motm" | "callout_streak" | "bounty_on" | "bounty_claimed" | "shadow_cup" | "legend_slain" | "boss_world" | "boss_revenge";

export type Highlight = {
  /** Unique forever: the same moment can never be posted twice. */
  key: string;
  kind: HighlightKind;
  /** Whose avatar/name the post carries (the player it's about, or the most relevant one). */
  playerId: number;
  /** Big headline, e.g. "MAXIMUM!". */
  title: string;
  /** One sentence, e.g. "Kyle hit a 180 against Sean". Also stored as the post text. */
  line: string;
  /** Optional hero number and its label, e.g. 121 / "checkout". */
  stat?: string | number;
  statLabel?: string;
  /** Players named in it (for links and notifications). */
  players?: number[];
  matchId?: number;
  /** Where "See more" goes, e.g. /records or /match-centre/league-12. */
  link?: string;
};

// ── What counts as a moment (pure, unit-tested) ──────────────────────────────

export type SinglesResult = {
  matchId: number; gameType: string;
  winnerId: number; winnerName: string; loserId: number; loserName: string;
  winner180s: number; loser180s: number;
  wasUpset: boolean; winnerRankBefore?: number | null; loserRankBefore?: number | null;
  winnerStreakAfter: number; loserStreakBefore: number; loserEliminated: boolean;
};

export const STREAK_STEPS = [5, 10, 15, 20];
export const UPSET_GAP = 3;
/** Everyday kinds share a daily cap so a big night can't flood the feed; the rarer ones always post. */
export const CAPPED_KINDS: HighlightKind[] = ["max", "big_finish", "upset"];
export const DAILY_CAP = 6;

export function singlesHighlights(r: SinglesResult): Highlight[] {
  const out: Highlight[] = [];
  const link = `/match-centre/league-${r.matchId}`;
  for (const [id, name, opp, n] of [[r.winnerId, r.winnerName, r.loserName, r.winner180s], [r.loserId, r.loserName, r.winnerName, r.loser180s]] as const) {
    if (n > 0) out.push({ key: `max:${r.matchId}:${id}`, kind: "max", playerId: id, matchId: r.matchId, link, players: [id],
      title: n > 1 ? `${n} MAXIMUMS!` : "MAXIMUM!", line: `${name} hit ${n > 1 ? `${n} 180s` : "a 180"} against ${opp}.`, stat: 180, statLabel: n > 1 ? `× ${n}` : "" });
  }
  // An upset needs a real gap: at least UPSET_GAP places between them in the table beforehand.
  const gap = r.winnerRankBefore && r.loserRankBefore ? r.winnerRankBefore - r.loserRankBefore : null;
  if (r.wasUpset && gap != null && gap >= UPSET_GAP) {
    out.push({ key: `upset:${r.matchId}`, kind: "upset", playerId: r.winnerId, matchId: r.matchId, link, players: [r.winnerId, r.loserId],
      title: "UPSET!", line: `${r.winnerName} (${ordinal(r.winnerRankBefore!)}) beat ${r.loserName} (${ordinal(r.loserRankBefore!)}).`,
      stat: gap, statLabel: "places apart" });
  }
  if (STREAK_STEPS.includes(r.winnerStreakAfter)) out.push({ key: `streak:${r.winnerId}:${r.matchId}`, kind: "streak", playerId: r.winnerId, matchId: r.matchId, link,
    title: "ON FIRE", line: `${r.winnerName} has won ${r.winnerStreakAfter} in a row.`, stat: r.winnerStreakAfter, statLabel: "wins in a row" });
  if (r.loserStreakBefore >= 5) out.push({ key: `streak-end:${r.loserId}:${r.matchId}`, kind: "streak", playerId: r.winnerId, matchId: r.matchId, link, players: [r.winnerId, r.loserId],
    title: "STREAK BUSTER", line: `${r.winnerName} ended ${r.loserName}'s run of ${r.loserStreakBefore} wins.`, stat: r.loserStreakBefore, statLabel: "run ended" });
  if (r.loserEliminated) out.push({ key: `elim:${r.matchId}`, kind: "elimination", playerId: r.winnerId, matchId: r.matchId, link, players: [r.winnerId, r.loserId],
    title: "ELIMINATED", line: `${r.winnerName} knocked ${r.loserName} out of the season.` });
  return out;
}

/** The winning visit of a scorer match (last 1–3 darts of the winner's log), if it's a ton-plus finish. */
export function bigFinish(log: { val: number }[]): number | null {
  if (!log.length) return null;
  const last = log.slice(-(((log.length - 1) % 3) + 1));
  const v = last.reduce((n, d) => n + Number(d.val || 0), 0);
  return v >= 100 && v <= 170 ? v : null;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
