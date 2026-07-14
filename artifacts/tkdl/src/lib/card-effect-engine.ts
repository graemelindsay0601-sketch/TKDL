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

// ── Cricket card constants and helpers ──────────────────────────────────────────
export const CARD_CLASH_CRICKET_NUMS = [20, 19, 18, 17, 16, 15, 25] as const;

function firstOpenCricketSegment(marks?: number[]): number {
  if (!marks) return 20;
  for (let i = 0; i < CARD_CLASH_CRICKET_NUMS.length; i += 1) {
    if ((marks[i] ?? 0) < 3) return CARD_CLASH_CRICKET_NUMS[i];
  }
  return 20;
}

// BUGFIX 311/312: Bull Multiplier/Bullseye Rush need N open segments to auto-mark.
function firstNOpenCricketSegments(marks: number[] | undefined, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < CARD_CLASH_CRICKET_NUMS.length && out.length < n; i += 1) {
    if ((marks?.[i] ?? 0) < 3) out.push(CARD_CLASH_CRICKET_NUMS[i]);
  }
  return out;
}

// BUGFIX 304: Number Resurrection needs a closed (opponent) number to reopen.
function firstClosedCricketSegmentIdx(marks?: number[]): number {
  if (!marks) return -1;
  for (let i = 0; i < CARD_CLASH_CRICKET_NUMS.length; i += 1) {
    if ((marks[i] ?? 0) >= 3) return i;
  }
  return -1;
}

function cricketMarksFor(gs: X01State | CricketState | undefined, player: 0 | 1): number[] | undefined {
  const maybe = gs as CricketState | undefined;
  return Array.isArray(maybe?.marks?.[player]) ? maybe!.marks[player] : undefined;
}

// ── Active effect descriptor ─────────────────────────────────────────────────
export interface CCEffect {
  cardName: string;
  appliedBy: 0 | 1;        // who played the card
  affectsPlayer: 0 | 1;    // who is affected
  status: "active" | "pending" | "deferred_next_turn" | "deferred_next_leg" | "expired"; // pending → activates at start of opponent's turn

  // ── Deferred application ─────────────────────────────────────────────────────
  // When a bonus needs to apply on a future turn/leg, we defer it with flags.
  // At turn/leg end, effects are re-evaluated and re-scheduled as needed.
  deferBonusToNextTurn?: boolean;   // Banking Strategy: apply bonus on my next turn
  deferPenaltyToNextTurn?: boolean; // (for opponent penalties on their next turn - uses "pending" status)
  deferBonusToNextLeg?: boolean;    // Big Game Player: apply bonus on my next leg
  deferPenaltyToNextLeg?: boolean;  // Dark Cloud, Total Annihilation: apply penalty on opponent's next leg
  
  // Duration flags for expiration
  legDuration?: boolean;            // Don't expire at turn end, only at leg end (e.g., Big Game Player bonus)
  finalLegOnly?: boolean;           // Only activate in final leg of match (Match Pressure)

  // X01: dart-level (applied in ccPreprocessDart, per-dart)
  segmentBlock?: number[];       // these segments → value 0
  segmentOnly?: number[];        // only these segments score (else 0)
  segmentRedirect?: boolean;     // redirect to adjacent segment
  minDartValue?: number;         // floor each dart value
  maxDartValue?: number;         // cap each dart value (Shackled=50)
  trebleMultiplier?: number;     // trebles: value * this  (Treble Hunter=1.3)
  oneShotTrebleMultiplier?: boolean; // Treble Hunter: only first treble this turn gets 1.3x
  allDartsMultiplier?: number;   // all values * this (Iron Will=1.2, Jinx=0.75)
  singlesScore0?: boolean;       // singles (mult=1, seg!=25) → 0
  doublesAsSingles?: boolean;    // doubles → singles value
  treblesAsSingles?: boolean;    // trebles → singles value
  fatigueMults?: [number, number, number]; // per dart multipliers
  wildDartIndex?: number;        // which dart becomes miss (0, 1, or 2 - picked once at activation)
  wildDartIndices?: number[];    // multiple dart indices → 0 (e.g., Wipeout: [1, 2])
  randomWildDart?: boolean;      // pick random dart at throw time (Wild Throw)
  minSegment?: number;           // if seg < this, redirect to this (Precision Strike=6)
  clutchPenaltyPerDart?: number; // subtract N from dart value if player remaining <= 100
  bonusPerDart?: number;         // add N to each dart value (Perfect Rhythm=10)
  missToMin?: boolean;           // segment=0 (miss) → segment 5 single (Steady Hand)

  // X01: visit-level (applied in ccApplyVisitEnd)
  visitBonus?: number;           // add N to this turn's score reduction
  visitPenalty?: number;         // subtract N from score reduction
  bonusRemoval?: boolean;        // Win Bonus Removed (609): remove opponent bonuses
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
  checkoutOnly?: boolean;           // Only active when on double-out (Unstoppable Checkout)
  preventFinishBefore3?: boolean; // Turn Enforcer
  noDoubleFinishFirstN?: number; // Finish Delay (first N darts can't finish on double)
  mustFinishAfterOneDart?: boolean; // Trapped
  lockdownSegment?: number;      // Lockdown — only this segment scores
  freeRetryOnDoubleMiss?: boolean; // Checkout Confidence
  legResetIfStreak?: boolean;    // Leg Reset
  removeLegsIfAhead?: number;    // Streak Crusher — remove N legs if opponent is 2+ ahead

  // Instant effects (fire immediately on activation)
  instant?: true;
  instantP0Delta?: number;       // adjust scores[0] by this (DEPRECATED - use mode-specific fields)
  instantP1Delta?: number;       // adjust scores[1] by this (DEPRECATED - use mode-specific fields)
  
  // THEME 3: Mode-specific instant effects
  instantRemainingPenalty?: number;  // X01 only: increase player's remaining score (penalty for player)
  instantScoreDelta?: number;        // Cricket only: add to player's score

  // Cricket: mark-level
  marksMultiplier?: number;      // multiply absorbed hits (Double Strike=2, Bad Aim=0.5)
  conditionalMultiplier?: boolean; // Don't double-apply in scorer (Comeback Marks, Mark Multiplier, Dominance)
  sluggishMarks?: boolean;       // all hits count as 1 mark
  hesitateFirstDart?: boolean;   // dart index 0 → 0 hits
  blockFinalDartMark?: boolean;  // dart index 2 → 0 hits
  blockSegmentsForMarks?: number[]; // these segments don't mark
  allowedMarkSegments?: number[];   // only these segments mark
  blockClosing?: boolean;        // can't bring marks to 3
  loseNextMark?: boolean;        // next mark attempt → 0 hits (one-shot)
  _loseNextMarkUsed?: boolean;   // internal flag
  
  // THEME 5: Cricket card effect targeting
  sniperLockSegment?: number;    // Sniper Lock: must hit this segment (next 3 darts)
  autoMarkMisses?: boolean;      // Mark Flood: convert misses to marks on called number
  bullMarksSegments?: number[];  // Bull Multiplier: Bull hit marks these segments
  dartsRemainingForSniper?: number; // Internal: countdown for Sniper Lock duration
  protectedNumbers?: Set<number>; // Closing Protection: these numbers lock when closed

  // THEME 4: Instant Cricket mark mutations
  instantCricketMarks?: Array<{
    playerIdx: 0 | 1;      // Which player's marks to modify
    numberIdx: number;     // Index in marks array (0-6, corresponds to CRICKET_NUMS)
    markDelta: number;     // Change in marks (1 to add, -999 to reset to 0)
  }>;
  penaltyPerMark?: number;       // -N per mark gained (Mark Erasure=-10)
  bonusIfAllMarksThisTurn?: number; // Perfect Round
  freeMarkIfEarlyClose?: boolean;   // Early Closer (309): free mark if turn ends on 1st or 2nd dart
  freeMarkIfQuickClose?: boolean;   // Quick Close (316): free mark if closing a number with <=1 darts
  bonusIfHighMarks?: number;        // High Scorer (318): +N bonus if scoring 100+ marks this turn
  bonusPerMark?: number;         // +N per mark (Momentum Arsenal=10)
  blockBullMarks?: boolean;      // Bull Void
  markDrainIfAhead?: boolean;    // Mark Drain (417): remove 1 mark if opponent ahead
  penaltyIfNotClosed?: number;  // Pressure (408): penalty if number not closed this turn
  streakBreakerHalves?: boolean; // Streak Breaker (418): halve marks on 2+ streak
  cricketMarksHalved?: boolean;     // Hex (604), Match Pressure: Cricket marks at 50%
  maxMarksPerTurn?: number;         // Shutdown (610): Cricket 2-number cap
  requiresExactFinish?: boolean;    // Exact Finish (107): only if on double-out
  opponentMustBeAhead?: boolean;    // Underdog Curse (608): only if opponent ahead
  
  // Cricket: foundation-patch behaviours
  cricketAutoMarkOnAnyDart?: boolean; // Mark Flood: misses/non-cricket darts become a real mark
  cricketBullAutoMarks?: number;      // Bull Multiplier/Bullseye Rush: bull adds free marks
  pressureLoseIfNoClose?: number;     // Pressure: lose N points if no number closed this visit
  removeConditionalBonuses?: boolean; // Win Bonus Removed: strips leg-duration conditional wildcards
  highScorerThreshold?: number;       // High Scorer: score threshold for bonus
  highScorerBonus?: number;           // High Scorer: bonus amount
  markThresholdBonusAt?: number;      // Mark Multiplier: mark threshold for bonus
  markThresholdBonus?: number;        // Mark Multiplier: bonus amount
  quickCloseFreeMark?: boolean;       // Quick Close: closing by dart two grants one free mark
  
  // MEDIUM PRIORITY CARDS:
  extraScoreMultiplier?: number;    // Cricket Scoring Surge / Perfect Form: multiply extra cricket score

  lowestDartMinimum?: number;       // Safety Boost (112): lowest dart minimum value
  bustingDartReduction?: number;    // Close Control (115): busting dart scores N instead
  escalatingBonus?: number[];       // Momentum Arsenal/Scoring Momentum: [10,20,30] or [5,10,15]
  markBoostThisLeg?: number;        // Perfect Form (319): mark multiplier this leg
  shutoutBonusDeferred?: boolean;   // Perfect Game (508): shutout bonus is deferred_next_leg
  wipeoutTargetDarts?: number[];    // Wipeout (605): which darts (2,3) wipe across leg
  doubleAttemptCheck?: boolean;     // Checkout Confidence (106): detect actual double attempt
  centuryExactOnly?: boolean;       // Century Maker (119): exactly 100 not 100-109
  scoreHalveExtraMultiplier?: number; // Score Halve (opponent's extras * 0.5)

  // Internal counters (mutable during a turn)
  _marksThisTurn?: number;
  _dartsMarkedThisTurn?: number;
  _trebleMultiplierUsed?: boolean; // BUGFIX 103: Treble Hunter one-shot tracking
}

// ── Game state snapshots passed into hook functions ──────────────────────────
export interface X01State { scores: [number,number]; legWins: [number,number] }
export interface CricketState { marks: number[][]; scores: [number,number]; turn: 0|1; legWins?: [number,number] }

/** Safely extract legWins from either state shape (Cricket may omit it). */
function getLegWins(gs?: X01State | CricketState): [number, number] {
  const lw = (gs as any)?.legWins;
  return Array.isArray(lw) ? (lw as [number, number]) : [0, 0];
}

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
  gameStateInfo?: {
    legHistory?: (0 | 1)[];
    legsNeeded?: number;
    calledNumber?: number;      // For Cricket instant mark effects
    chosenNumbers?: number[];    // For cards that need player selection
  }
): CCEffect[] {
  const name: string = (card.name || "").trim();
  const opp: 0 | 1 = byPlayer === 0 ? 1 : 0;

  // ── X01 GOOD (affects self, active this turn) ─────────────────────────────
  const x01Good: Record<string, CCEffect> = {
    "Big Game Player":      { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfVisit80Plus: 35, deferBonusToNextLeg: true, legDuration: true },
    "Power Surge +50":      { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 50 },
    "Treble Hunter":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", trebleMultiplier: 1.3, oneShotTrebleMultiplier: true },
    "Unstoppable Checkout": { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", blockOpponentPenalties: true, checkoutOnly: true },
    "Banking Strategy":     { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfVisit50Plus: 20, deferBonusToNextTurn: true },
    "Checkout Confidence":  { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", freeRetryOnDoubleMiss: true },
    "Exact Finish":         { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", blockOpponentPenalties: true, requiresExactFinish: true },
    "High Pressure":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfBehindLegs: 40, legDuration: true },
    "Perfect Rhythm":       { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusPerDart: 10 },
    "High Roller":          { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfVisit100Plus: 25 },
    "Precision Strike":     { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", minSegment: 6 },
    // BUGFIX 112: was setting `lowestDartMinimum` which no hook ever reads — the card did nothing.
    // ccPreprocessDart only understands `minDartValue`, so wire it to that (applies the floor per dart).
    "Safety Boost":         { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", minDartValue: 15 },
    "Treble Boost":         { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", trebleMultiplier: 1.4 },
    "Safety Net":           { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bustToHalf: true },
    "Close Control":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", preventBustInCheckout: true },
    "Steady Hand":          { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", missToMin: true },
    "Scoring Arsenal":      { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", forceFullTurn: true },
    "Finishing Bonus":      { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfWin: 50 },
    "Century Maker":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfVisit100Exact: 40, centuryExactOnly: true },
    "Iron Will":            { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", allDartsMultiplier: 1.2 },
  };

  // ── X01 BAD (affects opponent, pending → active on their next turn) ────────
  const x01Bad: Record<string, CCEffect> = {
    "Rust Hands -40":       { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", visitPenalty: 40 },
    "Wild Throw":           (() => {
      // Pick ONE random dart (0, 1, 2) to become a miss for opponent's next visit
      const wildDartIndex = Math.floor(Math.random() * 3);
      return {
        cardName: name,
        appliedBy: byPlayer,
        affectsPlayer: opp,
        status: "pending",
        wildDartIndex  // This dart becomes a miss
      } as CCEffect;
    })(),
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
  // ── Cricket GOOD ───────────────────────────────────────────────────────────
  const cricGood: Record<string, CCEffect> = {
    // BUGFIX 301: was `instant: true` with no payload — CricketScorer only acts on `instantCricketMarks`.
    "Instant Mark":         { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", instant: true,
      instantCricketMarks: [{ playerIdx: byPlayer, numberIdx: Math.max(0, CARD_CLASH_CRICKET_NUMS.indexOf((gameStateInfo?.calledNumber as any) ?? firstOpenCricketSegment(cricketMarksFor(gs, byPlayer)))), markDelta: 1 }] },
    "Double Strike":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", marksMultiplier: 2 },
    // BUGFIX 303: scorer's Sniper Lock logic (with 3-dart countdown) reads `sniperLockSegment`, not `allowedMarkSegments`.
    "Sniper Lock":          { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", sniperLockSegment: firstOpenCricketSegment(cricketMarksFor(gs, byPlayer)), dartsRemainingForSniper: 3 },
    // BUGFIX 304: was `instant: true` with no payload — reopen one of the opponent's closed numbers.
    "Number Resurrection":  (() => {
      const oppMarks = cricketMarksFor(gs, opp);
      const idx = gameStateInfo?.chosenNumbers?.length
        ? CARD_CLASH_CRICKET_NUMS.indexOf(gameStateInfo.chosenNumbers[0] as any)
        : firstClosedCricketSegmentIdx(oppMarks);
      return {
        cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", instant: true,
        instantCricketMarks: idx >= 0 ? [{ playerIdx: opp, numberIdx: idx, markDelta: -999 }] : [],
      } as CCEffect;
    })(),
    "Scoring Surge":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", extraScoreMultiplier: 1.5, legDuration: true }, // BUGFIX 305: "this leg" needs legDuration
    "Closing Protection":   { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active" }, // state-flag; handled by overlay
    "Mark Flood":           { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", cricketAutoMarkOnAnyDart: true },
    "Scoring Momentum":     { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusPerMark: 5 },
    // BUGFIX 309: scorer checks `freeMarkIfEarlyClose`, which was never set.
    "Early Closer":         { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", freeMarkIfEarlyClose: true },
    "Perfect Round":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusIfAllMarksThisTurn: 25, _dartsMarkedThisTurn: 0 },
    // BUGFIX 311/312: scorer's Bull-hit handler reads `bullMarksSegments` (an array of segments to mark), not `cricketBullAutoMarks` (a count).
    "Bull Multiplier":      { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bullMarksSegments: gameStateInfo?.chosenNumbers?.length ? gameStateInfo.chosenNumbers.slice(0, 3) : firstNOpenCricketSegments(cricketMarksFor(gs, byPlayer), 3) },
    "Bullseye Rush":        { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bullMarksSegments: gameStateInfo?.chosenNumbers?.length ? gameStateInfo.chosenNumbers.slice(0, 2) : firstNOpenCricketSegments(cricketMarksFor(gs, byPlayer), 2) },
    "Comeback Marks":       { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", marksMultiplier: 1.5 },
    "Mark Accelerator":     { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", marksMultiplier: 2 },
    "Mark Multiplier":      { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", markThresholdBonusAt: 3, markThresholdBonus: 50, _marksThisTurn: 0 },
    // BUGFIX 316: was setting `quickCloseFreeMark`; scorer's Quick Close check reads `freeMarkIfQuickClose`.
    "Quick Close":          { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", freeMarkIfQuickClose: true },
    "Momentum Arsenal":     { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", bonusPerMark: 10, _marksThisTurn: 0 },
    "High Scorer":          { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", highScorerThreshold: 100, highScorerBonus: 20 },
    "Perfect Form":         { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", extraScoreMultiplier: 1.5 },
    "Dominance":            { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", marksMultiplier: 1.3 },
  };

  // ── Cricket BAD (affects opponent's next turn) ─────────────────────────────
  const cricBad: Record<string, CCEffect> = {
    "Bad Aim":              { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", marksMultiplier: 0.5 },
    "Distraction":          { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", loseNextMark: true, _loseNextMarkUsed: false },
    "Out of Position":      { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", blockSegmentsForMarks: [20, 19, 18] },
    "Penalty Zone":         { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allowedMarkSegments: [15] },
    "Re-Opening Block":     { 
      cardName: name, 
      appliedBy: byPlayer, 
      affectsPlayer: opp,  // Effect targets opponent
      status: "pending",
      blockClosing: true   // THEME 7: When we close opponent's numbers, lock them so they reopen
    },
    "Aim Shift":            { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", segmentRedirect: true },
    "Hesitation":           { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", hesitateFirstDart: true },
    "Pressure":             { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", penaltyIfNotClosed: 30 },
    "Momentum Killer":      { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending" }, // streaks — complex
    "Sluggish Marks":       { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", sluggishMarks: true },
    // BUGFIX AUDIT (411): card text is "locked to ONE number" — was locking to two segments (20 and Bull).
    "Number Hex":           { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allowedMarkSegments: [firstOpenCricketSegment(cricketMarksFor(gs, opp))] },
    "Closing Blocker":      { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", blockClosing: true },
    "Mark Erasure":         { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", penaltyPerMark: 10 },
    "Cricket Prison":       { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allowedMarkSegments: [15, 19, 20] },
    "Bull Void":            { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", blockBullMarks: true },
    "Mark Killer":          { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", blockFinalDartMark: true },
    "Mark Drain":           { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", markDrainIfAhead: true },
    "Streak Breaker":       { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", streakBreakerHalves: true },
    "Number Prison":        { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending" }, // mark random closed num = -1
    "Score Halve":          { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", scoreHalveExtraMultiplier: 0.5, legDuration: true }, // BUGFIX 420: card text is "this leg"
  };

  // BUGFIX AUDIT: conditional Wildcard GOOD cards (Lucky Streak/Momentum Surge/Comeback Leg/
  // Hot Hand/Underdog/Match Point) previously granted their visitBonus unconditionally on manual
  // play, ignoring the stated trigger condition entirely (ccEvaluateConditionalWildcards had the
  // correct logic but was never wired into the manual-activation path). Now gated here.
  const legWinsNow = getLegWins(gs);
  const legHistoryNow = gameStateInfo?.legHistory ?? [];
  const legsNeededNow = gameStateInfo?.legsNeeded ?? 0;
  const wonPrevLeg = legHistoryNow.length > 0 && legHistoryNow[legHistoryNow.length - 1] === byPlayer;
  const lostPrevLeg = legHistoryNow.length > 0 && legHistoryNow[legHistoryNow.length - 1] === opp;
  const won2Straight = legHistoryNow.length >= 2 &&
    legHistoryNow[legHistoryNow.length - 1] === byPlayer && legHistoryNow[legHistoryNow.length - 2] === byPlayer;
  const isAheadInLegs = legWinsNow[byPlayer] > legWinsNow[opp];
  const isBehindInLegs = legWinsNow[byPlayer] < legWinsNow[opp];
  const isMatchPointNow = legsNeededNow > 0 && legWinsNow[byPlayer] === legsNeededNow - 1;
  const oppIsAheadInLegs = legWinsNow[opp] > legWinsNow[byPlayer];

  // ── Wildcard GOOD ──────────────────────────────────────────────────────────
  const wildcardGood: Record<string, CCEffect | null> = {
    "Coin Flip": (() => {
      const win = Math.random() > 0.5;
      return { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", instant: true,
        instantP0Delta: win ? (byPlayer === 0 ? 40 : -40) : (byPlayer === 0 ? -30 : 30),
        instantP1Delta: win ? (byPlayer === 0 ? -40 : 40) : (byPlayer === 0 ? 30 : -30) } as CCEffect;
    })(),
    // BUGFIX AUDIT (502): "If you won the previous leg" — now gated on legHistory.
    "Lucky Streak":   wonPrevLeg ? { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 50, legDuration: true } : null, // BUGFIX 502: card text is "this leg"
    // BUGFIX AUDIT (503): "If you're ahead in the match" — now gated on legWins comparison.
    "Momentum Surge": isAheadInLegs ? { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 25, legDuration: true } : null, // BUGFIX 503: card text is "this leg"
    "Finishing Edge": { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", freeRetryOnDoubleMiss: true },
    // BUGFIX AUDIT (505): "If you lost the previous leg" — now gated on legHistory.
    "Comeback Leg":   lostPrevLeg ? { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 60, legDuration: true } : null, // BUGFIX 505: card text is "this leg"
    // BUGFIX AUDIT (506): "If you've won 2 legs in a row" — now gated on legHistory.
    "Hot Hand":       won2Straight ? { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 45 } : null,
    // BUGFIX AUDIT (507): "If you're behind in the match" — now gated on legWins comparison.
    "Underdog":       isBehindInLegs ? { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 50, legDuration: true } : null, // BUGFIX 507: card text is "this leg"
    "Perfect Game":   { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 30 },
    // BUGFIX AUDIT (509): "If you're 1 leg from winning the match" — now gated on legsNeeded.
    "Match Point":    isMatchPointNow ? { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", visitBonus: 70 } : null,
    "Invincible":     { cardName: name, appliedBy: byPlayer, affectsPlayer: byPlayer, status: "active", blockOpponentPenalties: true },
  };

  // ── Wildcard BAD ───────────────────────────────────────────────────────────
  const wildcardBad: Record<string, CCEffect | null> = {
    "Dark Cloud":         { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", visitPenalty: 35, deferPenaltyToNextLeg: true },
    "Momentum Killer":    { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", visitPenalty: 0 }, // streak clear
    "Unlucky Night":      { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allDartsMultiplier: 0.75, legDuration: true }, // BUGFIX 603: card text is "this leg"
    "Hex":                { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allDartsMultiplier: 0.5, marksMultiplier: 0.5, legDuration: true }, // BUGFIX 604: cricketMarksHalved was never read anywhere — marksMultiplier is the real, working field for this (see ccApplyCricketMarkEffects). Card text is "this leg".
    // BUGFIX 605: card text is "last 2 darts THIS LEG" — without legDuration it expired after a single turn.
    "Wipeout":            { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", wildDartIndices: [1, 2], legDuration: true },
    // BUGFIX 606: card text is "target's NEXT LEG score reduced by 100" — without deferPenaltyToNextLeg
    // (see Dark Cloud above for the same pattern) it applied on the opponent's very next turn instead.
    "Total Annihilation": { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", visitPenalty: 100, deferPenaltyToNextLeg: true },
    "Match Pressure":     { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", penaltyPerDart: 20, marksMultiplier: 0.5, finalLegOnly: true },
    // BUGFIX AUDIT (608): "If your opponent is ahead" — field `opponentMustBeAhead` was defined but
    // never read anywhere; the effect was granted regardless of match state. Now gated here.
    "Underdog Curse":     oppIsAheadInLegs ? { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", allDartsMultiplier: 0.8, legDuration: true } : null, // BUGFIX 608: card text is "this leg"
    "Win Bonus Removed":  { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", removeConditionalBonuses: true },
    // BUGFIX 610: card text applies to BOTH modes ("50 points X01 / 2 numbers Cricket") — only
    // the Cricket cap was wired up, so the card did nothing in X01 games.
    // BUGFIX AUDIT: added legDuration so the cap holds for the whole leg, not just the opponent's
    // very next turn (card text: "target's leg is capped").
    "Shutdown":           { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", maxMarksPerTurn: 2, maxVisitTotal: 50, legDuration: true },
    "Streak Crusher":     { cardName: name, appliedBy: byPlayer, affectsPlayer: opp, status: "pending", removeLegsIfAhead: 2 }, // Remove 2 legs if opponent is 2+ ahead
  };

  const allMaps = [x01Good, x01Bad, cricGood, cricBad, wildcardGood, wildcardBad];
  // Try exact match first
  for (const m of allMaps) {
    if (name in m) {
      const effect = m[name];
      // If effect is null, condition wasn't met - return empty array (card can't be played)
      if (effect === null) return [];
      return [effect];
    }
  }
  // Normalized match — handles camelCase DB names ("BankingStrategy") vs spaced engine names ("Banking Strategy")
  const normInput = normalizeCardKey(name);
  for (const m of allMaps) {
    for (const [key, effect] of Object.entries(m)) {
      if (normalizeCardKey(key) === normInput) {
        // If effect is null, condition wasn't met - return empty array (card can't be played)
        if (effect === null) return [];
        return [effect];
      }
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
    // BUGFIX 103: Treble Hunter (oneShotTrebleMultiplier) must only apply to the FIRST treble
    // hit this turn — previously it multiplied every treble for the rest of the turn.
    if (e.trebleMultiplier !== undefined && multiplier === 3) {
      if (e.oneShotTrebleMultiplier) {
        if (!e._trebleMultiplierUsed) {
          value = Math.floor(value * e.trebleMultiplier);
          label = `${value}`;
          e._trebleMultiplierUsed = true;
        }
      } else {
        value = Math.floor(value * e.trebleMultiplier);
        label = `${value}`;
      }
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
  // Close Control — if remaining <= 50, prevent bust: only the BUSTING dart is reduced to 1 point,
  // the darts already scored earlier in this visit (dartsCum) are kept.
  // BUGFIX 115: previously returned `halvedVisit: 1`, which threw away the whole visit's score
  // instead of just neutralizing the busting dart.
  if (active.some(e => e.preventBustInCheckout) && remaining <= 50) {
    return { prevent: true, halvedVisit: dartsCum + 1 };
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
  lastDartWasDouble: boolean = false,  // NEW: Was final dart a double?
): { bonusReduction: number; extraPenalty: number; newDeferredEffects: CCEffect[] } {
  const active = effects.filter(e => e.status === "active" && e.affectsPlayer === player);
  let bonusReduction = 0; // extra score reduction (good for player)
  let extraPenalty = 0;   // added back to score (bad for player)
  const newDeferredEffects: CCEffect[] = []; // NEW: Effects to defer to next turn/leg

  for (const e of active) {
    // ── OPPONENT PENALTIES (apply to current player's score) ──
    // Dark Cloud, Total Annihilation: reduce this player's visit total
    if (e.visitPenalty) {
      extraPenalty += e.visitPenalty;
    }
    
    // Mental Block: each dart costs 10 points
    if (e.penaltyPerDart) {
      const dartPenalty = e.penaltyPerDart * dartsThrown;
      extraPenalty += dartPenalty;
    }
    
    // ── CONDITIONAL BONUSES ──
    // Check conditions first, then decide whether to apply immediately or defer
    let conditionMet = false;
    let bonusAmount = 0;
    let cardName = "";
    
    // Big Game Player: 80+ (NOT a finishing double)
    if (e.bonusIfVisit80Plus && rawCum >= 80 && !lastDartWasDouble) {
      conditionMet = true;
      bonusAmount = e.bonusIfVisit80Plus;
      cardName = "Big Game Player";
    }
    // Banking Strategy: 50+ (NOT a finishing double)
    if (e.bonusIfVisit50Plus && rawCum >= 50 && !lastDartWasDouble) {
      conditionMet = true;
      bonusAmount = e.bonusIfVisit50Plus;
      cardName = "Banking Strategy";
    }
    // High Roller: 100+
    if (e.bonusIfVisit100Plus && rawCum >= 100) {
      conditionMet = true;
      bonusAmount = e.bonusIfVisit100Plus;
      cardName = "High Roller";
    }
    // FIX 119: Century Maker - exactly 100 (not 100-109)
    if (e.bonusIfVisit100Exact) {
      const isExact = e.centuryExactOnly ? rawCum === 100 : (rawCum >= 100 && rawCum < 110);
      if (isExact) {
        conditionMet = true;
        bonusAmount = e.bonusIfVisit100Exact;
        cardName = "Century Maker";
      }
    }
    // High Pressure: if behind in legs
    const opp: 0 | 1 = player === 0 ? 1 : 0;
    if (e.bonusIfBehindLegs && legWins[opp] > legWins[player]) {
      conditionMet = true;
      bonusAmount = e.bonusIfBehindLegs;
      cardName = "High Pressure";
    }
    
    // If condition met, handle bonusing
    if (conditionMet && bonusAmount > 0) {
      if (e.deferBonusToNextTurn) {
        // DEFERRED TO NEXT TURN: Create new effect that will activate on opponent's next turn
        newDeferredEffects.push({
          cardName: e.cardName || cardName,
          appliedBy: e.appliedBy,
          affectsPlayer: player,
          status: "deferred_next_turn",
          visitBonus: bonusAmount,
          legDuration: false, // Expire after one turn
        });
      } else if (e.deferBonusToNextLeg) {
        // DEFERRED TO NEXT LEG: Create new effect that will activate on next leg
        newDeferredEffects.push({
          cardName: e.cardName || cardName,
          appliedBy: e.appliedBy,
          affectsPlayer: player,
          status: "deferred_next_leg",
          visitBonus: bonusAmount,
          legDuration: false, // Expire after one use
        });
      } else {
        // APPLY IMMEDIATELY
        bonusReduction += bonusAmount;
      }
    }
    
    // Skip to next effect - deferred bonuses are not processed further here
    if (e.deferBonusToNextTurn || e.deferBonusToNextLeg) continue;
    
    // Visit bonus (Power Surge, Wildcard bonuses)
    if (e.visitBonus) bonusReduction += e.visitBonus;
  }
  return { bonusReduction, extraPenalty, newDeferredEffects };
}

/** Expire "this_turn" active effects and promote pending → active on turn switch. 
 *  Also handle deferred next-turn effects. */
export function ccExpireOnTurnEnd(effects: CCEffect[], completedPlayer: 0 | 1): CCEffect[] {
  const opp: 0 | 1 = completedPlayer === 0 ? 1 : 0;
  const before = effects.filter(e => e.status === "active").map(e => `${e.cardName}→P${e.affectsPlayer}`).join(", ");
  const result = effects
    .filter(e => {
      // Remove active effects that targeted the player who just finished their turn
      // BUT: Keep leg-duration effects (they expire at leg end, not turn end)
      if (e.status === "active" && e.affectsPlayer === completedPlayer && !e.deferBonusToNextTurn && !e.deferBonusToNextLeg && !e.legDuration) return false;
      return true;
    })
    .map(e => {
      // Promote pending effects targeting the next player to active — UNLESS
      // they're meant to wait for that player's next LEG instead of their
      // very next turn (Dark Cloud, Total Annihilation: deferPenaltyToNextLeg).
      // BUGFIX: this flag was declared and assigned to real cards but never
      // actually read anywhere, so both applied immediately on the
      // opponent's next visit rather than being held until their next leg.
      if (e.status === "pending" && e.affectsPlayer === opp && e.deferPenaltyToNextLeg) {
        return { ...e, status: "deferred_next_leg" as const };
      }
      if (e.status === "pending" && e.affectsPlayer === opp) {
        return { ...e, status: "active" as const };
      }
      // Activate deferred-next-turn bonuses for the player whose turn just ended
      if (e.status === "active" && e.affectsPlayer === completedPlayer && e.deferBonusToNextTurn) {
        return { ...e, status: "deferred_next_turn" as const };
      }
      // Keep deferred-next-leg bonuses (will be activated at leg end)
      if (e.deferBonusToNextLeg) {
        return { ...e, status: "deferred_next_leg" as const };
      }
      return e;
    });
  
  const after = result.filter(e => e.status === "active").map(e => `${e.cardName}→P${e.affectsPlayer}`).join(", ");
  
  return result;
}

/** Activate "deferred_next_turn" effects for the player about to play. Call at turn start. */
export function ccActivateDeferredNextTurnEffects(effects: CCEffect[], player: 0 | 1): CCEffect[] {
  return effects.map(e => {
    if (e.status === "deferred_next_turn" && e.affectsPlayer === player) {
      return { ...e, status: "active" as const };
    }
    return e;
  });
}

/** Activate "deferred_next_leg" effects at start of new leg. Call when leg starts. */
export function ccActivateDeferredNextLegEffects(effects: CCEffect[], newLegStartPlayer: 0 | 1): CCEffect[] {
  return effects.map(e => {
    if (e.status === "deferred_next_leg" && e.affectsPlayer === newLegStartPlayer) {
      return { ...e, status: "active" as const };
    }
    return e;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRICKET HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/** Preprocess a cricket dart for segment-redirect and mark-flood effects. */
export function ccPreprocessCricketDart(
  dart: Dart,
  effects: CCEffect[],
  player: 0 | 1,
  playerMarks?: number[],
): Dart {
  const active = effects.filter(e => e.status === "active" && e.affectsPlayer === player);
  if (active.length === 0) return dart;

  let { segment, multiplier, value, label } = dart;

  for (const e of active) {
    if (e.segmentRedirect && segment > 0 && segment !== 25) {
      segment = adjacentOf(segment);
      multiplier = Math.max(1, multiplier) as 1 | 2 | 3;
      value = segment * multiplier;
      label = `${multiplier === 3 ? "T" : multiplier === 2 ? "D" : ""}${segment}`;
    }

    if (e.cricketAutoMarkOnAnyDart && !CARD_CLASH_CRICKET_NUMS.includes(segment as any)) {
      segment = firstOpenCricketSegment(playerMarks);
      multiplier = 1;
      value = segment;
      label = `${segment} (Mark Flood)`;
    }
  }

  return { segment, multiplier, value, label };
}

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

/** Evaluate conditional Wildcard cards at start of new leg.
 *  Returns effects to add for this leg based on match state. */
export function ccEvaluateConditionalWildcards(
  player: 0 | 1,
  legHistory: (0 | 1)[],
  legWins: [number, number],
  legsNeeded: number,
): CCEffect[] {
  const effects: CCEffect[] = [];
  const opp: 0 | 1 = player === 0 ? 1 : 0;
  
  // Lucky Streak (502): Won previous leg
  if (legHistory.length > 0 && legHistory[legHistory.length - 1] === player) {
    effects.push({
      cardName: "Lucky Streak",
      appliedBy: player,
      affectsPlayer: player,
      status: "active",
      visitBonus: 50,
      legDuration: true,
    });
  }
  
  // Momentum Surge (503): Ahead in match
  if (legWins[player] > legWins[opp]) {
    effects.push({
      cardName: "Momentum Surge",
      appliedBy: player,
      affectsPlayer: player,
      status: "active",
      visitBonus: 25,
      legDuration: true,
    });
  }
  
  // Comeback Leg (505): Lost previous leg
  if (legHistory.length > 0 && legHistory[legHistory.length - 1] === opp) {
    effects.push({
      cardName: "Comeback Leg",
      appliedBy: player,
      affectsPlayer: player,
      status: "active",
      visitBonus: 60,
      legDuration: true,
    });
  }
  
  // Hot Hand (506): Won 2+ legs in a row
  if (legHistory.length >= 2) {
    const last2 = legHistory.slice(-2);
    if (last2[0] === player && last2[1] === player) {
      effects.push({
        cardName: "Hot Hand",
        appliedBy: player,
        affectsPlayer: player,
        status: "active",
        visitBonus: 45,
        legDuration: true,
      });
    }
  }
  
  // Underdog (507): Behind overall
  if (legWins[player] < legWins[opp]) {
    effects.push({
      cardName: "Underdog",
      appliedBy: player,
      affectsPlayer: player,
      status: "active",
      visitBonus: 50,
      legDuration: true,
    });
  }
  
  // Match Point (509): 1 leg away from winning
  if (legWins[player] === legsNeeded - 1) {
    effects.push({
      cardName: "Match Point",
      appliedBy: player,
      affectsPlayer: player,
      status: "active",
      visitBonus: 70,
      legDuration: true,
    });
  }
  
  return effects;
}

/** Evaluate opponent penalty Wildcard cards at turn start.
 *  Returns effects to add based on opponent match state. */
export function ccEvaluateOpponentWildcards(
  player: 0 | 1,
  legWins: [number, number],
): CCEffect[] {
  const effects: CCEffect[] = [];
  const opp: 0 | 1 = player === 0 ? 1 : 0;
  
  // Underdog Curse (608): Removed auto-grant - only manual activation allowed per audit
  // Gate condition at activation: only works if opponent IS ahead
  
  return effects;
}

/** Check if opponent penalty effects are blocked for current player. */
export function ccOpponentPenaltiesBlocked(effects: CCEffect[], player: 0 | 1): boolean {
  return effects.some(e => e.status === "active" && e.affectsPlayer === player && e.blockOpponentPenalties);
}

/** FIX 104: Validate checkoutOnly cards - deactivate if not on valid double-out */
export function ccValidateCheckoutOnlyCards(effects: CCEffect[], scores: [number, number], player: 0 | 1): CCEffect[] {
  return effects.map(e => {
    if (e.checkoutOnly && e.status === "active" && e.affectsPlayer === player) {
      // Player must be on valid double-out finish (remaining <= 170)
      const remaining = scores[player];
      const isOnCheckout = remaining > 0 && remaining <= 170;
      if (!isOnCheckout) {
        return { ...e, status: "expired" };
      }
    }
    return e;
  });
}

/** FIX 107: Validate requiresExactFinish cards - only on <=50 + double attempt */
export function ccValidateExactFinishCards(effects: CCEffect[], scores: [number, number], player: 0 | 1): CCEffect[] {
  return effects.map(e => {
    if (e.requiresExactFinish && e.status === "active" && e.affectsPlayer === player) {
      // Only valid if remaining <= 50 (will require double finish)
      const remaining = scores[player];
      const isExactFinish = remaining > 0 && remaining <= 50;
      if (!isExactFinish) {
        return { ...e, status: "expired" };
      }
    }
    return e;
  });
}

/** Filter out opponent penalty effects if player has blocking active. */
export function ccApplyPenaltyBlockingIfNeeded(effects: CCEffect[], player: 0 | 1): CCEffect[] {
  if (!ccOpponentPenaltiesBlocked(effects, player)) {
    return effects;
  }
  const opp: 0 | 1 = player === 0 ? 1 : 0;
  // Remove effects where: status=active AND affectsPlayer=player AND effect comes from opponent (appliedBy=opp)
  return effects.filter(e => {
    if (e.status === "active" && e.affectsPlayer === player && e.appliedBy === opp) {
      return false;
    }
    return true;
  });
}
