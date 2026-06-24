/**
 * Card Effect Application System
 * Applies card effects to live game scoring based on card effect descriptions
 */

export interface ActivatedCard {
  id: string;
  name: string;
  effect: string;
  cardType: "GOOD" | "BAD";
  activatedBy: number; // player ID
  activatedAtTurn?: number;
}

interface X01GameState {
  player1Remaining: number;
  player2Remaining: number;
  currentPlayerIdx: 0 | 1;
  turnNumber: number;
  turnScore: number;
}

interface CricketGameState {
  player1Marks: Record<string, number>; // "15": 1, "20": 2, etc.
  player2Marks: Record<string, number>;
  player1Score: number;
  player2Score: number;
  currentPlayerIdx: 0 | 1;
  turnNumber: number;
}

/**
 * Apply card effects to X01 scoring
 */
export function applyX01CardEffect(
  card: ActivatedCard,
  currentScore: number,
  gameState: X01GameState
): number {
  const effect = card.effect.toLowerCase();
  let modifiedScore = currentScore;

  // GOOD CARDS - Help finish
  if (card.cardType === "GOOD") {
    if (effect.includes("add 50")) {
      modifiedScore += 50;
    } else if (effect.includes("3x value")) {
      // Next treble counts as 3x - handled differently (needs dart-level)
      modifiedScore += Math.floor(currentScore * 0.5);
    } else if (effect.includes("50+") || effect.includes("bonus")) {
      if (currentScore >= 50) modifiedScore += 20;
    } else if (effect.includes("60+")) {
      if (currentScore >= 60) modifiedScore += 20;
    } else if (effect.includes("lower")) {
      // Lower score (helps finish) - reduce remaining
      modifiedScore = Math.max(0, currentScore - 15);
    } else if (effect.includes("reduce")) {
      modifiedScore = Math.max(0, currentScore - 25);
    } else if (effect.includes("+20%")) {
      modifiedScore = Math.ceil(currentScore * 1.2);
    } else if (effect.includes("+25%")) {
      modifiedScore = Math.ceil(currentScore * 1.25);
    } else if (effect.includes("1.5x")) {
      modifiedScore = Math.ceil(currentScore * 1.5);
    } else if (effect.includes("without double")) {
      // Allow non-double finish - special flag needed
      modifiedScore = currentScore;
    } else if (effect.includes("free re-throw")) {
      // Special handling needed
      modifiedScore = currentScore;
    } else if (effect.includes("+15")) {
      modifiedScore += 15;
    } else if (effect.includes("+10")) {
      modifiedScore += 10;
    }
  }

  // BAD CARDS - Penalize
  if (card.cardType === "BAD") {
    if (effect.includes("-40")) {
      modifiedScore = Math.max(0, currentScore - 40);
    } else if (effect.includes("-50")) {
      modifiedScore = Math.max(0, currentScore - 50);
    } else if (effect.includes("-30")) {
      modifiedScore = Math.max(0, currentScore - 30);
    } else if (effect.includes("-60")) {
      modifiedScore = Math.max(0, currentScore - 60);
    } else if (effect.includes("-80")) {
      modifiedScore = Math.max(0, currentScore - 80);
    } else if (effect.includes("50%")) {
      modifiedScore = Math.floor(currentScore * 0.5);
    } else if (effect.includes("0.75x")) {
      modifiedScore = Math.floor(currentScore * 0.75);
    } else if (effect.includes("= 0")) {
      modifiedScore = 0;
    } else if (effect.includes("drop lowest")) {
      // Handled at dart level
      modifiedScore = Math.max(0, currentScore - 10);
    } else if (effect.includes("singles = 0")) {
      // Complex - needs dart-level handling
      modifiedScore = Math.floor(currentScore * 0.6);
    }
  }

  return Math.max(0, modifiedScore);
}

/**
 * Apply card effects to Cricket scoring
 */
export function applyCricketCardEffect(
  card: ActivatedCard,
  turnMarks: number, // marks scored this turn
  playerScore: number,
  gameState: CricketGameState
): { marks: number; points: number } {
  const effect = card.effect.toLowerCase();
  let modifiedMarks = turnMarks;
  let scoreBonus = 0;

  // GOOD CARDS
  if (card.cardType === "GOOD") {
    if (effect.includes("auto-mark")) {
      modifiedMarks += 1;
    } else if (effect.includes("2x")) {
      modifiedMarks = turnMarks * 2;
    } else if (effect.includes("close = +20")) {
      scoreBonus += 20;
    } else if (effect.includes("+15")) {
      scoreBonus += 15;
    } else if (effect.includes("+25")) {
      scoreBonus += 25;
    } else if (effect.includes("+40")) {
      scoreBonus += 40;
    } else if (effect.includes("no wasted")) {
      // Marks don't waste - need state tracking
      scoreBonus += turnMarks * 5;
    } else if (effect.includes("mark = +5")) {
      scoreBonus += turnMarks * 5;
    } else if (effect.includes("never wasted")) {
      scoreBonus += turnMarks * 3;
    } else if (effect.includes("control = +20")) {
      scoreBonus += 20;
    } else if (effect.includes("ahead = 2x")) {
      // Only if ahead
      if (playerScore > gameState[`player${3 - (gameState.currentPlayerIdx + 1)}Score`]) {
        modifiedMarks = turnMarks * 2;
      }
    } else if (effect.includes("-1 mark")) {
      // Closing requirement reduced
      scoreBonus += 10;
    } else if (effect.includes("only")) {
      // Restricted to certain numbers
      modifiedMarks = Math.max(0, turnMarks - 1);
    }
  }

  // BAD CARDS
  if (card.cardType === "BAD") {
    if (effect.includes("50%")) {
      modifiedMarks = Math.floor(turnMarks * 0.5);
    } else if (effect.includes("75%")) {
      modifiedMarks = Math.floor(turnMarks * 0.75);
    } else if (effect.includes("lose next")) {
      modifiedMarks = 0;
    } else if (effect.includes("blocked")) {
      modifiedMarks = 0;
    } else if (effect.includes("20,19,18")) {
      modifiedMarks = Math.max(0, turnMarks - 1);
    } else if (effect.includes("15-17")) {
      // Restricted zone
      modifiedMarks = Math.max(0, turnMarks - 1);
    } else if (effect.includes("bull only")) {
      modifiedMarks = Math.max(0, Math.floor(turnMarks * 0.3));
    } else if (effect.includes("1 number")) {
      modifiedMarks = Math.min(1, turnMarks);
    } else if (effect.includes("no marks")) {
      modifiedMarks = 0;
    } else if (effect.includes("random")) {
      modifiedMarks = Math.max(0, turnMarks - 1);
    } else if (effect.includes("2x against")) {
      // Opponent benefit - negative for us
      scoreBonus -= 10;
    }
  }

  return {
    marks: Math.max(0, modifiedMarks),
    points: scoreBonus,
  };
}

/**
 * Format card effect for display
 */
export function formatCardEffectForDisplay(card: ActivatedCard): string {
  return `${card.cardType === "GOOD" ? "✓ BOOST" : "✗ CURSE"}: ${card.effect}`;
}

/**
 * Check if card effect needs special UI (like number selection)
 */
export function cardNeedsSpecialUI(card: ActivatedCard): string | null {
  const effect = card.effect.toLowerCase();

  if (effect.includes("popup") || effect.includes("select")) {
    if (effect.includes("15-20") || effect.includes("number")) {
      return "number-selection"; // Cricket number selection modal
    }
    if (effect.includes("segment")) {
      return "segment-selection"; // X01 segment picker
    }
  }

  return null;
}
