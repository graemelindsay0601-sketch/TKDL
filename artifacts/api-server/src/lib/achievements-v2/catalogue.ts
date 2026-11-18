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
export type FeatDef = { kind: "FEAT"; key: string; area: Area; title: string; goal: string; metric: string; points: number; secret?: { hint: string }; liveOnly?: boolean; scorer?: boolean };
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
  feat("LEAGUE", "clean-sweep", "Clean sweep", "Beat every other active player at least once in one season", "cleanSweep", 100),
  feat("LEAGUE", "unbeaten-season", "Unbeaten season", "Finish a season with 10+ matches and no losses", "unbeatenSeason", 100),
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

export const CATALOGUE: AchievementDef[] = [...LEAGUE_CATALOGUE];

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
