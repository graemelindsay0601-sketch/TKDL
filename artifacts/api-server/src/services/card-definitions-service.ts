import { db } from "@workspace/db";
import { cardDefinitionsTable } from "@workspace/db";

// Seed all 100 card definitions
const CARD_DEFINITIONS = [
  // X01 GOOD (20)
  { name: "Power Surge +50", description: "Add 50 to your turn total", gameMode: "X01", cardType: "GOOD", rarity: "COMMON", effect: "Add 50 to turn total" },
  { name: "Treble Hunter", description: "Next treble counts as 3x value", gameMode: "X01", cardType: "GOOD", rarity: "RARE", effect: "Next treble = 3x value" },
  { name: "Unstoppable Checkout", description: "When on double, opponent can't play penalty cards this turn", gameMode: "X01", cardType: "GOOD", rarity: "RARE", effect: "Block opponent penalties when on double" },
  { name: "Banking Strategy", description: "If you score 50+ (not on double), next turn gets +20", gameMode: "X01", cardType: "GOOD", rarity: "COMMON", effect: "50+ score = next turn +20" },
  { name: "Checkout Confidence", description: "If on double, you get 1 free re-throw if you miss", gameMode: "X01", cardType: "GOOD", rarity: "RARE", effect: "Free re-throw on missed double" },
  { name: "High Roller", description: "If you score 60+ this turn, get +20 bonus", gameMode: "X01", cardType: "GOOD", rarity: "COMMON", effect: "60+ score = +20 bonus" },
  { name: "Perfect Round", description: "All 3 darts count at 20% higher value", gameMode: "X01", cardType: "GOOD", rarity: "RARE", effect: "All darts +20% value" },
  { name: "Accuracy Zone", description: "Darts in treble zone score 25% more", gameMode: "X01", cardType: "GOOD", rarity: "RARE", effect: "Trebles +25% value" },
  { name: "Momentum Builder", description: "If previous turn was 50+, this turn gets +15", gameMode: "X01", cardType: "GOOD", rarity: "COMMON", effect: "Previous 50+ = this +15" },
  { name: "Target Master", description: "Popup: pick a segment - darts there score +15 value", gameMode: "X01", cardType: "GOOD", rarity: "RARE", effect: "Selected segment +15" },
  { name: "Last Stand", description: "Final dart scores 1.5x if turn total reaches 40+", gameMode: "X01", cardType: "GOOD", rarity: "COMMON", effect: "Final dart 1.5x if 40+" },
  { name: "Focus Fire", description: "Popup: pick 2 segments - darts there get +20 value", gameMode: "X01", cardType: "GOOD", rarity: "RARE", effect: "Two segments +20" },
  { name: "Victory Rush", description: "Each turn you lead, next turn gets +10 bonus", gameMode: "X01", cardType: "GOOD", rarity: "COMMON", effect: "Lead = next +10" },
  { name: "Safe Zone", description: "Your lowest-scoring dart this turn gets +10", gameMode: "X01", cardType: "GOOD", rarity: "COMMON", effect: "Lowest dart +10" },
  { name: "Bull's Eye", description: "Next bullseye counts as 100 points (instead of 50)", gameMode: "X01", cardType: "GOOD", rarity: "LEGENDARY", effect: "Bull = 100 points" },
  { name: "Treble Rush", description: "Hit 2+ trebles = entire turn scores +30", gameMode: "X01", cardType: "GOOD", rarity: "RARE", effect: "2+ trebles = +30" },
  { name: "Comeback Card", description: "If losing by 100+, next turn doubled in value", gameMode: "X01", cardType: "GOOD", rarity: "LEGENDARY", effect: "Down 100+ = next 2x" },
  { name: "Exact Finish", description: "In final 50 points, if you hit your double, opponent can't play penalty cards next turn", gameMode: "X01", cardType: "GOOD", rarity: "RARE", effect: "Block penalties on finish" },
  { name: "Double Closer", description: "Your doubles score 1.2x until you checkout", gameMode: "X01", cardType: "GOOD", rarity: "RARE", effect: "Doubles 1.2x until checkout" },
  { name: "Finishing Touch", description: "If on double, that double scores +10 value", gameMode: "X01", cardType: "GOOD", rarity: "COMMON", effect: "Final double +10" },

  // X01 BAD (20)
  { name: "Rust Hands -40", description: "Next turn score reduced by 40", gameMode: "X01", cardType: "BAD", rarity: "COMMON", effect: "Next turn -40" },
  { name: "Wild Throw", description: "One random dart scores 0", gameMode: "X01", cardType: "BAD", rarity: "COMMON", effect: "Random dart = 0" },
  { name: "Brick Wall", description: "Can't score on treble 20 (counts as 0)", gameMode: "X01", cardType: "BAD", rarity: "RARE", effect: "Treble 20 blocked" },
  { name: "Shaky Aim", description: "All darts score at 50% value", gameMode: "X01", cardType: "BAD", rarity: "COMMON", effect: "All darts 50%" },
  { name: "Off Balance", description: "Next turn reduced by 30", gameMode: "X01", cardType: "BAD", rarity: "COMMON", effect: "Next turn -30" },
  { name: "Distraction", description: "Lowest dart value dropped from turn", gameMode: "X01", cardType: "BAD", rarity: "RARE", effect: "Drop lowest dart" },
  { name: "Bad Luck -50", description: "Next turn reduced by 50", gameMode: "X01", cardType: "BAD", rarity: "COMMON", effect: "Next turn -50" },
  { name: "Ricochet", description: "One random dart scores as if hit adjacent segment", gameMode: "X01", cardType: "BAD", rarity: "RARE", effect: "Random dart to adjacent" },
  { name: "Tired Hands", description: "Final dart counts as 0", gameMode: "X01", cardType: "BAD", rarity: "COMMON", effect: "Last dart = 0" },
  { name: "Penalty Zone", description: "Can only score on low zones (1-10)", gameMode: "X01", cardType: "BAD", rarity: "RARE", effect: "Only 1-10 score" },
  { name: "Blocked Bullseye", description: "Can't score bullseye (counts as 0)", gameMode: "X01", cardType: "BAD", rarity: "COMMON", effect: "Bull blocked" },
  { name: "Cold Hands", description: "Next turn reduced by 60", gameMode: "X01", cardType: "BAD", rarity: "RARE", effect: "Next turn -60" },
  { name: "Energy Drain", description: "Next turn reduced by 30", gameMode: "X01", cardType: "BAD", rarity: "COMMON", effect: "Next -30" },
  { name: "Bad Aim", description: "Trebles count as singles", gameMode: "X01", cardType: "BAD", rarity: "COMMON", effect: "Trebles = singles" },
  { name: "Momentum Breaker", description: "Cancel any scoring streak bonus they had", gameMode: "X01", cardType: "BAD", rarity: "RARE", effect: "Remove streaks" },
  { name: "Outer Only", description: "Darts only count if in outer ring", gameMode: "X01", cardType: "BAD", rarity: "COMMON", effect: "Outer ring only" },
  { name: "Pressure Cooker", description: "Next turn reduced by 80", gameMode: "X01", cardType: "BAD", rarity: "LEGENDARY", effect: "Next -80" },
  { name: "Doubles Don't Count", description: "Doubles count as singles this turn only (D20 = 20, not double)", gameMode: "X01", cardType: "BAD", rarity: "RARE", effect: "Doubles = singles" },
  { name: "Trapped", description: "Can't score on any double until you score 20+ elsewhere", gameMode: "X01", cardType: "BAD", rarity: "RARE", effect: "Doubles locked until 20+" },
  { name: "Low Blow", description: "Single hits count as 0 (only doubles/trebles score)", gameMode: "X01", cardType: "BAD", rarity: "COMMON", effect: "Singles = 0" },

  // CRICKET GOOD (20)
  { name: "Instant Mark", description: "Popup: select a number (15-20, 25, 50) - auto-marks it", gameMode: "CRICKET", cardType: "GOOD", rarity: "COMMON", effect: "Auto-mark chosen number" },
  { name: "Double Strike", description: "Your marks count as 2x this turn", gameMode: "CRICKET", cardType: "GOOD", rarity: "COMMON", effect: "Marks 2x" },
  { name: "Sniper Lock", description: "Popup: select 3 numbers - guaranteed marks on those only", gameMode: "CRICKET", cardType: "GOOD", rarity: "RARE", effect: "Lock 3 numbers" },
  { name: "Closing Speed", description: "When you close a number, score 20 points immediately", gameMode: "CRICKET", cardType: "GOOD", rarity: "LEGENDARY", effect: "Close = +20 points" },
  { name: "Mark Master", description: "All your marks automatically count (no waste)", gameMode: "CRICKET", cardType: "GOOD", rarity: "COMMON", effect: "No wasted marks" },
  { name: "Scoring Surge", description: "Each closed number = +10 points to your score", gameMode: "CRICKET", cardType: "GOOD", rarity: "COMMON", effect: "Each close +10" },
  { name: "Number Hunter", description: "Pick one number - all hits count as marks (even if closed)", gameMode: "CRICKET", cardType: "GOOD", rarity: "RARE", effect: "Any hit = mark" },
  { name: "Bullseye Blitz", description: "Every bull/25 hit counts as double mark", gameMode: "CRICKET", cardType: "GOOD", rarity: "RARE", effect: "Bull = 2x mark" },
  { name: "Mark Momentum", description: "Each mark you score = +5 points bonus", gameMode: "CRICKET", cardType: "GOOD", rarity: "COMMON", effect: "Mark = +5 points" },
  { name: "Precision Marks", description: "Your marks can't be wasted - always count", gameMode: "CRICKET", cardType: "GOOD", rarity: "RARE", effect: "Marks never wasted" },
  { name: "Final Push", description: "If close to closing, next number needs -1 fewer marks", gameMode: "CRICKET", cardType: "GOOD", rarity: "COMMON", effect: "Closing -1 mark" },
  { name: "All In", description: "All 3 darts MUST hit same number, but all count as marks", gameMode: "CRICKET", cardType: "GOOD", rarity: "LEGENDARY", effect: "All darts = marks" },
  { name: "Perfect Set", description: "Mark all 3 numbers of your set = +25 bonus", gameMode: "CRICKET", cardType: "GOOD", rarity: "RARE", effect: "Full set = +25" },
  { name: "Mark Multiplier", description: "Marks on high numbers (19, 20) count as 2x", gameMode: "CRICKET", cardType: "GOOD", rarity: "COMMON", effect: "High marks 2x" },
  { name: "Closing Bonus", description: "First number you close this turn = +15 points", gameMode: "CRICKET", cardType: "GOOD", rarity: "COMMON", effect: "First close +15" },
  { name: "Board Control", description: "Player with more closed numbers = +20 points", gameMode: "CRICKET", cardType: "GOOD", rarity: "RARE", effect: "Control = +20" },
  { name: "High Value Marks", description: "Only 19-20 marks count, but worth 2x each", gameMode: "CRICKET", cardType: "GOOD", rarity: "COMMON", effect: "19-20 only, 2x" },
  { name: "Mark Rush", description: "Each consecutive mark adds +10 points", gameMode: "CRICKET", cardType: "GOOD", rarity: "COMMON", effect: "Streak = +10 each" },
  { name: "Victory Marks", description: "Marks when you're ahead count as 2x value", gameMode: "CRICKET", cardType: "GOOD", rarity: "RARE", effect: "Ahead = 2x marks" },
  { name: "Triple Threat", description: "If you mark the same number 3 times this turn, get +40 bonus", gameMode: "CRICKET", cardType: "GOOD", rarity: "LEGENDARY", effect: "3 same = +40" },

  // CRICKET BAD (20)
  { name: "Bad Aim", description: "Marks count at 50% value", gameMode: "CRICKET", cardType: "BAD", rarity: "COMMON", effect: "Marks 50%" },
  { name: "Distraction", description: "Lose your next number mark", gameMode: "CRICKET", cardType: "BAD", rarity: "RARE", effect: "Lose next mark" },
  { name: "Out of Position", description: "Can't hit high-value numbers (20, 19, 18)", gameMode: "CRICKET", cardType: "BAD", rarity: "COMMON", effect: "20,19,18 blocked" },
  { name: "Penalty Zone", description: "Marks must be on lower numbers only (15-17)", gameMode: "CRICKET", cardType: "BAD", rarity: "RARE", effect: "15-17 only" },
  { name: "Shaky Throws", description: "Marks count as 0.75x value", gameMode: "CRICKET", cardType: "BAD", rarity: "COMMON", effect: "Marks 75%" },
  { name: "Block 20", description: "Can't mark 20 (counts as 0)", gameMode: "CRICKET", cardType: "BAD", rarity: "COMMON", effect: "20 blocked" },
  { name: "Wasted Darts", description: "One random dart scores no mark", gameMode: "CRICKET", cardType: "BAD", rarity: "COMMON", effect: "Random dart = no mark" },
  { name: "Mark Decay", description: "Lose 2 marks from current numbers", gameMode: "CRICKET", cardType: "BAD", rarity: "RARE", effect: "Lose 2 marks" },
  { name: "Off Target", description: "Only marks on bull/25 count", gameMode: "CRICKET", cardType: "BAD", rarity: "COMMON", effect: "Bull only" },
  { name: "Tired Hands", description: "Last dart scores no mark", gameMode: "CRICKET", cardType: "BAD", rarity: "COMMON", effect: "Last dart no mark" },
  { name: "Marked Man", description: "Opponent's marks count as 2x against you", gameMode: "CRICKET", cardType: "BAD", rarity: "RARE", effect: "Opponent 2x marks" },
  { name: "Block Bull", description: "Can't mark bull/25 (counts as 0)", gameMode: "CRICKET", cardType: "BAD", rarity: "COMMON", effect: "Bull blocked" },
  { name: "Lock Down", description: "Can only mark 1 number this turn", gameMode: "CRICKET", cardType: "BAD", rarity: "RARE", effect: "1 number only" },
  { name: "Double Penalty", description: "Marks count at 0.5x value", gameMode: "CRICKET", cardType: "BAD", rarity: "COMMON", effect: "Marks 50%" },
  { name: "Closing Blocked", description: "Can't close any numbers (marks don't count toward closing)", gameMode: "CRICKET", cardType: "BAD", rarity: "RARE", effect: "No closing" },
  { name: "Random Chaos", description: "Your marks apply to random numbers (not your choice)", gameMode: "CRICKET", cardType: "BAD", rarity: "RARE", effect: "Random marks" },
  { name: "Low Marks Only", description: "Can only mark lower numbers (15-17)", gameMode: "CRICKET", cardType: "BAD", rarity: "COMMON", effect: "15-17 only" },
  { name: "Total Lockdown", description: "Can't mark any numbers this turn", gameMode: "CRICKET", cardType: "BAD", rarity: "LEGENDARY", effect: "No marks" },
  { name: "Low Blow", description: "Single marks count as 0 (only double/treble marks count)", gameMode: "CRICKET", cardType: "BAD", rarity: "RARE", effect: "Singles = 0" },
  { name: "Zone Restriction", description: "Can only score marks on outer ring numbers", gameMode: "CRICKET", cardType: "BAD", rarity: "COMMON", effect: "Outer only" },

  // WILDCARDS GOOD (10)
  { name: "Coin Flip", description: "50/50 chance: +30 bonus OR opponent gets -30. Random choice applied", gameMode: "WILDCARD", cardType: "GOOD", rarity: "COMMON", effect: "50/50 +30/-30" },
  { name: "Lucky Streak", description: "If you won the previous leg, gain +25 bonus this leg", gameMode: "WILDCARD", cardType: "GOOD", rarity: "COMMON", effect: "Leg win = +25" },
  { name: "Perfect Throw", description: "Your first dart of turn counts as 1.5x value", gameMode: "WILDCARD", cardType: "GOOD", rarity: "COMMON", effect: "First dart 1.5x" },
  { name: "Clutch Factor", description: "If behind by 50+, next turn doubled in value", gameMode: "WILDCARD", cardType: "GOOD", rarity: "RARE", effect: "Down 50+ = 2x" },
  { name: "Hot Hand", description: "Each successful dart adds +5 bonus to next", gameMode: "WILDCARD", cardType: "GOOD", rarity: "COMMON", effect: "Success = +5 next" },
  { name: "Momentum", description: "If scoring 40+ this turn, next turn gets +15", gameMode: "WILDCARD", cardType: "GOOD", rarity: "RARE", effect: "40+ = +15 next" },
  { name: "Phoenix Rising", description: "If lost the previous leg, gain +40 bonus this leg", gameMode: "WILDCARD", cardType: "GOOD", rarity: "RARE", effect: "Leg loss = +40" },
  { name: "Sudden Surge", description: "Gain +40 to your turn total (applies before turn starts)", gameMode: "WILDCARD", cardType: "GOOD", rarity: "COMMON", effect: "+40 to turn" },
  { name: "Unstoppable Force", description: "Opponent's next penalty card is nullified (doesn't apply)", gameMode: "WILDCARD", cardType: "GOOD", rarity: "RARE", effect: "Block 1 penalty" },
  { name: "Perfect Match", description: "This turn and next turn both count as +20 bonus each", gameMode: "WILDCARD", cardType: "GOOD", rarity: "LEGENDARY", effect: "This + next +20" },

  // WILDCARDS BAD (10)
  { name: "Bad Omen", description: "Next turn reduced by 25", gameMode: "WILDCARD", cardType: "BAD", rarity: "COMMON", effect: "Next -25" },
  { name: "Curse", description: "Next turn reduced by 45", gameMode: "WILDCARD", cardType: "BAD", rarity: "RARE", effect: "Next -45" },
  { name: "Slip Up", description: "One random dart scores 0", gameMode: "WILDCARD", cardType: "BAD", rarity: "COMMON", effect: "Random = 0" },
  { name: "Deflate", description: "If winning, lose all winning bonus this turn", gameMode: "WILDCARD", cardType: "BAD", rarity: "RARE", effect: "Win bonus removed" },
  { name: "Dark Cloud", description: "Next turn reduced by 35", gameMode: "WILDCARD", cardType: "BAD", rarity: "COMMON", effect: "Next -35" },
  { name: "Momentum Killer", description: "Cancel any momentum/streak bonus they had", gameMode: "WILDCARD", cardType: "BAD", rarity: "RARE", effect: "Remove bonuses" },
  { name: "Unlucky Night", description: "All darts count at 75% value", gameMode: "WILDCARD", cardType: "BAD", rarity: "COMMON", effect: "Darts 75%" },
  { name: "Hex", description: "All darts count at 50% value", gameMode: "WILDCARD", cardType: "BAD", rarity: "RARE", effect: "Darts 50%" },
  { name: "Wipeout", description: "Your last 2 darts score 0", gameMode: "WILDCARD", cardType: "BAD", rarity: "RARE", effect: "Last 2 = 0" },
  { name: "Total Annihilation", description: "Next turn reduced by 100 OR loses 1 closed number (whichever applies)", gameMode: "WILDCARD", cardType: "BAD", rarity: "LEGENDARY", effect: "Next -100 or lose close" },
];

export async function seedCardDefinitions() {
  try {
    // Check if cards already exist
    const existingCards = await db.select().from(cardDefinitionsTable).limit(1);
    if (existingCards.length > 0) {
      console.log("Cards already seeded");
      return;
    }

    for (const card of CARD_DEFINITIONS) {
      await db.insert(cardDefinitionsTable).values(card as any);
    }

    console.log(`Seeded ${CARD_DEFINITIONS.length} cards`);
  } catch (error) {
    console.error("Failed to seed cards:", error);
  }
}

export async function getAllCardDefinitions() {
  return await db.select().from(cardDefinitionsTable).where({ enabled: true });
}

export async function getCardsByGameMode(gameMode: "X01" | "CRICKET" | "WILDCARD") {
  return await db.select().from(cardDefinitionsTable).where({ gameMode, enabled: true });
}

export async function getCardById(cardId: string) {
  return await db.select().from(cardDefinitionsTable).where({ cardId }).limit(1);
}

export async function toggleCardAvailability(cardId: string, enabled: boolean) {
  await db.update(cardDefinitionsTable).set({ enabled }).where({ cardId });
}
