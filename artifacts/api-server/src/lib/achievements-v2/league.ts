/**
 * League singles evaluator: every League metric, feat and season goal from recorded matches and season tables.
 * Pure (no database): the loader hands it the rows, so the report over every player and the per-player check
 * use exactly the same rules. Feats return the time of the match that earned them.
 */
export type LeagueMatch = {
  id: number; seasonId: number; winnerId: number; loserId: number; stake: number; eloChange: number; gameType: string; playedAt: Date;
  winner180s: number | null; loser180s: number | null; winner140s: number | null; loser140s: number | null; winner170s: number | null; loser170s: number | null;
  winner100s: number | null; loser100s: number | null; winnerDarts: number | null; loserDarts: number | null;
  winnerCheckoutAttempts: number | null; winnerCheckoutHits: number | null; loserCheckoutAttempts: number | null; loserCheckoutHits: number | null;
};
export type LeagueSeason = { id: number; startDate: Date | null; endDate: Date | null; isActive: boolean; championId: number | null };
export type LeagueStanding = { seasonId: number; playerId: number; position: number; wins: number; losses: number; points: number; isChampion: boolean };
export type LeagueContext = {
  matches: LeagueMatch[];        // at least every match the player was in, in any order
  seasons: LeagueSeason[];
  standings: LeagueStanding[];   // final positions for finished seasons; must include each season's top position and the player's rows
  participants: Map<number, Set<number>>; // season -> every player with a match that season
  player: { id: number; careerPeakElo: number; eliminationsCount: number; longestWinStreak: number };
};
export type LeagueResult = {
  metrics: Record<string, number>;
  feats: Record<string, Date | null>;
  seasons: Map<number, Record<string, number>>;
};

const WEEK_MS = 7 * 24 * 3600 * 1000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const weekKey = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return dayKey(x); };

export function evaluateLeague(ctx: LeagueContext): LeagueResult {
  const me = ctx.player.id;
  const mine = ctx.matches.filter(m => m.winnerId === me || m.loserId === me)
    .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime() || a.id - b.id);
  const won = (m: LeagueMatch) => m.winnerId === me;
  const opp = (m: LeagueMatch) => (won(m) ? m.loserId : m.winnerId);
  const seasonById = new Map(ctx.seasons.map(s => [s.id, s]));
  const finished = (sid: number) => { const s = seasonById.get(sid); return !!s && !s.isActive; };
  const standing = (sid: number, pid: number) => ctx.standings.find(s => s.seasonId === sid && s.playerId === pid);
  const topOf = (sid: number) => ctx.standings.find(s => s.seasonId === sid && s.position === 1)?.playerId ?? seasonById.get(sid)?.championId ?? null;
  const championOf = (sid: number) => seasonById.get(sid)?.championId ?? ctx.standings.find(s => s.seasonId === sid && s.isChampion)?.playerId ?? null;
  const feats: Record<string, Date | null> = {};
  const earn = (key: string, at: Date) => { if (!feats[key]) feats[key] = at; };

  // ---- running tallies in time order
  let run = 0, bestRun = 0, lastBigStakeWin = false; const recent: boolean[] = [];
  const winsVs = new Map<number, number>(), lossesVs = new Map<number, number>(), playedVs = new Map<number, number>(), lastResultVs = new Map<number, boolean>();
  const formats = new Set<string>();
  const winsByDay = new Map<string, number>();
  const weekTally = new Map<string, { wins: number; losses: number; last: Date }>();
  let stakePointsWon = 0, stake10Wins = 0, s180 = 0, s140 = 0, s100 = 0, checkouts = 0, scorerMatches = 0;
  const doubles: { attempts: number; hits: number }[] = [];

  for (const m of mine) {
    const w = won(m), o = opp(m), at = m.playedAt;
    // results
    if (w) {
      run++; bestRun = Math.max(bestRun, run);
      stakePointsWon += m.stake; if (m.stake >= 10) stake10Wins++;
      formats.add(m.gameType);
      winsVs.set(o, (winsVs.get(o) ?? 0) + 1);
      winsByDay.set(dayKey(at), (winsByDay.get(dayKey(at)) ?? 0) + 1); if ((winsByDay.get(dayKey(at)) ?? 0) >= 3) earn("bigNight", at);
      if (m.eloChange >= 25) earn("upsetElo", at);
      if (m.stake >= 20) earn("allIn", at);
      if (m.stake >= 10 && lastBigStakeWin) earn("doubleOrQuits", at);
      if (lastResultVs.get(o) === false) earn("revenge", at);
      // nemesis: the opponent who has beaten you most (3+ times so far, ties count)
      const theirWins = lossesVs.get(o) ?? 0, mostBeatenBy = Math.max(0, ...lossesVs.values());
      if (theirWins >= 3 && theirWins === mostBeatenBy) earn("nemesis", at);
      // grudge match: 10+ stake against the opponent you'd played most before this match
      const mostPlayed = Math.max(0, ...playedVs.values());
      if (m.stake >= 10 && (playedVs.get(o) ?? 0) > 0 && (playedVs.get(o) ?? 0) === mostPlayed) earn("grudgeMatch", at);
      if (finished(m.seasonId) && topOf(m.seasonId) === o) earn("giantKiller", at);
      const prev = ctx.seasons.filter(s => !s.isActive && s.endDate && s.endDate <= at).sort((a, b) => b.endDate!.getTime() - a.endDate!.getTime())[0];
      if (prev && championOf(prev.id) === o) earn("championsScalp", at);
      const season = seasonById.get(m.seasonId);
      if (season && !season.isActive && season.endDate && championOf(m.seasonId) === o && season.endDate.getTime() - at.getTime() <= WEEK_MS && season.endDate >= at) earn("kingmaker", at);
    } else {
      run = 0;
      lossesVs.set(o, (lossesVs.get(o) ?? 0) + 1);
    }
    recent.push(w); if (recent.length > 6) recent.shift();
    if (recent.length === 6 && recent.join() === "false,false,false,true,true,true") earn("bounceBack", at);
    lastBigStakeWin = w && m.stake >= 10;
    playedVs.set(o, (playedVs.get(o) ?? 0) + 1); if ((playedVs.get(o) ?? 0) >= 10) earn("rivalry10", at);
    lastResultVs.set(o, w);
    const wk = weekTally.get(weekKey(at)) ?? { wins: 0, losses: 0, last: at };
    if (w) wk.wins++; else wk.losses++; wk.last = at; weekTally.set(weekKey(at), wk);

    // scoring (only matches played on the scorer have these)
    const my = w ? { s180: m.winner180s, s140: m.winner140s, s170: m.winner170s, s100: m.winner100s, darts: m.winnerDarts, att: m.winnerCheckoutAttempts, hits: m.winnerCheckoutHits }
      : { s180: m.loser180s, s140: m.loser140s, s170: m.loser170s, s100: m.loser100s, darts: m.loserDarts, att: m.loserCheckoutAttempts, hits: m.loserCheckoutHits };
    const their180 = (w ? m.loser180s : m.winner180s) ?? 0;
    if (my.darts !== null && my.darts !== undefined) {
      scorerMatches++;
      s180 += my.s180 ?? 0; s140 += (my.s140 ?? 0) + (my.s170 ?? 0); s100 += my.s100 ?? 0;
      checkouts += my.hits ?? 0;
      if ((my.att ?? 0) > 0) doubles.push({ attempts: my.att ?? 0, hits: my.hits ?? 0 });
      if ((my.s180 ?? 0) >= 2) earn("two180s", at);
      if ((my.s180 ?? 0) >= 3) earn("three180s", at);
      if (w && (my.att ?? 0) >= 6 && (my.hits ?? 0) * 2 >= (my.att ?? 0)) earn("iceCold", at);
      if ((my.s180 ?? 0) >= 1 && their180 >= 2) earn("answerBack", at);
    }
  }
  for (const [, wk] of weekTally) if (wk.wins >= 5 && wk.losses === 0) earn("perfectWeek", wk.last);

  // checkout rate over the most recent 100 darts at a double (needs 100)
  let att = 0, hits = 0;
  for (const d of [...doubles].reverse()) { att += d.attempts; hits += d.hits; if (att >= 100) break; }
  const checkoutRate = att >= 100 ? Math.floor((hits / att) * 100) : 0;

  // ---- per season
  const seasons = new Map<number, Record<string, number>>();
  const bySeason = new Map<number, LeagueMatch[]>();
  for (const m of mine) bySeason.set(m.seasonId, [...(bySeason.get(m.seasonId) ?? []), m]);
  for (const [sid, list] of bySeason) {
    let r = 0, best = 0; const beaten = new Set<number>(), fmts = new Set<string>(); let wins = 0, losses = 0;
    for (const m of list) { if (won(m)) { wins++; r++; best = Math.max(best, r); beaten.add(opp(m)); fmts.add(m.gameType); } else { losses++; r = 0; } }
    const st = standing(sid, me), s = seasonById.get(sid);
    seasons.set(sid, { seasonWins: wins, seasonDistinctBeaten: beaten.size, seasonBestRun: best, seasonFormatsWon: fmts.size,
      seasonTopFive: s && !s.isActive && st && st.position <= 5 ? 1 : 0 });
    const last = list[list.length - 1].playedAt;
    if (s && !s.isActive) {
      if (list.length >= 10 && losses === 0) earn("unbeatenSeason", last);
      if (list.length >= 20 && st && st.points > 0) earn("survivor", last);
      const others = [...(ctx.participants.get(sid) ?? [])].filter(p => p !== me);
      if (others.length >= 4 && others.every(p => beaten.has(p))) earn("cleanSweep", last);
      if (s.startDate && s.endDate) {
        const weeks = new Set<string>(); for (let t = s.startDate.getTime(); t <= s.endDate.getTime(); t += 24 * 3600 * 1000) weeks.add(weekKey(new Date(t)));
        const played = new Set(list.map(m => weekKey(m.playedAt)));
        if (weeks.size >= 2 && [...weeks].every(k => played.has(k))) earn("ironMan", last);
      }
    }
  }

  const seasonRows = ctx.standings.filter(s => s.playerId === me && finished(s.seasonId));
  const metrics: Record<string, number> = {
    wins: mine.filter(won).length,
    matches: mine.length,
    distinctBeaten: winsVs.size,
    bestRun: Math.max(bestRun, ctx.player.longestWinStreak),
    stakePointsWon, stake10Wins,
    peakElo: ctx.player.careerPeakElo,
    seasonsPlayed: bySeason.size,
    eliminations: ctx.player.eliminationsCount,
    formatsWon: formats.size,
    mostBeatenWins: Math.max(0, ...winsVs.values()),
    top3Finishes: seasonRows.filter(s => s.position <= 3).length,
    titles: ctx.seasons.filter(s => !s.isActive && championOf(s.id) === me).length,
    s180, s140plus: s140, s100plus: s100, checkouts, checkoutRate, scorerMatches,
  };
  return { metrics, feats, seasons };
}
