import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MonitorPlay, Star } from "lucide-react";
import { GameScorer } from "@/components/game-scorer";
import type { Dart } from "@/lib/darts-rules";
import { careerKey, errorMessage, proAmApi, useBookProAm, useProAm, useProAmLeg, useSimulateProAm, type ProAmSession } from "./api";
import { CareerError, CareerLoading } from "./components";
import { careerBotVisit, careerGameType, recoveryFromLog, scorerLength, shouldCheckpoint } from "./live-model";
import { dayLabel, formatPence } from "./model";
import type { ShellContext } from "./shell";
import type { LiveSession } from "./types";

/**
 * Club page: Pro-Am nights. As an amateur, pay for one leg against a touring pro (you throw first) and win a prize if you
 * beat them. With a Tour Card you're the pro: paid to take on a dozen amateurs.
 */
export function ProAmNights({ saveId, retired }: { saveId: string; retired: boolean }) {
  const q = useProAm(saveId), book = useBookProAm(saveId), sim = useSimulateProAm(saveId), [, navigate] = useLocation();
  const [message, setMessage] = useState("");
  if (!q.data) return q.isLoading ? <p className="money-match__note">Loading Pro-Am nights…</p> : null;
  const d = q.data, b = d.booking, amateur = d.side === "AMATEUR", fail = (e: unknown) => setMessage(errorMessage(e));
  return <div className="money-match pro-am">
    <p className="money-match__intro">{amateur
      ? <>A touring pro takes on the locals, one leg each, and you throw first. Pay for a slot; beat the pro and the organiser pays you a prize.</>
      : <>You hold a Tour Card, so you're the pro now: paid an appearance fee to take on a dozen amateurs. Anyone who beats you collects from the organiser, not from you.</>}</p>
    {message && <p className="money-match__message" role="alert">{message}</p>}
    {b ? <div className="money-match__challenge">
      <p><Star aria-hidden /> {b.role === "AMATEUR" ? <>Your slot against <b>{b.pro!.name}</b></> : <>You're the pro</>} in {b.town} on {dayLabel(b.dayOfWeek)}.</p>
      {b.status === "BOOKED" ? b.role === "AMATEUR" ? <div className="money-match__actions">
          <button type="button" className="career-btn career-btn-gold" onClick={() => navigate(`/career/${saveId}/pro-am/${b.id}`)}><MonitorPlay aria-hidden /> Throw your leg</button>
          <button type="button" className="career-btn career-btn-ghost" disabled={sim.isPending} onClick={() => sim.mutate(b.id, { onError: fail })}>Quick-sim it</button></div>
        : <div className="money-match__actions"><button type="button" className="career-btn career-btn-gold" disabled={sim.isPending} onClick={() => sim.mutate(b.id, { onError: fail })}>
          {sim.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null} Play the night</button></div>
      : b.status === "MISSED" ? <p className="money-match__note">You missed your slot.</p>
      : b.role === "AMATEUR" ? <p className="money-match__outcome" data-tone={b.result?.won ? "up" : "down"}>{b.result?.won ? <>You beat {b.pro!.name}! Prize <b>{formatPence(b.prizePence)}</b></> : <>{b.pro!.name} took the leg.</>}</p>
      : <><p className="money-match__outcome" data-tone="up">Paid <b>{formatPence(b.appearancePence)}</b> · {b.result!.legs!.length - b.result!.beatenBy!} of {b.result!.legs!.length} amateurs beaten</p>
        <ul className="pro-am__legs">{b.result!.legs!.map((l, i) => <li key={i} data-won={l.youWon || undefined}>{l.name}: {l.youWon ? "you won" : "beat you"}</li>)}</ul></>}
    </div> : retired ? <p className="money-match__note">Your career is over.</p> : d.nights.length ? <ul className="money-match__members">{d.nights.map(n => <li key={n.key}>
      <div className="money-match__who"><b>{n.town} · {dayLabel(n.dayOfWeek)}</b>
        <small>{amateur ? <>{n.pro!.name}{n.pro!.rank ? ` (world no. ${n.pro!.rank})` : ""} · averages about {n.pro!.avg} · slot {formatPence(n.feePence)} · prize {formatPence(n.prizePence)}</>
          : <>Appearance fee {formatPence(n.appearancePence)}</>}{n.travelPence ? ` · travel ${formatPence(n.travelPence)}` : ""}</small></div>
      {n.free ? <button type="button" className="career-btn career-btn-gold" disabled={book.isPending || n.feePence + n.travelPence > d.availablePence}
        onClick={() => book.mutate(n.key, { onError: fail })}>{amateur ? `Take a slot (${formatPence(n.feePence + n.travelPence)})` : "Accept"}</button>
        : <span className="money-match__outcome"><small>You're booked that night</small></span>}
    </li>)}</ul> : <p className="money-match__note">No Pro-Am nights near you this week.</p>}
    <p className="money-match__record">{amateur || !d.record.nightsAsPro
      ? (d.record.slots ? <>Pros beaten: {d.record.prosBeaten} of {d.record.slots} · prizes <b>{formatPence(d.record.prizePence)}</b></> : "No Pro-Am legs yet.")
      : <>Nights as the pro: {d.record.nightsAsPro} · paid <b>{formatPence(d.record.appearancePence)}</b> · amateurs who beat you: {d.record.amateursBeatYou}</>}</p>
  </div>;
}

/** Your leg against the pro on the scorer (you throw first); the server replays the darts. */
export function ProAmLegPage({ ctx, nightId }: { ctx: ShellContext; nightId: string }) {
  const id = ctx.save.id, q = useProAmLeg(id, nightId), client = useQueryClient();
  const [session, setSession] = useState<ProAmSession | null>(null), [message, setMessage] = useState("");
  const log = useRef<Dart[]>([]), queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => { if (q.data && !session) { setSession(q.data); log.current = q.data.darts as Dart[]; } }, [q.data, session]);
  const send = useCallback((darts: Dart[]) => {
    queue.current = queue.current.then(async () => {
      try { const s = await proAmApi.darts(id, nightId, darts); setSession(s); if (s.status === "PLAYED") await client.invalidateQueries({ queryKey: careerKey(id) }); }
      catch (e) { setMessage(errorMessage(e)); }
    });
  }, [id, nightId, client]);
  const live = useMemo(() => session ? { bot: session.pro.bot, format: session.format } as unknown as LiveSession : null, [session]);
  const onDartLog = useCallback((darts: Dart[]) => { log.current = darts; if (session?.status === "LIVE" && shouldCheckpoint(session.format, session.firstThrower, darts)) send(darts); }, [session, send]);
  const planner = useCallback((c: { remaining: number; opened: boolean }) => careerBotVisit(live!, session!.firstThrower, log.current, c), [live, session]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recovery = useMemo(() => session && (session.darts as Dart[]).length ? recoveryFromLog(session.format, session.firstThrower, session.darts as Dart[]) : null, [session?.id]);
  if (q.isLoading || (!session && !q.error)) return <CareerLoading />;
  if (q.error || !session) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  const back = <Link className="career-btn career-btn-ghost" href={`/career/${id}/pro-am`}>Back to Pro-Am nights</Link>;
  if (session.status === "PLAYED") return <div className="cam-league__done space-y-3"><h2>{session.won ? `You beat ${session.pro.name}!` : `${session.pro.name} took the leg`}</h2>{back}</div>;
  return <div className="cam-league__live">
    <p className="cam-league__live-title"><Star aria-hidden /> <b>{session.you}</b> vs <b>{session.pro.name}</b> <small>Pro-Am · one leg · you throw first</small></p>
    {message && <p className="money-match__message" role="alert">{message}</p>}
    <GameScorer key={session.id} p1Name={session.you} p2Name={session.pro.name} gameType={careerGameType(session.format as LiveSession["format"])}
      botConfig={session.pro.bot.config} firstThrower={session.firstThrower} {...scorerLength(session.format as LiveSession["format"])}
      initialRecovery={recovery} onRecoveryState={() => { /* the server keeps the dart log */ }} botVisitPlanner={planner} onDartLog={onDartLog}
      onWin={() => send(log.current)} onAbandon={() => history.back()} />
    {back}
  </div>;
}
