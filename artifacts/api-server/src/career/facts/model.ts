import { replay } from "../../shared/darts-rules/x01.ts";
import type { DartEvidence, MatchEvidence, EventFact, Performance } from "./types.ts";

export const chronological = (a: { season: number; day: number | null; id: string }, b: { season: number; day: number | null; id: string }) => a.season - b.season || (a.day ?? 365) - (b.day ?? 365) || a.id.localeCompare(b.id);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function sportingStatistics(matches: MatchEvidence[], results: EventFact[], currentSeason: number) {
  const ordered = [...new Map(matches.map(m => [m.id, m])).values()].sort((a,b) => a.season-b.season || a.day-b.day || a.eventId.localeCompare(b.eventId) || a.round-b.round || a.slot-b.slot || a.id.localeCompare(b.id));
  const events = [...new Map(results.map(r => [r.eventId, r])).values()].sort(chronological);
  let current = 0, longest = 0;
  for (const match of ordered) { current = match.won ? current + 1 : 0; longest = Math.max(longest, current); }
  // Different events on the same day lack reliable relative ordering. Never
  // use wall-clock submission time or a random UUID to invent a streak.
  const ambiguous = ordered.some((m,i) => i > 0 && ordered[i-1].season === m.season && ordered[i-1].day === m.day && ordered[i-1].eventId !== m.eventId);
  const wins = ordered.filter(m => m.won).length;
  return { matchesPlayed: ordered.length, wins, losses: ordered.length-wins, winPercentage: ordered.length ? round2(100*wins/ordered.length) : null,
    eventsEntered: events.length, titles: events.filter(r=>r.champion).length, runnersUp: events.filter(r=>r.position===2).length,
    semiFinals: events.filter(r=>r.stageReached==='SEMI_FINAL').length, quarterFinals: events.filter(r=>r.stageReached==='QUARTER_FINAL').length,
    bestFinish: [...events].sort((a,b)=>a.position-b.position || chronological(a,b))[0] ?? null,
    currentWinningStreak: ambiguous ? null : current, longestWinningStreak: ambiguous ? null : longest,
    currentSeason, seasonsPlayed: new Set([...ordered, ...events].map(r=>r.season)).size };
}

export function performanceStatistics(evidence: DartEvidence[], sportingMatchCount: number): Performance {
  const measured: { matchId: string; darts: number; points: number; maximums: number; visits140Plus: number; visits100Plus: number; highestVisit: number; checkouts: number; highestCheckout: number }[] = [];
  for (const item of new Map(evidence.map(e=>[e.matchId,e])).values()) {
    try {
      const state = replay(item.format, item.firstThrower, item.darts);
      if (!state.complete) continue;
      const visits = state.visits.filter(v=>v.thrower===0);
      const darts = visits.reduce((n,v)=>n+v.darts.length,0);
      if (!darts) continue;
      measured.push({ matchId:item.matchId, darts, points:visits.reduce((n,v)=>n+v.points,0), maximums:visits.filter(v=>v.points===180).length,
        visits140Plus:visits.filter(v=>v.points>=140).length, visits100Plus:visits.filter(v=>v.points>=100).length,
        highestVisit:Math.max(0,...visits.map(v=>v.points)), checkouts:visits.filter(v=>v.checkout).length,
        highestCheckout:Math.max(0,...visits.filter(v=>v.checkout).map(v=>v.startScore)) });
    } catch { /* Legacy/incompatible evidence is unavailable, never simulated. */ }
  }
  const total = (key: 'darts'|'points'|'maximums'|'visits140Plus'|'visits100Plus'|'checkouts') => measured.reduce((n,m)=>n+m[key],0);
  const best = [...measured].sort((a,b)=>b.points/b.darts-a.points/a.darts)[0];
  const maximum = [...measured].sort((a,b)=>b.maximums-a.maximums)[0];
  return { recordedMatches:measured.length, unavailableMatches:Math.max(0,sportingMatchCount-measured.length), darts: measured.length ? total('darts') : null,
    threeDartAverage:measured.length ? round2(total('points')*3/total('darts')) : null,
    highestCheckout:measured.length ? Math.max(...measured.map(m=>m.highestCheckout)) : null, checkoutsCompleted:measured.length ? total('checkouts') : null,
    checkoutAttempts:null, checkoutPercentage:null, maximums:measured.length ? total('maximums') : null,
    visits140Plus:measured.length ? total('visits140Plus') : null, visits100Plus:measured.length ? total('visits100Plus') : null,
    highestVisit:measured.length ? Math.max(...measured.map(m=>m.highestVisit)) : null,
    bestMatchAverage:best ? {matchId:best.matchId,value:round2(best.points*3/best.darts)} : null,
    most180sMatch:maximum ? {matchId:maximum.matchId,value:maximum.maximums} : null };
}
