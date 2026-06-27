import type { AchievementDef } from "./achievements";

function fmtAch(key: string, icon: string, name: string, desc: string, n: number, cat: string): AchievementDef {
  const rarity = n >= 10 ? "Epic" : n >= 5 ? "Rare" : "Common";
  const priority = n >= 10 ? 60 : n >= 5 ? 40 : 20;
  return { key, name: `${icon} ${name}`, description: desc, icon, rarity, category: cat, hidden: false, priority, criteriaType: `FORMAT_WINS_${key}`, criteriaValue: n, engineType: "STAT_BASED" };
}

// ─── X01 Variants ────────────────────────────────────────────────────────────
const X01: AchievementDef[] = [
  fmtAch("501_DOUBLE_OUT_WINS_3",   "🎯","501 Double-Out Rookie",   "Win 3 501 Double-Out league matches",     3,  "Format"),
  fmtAch("501_DOUBLE_OUT_WINS_5",   "🎯","501 Double-Out Veteran",  "Win 5 501 Double-Out league matches",     5,  "Format"),
  fmtAch("501_DOUBLE_OUT_WINS_10",  "🎯","501 Double-Out Master",   "Win 10 501 Double-Out league matches",    10, "Format"),
  fmtAch("501_STRAIGHT_OUT_WINS_3", "⚡","Straight Shooter",        "Win 3 501 Straight-Out league matches",   3,  "Format"),
  fmtAch("501_STRAIGHT_OUT_WINS_5", "⚡","Straight-Out Pro",        "Win 5 501 Straight-Out league matches",   5,  "Format"),
  fmtAch("501_STRAIGHT_OUT_WINS_10","⚡","Straight-Out Legend",     "Win 10 501 Straight-Out league matches",  10, "Format"),
  fmtAch("501_DOUBLE_INOUT_WINS_3", "🎯","Double In/Out Rookie",    "Win 3 501 Double In/Out matches",         3,  "Format"),
  fmtAch("501_DOUBLE_INOUT_WINS_5", "🎯","Double In/Out Pro",       "Win 5 501 Double In/Out matches",         5,  "Format"),
  fmtAch("501_DOUBLE_INOUT_WINS_10","🎯","Double In/Out Master",    "Win 10 501 Double In/Out matches",        10, "Format"),
  fmtAch("501_TREBLE_OUT_WINS_3",   "⚔️","Treble Finisher",         "Win 3 501 Treble-Out matches",            3,  "Format"),
  fmtAch("501_TREBLE_OUT_WINS_5",   "⚔️","Treble-Out Pro",          "Win 5 501 Treble-Out matches",            5,  "Format"),
  fmtAch("501_TREBLE_OUT_WINS_10",  "⚔️","Treble-Out Legend",       "Win 10 501 Treble-Out matches",           10, "Format"),
  fmtAch("501_MASTER_OUT_WINS_3",   "🏆","Master-Out Rookie",       "Win 3 501 Master-Out matches",            3,  "Format"),
  fmtAch("501_MASTER_OUT_WINS_5",   "🏆","Master-Out Pro",          "Win 5 501 Master-Out matches",            5,  "Format"),
  fmtAch("501_MASTER_OUT_WINS_10",  "🏆","Master-Out Legend",       "Win 10 501 Master-Out matches",           10, "Format"),
  fmtAch("301_DOUBLE_OUT_WINS_3",   "3️⃣","301 Rookie",              "Win 3 301 Double-Out matches",            3,  "Format"),
  fmtAch("301_DOUBLE_OUT_WINS_5",   "3️⃣","301 Pro",                 "Win 5 301 Double-Out matches",            5,  "Format"),
  fmtAch("301_DOUBLE_OUT_WINS_10",  "3️⃣","301 Master",              "Win 10 301 Double-Out matches",           10, "Format"),
  fmtAch("301_DOUBLE_INOUT_WINS_3", "3️⃣","301 Double In/Out Rookie","Win 3 301 Double In/Out matches",         3,  "Format"),
  fmtAch("301_DOUBLE_INOUT_WINS_5", "3️⃣","301 Double In/Out Pro",   "Win 5 301 Double In/Out matches",         5,  "Format"),
  fmtAch("301_DOUBLE_INOUT_WINS_10","3️⃣","301 Double In/Out Master","Win 10 301 Double In/Out matches",        10, "Format"),
  fmtAch("1001_DOUBLE_OUT_WINS_3",  "🔢","1001 Rookie",             "Win 3 1001 league matches",               3,  "Format"),
  fmtAch("1001_DOUBLE_OUT_WINS_5",  "🔢","1001 Pro",                "Win 5 1001 league matches",               5,  "Format"),
  fmtAch("1001_DOUBLE_OUT_WINS_10", "🔢","1001 Master",             "Win 10 1001 league matches",              10, "Format"),
  fmtAch("2001_DOUBLE_OUT_WINS_3",  "🔢","2001 Rookie",             "Win 3 2001 league matches",               3,  "Format"),
  fmtAch("2001_DOUBLE_OUT_WINS_5",  "🔢","2001 Pro",                "Win 5 2001 league matches",               5,  "Format"),
  fmtAch("2001_DOUBLE_OUT_WINS_10", "🔢","2001 Master",             "Win 10 2001 league matches",              10, "Format"),
];

// ─── X01 Special Variants ─────────────────────────────────────────────────────
const X01_SPECIAL: AchievementDef[] = [
  fmtAch("BULL_FINISH_WINS_3",       "🎯","Bull Finisher",          "Win 3 Bull Finish matches",               3,  "Format"),
  fmtAch("BULL_FINISH_WINS_5",       "🎯","Bull Finish Pro",        "Win 5 Bull Finish matches",               5,  "Format"),
  fmtAch("BULL_FINISH_WINS_10",      "🎯","Bull Finish Legend",     "Win 10 Bull Finish matches",              10, "Format"),
  fmtAch("DOUBLE_OR_NOTHING_WINS_3", "🎲","Double or Nothing",      "Win 3 Double or Nothing matches",         3,  "Format"),
  fmtAch("DOUBLE_OR_NOTHING_WINS_5", "🎲","Double or Nothing Pro",  "Win 5 Double or Nothing matches",         5,  "Format"),
  fmtAch("DOUBLE_OR_NOTHING_WINS_10","🎲","Double or Nothing Legend","Win 10 Double or Nothing matches",       10, "Format"),
  fmtAch("SUDDEN_DEATH_501_WINS_3",  "💀","Sudden Death Survivor",  "Win 3 Sudden Death 501 matches",          3,  "Format"),
  fmtAch("SUDDEN_DEATH_501_WINS_5",  "💀","Sudden Death Pro",       "Win 5 Sudden Death 501 matches",          5,  "Format"),
  fmtAch("SUDDEN_DEATH_501_WINS_10", "💀","Sudden Death Legend",    "Win 10 Sudden Death 501 matches",         10, "Format"),
  fmtAch("501_NO_TREBLE_WINS_3",     "🚫","No Treble Rookie",       "Win 3 501 No Treble matches",             3,  "Format"),
  fmtAch("501_NO_TREBLE_WINS_5",     "🚫","No Treble Pro",          "Win 5 501 No Treble matches",             5,  "Format"),
  fmtAch("501_NO_TREBLE_WINS_10",    "🚫","No Treble Master",       "Win 10 501 No Treble matches",            10, "Format"),
  fmtAch("PAIRS_501_WINS_3",         "👥","Pairs Player",           "Win 3 Pairs 501 matches",                 3,  "Format"),
  fmtAch("PAIRS_501_WINS_5",         "👥","Pairs Pro",              "Win 5 Pairs 501 matches",                 5,  "Format"),
  fmtAch("PAIRS_501_WINS_10",        "👥","Pairs Legend",           "Win 10 Pairs 501 matches",                10, "Format"),
];

// ─── Cricket Variants ─────────────────────────────────────────────────────────
const CRICKET: AchievementDef[] = [
  fmtAch("CRICKET_WINS_3",           "🦗","Cricket Rookie",         "Win 3 Cricket league matches",            3,  "Format"),
  fmtAch("CRICKET_WINS_5",           "🦗","Cricket Pro",            "Win 5 Cricket league matches",            5,  "Format"),
  fmtAch("CRICKET_WINS_10",          "🦗","Cricket Master",         "Win 10 Cricket league matches",           10, "Format"),
  fmtAch("CUT_THROAT_CRICKET_WINS_3","✂️","Cut-Throat Starter",    "Win 3 Cut-Throat Cricket matches",         3,  "Format"),
  fmtAch("CUT_THROAT_CRICKET_WINS_5","✂️","Cut-Throat Pro",        "Win 5 Cut-Throat Cricket matches",         5,  "Format"),
  fmtAch("CUT_THROAT_CRICKET_WINS_10","✂️","Cut-Throat Master",    "Win 10 Cut-Throat Cricket matches",        10, "Format"),
  fmtAch("TACTICS_WINS_3",           "♟️","Tactician",              "Win 3 Tactics/Mickey Mouse matches",       3,  "Format"),
  fmtAch("TACTICS_WINS_5",           "♟️","Tactics Pro",            "Win 5 Tactics/Mickey Mouse matches",       5,  "Format"),
  fmtAch("TACTICS_WINS_10",          "♟️","Tactics Master",         "Win 10 Tactics/Mickey Mouse matches",      10, "Format"),
  fmtAch("CRICKET_NO_BULL_WINS_3",   "🦗","No Bull Cricket Rookie", "Win 3 Cricket No Bull matches",            3,  "Format"),
  fmtAch("CRICKET_NO_BULL_WINS_5",   "🦗","No Bull Cricket Pro",    "Win 5 Cricket No Bull matches",            5,  "Format"),
  fmtAch("CRICKET_NO_BULL_WINS_10",  "🦗","No Bull Cricket Master", "Win 10 Cricket No Bull matches",           10, "Format"),
];

// ─── Sequence/Around the World Variants ──────────────────────────────────────
const SEQUENCE: AchievementDef[] = [
  fmtAch("AROUND_THE_WORLD_WINS_3",    "🌍","World Traveller",         "Win 3 Around the World matches",          3,  "Format"),
  fmtAch("AROUND_THE_WORLD_WINS_5",    "🌍","World Explorer",          "Win 5 Around the World matches",          5,  "Format"),
  fmtAch("AROUND_THE_WORLD_WINS_10",   "🌍","World Champion",          "Win 10 Around the World matches",         10, "Format"),
  fmtAch("ROUND_WORLD_TREBLES_WINS_3", "⚔️","Trebles World Rookie",    "Win 3 Round the World Trebles matches",   3,  "Format"),
  fmtAch("ROUND_WORLD_TREBLES_WINS_5", "⚔️","Trebles World Pro",       "Win 5 Round the World Trebles matches",   5,  "Format"),
  fmtAch("ROUND_WORLD_TREBLES_WINS_10","⚔️","Trebles World Master",    "Win 10 Round the World Trebles matches",  10, "Format"),
  fmtAch("ROUND_CLOCK_WINS_3",         "🕐","Clock Watcher",           "Win 3 Round the Clock matches",           3,  "Format"),
  fmtAch("ROUND_CLOCK_WINS_5",         "🕐","Clock Pro",               "Win 5 Round the Clock matches",           5,  "Format"),
  fmtAch("ROUND_CLOCK_WINS_10",        "🕐","Clock Master",            "Win 10 Round the Clock matches",          10, "Format"),
  fmtAch("SHANGHAI_WINS_3",            "🎴","Shanghai Rookie",         "Win 3 Shanghai matches",                  3,  "Format"),
  fmtAch("SHANGHAI_WINS_5",            "🎴","Shanghai Pro",            "Win 5 Shanghai matches",                  5,  "Format"),
  fmtAch("SHANGHAI_WINS_10",           "🎴","Shanghai Master",         "Win 10 Shanghai matches",                 10, "Format"),
  fmtAch("BERMUDA_TRIANGLE_WINS_3",    "🔺","Bermuda Explorer",        "Win 3 Bermuda Triangle matches",          3,  "Format"),
  fmtAch("BERMUDA_TRIANGLE_WINS_5",    "🔺","Bermuda Pro",             "Win 5 Bermuda Triangle matches",          5,  "Format"),
  fmtAch("BERMUDA_TRIANGLE_WINS_10",   "🔺","Bermuda Master",          "Win 10 Bermuda Triangle matches",         10, "Format"),
  fmtAch("ROUND_BOARD_WINS_3",         "🎯","Board Rookie",            "Win 3 Round the Board matches",           3,  "Format"),
  fmtAch("ROUND_BOARD_WINS_5",         "🎯","Board Pro",               "Win 5 Round the Board matches",           5,  "Format"),
  fmtAch("ROUND_BOARD_WINS_10",        "🎯","Board Master",            "Win 10 Round the Board matches",          10, "Format"),
  fmtAch("DOUBLES_CHALLENGE_WINS_3",   "🎯","Doubles Challenger",      "Win 3 Doubles Challenge matches",         3,  "Format"),
  fmtAch("DOUBLES_CHALLENGE_WINS_5",   "🎯","Doubles Challenge Pro",   "Win 5 Doubles Challenge matches",         5,  "Format"),
  fmtAch("DOUBLES_CHALLENGE_WINS_10",  "🎯","Doubles Challenge Master","Win 10 Doubles Challenge matches",        10, "Format"),
  fmtAch("CHASE_DRAGON_WINS_3",        "🐉","Dragon Chaser",           "Win 3 Chase the Dragon matches",          3,  "Format"),
  fmtAch("CHASE_DRAGON_WINS_5",        "🐉","Dragon Hunter",           "Win 5 Chase the Dragon matches",          5,  "Format"),
  fmtAch("CHASE_DRAGON_WINS_10",       "🐉","Dragon Slayer",           "Win 10 Chase the Dragon matches",         10, "Format"),
  fmtAch("SHANGHAI_20_WINS_3",         "🎴","Shanghai 20 Rookie",      "Win 3 Shanghai 20 matches",               3,  "Format"),
  fmtAch("SHANGHAI_20_WINS_5",         "🎴","Shanghai 20 Pro",         "Win 5 Shanghai 20 matches",               5,  "Format"),
  fmtAch("SHANGHAI_20_WINS_10",        "🎴","Shanghai 20 Master",      "Win 10 Shanghai 20 matches",              10, "Format"),
  fmtAch("ROUND_CLOCK_DOUBLES_WINS_3", "🕐","Clock Doubles Rookie",    "Win 3 Round the Clock Doubles matches",   3,  "Format"),
  fmtAch("ROUND_CLOCK_DOUBLES_WINS_5", "🕐","Clock Doubles Pro",       "Win 5 Round the Clock Doubles matches",   5,  "Format"),
  fmtAch("ROUND_CLOCK_DOUBLES_WINS_10","🕐","Clock Doubles Master",    "Win 10 Round the Clock Doubles matches",  10, "Format"),
  fmtAch("AROUND_CLOCK_QUICK_WINS_3",  "⚡","Quick Around Rookie",     "Win 3 Around the Clock Quick matches",    3,  "Format"),
  fmtAch("AROUND_CLOCK_QUICK_WINS_5",  "⚡","Quick Around Pro",        "Win 5 Around the Clock Quick matches",    5,  "Format"),
  fmtAch("AROUND_CLOCK_QUICK_WINS_10", "⚡","Quick Around Master",     "Win 10 Around the Clock Quick matches",   10, "Format"),
];

// ─── Halve-It Variants ────────────────────────────────────────────────────────
const HALVEIT: AchievementDef[] = [
  fmtAch("HALVE_IT_WINS_3",  "✂️","Halver",          "Win 3 Halve-It matches",  3,  "Format"),
  fmtAch("HALVE_IT_WINS_5",  "✂️","Halve-It Pro",    "Win 5 Halve-It matches",  5,  "Format"),
  fmtAch("HALVE_IT_WINS_10", "✂️","Halve-It Master", "Win 10 Halve-It matches", 10, "Format"),
  fmtAch("BOBS_27_WINS_3",   "🎱","Bob's 27 Rookie", "Win 3 Bob's 27 matches",  3,  "Format"),
  fmtAch("BOBS_27_WINS_5",   "🎱","Bob's 27 Pro",    "Win 5 Bob's 27 matches",  5,  "Format"),
  fmtAch("BOBS_27_WINS_10",  "🎱","Bob's 27 Master", "Win 10 Bob's 27 matches", 10, "Format"),
];

// ─── Count-Up / Score Variants ────────────────────────────────────────────────
const COUNTUP: AchievementDef[] = [
  fmtAch("COUNT_UP_WINS_3",      "🔢","Count-Up Rookie",      "Win 3 Count Up matches",         3,  "Format"),
  fmtAch("COUNT_UP_WINS_5",      "🔢","Count-Up Pro",         "Win 5 Count Up matches",         5,  "Format"),
  fmtAch("COUNT_UP_WINS_10",     "🔢","Count-Up Master",      "Win 10 Count Up matches",        10, "Format"),
  fmtAch("HIGH_SCORE_WINS_3",    "📊","High Scorer",          "Win 3 High Score matches",       3,  "Format"),
  fmtAch("HIGH_SCORE_WINS_5",    "📊","High Score Pro",       "Win 5 High Score matches",       5,  "Format"),
  fmtAch("HIGH_SCORE_WINS_10",   "📊","High Score Master",    "Win 10 High Score matches",      10, "Format"),
  fmtAch("BEST_OF_9_WINS_3",     "9️⃣","Best of 9 Rookie",    "Win 3 Best of 9 matches",        3,  "Format"),
  fmtAch("BEST_OF_9_WINS_5",     "9️⃣","Best of 9 Pro",       "Win 5 Best of 9 matches",        5,  "Format"),
  fmtAch("BEST_OF_9_WINS_10",    "9️⃣","Best of 9 Master",    "Win 10 Best of 9 matches",       10, "Format"),
  fmtAch("ACCUMULATOR_WINS_3",   "➕","Accumulator Rookie",   "Win 3 Accumulator matches",      3,  "Format"),
  fmtAch("ACCUMULATOR_WINS_5",   "➕","Accumulator Pro",      "Win 5 Accumulator matches",      5,  "Format"),
  fmtAch("ACCUMULATOR_WINS_10",  "➕","Accumulator Master",   "Win 10 Accumulator matches",     10, "Format"),
];

// ─── Killer Variants ──────────────────────────────────────────────────────────
const KILLER: AchievementDef[] = [
  fmtAch("KILLER_WINS_3",                "💀","Killer Rookie",           "Win 3 Killer matches",                  3,  "Format"),
  fmtAch("KILLER_WINS_5",                "💀","Killer Pro",              "Win 5 Killer matches",                  5,  "Format"),
  fmtAch("KILLER_WINS_10",               "💀","Killer Master",           "Win 10 Killer matches",                 10, "Format"),
  fmtAch("SUDDEN_DEATH_KILLER_WINS_3",   "☠️","Sudden Killer Rookie",    "Win 3 Sudden Death Killer matches",      3,  "Format"),
  fmtAch("SUDDEN_DEATH_KILLER_WINS_5",   "☠️","Sudden Killer Pro",       "Win 5 Sudden Death Killer matches",      5,  "Format"),
  fmtAch("SUDDEN_DEATH_KILLER_WINS_10",  "☠️","Sudden Killer Master",    "Win 10 Sudden Death Killer matches",     10, "Format"),
  fmtAch("GOTCHA_WINS_3",                "🎯","Gotcha Rookie",           "Win 3 Gotcha matches",                  3,  "Format"),
  fmtAch("GOTCHA_WINS_5",                "🎯","Gotcha Pro",              "Win 5 Gotcha matches",                  5,  "Format"),
  fmtAch("GOTCHA_WINS_10",               "🎯","Gotcha Master",           "Win 10 Gotcha matches",                 10, "Format"),
  fmtAch("OCHE_ROULETTE_WINS_3",         "🎰","Oche Gambler",            "Win 3 Oche Roulette matches",           3,  "Format"),
  fmtAch("OCHE_ROULETTE_WINS_5",         "🎰","Oche Roulette Pro",       "Win 5 Oche Roulette matches",           5,  "Format"),
  fmtAch("OCHE_ROULETTE_WINS_10",        "🎰","Oche Roulette Master",    "Win 10 Oche Roulette matches",          10, "Format"),
];

// ─── Specialty Games ──────────────────────────────────────────────────────────
const SPECIALTY: AchievementDef[] = [
  fmtAch("JDC_CHALLENGE_41_WINS_3",   "🏆","JDC Challenger",         "Win 3 JDC Challenge 41 matches",          3,  "Format"),
  fmtAch("JDC_CHALLENGE_41_WINS_5",   "🏆","JDC Pro",                "Win 5 JDC Challenge 41 matches",          5,  "Format"),
  fmtAch("JDC_CHALLENGE_41_WINS_10",  "🏆","JDC Master",             "Win 10 JDC Challenge 41 matches",         10, "Format"),
  fmtAch("EXPONENTIAL_BUNDLE_WINS_3", "📈","Exponential Rookie",     "Win 3 Exponential Bundle matches",        3,  "Format"),
  fmtAch("EXPONENTIAL_BUNDLE_WINS_5", "📈","Exponential Pro",        "Win 5 Exponential Bundle matches",        5,  "Format"),
  fmtAch("EXPONENTIAL_BUNDLE_WINS_10","📈","Exponential Master",     "Win 10 Exponential Bundle matches",       10, "Format"),
  fmtAch("SHOOTING_GALLERY_WINS_3",   "🎯","Gallery Shooter",        "Win 3 Shooting Gallery matches",          3,  "Format"),
  fmtAch("SHOOTING_GALLERY_WINS_5",   "🎯","Gallery Pro",            "Win 5 Shooting Gallery matches",          5,  "Format"),
  fmtAch("SHOOTING_GALLERY_WINS_10",  "🎯","Gallery Master",         "Win 10 Shooting Gallery matches",         10, "Format"),
  fmtAch("DEAD_CENTRE_WINS_3",        "🎯","Dead Centre Rookie",     "Win 3 Dead Centre matches",               3,  "Format"),
  fmtAch("DEAD_CENTRE_WINS_5",        "🎯","Dead Centre Pro",        "Win 5 Dead Centre matches",               5,  "Format"),
  fmtAch("DEAD_CENTRE_WINS_10",       "🎯","Dead Centre Master",     "Win 10 Dead Centre matches",              10, "Format"),
  fmtAch("CHECKOUT_CHALLENGE_WINS_3", "✅","Checkout Challenger",    "Win 3 Checkout Challenge matches",        3,  "Format"),
  fmtAch("CHECKOUT_CHALLENGE_WINS_5", "✅","Checkout Pro",           "Win 5 Checkout Challenge matches",        5,  "Format"),
  fmtAch("CHECKOUT_CHALLENGE_WINS_10","✅","Checkout Master",        "Win 10 Checkout Challenge matches",       10, "Format"),
];

// ─── Party / Custom Games ─────────────────────────────────────────────────────
const PARTY: AchievementDef[] = [
  fmtAch("NO_BLACK_WINS_3",     "🚫","No Black Rookie",     "Win 3 No Black matches",           3,  "Format"),
  fmtAch("NO_BLACK_WINS_5",     "🚫","No Black Pro",        "Win 5 No Black matches",           5,  "Format"),
  fmtAch("NO_BLACK_WINS_10",    "🚫","No Black Master",     "Win 10 No Black matches",          10, "Format"),
  fmtAch("NEAREST_BULL_WINS_3", "🎯","Bull Seeker",         "Win 3 Nearest Bull matches",       3,  "Format"),
  fmtAch("NEAREST_BULL_WINS_5", "🎯","Bull Pro",            "Win 5 Nearest Bull matches",       5,  "Format"),
  fmtAch("NEAREST_BULL_WINS_10","🎯","Bull Master",         "Win 10 Nearest Bull matches",      10, "Format"),
  fmtAch("PICK_DOUBLE_WINS_3",  "🎯","Double Picker",       "Win 3 Pick a Double matches",      3,  "Format"),
  fmtAch("PICK_DOUBLE_WINS_5",  "🎯","Double Pick Pro",     "Win 5 Pick a Double matches",      5,  "Format"),
  fmtAch("PICK_DOUBLE_WINS_10", "🎯","Double Pick Master",  "Win 10 Pick a Double matches",     10, "Format"),
  fmtAch("BASEBALL_WINS_3",     "⚾","Baseball Rookie",     "Win 3 Baseball Darts matches",     3,  "Format"),
  fmtAch("BASEBALL_WINS_5",     "⚾","Baseball Pro",        "Win 5 Baseball Darts matches",     5,  "Format"),
  fmtAch("BASEBALL_WINS_10",    "⚾","Baseball Master",     "Win 10 Baseball Darts matches",    10, "Format"),
  fmtAch("SCRAM_WINS_3",        "🎲","Scram Rookie",        "Win 3 Scram matches",              3,  "Format"),
  fmtAch("SCRAM_WINS_5",        "🎲","Scram Pro",           "Win 5 Scram matches",              5,  "Format"),
  fmtAch("SCRAM_WINS_10",       "🎲","Scram Master",        "Win 10 Scram matches",             10, "Format"),
  fmtAch("LEGS_WINS_3",         "🦵","Legs Rookie",         "Win 3 Legs matches",               3,  "Format"),
  fmtAch("LEGS_WINS_5",         "🦵","Legs Pro",            "Win 5 Legs matches",               5,  "Format"),
  fmtAch("LEGS_WINS_10",        "🦵","Legs Master",         "Win 10 Legs matches",              10, "Format"),
  fmtAch("FOOTBALL_DARTS_WINS_3",  "⚽","Football Rookie",  "Win 3 Football Darts matches",     3,  "Format"),
  fmtAch("FOOTBALL_DARTS_WINS_5",  "⚽","Football Pro",     "Win 5 Football Darts matches",     5,  "Format"),
  fmtAch("FOOTBALL_DARTS_WINS_10", "⚽","Football Master",  "Win 10 Football Darts matches",    10, "Format"),
  fmtAch("FIVES_WINS_3",        "5️⃣","Fives Rookie",       "Win 3 Fives matches",              3,  "Format"),
  fmtAch("FIVES_WINS_5",        "5️⃣","Fives Pro",          "Win 5 Fives matches",              5,  "Format"),
  fmtAch("FIVES_WINS_10",       "5️⃣","Fives Master",       "Win 10 Fives matches",             10, "Format"),
];

// ─── Variety / Collector ──────────────────────────────────────────────────────
const VARIETY: AchievementDef[] = [
  { key:"GAME_HOPPER_10",     name:"🃏 Game Hopper",       description:"Win matches across 10 different game types",      icon:"🃏", rarity:"Epic",      category:"Format", hidden:false, priority:60, criteriaType:"UNIQUE_GAME_WINS",   criteriaValue:10, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"GAME_HOPPER_20",     name:"🃏 Game Collector",    description:"Win matches across 20 different game types",      icon:"🃏", rarity:"Legendary", category:"Format", hidden:false, priority:80, criteriaType:"UNIQUE_GAME_WINS",   criteriaValue:20, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},
  { key:"COMPLETE_COLLECTOR", name:"🌐 Complete Collector",description:"Win in X01, Cricket, Sequence and one other game",icon:"🌐", rarity:"Epic",      category:"Format", hidden:false, priority:60, criteriaType:"ALL_CATEGORIES_WON", criteriaValue:1,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"STREAK_MACHINE",     name:"🔥 Streak Machine",    description:"Maintain a 5+ win streak in practice",            icon:"🔥", rarity:"Rare",      category:"Format", hidden:false, priority:40, criteriaType:"WIN_STREAK_5",       criteriaValue:1,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"HOT_HAND",           name:"🔥 Hot Hand",          description:"Win 10 matches in a row",                         icon:"🔥", rarity:"Epic",      category:"Format", hidden:false, priority:60, criteriaType:"WIN_STREAK_10",      criteriaValue:1,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
];

// ─── New match/season achievements ───────────────────────────────────────────
const NEW_CAREER: AchievementDef[] = [
  { key:"UNDERDOG_SPECIAL",      name:"🐕 Underdog Special",      description:"Beat an opponent with 100+ higher Elo",             icon:"🐕", rarity:"Rare",      category:"Career",   hidden:false, priority:40, criteriaType:"ELO_UPSET_WIN",        criteriaValue:100, engineType:"MATCH_EVENT" , coinReward: 35, packReward: "SINGLE"},
  { key:"LUCKY_SOB_MASSIVE",     name:"🍀 Lucky SOB",             description:"Beat an opponent with 150+ higher Elo",             icon:"🍀", rarity:"Epic",      category:"Career",   hidden:true,  priority:60, criteriaType:"ELO_UPSET_WIN",        criteriaValue:150, engineType:"MATCH_EVENT" , coinReward: 75, packReward: "SINGLE"},
  { key:"REVERSAL",              name:"🔄 The Reversal",          description:"Beat your most-played opponent twice in a row",     icon:"🔄", rarity:"Rare",      category:"Rivalry",  hidden:false, priority:40, criteriaType:"NEMESIS_REVERSAL",     criteriaValue:1,   engineType:"MATCH_EVENT" , coinReward: 35, packReward: "SINGLE"},
  { key:"NEMESIS_RELATIONSHIP",  name:"😤 Nemesis",               description:"Play the same opponent 10+ times",                  icon:"😤", rarity:"Rare",      category:"Rivalry",  hidden:false, priority:40, criteriaType:"H2H_MATCH_COUNT",      criteriaValue:10,  engineType:"SEASON_EVENT" , coinReward: 35, packReward: "SINGLE"},
  { key:"UNBEATABLE_VS_ONE",     name:"🔒 Unbeatable vs One",     description:"Win 3+ in a row vs same opponent this season",      icon:"🔒", rarity:"Epic",      category:"Rivalry",  hidden:false, priority:60, criteriaType:"STREAK_VS_OPPONENT",   criteriaValue:3,   engineType:"SEASON_EVENT" , coinReward: 75, packReward: "SINGLE"},
  { key:"REGULAR_PLAYER",        name:"📅 Regular Player",        description:"Play at least once per week for 20+ weeks",         icon:"📅", rarity:"Legendary", category:"Career",   hidden:false, priority:80, criteriaType:"WEEKLY_CONSISTENCY",   criteriaValue:20,  engineType:"SEASON_EVENT" , coinReward: 150, packReward: "FIVE"},
];

export const FORMAT_AND_MEME_ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  ...X01,
  ...X01_SPECIAL,
  ...CRICKET,
  ...SEQUENCE,
  ...HALVEIT,
  ...COUNTUP,
  ...KILLER,
  ...SPECIALTY,
  ...PARTY,
  ...VARIETY,
  ...NEW_CAREER,
];
