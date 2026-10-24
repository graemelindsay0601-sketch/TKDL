import { useState } from "react";
import { Link } from "wouter";
import { CalendarDays, Trophy, Users } from "lucide-react";
import { errorMessage, useJoinTeamNights, useTeamNights, type TeamNightsView } from "./api";

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const venue = (home: boolean, opponent: string) => home ? `at home to ${opponent}` : `away at ${opponent}`;

/** Club page: team nights. Your nation's clubs, home and away on Wednesdays, six singles a side. */
export function TeamNights({ saveId }: { saveId: string }) {
  const q = useTeamNights(saveId);
  const join = useJoinTeamNights(saveId), [joinError, setJoinError] = useState("");
  if (!q.data) return q.isLoading ? <p className="team-night__note">Loading team nights…</p> : null;
  const d: TeamNightsView = q.data;
  if (!d.available) return <p className="team-night__note">{d.club ? `${d.club} is the only club in its darts nation, so there's no team league to play in.` : "Team nights need a home club."}</p>;
  return (
    <div className="team-night">
      <div className="team-night__format" aria-label="Team league format">
        <div className="team-night__facts">
          <div><CalendarDays aria-hidden /><span><b>Match nights</b><small>Wednesdays · Weeks {d.firstWeek}–{d.lastWeek}</small></span></div>
          <div><Users aria-hidden /><span><b>Six singles</b><small>Home and away · best of 5 legs</small></span></div>
          <div><Trophy aria-hidden /><span><b>Top four reach finals</b><small>Semi-finals, then the final</small></span></div>
        </div>
        <p className="team-night__note">You play when free; a clubmate stands in if an event clashes. League seeding breaks a tied knockout match.</p>
      </div>
      {!d.joined && <div className="team-night__join">
        <p>Join {d.club} for this season. Your singles are live-played when you’re available; a team-mate covers any clash.</p>
        <button type="button" className="club-button club-button-red" disabled={join.isPending} onClick={() => {
          setJoinError(""); join.mutate(undefined, { onError: e => setJoinError(errorMessage(e)) });
        }}>{join.isPending ? "Joining…" : "Join the team"}</button>
        {joinError && <p role="alert" className="team-night__note">{joinError}</p>}
      </div>}
      {d.joined && <div className="team-night__next">
        <b>LOCAL PROFILE · {d.localProfile.reputationTier}</b> {d.localProfile.reputation}/100 reputation · {d.localProfile.appearances} career appearances · {d.localProfile.wins} wins
        <small>Local sponsor consideration: {Math.min(d.localProfile.appearances, 5)}/5 appearances and {Math.min(d.localProfile.wins, 3)}/3 wins.</small>
      </div>}
      {d.liveMatchId && <Link className="club-button club-button-gold" href={`/career/${saveId}/club/team-match/${d.liveMatchId}`}>Resume your live team single</Link>}
      {d.next && <p className="team-night__next" data-free={d.next.youFree ? "true" : "false"}>
        <b>Next: week {d.next.week}</b>, {venue(d.next.home, d.next.opponent)}.{" "}
        {d.next.youFree ? "You're in the team." : `You're booked into ${d.next.clash} that night, so a clubmate will play instead.`}</p>}
      {d.last && <div className="team-night__last">
        <p><b>Week {d.last.week}</b>, {venue(d.last.home, d.last.opponent)}: <strong data-tone={d.last.us > d.last.them ? "up" : d.last.us < d.last.them ? "down" : "flat"}>
          {d.last.us > d.last.them ? "Won" : d.last.us < d.last.them ? "Lost" : "Drew"} {d.last.us}-{d.last.them}</strong>
          {d.last.youUnavailable ? " (you were booked elsewhere)" : ""}</p>
        <ol className="team-night__singles">{d.last.singles.map((s, i) => <li key={i} data-you={s.you ? "true" : undefined}>
          <span>{s.us}</span><b>{s.usLegs}-{s.themLegs}</b><span>{s.them}</span></li>)}</ol>
      </div>}
      <ol className="career-club__table team-night__table">{d.table.map(t => <li key={t.club} className={t.you ? "is-you" : undefined}>
        <b>{t.position}</b><span>{t.name}</span><em>{t.points}</em>
        <small>P{t.played} W{t.won} D{t.drawn} L{t.lost} · singles {t.singlesFor}-{t.singlesAgainst}</small></li>)}</ol>
      <p className="team-night__note">Your singles this season: won {d.you.won} of {d.you.played}.</p>
    </div>
  );
}

/** Home: this week's or next week's team night, and whether you're playing. */
export function TeamNightLine({ saveId, week }: { saveId: string; week: number }) {
  const q = useTeamNights(saveId);
  const n = q.data?.available ? q.data.next : null;
  if (!n || n.week > week + 1) return null;
  return <Link href={`/career/${saveId}/club#team-nights`} className="team-night-line" data-free={n.youFree ? "true" : "false"}>
    <Users aria-hidden /><span><b>{n.week === week ? "Wednesday" : "Next Wednesday"}:</b> club night {venue(n.home, n.opponent)}.{" "}
      {n.youFree ? "You're in the team." : `You're booked into ${n.clash}, so a clubmate plays.`}</span>
  </Link>;
}
