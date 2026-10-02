/**
 * Facts that the persisted combined/multi-team result tables can prove
 * without inferring which individual threw in a team match.
 */
export type TeamResultAchievementFacts = {
  wonSoloOutnumbered: boolean;
  wonMultiTeam: boolean;
};

export function doublesTeamResultAchievementKeys(
  facts: TeamResultAchievementFacts & { wonAsDefendingChampions: boolean },
): string[] {
  const keys: string[] = [];
  if (facts.wonSoloOutnumbered) keys.push("DBL_SOLO_OUTNUMBERED");
  if (facts.wonMultiTeam) keys.push("DBL_MULTI_SURVIVOR");
  if (facts.wonAsDefendingChampions) keys.push("DBL_DEFENDING_CHAMP_WIN");
  return keys;
}

export function shiftWarsTeamResultAchievementKeys(
  facts: TeamResultAchievementFacts,
): string[] {
  const keys: string[] = [];
  if (facts.wonSoloOutnumbered) keys.push("SW_SOLO_OUTNUMBERED");
  if (facts.wonMultiTeam) keys.push("SW_MULTI_SURVIVOR");
  return keys;
}
