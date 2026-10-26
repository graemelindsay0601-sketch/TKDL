/**
 * UKDA-inspired county squads.
 *
 * The UKDA 2021/22 National League rules describe four concurrent team matches
 * per county fixture: men's A/B (12 singles each) and women's A/B (6 singles
 * each). Career keeps this format explicit instead of treating an individual
 * county points table as a played team championship.
 */
export const COUNTY_SQUAD_FORMAT = Object.freeze({
  categories: ["MEN", "WOMEN"] as const,
  teams: ["A", "B"] as const,
  menPlayersPerTeam: 12,
  womenPlayersPerTeam: 6,
  menABestOf: 7,
  menBBestOfByDivision: { PREMIERSHIP: 7, CHAMPIONSHIP: 7, ONE: 5, TWO: 5, THREE: 5 } as const,
  womenBestOf: 5,
});

export type CountyCategory = typeof COUNTY_SQUAD_FORMAT.categories[number];
export type CountyTeam = typeof COUNTY_SQUAD_FORMAT.teams[number];
export type CountySquadPlayer = { key: string; points: number; women: boolean; selectionSource?: "COUNTY_RESULTS" | "COUNTY_TRIAL" };

export function countySelectionRanking(players: readonly CountySquadPlayer[], category: CountyCategory) {
  const women = category === "WOMEN";
  const teamSize = women ? COUNTY_SQUAD_FORMAT.womenPlayersPerTeam : COUNTY_SQUAD_FORMAT.menPlayersPerTeam;
  const ranked = players.filter(p => p.points > 0 && p.women === women)
    .sort((a, b) => b.points - a.points || a.key.localeCompare(b.key));
  const index = ranked.findIndex(p => p.key === "HUMAN");
  const rank = index < 0 ? null : index + 1;
  return {
    points: players.find(p => p.key === "HUMAN" && p.women === women)?.points ?? 0,
    rank,
    teamSize,
    aCutoffPoints: ranked[teamSize - 1]?.points ?? null,
    projectedTeam: rank === null ? null : rank <= teamSize ? "A" as const : rank <= teamSize * 2 ? "B" as const : null,
  };
}

/** A/B selection is based on the previous season's local results, not hidden ability. */
export function selectCountySquads(players: readonly CountySquadPlayer[], trialQualified: CountyCategory | null = null) {
  const output = {
    MEN: { A: [] as CountySquadPlayer[], B: [] as CountySquadPlayer[] },
    WOMEN: { A: [] as CountySquadPlayer[], B: [] as CountySquadPlayer[] },
  };
  for (const category of COUNTY_SQUAD_FORMAT.categories) {
    const women = category === "WOMEN";
    const limit = women ? COUNTY_SQUAD_FORMAT.womenPlayersPerTeam : COUNTY_SQUAD_FORMAT.menPlayersPerTeam;
    const ranked = players.filter(p => p.points > 0 && p.women === women)
      .sort((a, b) => b.points - a.points || a.key.localeCompare(b.key));
    output[category].A = ranked.slice(0, limit);
    output[category].B = ranked.slice(limit, limit * 2);
    if (trialQualified === category && ![...output[category].A, ...output[category].B].some(p => p.key === "HUMAN")) {
      const human = players.find(p => p.key === "HUMAN" && p.women === women) ?? { key: "HUMAN", points: 0, women };
      const trialPlayer = { ...human, selectionSource: "COUNTY_TRIAL" as const };
      output[category].B = output[category].B.length >= limit
        ? [...output[category].B.slice(0, limit - 1), trialPlayer]
        : [...output[category].B, trialPlayer];
    }
  }
  return output;
}

/** Each county meets every other county once per season; fixture order is stable. */
export function countyFixtures(counties: readonly string[], weeks: readonly number[]) {
  if (counties.length < 2) return [];
  const rotating: (string | null)[] = [...[...counties].sort()];
  if (rotating.length % 2) rotating.push(null);
  const roundCount = rotating.length - 1;
  if (weeks.length < roundCount) return [];
  const rounds: { round: number; week: number; home: string; away: string }[] = [];
  for (let round = 0; round < rotating.length - 1; round++) {
    for (let i = 0; i < rotating.length / 2; i++) {
      const home = rotating[i], away = rotating[rotating.length - 1 - i];
      if (home && away) rounds.push({
        round: round + 1,
        week: weeks[round],
        home: round % 2 ? away : home,
        away: round % 2 ? home : away,
      });
    }
    rotating.splice(1, 0, rotating.pop()!);
  }
  return rounds;
}

/** Single-elimination county cup. Completed ties advance the aggregate sets winner; an odd field receives a bye. */
export function countyCupFixtures(
  counties: readonly string[],
  played: readonly { round: number; week?: number; home: string; away: string; status: string; matches: readonly { homeSets: number; awaySets: number }[] }[],
) {
  let entrants = [...counties].sort();
  for (let stage = 1; entrants.length > 1; stage++) {
    const round = 100 + stage, pairs = Array.from({ length: Math.floor(entrants.length / 2) }, (_, i) => ({
      home: entrants[i], away: entrants[entrants.length - 1 - i],
    }));
    const results = pairs.map(f => played.find(p => p.round === round && p.home === f.home && p.away === f.away));
    const previousWeek = Math.max(0, ...played.filter(r => r.round === round - 1).map(r => r.week ?? 0));
    const stageWeek = Math.max(47 + stage, previousWeek + 1);
    if (results.some(r => !r || r.status !== "COMPLETED")) {
      return pairs.map(f => ({ ...f, round, week: stageWeek }));
    }
    const winners = pairs.map((f, i) => {
      const r = results[i]!;
      const homeSets = r.matches.reduce((n, m) => n + m.homeSets, 0);
      const awaySets = r.matches.reduce((n, m) => n + m.awaySets, 0);
      return homeSets >= awaySets ? f.home : f.away;
    });
    if (entrants.length % 2) winners.push(entrants[Math.floor(entrants.length / 2)]);
    entrants = winners;
  }
  return [];
}

export type CountyMatchResult = {
  category: CountyCategory; team: CountyTeam; home: string; away: string;
  homeSets: number; awaySets: number; homeLegs: number; awayLegs: number;
  homeAverage: number; awayAverage: number;
  youPlayed?: boolean; youWon?: boolean;
  humanMatch?: { id: string; status: "LIVE" | "PLAYED"; won?: boolean };
};
export type CountyStanding = {
  county: string; category: CountyCategory; team: CountyTeam; played: number;
  won: number; drawn: number; lost: number; setsFor: number; setsAgainst: number;
  points: number; legsDifference: number; combinedAverage: number; position: number;
};

/** UKDA publishes separate tables for Men's A/B and Women's A/B; one point is earned per set won. */
export function countyTables(counties: readonly string[], results: readonly CountyMatchResult[]): CountyStanding[] {
  const all: CountyStanding[] = [];
  for (const category of COUNTY_SQUAD_FORMAT.categories) for (const team of COUNTY_SQUAD_FORMAT.teams) {
    const rows = new Map(counties.map(county => [county, {
      county, category, team, played: 0, won: 0, drawn: 0, lost: 0, setsFor: 0, setsAgainst: 0,
      points: 0, legsDifference: 0, combinedAverage: 0,
    }]));
    for (const fixture of results) {
      if (fixture.category !== category || fixture.team !== team) continue;
      const home = rows.get(fixture.home), away = rows.get(fixture.away);
      if (!home || !away) continue;
      home.played++; away.played++;
      home.setsFor += fixture.homeSets; home.setsAgainst += fixture.awaySets;
      away.setsFor += fixture.awaySets; away.setsAgainst += fixture.homeSets;
      home.points += fixture.homeSets; away.points += fixture.awaySets;
      home.legsDifference += fixture.homeLegs - fixture.awayLegs;
      away.legsDifference += fixture.awayLegs - fixture.homeLegs;
      home.combinedAverage += fixture.homeAverage; away.combinedAverage += fixture.awayAverage;
      if (fixture.homeSets > fixture.awaySets) { home.won++; away.lost++; }
      else if (fixture.homeSets < fixture.awaySets) { away.won++; home.lost++; }
      else { home.drawn++; away.drawn++; }
    }
    const table = [...rows.values()].sort((a, b) => b.points - a.points || b.won - a.won || b.drawn - a.drawn ||
      b.legsDifference - a.legsDifference || b.combinedAverage - a.combinedAverage || a.county.localeCompare(b.county));
    all.push(...table.map((row, index) => ({ ...row, position: index + 1 })));
  }
  return all;
}
