/**
 * X01 bot visit planner shared by GameScorer and the Career server.
 *
 * For straight-in play this is the long-standing TKDL bot (same probabilities and
 * the same Math.random call order when no rng is supplied). A2.5 adds:
 *  - an injectable rng so a Career match can be regenerated on the server;
 *  - double-in awareness: an unopened bot aims at a double dart by dart, and only
 *    the darts after the opening double score.
 */
import type { Dart } from "./x01.ts";
import type { Random } from "./random.ts";

export type BotSkill = { avg: number; sd: number; checkoutPct: number; hitAcc: number };

function makeDart(seg: number, mult: 1 | 2 | 3, ring?: "inner" | "outer"): Dart {
  const val = seg === 25 ? (mult === 2 ? 50 : 25) : seg * mult;
  const lbl = seg === 25 ? (mult === 2 ? "DB" : "Bull") : mult === 3 ? `T${seg}` : mult === 2 ? `D${seg}` : (ring === "inner" ? `${seg}i` : `${seg}`);
  return { segment: seg, multiplier: mult, value: val, label: lbl, ring: mult === 1 ? ring : undefined };
}
export const BOT_MISS: Dart = { segment: 0, multiplier: 1, value: 0, label: "Miss" };

function gauss(mean: number, sd: number, rng: Random): number {
  const u1 = Math.max(rng(), 1e-10);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng());
  return mean + sd * z;
}

function dartForValue(v: number): Dart {
  if (v === 0) return BOT_MISS;
  if (v === 50) return makeDart(25, 2);
  if (v === 25) return makeDart(25, 1);
  if (v <= 20) return makeDart(v, 1);
  if (v <= 40 && v % 2 === 0) return makeDart(v / 2, 2);
  if (v <= 57 && v % 3 === 0) return makeDart(v / 3, 3);
  if (v <= 40) return makeDart(20, 1);
  return makeDart(20, 3);
}

const REACHABLE: number[] = (() => {
  const values = new Set<number>([0, 25, 50]);
  for (let seg = 1; seg <= 20; seg++) { values.add(seg); values.add(seg * 2); values.add(seg * 3); }
  return Array.from(values).sort((a, b) => b - a);
})();

/** k real dart values (k = 1..3) summing exactly to target, or null. */
function decompose(target: number, k: number): number[] | null {
  if (k === 1) return REACHABLE.includes(target) ? [target] : null;
  for (const v of REACHABLE) {
    if (v > target) continue;
    const rest = decompose(target - v, k - 1);
    if (rest) return [v, ...rest];
  }
  return null;
}

/** Split a scoring total into k legal darts summing exactly to it (stepping down over bogey totals). */
export function splitScore(total: number, k: number): Dart[] {
  if (total <= 0) return Array.from({ length: k }, () => BOT_MISS);
  const target = Math.min(60 * k, total);
  for (let adjust = 0; adjust <= 3 && target - adjust >= 0; adjust++) {
    const hit = decompose(target - adjust, k);
    if (hit) return hit.map(dartForValue);
  }
  return [dartForValue(Math.min(60, target)), ...Array.from({ length: k - 1 }, () => BOT_MISS)];
}

function checkoutDarts(remaining: number): [Dart, Dart, Dart] | null {
  if (remaining === 50) return [BOT_MISS, BOT_MISS, makeDart(25, 2)];
  if (remaining >= 2 && remaining <= 40 && remaining % 2 === 0) return [BOT_MISS, BOT_MISS, makeDart(remaining / 2, 2)];
  if (remaining > 60 && remaining <= 110) {
    const rest = remaining - 60;
    if (rest === 50) return [makeDart(20, 3), BOT_MISS, makeDart(25, 2)];
    if (rest <= 40 && rest % 2 === 0) return [makeDart(20, 3), BOT_MISS, makeDart(rest / 2, 2)];
  }
  if (remaining > 57 && remaining <= 107) {
    const rest = remaining - 57;
    if (rest <= 40 && rest % 2 === 0) return [makeDart(19, 3), BOT_MISS, makeDart(rest / 2, 2)];
  }
  if (remaining % 2 === 1 && remaining >= 3 && remaining <= 41) return [makeDart(1, 1), BOT_MISS, makeDart((remaining - 1) / 2, 2)];
  if (remaining > 100 && remaining <= 170) {
    const r2 = remaining - 120;
    if (r2 === 50) return [makeDart(20, 3), makeDart(20, 3), makeDart(25, 2)];
    if (r2 >= 2 && r2 <= 40 && r2 % 2 === 0) return [makeDart(20, 3), makeDart(20, 3), makeDart(r2 / 2, 2)];
    const r3 = remaining - 117;
    if (r3 >= 2 && r3 <= 40 && r3 % 2 === 0) return [makeDart(20, 3), makeDart(19, 3), makeDart(r3 / 2, 2)];
    const r4 = remaining - 60 - 40;
    if (r4 >= 1 && r4 <= 20) return [makeDart(20, 3), makeDart(r4, 1), makeDart(20, 2)];
  }
  return null;
}

/** Per-dart probability of hitting an aimed double, derived from the bot's per-visit checkout rate. */
export const perDartDoubleRate = (cfg: BotSkill) => 1 - Math.pow(1 - Math.max(0, Math.min(0.99, cfg.checkoutPct)), 1 / 3);

export type BotVisitOptions = { doubleOut: boolean; opened?: boolean; rng?: Random };

/**
 * Plan a bot's three darts for a visit. The scorer still applies every dart
 * through the shared rules, so a plan can never bend the rules.
 */
export function planBotX01Visit(remaining: number, cfg: BotSkill, options: BotVisitOptions): [Dart, Dart, Dart] {
  const rng = options.rng ?? Math.random;
  const opened = options.opened ?? true;
  if (!opened) return planDoubleInVisit(remaining, cfg, options.doubleOut, rng);
  if (remaining <= 170 && rng() < cfg.checkoutPct) {
    const co = checkoutDarts(remaining);
    if (co) return co;
  }
  const minLeft = options.doubleOut ? 2 : 0;
  const maxScore = Math.max(0, Math.min(180, remaining - minLeft));
  const visitScore = Math.max(0, Math.min(maxScore, Math.round(gauss(cfg.avg, cfg.sd, rng))));
  return splitScore(visitScore, 3) as [Dart, Dart, Dart];
}

/** Unopened: aim at D20 dart by dart; once a double lands, the remaining darts score normally. */
function planDoubleInVisit(remaining: number, cfg: BotSkill, doubleOut: boolean, rng: Random): [Dart, Dart, Dart] {
  const p = perDartDoubleRate(cfg);
  const darts: Dart[] = [];
  let left = remaining;
  for (let i = 0; i < 3; i++) {
    const roll = rng();
    if (roll < p && left - 40 >= (doubleOut ? 2 : 0)) {
      darts.push(makeDart(20, 2));
      left -= 40;
      const k = 2 - i;
      if (k > 0) {
        const minLeft = doubleOut ? 2 : 0;
        const max = Math.max(0, Math.min(60 * k, left - minLeft));
        const total = Math.max(0, Math.min(max, Math.round(gauss(cfg.avg * k / 3, cfg.sd * Math.sqrt(k / 3), rng))));
        darts.push(...splitScore(total, k));
      }
      break;
    }
    // A missed double usually lands in the single or outside the wire.
    darts.push(rng() < 0.6 ? makeDart(20, 1) : BOT_MISS);
  }
  return darts as [Dart, Dart, Dart];
}
