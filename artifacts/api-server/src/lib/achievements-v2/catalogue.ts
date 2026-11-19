/**
 * Achievements v2 catalogue: the signed-off design (docs: "TKDL Achievements: sanity check and new catalogue").
 *
 * Three kinds:
 * - TRACK: one counter with several levels; its metal comes from how far along the levels you are.
 * - FEAT: a one-off moment; `secret` ones show only a hint until earned; `liveOnly` ones need a detail that was
 *   never saved, so they can only be earned from launch (never credited from history).
 * - SEASON goal: a small target counted within one league season; every season's completion is kept.
 *
 * Each item names a `metric`, worked out by the area's evaluator (league.ts and friends). Text uses {n} for the target.
 */
export type Area = "LEAGUE" | "TEAMS" | "PRACTICE" | "MASTER501" | "MODES" | "TOUR";
export type Metal = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";

export type TrackDef = { kind: "TRACK"; key: string; area: Area; title: string; goal: string; metric: string; levels: number[]; unit?: "%" ; scorer?: boolean };
export type FeatDef = { kind: "FEAT"; key: string; area: Area; title: string; goal: string; metric: string; points: number; secret?: { hint: string }; liveOnly?: boolean; scorer?: boolean; showpiece?: boolean };
export type SeasonDef = { kind: "SEASON"; key: string; area: Area; title: string; goal: string; metric: string; targets: number[] };
export type AchievementDef = TrackDef | FeatDef | SeasonDef;

const track = (area: Area, key: string, title: string, goal: string, metric: string, levels: number[], extra: Partial<TrackDef> = {}): TrackDef =>
  ({ kind: "TRACK", area, key, title, goal, metric, levels, ...extra });
const feat = (area: Area, key: string, title: string, goal: string, metric: string, points: number, extra: Partial<FeatDef> = {}): FeatDef =>
  ({ kind: "FEAT", area, key, title, goal, metric, points, ...extra });
const season = (area: Area, key: string, title: string, goal: string, metric: string, targets: number[]): SeasonDef =>
  ({ kind: "SEASON", area, key, title, goal, metric, targets });

export const LEAGUE_CATALOGUE: AchievementDef[] = [
  // Tracks: results (every recorded league match counts)
  track("LEAGUE", "league-wins", "League wins", "Win {n} league matches", "wins", [1, 5, 10, 25, 50, 100, 150, 250]),
  track("LEAGUE", "league-matches", "Matches played", "Play {n} league matches", "matches", [5, 10, 25, 50, 100, 200, 350, 500]),
  track("LEAGUE", "players-beaten", "Different players beaten", "Beat {n} different players", "distinctBeaten", [1, 3, 5, 8, 12, 16, 20]),
  track("LEAGUE", "winning-run", "Best winning run", "Win {n} league matches in a row", "bestRun", [3, 5, 7, 10, 15]),
  track("LEAGUE", "stake-points", "Points won from stakes", "Win {n} points from stakes", "stakePointsWon", [25, 50, 100, 200, 350, 500, 1000]),
  track("LEAGUE", "peak-elo", "Peak ELO", "Reach {n} ELO", "peakElo", [1050, 1100, 1150, 1200, 1300, 1400, 1500]),
  track("LEAGUE", "seasons-played", "Seasons played", "Play in {n} league seasons", "seasonsPlayed", [1, 2, 3, 6, 9, 12]),
  track("LEAGUE", "big-stake-wins", "Wins on a stake of 10+", "Win {n} matches on a stake of 10 or more", "stake10Wins", [1, 5, 10, 25, 50]),
  track("LEAGUE", "eliminations", "Players eliminated", "Eliminate {n} players", "eliminations", [1, 3, 5, 10, 20]),
  track("LEAGUE", "formats-won", "Formats won in", "Win in {n} different formats", "formatsWon", [2, 3, 5, 8, 12]),
  track("LEAGUE", "rival-wins", "Wins against your most-beaten opponent", "Beat the same player {n} times", "mostBeatenWins", [3, 5, 10, 15, 20]),
  track("LEAGUE", "top-three", "Top-3 season finishes", "Finish a season in the top 3 {n} times", "top3Finishes", [1, 2, 3, 5]),
  track("LEAGUE", "titles", "League titles", "Win {n} league titles", "titles", [1, 2, 3, 5]),
  // Tracks: scoring (league matches played on the app's scorer)
  track("LEAGUE", "league-180s", "League 180s", "Hit {n} 180s in league matches", "s180", [1, 5, 10, 25, 50, 100], { scorer: true }),
  track("LEAGUE", "league-140s", "League 140+ visits", "Hit {n} visits of 140+ in league matches", "s140plus", [5, 25, 50, 100, 250], { scorer: true }),
  track("LEAGUE", "league-tons", "League tons", "Hit {n} visits of 100+ in league matches", "s100plus", [10, 50, 100, 250, 500], { scorer: true }),
  track("LEAGUE", "league-checkouts", "League checkouts", "Hit {n} checkouts in league matches", "checkouts", [5, 25, 50, 100, 250], { scorer: true }),
  track("LEAGUE", "league-checkout-rate", "League checkout rate", "Hit {n}% of your last 100 darts at a double", "checkoutRate", [15, 20, 25, 30, 35], { unit: "%", scorer: true }),
  track("LEAGUE", "scorer-matches", "Matches played on the scorer", "Play {n} league matches on the scorer", "scorerMatches", [5, 25, 50, 100, 250], { scorer: true }),
  // Feats
  feat("LEAGUE", "giant-killer", "Giant killer", "Beat the player who finishes that season top of the table", "giantKiller", 50),
  feat("LEAGUE", "champions-scalp", "Champion's scalp", "Beat the reigning league champion", "championsScalp", 40),
  feat("LEAGUE", "upset-of-the-night", "Upset of the night", "Win a match that earns you 25+ ELO", "upsetElo", 40),
  feat("LEAGUE", "all-in", "All in", "Win a match on a stake of 20+ points", "allIn", 30),
  feat("LEAGUE", "double-or-quits", "Double or quits", "Win two 10+ stake matches back to back", "doubleOrQuits", 40),
  feat("LEAGUE", "revenge", "Revenge", "Beat a player in your next meeting after they beat you", "revenge", 20),
  feat("LEAGUE", "bounce-back", "Bounce back", "Win 3 in a row straight after losing 3 in a row", "bounceBack", 40),
  feat("LEAGUE", "big-night", "Big night", "Win 3 league matches on the same day", "bigNight", 30),
  feat("LEAGUE", "perfect-week", "Perfect week", "Win 5 matches in a week without a loss", "perfectWeek", 50),
  feat("LEAGUE", "clean-sweep", "The Grand Slam", "Play and beat every other active player in one season", "cleanSweep", 150, { showpiece: true }),
  feat("LEAGUE", "full-house", "Full house", "Play every other active player in one season", "fullHouse", 40),
  feat("LEAGUE", "unbeaten-season", "Unbeaten season", "Finish a season with 10+ matches and no losses", "unbeatenSeason", 100),
  track("LEAGUE", "untouchable", "Untouchable", "Finish {n} seasons in a row without being eliminated", "survivedStreak", [1, 2, 3, 5, 8]),
  track("LEAGUE", "ever-present", "Ever-present", "Play in {n} seasons in a row", "presentStreak", [2, 3, 5, 8, 12]),
  feat("LEAGUE", "debut-win", "Dream debut", "Win your very first league match", "debutWin", 20),
  feat("LEAGUE", "milestone-match", "Milestone match", "Win your 100th league match", "milestoneMatch", 40),
  feat("LEAGUE", "founding-member", "Founding member", "Play in the league's first ever season", "foundingMember", 50),
  feat("LEAGUE", "seven-days", "Seven-day wonder", "Win a league match on every day of the week", "sevenDays", 40),
  feat("LEAGUE", "night-owl", "Night owl", "Win a league match after 10pm", "nightOwl", 20),
  feat("LEAGUE", "early-doors", "Early doors", "Win a league match before midday", "earlyDoors", 20),
  feat("LEAGUE", "marathon-night", "Marathon night", "Play 5 league matches in one day", "marathonNight", 30),
  feat("LEAGUE", "double-take", "Double take", "Beat the same player twice in one day", "doubleTake", 20),
  feat("LEAGUE", "giant-leap", "Giant leap", "Gain 100 ELO in a single week", "giantLeap", 50),
  feat("LEAGUE", "festive-fixture", "Festive fixture", "Win a league match between Christmas Eve and Boxing Day", "festive", 30),
  feat("LEAGUE", "friday-13th", "Unlucky for some", "Win a league match on Friday the 13th", "friday13", 40, { secret: { hint: "Some dates are unluckier than others." } }),
  feat("LEAGUE", "survivor", "Survivor", "Play 20+ matches in a season and finish it on points", "survivor", 40),
  feat("LEAGUE", "rivalry", "Rivalry", "Play the same opponent 10 times", "rivalry10", 20),
  feat("LEAGUE", "nemesis", "Nemesis", "Beat the player who has beaten you most, once they've beaten you 3 times", "nemesis", 50),
  feat("LEAGUE", "kingmaker", "Kingmaker", "Beat the season's eventual champion in its final week", "kingmaker", 50),
  feat("LEAGUE", "grudge-match", "Grudge match", "Win a 10+ stake match against the opponent you've played most", "grudgeMatch", 40),
  feat("LEAGUE", "iron-man", "Iron man", "Play at least one match in every week of a season", "ironMan", 60),
  feat("LEAGUE", "back-from-the-brink", "Back from the brink", "Win a league match when you're on 1 point", "backFromBrink", 80, { secret: { hint: "Something happens at 1 point." }, liveOnly: true }),
  feat("LEAGUE", "maximum-pressure", "Maximum pressure", "Hit two 180s in one league match", "two180s", 30, { scorer: true }),
  feat("LEAGUE", "hat-trick", "Hat-trick", "Hit three 180s in one league match", "three180s", 60, { scorer: true }),
  feat("LEAGUE", "ice-cold", "Ice cold", "Win a league match hitting half your darts at a double (6+ darts)", "iceCold", 40, { scorer: true }),
  feat("LEAGUE", "answer-back", "Answer back", "Hit a 180 in a match where your opponent hit two", "answerBack", 30, { scorer: true }),
  // Season goals
  season("LEAGUE", "season-wins", "Win matches", "Win {n} league matches this season", "seasonWins", [5, 10, 15]),
  season("LEAGUE", "season-beaten", "Beat different players", "Beat {n} different players this season", "seasonDistinctBeaten", [5]),
  season("LEAGUE", "season-run", "Winning run", "Win {n} in a row this season", "seasonBestRun", [3]),
  season("LEAGUE", "season-formats", "Mix it up", "Win in {n} different formats this season", "seasonFormatsWon", [3]),
  season("LEAGUE", "season-top-five", "Finish strong", "Finish the season in the top 5", "seasonTopFive", [1]),
];

export const TEAMS_CATALOGUE: AchievementDef[] = [
  // Doubles
  track("TEAMS", "doubles-wins", "Team wins", "Win {n} doubles matches", "teamWins", [1, 5, 10, 20, 35, 50]),
  track("TEAMS", "doubles-matches", "Team matches played", "Play {n} doubles matches", "teamMatches", [5, 10, 25, 50, 100]),
  track("TEAMS", "doubles-partners", "Partners you've won with", "Win with {n} different partners", "partnersWonWith", [1, 2, 3, 5]),
  track("TEAMS", "doubles-teams-beaten", "Different teams beaten", "Beat {n} different teams", "teamsBeaten", [1, 3, 5, 8, 12]),
  track("TEAMS", "doubles-seasons", "Seasons in a team", "Play {n} doubles seasons", "teamSeasons", [1, 2, 3, 5]),
  feat("TEAMS", "lone-wolf", "Lone wolf", "Win a combined match as the solo side", "loneWolf", 50),
  feat("TEAMS", "safe-pair-of-hands", "Safe pair of hands", "Win a team match on a stake of 20+", "safePair", 30),
  feat("TEAMS", "in-sync", "In sync", "Win 5 team matches in a row", "inSync", 40),
  feat("TEAMS", "top-pair", "Top pair", "Finish a season top of the doubles table", "topPair", 80),
  feat("TEAMS", "podium-pair", "Podium pair", "Finish a doubles season in the top 3", "neverSplit", 40),
  feat("TEAMS", "inseparable", "Inseparable", "Win the doubles season without losing a match", "inseparable", 150, { showpiece: true }),
  feat("TEAMS", "doubles-debut", "Partners in crime", "Win your first ever doubles match", "doublesDebut", 20),
  feat("TEAMS", "threes-company", "Three's company", "Play a doubles season in a team of three", "threesCompany", 20),
  feat("TEAMS", "reunited", "Reunited", "Get drawn with the same partner in two different seasons", "reunited", 30),
  season("TEAMS", "season-team-wins", "Team season goal", "Win {n} doubles matches this season", "seasonTeamWins", [5, 10]),
  // Shift Wars (a department's recorded results count for its members)
  track("TEAMS", "shift-wins", "Department wins", "Your department wins {n} Shift Wars matches", "deptWins", [1, 5, 10, 25, 50]),
  track("TEAMS", "shift-matches", "Shift Wars matches played", "Your department plays {n} Shift Wars matches", "deptMatches", [5, 10, 25, 50, 100]),
  track("TEAMS", "shift-depts-beaten", "Departments beaten", "Beat {n} different departments", "deptsBeaten", [1, 2]),
  track("TEAMS", "shift-seasons", "Seasons on the rota", "Be on the rota for {n} Shift Wars seasons", "seasonsOnRota", [1, 2, 3, 5]),
  feat("TEAMS", "clocking-in", "Clocking in", "Your department plays the first Shift Wars match of a season", "clockingIn", 20),
  feat("TEAMS", "overtime", "Overtime", "Win a multi-department match", "overtime", 30),
  feat("TEAMS", "big-shift", "Big shift", "Win on a stake of 20+", "bigShift", 30),
  feat("TEAMS", "night-shift", "Night shift", "Play 3 Shift Wars matches on one day", "nightShift", 30),
  feat("TEAMS", "employee-of-the-month", "Employee of the month", "Your department wins the Shift Wars season", "employeeOfMonth", 80),
  feat("TEAMS", "friday-feeling", "Friday feeling", "Your department wins a Shift Wars match on a Friday", "fridayFeeling", 20),
  feat("TEAMS", "full-rota", "Full rota", "Your department plays in every week of a Shift Wars season", "fullRota", 40),
  season("TEAMS", "season-dept-matches", "Department season goal", "Play {n} matches for your department this season", "monthMatches", [5]),
  season("TEAMS", "season-rota-regular", "Rota regular", "Play in {n} different weeks this season", "monthWeeks", [3]),
];

export const PRACTICE_CATALOGUE: AchievementDef[] = [
  track("PRACTICE", "practice-sessions", "Practice sessions", "Play {n} practice sessions", "practiceSessions", [5, 10, 25, 50, 100, 200, 400]),
  track("PRACTICE", "practice-darts", "Darts thrown in practice", "Throw {n} darts in practice", "practiceDarts", [500, 2000, 5000, 10000, 25000, 50000, 100000]),
  track("PRACTICE", "practice-180s", "Practice 180s", "Hit {n} 180s in practice", "practice180s", [1, 5, 10, 25, 50, 100, 250]),
  track("PRACTICE", "practice-checkouts", "Practice checkouts", "Hit {n} checkouts in practice", "practiceCheckouts", [5, 25, 50, 100, 250, 500]),
  track("PRACTICE", "practice-checkout-rate", "Checkout rate", "Hit {n}% of your last 100 darts at a double in practice", "practiceCheckoutRate", [10, 15, 20, 25, 30, 35, 40], { unit: "%" }),
  track("PRACTICE", "practice-games", "Practice games tried", "Try {n} different practice games", "practiceGames", [2, 4, 6, 10, 15, 20]),
  track("PRACTICE", "practice-days", "Days practised", "Practise on {n} different days", "practiceDays", [3, 7, 14, 30, 60, 100]),
  track("PRACTICE", "practice-streak", "Practice streak", "Practise {n} days in a row", "practiceStreak", [2, 3, 5, 7, 14, 30]),
  track("PRACTICE", "shadow-level", "Shadow level", "Train your Shadow Bot to level {n} (Amateur to Elite)", "shadowLevel", [1, 2, 3, 4, 5]),
  feat("PRACTICE", "iron-discipline", "Iron discipline", "Practise on every single day of a league season", "ironDiscipline", 150, { showpiece: true }),
  feat("PRACTICE", "early-bird", "Early bird", "Practise before 8am", "earlyBird", 20),
  feat("PRACTICE", "midnight-oil", "Midnight oil", "Practise after midnight", "midnightOil", 20),
  feat("PRACTICE", "weekend-grinder", "Weekend grinder", "Practise on both days of a weekend", "weekendGrinder", 20),
  feat("PRACTICE", "variety-pack", "Variety pack", "Play 5 different practice games in one day", "varietyPack", 30),
  feat("PRACTICE", "ton-up-session", "Ton-up session", "Hit three 180s in one practice session", "tonUpSession", 40),
  feat("PRACTICE", "new-year", "New year, new me", "Practise on New Year's Day", "newYear", 30),
  feat("PRACTICE", "long-session", "Long session", "Throw 300+ darts in one session", "longSession", 20),
  season("PRACTICE", "season-practice-days", "Regular", "Practise on {n} different days this season", "seasonPracticeDays", [8]),
  season("PRACTICE", "season-practice-180s", "Max out", "Hit {n} practice 180s this season", "seasonPractice180s", [10]),
  season("PRACTICE", "season-sharpshooter", "Sharpshooter", "Raise your practice checkout rate over last season", "seasonRateUp", [1]),
];

export const MASTER501_CATALOGUE: AchievementDef[] = [
  track("MASTER501", "m501-ladder", "Ladder climbed", "Clear round {n} of the Master-501 ladder", "m501Ladder", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
  track("MASTER501", "m501-runs", "Runs completed", "Complete {n} Master-501 runs", "m501Runs", [5, 10, 25, 50, 100, 200]),
  track("MASTER501", "m501-wins", "Master-501 wins", "Win {n} Master-501 matches", "m501Wins", [1, 5, 10, 25, 50, 100]),
  track("MASTER501", "m501-run", "Winning run", "Win {n} Master-501 matches in a row", "m501Run", [2, 3, 5, 8, 12]),
  feat("MASTER501", "m501-flawless", "Flawless", "Win a best-of-5 without dropping a leg", "flawless", 30),
  feat("MASTER501", "m501-last-gasp", "Last gasp", "Win a match in the deciding leg", "lastGasp", 20),
  feat("MASTER501", "m501-clean-tier", "Clean tier", "Clear a tier without losing a match", "cleanTier", 60),
  feat("MASTER501", "m501-world-champion", "World champion", "Win the World Championship tier", "worldChampion", 150, { showpiece: true }),
  feat("MASTER501", "m501-speed-run", "Speed run", "Win three Master-501 rounds in one day", "speedRun", 30),
  feat("MASTER501", "m501-tier-jumper", "Tier jumper", "Clear two tiers within a week", "tierJumper", 40),
];

export const MODES_CATALOGUE: AchievementDef[] = [
  track("MODES", "board-curse-wins", "Board Curse wins", "Win {n} Board Curse matches", "bcWins", [1, 5, 10, 25, 50]),
  track("MODES", "board-curse-streak", "Endless streak", "Reach a {n}-run Endless streak", "bcStreak", [5, 10, 25, 50]),
  feat("MODES", "quick-clear", "Quick clear", "Clear a board in 12 visits or fewer", "quickClear", 40),
  feat("MODES", "both-sides", "Both sides", "Beat a bot and a local opponent in Board Curse", "bothSides", 20),
  track("MODES", "bosses-defeated", "Bosses defeated", "Defeat {n} bosses on the ladder", "bossesDefeated", [1, 2, 3, 4, 5, 6]),
  track("MODES", "boss-ascension", "Ascension", "Reach ascension {n} on any boss", "bossAscension", [1, 2]),
  feat("MODES", "first-time", "First time", "Beat a boss on your first attempt", "firstTime", 40),
  feat("MODES", "never-gave-up", "Never gave up", "Beat a boss after 5 or more attempts", "neverGaveUp", 30),
  feat("MODES", "boss-slayer", "Boss slayer", "Beat all six bosses at the top ascension", "bossSlayer", 150, { showpiece: true }),
  feat("MODES", "boss-clean-sweep", "Clean sweep", "Beat a boss with a clean sweep", "bossCleanSweep", 50),
];

export const CATALOGUE: AchievementDef[] = [...LEAGUE_CATALOGUE, ...TEAMS_CATALOGUE, ...PRACTICE_CATALOGUE, ...MASTER501_CATALOGUE, ...MODES_CATALOGUE];

/** Metal for a track level: Diamond only when the track is complete; the levels before it are spread across
 *  Bronze, Silver, Gold and Platinum in order (a short track can skip a metal). */
export function metalFor(level: number, levels: number): Metal | null {
  if (level <= 0) return null;
  if (level >= levels) return "DIAMOND";
  const band = 1 + Math.floor(((level - 1) / (levels - 1)) * 4);
  return (["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const)[Math.min(4, band) - 1];
}
/** Points for reaching track level `level` (1-based): grows with the level. */
export const levelPoints = (level: number) => 10 * level;
export const SEASON_GOAL_POINTS = 15;
export const goalText = (goal: string, n: number) => goal.replace("{n}", n.toLocaleString("en-GB"));
