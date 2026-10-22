import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { markSeen } from "../unlocks";
import { Check, ChevronRight, Crown, Globe2, Loader2, MonitorPlay, Trophy, Video } from "lucide-react";
import { GameScorer } from "@/components/game-scorer";
import type { Dart } from "@/lib/darts-rules";
import { camLeagueApi, careerKey, errorMessage, useBookCamMatch, useCamLeague, useCamMatch, useJoinCamLeague, useSimulateCamMatch } from "../api";
import { CareerError, CareerLoading } from "../components";
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
  const player = me >= 0 ? l?.table[me] : undefined;
  return <div className="cam-league cam-league--atlas">
    <header className="cam-atlas__masthead"><span><b>TKDL</b><i>/</i> CAREER <i>/</i> INTERNATIONAL WEBCAM DIVISION</span>
      <span>SEASON {String(d.season).padStart(2, "0")} <i>·</i> WEEK {String(d.week).padStart(2, "0")}</span></header>
    {message && <p className="money-match__message" role="alert">{message}</p>}
    <section className="cam-atlas__opening">
      <div className="cam-atlas__eyebrow"><span><i /> MATCH NIGHT DESK</span><b><Globe2 aria-hidden /> 8 BOARDS <i>·</i> 7 NATIONS <i>·</i> ONE TABLE</b></div>
      <div className="cam-atlas__lead">
        <div className="cam-atlas__intro">
          <small>THE INTERNATIONAL WEBCAM LEAGUE · {l ? l.name.toUpperCase() : d.division.name.toUpperCase()}</small>
          <h1>Every board<br /><em>has a place.</em></h1>
          <p>Seven weeks. Eight home boards. Your next fixture is one throw away from changing the table.</p>
          <div className="cam-atlas__movement"><span><i /> PROMOTION PLACES</span><b>01—02</b><span><i className="down" /> RELEGATION PLACES</span><b>07—08</b></div>
        </div>
        <div className="cam-atlas__route-art" aria-hidden="true">
          <div className="cam-atlas__map-label">GLOBAL FIXTURE ROUTE <small>DIVISION {String(d.division.level).padStart(2, "0")}</small></div>
          <svg viewBox="0 0 580 300" preserveAspectRatio="xMidYMid meet">
            <g className="cam-atlas__grid"><path d="M76 35v230M176 35v230M276 35v230M376 35v230M476 35v230M35 80h510M35 130h510M35 180h510M35 230h510" /></g>
            <g className="cam-atlas__contours"><path d="M25 95C72 42 129 43 168 73s59 49 108 29 77-44 129-33 90 24 129 4M15 112c57-50 113-51 151-22s63 44 110 26 79-42 129-32 93 22 138 2M27 227c40-33 87-42 127-20s72 39 115 16 78-39 121-21 77 26 133 11" /></g>
            <path className="cam-atlas__route-shadow" d="M75 204C150 55 235 248 302 151S414 50 510 94" />
            <path className="cam-atlas__route" d="M75 204C150 55 235 248 302 151S414 50 510 94" />
            <circle className="node" cx="75" cy="204" r="7" /><circle className="node" cx="175" cy="111" r="4" />
            <circle className="node" cx="302" cy="151" r="6" /><circle className="node" cx="410" cy="80" r="4" />
            <circle className="target" cx="510" cy="94" r="25" /><circle className="target-inner" cx="510" cy="94" r="14" />
            <circle className="node node--active" cx="510" cy="94" r="7" />
            <text x="56" y="230">HOME</text><text x="284" y="177">EUROPE</text><text x="488" y="132">NEXT</text>
          </svg>
          <div className="cam-atlas__seal"><small>YOUR PLACE</small><b>{player ? ordinal(me + 1) : "—"}</b><span>{player?.points ?? 0} PTS · {player?.played ?? 0} PLAYED</span></div>
          <div className="cam-atlas__route-caption"><i /> SEASON PATH <span>WEEK {d.week} OF 16</span></div>
        </div>
      </div>
      <div className="cam-atlas__stats">
        <div><small>YOUR PLACE</small><b>{player ? ordinal(me + 1) : "—"}</b></div>
        <div><small>ROUND</small><b>{l ? String(l.round).padStart(2, "0") : "—"} <span>/ 07</span></b></div>
        <div><small>POINTS</small><b>{player?.points ?? "—"}</b></div>
        <div><small>SEASON WINDOW</small><b>{l ? `${l.weekStart}—${l.weekEnd}` : `${d.join.startsWeek}—${d.join.endsWeek}`}</b></div>
        <p>First to three legs <i>·</i> 2 points for a win <i>·</i> played from home</p>
      </div>
    </section>
    {l ? <>
      <section className="cam-atlas__fixture" aria-label={futureWeek ? "Next week's fixture" : "This week's fixture"}>
        <div className="cam-atlas__week"><small>WEEK</small><b>{String(f?.week ?? d.week).padStart(2, "0")}</b><i>LIVE FIXTURE</i></div>
        <div className="cam-atlas__contestant"><small>YOUR BOARD · {player ? ordinal(me + 1).toUpperCase() : "—"}</small><b>{player?.name ?? "You"}</b><span>{player?.points ?? 0} PTS · {player?.country || "HOME"}</span></div>
        <div className="cam-atlas__versus">VS</div>
        <div className="cam-atlas__contestant"><small>OPPONENT · {futureWeek ? "UP NEXT" : "THIS WEEK"}</small><b>{f?.opponent.name ?? "No fixture"}</b><span>{f ? `${f.opponent.country} · AVG ${f.opponent.avg}` : "Season schedule"}</span></div>
        <div className="cam-atlas__format"><small>THE FORMAT</small><b>FIRST TO <em>3</em></b><span>2 POINTS FOR A WIN</span></div>
      </section>
      <section className="cam-atlas__booking">
        <div className="cam-atlas__booking-copy">
          <div className="cam-atlas__section-tag"><span>01</span> CLAIM YOUR FIXTURE <i /></div>
          <h2>{futureWeek ? <>Choose a night.<br /><em>Plan the next one.</em></> : <>Pick a night.<br /><em>Make it count.</em></>}</h2>
          {!f ? <p className="cam-atlas__note">There is no fixture scheduled for this week.</p> : f.status === "SCHEDULED" ? <>
            <p className="cam-atlas__note">{retired ? "Your career is over." : "Book a free night to play this fixture. Matches not played by the end of the week are forfeited 3–0."}</p>
            {!retired && d.freeNights.length > 0 ? <>
              <div className="cam-atlas__nights" role="radiogroup" aria-label="Choose a free match night">{d.freeNights.map(n => <button key={n} type="button" role="radio" aria-checked={pick === n} onClick={() => setNight(n)}>
                <small>{dayLabel(n).slice(0, 3).toUpperCase()}</small><b>{dayLabel(n)}</b>{pick === n && <Check aria-hidden />}
              </button>)}</div>
              <button type="button" className="cam-atlas__book" disabled={book.isPending || pick === null}
                onClick={() => book.mutate({ fixtureId: f.id, dayOfWeek: pick!, week: d.week }, { onError: fail })}>
                {book.isPending ? "BOOKING…" : `BOOK IT FOR ${pick ? dayLabel(pick).toUpperCase() : "A NIGHT"}`} <ChevronRight aria-hidden />
              </button>
            </> : !retired && <p className="cam-atlas__note">No free nights remain this week; this match will be forfeited.</p>}
          </> : f.status === "BOOKED" && futureWeek ? <p className="cam-atlas__note">Booked for {dayLabel(f.dayOfWeek!)} in week {d.week}. Playing opens when that week begins.</p>
            : f.status === "BOOKED" ? <>
              <p className="cam-atlas__note">Booked for {dayLabel(f.dayOfWeek!)}. Play on your camera scorer or quick-sim at your level.</p>
              <div className="cam-atlas__actions">
                <button type="button" className="cam-atlas__book" onClick={() => navigate(`/career/${id}/cam-league/${f.id}`)}><MonitorPlay aria-hidden /> PLAY ON CAMERA</button>
                <button type="button" className="cam-atlas__sim" disabled={sim.isPending} onClick={() => sim.mutate(f.id, { onError: fail })}>{sim.isPending && <Loader2 className="animate-spin" aria-hidden />} QUICK-SIM IT</button>
              </div>
            </> : <p className="cam-atlas__outcome">{f.status === "FORFEIT" ? "FORFEITED" : f.legs && f.legs[0] > f.legs[1] ? "VICTORY" : "FIXTURE COMPLETE"}{f.legs && ` · ${f.legs[0]}–${f.legs[1]}`}{f.source === "SIM" ? " · QUICK-SIM" : ""}</p>}
        </div>
        <div className="cam-atlas__booking-art" aria-hidden="true">
          <div><span>FIXTURE {String(f?.round ?? 0).padStart(2, "0")} / WEEK {String(d.week).padStart(2, "0")}</span><span>HOME BOARD LINK OPEN</span></div>
          <strong>{f?.status === "BOOKED" ? dayLabel(f.dayOfWeek!).slice(0, 3).toUpperCase() : "PLAY"}<i>{String(f?.week ?? d.week).padStart(2, "0")}</i></strong>
          <svg viewBox="0 0 420 126"><path d="M5 98C77 97 76 20 155 38S257 111 313 44 377 16 415 25" /><circle cx="5" cy="98" r="4" /><circle cx="155" cy="38" r="4" /><circle cx="313" cy="44" r="4" /><circle cx="415" cy="25" r="6" /></svg>
          <small>YOUR BOARD <i /> GLOBAL FIXTURE</small>
          <b>YOUR NEXT THROW MATTERS.</b>
        </div>
      </section>
      <section className="cam-atlas__competition">
        <div className="cam-atlas__standings">
          <div className="cam-atlas__heading"><div><small>02 · THE DIVISION</small><h2>Table of play</h2></div><span><i /> UP <i className="red" /> DOWN</span></div>
          <div className="cam-atlas__table-scroll"><table className="cam-league__table"><thead><tr><th scope="col">POS</th><th scope="col">PLAYER / BOARD</th><th scope="col">P</th><th scope="col">W</th><th scope="col">L</th><th scope="col">LEGS</th><th scope="col">PTS</th></tr></thead>
            <tbody>{l.table.map((r, i) => <tr key={r.key} className={r.you ? "is-you" : undefined} data-zone={i < 2 && l.level > 1 ? "up" : i >= l.table.length - 2 && l.level < 5 ? "down" : undefined}>
              <td><span className="cam-atlas__rank">{String(i + 1).padStart(2, "0")}</span></td>
              <td>{r.you ? <b>You</b> : r.name}{r.you && <Crown aria-label="Your place" />}{r.country && <small>{r.country}</small>}</td><td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.legsFor}–{r.legsAgainst}</td><td><b>{r.points}</b></td>
            </tr>)}</tbody></table></div>
          <div className="cam-atlas__prize"><Trophy aria-hidden /><span>SEASON PRIZE PURSE</span><b>{l.prizes.map(p => formatPence(p)).join(" / ")}</b><small>TOP THREE</small></div>
        </div>
        <aside className="cam-atlas__ledger">
          <div className="cam-atlas__heading"><div><small>03 · YOUR SEASON</small><h2>Road to the final week</h2></div><span>S{String(d.season).padStart(2, "0")} <ChevronRight aria-hidden /> W{l.weekStart}—{l.weekEnd}</span></div>
          <ol>{l.fixtures.map(x => <li key={x.id} className={x.week === d.week ? "is-current" : x.legs ? "is-played" : ""}>
            <i aria-hidden="true" /><small>W{x.week}</small><span><b>{x.opponent.name}</b><em>{x.opponent.country}</em></span>
            <strong>{x.legs ? `${x.status === "FORFEIT" ? "FORFEIT " : ""}${x.legs[0]}–${x.legs[1]}` : x.status === "BOOKED" ? `BOOKED ${dayLabel(x.dayOfWeek!)}` : x.week === d.week && x.status === "SCHEDULED" ? "THIS WEEK" : "FIXTURE"}</strong>
          </li>)}</ol>
        </aside>
      </section>
    </> : <section className="cam-atlas__join">
      <div className="cam-atlas__section-tag"><span>01</span> ENTER THE DIVISION <i /></div><h2>Your board is next.</h2>
      <p>Your division: <b>{d.division.name}</b>. Entry {formatPence(d.join.feePence)}; the top three share {d.join.prizes.map(p => formatPence(p)).join(" / ")}. Runs weeks {d.join.startsWeek}–{d.join.endsWeek}.</p>
      {d.join.ok && !retired ? <button type="button" className="cam-atlas__book" disabled={join.isPending} onClick={() => join.mutate(undefined, { onError: fail })}>
        {join.isPending ? "ENTERING…" : `JOIN FOR ${formatPence(d.join.feePence)}`} <ChevronRight aria-hidden /></button>
        : <p className="cam-atlas__note">{retired ? "Your career is over." : d.join.why}</p>}
    </section>}
    {d.history.length > 0 && <section className="cam-atlas__history"><div><Trophy aria-hidden /><span><small>LEAGUE ARCHIVE</small><b>Past seasons</b></span></div>
      {d.history.map((h, i) => <p key={`${h.season}-${i}`}><b>S{String(h.season).padStart(2, "0")} · {h.name}</b><span>{ordinal(h.position)}{h.prizePence ? ` · ${formatPence(h.prizePence)}` : ""}{h.nextLevel < h.level ? " · PROMOTED" : h.nextLevel > h.level ? " · RELEGATED" : ""}</span></p>)}
    </section>}
    <footer className="cam-atlas__footer"><span><i /> TKDL WEBCAM LEAGUE</span><b>YOUR BOARD AT HOME <i>·</i> YOUR SEASON ON THE LINE</b><span>DIVISION {String(d.division.level).padStart(2, "0")}</span></footer>
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
      try {
        const s = await camLeagueApi.darts(id, fixtureId, darts);
        if (s.status === "PLAYED") {
          setSession(s);
          await client.invalidateQueries({ queryKey: careerKey(id) });
        }
      }
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
