export type RuleGame = {
  name: string;
  engine?: string | null;
  category?: string | null;
  description?: string | null;
  config?: string | Record<string, unknown> | null;
};

function configOf(game: RuleGame): Record<string, any> {
  if (game.config && typeof game.config === "object") return game.config;
  if (typeof game.config === "string") {
    try { const value=JSON.parse(game.config); return value && typeof value === "object" ? value : {}; }
    catch { return {}; }
  }
  return {};
}

function x01Rules(config: Record<string, any>) {
  const start=Number(config.startingScore ?? config.startScore ?? 501);
  const opening=config.doubleIn ? "Scoring only begins after the player hits a double." : "Scoring begins with the first dart.";
  const finish=config.bullFinish ? "The winning dart must hit the inner bull." : config.masterOut ? "The winning dart must be a double, treble or inner bull." : config.trebleOut ? "The winning dart must be a treble." : config.doubleOut === false ? "Any scoring segment may be the winning dart." : "The winning dart must be a double or inner bull.";
  const bust=config.bustResetTo != null ? `A bust resets that player to ${config.bustResetTo}.` : "Going below zero, leaving one in a double-out game, or reaching zero incorrectly is a bust; the score returns to its value at the start of the visit.";
  const legs=Number(config.legs ?? 1);
  return `HOW TO PLAY:\n• Each player or side starts on ${start}.\n• Players alternate three-dart visits and subtract the scored total.\n• ${opening}\n\nFINISHING:\n• ${finish}\n• ${bust}\n\nWINNING:\n${legs > 1 ? `The match is best of ${legs} legs. First to ${Math.floor(legs/2)+1} leg wins takes the match.` : "The first player or side to complete the required finish wins."}`;
}

const ENGINE_GUIDANCE: Record<string,string> = {
  Cricket: "HOW TO PLAY:\n• Take turns throwing three darts at 15, 16, 17, 18, 19, 20 and bull.\n• A single counts as one mark, a double as two and a treble as three. Three marks close a target.\n• Once you have closed a target, extra hits score while an opponent still has it open.\n\nWINNING:\nClose every target and finish level with or ahead of the opposition. In cut-throat mode, extra points are added to opponents and the lowest score wins.",
  TeamCricket: "HOW TO PLAY:\n• Team-mates share one set of Cricket marks and one score.\n• Players rotate within their side, throwing three darts each, before play passes to the opposition.\n• Close 15–20 and bull with three marks each, then score on targets the other side still has open.\n\nWINNING:\nThe first team to close every target while level or ahead on points wins.",
  Sequence: "HOW TO PLAY:\n• The scorer shows the current target in the required sequence.\n• Players alternate three-dart visits. Only a valid hit on the current target advances progress.\n• Singles, doubles and trebles count only as the chosen format specifies.\n\nWINNING:\nComplete the full target sequence before the opposition.",
  HalveIt: "HOW TO PLAY:\n• The scorer presents one target per round. Each player throws three darts at it.\n• Valid hits add their scored value. Missing the target with all three darts applies the round penalty, normally halving the running total.\n\nWINNING:\nAfter every target has been played, the highest score wins.",
  CountUp: "HOW TO PLAY:\n• Players alternate three-dart visits and add valid scores to their running total.\n• Any special target or penalty shown by this format is applied after the visit.\n\nWINNING:\nReach the displayed target first, or hold the highest total when the final round ends.",
  Killer: "HOW TO PLAY:\n• Each player is assigned a number and begins with the displayed number of lives.\n• Hit your own double to become a Killer. Once live, hit an opponent’s double to remove a life.\n• Players throw three darts per visit.\n\nWINNING:\nBe the last player with at least one life remaining.",
  MultiKiller: "HOW TO PLAY:\n• Every player receives a unique number and the same number of lives.\n• Become a Killer by hitting your own double, then remove lives by hitting a live opponent’s double.\n• Turns rotate through every active player.\n\nWINNING:\nThe final surviving player wins.",
  Gotcha: "HOW TO PLAY:\n• Start at zero and add each three-dart visit toward the displayed target.\n• Match an opponent’s total exactly to send them back to zero.\n• A visit that takes the score beyond the target is a bust and is discarded.\n\nWINNING:\nLand exactly on the target before the opposition.",
  NearestBull: "HOW TO PLAY:\n• Each player throws the displayed number of darts at the bull. Leave the darts in the board until everyone has thrown.\n• Compare the closest dart from each player.\n\nWINNING:\nThe dart physically closest to the centre wins. Throw again if the result cannot be separated.",
  HighLow: "HOW TO PLAY:\n• Follow the on-screen instruction to beat the previous score by going higher or lower.\n• Players throw three darts per visit. Failing the condition costs a life.\n\nWINNING:\nBe the last player with a life remaining.",
  NinetyNine: "HOW TO PLAY:\n• Throw exactly 99 darts at the target type shown by the scorer.\n• The app counts valid hits and keeps the running total.\n\nWINNING:\nThe highest valid-hit total after dart 99 wins.",
  DeadCentre: "HOW TO PLAY:\n• Every visit is aimed at the bull. Inner and outer bull score according to the on-screen values.\n• Players alternate three-dart visits for the stated number of rounds.\n\nWINNING:\nFinish with the highest bull score.",
  ShootingGallery: "HOW TO PLAY:\n• A target appears on screen for each shot. Throw at that target and record the result before it changes.\n• Complete every target in the gallery.\n\nWINNING:\nThe player with the most successful targets wins.",
  JDCChallenge41: "HOW TO PLAY:\n• Complete the official 41-dart target sequence shown by the scorer.\n• Record each dart against the active target; the app calculates the challenge total.\n\nWINNING:\nHighest final challenge score wins.",
  ExponentialBundle: "HOW TO PLAY:\n• Score on the active target to build the bundle shown on screen.\n• Consecutive valid hits increase its value; a miss ends or resets the bundle as displayed.\n\nWINNING:\nFinish the rounds with the highest accumulated score.",
  TeamX01: "HOW TO PLAY:\n• Both teams share one running X01 score. Team-mates rotate through three-dart visits before the other team throws.\n• Subtract each visit from the team total and obey the displayed finishing rule.\n• An invalid finish is a bust and restores the score from before that visit.\n\nWINNING:\nThe first team to reach exactly zero with a valid finishing dart wins.",
};

export function buildFallbackGameRules(game: RuleGame): string {
  const config=configOf(game);
  const description=game.description?.trim() || `${game.name} uses the on-screen scorer to track each turn.`;
  const engine=game.engine ?? "Custom";
  const guidance=engine === "X01" ? x01Rules(config) : ENGINE_GUIDANCE[engine] ?? "HOW TO PLAY:\n• Read the objective below, then follow the target and turn prompts shown by the scorer.\n• Players normally throw three darts before play passes to the next player.\n• Record each visit immediately so the current score and target remain accurate.\n\nWINNING:\nComplete the stated objective first, or finish with the best score when the rounds end.";
  return `OBJECTIVE:\n${description}\n\n${guidance}\n\nMATCH SETUP:\nAgree the order of throw before starting. If the game finishes level and gives no separate tie-break rule, replay the deciding round.`;
}
