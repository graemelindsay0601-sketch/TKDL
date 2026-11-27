// Off the Oche extras: Moment of the Month, call-out streaks and bounties.
// Pure rules and the exclusive unlocks (unit-tested); database side in oche-extras-db.ts.

export type Cosmetic = { id: string; category: string; name: string; rarity: string; color?: string; gradient?: string; glow?: string; iconKey?: string; sortOrder: number };

// Exclusive unlocks: never in the Store (the "-oo-" in the id marks them, like "-lt-" and "-gf-").
export const OO_UNLOCKS = {
  motm:        { id: "tag-oo-moment-of-the-month", category: "LEADERBOARD_TAG", name: "MOMENT OF THE MONTH", rarity: "EPIC", color: "#ff005c", sortOrder: 210 },
  motm3:       { id: "banner-oo-highlight-reel", category: "BANNER", name: "Highlight Reel", rarity: "LEGENDARY",
                 gradient: "repeating-linear-gradient(115deg,rgba(255,0,92,.35) 0 10px,rgba(20,10,30,.92) 10px 26px,rgba(255,210,74,.25) 26px 30px,rgba(20,10,30,.92) 30px 46px)", glow: "#ff005c", sortOrder: 210 },
  calloutKing: { id: "tag-oo-callout-king", category: "LEADERBOARD_TAG", name: "CALL-OUT KING", rarity: "RARE", color: "#ff5c93", sortOrder: 211 },
  unbeaten:    { id: "frame-oo-unbeaten", category: "FRAME", name: "Unanswered", rarity: "EPIC", color: "#ff005c", glow: "#ffd24a", sortOrder: 211 },
  hunter:      { id: "tag-oo-bounty-hunter", category: "LEADERBOARD_TAG", name: "BOUNTY HUNTER", rarity: "RARE", color: "#cd7f32", sortOrder: 212 },
  wanted:      { id: "frame-oo-wanted", category: "FRAME", name: "Wanted", rarity: "EPIC", color: "#c0c8d8", glow: "#c0c8d8", sortOrder: 212 },
  goldBounty:  { id: "name-oo-gold-bounty", category: "NAME_STYLE", name: "Gold Bounty", rarity: "LEGENDARY",
                 gradient: "linear-gradient(90deg,#8a5a00,#ffd24a,#fff7d6,#ffd24a,#8a5a00)", glow: "#ffd24a", sortOrder: 212 },
} satisfies Record<string, Cosmetic>;

export const OO_EARNED_BY: Record<string, string> = {
  [OO_UNLOCKS.motm.id]: "Win Moment of the Month",
  [OO_UNLOCKS.motm3.id]: "Win Moment of the Month 3 times",
  [OO_UNLOCKS.calloutKing.id]: "Win 3 call-outs in a row",
  [OO_UNLOCKS.unbeaten.id]: "Win 5 call-outs in a row",
  [OO_UNLOCKS.hunter.id]: "Claim a bounty",
  [OO_UNLOCKS.wanted.id]: "Claim a silver bounty",
  [OO_UNLOCKS.goldBounty.id]: "Claim a gold bounty",
};

// ── Moment of the Month ──────────────────────────────────────────────────────
export const MOTM_SHORTLIST = 5;
export const MOTM_VOTE_DAYS = 5;

/** Records always make the shortlist; then the rest by reactions + comments, earliest first on a tie. */
export function motmShortlist(moments: { id: number; kind: string; score: number; at: string }[], n = MOTM_SHORTLIST): number[] {
  const byScore = (a: { score: number; at: string }, b: { score: number; at: string }) => b.score - a.score || a.at.localeCompare(b.at);
  const records = moments.filter(m => m.kind === "record").sort(byScore);
  const rest = moments.filter(m => m.kind !== "record").sort(byScore);
  return [...records, ...rest].slice(0, n).map(m => m.id);
}

/** Most votes wins; a tie goes to the bigger reaction score, then the earlier moment. No votes at all: the top score. */
export function motmWinner(shortlist: { id: number; votes: number; score: number; at: string }[]): number | null {
  if (!shortlist.length) return null;
  return [...shortlist].sort((a, b) => b.votes - a.votes || b.score - a.score || a.at.localeCompare(b.at))[0].id;
}

// ── Call-out streaks ─────────────────────────────────────────────────────────
export const STREAK_MOMENTS = [3, 5, 10];

/** Each player's current and best run of call-outs won (as challenger or target), oldest result first. */
export function calloutStreaks(settled: { challengerId: number; targetId: number; winnerId: number; at: string }[]): Map<number, { current: number; best: number }> {
  const out = new Map<number, { current: number; best: number }>();
  for (const s of [...settled].sort((a, b) => a.at.localeCompare(b.at))) {
    for (const p of [s.challengerId, s.targetId]) {
      const cur = out.get(p) ?? { current: 0, best: 0 };
      cur.current = p === s.winnerId ? cur.current + 1 : 0;
      cur.best = Math.max(cur.best, cur.current);
      out.set(p, cur);
    }
  }
  return out;
}

// ── Bounties ─────────────────────────────────────────────────────────────────
export type BountyReason = "leader" | "run" | "callout";
export const BOUNTY_RUN = 5;
export const BOUNTY_CALLOUT_STREAK = 3;
export const LEVEL_NAMES = ["", "Bronze", "Silver", "Gold"] as const;

/** Who should have a bounty right now, and why (one per player; leader > run > call-outs). */
export function bountyTargets(t: { leaderId: number | null; runs: { id: number; streak: number }[]; calloutTop: { id: number; streak: number } | null }): Map<number, BountyReason> {
  const out = new Map<number, BountyReason>();
  if (t.leaderId) out.set(t.leaderId, "leader");
  for (const r of t.runs) if (r.streak >= BOUNTY_RUN && !out.has(r.id)) out.set(r.id, "run");
  if (t.calloutTop && t.calloutTop.streak >= BOUNTY_CALLOUT_STREAK && !out.has(t.calloutTop.id)) out.set(t.calloutTop.id, "callout");
  return out;
}

/** Bronze when placed, Silver after a week unclaimed, Gold after two. */
export function bountyLevel(createdAt: string, now = new Date()): 1 | 2 | 3 {
  const weeks = Math.floor((now.getTime() - new Date(createdAt).getTime()) / (7 * 86400000));
  return Math.min(3, 1 + Math.max(0, weeks)) as 1 | 2 | 3;
}

/** Unlocks for claiming a bounty at a level (each level includes the ones below). */
export function bountyUnlocks(level: number): Cosmetic[] {
  return [OO_UNLOCKS.hunter, OO_UNLOCKS.wanted, OO_UNLOCKS.goldBounty].slice(0, Math.max(1, Math.min(3, level)));
}

export function bountyReasonText(r: BountyReason): string {
  return r === "leader" ? "top of the table" : r === "run" ? `on a run of ${BOUNTY_RUN}+ wins` : `on a ${BOUNTY_CALLOUT_STREAK}+ call-out streak`;
}
