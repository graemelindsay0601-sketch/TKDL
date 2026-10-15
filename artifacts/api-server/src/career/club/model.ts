/**
 * Your home club: the darts club of your home area, whose members are the players who live there (and you).
 * Clubs in a country play a county league in divisions: a club scores from its members' finishes at local level
 * (club nights, county and regional events), the top two of each division go up and the bottom two go down at the
 * end of a season. The captain is the member who scored most for the club last season. Nothing here is invented:
 * every point comes from a recorded result.
 */
export const CLUB = Object.freeze({
  circuits: ["GRASSROOTS", "COUNTY", "REGIONAL"] as readonly string[],
  /** Club points for a finishing position: winner, runner-up, semi-finalist, quarter-finalist. */
  points: (position: number) => position === 1 ? 5 : position === 2 ? 3 : position <= 4 ? 2 : position <= 8 ? 1 : 0,
  divisionSize: 8, promoted: 2,
});

export type ClubLocality = { key: string; country: string; city: string; region: string; weight: number };
export type ClubResult = { season: number; participantKey: string; locality: string | null; position: number };
export type ClubSeason = { season: number; country: string; localityKey: string; division: number; points: number; position: number; captainKey: string | null };

export const clubName = (l: Pick<ClubLocality, "city" | "region">) => `${l.city} Darts Club`;

/** Each member's club points in a season (members are keyed by participant; their locality decides their club). */
export function memberPoints(results: readonly ClubResult[], season: number) {
  const out = new Map<string, { locality: string; points: number }>();
  for (const r of results) if (r.season === season && r.locality) {
    const m = out.get(r.participantKey) ?? { locality: r.locality, points: 0 };
    m.points += CLUB.points(r.position); out.set(r.participantKey, m);
  }
  return out;
}

const captainOf = (members: Map<string, { locality: string; points: number }>, locality: string) => {
  const best = [...members].filter(([, m]) => m.locality === locality && m.points > 0)
    .sort((a, b) => b[1].points - a[1].points || (a[0] === "HUMAN" ? -1 : b[0] === "HUMAN" ? 1 : a[0].localeCompare(b[0])))[0];
  return best ? best[0] : null;
};

/**
 * A country's league table for a season. Divisions come from the previous season's table (top two up, bottom two
 * down); the first season is seeded by the size of each area. Captains are last season's top scorers.
 */
export function leagueSeason(country: string, localities: readonly ClubLocality[], results: readonly ClubResult[], season: number,
  previous: readonly ClubSeason[] | null): ClubSeason[] {
  const clubs = localities.filter(l => l.country === country);
  let order: string[];
  if (!previous?.length) order = [...clubs].sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key)).map(c => c.key);
  else {
    const divisions = [...new Set(previous.map(p => p.division))].sort((a, b) => a - b);
    const ranked = divisions.map(d => previous.filter(p => p.division === d).sort((a, b) => a.position - b.position).map(p => p.localityKey));
    for (let i = 0; i + 1 < ranked.length; i++) {
      const up = ranked[i + 1].splice(0, CLUB.promoted), down = ranked[i].splice(Math.max(0, ranked[i].length - CLUB.promoted));
      ranked[i].push(...up); ranked[i + 1].unshift(...down);
    }
    order = ranked.flat();
    for (const c of clubs) if (!order.includes(c.key)) order.push(c.key);
  }
  const points = memberPoints(results, season), last = memberPoints(results, season - 1);
  const total = (key: string) => [...points.values()].filter(m => m.locality === key).reduce((n, m) => n + m.points, 0);
  const out: ClubSeason[] = [];
  for (let start = 0, division = 1; start < order.length; start += CLUB.divisionSize, division++) {
    const keys = order.slice(start, start + CLUB.divisionSize), seeded = new Map(keys.map((k, i) => [k, i]));
    // Ties keep the division's starting order (last season's standing), so a table never reshuffles on a draw.
    keys.map(k => ({ k, p: total(k) })).sort((a, b) => b.p - a.p || seeded.get(a.k)! - seeded.get(b.k)!)
      .forEach((c, i) => out.push({ season, country, localityKey: c.k, division, points: c.p, position: i + 1, captainKey: captainOf(last, c.k) }));
  }
  return out;
}
