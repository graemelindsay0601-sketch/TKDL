// Challenge seed data for Card Clash
// These are the actual challenge definitions that get seeded into the database

export const DAILY_CHALLENGES = [
  {
    name: "Quick Start",
    description: "Win your first match of the day",
    target: 1,
    reward: 15,
    type: "wins",
  },
  {
    name: "Coin Collector",
    description: "Earn 100 coins",
    target: 100,
    reward: 20,
    type: "coins",
  },
  {
    name: "Card Master",
    description: "Use 5 cards in matches",
    target: 5,
    reward: 15,
    type: "cardsUsed",
  },
  {
    name: "Precision Play",
    description: "Hit 3 trebles in a single match",
    target: 3,
    reward: 20,
    type: "trebles",
  },
  {
    name: "Finishing Touch",
    description: "Finish a match with a double",
    target: 1,
    reward: 15,
    type: "doubles",
  },
  {
    name: "Streak Builder",
    description: "Win 2 matches in a row",
    target: 2,
    reward: 25,
    type: "winStreak",
  },
];

export const WEEKLY_CHALLENGES = [
  {
    name: "Weekly Warrior",
    description: "Win 5 matches this week",
    target: 5,
    reward: 50,
    type: "wins",
  },
  {
    name: "Coin Hoarder",
    description: "Earn 500 coins this week",
    target: 500,
    reward: 75,
    type: "coins",
  },
  {
    name: "Card Collector",
    description: "Collect 10 new cards",
    target: 10,
    reward: 100,
    type: "cardsCollected",
  },
  {
    name: "High Roller",
    description: "Score over 100 in a single match",
    target: 100,
    reward: 60,
    type: "highScore",
  },
  {
    name: "Perfect Aim",
    description: "Hit 20 trebles this week",
    target: 20,
    reward: 80,
    type: "trebles",
  },
  {
    name: "Tournament Champion",
    description: "Win 10 matches this week",
    target: 10,
    reward: 150,
    type: "wins",
  },
];
