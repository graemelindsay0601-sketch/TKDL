// Player Card ratings (Profile 2.0). Worked out only from real league matches the scorer recorded:
// darts thrown, 100+/140+/180 counts, checkout attempts and hits, results and ELO. Each rating is
// 40–99, so a card never looks empty and the top end stays hard to reach.

export type RatingKey = "SCO" | "FIN" | "POW" | "PAC" | "FRM" | "BIG";
export const RATING_INFO: Record<RatingKey, { name: string; how: string }> = {
  SCO: { name: "Scoring", how: "How often a visit is 100 or more" },
  FIN: { name: "Finishing", how: "Darts at a double that hit" },
  POW: { name: "Power", how: "140s and 180s per visit" },
  PAC: { name: "Pace", how: "Darts needed to win a 501 leg" },
  FRM: { name: "Form", how: "Results in the last 10 matches" },
  BIG: { name: "Big game", how: "ELO, and upset wins over higher-rated players" },
};
export const RATING_ORDER: RatingKey[] = ["SCO", "FIN", "POW", "PAC", "FRM", "BIG"];

/** One league match from this player's side. */
export type RatingMatch = {
  won: boolean; gameType: string; darts: number | null;
  tons: number; t140: number; t180: number; coAttempts: number | null; coHits: number | null; upset: boolean;
};
export type RatingInput = { matches: RatingMatch[]; elo: number };
/** A rating is null when there's no data for it (e.g. no checkout darts recorded); overall then uses the rest. */
export type Ratings = { overall: number; ratings: Record<RatingKey, number | null>; sample: number; raw: Record<string, number | null> };

/** Matches needed before a card shows ratings at all. */
export const MIN_MATCHES = 5;
/** Most recent X01 matches used. */
export const WINDOW = 30;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
/** Map a value from [lo, hi] onto 40–99. */
const scale = (v: number, lo: number, hi: number) => Math.round(40 + clamp((v - lo) / (hi - lo), 0, 1) * 59);
const isX01 = (g: string) => /^(501|301|x01)/i.test(g);

export function playerRatings({ matches, elo }: RatingInput): Ratings | null {
  const x01 = matches.filter(m => isX01(m.gameType) && m.darts && m.darts > 0).slice(0, WINDOW);
  if (x01.length < MIN_MATCHES) return null;
  const visits = x01.reduce((s, m) => s + (m.darts ?? 0) / 3, 0);
  const tons = x01.reduce((s, m) => s + m.tons + m.t140 + m.t180, 0);
  const big = x01.reduce((s, m) => s + m.t140 + m.t180 * 2, 0);
  const att = x01.reduce((s, m) => s + (m.coAttempts ?? 0), 0);
  const hit = x01.reduce((s, m) => s + (m.coHits ?? 0), 0);
  const wins501 = x01.filter(m => m.won && /^501/.test(m.gameType));
  const avgLegDarts = wins501.length ? wins501.reduce((s, m) => s + (m.darts ?? 0), 0) / wins501.length : null;
  const last10 = matches.slice(0, 10);
  // Recent results count more: newest match weight 10, oldest weight 1.
  const formScore = last10.length ? last10.reduce((s, m, i) => s + (m.won ? 10 - i : 0), 0) / last10.reduce((s, _m, i) => s + (10 - i), 0) : 0.5;
  const upsets = matches.slice(0, WINDOW).filter(m => m.won && m.upset).length;

  const tonRate = visits ? tons / visits : 0;
  const bigRate = visits ? big / visits : 0;
  const coPct = att ? hit / att : null;
  const ratings: Record<RatingKey, number | null> = {
    SCO: scale(tonRate, 0.02, 0.32),
    FIN: coPct == null ? null : scale(coPct, 0.05, 0.45),
    POW: scale(bigRate, 0, 0.12),
    PAC: avgLegDarts == null ? null : scale(-avgLegDarts, -48, -15),
    FRM: scale(formScore, 0.1, 0.9),
    BIG: Math.round(clamp(scale(elo, 850, 1450) + upsets * 2, 40, 99)),
  };
  const w: Record<RatingKey, number> = { SCO: 0.22, FIN: 0.22, POW: 0.12, PAC: 0.16, FRM: 0.14, BIG: 0.14 };
  const have = RATING_ORDER.filter(k => ratings[k] != null);
  const overall = Math.round(have.reduce((s, k) => s + (ratings[k] as number) * w[k], 0) / have.reduce((s, k) => s + w[k], 0));
  return { overall, ratings, sample: x01.length,
    raw: { tonRate: Math.round(tonRate * 1000) / 10, bigRate: Math.round(bigRate * 1000) / 10, checkoutPct: coPct == null ? null : Math.round(coPct * 1000) / 10,
      avgLegDarts: avgLegDarts == null ? null : Math.round(avgLegDarts * 10) / 10, upsets } };
}

/** Card colour band by overall. */
export function cardBand(overall: number): { id: "bronze" | "silver" | "gold" | "elite"; name: string } {
  return overall >= 80 ? { id: "elite", name: "Elite" } : overall >= 70 ? { id: "gold", name: "Gold" } : overall >= 60 ? { id: "silver", name: "Silver" } : { id: "bronze", name: "Bronze" };
}
