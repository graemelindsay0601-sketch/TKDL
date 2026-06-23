/**
 * X01 Card Effects Calculator
 * Applies card effects to scores during X01 matches
 */

export interface CardEffect {
  type: "score_modifier" | "opponent_modifier" | "double_requirement";
  value: number;
  target: "player" | "opponent";
  description: string;
}

/**
 * Calculate X01 card effect based on card definition
 */
export function calculateX01CardEffect(card: any): CardEffect | null {
  if (!card) return null;

  const cardName = (card.name || "").toLowerCase();
  const cardEffect = (card.effect_text || "").toLowerCase();
  const isGood = card.good_or_bad === "GOOD";

  // GOOD Cards - Help finish
  if (isGood) {
    if (cardName.includes("lower") || cardEffect.includes("lower")) {
      return {
        type: "score_modifier",
        value: -15, // Player's score goes down (closer to finish)
        target: "player",
        description: "Lower your remaining score",
      };
    }
    if (cardName.includes("close out") || cardEffect.includes("close out")) {
      return {
        type: "score_modifier",
        value: -25, // Bigger boost
        target: "player",
        description: "Significant score reduction",
      };
    }
    if (cardName.includes("double") || cardEffect.includes("double finish")) {
      return {
        type: "double_requirement",
        value: 0, // Just allows any finish
        target: "player",
        description: "Finish without double requirement",
      };
    }
    // Default good card: small score reduction
    return {
      type: "score_modifier",
      value: -10,
      target: "player",
      description: "Reduce your score",
    };
  }

  // BAD Cards - Hinder opponent
  if (!isGood) {
    if (cardName.includes("higher") || cardEffect.includes("higher")) {
      return {
        type: "score_modifier",
        value: 15, // Opponent score goes up
        target: "opponent",
        description: "Opponent score increases",
      };
    }
    if (cardName.includes("bust")) {
      return {
        type: "score_modifier",
        value: 50, // Large penalty
        target: "opponent",
        description: "Opponent takes major penalty",
      };
    }
    // Default bad card: small opponent penalty
    return {
      type: "score_modifier",
      value: 10,
      target: "opponent",
      description: "Opponent score increases",
    };
  }

  return null;
}

/**
 * Apply X01 card effect to scores
 */
export function applyX01Effect(
  scores: [number, number],
  effect: CardEffect,
  currentTurn: 0 | 1
): [number, number] {
  if (!effect) return scores;

  const newScores: [number, number] = [...scores];

  if (effect.type === "score_modifier") {
    if (effect.target === "player") {
      // Apply to current player's score
      newScores[currentTurn] = Math.max(0, newScores[currentTurn] + effect.value);
    } else {
      // Apply to opponent's score
      const opponent = currentTurn === 0 ? 1 : 0;
      newScores[opponent] = Math.max(0, newScores[opponent] + effect.value);
    }
  }

  // double_requirement type doesn't modify score in this simple version

  return newScores;
}

/**
 * Format effect for display
 */
export function formatCardEffectDisplay(effect: CardEffect, cardName: string): string {
  if (effect.type === "score_modifier") {
    const sign = effect.value < 0 ? "" : "+";
    const targetText = effect.target === "player" ? "Your" : "Opponent's";
    return `${cardName}: ${targetText} score ${sign}${effect.value}`;
  }

  if (effect.type === "double_requirement") {
    return `${cardName}: Finish requirement removed`;
  }

  return `${cardName}: ${effect.description}`;
}
