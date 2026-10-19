/**
 * Club team nights: the clubs of your darts nation play each other home and away on a Wednesday night, six singles a side,
 * best of five legs. A team scores a point for each singles won; a fixture won is two league points, a draw one.
 * Real events always come first: anyone booked into an event that night (you included) sits it out and a clubmate plays.
 */
export const TEAMS = Object.freeze({
  version: 1,
  /** Wednesday. */
  dayOfWeek: 3,
  singles: 6,
  bestOf: 5,
  /** The league runs between these weeks (fixtures spread evenly). */
  firstWeek: 4, lastWeek: 46,
  points: { win: 2, draw: 1 },
});

export const teamNightDay = (week: number) => (week - 1) * 7 + TEAMS.dayOfWeek;
export const TEAM_PLAYOFFS = Object.freeze({ semiWeek: 48, finalWeek: 50, semiRound: 15, finalRound: 16 });

/**
 * Double round-robin (the circle method, then the same again with home and away swapped), spread evenly across the
 * league weeks. With an odd number of clubs one sits out each round. Fewer than two clubs: no league.
 */
export function fixturesFor(clubs: readonly string[]): { round: number; week: number; home: string; away: string }[] {
  if (clubs.length < 2) return [];
  const list: (string | null)[] = [...clubs].sort();
  if (list.length % 2) list.push(null);
  const n = list.length, half: { home: string; away: string }[][] = [];
  const rot = [...list];
  for (let r = 0; r < n - 1; r++) {
    const round: { home: string; away: string }[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rot[i], b = rot[n - 1 - i];
      if (a && b) round.push(r % 2 ? { home: b, away: a } : { home: a, away: b });
    }
    half.push(round);
    rot.splice(1, 0, rot.pop()!);
  }
  const rounds = [...half, ...half.map(r => r.map(f => ({ home: f.away, away: f.home })))];
  const span = TEAMS.lastWeek - TEAMS.firstWeek;
  return rounds.flatMap((r, i) => r.map(f => ({ round: i + 1, week: TEAMS.firstWeek + Math.round(i * span / Math.max(1, rounds.length - 1)), ...f })));
}

export type FixtureResult = { round: number; week: number; home: string; away: string; homeScore: number; awayScore: number };
export type TableRow = { club: string; played: number; won: number; drawn: number; lost: number; singlesFor: number; singlesAgainst: number; points: number };
/** The league table from played fixtures: points, then singles difference, then singles won. */
export function leagueTable(clubs: readonly string[], results: readonly FixtureResult[]): (TableRow & { position: number })[] {
  const rows = new Map(clubs.map(c => [c, { club: c, played: 0, won: 0, drawn: 0, lost: 0, singlesFor: 0, singlesAgainst: 0, points: 0 }]));
  for (const f of results) for (const [club, us, them] of [[f.home, f.homeScore, f.awayScore], [f.away, f.awayScore, f.homeScore]] as const) {
    const r = rows.get(club); if (!r) continue;
    r.played++; r.singlesFor += us; r.singlesAgainst += them;
    if (us > them) { r.won++; r.points += TEAMS.points.win; } else if (us === them) { r.drawn++; r.points += TEAMS.points.draw; } else r.lost++;
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || (b.singlesFor - b.singlesAgainst) - (a.singlesFor - a.singlesAgainst) || b.singlesFor - a.singlesFor || a.club.localeCompare(b.club))
    .map((r, i) => ({ ...r, position: i + 1 }));
}

/** The top four qualify once the full double round-robin is complete; regular-season seed breaks tied knockout matches. */
export function playoffFixtures(clubs: readonly string[], results: readonly FixtureResult[]) {
  const regular = fixturesFor(clubs);
  if (clubs.length < 4 || regular.some(f => !results.some(r => r.round === f.round && r.home === f.home))) return [];
  const table = leagueTable(clubs, results.filter(r => r.round < TEAM_PLAYOFFS.semiRound));
  const seeds = table.slice(0, 4);
  const semis = [
    { round: TEAM_PLAYOFFS.semiRound, week: TEAM_PLAYOFFS.semiWeek, home: seeds[0].club, away: seeds[3].club },
    { round: TEAM_PLAYOFFS.semiRound, week: TEAM_PLAYOFFS.semiWeek, home: seeds[1].club, away: seeds[2].club },
  ];
  const semisPlayed = semis.map(f => results.find(r => r.round === f.round && r.home === f.home));
  if (semisPlayed.some(r => !r)) return semis;
  const winner = (f: typeof semis[number], result: FixtureResult) => result.homeScore > result.awayScore ? f.home
    : result.awayScore > result.homeScore ? f.away
    : f.home; // the higher regular-season seed is at home
  const final = { round: TEAM_PLAYOFFS.finalRound, week: TEAM_PLAYOFFS.finalWeek,
    home: winner(semis[0], semisPlayed[0]!), away: winner(semis[1], semisPlayed[1]!) };
  return [final];
}
