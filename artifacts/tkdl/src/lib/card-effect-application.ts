/**
 * Card Effect Application System
 * Maps actual card IDs from the unified card set to quantified bonus values.
 * Used by CardClashMatchScorer to apply real bonuses/penalties during gameplay.
 */

export interface ActivatedCard {
  id: string;
  name: string;
  effect: string;
  cardType: "GOOD" | "BAD";
  activatedBy: number;
  activatedAtTurn?: number;
}

/**
 * Explicit bonus values keyed by card ID.
 * GOOD cards: bonus added to the activating player's score.
 * BAD cards:  bonus subtracted from the opponent's score.
 */
const CARD_BONUS_MAP: Record<string, number> = {
  // X01 GOOD
  "x01g01": 15,  // BankingStrategy
  "x01g02": 25,  // BigGamePlayer
  "x01g03": 20,  // CenturyMaker
  "x01g04": 20,  // CheckoutConfidence
  "x01g05": 15,  // CheckoutSpecialist
  "x01g06": 15,  // CloseControl
  "x01g07": 20,  // ExactFinish
  "x01g08": 15,  // FinishingBonus
  "x01g09": 10,  // HighPressure
  "x01g10": 25,  // HighRoller
  "x01g11": 30,  // IronWill
  "x01g12": 10,  // PerfectRhythm
  "x01g13": 50,  // PowerSurge50
  "x01g14": 20,  // PrecisionStrike
  "x01g15": 10,  // SafetyBoost
  "x01g16": 30,  // SafetyNet
  "x01g17": 15,  // ScoringArsenal
  "x01g18": 30,  // SteadyHand
  "x01g19": 15,  // TrebleBoost
  "x01g20": 15,  // TrebleHunter

  // X01 BAD
  "x01b01": 20,  // BrickWall
  "x01b02": 15,  // ClutchBreaker
  "x01b03": 20,  // DeadZone
  "x01b04": 20,  // DoublesDontCount
  "x01b05": 15,  // Fatigue
  "x01b06": 20,  // FinishDelay
  "x01b07": 20,  // Jinx
  "x01b08": 30,  // LegReset
  "x01b09": 20,  // Lockdown
  "x01b10": 10,  // LowBlow
  "x01b11": 10,  // MentalBlock
  "x01b12": 10,  // MercyKiller
  "x01b13": 10,  // OffTarget
  "x01b14": 10,  // PressureZone
  "x01b15": 15,  // RustHands40
  "x01b16": 20,  // Shackled
  "x01b17": 30,  // Trapped
  "x01b18": 30,  // TrebleCurse
  "x01b19": 20,  // TurnEnforcer
  "x01b20": 30,  // WildThrow

  // Cricket GOOD
  "cg01": 20,   // BullMultiplier
  "cg02": 20,   // BullseyeRush
  "cg03": 10,   // ClosingProtection
  "cg04": 10,   // ComebackMarks
  "cg05": 30,   // Dominance
  "cg06": 20,   // DoubleStrike
  "cg07": 10,   // EarlyCloser
  "cg08": 10,   // HighScorer
  "cg09": 20,   // InstantMark
  "cg10": 20,   // MarkAccelerator
  "cg11": 30,   // MarkFlood
  "cg12": 20,   // MarkMultiplier
  "cg13": 20,   // MomentumArsenal
  "cg14": 10,   // NumberResurrection
  "cg15": 30,   // PerfectForm
  "cg16": 10,   // PerfectRound
  "cg17": 20,   // QuickClose
  "cg18": 15,   // ScoringMomentum
  "cg19": 30,   // ScoringSurge
  "cg20": 20,   // SniperLock

  // Cricket BAD
  "cb01": 10,   // AimShift
  "cb02": 10,   // BadAim
  "cb03": 20,   // BullVoid
  "cb04": 20,   // ClosingBlocker
  "cb05": 20,   // CricketPrison
  "cb06": 10,   // Distraction
  "cb07": 10,   // Hesitation
  "cb08": 20,   // MarkDrain
  "cb09": 20,   // MarkErasure
  "cb10": 20,   // MarkKiller
  "cb11": 20,   // MomentumKiller
  "cb12": 20,   // NumberHex
  "cb13": 20,   // NumberPrison
  "cb14": 10,   // OutOfPosition
  "cb15": 20,   // PenaltyZone
  "cb16": 10,   // Pressure
  "cb17": 20,   // ReOpeningBlock
  "cb18": 30,   // ScoreHalve
  "cb19": 20,   // SluggyMarks (SlugishMarks)
  "cb20": 20,   // StreakBreaker

  // Wildcard GOOD
  "wg01": 20,   // CoinFlip
  "wg02": 20,   // ComebackLeg
  "wg03": 50,   // FinishingEdge
  "wg04": 20,   // HotHand
  "wg05": 30,   // Invincible
  "wg06": 20,   // LuckyStreak
  "wg07": 30,   // MatchPoint
  "wg08": 20,   // MomentumSurge
  "wg09": 30,   // PerfectGame
  "wg10": 30,   // Underdog

  // Wildcard BAD
  "wb01": 20,   // DarkCloud
  "wb02": 20,   // Hex
  "wb03": 30,   // MatchPressure
  "wb04": 30,   // MomentumKillerWildcard
  "wb05": 20,   // Shutdown
  "wb06": 30,   // TotalAnnihilation
  "wb07": 30,   // UndogCurse
  "wb08": 20,   // UnluckyNight
  "wb09": 20,   // WinBonusRemoved
  "wb10": 30,   // Wipeout
};

/**
 * Get the quantified bonus value for a card.
 * Falls back to parsing the effect text if the card ID is not in the map.
 */
export function getCardBonusValue(card: ActivatedCard): number {
  if (CARD_BONUS_MAP[card.id] !== undefined) {
    return CARD_BONUS_MAP[card.id];
  }

  // Fallback: parse the first number from the effect text
  const match = card.effect.match(/\d+/);
  if (match) {
    const val = parseInt(match[0], 10);
    return Math.min(Math.max(val, 5), 50);
  }

  return 15; // safe default
}

/**
 * Apply card effect to X01 remaining score.
 * Returns the modified remaining score.
 */
export function applyX01CardEffect(
  card: ActivatedCard,
  currentScore: number
): number {
  const bonus = getCardBonusValue(card);

  if (card.cardType === "GOOD") {
    // Good cards reduce the activating player's remaining score
    return Math.max(2, currentScore - bonus);
  } else {
    // Bad cards increase the opponent's remaining score (harder to finish)
    return currentScore + bonus;
  }
}

/**
 * Apply card effect to Cricket marks/points.
 * Returns adjusted marks and bonus points.
 */
export function applyCricketCardEffect(
  card: ActivatedCard,
  turnMarks: number,
  playerScore: number
): { marks: number; points: number } {
  const bonus = getCardBonusValue(card);

  if (card.cardType === "GOOD") {
    // Good cards: add marks or points
    return {
      marks: turnMarks + Math.floor(bonus / 10),
      points: bonus,
    };
  } else {
    // Bad cards applied to opponent: reduce their marks
    return {
      marks: Math.max(0, turnMarks - Math.floor(bonus / 10)),
      points: -bonus,
    };
  }
}

/**
 * Format a card effect activation for display.
 */
export function formatCardActivation(
  card: ActivatedCard,
  playerName: string,
  opponentName: string
): string {
  const bonus = getCardBonusValue(card);
  if (card.cardType === "GOOD") {
    return `${playerName} activated ${card.name} (+${bonus})`;
  } else {
    return `${playerName} cursed ${opponentName} with ${card.name} (−${bonus})`;
  }
}
