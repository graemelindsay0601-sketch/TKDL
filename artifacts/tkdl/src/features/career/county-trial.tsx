import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { GameScorer } from "@/components/game-scorer";
import type { Dart } from "@/lib/darts-rules";
import { careerKey, countyTrialApi, errorMessage, useCountyTrialMatch, type CountyTrialSession } from "./api";
import { CareerError, CareerLoading } from "./components";
import { careerBotVisit, careerGameType, recoveryFromLog, scorerLength, shouldCheckpoint } from "./live-model";
import type { LiveSession } from "./types";
import type { ShellContext } from "./shell";

/** County trial uses the same persisted Career scorer as the selected county singles. */
export function CountyTrialPage({ ctx, matchId }: { ctx: ShellContext; matchId: string }) {
  const id = ctx.save.id, q = useCountyTrialMatch(id, matchId), client = useQueryClient();
  const [session, setSession] = useState<CountyTrialSession | null>(null), [message, setMessage] = useState("");
  const log = useRef<Dart[]>([]), queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => { if (q.data && !session) { setSession(q.data); log.current = q.data.darts as Dart[]; } }, [q.data, session]);
  const send = useCallback((darts: Dart[]) => {
    queue.current = queue.current.then(async () => {
      try {
        const s = await countyTrialApi.darts(id, matchId, darts);
        if (s.status === "PLAYED") { setSession(s); await client.invalidateQueries({ queryKey: careerKey(id) }); }
      } catch (e) { setMessage(errorMessage(e)); }
    });
  }, [id, matchId, client]);
  const live = useMemo(() => session ? { bot: session.opponent.bot, format: session.format } as unknown as LiveSession : null, [session]);
  const onDartLog = useCallback((darts: Dart[]) => {
    log.current = darts;
    if (session?.status === "LIVE" && shouldCheckpoint(session.format, session.firstThrower, darts)) send(darts);
  }, [session, send]);
  const planner = useCallback((c: { remaining: number; opened: boolean }) => careerBotVisit(live!, session!.firstThrower, log.current, c), [live, session]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recovery = useMemo(() => session && session.darts.length ? recoveryFromLog(session.format, session.firstThrower, session.darts as Dart[]) : null, [session?.id]);
  if (q.isLoading || (!session && !q.error)) return <CareerLoading />;
  if (q.error || !session) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  const back = <Link className="career-btn career-btn-ghost" href={`/career/${id}/club`}>Back to county pathway</Link>;
  if (session.status === "PLAYED") return <div className="cam-league__done space-y-3">
    <h2>{session.won ? `You won the county trial against ${session.opponent.name}` : `${session.opponent.name} won the county trial`}</h2>{back}</div>;
  const matchLength = session.format.unit === "LEGS" ? session.format.bestOfLegs : session.format.bestOfSets;
  return <div className="cam-league__live">
    <p className="cam-league__live-title"><b>{session.you}</b> vs <b>{session.opponent.name}</b>
      <small>{session.category === "WOMEN" ? "Women’s" : "Men’s"} county B-squad trial · best of {matchLength} legs · you throw first</small></p>
    {message && <p className="money-match__message" role="alert">{message}</p>}
    <GameScorer key={session.id} p1Name={session.you} p2Name={session.opponent.name}
      gameType={careerGameType(session.format as LiveSession["format"])} botConfig={session.opponent.bot.config}
      firstThrower={session.firstThrower} {...scorerLength(session.format as LiveSession["format"])}
      initialRecovery={recovery} onRecoveryState={() => {}} botVisitPlanner={planner} onDartLog={onDartLog}
      onWin={() => send(log.current)} onAbandon={() => history.back()} />
    {back}
  </div>;
}
