import { useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import { useCalendar, useEnterEvent, useHistory, useActiveTournament, useCareerLegacySummary, useSporting, errorMessage } from "../api";
import { denialLabel, ordinal } from "../model";
import { CareerError, CareerEventCard, CareerLoading } from "../components";
import { NextMove } from "./next-move";
import type { ShellContext } from "../shell";

/**
 * Play: the focused front end for getting stuck in. Only what moves the Career on — your next
 * move, what you're booked into, your last result. Everything else lives behind the Menu
 * (Career HQ, calendar, world, records), so nothing hits you at once.
 */
export function PlayPage({ ctx }: { ctx: ShellContext }) {
  const { save, overview } = ctx;
  const id = save.id;
  const calendar = useCalendar(id, { scope: "WORLD", fromWeek: save.currentWeek, toWeek: Math.min(52, save.currentWeek + 6) });
  const tournaments = useActiveTournament(id);
  const legacy = useCareerLegacySummary(id);
  const history = useHistory(id, { participant: "HUMAN" });
  const sporting = useSporting(id);
  const enter = useEnterEvent(id);
  const [message, setMessage] = useState("");
  const onEnter = (eventId: string) => enter.mutate(eventId, {
    onSuccess: r => setMessage(r.entered ? "Entered. Play on when you're ready." : r.denials.map(denialLabel).join(" · ")),
    onError: e => setMessage(errorMessage(e)),
  });

  const events = calendar.data?.events ?? [];
  const booked = events.filter(e => e.human && ["ENTERED", "CONFIRMED", "PLAYING"].includes(e.human.relationship)).slice(0, 3);
  const last = history.data?.[0];
  const rank = sporting.data?.worldRanking.standing?.position;

  if (calendar.isLoading || tournaments.isLoading || legacy.isLoading) return <CareerLoading label="Getting your next move" />;
  if (calendar.error) return <CareerError error={calendar.error} onRetry={() => void calendar.refetch()} />;
  return (
    <div className="career-play">
      <NextMove save={save} overview={overview} events={events} activeTournament={tournaments.data?.tournaments.find(t => !t.terminal)}
        pendingReview={!!legacy.data?.pendingReview} onEnter={onEnter} entering={enter.isPending} message={message} />

      {booked.length > 0 && <section className="career-play__card" aria-label="Booked events">
        <h3><span className="live-indicator" aria-hidden /> Booked</h3>
        <div className="career-play__booked">{booked.map(e => <CareerEventCard key={e.id} event={e} saveId={id} compact />)}</div>
      </section>}

      <section className="career-play__card career-play__facts" aria-label="Where you stand">
        <div><span>World rank</span><strong>{rank ? ordinal(rank) : "Unranked"}</strong></div>
        <div><span>Tour Card</span><strong>{sporting.data?.tourCard.holdsCard ? "Held" : "None"}</strong></div>
        <div><span>Last result</span><strong>{last ? (last.champion ? `Won ${last.name}` : `${last.stageReached.replaceAll("_", " ").toLowerCase()} · ${last.name}`) : "None yet"}</strong></div>
      </section>

      <Link href={`/career/${id}`} className="career-play__hq">Career HQ: goals, route, schedule and records <ArrowUpRight aria-hidden /></Link>
    </div>
  );
}
