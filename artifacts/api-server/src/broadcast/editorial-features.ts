import type { ProgrammeSegment, RunningOrderSlotPurpose } from "./director-math.ts";

export type EditorialPlayer = {
  id: number;
  name: string;
  points: number;
  wins: number;
  losses: number;
  status: string;
  eliminationsCount: number;
};

export type EditorialMatch = {
  id: number;
  winnerId: number;
  loserId: number;
  winnerName: string;
  loserName: string;
  stake: number;
  playedAt: Date;
};

export type EditorialStory = {
  id: number;
  storyType: string;
  score?: number;
  anchorMatchId: number | null;
  facts: Record<string, unknown>;
};

type Feature = {
  key: string;
  purpose: RunningOrderSlotPurpose;
  graphicKind?: NonNullable<ProgrammeSegment["graphicKind"]>;
  lineA: string;
  lineB: string;
  facts: Record<string, unknown>;
};

function turn(text: string) {
  return { text, holdSeconds: Math.max(3.5, Math.min(9, text.split(/\s+/).length / 2.5)), speaker: "A" as const };
}

function isoWeekStart(value: Date): Date {
  const day = value.getUTCDay() || 7;
  const start = new Date(value);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - day + 1);
  return start;
}

function stableIndex(seed: string, length: number): number {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

function median(values: readonly number[]): number {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function performanceDescription(storyType: string): string {
  const descriptions: Record<string, string> = {
    CLINICAL_FINISHING: "clinical finishing",
    DOUBLE_TROUBLE: "a difficult night on the doubles",
    SCORING_POWER: "strong scoring",
    SCORING_WITHOUT_FINISHING: "strong scoring without the finishing return",
    SEASON_BEST: "a season best",
    PERSONAL_BEST: "a personal best",
  };
  return descriptions[storyType] ?? "a notable performance";
}

function upsetDescription(storyType: string): string {
  if (storyType === "MAJOR_UPSET") return "a major upset";
  if (storyType === "MODEL_SHOCK") return "a result the numbers strongly favoured the other way";
  return "an upset";
}

/**
 * Builds recurring desk features only from the supplied cutoff snapshot.
 * Ordinary programmes receive one rotating feature; recovery programmes can
 * carry a broader, still bounded set. No feature owns a story id, so a
 * persisted result remains the sole spoken result narrative for its match.
 */
export function buildEditorialFeatures(params: {
  players: readonly EditorialPlayer[];
  matches: readonly EditorialMatch[];
  stories: readonly EditorialStory[];
  cutoff: Date;
  rotationKey: string;
  broad: boolean;
  representedMatchIds?: ReadonlySet<number>;
}): ProgrammeSegment[] {
  const active = params.players
    .filter(player => player.status !== "ELIMINATED" && player.points > 0)
    .sort((a, b) => a.points - b.points || a.name.localeCompare(b.name) || a.id - b.id);
  const names = new Map(params.players.map(player => [player.id, player.name]));
  const completed = params.matches
    .filter(match => match.playedAt <= params.cutoff)
    .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime() || a.id - b.id);
  const features: Feature[] = [];
  const matchesById = new Map(completed.map(match => [match.id, match]));

  if (active.length > 0) {
    const lowest = active[0];
    const dangerRows = active.slice(0, 5).map((player, index) => ({
      position: index + 1, id: player.id, name: player.name,
      points: player.points, wins: player.wins, losses: player.losses,
    }));
    features.push({
      key: "survival-watch", purpose: "analysis_or_predictor", graphicKind: "LeagueTableGraphic",
      lineA: `Survival Watch: ${lowest.name} has the lowest active total, on ${lowest.points} points.`,
      lineB: "That is exposure to elimination risk, not a prediction of the next result.",
      facts: { featureTitle: "Survival Watch", playerId: lowest.id, playerName: lowest.name, points: lowest.points, activePlayers: active.length, rows: dangerRows },
    });
    features.push({
      key: "survivors", purpose: "third_league_current_state", graphicKind: "LeagueTableGraphic",
      lineA: `Survivors Remaining: ${active.length} ${active.length === 1 ? "player remains" : "players remain"} active in Singles.`,
      lineB: `${params.players.length - active.length} ${params.players.length - active.length === 1 ? "player is" : "players are"} currently eliminated.`,
      facts: { featureTitle: "Survivors Remaining", survivors: active.length, eliminated: params.players.length - active.length, rows: dangerRows },
    });
  }

  const weekStart = isoWeekStart(params.cutoff);
  const weekly = completed.filter(match => match.playedAt >= weekStart);
  const largest = [...weekly].sort((a, b) => b.stake - a.stake || a.playedAt.getTime() - b.playedAt.getTime() || a.id - b.id)[0];
  if (largest && largest.stake > 0) {
    features.push({
      key: "wager-week", purpose: "lighter_or_archive_or_callback", graphicKind: "WagerGraphic",
      lineA: `Wager of the Week: the largest verified stake since Monday is ${largest.stake} points.`,
      lineB: `It came when ${largest.winnerName} played ${largest.loserName}. This award is about the size of the wager, not another result call.`,
      facts: {
        featureTitle: "Wager of the Week", matchId: largest.id, stake: largest.stake,
        winnerName: largest.winnerName, loserName: largest.loserName,
        playedAt: largest.playedAt.toISOString(), participants: [largest.winnerName, largest.loserName],
      },
    });
  }

  const weeklyResultFacts = params.stories
    .filter(story => story.storyType === "MATCH_RESULT"
      && story.anchorMatchId !== null
      && Date.parse(String(story.facts.playedAt)) >= weekStart.getTime()
      && Date.parse(String(story.facts.playedAt)) <= params.cutoff.getTime())
    .map(story => {
      const before = [Number(story.facts.winnerPointsBefore), Number(story.facts.loserPointsBefore)];
      const after = [Number(story.facts.winnerPointsAfter), Number(story.facts.loserPointsAfter)];
      if (![...before, ...after].every(Number.isFinite)) return null;
      return { story, before, after };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);
  const weeklySwings = new Map<number, number>();
  const weeklyPaths = new Map<number, { lowestBefore: number; finalAfter: number }>();
  for (const result of weeklyResultFacts) {
    const winnerId = Number(result.story.facts.winnerId);
    const loserId = Number(result.story.facts.loserId);
    if (Number.isFinite(winnerId)) weeklySwings.set(winnerId, (weeklySwings.get(winnerId) ?? 0) + result.after[0] - result.before[0]);
    if (Number.isFinite(loserId)) weeklySwings.set(loserId, (weeklySwings.get(loserId) ?? 0) + result.after[1] - result.before[1]);
    for (const [id, before, after] of [
      [winnerId, result.before[0], result.after[0]],
      [loserId, result.before[1], result.after[1]],
    ] as const) {
      if (!Number.isFinite(id)) continue;
      const path = weeklyPaths.get(id);
      weeklyPaths.set(id, {
        lowestBefore: Math.min(path?.lowestBefore ?? before, before),
        finalAfter: after,
      });
    }
  }
  const biggestGain = [...weeklySwings].filter(([id]) => names.has(id)).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const biggestFall = [...weeklySwings].filter(([id]) => names.has(id)).sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
  if (biggestGain && biggestFall && (biggestGain[1] > 0 || biggestFall[1] < 0)) {
    features.push({
      key: "points-swing", purpose: "analysis_or_predictor",
      lineA: `Points Swing: since Monday, ${names.get(biggestGain[0])} has made the biggest gain, adding ${Math.abs(biggestGain[1])} points.`,
      lineB: `${names.get(biggestFall[0])} has the largest fall, losing ${Math.abs(biggestFall[1])} points overall. That comes from the recorded points changes, rather than another replay of the results.`,
      facts: {
        featureTitle: "Points Swing", gainingPlayerId: biggestGain[0], gainingPlayerName: names.get(biggestGain[0]),
        netGain: biggestGain[1], fallingPlayerId: biggestFall[0], fallingPlayerName: names.get(biggestFall[0]), netFall: biggestFall[1],
      },
    });
  }
  const escape = [...weeklyPaths]
    .filter(([id, path]) => names.has(id) && path.lowestBefore <= 5 && path.finalAfter >= path.lowestBefore + 3)
    .sort((a, b) => (b[1].finalAfter - b[1].lowestBefore) - (a[1].finalAfter - a[1].lowestBefore) || a[0] - b[0])[0];
  if (escape) features.push({
    key: "escape-act", purpose: "form_h2h_or_spotlight",
    lineA: `Escape Act: ${names.get(escape[0])} was down to ${escape[1].lowestBefore} points this week and has since reached ${escape[1].finalAfter}.`,
    lineB: "That is confirmed movement away from elimination danger, not an estimated recovery.",
    facts: {
      featureTitle: "Escape Act", playerId: escape[0], playerName: names.get(escape[0]),
      dangerPoint: escape[1].lowestBefore, recoveredTo: escape[1].finalAfter,
    },
  });

  const upsetTypes = new Set(["UPSET", "MAJOR_UPSET", "MODEL_SHOCK"]);
  const upsetCounts = new Map<number, number>();
  for (const story of params.stories.filter(story => upsetTypes.has(story.storyType))) {
    const id = Number(story.facts.winnerId);
    if (Number.isFinite(id)) upsetCounts.set(id, (upsetCounts.get(id) ?? 0) + 1);
  }
  const upsetLeader = [...upsetCounts].filter(([id]) => names.has(id)).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  if (upsetLeader) features.push({
    key: "upset-hunter", purpose: "form_h2h_or_spotlight",
    lineA: `Upset Hunter: ${names.get(upsetLeader[0])} has produced ${upsetLeader[1]} ${upsetLeader[1] === 1 ? "upset" : "upsets"} this season.`,
    lineB: "Those were results where the available evidence favoured the opponent.",
    facts: { featureTitle: "Upset Hunter", playerId: upsetLeader[0], playerName: names.get(upsetLeader[0]), upsetStories: upsetLeader[1] },
  });
  const weeklyUpsets = params.stories
    .filter(story => upsetTypes.has(story.storyType)
      && story.anchorMatchId !== null
      && (matchesById.get(story.anchorMatchId)?.playedAt.getTime() ?? Number.POSITIVE_INFINITY) >= weekStart.getTime()
      && (matchesById.get(story.anchorMatchId)?.playedAt.getTime() ?? Number.POSITIVE_INFINITY) <= params.cutoff.getTime())
    .sort((a, b) => {
      const probabilityDifference = Number(a.facts.winnerProbability) - Number(b.facts.winnerProbability);
      return (Number.isFinite(probabilityDifference) ? probabilityDifference : 0)
        || (b.score ?? 0) - (a.score ?? 0)
        || a.id - b.id;
    });
  const shock = weeklyUpsets[0];
  if (shock) {
    const winnerName = names.get(Number(shock.facts.winnerId));
    const match = shock.anchorMatchId === null ? null : matchesById.get(shock.anchorMatchId);
    if (winnerName && match) features.push({
      key: "shock-week", purpose: "lighter_or_archive_or_callback",
      lineA: `Shock of the Week: ${winnerName}'s win was the biggest verified surprise since Monday.`,
      lineB: `The match was ${upsetDescription(shock.storyType)}. The award does not add a new probability claim.`,
      facts: { featureTitle: "Shock of the Week", playerId: Number(shock.facts.winnerId), playerName: winnerName, matchId: match.id, detector: shock.storyType },
    });
  }

  const pressure = new Map<number, { wins: number; losses: number }>();
  for (const story of params.stories.filter(story => story.storyType === "HIGH_STAKE_WIN" || story.storyType === "HIGH_STAKE_LOSS")) {
    const id = Number(story.facts[story.storyType === "HIGH_STAKE_WIN" ? "winnerId" : "loserId"]);
    if (!Number.isFinite(id)) continue;
    const row = pressure.get(id) ?? { wins: 0, losses: 0 };
    if (story.storyType === "HIGH_STAKE_WIN") row.wins++; else row.losses++;
    pressure.set(id, row);
  }
  const pressureLeader = [...pressure].filter(([id]) => names.has(id))
    .sort((a, b) => b[1].wins - a[1].wins || a[1].losses - b[1].losses || a[0] - b[0])[0];
  if (pressureLeader) features.push({
    key: "pressure-player", purpose: "form_h2h_or_spotlight",
    lineA: `Pressure Player: ${names.get(pressureLeader[0])} has ${pressureLeader[1].wins} ${pressureLeader[1].wins === 1 ? "win" : "wins"} when plenty of points were at stake.`,
    lineB: `They also have ${pressureLeader[1].losses} ${pressureLeader[1].losses === 1 ? "loss" : "losses"} in those high pressure matches.`,
    facts: { featureTitle: "Pressure Player", playerId: pressureLeader[0], playerName: names.get(pressureLeader[0]), highStakeWins: pressureLeader[1].wins, highStakeLosses: pressureLeader[1].losses },
  });
  const performanceTypes = new Set(["CLINICAL_FINISHING", "DOUBLE_TROUBLE", "SCORING_POWER", "SCORING_WITHOUT_FINISHING", "SEASON_BEST", "PERSONAL_BEST"]);
  const performance = params.stories
    .filter(story => performanceTypes.has(story.storyType)
      && story.anchorMatchId !== null
      && (matchesById.get(story.anchorMatchId)?.playedAt.getTime() ?? Number.POSITIVE_INFINITY) >= weekStart.getTime()
      && (matchesById.get(story.anchorMatchId)?.playedAt.getTime() ?? Number.POSITIVE_INFINITY) <= params.cutoff.getTime())
    .filter(story => names.has(Number(story.facts.playerId)))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.id - b.id)[0];
  if (performance) features.push({
    key: "performance-week", purpose: "form_h2h_or_spotlight",
    lineA: `Performance of the Week: ${names.get(Number(performance.facts.playerId))} produced the best verified display since Monday.`,
    lineB: `The reason was ${performanceDescription(performance.storyType)}. We only make that call when the supporting figures are available.`,
    facts: {
      featureTitle: "Performance of the Week", playerId: Number(performance.facts.playerId),
      playerName: names.get(Number(performance.facts.playerId)), detector: performance.storyType,
      detectorScore: performance.score ?? 0,
    },
  });

  const stakes = completed.filter(match => match.stake > 0).map(match => match.stake);
  const observedByPlayer = new Map<number, number[]>();
  for (const match of completed.filter(item => item.stake > 0)) {
    for (const id of [match.winnerId, match.loserId]) {
      const values = observedByPlayer.get(id) ?? [];
      values.push(match.stake);
      observedByPlayer.set(id, values);
    }
  }
  const riskLeader = [...observedByPlayer]
    .filter(([id, values]) => names.has(id) && values.length >= 3)
    .map(([id, values]) => ({ id, values, average: values.reduce((sum, value) => sum + value, 0) / values.length }))
    .sort((a, b) => b.average - a.average || a.id - b.id)[0];
  if (riskLeader) features.push({
    key: "risk-profile", purpose: "form_h2h_or_spotlight", graphicKind: "WagerGraphic",
    lineA: `Risk Profile: ${names.get(riskLeader.id)} has the highest average wager among players with at least three matches, at ${riskLeader.average.toFixed(1)} points.`,
    lineB: `Across those ${riskLeader.values.length} matches, the wagers range from ${Math.min(...riskLeader.values)} to ${Math.max(...riskLeader.values)} points. That describes the matches played, not the player's personality.`,
    facts: {
      featureTitle: "Risk Profile", playerId: riskLeader.id, playerName: names.get(riskLeader.id),
      sampleSize: riskLeader.values.length, averageStake: riskLeader.average,
      minimumStake: Math.min(...riskLeader.values), stake: median(riskLeader.values), maximumStake: Math.max(...riskLeader.values),
    },
  });

  const eliminationLeader = [...params.players]
    .filter(player => player.eliminationsCount > 0)
    .sort((a, b) => b.eliminationsCount - a.eliminationsCount || a.name.localeCompare(b.name) || a.id - b.id)[0];
  if (eliminationLeader) features.push({
    key: "elimination-leader", purpose: "form_h2h_or_spotlight",
    lineA: `Elimination Leader: ${eliminationLeader.name} has recorded ${eliminationLeader.eliminationsCount} career ${eliminationLeader.eliminationsCount === 1 ? "knockout" : "knockouts"}.`,
    lineB: "That count includes confirmed knockouts only.",
    facts: { featureTitle: "Elimination Leader", playerId: eliminationLeader.id, playerName: eliminationLeader.name, eliminations: eliminationLeader.eliminationsCount },
  });

  if (params.players.length >= 5) {
    const top = [...params.players].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name) || a.id - b.id).slice(0, 5);
    features.push({
      key: "power-five", purpose: "analysis_or_predictor", graphicKind: "LeagueTableGraphic",
      lineA: `Power Five: the current table top five are ${top.map(player => player.name).join(", ")}.`,
      lineB: "This is the table order as recorded, not a subjective power rating.",
      facts: { featureTitle: "Power Five", rows: top.map((player, index) => ({ position: index + 1, id: player.id, name: player.name, points: player.points, wins: player.wins, losses: player.losses })) },
    });
  }

  if (active.length >= 2) {
    const contenders = [...active].sort((a, b) => b.points - a.points || b.wins - a.wins || a.id - b.id);
    const [first, second] = contenders;
    const legalMax = Math.min(first.points, second.points);
    if (legalMax > 0) {
      const opinion = Math.max(1, Math.min(legalMax, Math.round(median(stakes.length ? stakes : [1]))));
      features.push({
        key: "what-wager", purpose: "lighter_or_archive_or_callback", graphicKind: "WagerGraphic",
        lineA: `Host opinion — What Would You Wager? In a purely hypothetical match between ${first.name} and ${second.name}, Chalky's number would be ${opinion}.`,
        lineB: `The legal maximum from their current balances is ${legalMax}. This is presenter opinion, not a recommendation or a fixture announcement.`,
        facts: { featureTitle: "What Would You Wager?", labelledAs: "host opinion", playerIds: [first.id, second.id], stake: opinion, opinionStake: opinion, legalMaximum: legalMax },
      });
    }
  }

  if (params.players.length > 0) {
    const table = [...params.players].sort((a, b) => b.points - a.points || b.wins - a.wins || a.id - b.id);
    const leader = table[0];
    features.push({
      key: "season-story", purpose: "analysis_or_predictor", graphicKind: "LeagueTableGraphic",
      lineA: `Season Story So Far: ${leader.name} leads the current table on ${leader.points} points, with ${leader.wins} ${leader.wins === 1 ? "win" : "wins"} and ${leader.losses} ${leader.losses === 1 ? "loss" : "losses"}.`,
      lineB: `${active.length} of ${params.players.length} players remain active. Those are current status, form and table facts only.`,
      facts: {
        featureTitle: "Season Story So Far", leaderId: leader.id, leaderName: leader.name,
        leaderPoints: leader.points, wins: leader.wins, losses: leader.losses,
        survivors: active.length, fieldSize: params.players.length,
        rows: table.slice(0, 5).map((player, index) => ({
          position: index + 1, id: player.id, name: player.name,
          points: player.points, wins: player.wins, losses: player.losses,
        })),
      },
    });
  }

  if (features.length === 0) return [];
  const start = stableIndex(params.rotationKey, features.length);
  const rotated = [...features.slice(start), ...features.slice(0, start)];
  // A producer-triggered catch-up/clean sweep is deliberately the complete
  // editorial reset: include every feature whose evidence gate passed.
  // Ordinary scheduled Editions still rotate one desk at a time.
  const selected = params.broad ? rotated : rotated.slice(0, 1);
  return selected.map((feature, index) => {
    const a = turn(feature.lineA);
    const b = { ...turn(feature.lineB), speaker: "B" as const };
    return {
      slot: 9 + index,
      purpose: feature.purpose,
      importance: "utility",
      storyId: null,
      supportingStoryIds: [],
      storyType: null,
      leagueType: "singles",
      lifecycleAtBroadcast: null,
      dialogue: [a, b],
      validityRules: [],
      facts: feature.facts,
      ...(feature.graphicKind ? { graphicKind: feature.graphicKind } : {}),
    };
  });
}