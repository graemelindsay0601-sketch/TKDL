// Player Cards (Profile 2.0): one card per game (501, 301, Cricket, Around the World), each with
// six ratings from 40 to 99 worked out only from real league matches. 501/301 use the stats saved
// on every scored match; Cricket and ATW detail (marks, skips…) only exists for games scored live
// on the new scorer, so those ratings show null ("—") until there's enough of it.

export type CardGame = "501" | "301" | "CRICKET" | "ATW";
export const CARD_GAMES: CardGame[] = ["501", "301", "CRICKET", "ATW"];
export const CARD_GAME_NAME: Record<CardGame, string> = { "501": "501", "301": "301", CRICKET: "Cricket", ATW: "Around the World" };

type Info = { key: string; name: string; how: string };
const X01_INFO = (g: string): Info[] => [
  { key: "SCO", name: "Scoring", how: "Visits of 100+, with 140s and 180s counting extra" },
  { key: "FIN", name: "Finishing", how: "Darts at a double that hit" },
  { key: "PAC", name: "Pace", how: "Darts needed to win a leg" },
  { key: "CON", name: "Consistency", how: "How steady your winning legs are" },
  { key: "FRM", name: "Form", how: `Your last 10 games of ${g}, newest counting most` },
  { key: "WIN", name: "Win rating", how: "Win rate, with wins over stronger players counting more" },
];
export const CARD_RATINGS: Record<CardGame, Info[]> = {
  "501": X01_INFO("501"),
  "301": X01_INFO("301"),
  CRICKET: [
    { key: "MPR", name: "Marks per round", how: "Marks scored per visit" },
    { key: "PAC", name: "Pace", how: "Darts needed to win" },
    { key: "BIG", name: "Big visits", how: "Best visits and 9-mark visits" },
    { key: "CLN", name: "Clean visits", how: "How rarely a visit scores nothing" },
    { key: "FRM", name: "Form", how: "Your last 10 cricket games, newest counting most" },
    { key: "WIN", name: "Win rating", how: "Win rate, with wins over stronger players counting more" },
  ],
  ATW: [
    { key: "PAC", name: "Pace", how: "Darts to get round the board" },
    { key: "ACC", name: "Accuracy", how: "How often a visit moves you on" },
    { key: "SKP", name: "Skips", how: "Trebles and doubles that jump you ahead" },
    { key: "BUL", name: "Bull", how: "Darts needed on the bull to finish" },
    { key: "FRM", name: "Form", how: "Your last 10 Around the World games, newest counting most" },
    { key: "WIN", name: "Win rating", how: "Win rate, with wins over stronger players counting more" },
  ],
};

/** One league match from this player's side. `eloChange` is what the winner gained. */
export type CardMatch = {
  game: CardGame; won: boolean; eloChange: number;
  darts?: number | null; t100?: number; t140?: number; t180?: number; coAttempts?: number | null; coHits?: number | null;
  cricket?: { darts: number; visits: number; marks: number; bestVisit: number; nineMarkVisits: number; blankVisits: number } | null;
  atw?: { darts: number; visits: number; trebleSkips: number; doubleSkips: number; bullDarts: number; blankVisits: number } | null;
};
export type GameCardRatings = { game: CardGame; overall: number; ratings: Record<string, number | null>; sample: number; raw: Record<string, number | null> };

/** Games of one type needed before its card unlocks. */
export const MIN_MATCHES = 5;
/** Most recent games of each type used. */
export const WINDOW = 30;
/** Detailed stats needed before a detail rating shows (rather than "—"). */
const MIN_DETAIL = 3;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
/** Map [lo, hi] onto 40–99 (lo > hi flips it, for "fewer is better"). */
const scale = (v: number, lo: number, hi: number) => Math.round(40 + clamp((v - lo) / (hi - lo), 0, 1) * 59);
const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Which card a stored match game_type belongs to (team and handicap games don't count). */
export function cardGameOf(gameType: string): CardGame | null {
  const g = gameType.toLowerCase().trim();
  if (g.startsWith("team_") || g.includes("handicap")) return null;
  if (/^501($|_)/.test(g)) return "501";
  if (/^301($|_)/.test(g)) return "301";
  if (["cricket", "cutthroat_cricket", "cricket_no_bull", "tactics"].includes(g)) return "CRICKET";
  if (["around_the_world", "atw", "around the world"].includes(g)) return "ATW";
  return null;
}

function form(ms: CardMatch[]): number {
  const last = ms.slice(0, 10);
  const total = last.reduce((s, _m, i) => s + (10 - i), 0);
  return scale(last.reduce((s, m, i) => s + (m.won ? 10 - i : 0), 0) / total, 0.1, 0.9);
}
/** Wins over stronger players (bigger ELO gain) count more; losses to stronger players count less. */
function winRating(ms: CardMatch[]): { value: number; pct: number } {
  let w = 0, l = 0;
  for (const m of ms) {
    if (m.won) w += clamp(m.eloChange / 16, 0.5, 2);
    else l += clamp((32 - m.eloChange) / 16, 0.5, 2);
  }
  const pct = w + l ? w / (w + l) : 0;
  return { value: scale(pct, 0.15, 0.85), pct };
}

const WEIGHTS: Record<CardGame, Record<string, number>> = {
  "501": { SCO: 0.2, FIN: 0.2, PAC: 0.15, CON: 0.15, FRM: 0.15, WIN: 0.15 },
  "301": { SCO: 0.18, FIN: 0.22, PAC: 0.15, CON: 0.15, FRM: 0.15, WIN: 0.15 },
  CRICKET: { MPR: 0.25, PAC: 0.15, BIG: 0.12, CLN: 0.13, FRM: 0.15, WIN: 0.2 },
  ATW: { PAC: 0.22, ACC: 0.2, SKP: 0.12, BUL: 0.11, FRM: 0.15, WIN: 0.2 },
};

/** One game's card, or null if there aren't enough games of it yet. `all` is newest first. */
export function gameCard(game: CardGame, all: CardMatch[]): GameCardRatings | null {
  const ms = all.filter(m => m.game === game).slice(0, WINDOW);
  if (ms.length < MIN_MATCHES) return null;
  const r: Record<string, number | null> = {};
  const raw: Record<string, number | null> = {};
  const win = winRating(ms);
  raw.winPct = Math.round(win.pct * 100);

  if (game === "501" || game === "301") {
    const scored = ms.filter(m => m.darts && m.darts > 0);
    const visits = scored.reduce((s, m) => s + (m.darts ?? 0) / 3, 0);
    const big = scored.reduce((s, m) => s + (m.t100 ?? 0) + 1.5 * (m.t140 ?? 0) + 2.5 * (m.t180 ?? 0), 0);
    const att = scored.reduce((s, m) => s + (m.coAttempts ?? 0), 0), hit = scored.reduce((s, m) => s + (m.coHits ?? 0), 0);
    const legs = scored.filter(m => m.won).map(m => m.darts as number);
    const [fast, slow] = game === "501" ? [15, 48] : [9, 33];
    r.SCO = scored.length >= MIN_DETAIL && visits ? scale(big / visits, 0.02, 0.4) : null;
    r.FIN = att ? scale(hit / att, 0.05, 0.45) : null;
    r.PAC = legs.length ? scale(mean(legs), slow, fast) : null;
    if (legs.length >= 3) {
      const avg = mean(legs), sd = Math.sqrt(mean(legs.map(x => (x - avg) ** 2)));
      r.CON = scale(sd / avg, 0.5, 0.05);
      raw.legSpread = round1(sd);
    } else r.CON = null;
    raw.tonRate = visits ? round1((scored.reduce((s, m) => s + (m.t100 ?? 0) + (m.t140 ?? 0) + (m.t180 ?? 0), 0) / visits) * 100) : null;
    raw.t180s = scored.reduce((s, m) => s + (m.t180 ?? 0), 0);
    raw.checkoutPct = att ? round1((hit / att) * 100) : null;
    raw.avgLegDarts = legs.length ? round1(mean(legs)) : null;
  } else if (game === "CRICKET") {
    const st = ms.flatMap(m => (m.cricket && m.cricket.darts > 0 ? [{ m, s: m.cricket }] : []));
    const ok = st.length >= MIN_DETAIL;
    const darts = st.reduce((a, x) => a + x.s.darts, 0), visits = st.reduce((a, x) => a + x.s.visits, 0);
    const marks = st.reduce((a, x) => a + x.s.marks, 0), blanks = st.reduce((a, x) => a + x.s.blankVisits, 0);
    const nines = st.reduce((a, x) => a + x.s.nineMarkVisits, 0);
    const winDarts = st.filter(x => x.m.won).map(x => x.s.darts);
    const mpr = darts ? marks / (darts / 3) : 0;
    r.MPR = ok ? scale(mpr, 0.8, 3.2) : null;
    r.PAC = ok && winDarts.length ? scale(mean(winDarts), 75, 20) : null;
    r.BIG = ok ? scale(mean(st.map(x => x.s.bestVisit)) + (visits ? (nines / visits) * 40 : 0), 3, 8.5) : null;
    r.CLN = ok && visits ? scale(1 - blanks / visits, 0.4, 0.9) : null;
    raw.mpr = ok ? Math.round(mpr * 100) / 100 : null;
    raw.nineMarks = ok ? nines : null;
    raw.detailGames = st.length;
  } else {
    const st = ms.flatMap(m => (m.atw && m.atw.darts > 0 ? [{ m, s: m.atw }] : []));
    const ok = st.length >= MIN_DETAIL;
    const darts = st.reduce((a, x) => a + x.s.darts, 0), visits = st.reduce((a, x) => a + x.s.visits, 0);
    const blanks = st.reduce((a, x) => a + x.s.blankVisits, 0), skips = st.reduce((a, x) => a + x.s.trebleSkips + x.s.doubleSkips, 0);
    const wins = st.filter(x => x.m.won);
    r.PAC = ok && wins.length ? scale(mean(wins.map(x => x.s.darts)), 90, 25) : null;
    r.ACC = ok && visits ? scale(1 - blanks / visits, 0.3, 0.9) : null;
    r.SKP = ok && darts ? scale(skips / darts, 0, 0.25) : null;
    r.BUL = ok && wins.length ? scale(mean(wins.map(x => x.s.bullDarts)), 12, 1) : null;
    raw.avgDarts = ok && wins.length ? round1(mean(wins.map(x => x.s.darts))) : null;
    raw.detailGames = st.length;
  }
  r.FRM = form(ms);
  r.WIN = win.value;

  const w = WEIGHTS[game];
  const have = Object.keys(w).filter(k => r[k] != null);
  const overall = Math.round(have.reduce((s, k) => s + (r[k] as number) * w[k], 0) / have.reduce((s, k) => s + w[k], 0));
  return { game, overall, ratings: r, sample: ms.length, raw };
}

/** Card colour band by overall. */
export function cardBand(overall: number): { id: "bronze" | "silver" | "gold" | "elite"; name: string } {
  return overall >= 80 ? { id: "elite", name: "Elite" } : overall >= 70 ? { id: "gold", name: "Gold" } : overall >= 60 ? { id: "silver", name: "Silver" } : { id: "bronze", name: "Bronze" };
}
