import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Award, BookOpen, Crown, GraduationCap, Handshake, Mic2, Target, Trophy } from "lucide-react";
import { GameScorer } from "@/components/game-scorer";
import type { Dart } from "@/lib/darts-rules";
import { careerKey, errorMessage, localNightApi, useBookLocalNight, useJoinPubLeague, useLocalNights, useLocalSession } from "./api";
import { CareerError, CareerLoading, CareerSection } from "./components";
import { CareerPageHero } from "./page-hero";
import { CareerScorerStage } from "./scorer-stage";
import { DrillScorer } from "./pages/drill-scorer";
import { careerBotVisit, careerGameType, recoveryFromLog, scorerLength, shouldCheckpoint } from "./live-model";
import { dayLabel, formatPence } from "./model";
import type { LiveSession } from "./types";
import type { ShellContext } from "./shell";
import "./local-nights.css";

const ICON: Record<string, typeof Trophy> = { CHAMPIONSHIP: Crown, PUB_LEAGUE: Trophy, KNOCKOUT: Target, PRACTICE: BookOpen, FRIENDLY: Handshake, EXHIBITION: Mic2, COACHING: GraduationCap };

/** Local nights: book any of this week's ordinary darts nights, and the pub league table. */
export function LocalNightsPage({ ctx }: { ctx: ShellContext }) {
  const id = ctx.save.id, q = useLocalNights(id), book = useBookLocalNight(id), join = useJoinPubLeague(id), [, go] = useLocation();
  const [night, setNight] = useState<Record<string, number>>({}), [routine, setRoutine] = useState("CHECKOUTS"), [message, setMessage] = useState("");
  if (q.isLoading) return <CareerLoading />;
  if (q.error || !q.data) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  const v = q.data, retired = !!ctx.save.retiredAt;
  const pickFor = (kind: string, fixed: number | null) => fixed ?? night[kind] ?? v.freeNights[0] ?? null;
  const lg = v.pubLeague && "table" in v.pubLeague ? v.pubLeague : null;
  return <div className="space-y-3 local-nights">
    <CareerPageHero kicker="Nights Out · your local" title="Local nights" accent="#7ec8a4" stage={{ venue: { venueType: "social-club" }, eventClass: "GRASSROOTS" }}
      subtitle={<p>The ordinary darts week: a pub league on Tuesdays, the club knockout on Thursdays, practice on any free night, friendlies at either end of the season, and paid nights once you're known.</p>} />
    {v.nights.length > 0 && <CareerSection title="Booked this week" icon={<Trophy aria-hidden />} accent="#7ec8a4">
      <ul className="local-nights__booked">{v.nights.map(n => <li key={n.id}><b>{dayLabel(n.dayOfWeek)}</b><span>{n.title}</span>
        {n.status === "BOOKED" && n.kind !== "COACHING" ? <Link className="career-btn career-btn-gold" href={`/career/${id}/local/${n.id}`}>Play</Link>
          : <small>{n.outcome ?? (n.status === "BOOKED" ? "Paid when the week's done" : n.status.toLowerCase())}</small>}</li>)}</ul>
    </CareerSection>}
    <CareerSection title={`Week ${v.week}: what's on`} icon={<Target aria-hidden />} accent="#7ec8a4">
      <ul className="local-nights__list">{v.activities.map(a => { const Icon = ICON[a.kind] ?? Target, day = pickFor(a.kind, a.dayOfWeek);
        const needsLeague = a.kind === "PUB_LEAGUE" && !lg;
        return <li key={a.kind} data-off={!!a.why || undefined}>
          <span className="local-nights__icon" aria-hidden><Icon /></span>
          <div><b>{a.name}</b><small>{a.blurb}</small>
            {a.feePence !== 0 && <small className="local-nights__fee">{a.feePence < 0 ? `${formatPence(-a.feePence)} entry` : `Pays ${formatPence(a.feePence)}`}</small>}
            {a.why && <small className="local-nights__why">{a.why}</small>}</div>
          <div className="local-nights__go">
            {a.kind === "PRACTICE" && <select aria-label="Routine" value={routine} onChange={e => setRoutine(e.target.value)}>{v.routines.map(r =>
              <option key={r.key} value={r.key}>{r.name}{r.best !== null ? ` (best ${r.best})` : ""}</option>)}</select>}
            {!a.dayOfWeek && !a.why && <select aria-label={`Night for ${a.name}`} value={day ?? ""} onChange={e => setNight(x => ({ ...x, [a.kind]: Number(e.target.value) }))}>
              {v.freeNights.map(d => <option key={d} value={d}>{dayLabel(d)}</option>)}</select>}
            {needsLeague && !a.why ? <button type="button" className="career-btn career-btn-gold" disabled={retired || join.isPending}
                onClick={() => join.mutate(undefined, { onSuccess: () => setMessage("You're in: seven weeks of Tuesday nights."), onError: e => setMessage(errorMessage(e)) })}>Join · {v.division.name}</button>
              : <button type="button" className="career-btn career-btn-gold" disabled={retired || !!a.why || day === null || book.isPending}
                onClick={() => book.mutate({ kind: a.kind, dayOfWeek: day!, ...(a.kind === "PRACTICE" ? { routine } : {}) }, {
                  onSuccess: r => { setMessage(""); if (a.kind !== "COACHING") go(`/career/${id}/local/${r.nightId}`); else setMessage("Booked: you're paid when the week's done."); },
                  onError: e => setMessage(errorMessage(e)) })}>{a.kind === "COACHING" ? "Book it" : "Book and play"}{a.dayOfWeek ? ` · ${dayLabel(a.dayOfWeek)}` : ""}</button>}
          </div>
        </li>; })}</ul>
      {message && <p className="local-nights__msg" role="status">{message}</p>}
    </CareerSection>
    {lg && <CareerSection title={`Pub league · ${lg.division} · weeks ${lg.weekStart}–${lg.weekEnd}`} icon={<Trophy aria-hidden />} accent="#d9b96f">
      {lg.thisWeek && <p className="local-nights__note">This Tuesday: v {lg.thisWeek.opponent}{lg.thisWeek.legs ? ` (${lg.thisWeek.legs[0]}-${lg.thisWeek.legs[1]})` : ""}</p>}
      <table className="local-nights__table"><thead><tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>Legs</th><th>Pts</th></tr></thead>
        <tbody>{(lg.table ?? []).map((r, i) => <tr key={r.key} data-you={r.you || undefined}><td>{i + 1}</td><td>{r.name}</td><td>{r.played}</td><td>{r.won}</td><td>{r.legsFor}-{r.legsAgainst}</td><td>{r.points}</td></tr>)}</tbody></table>
      <p className="local-nights__note">Prizes for the top three (bigger in higher divisions); the top two go up a division and the bottom two go down. Miss a Tuesday and that match is forfeited 3-0.</p>
    </CareerSection>}
    {v.honours.length > 0 && <CareerSection title="Club honours" icon={<Award aria-hidden />} accent="#d9b96f">
      <ul className="local-nights__booked">{v.honours.map(h => <li key={`${h.season}:${h.award}`}><b>S{h.season}</b>
        <span>{h.award === "CLUB_CHAMPION" ? "Club Champion" : h.award === "PLAYER_OF_THE_YEAR" ? "Club Player of the Year" : `Club Championship: reached the ${String(h.detail.reached ?? "").toLowerCase()}`}</span></li>)}</ul>
    </CareerSection>}
    <p className="nights-back"><Link href={`/career/${id}/nights`}>Back to this week's nights</Link></p>
  </div>;
}

/** Playing a local night: each match on the live scorer (the knockout moves round by round), or the practice drill. */
export function LocalNightPlayPage({ ctx, nightId }: { ctx: ShellContext; nightId: string }) {
  const id = ctx.save.id, q = useLocalSession(id, nightId), client = useQueryClient();
  const [session, setSession] = useState<typeof q.data>(undefined), [message, setMessage] = useState("");
  const log = useRef<Dart[]>([]), queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => { if (q.data && !session) { setSession(q.data); log.current = (q.data.match?.darts ?? q.data.drill?.darts ?? []) as Dart[]; } }, [q.data, session]);
  const send = useCallback((darts: unknown[]) => {
    queue.current = queue.current.then(async () => {
      try {
        const updated = await localNightApi.darts(id, nightId, darts);
        const roundChanged = updated.match?.round !== session?.match?.round || updated.status !== "BOOKED";
        if (roundChanged) { setSession(updated); log.current = (updated.match?.darts ?? []) as Dart[]; await client.invalidateQueries({ queryKey: careerKey(id) }); }
      } catch (e) { setMessage(errorMessage(e)); }
    });
  }, [id, nightId, client, session?.match?.round]);
  const m = session?.match ?? null;
  const live = useMemo(() => m ? { bot: m.opponent.bot, format: m.format } as unknown as LiveSession : null, [m]);
  const onDartLog = useCallback((darts: Dart[]) => { log.current = darts; if (m && shouldCheckpoint(m.format, m.firstThrower, darts)) send(darts); }, [m, send]);
  const planner = useCallback((c: { remaining: number; opened: boolean }) => careerBotVisit(live!, m!.firstThrower, log.current, c), [live, m]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recovery = useMemo(() => m && m.darts.length ? recoveryFromLog(m.format, m.firstThrower, m.darts as Dart[]) : null, [m?.round, session?.id]);
  if (q.isLoading || (!session && !q.error)) return <CareerLoading />;
  if (q.error || !session) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  const back = <Link className="career-btn career-btn-ghost" href={`/career/${id}/local`}>Back to local nights</Link>;
  if (session.status !== "BOOKED" || (!m && !session.drill)) return <div className="local-nights__done space-y-3">
    <h2>{session.title}</h2><p>{session.outcome ?? "All done."}</p>
    {session.played.length > 0 && <ul>{session.played.map((p, i) => <li key={i}>{p.round}: {p.won ? "beat" : "lost to"} {p.opponent} {p.legs ? `${p.legs[0]}-${p.legs[1]}` : ""}</li>)}</ul>}{back}</div>;
  if (session.drill) return <div className="space-y-3"><h2>{session.title}</h2>
    <DrillScorer key={session.id} spec={session.drill.spec} initialDarts={session.drill.darts as Dart[]} onVisit={darts => send(darts)} />
    {message && <p role="alert">{message}</p>}{back}</div>;
  return <CareerScorerStage message={message} title={`${session.title} · ${m!.round}: ${session.you} vs ${m!.opponent.name}`}>
    <GameScorer key={`${session.id}:${m!.round}`} p1Name={session.you} p2Name={m!.opponent.name}
      gameType={careerGameType(m!.format as LiveSession["format"])} botConfig={m!.opponent.bot.config}
      firstThrower={m!.firstThrower} {...scorerLength(m!.format as LiveSession["format"])}
      initialRecovery={recovery} onRecoveryState={() => {}} botVisitPlanner={planner} onDartLog={onDartLog}
      onWin={() => send(log.current)} onAbandon={() => { window.location.href = `/career/${id}/local`; }} />
  </CareerScorerStage>;
}
