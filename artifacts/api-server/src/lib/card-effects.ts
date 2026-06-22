/**
 * CARD EFFECTS ENGINE
 * Handles how cards actually modify game scoring and mechanics
 * This is the CORE system that makes cards functional
 */

export interface CardEffect {
  cardId: string;
  cardName: string;
  cardType: "GOOD" | "BAD";
  gameMode: "X01" | "CRICKET";
}

export interface X01ScoringContext {
  playerScore: number;
  turnDarts: number[]; // [20, 20, 5] for example
  isOnDouble: boolean;
  remainingScore: number;
}

export interface CricketScoringContext {
  playerMarks: { [number: string]: number }; // {20: 2, 19: 1}
  targetNumber: number;
  currentMarksOnTarget: number;
  opponentMarks: { [number: string]: number };
}

// ============================================================================
// X01 CARD EFFECTS
// ============================================================================

export function applyX01GoodCard(
  effect: string,
  context: X01ScoringContext,
  selectedSegment?: number,
  selectedSegments?: number[]
): number {
  let scoreModifier = 0;
  const turnTotal = context.turnDarts.reduce((a, b) => a + b, 0);

  switch (effect) {
    // GOOD CARDS
    case "Add 50 to turn total":
      scoreModifier = 50;
      break;

    case "Next treble = 3x value":
      // This needs to be applied during dart calculation
      // Handled in dart-level modification
      break;

    case "Block opponent penalties when on double":
      // Prevents opponent from playing BAD cards
      // Handled at match level
      break;

    case "50+ score = next turn +20":
      if (turnTotal >= 50) {
        scoreModifier = 20;
      }
      break;

    case "Free re-throw on missed double":
      // Allows replaying a dart
      // Handled at dart level
      break;

    case "60+ score = +20 bonus":
      if (turnTotal >= 60) {
        scoreModifier = 20;
      }
      break;

    case "All darts +20% value":
      scoreModifier = Math.floor(turnTotal * 0.2);
      break;

    case "Trebles +25% value":
      const trebles = context.turnDarts.filter((d) => d >= 51 && d <= 60); // Treble zone
      const trebleBonus = Math.floor(trebles.reduce((a, b) => a + b, 0) * 0.25);
      scoreModifier = trebleBonus;
      break;

    case "Previous 50+ = this +15":
      // Requires match history - handled at match level
      scoreModifier = 15;
      break;

    case "Selected segment +15":
      if (selectedSegment) {
        const segmentHits = context.turnDarts.filter(
          (d) => d === selectedSegment || d === selectedSegment + 20
        ).length;
        scoreModifier = segmentHits * 15;
      }
      break;

    case "Final dart 1.5x if 40+":
      if (turnTotal >= 40 && context.turnDarts.length === 3) {
        const lastDart = context.turnDarts[2];
        scoreModifier = Math.floor(lastDart * 0.5);
      }
      break;

    case "Two segments +20":
      if (selectedSegments && selectedSegments.length === 2) {
        const hits = context.turnDarts.filter(
          (d) =>
            selectedSegments.includes(d) ||
            selectedSegments.includes(d - 20)
        ).length;
        scoreModifier = hits * 20;
      }
      break;

    case "Lead = next +10":
      // Requires match state - handled at match level
      scoreModifier = 10;
      break;

    case "Lowest dart +10":
      const minDart = Math.min(...context.turnDarts);
      scoreModifier = 10;
      break;

    case "2+ trebles = +30":
      const trebleCount = context.turnDarts.filter(
        (d) => d >= 51 && d <= 60
      ).length;
      if (trebleCount >= 2) {
        scoreModifier = 30;
      }
      break;

    case "Down 100+ = next 2x":
      // Handled at match level with match state
      // This would double the next turn's score
      break;

    case "Doubles 1.2x until checkout":
      // Handled in dart-level modification
      break;

    case "Final double +10 value":
      if (context.isOnDouble) {
        scoreModifier = 10;
      }
      break;
  }

  return scoreModifier;
}

export function applyX01BadCard(
  effect: string,
  context: X01ScoringContext
): number {
  let scoreModifier = 0;
  const turnTotal = context.turnDarts.reduce((a, b) => a + b, 0);

  switch (effect) {
    // BAD CARDS
    case "Next turn -40":
      scoreModifier = -40;
      break;

    case "Random dart = 0":
      const randomIndex = Math.floor(Math.random() * context.turnDarts.length);
      scoreModifier = -context.turnDarts[randomIndex];
      break;

    case "Treble 20 blocked":
      const t20Count = context.turnDarts.filter((d) => d === 60).length;
      scoreModifier = -t20Count * 20; // Remove treble 20s
      break;

    case "All darts 50%":
      scoreModifier = -Math.floor(turnTotal * 0.5);
      break;

    case "Next turn -30":
      scoreModifier = -30;
      break;

    case "Drop lowest dart":
      const minDart = Math.min(...context.turnDarts);
      scoreModifier = -minDart;
      break;

    case "Next turn -50":
      scoreModifier = -50;
      break;

    case "Random dart to adjacent":
      // Replace one dart with adjacent segment value
      const randomIdx = Math.floor(Math.random() * context.turnDarts.length);
      const dartVal = context.turnDarts[randomIdx];
      // Simplified: reduce by 25% (approximating adjacent segment)
      scoreModifier = -Math.floor(dartVal * 0.25);
      break;

    case "Last dart = 0":
      scoreModifier = -context.turnDarts[context.turnDarts.length - 1];
      break;

    case "Only 1-10 score":
      const invalidDarts = context.turnDarts.filter((d) => d > 10);
      scoreModifier = -invalidDarts.reduce((a, b) => a + b, 0);
      break;

    case "Bull blocked":
      const bullCount = context.turnDarts.filter((d) => d === 50).length;
      scoreModifier = -bullCount * 50;
      break;

    case "Next -30":
      scoreModifier = -30;
      break;

    case "Trebles = singles":
      // Convert trebles (51-60) to singles (1-20)
      const treblesToConvert = context.turnDarts.filter((d) => d >= 51 && d <= 60);
      scoreModifier = -treblesToConvert.reduce((a, b) => a + (b - 30), 0); // Remove the +30 from treble
      break;

    case "Remove streaks":
      // Handled at match level
      break;

    case "Outer ring only":
      const outerOnly = context.turnDarts.filter((d) => d < 20); // Inner ring only
      scoreModifier = -outerOnly.reduce((a, b) => a + b, 0);
      break;

    case "Next -80":
      scoreModifier = -80;
      break;

    case "Doubles = singles":
      const doublesToConvert = context.turnDarts.filter((d) => d >= 21 && d <= 40);
      scoreModifier = -doublesToConvert.reduce((a, b) => a + (b / 2), 0);
      break;

    case "Can't score on double until 20+":
      if (context.isOnDouble && turnTotal < 20) {
        scoreModifier = -turnTotal;
      }
      break;

    case "Singles = 0 (only doubles/trebles)":
      const singleDarts = context.turnDarts.filter((d) => d < 20 || (d > 40 && d < 51));
      scoreModifier = -singleDarts.reduce((a, b) => a + b, 0);
      break;
  }

  return scoreModifier;
}

// ============================================================================
// CRICKET CARD EFFECTS
// ============================================================================

export function applyCricketGoodCard(
  effect: string,
  context: CricketScoringContext,
  selectedNumbers?: number[]
): { marksModified: { [key: number]: number }; pointsBonus: number } {
  let marksModified: { [key: number]: number } = { ...context.playerMarks };
  let pointsBonus = 0;

  switch (effect) {
    case "Auto-mark chosen number":
      if (selectedNumbers && selectedNumbers[0]) {
        const num = selectedNumbers[0];
        marksModified[num] = (marksModified[num] || 0) + 1;
      }
      break;

    case "Marks 2x":
      // All marks this turn count as 2x
      Object.keys(marksModified).forEach((num) => {
        marksModified[num] *= 2;
      });
      break;

    case "Lock 3 numbers":
      if (selectedNumbers) {
        selectedNumbers.forEach((num) => {
          marksModified[num] = (marksModified[num] || 0) + 1;
        });
      }
      break;

    case "Close = +20 points":
      // Bonus points when closing numbers
      pointsBonus = 20;
      break;

    case "No wasted marks":
      // All marks automatically count (no waste)
      // Handled at game logic level
      break;

    case "Each close +10":
      pointsBonus = 10;
      break;

    case "Any hit = mark":
      // All darts count as marks
      // Handled at dart level
      break;

    case "Bull = 2x mark":
      if (marksModified[50]) {
        marksModified[50] *= 2;
      }
      break;

    case "Mark = +5 points":
      const totalMarks = Object.values(marksModified).reduce((a, b) => a + b, 0);
      pointsBonus = totalMarks * 5;
      break;

    case "Marks never wasted":
      // Game logic level
      break;

    case "Closing -1 mark":
      // Easier closing - handled at logic level
      break;

    case "All darts = marks":
      // Forced to mark - logic level
      break;

    case "Full set = +25":
      // 3 numbers in set marked
      pointsBonus = 25;
      break;

    case "High marks 2x":
      // 19-20 count double
      if (marksModified[19]) marksModified[19] *= 2;
      if (marksModified[20]) marksModified[20] *= 2;
      break;

    case "First close +15":
      pointsBonus = 15;
      break;

    case "Control = +20":
      // More closed numbers than opponent
      pointsBonus = 20;
      break;

    case "19-20 only, 2x":
      // Only count 19-20 marks, at 2x value
      marksModified = {};
      if (context.playerMarks[19]) marksModified[19] = context.playerMarks[19] * 2;
      if (context.playerMarks[20]) marksModified[20] = context.playerMarks[20] * 2;
      break;

    case "Streak = +10 each":
      // Consecutive marks bonus
      pointsBonus = 10; // Per consecutive mark
      break;

    case "Ahead = 2x marks":
      // Marks count double when ahead
      // Requires match state
      Object.keys(marksModified).forEach((num) => {
        marksModified[num] *= 2;
      });
      break;

    case "3 same = +40":
      // Hitting same number 3 times
      pointsBonus = 40;
      break;
  }

  return { marksModified, pointsBonus };
}

export function applyCricketBadCard(
  effect: string,
  context: CricketScoringContext
): { marksReduced: { [key: number]: number }; pointsReduction: number } {
  let marksReduced: { [key: number]: number } = { ...context.playerMarks };
  let pointsReduction = 0;

  switch (effect) {
    case "Marks 50%":
      Object.keys(marksReduced).forEach((num) => {
        marksReduced[num] = Math.floor(marksReduced[num] * 0.5);
      });
      break;

    case "Lose next mark":
      // -1 to next mark attempt
      // Logic level
      break;

    case "20,19,18 blocked":
      marksReduced[20] = 0;
      marksReduced[19] = 0;
      marksReduced[18] = 0;
      break;

    case "15-17 only":
      Object.keys(marksReduced).forEach((num) => {
        const n = parseInt(num);
        if (n < 15 || n > 17) {
          marksReduced[n] = 0;
        }
      });
      break;

    case "Marks 75%":
      Object.keys(marksReduced).forEach((num) => {
        marksReduced[num] = Math.floor(marksReduced[num] * 0.75);
      });
      break;

    case "20 blocked":
      marksReduced[20] = 0;
      break;

    case "Random dart no mark":
      // -1 random mark
      const keys = Object.keys(marksReduced);
      if (keys.length > 0) {
        const random = keys[Math.floor(Math.random() * keys.length)];
        marksReduced[random] = Math.max(0, marksReduced[random] - 1);
      }
      break;

    case "Lose 2 marks":
      pointsReduction = 2; // Lose 2 marks total
      break;

    case "Bull only":
      Object.keys(marksReduced).forEach((num) => {
        if (num !== "50") {
          marksReduced[num] = 0;
        }
      });
      break;

    case "Last dart no mark":
      // Last dart doesn't count
      // Logic level
      break;

    case "Opponent 2x marks":
      // Opponent's marks count double
      // Match level
      break;

    case "Bull blocked":
      marksReduced[50] = 0;
      break;

    case "1 number only":
      // Can only mark 1 number
      // Logic level
      break;

    case "Marks 50%":
      Object.keys(marksReduced).forEach((num) => {
        marksReduced[num] = Math.floor(marksReduced[num] * 0.5);
      });
      break;

    case "No closing":
      // Can't close numbers
      // Logic level
      break;

    case "Random marks":
      // Marks apply to random numbers
      // Logic level
      break;

    case "15-17 only":
      Object.keys(marksReduced).forEach((num) => {
        const n = parseInt(num);
        if (n < 15 || n > 17) {
          marksReduced[n] = 0;
        }
      });
      break;

    case "Can't mark":
      marksReduced = {};
      break;

    case "Singles = 0":
      // Only double/triple counts
      // Logic level
      break;

    case "Outer only":
      // Only outer ring
      // Logic level
      break;

    case "Total lockdown":
      marksReduced = {};
      break;
  }

  return { marksReduced, pointsReduction };
}

// ============================================================================
// WILDCARD EFFECTS
// ============================================================================

export function applyWildcardGoodCard(
  effect: string,
  turnTotal?: number,
  isWinning?: boolean
): number {
  let modifier = 0;

  switch (effect) {
    case "50/50 +30/-30":
      modifier = Math.random() < 0.5 ? 30 : -30;
      break;

    case "Leg win = +25":
      modifier = 25;
      break;

    case "First dart 1.5x":
      // Applied at dart level
      break;

    case "Down 50+ = 2x":
      // Applied at match level
      break;

    case "Success = +5 next":
      modifier = 5;
      break;

    case "40+ = +15 next":
      if (turnTotal && turnTotal >= 40) {
        modifier = 15;
      }
      break;

    case "Leg loss = +40":
      modifier = 40;
      break;

    case "+40 to turn":
      modifier = 40;
      break;

    case "Block 1 penalty":
      // Match level
      break;

    case "This + next +20":
      modifier = 40; // Applies to both turns
      break;
  }

  return modifier;
}

export function applyWildcardBadCard(
  effect: string,
  turnTotal?: number
): number {
  let modifier = 0;

  switch (effect) {
    case "Next -25":
      modifier = -25;
      break;

    case "Next -45":
      modifier = -45;
      break;

    case "Random = 0":
      modifier = -Math.floor(Math.random() * 20);
      break;

    case "Win bonus removed":
      // Match level
      break;

    case "Next -35":
      modifier = -35;
      break;

    case "Remove bonuses":
      // Match level
      break;

    case "Darts 75%":
      modifier = -Math.floor((turnTotal || 0) * 0.25);
      break;

    case "Darts 50%":
      modifier = -Math.floor((turnTotal || 0) * 0.5);
      break;

    case "Last 2 = 0":
      // Dart level
      break;

    case "Next -100 or lose close":
      modifier = -100;
      break;
  }

  return modifier;
}

// ============================================================================
// CARD VALIDATION - Check if card can be played in current context
// ============================================================================

export function validateCardCanPlay(
  cardEffect: string,
  gameMode: "X01" | "CRICKET",
  playerState: any
): { canPlay: boolean; reason?: string } {
  // X01 specific validations
  if (gameMode === "X01") {
    if (cardEffect.includes("on double") && !playerState.isOnDouble) {
      return {
        canPlay: false,
        reason: "You must be on a double to play this card",
      };
    }
  }

  // Cricket specific validations
  if (gameMode === "CRICKET") {
    if (cardEffect.includes("closing") && playerState.closedCount >= 3) {
      return {
        canPlay: false,
        reason: "All numbers are already closed",
      };
    }
  }

  return { canPlay: true };
}
