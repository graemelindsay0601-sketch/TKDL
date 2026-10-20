import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { markSeen } from "../unlocks";
import { Loader2, MonitorPlay, Trophy, Video } from "lucide-react";
import { GameScorer } from "@/components/game-scorer";
import type { Dart } from "@/lib/darts-rules";
import { camLeagueApi, careerKey, errorMessage, useBookCamMatch, useCamLeague, useCamMatch, useJoinCamLeague, useSimulateCamMatch } from "../api";
import { CareerError, CareerLoading, CareerSection } from "../components";
import { CareerPageHero } from "../page-hero";
import { careerBotVisit, careerGameType, recoveryFromLog, scorerLength, shouldCheckpoint } from "../live-model";
import { dayLabel, formatPence } from "../model";
import type { ShellContext } from "../shell";
import type { LiveSession } from "../types";

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/**
 * Webcam leagues: eight players from around the world in a division at your level, one match a week for seven weeks,
 * played on camera from your own board on a night you book. The top two go up, the bottom two go down.
 */
export function CamLeaguePage({ ctx }: { ctx: ShellContext }) {
  const id = ctx.save.id, search = useSearch(), params = new URLSearchParams(search), weekParam = params.get("week");
  const requestedWeek = weekParam === null ? undefined : Number(weekParam) || undefined;
  const q = useCamLeague(id, requestedWeek), join = useJoinCamLeague(id), book = useBookCamMatch(id), sim = useSimulateCamMatch(id);
  useEffect(() => { markSeen(id, "cam-league"); }, [id]);
  const requestedDayValue = params.get("day");
  const requestedDay = requestedDayValue === null ? null : Number(requestedDayValue);
  const [night, setNight] = useState<number | null>(requestedDay !== null && requestedDay >= 1 && requestedDay <= 7 ? requestedDay : null), [message, setMessage] = useState("");
  const [, navigate] = useLocation();
  if (q.isLoading) return <CareerLoading />;
  if (q.error || !q.data) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data, l = d.league, f = l?.thisWeek ?? null, retired = !!ctx.save.retiredAt, futureWeek = d.week > d.currentWeek;
  const fail = (e: unknown) => setMessage(errorMessage(e));
  const pick = night !== null && d.freeNights.includes(night) ? night : d.freeNights[0] ?? null;
  const me = l?.table.findIndex(r => r.you) ?? -1;
  return <div className="space-y-3 cam-league">
    <CareerPageHero kicker="Webcam league · played from your own board" title={l ? l.name : d.division.name} accent="#5bc0eb" stage={{ venue: { venueType: "social-club" }, eventClass: "GRASSROOTS" }}
      subtitle={<p>Eight players from around the world, a match a week for seven weeks, first to three legs. Two points a win; the top two go up, the bottom two go down.</p>}
      stats={l ? [{ label: "Position", value: ordinal(me + 1), tone: "gold" }, { label: "Round", value: `${l.round} of 7` }, { label: "Points", value: l.table[me].points },
        { label: "Weeks", value: `${l.weekStart}–${l.weekEnd}` }] : [{ label: "Division", value: d.division.name, tone: "gold" }, { label: "Entry", value: formatPence(d.division.feePence) }]} />
    {message && <p className="money-match__message" role="alert">{message}</p>}
    {l ? <>
      <CareerSection title={futureWeek ? "Next week's match" : "This week's match"} icon={<Video aria-hidden />} accent="#5bc0eb">
        <div className="cam-league__match">{!f ? <p className="money-match__note">No match this week.</p> : <>
          <p><b>{f.opponent.name}</b> <small>({f.opponent.country}) · averages about {f.opponent.avg}</small></p>
          {f.status === "SCHEDULED" ? retired ? <p className="money-match__note">Your career is over.</p> : d.freeNights.length ? <>
            <p className="money-match__note">Book a night to play it. A match you don't play by the end of the week is forfeited 3-0.</p>
            <div className="road-trip__nights" role="radiogroup" aria-label="Night">{d.freeNights.map(n => <button key={n} type="button" role="radio" aria-checked={pick === n}
              className={`career-btn ${pick === n ? "career-btn-primary" : "career-btn-ghost"}`} onClick={() => setNight(n)}>{dayLabel(n)}</button>)}</div>
            <button type="button" className="career-btn career-btn-gold" disabled={book.isPending || pick === null}
              onClick={() => book.mutate({ fixtureId: f.id, dayOfWeek: pick!, week: d.week }, { onError: fail })}>Book it for {pick ? dayLabel(pick) : "a night"}</button>
          </> : <p className="money-match__note">No free nights left this week: this one will be forfeited.</p>
          : f.status === "BOOKED" && futureWeek ? <p className="money-match__note">Booked for {dayLabel(f.dayOfWeek!)} in week {d.week}. Playing opens when that week begins.</p>
          : f.status === "BOOKED" ? <>
            <p className="money-match__note">Booked for {dayLabel(f.dayOfWeek!)}. Throw it on the scorer, or let it play out at your level.</p>
            <div className="money-match__actions">
              <button type="button" className="career-btn career-btn-gold" onClick={() => navigate(`/career/${id}/cam-league/${f.id}`)}><MonitorPlay aria-hidden /> Play on camera</button>
              <button type="button" className="career-btn career-btn-ghost" disabled={sim.isPending} onClick={() => sim.mutate(f.id, { onError: fail })}>
                {sim.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null} Quick-sim it</button>
            </div></>
          : <p className="money-match__outcome" data-tone={f.legs && f.legs[0] > f.legs[1] ? "up" : "down"}>{f.status === "FORFEIT" ? "Forfeited" : f.legs![0] > f.legs![1] ? "Won" : "Lost"} {f.legs![0]}-{f.legs![1]}
            {f.source === "SIM" ? <small> · quick-sim</small> : null}</p>}
        </>}</div>
      </CareerSection>
      <CareerSection title="Table" icon={<Trophy aria-hidden />} accent="#5bc0eb">
        <table className="cam-league__table"><thead><tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>L</th><th>Legs</th><th>Pts</th></tr></thead>
          <tbody>{l.table.map((r, i) => <tr key={r.key} className={r.you ? "is-you" : undefined} data-zone={i < 2 && l.level > 1 ? "up" : i >= l.table.length - 2 && l.level < 5 ? "down" : undefined}>
            <td>{i + 1}</td><td>{r.you ? <b>You</b> : r.name}{r.country ? <small> {r.country}</small> : null}</td><td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.legsFor}-{r.legsAgainst}</td><td><b>{r.points}</b></td></tr>)}</tbody></table>
        <p className="px-4 pb-3 text-xs text-white/60">Prize money: {l.prizes.map(p => formatPence(p)).join(" / ")} for the top three.</p>
      </CareerSection>
      <CareerSection title="Your fixtures" icon={<Video aria-hidden />} accent="#5bc0eb">
        <ol className="cam-league__fixtures">{l.fixtures.map(x => <li key={x.id}><span>Wk {x.week} · {x.opponent.name} <small>({x.opponent.country})</small></span>
          <em>{x.legs ? `${x.status === "FORFEIT" ? "Forfeit " : ""}${x.legs[0]}-${x.legs[1]}` : x.status === "BOOKED" ? `Booked ${dayLabel(x.dayOfWeek!)}` : ""}</em></li>)}</ol>
      </CareerSection>
    </> : <CareerSection title="Join a league" icon={<Video aria-hidden />} accent="#5bc0eb">
      <div className="cam-league__match">
        <p>Your division: <b>{d.division.name}</b>. Entry {formatPence(d.join.feePence)}; prize money {d.join.prizes.map(p => formatPence(p)).join(" / ")} for the top three.
          {" "}Runs weeks {d.join.startsWeek}–{d.join.endsWeek}.</p>
        {d.join.ok && !retired ? <button type="button" className="career-btn career-btn-gold" disabled={join.isPending} onClick={() => join.mutate(undefined, { onError: fail })}>
          {join.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null} Join for {formatPence(d.join.feePence)}</button>
          : <p className="money-match__note">{retired ? "Your career is over." : d.join.why}</p>}
      </div>
    </CareerSection>}
    {d.history.length > 0 && <CareerSection title="Past leagues" icon={<Trophy aria-hidden />} accent="#5bc0eb">
      <ol className="cam-league__fixtures">{d.history.map((h, i) => <li key={i}><span>S{h.season} · {h.name}</span>
        <em>{ordinal(h.position)}{h.prizePence ? ` · ${formatPence(h.prizePence)}` : ""}{h.nextLevel < h.level ? " · promoted" : h.nextLevel > h.level ? " · relegated" : ""}</em></li>)}</ol>
    </CareerSection>}
  </div>;
}

/** A league match on the scorer: the darts go to the server after every visit; the result goes in the table when it's over. */
export function CamMatchPage({ ctx, fixtureId }: { ctx: ShellContext; fixtureId: string }) {
  const id = ctx.save.id, q = useCamMatch(id, fixtureId), client = useQueryClient();
  const [session, setSession] = useState<import("../api").CamMatchSession | null>(null), [message, setMessage] = useState("");
  const log = useRef<Dart[]>([]), queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => { if (q.data && !session) { setSession(q.data); log.current = q.data.darts as Dart[]; } }, [q.data, session]);
  const send = useCallback((darts: Dart[]) => {
    queue.current = queue.current.then(async () => {
      try { const s = await camLeagueApi.darts(id, fixtureId, darts); setSession(s); if (s.status === "PLAYED") await client.invalidateQueries({ queryKey: careerKey(id) }); }
      catch (e) { setMessage(errorMessage(e)); }
    });
  }, [id, fixtureId, client]);
  const live = useMemo(() => session ? { bot: session.opponent.bot, format: session.format } as unknown as LiveSession : null, [session]);
  const onDartLog = useCallback((darts: Dart[]) => { log.current = darts; if (session?.status === "LIVE" && shouldCheckpoint(session.format, session.firstThrower, darts)) send(darts); }, [session, send]);
  const planner = useCallback((c: { remaining: number; opened: boolean }) => careerBotVisit(live!, session!.firstThrower, log.current, c), [live, session]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recovery = useMemo(() => session && (session.darts as Dart[]).length ? recoveryFromLog(session.format, session.firstThrower, session.darts as Dart[]) : null, [session?.fixtureId]);
  if (q.isLoading || (!session && !q.error)) return <CareerLoading />;
  if (q.error || !session) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  const back = <Link className="career-btn career-btn-ghost" href={`/career/${id}/cam-league`}>Back to the league</Link>;
  if (session.status === "PLAYED") return <div className="cam-league__done space-y-3">
    <h2>{session.won ? `You beat ${session.opponent.name}` : `${session.opponent.name} beat you`} {session.legs![0]}-{session.legs![1]}</h2>{back}</div>;
  return <div className="cam-league__live">
    <p className="cam-league__live-title"><Video aria-hidden /> <b>{session.you}</b> vs <b>{session.opponent.name}</b> <small>({session.opponent.country}) · on camera · first to 3</small></p>
    {message && <p className="money-match__message" role="alert">{message}</p>}
    <GameScorer key={session.fixtureId} p1Name={session.you} p2Name={session.opponent.name} gameType={careerGameType(session.format as LiveSession["format"])}
      botConfig={session.opponent.bot.config} firstThrower={session.firstThrower} {...scorerLength(session.format as LiveSession["format"])}
      initialRecovery={recovery} onRecoveryState={() => { /* the server keeps the dart log */ }} botVisitPlanner={planner} onDartLog={onDartLog}
      onWin={() => send(log.current)} onAbandon={() => history.back()} />
    {back}
  </div>;
}
