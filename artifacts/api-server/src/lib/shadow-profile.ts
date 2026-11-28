/**
 * Shadow Bot profile v2 (pure, unit-tested). Built from every dart a player has
 * thrown on the scorer: practice sessions AND live-scored league matches, so the
 * shadow learns how you play when it counts, and more players unlock it.
 *
 * Instead of one "primary segment + treble %" guess, the shadow replays your
 * real outcomes: when it's scoring it draws from the spread of darts you've
 * actually thrown; on a finish it uses your real hit rate on each double, and
 * your league (pressure) finishing when the other player is waiting on a shot.
 *
 * Eras let you play past versions of yourself: this month, your peak month, a
 * named month, or everything.
 */

export type LoggedDart = { seg: number; mult: number; val: number; phase: "scoring" | "checkout" | string; at: string; source: "practice" | "league" };

export type Era = "all" | "current" | "peak" | `month:${string}`;

export type EraOption = { era: Era; label: string; darts: number; avg: number };

export type ShadowProfileV2 = {
  era: Era; eraLabel: string;
  darts: number; practiceDarts: number; leagueDarts: number;
  computedAvg: number;
  primarySeg: number; treblePct: number; singlePct: number;
  /** Scoring-phase outcomes the shadow samples from: seg 0 = miss. */
  scoringDist: { seg: number; mult: number; n: number }[];
  /** Your hit rate per double (only doubles with enough attempts). */
  doubleRates: Record<string, number>;
  doubleHitPct: number;
  /** Finishing hit rate in league matches, used when the opponent is waiting on a finish. */
  pressureDoubleHitPct: number | null;
  checkoutSegs: number[];
};

export const UNLOCK_DARTS = 250;
export const CURRENT_DAYS = 60;
export const PEAK_MIN_DARTS = 150;
const MIN_DOUBLE_ATTEMPTS = 8;

const monthOf = (iso: string) => iso.slice(0, 7);
const avgOf = (ds: LoggedDart[]) => (ds.length ? Math.round((ds.reduce((s, d) => s + d.val, 0) / ds.length) * 3 * 10) / 10 : 0);
const monthName = (ym: string) => new Date(`${ym}-15T12:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** The eras a player can pick, with their dart counts and averages (months need PEAK_MIN_DARTS). */
export function eraOptions(darts: LoggedDart[], now = new Date()): EraOption[] {
  const out: EraOption[] = [{ era: "all", label: "All-time you", darts: darts.length, avg: avgOf(darts) }];
  const cur = currentWindow(darts, now);
  if (cur.length) out.push({ era: "current", label: "Current you (last 60 days)", darts: cur.length, avg: avgOf(cur) });
  const months = byMonth(darts);
  const peak = peakMonth(months);
  if (peak) out.push({ era: "peak", label: `Peak you (${monthName(peak)})`, darts: months.get(peak)!.length, avg: avgOf(months.get(peak)!) });
  for (const [ym, ds] of [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    if (ds.length >= PEAK_MIN_DARTS) out.push({ era: `month:${ym}`, label: monthName(ym), darts: ds.length, avg: avgOf(ds) });
  }
  return out;
}

function byMonth(darts: LoggedDart[]): Map<string, LoggedDart[]> {
  const m = new Map<string, LoggedDart[]>();
  for (const d of darts) { const k = monthOf(d.at); if (!m.has(k)) m.set(k, []); m.get(k)!.push(d); }
  return m;
}

function peakMonth(months: Map<string, LoggedDart[]>): string | null {
  let best: string | null = null, bestAvg = -1;
  for (const [ym, ds] of months) if (ds.length >= PEAK_MIN_DARTS && avgOf(ds) > bestAvg) { best = ym; bestAvg = avgOf(ds); }
  return best;
}

/** Last 60 days; if that's too thin to play like you, your most recent UNLOCK_DARTS darts instead. */
function currentWindow(darts: LoggedDart[], now: Date): LoggedDart[] {
  const cutoff = new Date(now.getTime() - CURRENT_DAYS * 86400000).toISOString();
  const recent = darts.filter(d => d.at >= cutoff);
  if (recent.length >= UNLOCK_DARTS) return recent;
  return [...darts].sort((a, b) => b.at.localeCompare(a.at)).slice(0, UNLOCK_DARTS);
}

export function dartsForEra(darts: LoggedDart[], era: Era, now = new Date()): { darts: LoggedDart[]; label: string } {
  if (era === "current") return { darts: currentWindow(darts, now), label: "Current you" };
  if (era === "peak") {
    const months = byMonth(darts); const pk = peakMonth(months);
    if (pk) return { darts: months.get(pk)!, label: `Peak you (${monthName(pk)})` };
    return { darts, label: "All-time you" };
  }
  if (era.startsWith("month:")) {
    const ym = era.slice(6); const ds = darts.filter(d => monthOf(d.at) === ym);
    if (ds.length) return { darts: ds, label: monthName(ym) };
  }
  return { darts, label: "All-time you" };
}

export function buildProfile(all: LoggedDart[], era: Era = "all", now = new Date()): ShadowProfileV2 {
  const { darts, label } = dartsForEra(all, era, now);
  const scoring = darts.filter(d => d.phase === "scoring");
  const dist = new Map<string, { seg: number; mult: number; n: number }>();
  for (const d of scoring) {
    const seg = d.mult === 0 || d.val === 0 ? 0 : d.seg;
    const mult = seg === 0 ? 0 : d.mult;
    const k = `${seg}:${mult}`;
    const cur = dist.get(k) ?? { seg, mult, n: 0 };
    cur.n++; dist.set(k, cur);
  }
  const scoringDist = [...dist.values()].sort((a, b) => b.n - a.n);

  // Primary target: the segment with the most scoring darts (trebles + singles), for the older summary fields.
  const bySeg = new Map<number, { t: number; s: number; all: number }>();
  for (const d of scoring) {
    if (!d.seg || d.val === 0) continue;
    const c = bySeg.get(d.seg) ?? { t: 0, s: 0, all: 0 };
    c.all++; if (d.mult === 3) c.t++; if (d.mult === 1) c.s++;
    bySeg.set(d.seg, c);
  }
  const primary = [...bySeg.entries()].sort((a, b) => b[1].all - a[1].all)[0];
  const round2 = (x: number) => Math.round(x * 100) / 100;

  // Doubles: a checkout-phase single or double on segment X counts as an attempt at
  // double X (trebles there are set-up darts, not finishes); a double is the hit.
  const isAttempt = (x: LoggedDart) => x.phase === "checkout" && x.seg > 0 && x.mult !== 3;
  const att = new Map<number, { hit: number; n: number }>();
  for (const d of darts.filter(isAttempt)) {
    const c = att.get(d.seg) ?? { hit: 0, n: 0 };
    c.n++; if (d.mult === 2) c.hit++;
    att.set(d.seg, c);
  }
  const doubleRates: Record<string, number> = {};
  let hits = 0, tries = 0;
  for (const [seg, c] of att) { hits += c.hit; tries += c.n; if (c.n >= MIN_DOUBLE_ATTEMPTS) doubleRates[seg] = round2(c.hit / c.n); }
  const league = darts.filter(d => d.source === "league" && isAttempt(d));
  const lHits = league.filter(d => d.mult === 2).length;
  const checkoutSegs = [...att.entries()].filter(([, c]) => c.hit > 0).sort((a, b) => b[1].hit - a[1].hit).slice(0, 6).map(([s]) => s);

  return {
    era, eraLabel: label,
    darts: darts.length,
    practiceDarts: darts.filter(d => d.source === "practice").length,
    leagueDarts: darts.filter(d => d.source === "league").length,
    computedAvg: avgOf(darts) || 45,
    primarySeg: primary?.[0] ?? 20,
    treblePct: primary ? round2(primary[1].t / primary[1].all) : 0.15,
    singlePct: primary ? round2(primary[1].s / primary[1].all) : 0.55,
    scoringDist,
    doubleRates,
    doubleHitPct: Math.max(0.05, Math.min(0.95, tries ? round2(hits / tries) : 0.18)),
    pressureDoubleHitPct: league.length >= MIN_DOUBLE_ATTEMPTS ? Math.max(0.03, Math.min(0.95, round2(lHits / league.length))) : null,
    checkoutSegs: checkoutSegs.length ? checkoutSegs : [16, 8, 4, 2],
  };
}

/** Where your shadow drops points: what share of your scoring darts land where, against a 60/20/20 "on the treble" ideal. */
export type ScoutLine = { label: string; value: string; tone: "good" | "bad" | "neutral"; drill?: { key: string; name: string; solo: boolean } };
/** Practice games that work on each weak spot (solo-playable). */
const DRILLS = {
  trebles: { key: "high_score", name: "High Score", solo: true },
  accuracy: { key: "round_the_clock", name: "Round the Clock", solo: true },
  doubles: { key: "bobs_27", name: "Bob's 27", solo: true },
  double: { key: "pick_a_double", name: "Pick a Double", solo: false },
  pressure: { key: "checkout_challenge", name: "Checkout Challenge", solo: false },
};
export function scoutingReport(p: ShadowProfileV2): ScoutLine[] {
  const total = p.scoringDist.reduce((s, d) => s + d.n, 0) || 1;
  const share = (f: (d: { seg: number; mult: number }) => boolean) => Math.round((p.scoringDist.filter(f).reduce((s, d) => s + d.n, 0) / total) * 100);
  const trebles = share(d => d.mult === 3), misses = share(d => d.seg === 0), onPrimary = share(d => d.seg === p.primarySeg);
  const doubles = Object.entries(p.doubleRates).sort((a, b) => b[1] - a[1]);
  const out: ScoutLine[] = [
    { label: `On ${p.primarySeg === 25 ? "the bull" : p.primarySeg}`, value: `${onPrimary}% of scoring darts`, tone: onPrimary >= 50 ? "good" : "neutral" },
    { label: "Trebles", value: `${trebles}% of scoring darts`, tone: trebles >= 20 ? "good" : trebles < 10 ? "bad" : "neutral", ...(trebles < 10 ? { drill: DRILLS.trebles } : {}) },
    { label: "Off the board", value: `${misses}%`, tone: misses >= 5 ? "bad" : "neutral", ...(misses >= 5 ? { drill: DRILLS.accuracy } : {}) },
    { label: "Finishing", value: `${Math.round(p.doubleHitPct * 100)}% of darts at a double`, tone: p.doubleHitPct >= 0.3 ? "good" : p.doubleHitPct < 0.15 ? "bad" : "neutral", ...(p.doubleHitPct < 0.15 ? { drill: DRILLS.doubles } : {}) },
  ];
  if (doubles.length) out.push({ label: "Best double", value: `D${doubles[0][0]} (${Math.round(doubles[0][1] * 100)}%)`, tone: "good" });
  if (doubles.length > 1) out.push({ label: "Worst double", value: `D${doubles[doubles.length - 1][0]} (${Math.round(doubles[doubles.length - 1][1] * 100)}%)`, tone: "bad", drill: DRILLS.double });
  if (p.pressureDoubleHitPct != null) {
    const diff = Math.round((p.pressureDoubleHitPct - p.doubleHitPct) * 100);
    out.push({ label: "Under pressure", value: diff === 0 ? "Finishes the same in league matches" : `${Math.abs(diff)} points ${diff > 0 ? "better" : "worse"} finishing in league matches`, tone: diff >= 0 ? "good" : "bad", ...(diff < 0 ? { drill: DRILLS.pressure } : {}) });
  }
  return out;
}
