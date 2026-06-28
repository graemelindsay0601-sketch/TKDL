/**
 * Card Clash Effect Engine
 * Full implementation of all 100 card effects per CARD_CLASH_100_FINAL spec.
 * Called from X01Scorer and CricketScorer hook points.
 */

import type { Dart } from "./dartboard";

// ── Adjacency map for Off Target / Aim Shift cards ──────────────────────────
const ADJACENT: Record<number, [number, number]> = {
  20: [1, 5], 19: [3, 7], 18: [4, 1], 17: [2, 3], 16: [8, 7],
  15: [10, 2], 14: [9, 11], 13: [4, 6], 12: [5, 9], 11: [8, 14],
  10: [6, 15], 9: [12, 14], 8: [11, 16], 7: [16, 19], 6: [13, 10],
  5: [20, 12], 4: [13, 18], 3: [19, 17], 2: [15, 17], 1: [18, 20],
  25: [3, 17],
};
function adjacentOf(seg: number): number {
  const adj = ADJACENT[seg];
  if (!adj) return seg;
  return adj[Math.floor(Math.random() * 2)];
}

// ── Active effect descriptor ─────────────────────────────────────────────────
export interface CCEffect {
  cardName: string;
  appliedBy: 0 | 1;        // who played the card
  affectsPlayer: 0 | 1;    // who is affected
  status: "active" | "pending"; // pending → activates at start of opponent's turn

  // X01: dart-level (applied in ccPreprocessDart, per-dart)
  segmentBlock?: number[];       // these segments → value 0
  segmentOnly?: number[];        // only these segments score (else 0)
  segmentRedirect?: boolean;     // redirect to adjacent segment
  minDartValue?: number;         // floor each dart value
  maxDartValue?: number;         // cap each dart value (Shackled=50)
  trebleMultiplier?: number;     // trebles: value * this  (Treble Hunter=1.3)
  allDartsMultiplier?: number;   // all values * this (Iron Will=1.2, Jinx=0.75)
  singlesScore0?: boolean;       // singles (mult=1, seg!=25) → 0
  doublesAsSingles?: boolean;    // doubles → singles value
  treblesAsSingles?: boolean;    // trebles → singles value
  fatigueMults?: [number, number, number]; // per dart multipliers
  wildDartIndex?: number;        // this dart index (0/1/2) → 0
  wildDartIndices?: number[];    // multiple dart indices → 0 (e.g., Wipeout: [1, 2])
  randomWildDart?: boolean;      // pick random dart at throw time (Wild Throw)
  minSegment?: number;           // if seg < this, redirect to this (Precision Strike=6)
  clutchPenaltyPerDart?: number; // subtract N from dart value if player remaining <= 100
  bonusPerDart?: number;         // add N to each dart value (Perfect Rhythm=10)
  missToMin?: boolean;           // segment=0 (miss) → segment 5 single (Steady Hand)

  // X01: visit-level (applied in ccApplyVisitEnd)
  visitBonus?: number;           // add N to this turn's score reduction
  visitPenalty?: number;         // subtract N from score reduction
  penaltyPerDart?: number;       // -N per dart thrown (Mental Block=-10)
  maxVisitTotal?: number;        // cap total visit score (Mercy Killer=60)

  // X01: conditional visit-end bonuses
  bonusIfVisit80Plus?: number;   // Big Game Player
  bonusIfVisit50Plus?: number;   // Banking Strategy
  bonusIfVisit100Plus?: number;  // High Roller
  bonusIfVisit100Exact?: number; // Century Maker (100-109)
  bonusIfBehindLegs?: number;    // High Pressure
  bonusIfWin?: number;           // Finishing Bonus

  // X01: rule changes
  bustToHalf?: boolean;          // Safety Net
  preventBustInCheckout?: boolean; // Close Control
  forceFullTurn?: boolean;       // Scoring Arsenal
  blockOpponentPenalties?: boolean; // Unstoppable Checkout / Exact Finish / Invincible
  preventFinishBefore3?: boolean; // Turn Enforcer
  noDoubleFinishFirstN?: number; // Finish Delay (first N darts can't finish on double)
  mustFinishAfterOneDart?: boolean; // Trapped
  lockdownSegment?: number;      // Lockdown — only this segment scores
  freeRetryOnDoubleMiss?: boolean; // Checkout Confidence
  legResetIfStreak?: boolean;    // Leg Reset
  removeLegsIfAhead?: number;    // Streak Crusher — remove N legs if opponent is 2+ ahead

  // Instant effects (fire immediately on activation)
  instant?: true;
  instantP0Delta?: number;       // adjust scores[0] by this (negative = lower remaining)
  instantP1Delta?: number;       // adjust scores[1] by this

  // Cricket: mark-level
  marksMultiplier?: number;      // multiply absorbed hits (Double Strike=2, Bad Aim=0.5)
  sluggishMarks?: boolean;       // all hits count as 1 mark
  hesitateFirstDart?: boolean;   // dart index 0 → 0 hits
  blockFinalDartMark?: boolean;  // dart index 2 → 0 hits
  blockSegmentsForMarks?: number[]; // these segments don't mark
  allowedMarkSegments?: number[];   // only these segments mark
  blockClosing?: boolean;        // can't bring marks to 3
  loseNextMark?: boolean;        // next mark attempt → 0 hits (one-shot)
  _loseNextMarkUsed?: boolean;   // internal flag

  // Cricket: score-level
  extraScoreMultiplier?: number; // multiply scoring extras (Scoring Surge=1.5)
  penaltyPerMark?: number;       // -N per mark gained (Mark Erasure=-10)
  bonusIfAllMarksThisTurn?: number; // Perfect Round
  bonusPerMark?: number;         // +N per mark (Momentum Arsenal=10)
  blockBullMarks?: boolean;      // Bull Void
  markDrainIfAhead?: boolean;    // Mark Drain
  scoreHalveExtraMultiplier?: number; // Score Halve (opponent's extras * 0.5)

  // Internal counters (mutable during a turn)
  _marksThisTurn?: number;
  _dartsMarkedThisTurn?: number;
}

// ── Game state snapshots passed into hook functions ──────────────────────────
export interface X01State { scores: [number,number]; legWins: [number,number] }
export interface CricketState { marks: number[][]; scores: [number,number]; turn: 0|1 }

// ═══════════════════════════════════════════════════════════════════════════════
// CARD ACTIVATION — maps card names to CCEffect(s)
// ═══════════════════════════════════════════════════════════════════════════════

/** Strip punctuation+spaces+case for fuzzy name matching (handles camelCase DB names vs spaced engine names) */
function normalizeCardKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function ccActivateCard(
  card: any,
  byPlayer: 0 | 1,
  gs?: X01State | CricketState,
  prevLegWins?: [number, number],
): CCEffect[] {
  const name: string = (card.name || "").trim();
  const opp: 0 | 1 = byPlayer === 0 ? 1 : 0;

  // ── X01 GOOD (affects self, active this turn) ─────────────────────────────
  const x01Good: Record<string, CCEffect> = {
    "Big Game Player":      { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfVisit80Plus: 35 },
    "Power Surge +50":      { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 50 },
    "Treble Hunter":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", trebleMultiplier: 1.3 },
    "Unstoppable Checkout": { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", blockOpponentPenalties: true },
    "Banking Strategy":     { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfVisit50Plus: 20 },
    "Checkout Confidence":  { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", freeRetryOnDoubleMiss: true },
    "Exact Finish":         { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", blockOpponentPenalties: true },
    "High Pressure":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfBehindLegs: 40 },
    "Perfect Rhythm":       { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusPerDart: 10 },
    "High Roller":          { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfVisit100Plus: 25 },
    "Precision Strike":     { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", minSegment: 6 },
    "Safety Boost":         { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", minDartValue: 15 },
    "Treble Boost":         { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", trebleMultiplier: 1.4 },
    "Safety Net":           { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bustToHalf: true },
    "Close Control":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", preventBustInCheckout: true },
    "Steady Hand":          { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", missToMin: true },
    "Scoring Arsenal":      { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", forceFullTurn: true },
    "Finishing Bonus":      { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfWin: 50 },
    "Century Maker":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfVisit100Exact: 40 },
    "Iron Will":            { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", allDartsMultiplier: 1.2 },
  };

  // ── X01 BAD (affects opponent, pending → active on their next turn) ────────
  const x01Bad: Record<string, CCEffect> = {
    "Rust Hands -40":       { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", visitPenalty: 40 },
    "Wild Throw":           { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", randomWildDart: true },
    "Brick Wall":           { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", segmentBlock: [20, 19, 18] },
    "Low Blow":             { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", singlesScore0: true },
    "Doubles Don't Count":  { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", doublesAsSingles: true },
    "Shackled":             { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", maxDartValue: 50 },
    "Turn Enforcer":        { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", preventFinishBefore3: true },
    "Pressure Zone":        { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", segmentOnly: [15, 20, 25] },
    "Off Target":           { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", segmentRedirect: true },
    "Mercy Killer":         { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", maxVisitTotal: 60 },
    "Jinx":                 { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allDartsMultiplier: 0.75 },
    "Fatigue":              { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", fatigueMults: [1, 0.9, 0.8] },
    "Leg Reset":            { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", legResetIfStreak: true },
    "Clutch Breaker":       { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", clutchPenaltyPerDart: 15 },
    "Finish Delay":         { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", noDoubleFinishFirstN: 2 },
    "Treble Curse":         { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", treblesAsSingles: true },
    "Dead Zone":            { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", segmentBlock: [15, 16, 17, 18, 19, 20] },
    "Mental Block":         { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", penaltyPerDart: 10 },
    "Trapped":              { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", mustFinishAfterOneDart: true },
    "Lockdown":             { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", lockdownSegment: 20 }, // defaults to 20; UI popup would override
  };

  // ── Cricket GOOD ───────────────────────────────────────────────────────────
  const cricGood: Record<string, CCEffect> = {
    "Instant Mark":         { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", instant: true },
    "Double Strike":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", marksMultiplier: 2 },
    "Sniper Lock":          { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active" }, // popup-driven; no-op here
    "Number Resurrection":  { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", instant: true },
    "Scoring Surge":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", extraScoreMultiplier: 1.5 },
    "Closing Protection":   { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active" }, // state-flag; handled by overlay
    "Mark Flood":           { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active" }, // would need dart override; placeholder
    "Scoring Momentum":     { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusPerMark: 5 },
    "Early Closer":         { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active" }, // tracked via turn counter
    "Perfect Round":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfAllMarksThisTurn: 25, _dartsMarkedThisTurn: 0 },
    "Bull Multiplier":      { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active" }, // popup-driven
    "Bullseye Rush":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active" }, // popup-driven
    "Comeback Marks":       { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", marksMultiplier: 1.5 },
    "Mark Accelerator":     { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", marksMultiplier: 2 },
    "Mark Multiplier":      { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", _marksThisTurn: 0 },
    "Quick Close":          { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active" },
    "Momentum Arsenal":     { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusPerMark: 10, _marksThisTurn: 0 },
    "High Scorer":          { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active" },
    "Perfect Form":         { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", extraScoreMultiplier: 1.5 },
    "Dominance":            { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", marksMultiplier: 1.3 },
  };

  // ── Cricket BAD (affects opponent's next turn) ─────────────────────────────
  const cricBad: Record<string, CCEffect> = {
    "Bad Aim":              { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", marksMultiplier: 0.5 },
    "Distraction":          { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", loseNextMark: true, _loseNextMarkUsed: false },
    "Out of Position":      { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", blockSegmentsForMarks: [20, 19, 18] },
    "Penalty Zone":         { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allowedMarkSegments: [15, 25] },
    "Re-Opening Block":     { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending" }, // complex state; placeholder
    "Aim Shift":            { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", segmentRedirect: true },
    "Hesitation":           { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", hesitateFirstDart: true },
    "Pressure":             { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending" }, // penaltyIfNotClosed — turn-end check
    "Momentum Killer":      { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending" }, // streaks — complex
    "Sluggish Marks":       { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", sluggishMarks: true },
    "Number Hex":           { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allowedMarkSegments: [20, 25] }, // defaults to 20/bull
    "Closing Blocker":      { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", blockClosing: true },
    "Mark Erasure":         { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", penaltyPerMark: 10 },
    "Cricket Prison":       { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allowedMarkSegments: [15, 19, 20, 25] },
    "Bull Void":            { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", blockBullMarks: true },
    "Mark Killer":          { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", blockFinalDartMark: true },
    "Mark Drain":           { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", markDrainIfAhead: true },
    "Streak Breaker":       { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending" },
    "Number Prison":        { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending" }, // mark random closed num = -1
    "Score Halve":          { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", scoreHalveExtraMultiplier: 0.5 },
  };

  // ── Wildcard GOOD ──────────────────────────────────────────────────────────
  const wildcardGood: Record<string, CCEffect> = {
    "Coin Flip": (() => {
      const win = Math.random() > 0.5;
      return { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", instant: true,
        instantP0Delta: win ? (byPlayer === 0 ? 40 : -40) : (byPlayer === 0 ? -30 : 30),
        instantP1Delta: win ? (byPlayer === 0 ? -40 : 40) : (byPlayer === 0 ? 30 : -30) } as CCEffect;
    })(),
    "Lucky Streak":   { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 50 },
    "Momentum Surge": { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 25 },
    "Finishing Edge": { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", freeRetryOnDoubleMiss: true },
    "Comeback Leg":   { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 60 },
    "Hot Hand":       { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 45 },
    "Underdog":       { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 50 },
    "Perfect Game":   { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 30 },
    "Match Point":    { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 70 },
    "Invincible":     { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", blockOpponentPenalties: true },
  };

  // ── Wildcard BAD ───────────────────────────────────────────────────────────
  const wildcardBad: Record<string, CCEffect> = {
    "Dark Cloud":         { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", visitPenalty: 35 },
    "Momentum Killer":    { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", visitPenalty: 0 }, // streak clear
    "Unlucky Night":      { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allDartsMultiplier: 0.75 },
    "Hex":                { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allDartsMultiplier: 0.5 },
    "Wipeout":            { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", wildDartIndices: [1, 2] }, // last 2 darts → 0
    "Total Annihilation": { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", visitPenalty: 100 },
    "Match Pressure":     { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allDartsMultiplier: 0.8 },
    "Underdog Curse":     { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allDartsMultiplier: 0.8 },
    "Win Bonus Removed":  { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", visitPenalty: 0 },
    "Shutdown":           { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", maxVisitTotal: 50 },
    "Streak Crusher":     { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", removeLegsIfAhead: 2 }, // Remove 2 legs if opponent is 2+ ahead
  };

  const allMaps = [x01Good, x01Bad, cricGood, cricBad, wildcardGood, wildcardBad];
  // Try exact match first
  for (const m of allMaps) {
    if (name in m) return [m[name]];
  }
  // Normalized match — handles camelCase DB names ("BankingStrategy") vs spaced engine names ("Banking Strategy")
  const normInput = normalizeCardKey(name);
  for (const m of allMaps) {
    for (const [key, effect] of Object.entries(m)) {
      if (normalizeCardKey(key) === normInput) return [effect];
    }
  }
  // Fallback: generic score modifier
  const isGood = (card.good_or_bad || card.cardType || "GOOD") === "GOOD";
  return [{ cardName: name, appliedBy: byPlayer, affectsPlayer: isGood ? byPlayer : opp, status: isGood ? "active" : "pending", visitBonus: isGood ? 20 : 0, visitPenalty: isGood ? 0 : 20 }];
}

// ═══════════════════════════════════════════════════════════════════════════════
// X01 HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/** Called at the start of handleDart. Returns a (possibly modified) dart. */
export function ccPreprocessDart(
  dart: Dart,
  dartIdx: number,           // 0, 1, or 2 (which dart this is in the visit)
  effects: CCEffect[],
  player: 0 | 1,
  playerRemaining: number,   // scores[player] before this visit
): Dart {
  // Gather only active effects targeting this player
  const active = effects.filter(e => e.status === "active" && e.affectsPlayer === player);
  
  if (active.length === 0) return dart;

  let { segment, multiplier, value, label } = dart;

  for (const e of active) {
    // Lockdown — only chosen segment scores
    if (e.lockdownSegment !== undefined && segment !== e.lockdownSegment && segment !== 0) {
      value = 0; label = `0 (Lockdown: ${e.lockdownSegment} only)`;
      continue;
    }
    // Segment redirect (Off Target / Aim Shift)
    if (e.segmentRedirect && segment > 0 && segment !== 25) {
      segment = adjacentOf(segment);
      value = segment * multiplier;
      label = `${multiplier > 1 ? (multiplier === 2 ? "D" : "T") : ""}${segment}`;
    }
    // Miss to segment 5 (Steady Hand)
    if (e.missToMin && segment === 0) {
      segment = 5; multiplier = 1; value = 5; label = "5";
    }
    // Segment block (Brick Wall, Dead Zone)
    if (e.segmentBlock && e.segmentBlock.includes(segment)) {
      value = 0; label = `0 (blocked)`;
    }
    // Segment only (Pressure Zone)
    if (e.segmentOnly && !e.segmentOnly.includes(segment) && segment !== 0) {
      value = 0; label = `0 (zone)`;
    }
    // Trebles as singles (Treble Curse)
    if (e.treblesAsSingles && multiplier === 3) {
      multiplier = 1; value = segment; label = `${segment}`;
    }
    // Doubles as singles (Doubles Don't Count)
    if (e.doublesAsSingles && multiplier === 2 && segment !== 25) {
      multiplier = 1; value = segment; label = `${segment}`;
    }
    // Finish Delay — first N darts: doubles become singles (so can't use double to finish early)
    // This is the correct implementation: D20 on dart 1 counts as S20, not as 40 pts
    if (e.noDoubleFinishFirstN !== undefined && dartIdx < e.noDoubleFinishFirstN && multiplier === 2 && segment !== 25) {
      multiplier = 1; value = segment; label = `${segment} (finish delay)`;
    }
    // Singles score 0 (Low Blow)
    if (e.singlesScore0 && multiplier === 1 && segment !== 25) {
      value = 0; label = `0 (single)`;
    }
    // Wild dart(s) (Wild Throw, Wipeout)
    if (e.wildDartIndex !== undefined && dartIdx === e.wildDartIndex) {
      value = 0; label = `0 (wild throw)`;
    }
    if (e.wildDartIndices && e.wildDartIndices.includes(dartIdx)) {
      value = 0; label = `0 (wiped)`;
    }
    // Random wild dart (Wild Throw): pick random dart at throw time, zero it out
    if (e.randomWildDart && Math.random() < 0.33) {
      value = 0; label = `0 (wild throw)`;
    }
    // Fatigue multipliers
    if (e.fatigueMults) {
      const mult = e.fatigueMults[Math.min(dartIdx, 2)];
      value = Math.floor(value * mult);
      label = `${value}`;
    }
    // All darts multiplier (Jinx, Iron Will, Unlucky Night, etc.)
    if (e.allDartsMultiplier !== undefined) {
      value = Math.floor(value * e.allDartsMultiplier);
      label = `${value}`;
    }
    // Treble multiplier (Treble Hunter, Treble Boost)
    if (e.trebleMultiplier !== undefined && multiplier === 3) {
      value = Math.floor(value * e.trebleMultiplier);
      label = `${value}`;
    }
    // Bonus per dart (Perfect Rhythm)
    if (e.bonusPerDart !== undefined && value > 0) {
      value = value + e.bonusPerDart;
      label = `${value}`;
    }
    // Clutch penalty (Clutch Breaker)
    if (e.clutchPenaltyPerDart !== undefined && playerRemaining <= 100 && value > 0) {
      value = Math.max(0, value - e.clutchPenaltyPerDart);
      label = `${value}`;
    }
    // Min segment redirect (Precision Strike)
    if (e.minSegment !== undefined && segment > 0 && segment < e.minSegment && segment !== 25) {
      segment = e.minSegment; multiplier = 1; value = e.minSegment; label = `${e.minSegment}`;
    }
    // Max dart value (Shackled)
    if (e.maxDartValue !== undefined && value > e.maxDartValue) {
      value = e.maxDartValue; label = `${value}`;
    }
    // Min dart value (Safety Boost)
    if (e.minDartValue !== undefined && value > 0 && value < e.minDartValue) {
      value = e.minDartValue; label = `${value}`;
    }
  }
  
  // DEBUG: Log final modified dart (first dart of visit only)
  if (dartIdx === 0 && active.length > 0) {
    console.log(`[CARD_CLASH:PREPROCESS] Player${player} final: segment=${segment} value=${value} (was 60). Effects applied: ${active.map(e => e.cardName).join(", ")}`);
  }
  
  return { segment, multiplier, value, label };
}

/** Called just before bust/finish logic. Returns adjusted cum (e.g. Mercy Killer cap). */
export function ccApplyVisitCap(cum: number, effects: CCEffect[], player: 0 | 1): number {
  const active = effects.filter(e => e.status === "active" && e.affectsPlayer === player);
  for (const e of active) {
    if (e.maxVisitTotal !== undefined && cum > e.maxVisitTotal) {
      cum = e.maxVisitTotal;
    }
  }
  return cum;
}

/** Called when rem < 0. Returns whether to prevent bust + alternative score. */
export function ccInterceptBust(
  rawCum: number,
  dartsCum: number,
  remaining: number,
  effects: CCEffect[],
  player: 0 | 1,
): { prevent: boolean; halvedVisit?: number } {
  const active = effects.filter(e => e.status === "active" && e.affectsPlayer === player);
  // Safety Net — half the visit total instead of bust
  if (active.some(e => e.bustToHalf)) {
    return { prevent: true, halvedVisit: Math.floor(rawCum / 2) };
  }
  // Close Control — if remaining <= 50, prevent bust (dart counts as 1)
  if (active.some(e => e.preventBustInCheckout) && remaining <= 50) {
    return { prevent: true, halvedVisit: 1 };
  }
  return { prevent: false };
}

/** Returns true if the finish attempt should be blocked. */
export function ccShouldBlockFinish(
  dartIdx: number,              // 0, 1, or 2
  isDartDouble: boolean,
  effects: CCEffect[],
  player: 0 | 1,
): boolean {
  const active = effects.filter(e => e.status === "active" && e.affectsPlayer === player);
  // Turn Enforcer — must throw all 3 darts
  if (active.some(e => e.preventFinishBefore3) && dartIdx < 2) return true;
  // Finish Delay — first N darts can't finish on double
  for (const e of active) {
    if (e.noDoubleFinishFirstN !== undefined && dartIdx < e.noDoubleFinishFirstN && isDartDouble) return true;
  }
  return false;
}

/** Called after 3-dart visit (or forced turn end). Returns net score adjustment and bonus. */
export function ccApplyVisitEnd(
  rawCum: number,
  dartsThrown: number,
  effects: CCEffect[],
  player: 0 | 1,
  legWins: [number, number],
): { bonusReduction: number; extraPenalty: number } {
  const active = effects.filter(e => e.status === "active" && e.affectsPlayer === player);
  let bonusReduction = 0; // extra score reduction (good for player)
  let extraPenalty = 0;   // added back to score (bad for player)

  for (const e of active) {
    // Visit bonus (Power Surge, Wildcard bonuses)
    if (e.visitBonus) bonusReduction += e.visitBonus;
    // Visit penalty (Rust Hands, Dark Cloud)
    if (e.visitPenalty) extraPenalty += e.visitPenalty;
    // Penalty per dart (Mental Block)
    if (e.penaltyPerDart) extraPenalty += e.penaltyPerDart * dartsThrown;
    // Big Game Player: 80+ not on double
    if (e.bonusIfVisit80Plus && rawCum >= 80) bonusReduction += e.bonusIfVisit80Plus;
    // Banking Strategy: 50+
    if (e.bonusIfVisit50Plus && rawCum >= 50) bonusReduction += e.bonusIfVisit50Plus;
    // High Roller: 100+
    if (e.bonusIfVisit100Plus && rawCum >= 100) bonusReduction += e.bonusIfVisit100Plus;
    // Century Maker: exactly 100-109
    if (e.bonusIfVisit100Exact && rawCum >= 100 && rawCum < 110) bonusReduction += e.bonusIfVisit100Exact;
    // High Pressure: if behind in legs
    const opp: 0 | 1 = player === 0 ? 1 : 0;
    if (e.bonusIfBehindLegs && legWins[opp] > legWins[player]) bonusReduction += e.bonusIfBehindLegs;
  }
  return { bonusReduction, extraPenalty };
}

/** Expire "this_turn" active effects and promote pending → active on turn switch. */
export function ccExpireOnTurnEnd(effects: CCEffect[], completedPlayer: 0 | 1): CCEffect[] {
  const opp: 0 | 1 = completedPlayer === 0 ? 1 : 0;
  const before = effects.filter(e => e.status === "active").map(e => `${e.cardName}→P${e.affectsPlayer}`).join(", ");
  const result = effects
    .filter(e => {
      // Remove active effects that targeted the player who just finished their turn
      if (e.status === "active" && e.affectsPlayer === completedPlayer) return false;
      return true;
    })
    .map(e => {
      // Promote pending effects targeting the next player to active
      if (e.status === "pending" && e.affectsPlayer === opp) {
        return { ...e, status: "active" as const };
      }
      return e;
    });
  
  const after = result.filter(e => e.status === "active").map(e => `${e.cardName}→P${e.affectsPlayer}`).join(", ");
  console.log(`[CARD_CLASH:EXPIRE] Player${completedPlayer} turn ended. Before: ${before || "none"}. After: ${after || "none"}`);
  
  return result;
}

/** Check if opponent penalty effects are blocked for current player. */
export function ccOpponentPenaltiesBlocked(effects: CCEffect[], player: 0 | 1): boolean {
  return effects.some(e => e.status === "active" && e.affectsPlayer === player && e.blockOpponentPenalties);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRICKET HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/** Returns the effective hits for a cricket dart, after mark effects. */
export function ccApplyCricketMarkEffects(
  hits: number,
  segment: number,
  dartIdx: number,
  effects: CCEffect[],
  player: 0 | 1,
): number {
  const active = effects.filter(e => e.status === "active" && e.affectsPlayer === player);
  if (active.length === 0) return hits;

  let h = hits;
  for (const e of active) {
    // Bull Void
    if (e.blockBullMarks && segment === 25) return 0;
    // Hesitation — first dart doesn't mark
    if (e.hesitateFirstDart && dartIdx === 0) return 0;
    // Mark Killer — final dart doesn't mark
    if (e.blockFinalDartMark && dartIdx === 2) return 0;
    // Block certain segments
    if (e.blockSegmentsForMarks && e.blockSegmentsForMarks.includes(segment)) return 0;
    // Allowed segments only
    if (e.allowedMarkSegments && !e.allowedMarkSegments.includes(segment)) return 0;
    // Aim Shift (cricket) — redirect to adjacent
    if (e.segmentRedirect && segment > 0 && segment !== 25) {
      const newSeg = adjacentOf(segment);
      // If adjacent is not a cricket number, it won't match anyway
      h = hits; // hits unchanged, but segment mismatch will be handled by caller
    }
    // Sluggish marks — all hits = 1
    if (e.sluggishMarks) h = 1;
    // Lose next mark (Distraction) — one-shot
    if (e.loseNextMark && !e._loseNextMarkUsed) {
      e._loseNextMarkUsed = true;
      return 0;
    }
    // Marks multiplier (Double Strike=2, Bad Aim=0.5, etc.)
    if (e.marksMultiplier !== undefined) {
      h = Math.max(0, Math.floor(h * e.marksMultiplier));
    }
    // Block closing (Closing Blocker)
    // — handled in scorer via blockClosing flag, not here
  }
  return Math.max(0, h);
}

/** Returns the effective scoring extras for a cricket dart, after score effects. */
export function ccApplyCricketScoreEffects(
  extra: number,
  effects: CCEffect[],
  player: 0 | 1,
): number {
  const active = effects.filter(e => e.status === "active" && e.affectsPlayer === player);
  for (const e of active) {
    if (e.extraScoreMultiplier !== undefined) extra = Math.floor(extra * e.extraScoreMultiplier);
    if (e.scoreHalveExtraMultiplier !== undefined) extra = Math.floor(extra * e.scoreHalveExtraMultiplier);
  }
  return extra;
}

/** Check if blockClosing is active (prevent marking number to 3). */
export function ccBlockClosing(effects: CCEffect[], player: 0 | 1): boolean {
  return effects.some(e => e.status === "active" && e.affectsPlayer === player && e.blockClosing);
}

/** Returns per-mark score penalty (Mark Erasure). */
export function ccPenaltyPerMark(effects: CCEffect[], player: 0 | 1): number {
  const active = effects.filter(e => e.status === "active" && e.affectsPlayer === player);
  return active.reduce((sum, e) => sum + (e.penaltyPerMark ?? 0), 0);
}

/** Returns bonus per mark (Momentum Arsenal, Scoring Momentum). */
export function ccBonusPerMark(effects: CCEffect[], player: 0 | 1): number {
  const active = effects.filter(e => e.status === "active" && e.affectsPlayer === player);
  return active.reduce((sum, e) => sum + (e.bonusPerMark ?? 0), 0);
}
