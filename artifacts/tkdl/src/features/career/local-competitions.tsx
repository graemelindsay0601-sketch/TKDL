import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CupSoda, Shield, Trophy } from "lucide-react";
import { GameScorer } from "@/components/game-scorer";
import type { Dart } from "@/lib/darts-rules";
import { careerKey, errorMessage, localCompetitionApi, useCreateLocalCompetition, useLocalCompetitions } from "./api";
import type { LocalCompetition } from "./api";
import { CareerError, CareerLoading } from "./components";
import { careerBotVisit, careerGameType, recoveryFromLog, scorerLength, shouldCheckpoint } from "./live-model";
import type { LiveSession } from "./types";
import type { ShellContext } from "./shell";
import "./local-competitions.css";

const kindLabel = (kind: LocalCompetition["kind"]) => kind === "LEAGUE" ? "Singles league" : kind === "SINGLES_CUP" ? "Singles cup" : "Team cup";

export function LocalCompetitions({ saveId, retired = false }: { saveId: string; retired?: boolean }) {
  const q = useLocalCompetitions(saveId), create = useCreateLocalCompetition(saveId), [, navigate] = useLocation();
  const [name, setName] = useState("Friday Club League"), [kind, setKind] = useState<LocalCompetition["kind"]>("LEAGUE");
  const [score, setScore] = useState<301 | 501 | 701>(501), [bestOf, setBestOf] = useState<3 | 5 | 7>(5);
  const [inRule, setInRule] = useState<"STRAIGHT" | "DOUBLE">("STRAIGHT"), [outRule, setOutRule] = useState<"STRAIGHT" | "DOUBLE">("DOUBLE");
  const [error, setError] = useState("");
  if (q.isLoading) return <CareerLoading />;
  if (q.error || !q.data) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  const start = async (competition: LocalCompetition, fixtureId: string) => {
    try {
      await localCompetitionApi.start(saveId, competition.id, fixtureId);
      await q.refetch();
      navigate(`/career/${saveId}/club/local-competitions/${competition.id}/${fixtureId}`);
    } catch (e) { setError(errorMessage(e)); }
  };
  return <section className="career-section local-comps" id="local-competitions">
    <header className="career-section-head"><Trophy aria-hidden /><div><h2>Local competitions</h2><p>Run a league or cup at your home club. Your own fixtures are played live.</p></div></header>
    <form className="local-comps__setup" onSubmit={e => {
      e.preventDefault(); setError("");
      create.mutate({ name, kind, startingScore: score, bestOfLegs: bestOf, inRule, outRule }, { onError: e => setError(errorMessage(e)) });
    }}>
      <label>Competition name<input value={name} maxLength={48} onChange={e => setName(e.target.value)} required minLength={3} disabled={retired} /></label>
      <label>Event type<select value={kind} onChange={e => setKind(e.target.value as LocalCompetition["kind"])} disabled={retired}>
        <option value="LEAGUE">Singles league</option><option value="SINGLES_CUP">Singles cup</option><option value="TEAM_CUP">Team cup</option></select></label>
      <label>Start score<select value={score} onChange={e => setScore(Number(e.target.value) as 301 | 501 | 701)}><option>301</option><option>501</option><option>701</option></select></label>
      <label>Match length<select value={bestOf} onChange={e => setBestOf(Number(e.target.value) as 3 | 5 | 7)}><option value={3}>Best of 3 legs</option><option value={5}>Best of 5 legs</option><option value={7}>Best of 7 legs</option></select></label>
      <label>In rule<select value={inRule} onChange={e => setInRule(e.target.value as "STRAIGHT" | "DOUBLE")}><option value="STRAIGHT">Straight in</option><option value="DOUBLE">Double in</option></select></label>
      <label>Out rule<select value={outRule} onChange={e => setOutRule(e.target.value as "STRAIGHT" | "DOUBLE")}><option value="DOUBLE">Double out</option><option value="STRAIGHT">Straight out</option></select></label>
      <button className="club-button club-button-red" disabled={create.isPending || retired || name.trim().length < 3}>{create.isPending ? "Setting up…" : "Create competition"}</button>
    </form>
    {error && <p role="alert" className="team-night__note">{error}</p>}
    {q.data.competitions.length === 0 ? <p className="team-night__note">No local competitions yet. Set one up to get started.</p> :
      <div className="local-comps__list">{q.data.competitions.map(c => {
        const names = new Map(c.participants.map(p => [p.key, p.name]));
        const fixtures = c.fixtures.filter(f => f.a === "HUMAN" || f.b === "HUMAN");
        const won = fixtures.filter(f => f.status === "PLAYED" && f.winnerKey === "HUMAN").length;
        const table = c.kind === "LEAGUE" ? c.participants.map(p => {
          let played = 0, wins = 0, legsFor = 0, legsAgainst = 0, points = 0;
          for (const f of c.fixtures.filter(x => x.status === "PLAYED")) {
            if (!f.score) continue;
            if (f.a === p.key) { played++; legsFor += f.score[0]; legsAgainst += f.score[1]; if (f.winnerKey === p.key) { wins++; points += 3; } }
            else if (f.b === p.key) { played++; legsFor += f.score[1]; legsAgainst += f.score[0]; if (f.winnerKey === p.key) { wins++; points += 3; } }
          }
          return { ...p, played, wins, legsFor, legsAgainst, points };
        }).sort((a,b) => b.points-a.points || b.legsFor-b.legsAgainst-(a.legsFor-a.legsAgainst) || b.legsFor-a.legsFor || a.name.localeCompare(b.name)) : [];
        const champion = c.status === "COMPLETE" ? c.fixtures.find(f => f.round === Math.max(...c.fixtures.map(x => x.round)))?.winnerKey : null;
        return <article className="local-comps__card" key={c.id}>
          <div className="local-comps__head"><span><Shield aria-hidden /> {kindLabel(c.kind)}</span><b>{c.status === "COMPLETE" ? "COMPLETE" : `SEASON ${c.season}`}</b></div>
          <h3>{c.name}</h3><p>{c.rules.startingScore} · best of {c.rules.bestOfLegs} legs · {c.rules.inRule.toLowerCase()} in, {c.rules.outRule.toLowerCase()} out</p>
          {c.kind === "TEAM_CUP" && <p className="local-comps__format-note">Each tie is three singles; your rubber is live-scored and the other two are simulated.</p>}
          <small>{fixtures.length} player fixture{fixtures.length === 1 ? "" : "s"} · {won} win{won === 1 ? "" : "s"}</small>
          {champion && <p className="local-comps__champion">Winner: <b>{names.get(champion) ?? "Champion"}</b></p>}
          {table.length > 0 && <table className="local-comps__table"><thead><tr><th>Place</th><th>Player</th><th>P</th><th>W</th><th>Legs</th><th>Pts</th></tr></thead>
            <tbody>{table.map((r,i)=><tr key={r.key} className={r.you?"is-you":""}><td>{i+1}</td><td>{r.name}</td><td>{r.played}</td><td>{r.wins}</td><td>{r.legsFor}–{r.legsAgainst}</td><td>{r.points}</td></tr>)}</tbody></table>}
          <ol>{fixtures.map(f => <li key={f.id}><CalendarDays aria-hidden /><span>Week {f.week} · Round {f.round}</span><b>{names.get(f.a)} v {names.get(f.b)}</b>
            {f.status === "MISSED" ? <em>Forfeit</em> : f.status === "PLAYED" ? <em>{f.score?.join("–") ?? "Played"}</em> : f.week <= q.data!.week && !retired ?
              <button type="button" className="club-button club-button-gold" onClick={() => void start(c, f.id)}>{f.status === "LIVE" ? "Resume match" : "Play match"}</button> :
              <em>{retired ? "Career ended" : "Scheduled"}</em>}</li>)}</ol>
        </article>;
      })}</div>}
  </section>;
}

export function LocalCompetitionMatchPage({ ctx, competitionId, fixtureId }: { ctx: ShellContext; competitionId: string; fixtureId: string }) {
  const id = ctx.save.id, q = useLocalCompetitions(id), client = useQueryClient();
  const [current, setCurrent] = useState<{ competition: LocalCompetition; fixture: LocalCompetition["fixtures"][number] } | null>(null);
  const [message, setMessage] = useState("");
  const log = useRef<Dart[]>([]), queue = useRef<Promise<void>>(Promise.resolve());
  const stored = q.data?.competitions.find(c => c.id === competitionId)?.fixtures.find(f => f.id === fixtureId);
  useEffect(() => {
    if (stored?.match && q.data && !current) setCurrent({ competition: q.data.competitions.find(c => c.id === competitionId)!, fixture: stored });
  }, [stored, q.data, current, competitionId]);
  useEffect(() => {
    if (stored && !stored.match && stored.status !== "PLAYED" && stored.status !== "MISSED") localCompetitionApi.start(id, competitionId, fixtureId)
      .then(r => { setCurrent(r); void q.refetch(); }).catch(e => setMessage(errorMessage(e)));
  // Start once when entering a fixture that has not opened yet.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, competitionId, fixtureId, stored?.id, stored?.match?.id]);
  const send = useCallback((darts: Dart[]) => {
    queue.current = queue.current.then(async () => {
      try {
        const result = await localCompetitionApi.darts(id, competitionId, fixtureId, darts);
        setCurrent(result);
        log.current = result.fixture.match?.darts as Dart[] ?? darts;
        if (result.fixture.status === "PLAYED") await client.invalidateQueries({ queryKey: careerKey(id) });
      } catch (e) { setMessage(errorMessage(e)); }
    });
  }, [id, competitionId, fixtureId, client]);
  const match = current?.fixture.match, comp = current?.competition;
  const bot = match?.bot;
  const session = useMemo(() => bot && comp ? { bot: { config: bot, seed: bot.seed }, format: {
    startingScore: comp.rules.startingScore, inRule: comp.rules.inRule, outRule: comp.rules.outRule, unit: "LEGS", bestOfLegs: comp.rules.bestOfLegs,
  } } as unknown as LiveSession : null, [bot, comp]);
  const planner = useCallback((c: { remaining: number; opened: boolean }) => careerBotVisit(session!, 0, log.current, c), [session]);
  const onDartLog = useCallback((darts: Dart[]) => {
    log.current = darts;
    if (match?.status === "LIVE" && comp && shouldCheckpoint(session!.format, 0, darts)) send(darts);
  }, [match, comp, send, session]);
  const recovery = useMemo(() => match?.darts?.length && comp ? recoveryFromLog(session!.format, 0, match.darts as Dart[]) : null, [match?.id]);
  if (q.error) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <CareerLoading />;
  if (stored?.status === "MISSED") return <div className="cam-league__done"><h2>This fixture was forfeited</h2>
    <Link className="career-btn career-btn-ghost" href={`/career/${id}/club#local-competitions`}>Back to local competitions</Link></div>;
  if (!current || !match || !comp) return <CareerLoading />;
  const player = comp.participants.find(p => p.key === "HUMAN")!;
  const opponent = comp.participants.find(p => p.key === (current.fixture.a === "HUMAN" ? current.fixture.b : current.fixture.a));
  const back = <Link className="career-btn career-btn-ghost" href={`/career/${id}/club#local-competitions`}>Back to local competitions</Link>;
  if (match.status === "PLAYED") {
    const teamWon = current.fixture.winnerKey === "HUMAN";
    return <div className="cam-league__done"><h2>{comp.kind === "TEAM_CUP" ? (teamWon ? "Your club won the team tie" : "Your club lost the team tie") : (match.won ? "You won the match" : "You lost the match")}</h2>
      {current.fixture.score?.join("–")}{back}</div>;
  }
  return <div className="cam-league__live"><p className="cam-league__live-title"><CupSoda aria-hidden /> <b>{player.name}</b> vs <b>{opponent?.name}</b>
    <small>{kindLabel(comp.kind)} · {comp.rules.startingScore}, best of {comp.rules.bestOfLegs}</small></p>
    {message && <p role="alert" className="money-match__message">{message}</p>}
    <GameScorer key={match.id} p1Name={player.name} p2Name={opponent?.name ?? "Opponent"} gameType={careerGameType(session!.format)}
      botConfig={bot!} firstThrower={0} {...scorerLength(session!.format)} initialRecovery={recovery} onRecoveryState={() => {}}
      botVisitPlanner={planner} onDartLog={onDartLog} onWin={() => send(log.current)} onAbandon={() => history.back()} />
    {back}</div>;
}
