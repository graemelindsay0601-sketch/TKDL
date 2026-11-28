/**
 * Shadow Bot visit planner, shared by the scorer (vs a shadow in practice) and
 * the server (Shadow Cup simulations), so a shadow plays the same everywhere.
 *
 * A shadow replays the player's real darts: scoring darts are drawn from their
 * own spread of outcomes; on a finish it follows the standard checkout route but
 * each dart lands with their real rates (per-double hit rate, and their league
 * rate when the opponent is waiting on a finish). Without enough dart-by-dart
 * data ("thin") it plays at their average with the standard planner.
 */
import type { Dart } from "./x01.ts";
import type { Random } from "./random.ts";
import { BOT_MISS, makeBotDart, botCheckoutPlan, planBotX01Visit, type BotSkill } from "./bot.ts";

export type ShadowDarts = {
  primarySeg: number; treblePct: number; singlePct: number; doubleHitPct: number; computedAvg: number;
  scoringDist?: { seg: number; mult: number; n: number }[];
  doubleRates?: Record<string, number>;
  pressureDoubleHitPct?: number | null;
  thin?: boolean;
};

const BOARD = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const neighbour = (seg: number, rng: Random) => {
  const i = BOARD.indexOf(seg);
  if (i === -1) return 20;
  return BOARD[(i + (rng() < 0.5 ? 19 : 1)) % 20];
};

export const MIN_REPLAY_DARTS = 60;

function scoringDart(p: ShadowDarts, rng: Random): Dart {
  const total = p.scoringDist?.reduce((n, d) => n + d.n, 0) ?? 0;
  if (p.scoringDist && total >= MIN_REPLAY_DARTS) {
    let r = rng() * total;
    for (const d of p.scoringDist) { r -= d.n; if (r < 0) return d.seg === 0 ? BOT_MISS : makeBotDart(d.seg, d.mult as 1 | 2 | 3); }
  }
  const r = rng();
  if (r < p.treblePct) return makeBotDart(p.primarySeg, 3);
  if (r < p.treblePct + p.singlePct) return makeBotDart(p.primarySeg, 1);
  return makeBotDart(neighbour(p.primarySeg, rng), 1);
}

function doubleDart(seg: number, p: ShadowDarts, pressure: boolean, rng: Random): Dart {
  const rate = pressure && p.pressureDoubleHitPct != null ? p.pressureDoubleHitPct : (p.doubleRates?.[String(seg)] ?? p.doubleHitPct);
  if (rng() < rate) return makeBotDart(seg, 2);
  return rng() < 0.75 ? makeBotDart(seg, 1) : BOT_MISS;
}

export function planShadowX01Visit(remaining: number, p: ShadowDarts, options: { doubleOut: boolean; pressure?: boolean; rng?: Random; skill?: BotSkill }): [Dart, Dart, Dart] {
  const rng = options.rng ?? Math.random;
  if (p.thin) return planBotX01Visit(remaining, { ...(options.skill ?? { avg: 50, sd: 15, checkoutPct: 0.3, hitAcc: 0.45 }), avg: p.computedAvg || 50 }, { doubleOut: options.doubleOut, rng });
  const minLeft = options.doubleOut ? 2 : 0;
  if (remaining <= 170) {
    const co = botCheckoutPlan(remaining);
    if (co) {
      let run = remaining;
      return co.map(d => {
        let chosen: Dart;
        if (d.value === 0) chosen = BOT_MISS;
        else if (d.multiplier === 2) chosen = doubleDart(d.segment, p, !!options.pressure, rng);
        else if (d.multiplier === 3) {
          const same = d.segment === p.primarySeg;
          const tp = same ? p.treblePct : Math.min(p.treblePct, 0.35), sp = same ? p.singlePct : 0.45;
          const r = rng();
          chosen = r < tp ? d : r < tp + sp ? makeBotDart(d.segment, 1) : makeBotDart(neighbour(d.segment, rng), 1);
        } else chosen = d;
        const after = run - chosen.value;
        if (after < 0 || (after === 1 && options.doubleOut)) return BOT_MISS;
        run = after;
        return chosen;
      }) as [Dart, Dart, Dart];
    }
  }
  let rem = remaining;
  const out: Dart[] = [];
  for (let i = 0; i < 3; i++) {
    const d = scoringDart(p, rng);
    if (rem - d.value < minLeft) out.push(BOT_MISS);
    else { out.push(d); rem -= d.value; }
  }
  return out as [Dart, Dart, Dart];
}

/** Which boss the latest Shadow Cup champion possesses: picked from the cup week so it stays put all week. */
export function possessedBossIndex(week: string, bossCount: number): number {
  let h = 0; for (const c of week) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return bossCount ? h % bossCount : 0;
}
