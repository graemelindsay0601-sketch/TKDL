/**
 * Card Clash bot roster + bot deck generation.
 * Extracted so both the match launcher (Solo vs CPU) can share one
 * definition of what a "bot opponent" is.
 */

import { ALL_CARDS, type CardData } from "@/lib/cards-data";

export interface CardClashBot {
  id: string;
  name: string;
  avatar: string;
  description: string;
  skillLevel: number; // 1-10
}

export const CARD_CLASH_BOTS: CardClashBot[] = [
  { id: "bot-rookie", name: "Rookie Bot", avatar: "🤖", description: "Fresh off the production line — makes weak card picks", skillLevel: 1 },
  { id: "bot-steady", name: "Steady Eddie", avatar: "🎯", description: "Consistent but unremarkable — a fair warmup", skillLevel: 3 },
  { id: "bot-sharp", name: "Sharp Shooter", avatar: "🔥", description: "Knows how to play a good card at the right time", skillLevel: 5 },
  { id: "bot-cyber", name: "Cyber Ace", avatar: "⚡", description: "Aggressive deck, favours rare cards", skillLevel: 7 },
  { id: "bot-mastermind", name: "Master Mind", avatar: "🧠", description: "Nearly unbeatable — stacks legendary cards", skillLevel: 9 },
  { id: "bot-legend", name: "Legend Bot", avatar: "👑", description: "The ultimate test. Only the best survive", skillLevel: 10 },
];

export function generateBotCards(bot: CardClashBot, gameMode: "X01" | "CRICKET"): CardData[] {
  const pool = (cardType: "GOOD" | "BAD") =>
    ALL_CARDS.filter(c => c.category === `${gameMode} ${cardType}` || c.category === `WILDCARD ${cardType}`);

  const goodPool = pool("GOOD");
  const badPool = pool("BAD");

  // Higher skill -> more GOOD cards and a bias toward rarer cards
  const goodCount = Math.max(1, Math.min(3, Math.round((bot.skillLevel / 10) * 4)));
  const badCount = 4 - goodCount;

  const rarityWeight = (rarity: CardData["rarity"]) => {
    if (bot.skillLevel >= 8) return rarity === "LEGENDARY" ? 3 : rarity === "RARE" ? 2 : 1;
    if (bot.skillLevel >= 5) return rarity === "RARE" ? 2 : 1;
    return rarity === "COMMON" ? 2 : 1;
  };

  const weightedPick = (pool: CardData[], count: number): CardData[] => {
    const bag: CardData[] = [];
    for (const c of pool) {
      for (let i = 0; i < rarityWeight(c.rarity); i++) bag.push(c);
    }
    const picked: CardData[] = [];
    const used = new Set<number>();
    let attempts = 0;
    while (picked.length < count && attempts < 200 && bag.length > 0) {
      attempts++;
      const c = bag[Math.floor(Math.random() * bag.length)];
      if (!used.has(c.id)) {
        used.add(c.id);
        picked.push(c);
      }
    }
    return picked;
  };

  return [...weightedPick(goodPool, goodCount), ...weightedPick(badPool, badCount)];
}
