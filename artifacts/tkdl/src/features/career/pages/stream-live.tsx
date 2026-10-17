import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Heart, Loader2, Radio, Sparkles, Star } from "lucide-react";
import { GameScorer } from "@/components/game-scorer";
import type { Dart } from "@/lib/darts-rules";
import { careerKey, streamingApi, useStreamSession, errorMessage, type ChatEvent, type StreamSession } from "../api";
import { CareerError, CareerLoading } from "../components";
import { careerBotVisit, careerGameType, recoveryFromLog, scorerLength, shouldCheckpoint } from "../live-model";
import { formatPence } from "../model";
import type { ShellContext } from "../shell";
import type { LiveSession } from "../types";
import { DrillScorer } from "./drill-scorer";
import "./streaming.css";

const money = (p: number) => formatPence(p);

function ChatLine({ e }: { e: ChatEvent }) {
  if (e.kind === "CHAT") return <li className="dc-chat__line"><b>{e.user}</b> {e.text}</li>;
  if (e.kind === "FOLLOW") return <li className="dc-chat__note"><Heart aria-hidden /> {e.user} followed</li>;
  if (e.kind === "SUB") return <li className="dc-chat__alert" data-kind="SUB"><Star aria-hidden /> <b>{e.user}</b> subscribed{e.months > 1 ? ` for ${e.months} months` : ""}!</li>;
  if (e.kind === "BITS") return <li className="dc-chat__alert" data-kind="BITS"><Sparkles aria-hidden /> <b>{e.user}</b> cheered {e.pence} bits <span>{e.text}</span></li>;
  if (e.kind === "PLEDGE") return <li className="dc-chat__alert" data-kind="PLEDGE"><Sparkles aria-hidden /> <b>{e.user}</b> pledged {e.pence} bits <span>{e.text}</span></li>;
  return <li className="dc-chat__alert" data-kind="SUPERCHAT"><b>{e.user}</b> <em>{money(e.pence)}</em><span>{e.text}</span></li>;
}

/**
 * A live DartCast stream: the scorer is the stream (you against a viewer, first to two legs), chat runs alongside. After each
 * visit the darts go to the server, which replays them and sends back chat, cheers, follows and the viewer count. When the
 * match is over the stream ends and you see the night's numbers.
 */
export function StreamLivePage({ ctx, streamId }: { ctx: ShellContext; streamId: string }) {
  const id = ctx.save.id, q = useStreamSession(id, streamId), client = useQueryClient();
  const [session, setSession] = useState<StreamSession | null>(null);
  const [chat, setChat] = useState<ChatEvent[]>([]);
  const [alert, setAlert] = useState<ChatEvent | null>(null);
  const [message, setMessage] = useState("");
  const [ending, setEnding] = useState(false);
  const log = useRef<Dart[]>([]), queue = useRef<Promise<void>>(Promise.resolve()), chatBox = useRef<HTMLOListElement>(null);
  useEffect(() => { if (q.data && !session) { setSession(q.data); setChat(q.data.chat); log.current = q.data.darts as Dart[]; } }, [q.data, session]);
  useEffect(() => { chatBox.current?.scrollTo({ top: chatBox.current.scrollHeight }); }, [chat]);
  useEffect(() => { if (!alert) return; const t = setTimeout(() => setAlert(null), 3500); return () => clearTimeout(t); }, [alert]);

  const send = useCallback((darts: Dart[]) => {
    queue.current = queue.current.then(async () => {
      try {
        const r = await streamingApi.darts(id, streamId, darts);
        setSession(prev => {
          // King of the Oche: a new viewer means a fresh leg (the scorer remounts on the round).
          if (prev && r.session.round !== prev.round) log.current = r.session.darts as Dart[];
          return r.session;
        });
        if (r.events.length) { setChat(c => [...c, ...r.events].slice(-150)); const big = [...r.events].reverse().find(e => e.kind === "SUPERCHAT" || e.kind === "SUB" || e.kind === "BITS" || e.kind === "PLEDGE"); if (big) setAlert(big); }
        if (r.session.status === "ENDED") await client.invalidateQueries({ queryKey: careerKey(id) });
      } catch (e) { setMessage(errorMessage(e)); }
    });
  }, [id, streamId, client]);
  const liveSession = useMemo(() => session?.challenger.bot ? { bot: session.challenger.bot, format: session.format } as unknown as LiveSession : null, [session]);
  const onDartLog = useCallback((darts: Dart[]) => {
    log.current = darts;
    if (session && session.status === "LIVE" && !session.drill && shouldCheckpoint(session.format, session.firstThrower, darts)) send(darts);
  }, [session, send]);
  const botVisitPlanner = useCallback((c: { remaining: number; opened: boolean }) => careerBotVisit(liveSession!, session!.firstThrower, log.current, c), [liveSession, session]);
  const initialRecovery = useMemo(() => session && !session.drill && (session.darts as Dart[]).length ? recoveryFromLog(session.format, session.firstThrower, session.darts as Dart[]) : null,
    // Only for the session (and King of the Oche round) we opened with: later updates come from the scorer itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.id, session?.round]);

  if (q.isLoading || (!session && !q.error)) return <CareerLoading />;
  if (q.error || !session) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  const t = session.tally, over = session.status === "ENDED", king = session.streamFormat === "KING", drill = session.drill;
  const title = drill ? <><b>{session.formatName}</b> <small>{drill.kind === "SCORING" ? `target average ${drill.targetAverage}` : drill.kind === "CHECKOUTS" ? `finishes ${drill.targets.join(", ")}` : "D1 to the bull"}</small></>
    : king ? <><b>{session.handle}</b> vs <b>{session.challenger.name}</b> <small>King of the Oche · viewer {session.round + 1} of {session.kingRounds} · one leg · they average about {session.challenger.avg}</small></>
    : <><b>{session.handle}</b> vs <b>{session.challenger.name}</b> <small>first to 2 · they average about {session.challenger.avg}</small></>;
  const headline = drill ? (session.result === "WON" ? `${session.formatName}: done it!` : session.result === "LOST" ? `${session.formatName}: not this time` : "Stream ended")
    : king ? (session.result === "WON" ? `King of the Oche: all ${session.kingRounds} seen off` : `${session.rounds.filter(r => r.result === "WON").length} viewer${session.rounds.filter(r => r.result === "WON").length === 1 ? "" : "s"} seen off`)
    : session.result === "WON" ? `You beat ${session.challenger.name}` : session.result === "LOST" ? `${session.challenger.name} beat you` : "Stream ended";
  return (
    <div className="dc dc--live">
      <header className="dc__bar">
        <Link className="dc__logo" href={`/career/${id}/streaming`}><Radio aria-hidden /> Dart<b>Cast</b></Link>
        <span className="dc__badge" data-live={!over || undefined}>{over ? "ENDED" : "LIVE"}</span>
        <span className="dc__viewers"><Eye aria-hidden /> {t.viewers.toLocaleString("en-GB")}</span>
      </header>
      <div className="dc-live">
        <section className="dc-live__stage" aria-label="Stream">
          <div className="dc-live__title">{title}</div>
          {king && session.rounds.length > 0 && <ol className="dc-live__rounds" aria-label="Viewers so far">{session.rounds.map((r, i) => <li key={i} data-result={r.result}>{r.challenger} {r.result === "WON" ? "seen off" : "won"}</li>)}</ol>}
          {alert && <div className="dc-live__toast" role="status"><ChatLine e={alert} /></div>}
          {!over && drill ? <div className="dc-live__scorer">
            <DrillScorer key={session.id} spec={drill} initialDarts={session.darts as Dart[]} onVisit={send} />
          </div> : !over ? <div className="dc-live__scorer">
            <GameScorer key={`${session.id}:${session.round}`} p1Name={session.handle} p2Name={session.challenger.name} gameType={careerGameType(session.format as LiveSession["format"])}
              botConfig={session.challenger.bot!.config} firstThrower={session.firstThrower} {...scorerLength(session.format as LiveSession["format"])}
              initialRecovery={initialRecovery} onRecoveryState={() => { /* the server keeps the stream's dart log */ }}
              botVisitPlanner={botVisitPlanner} onDartLog={onDartLog} onWin={() => send(log.current)} onAbandon={() => setEnding(true)} />
          </div> : <div className="dc-live__summary">
            <h2>{headline}</h2>
            <dl>
              <div><dt>Peak viewers</dt><dd>{t.peak}</dd></div>
              <div><dt>New followers</dt><dd>+{session.followersGained ?? 0}</dd></div>
              <div><dt>Bits</dt><dd>{money(t.bitsPence)}</dd></div>
              <div><dt>Super chats</dt><dd>{money(t.superchatsPence)}</dd></div>
              {t.pledgedPence ? <div><dt>Pledges</dt><dd>{money(t.pledgedPence)}{session.result === "WON" ? "" : " (not paid)"}</dd></div> : null}
              <div><dt>New subs</dt><dd>{t.subs}</dd></div>
              <div><dt>Earned</dt><dd>{money(session.incomePence ?? 0)}</dd></div>
            </dl>
            {session.poll && <div className="dc-live__poll"><h3>Chat's vote for next time</h3><ul>{[...session.poll.options].sort((a, b) => b.share - a.share).map(o =>
              <li key={o.key} data-winner={o.key === session.poll!.winner || undefined}><span>{o.name}</span><span className="dc-live__bar"><span style={{ width: `${o.share}%` }} /></span><b>{o.share}%</b></li>)}</ul>
              <p className="dc__note">Stream what chat picked and more of them turn up.</p></div>}
            {session.tier === "NEWCOMER" && <p className="dc__note">Bits and super chats start once you're an Affiliate (50 followers).</p>}
            <Link className="dc__go" href={`/career/${id}/streaming`}>Back to your channel</Link>
          </div>}
          {!over && <div className="dc-live__meta">
            <span>{money(t.bitsPence + t.superchatsPence)} in cheers so far · +{t.followersGained} followers · {t.subs} subs</span>
            {ending ? <span>End the stream now? <button type="button" className="dc__link" onClick={() => streamingApi.end(id, streamId).then(s => { setSession(s); return client.invalidateQueries({ queryKey: careerKey(id) }); }).catch(e => setMessage(errorMessage(e)))}>End stream</button>
              <button type="button" className="dc__link" onClick={() => setEnding(false)}>Keep going</button></span>
              : <button type="button" className="dc__link" onClick={() => setEnding(true)}>End stream</button>}
          </div>}
          {message && <p className="dc__warn" role="alert">{message}</p>}
        </section>
        <aside className="dc-chat" aria-label="Stream chat">
          <h2>Stream chat</h2>
          <ol ref={chatBox} aria-live="polite">{chat.map((e, i) => <ChatLine key={i} e={e} />)}</ol>
          {!over && <p className="dc-chat__wait">{session.status === "LIVE" ? <><Loader2 aria-hidden className="animate-spin" /> chat is watching your darts</> : null}</p>}
        </aside>
      </div>
    </div>
  );
}
