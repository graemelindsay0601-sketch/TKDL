/**
 * Cricket Card Effects Calculator
 * Applies card effects to marks during Cricket matches
 */

export interface CricketCardEffect {
  type: "mark_modifier" | "opponent_marks_modifier" | "reopen_number";
  value: number;
  target: "player" | "opponent";
  targetNumber?: number; // For reopening specific numbers
  description: string;
}

/**
 * Cricket numbers: 15, 16, 17, 18, 19, 20, 25 (bull)
 * Marks per number: 0-3 only
 */
const CRICKET_NUMS = [20, 19, 18, 17, 16, 15, 25];
const CRICKET_NUM_INDEX: Record<number, number> = {
  20: 0, 19: 1, 18: 2, 17: 3, 16: 4, 15: 5, 25: 6,
};

/**
 * Calculate Cricket card effect based on card definition
 */
export function calculateCricketCardEffect(card: any): CricketCardEffect | null {
  if (!card) return null;

  const cardName = (card.name || "").toLowerCase();
  const cardEffect = (card.effect_text || "").toLowerCase();
  const isGood = card.good_or_bad === "GOOD";

  // GOOD Cards - Help player mark numbers
  if (isGood) {
    if (cardName.includes("instant mark") || cardEffect.includes("instant mark")) {
      return {
        type: "mark_modifier",
        value: 2, // Mark 2 segments on a number
        target: "player",
        description: "Instantly mark 2 segments on a number",
      };
    }
    if (cardName.includes("double mark") || cardEffect.includes("double mark")) {
      return {
        type: "mark_modifier",
        value: 3, // Close the number
        target: "player",
        description: "Instantly close a number",
      };
    }
    if (cardName.includes("reopen") || cardEffect.includes("reopen")) {
      return {
        type: "reopen_number",
        value: 0, // Reopen (set to 0)
        target: "opponent",
        description: "Reopen opponent's closed number",
      };
    }
    // Default good card: mark 1 segment
    return {
      type: "mark_modifier",
      value: 1,
      target: "player",
      description: "Mark 1 segment on a number",
    };
  }

  // BAD Cards - Hinder opponent marking
  if (!isGood) {
    if (cardName.includes("block") || cardEffect.includes("block")) {
      return {
        type: "opponent_marks_modifier",
        value: -1, // Remove a mark
        target: "opponent",
        description: "Remove one of opponent's marks",
      };
    }
    if (cardName.includes("close") || cardEffect.includes("close")) {
      return {
        type: "opponent_marks_modifier",
        value: -2, // Remove two marks
        target: "opponent",
        description: "Remove two of opponent's marks",
      };
    }
    // Default bad card: prevent marking
    return {
      type: "opponent_marks_modifier",
      value: -1,
      target: "opponent",
      description: "Hinder opponent marking",
    };
  }

  return null;
}

/**
 * Apply Cricket card effect to marks
 * Marks are arrays: [20marks, 19marks, 18marks, 17marks, 16marks, 15marks, 25marks]
 * Each can be 0, 1, 2, or 3 only
 */
export function applyCricketEffect(
  marks: number[][],
  effect: CricketCardEffect,
  currentTurn: 0 | 1,
  targetNumber?: number
): number[][] {
  if (!effect) return marks;

  const newMarks = marks.map(m => [...m]);

  if (effect.type === "mark_modifier") {
    if (effect.target === "player") {
      // Need target number from user input
      if (targetNumber === undefined || !(targetNumber in CRICKET_NUM_INDEX)) {
        return marks; // No number selected
      }
      const numIdx = CRICKET_NUM_INDEX[targetNumber];
      const currentMark = newMarks[currentTurn][numIdx];
      // Can't mark a closed number, cap at 3
      newMarks[currentTurn][numIdx] = Math.min(3, currentMark + effect.value);
    }
  }

  if (effect.type === "opponent_marks_modifier") {
    const opponent = currentTurn === 0 ? 1 : 0;
    if (targetNumber === undefined || !(targetNumber in CRICKET_NUM_INDEX)) {
      return marks; // No number selected
    }
    const numIdx = CRICKET_NUM_INDEX[targetNumber];
    const currentMark = newMarks[opponent][numIdx];
    // Remove marks but don't go below 0
    newMarks[opponent][numIdx] = Math.max(0, currentMark + effect.value);
  }

  if (effect.type === "reopen_number") {
    const opponent = currentTurn === 0 ? 1 : 0;
    if (targetNumber === undefined || !(targetNumber in CRICKET_NUM_INDEX)) {
      return marks; // No number selected
    }
    const numIdx = CRICKET_NUM_INDEX[targetNumber];
    // Reopen (set to 0) - only works on closed numbers
    if (newMarks[opponent][numIdx] === 3) {
      newMarks[opponent][numIdx] = 0;
    }
  }

  return newMarks;
}

/**
 * Format effect for display
 */
export function formatCricketEffectDisplay(effect: CricketCardEffect, cardName: string): string {
  if (effect.type === "mark_modifier") {
    const sign = effect.value > 0 ? "+" : "";
    const targetText = effect.target === "player" ? "Your" : "Opponent's";
    return `${cardName}: ${targetText} marks ${sign}${effect.value}`;
  }

  if (effect.type === "opponent_marks_modifier") {
    const action = effect.value > 0 ? "add" : "remove";
    return `${cardName}: ${action} opponent marks`;
  }

  if (effect.type === "reopen_number") {
    return `${cardName}: Reopen opponent's number`;
  }

  return `${cardName}: ${effect.description}`;
}

/**
 * Get available cricket numbers (don't change per card, always 15-20, 25/bull)
 */
export function getAvailableCricketNumbers(): number[] {
  return CRICKET_NUMS;
}
