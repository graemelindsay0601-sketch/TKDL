/**
 * Card Clash bot deck generation.
 * Card Clash's "Solo vs CPU" now reuses Practice's actual bot roster
 * (Level Bot 1-20 / Play a Pro / Player Clone), so deck strength is derived
 * directly from the chosen bot's scoring average rather than a separate
 * simplified skill list.
 */

import { ALL_CARDS, type CardData } from "@/lib/cards-data";

const AVG_FLOOR = 18;
const AVG_CEIL = 110;

/** Maps a bot's scoring average (~18 pub-rookie to ~110 world-class) to a 1-10 deck-strength scale. */
export function avgToSkillLevel(avg: number): number {
  const t = Math.max(0, Math.min(1, (avg - AVG_FLOOR) / (AVG_CEIL - AVG_FLOOR)));
  return Math.max(1, Math.min(10, Math.round(t * 9) + 1));
}

export function generateBotCards(botAvg: number, gameMode: "X01" | "CRICKET"): CardData[] {
  const skillLevel = avgToSkillLevel(botAvg);

  const pool = (cardType: "GOOD" | "BAD") =>
    ALL_CARDS.filter(c => c.mode !== "chaos_lab" && (c.category === `${gameMode} ${cardType}` || c.category === `WILDCARD ${cardType}`));

  const goodPool = pool("GOOD");
  const badPool = pool("BAD");

  // Higher skill -> more GOOD cards, biased toward rarer picks
  const goodCount = Math.max(1, Math.min(3, Math.round((skillLevel / 10) * 4)));
  const badCount = 4 - goodCount;

  const rarityWeight = (rarity: CardData["rarity"]) => {
    if (skillLevel >= 8) return rarity === "LEGENDARY" ? 3 : rarity === "RARE" ? 2 : 1;
    if (skillLevel >= 5) return rarity === "RARE" ? 2 : 1;
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
