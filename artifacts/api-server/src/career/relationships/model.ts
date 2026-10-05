import { chronological } from "../facts/model.ts";
import type { CareerRelationships, Cohort, Meeting, OpponentRelationship, RelationshipLabel, WorldIdentity } from "./types.ts";

/** Descriptive only. This module is never imported by simulation or sporting writers. */
export const RELATIONSHIP_RULES = Object.freeze({
  familiarMeetings: 3, familiarEvents: 2,
  rivalMeetings: 6, rivalEvents: 3, rivalSeasons: 2, rivalMeaningfulMeetings: 2,
  competitiveMin: 0.25, competitiveMax: 0.75,
  dominanceMeetings: 5, dominanceEvents: 3, dominanceFraction: 0.8,
  contemporaryAgeGap: 3, youngAgeMaximum: 23,
});

export function relationshipModel(saveId: string, players: WorldIdentity[], meetings: Meeting[], cohorts: Cohort[], season: number): CareerRelationships {
  const R = RELATIONSHIP_RULES;
  const byOpponent = new Map<string, Meeting[]>(), byCohort = new Map<string, Cohort[]>();
  for (const m of [...new Map(meetings.map(m => [m.id, m])).values()].sort(chronological)) {
    const list = byOpponent.get(m.opponentId) ?? []; list.push(m); byOpponent.set(m.opponentId, list);
  }
  for (const c of new Map(cohorts.map(c => [`${c.opponentId}:${c.kind}:${c.season}:${c.session}`, c])).values()) {
    const list = byCohort.get(c.opponentId) ?? []; list.push(c); byCohort.set(c.opponentId, list);
  }
  const opponents: OpponentRelationship[] = [];
  for (const player of players) {
    const history = byOpponent.get(player.id) ?? [], shared = (byCohort.get(player.id) ?? []).sort((a,b)=>a.season-b.season || a.session.localeCompare(b.session));
    if (!history.length && !shared.length) continue;
    const wins = history.filter(m=>m.won).length, count = history.length, fraction = count ? wins/count : null;
    const events = new Set(history.map(m=>m.eventId)).size, seasons = new Set(history.map(m=>m.season)).size;
    const meaningful = history.filter(m=>m.final || m.major || m.qualification).length;
    const labels: RelationshipLabel[] = [], evidence: string[] = [];
    if (count >= R.familiarMeetings && events >= R.familiarEvents) { labels.push("Familiar Opponent"); evidence.push(`${count} played meetings across ${events} events.`); }
    if (count >= R.dominanceMeetings && events >= R.dominanceEvents && fraction !== null) {
      if (fraction <= 1-R.dominanceFraction + Number.EPSILON) { labels.push("Nemesis"); evidence.push(`Lost ${count-wins} of ${count} meetings (at least ${R.dominanceFraction*100}%).`); }
      else if (fraction >= R.dominanceFraction) { labels.push("Favourite Opponent"); evidence.push(`Won ${wins} of ${count} meetings (at least ${R.dominanceFraction*100}%).`); }
    }
    const rival = count >= R.rivalMeetings && events >= R.rivalEvents && fraction !== null && fraction >= R.competitiveMin && fraction <= R.competitiveMax &&
      (seasons >= R.rivalSeasons || meaningful >= R.rivalMeaningfulMeetings);
    if (rival) { labels.push("Career Rival"); evidence.push(`${count} meetings; ${wins}–${count-wins} H2H; ${seasons} seasons and ${meaningful} final, major/world or qualification meetings.`); }
    // Compare at a historical meeting, never a retired player's frozen current age.
    const contemporary = shared.length > 0 || history.some(m=>m.humanAge !== null &&
      Math.abs(player.startingAge + m.season - player.createdSeason - m.humanAge) <= R.contemporaryAgeGap);
    if (rival && contemporary) { labels.push("Generation Rival"); evidence.push(shared.length ? "Shared sporting cohort plus a substantial competitive history." : `Within ${R.contemporaryAgeGap} years at a recorded meeting, plus a substantial competitive history.`); }
    for (const kind of ["Q-School Class", "Junior Contemporary"] as const) if (shared.some(c=>c.kind===kind)) labels.push(kind);
    opponents.push({ player, labels, evidence, meetings:count, humanWins:wins, npcWins:count-wins,
      winPercentage:fraction === null ? null : Math.round(fraction*10000)/100, eventCount:events, seasonCount:seasons,
      finals:history.filter(m=>m.final).length, majorMeetings:history.filter(m=>m.major).length,
      qualificationMeetings:history.filter(m=>m.qualification).length,
      firstMeeting:history[0]??null, latestMeeting:history.at(-1)??null, history, cohorts:shared });
  }
  opponents.sort((a,b)=>Number(b.labels.includes("Career Rival"))-Number(a.labels.includes("Career Rival")) || b.meetings-a.meetings || a.player.name.localeCompare(b.player.name) || a.player.id.localeCompare(b.player.id));
  return { careerSaveId:saveId, opponents, world:{players,
    active:players.filter(p=>p.status==="ACTIVE").length, retired:players.filter(p=>p.status==="RETIRED").length,
    newEntrants:players.filter(p=>p.createdSeason===season && season>1).length,
    youngPlayers:players.filter(p=>p.status==="ACTIVE" && p.age<=R.youngAgeMaximum).length, youngAgeMaximum:R.youngAgeMaximum} };
}
