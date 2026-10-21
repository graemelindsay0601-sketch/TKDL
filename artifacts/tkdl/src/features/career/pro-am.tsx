import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Loader2, MapPin, MonitorPlay, Radio, Star, Trophy } from "lucide-react";
import { GameScorer } from "@/components/game-scorer";
import type { Dart } from "@/lib/darts-rules";
import { careerKey, errorMessage, proAmApi, useBookProAm, useProAm, useProAmLeg, useSimulateProAm, type ProAmSession } from "./api";
import { CareerError, CareerLoading } from "./components";
import { careerBotVisit, careerGameType, recoveryFromLog, scorerLength, shouldCheckpoint } from "./live-model";
import { dayLabel, formatPence } from "./model";
import type { ShellContext } from "./shell";
import type { LiveSession } from "./types";
import "./pro-am.css";

/**
 * Club page: Pro-Am nights. As an amateur, pay for one leg against a touring pro (you throw first) and win a prize if you
 * beat them. With a Tour Card you're the pro: paid to take on a dozen amateurs.
 */
export function ProAmNights({ saveId, retired }: { saveId: string; retired: boolean }) {
  const search = useSearch(), params = new URLSearchParams(search), weekParam = params.get("week"), dayParam = params.get("day");
  const requestedWeek = weekParam === null ? undefined : Number(weekParam) || undefined;
  const requestedDay = dayParam === null ? null : Number(dayParam);
  const q = useProAm(saveId, requestedWeek), book = useBookProAm(saveId), sim = useSimulateProAm(saveId), [, navigate] = useLocation();
  const [message, setMessage] = useState("");
  if (!q.data) return q.isLoading ? <CareerLoading /> : <CareerError error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data, b = d.booking, amateur = d.side === "AMATEUR", fail = (e: unknown) => setMessage(errorMessage(e));
  return <div className="money-match pro-am pro-am-show">
    <header className="pa-masthead">
      <div className="pa-hero-ornament" aria-hidden="true"><svg viewBox="0 0 300 300" fill="none">
        <circle cx="150" cy="150" r="139" /><circle cx="150" cy="150" r="105" /><circle cx="150" cy="150" r="71" />
        <circle cx="150" cy="150" r="38" /><circle cx="150" cy="150" r="9" />
        <path d="M150 11v278M11 150h278M52 52l196 196M248 52 52 248M102 20l96 260M280 102 20 198M198 20 102 280M20 102l260 96" />
      </svg><span className="pa-hero-dart" aria-hidden="true">01</span></div>
      <div className="pa-masthead-copy">
        <p className="pa-kicker"><i /> Nights out <span>/</span> Exhibition circuit</p>
        <h2>Pro-Am<br /><em>Nights</em></h2>
        <div className="pa-hero-rule"><span>WEEK {String(d.week).padStart(2, "0")}</span><b />
          <span>{amateur ? "ONE LEG · YOU THROW FIRST" : "TOUR CARD · EXHIBITION NIGHT"}</span></div>
      </div>
      <div className="pa-event-stamp" aria-label="Professional amateur exhibition">
        <span className="pa-stamp-top">CLUB</span><Star size={20} fill="currentColor" /><span>PRO</span><span>AM</span><small>EXHIBITION</small>
      </div>
    </header>
    <section className="pa-scoreboard" aria-label="Exhibition circuit overview">
      <div className="pa-scoreboard-main">
        <span className="pa-live-mark" aria-hidden="true"><Radio size={17} /></span>
        <div className="pa-scoreboard-title"><small>Exhibition circuit · Week {String(d.week).padStart(2, "0")}</small>
          <strong>{amateur ? "A shot at the touring pros" : "Your night on the exhibition floor"}</strong></div>
      </div>
      <div className="pa-facts">
        <div className="pa-fact"><small>{amateur ? "Available" : "Appearance"}</small><strong>{amateur ? formatPence(d.availablePence) : formatPence(d.record.appearancePence)}</strong></div>
        <div className="pa-fact"><small>Your role</small><strong>{amateur ? "Challenger" : "Touring pro"}</strong></div>
        <div className="pa-fact"><small>Stops this week</small><strong>{b ? "1 booked" : d.nights.length}</strong></div>
      </div>
    </section>
    <div className="pa-standfirst">
      <span className="pa-standfirst-mark"><Star size={16} fill="currentColor" /></span>
      <strong>{amateur ? "YOU THROW FIRST" : "YOU'RE THE PRO"}</strong>
      <span>{amateur
        ? <>As the amateur, you throw first. Beat the touring pro; the organiser pays the prize.</>
        : "Turn up for your appearance fee. The organiser pays any prize."}</span>
      <span className="pa-role-chip">{amateur ? <>CHALLENGER <b>VS</b> TOURING PRO</> : "TOURING PRO · TOUR CARD"}</span>
    </div>
    {message && <p className="money-match__message" role="alert">{message}</p>}
    {b ? <section className="pa-booking" aria-live="polite">
      <div className="pa-booking-copy">
        <span className="pa-booking-tag"><Check size={14} /> Slot confirmed · {dayLabel(b.dayOfWeek)}</span>
        <h3>{b.town}<span> / </span>{b.role === "AMATEUR" ? b.pro!.name : "Your exhibition night"}</h3>
        <p>{b.role === "AMATEUR" ? <>One leg · Fee {formatPence(b.feePence)} · Prize {formatPence(b.prizePence)}</>
          : <>Appearance {formatPence(b.appearancePence)}</>}</p>
      </div>
      {b.status === "BOOKED" ? b.role === "AMATEUR" ? <div className="pa-booking-actions">
        <button type="button" className="pa-action-button" onClick={() => navigate(`/career/${saveId}/pro-am/${b.id}`)}><MonitorPlay aria-hidden /> Throw your leg</button>
        <button type="button" className="pa-action-button is-quiet" disabled={sim.isPending} onClick={() => sim.mutate(b.id, { onError: fail })}>Quick-sim it</button>
      </div> : <div className="pa-booking-actions"><button type="button" className="pa-action-button" disabled={sim.isPending} onClick={() => sim.mutate(b.id, { onError: fail })}>
        {sim.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null} Play the night</button></div>
      : b.status === "MISSED" ? <p className="money-match__note">You missed your slot.</p>
      : b.role === "AMATEUR" ? <p className="money-match__outcome" data-tone={b.result?.won ? "up" : "down"}>{b.result?.won
        ? <>You beat {b.pro!.name}! Prize <b>{formatPence(b.prizePence)}</b></> : <>{b.pro!.name} took the leg.</>}</p>
      : <div className="pa-booking-result"><p className="money-match__outcome" data-tone="up">Paid <b>{formatPence(b.appearancePence)}</b> · {b.result!.legs!.length - b.result!.beatenBy!} of {b.result!.legs!.length} amateurs beaten</p>
        <ul className="pro-am__legs">{b.result!.legs!.map((l, i) => <li key={i} data-won={l.youWon || undefined}>{l.name}: {l.youWon ? "you won" : "beat you"}</li>)}</ul></div>}
    </section> : retired ? <p className="money-match__note">Your career is over.</p> : d.nights.length ? <section className="pa-section">
      <div className="pa-section-heading"><h2><CalendarDays size={16} /> The exhibition card</h2><span>Choose your opponent</span></div>
      <div className="pa-stops"><ul className="pa-stop-grid">{d.nights.map((n, index) => <li key={n.key} className={`pa-stop${index === 0 ? " is-featured" : ""}`}>
        <span className="pa-card-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <div className="pa-stop-top"><span className="pa-place"><MapPin size={14} /> {n.town}</span><span className="pa-day">{dayLabel(n.dayOfWeek)}</span></div>
        {amateur ? <div className="pa-player-plaque">
          <span className="pa-player-mark" aria-hidden="true"><Star size={18} /></span>
          <div className="pa-player-info"><p className="pa-opponent-label">TOURING PRO{n.pro!.rank ? <> · WORLD RANK <b>#{n.pro!.rank}</b></> : null}</p>
            <h3>{n.pro!.name}</h3><div className="pa-average"><small>OPPONENT AVG</small><strong>{n.pro!.avg}</strong></div></div>
        </div> : <div className="pa-pro-plaque"><span className="pa-opponent-label">TOUR CARD · EXHIBITION</span><strong>Take the stage</strong><small>Appear for the locals</small></div>}
        <div className={`pa-price-grid${amateur ? "" : " pa-price-grid-pro"}`}>
          {amateur ? <>
            <div><small>Slot fee</small><strong>{formatPence(n.feePence)}</strong></div>
            {n.travelPence ? <div><small>Travel</small><strong>{formatPence(n.travelPence)}</strong></div> : null}
            <div><small>Prize</small><strong>{formatPence(n.prizePence)}</strong></div>
          </> : <>
            <div><small>Appearance</small><strong>{formatPence(n.appearancePence)}</strong></div>
            {n.travelPence ? <div><small>Travel</small><strong>{formatPence(n.travelPence)}</strong></div> : null}
          </>}
        </div>
        {n.free ? <button type="button" className="pa-book-button" aria-pressed={requestedDay === n.dayOfWeek}
          disabled={book.isPending || (amateur && n.feePence + n.travelPence > d.availablePence)}
          onClick={() => book.mutate({ nightKey: n.key, week: d.week }, { onError: fail })}>
          {requestedDay === n.dayOfWeek ? <><Check size={15} /> Selected</> : amateur ? `Take a slot · ${formatPence(n.feePence + n.travelPence)}` : "Accept appearance"}</button>
        : <span className="pa-already-booked">You're booked that night</span>}
      </li>)}</ul></div>
    </section> : <p className="money-match__note">No Pro-Am nights near you this week.</p>}
    <section className="pa-record" aria-label="Career record">
      <span className="pa-record-icon"><Trophy size={18} /></span>
      <div className="pa-record-copy"><small>CAREER RECORD</small>
        <strong>{amateur || !d.record.nightsAsPro ? (d.record.slots ? `${d.record.prosBeaten} pros beaten from ${d.record.slots} slots` : "No Pro-Am legs yet")
          : `${d.record.nightsAsPro} ${d.record.nightsAsPro === 1 ? "night" : "nights"} as the pro`}</strong></div>
      <div className="pa-record-stats">{amateur || !d.record.nightsAsPro
        ? <><span>Pros beaten <b>{d.record.prosBeaten}</b></span><span>Prize money <b>{formatPence(d.record.prizePence)}</b></span></>
        : <><span>Paid <b>{formatPence(d.record.appearancePence)}</b></span><span>Amateurs beat you <b>{d.record.amateursBeatYou}</b></span></>}</div>
    </section>
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
      try {
        const s = await proAmApi.darts(id, nightId, darts);
        if (s.status === "PLAYED") {
          setSession(s);
          await client.invalidateQueries({ queryKey: careerKey(id) });
        }
      }
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
