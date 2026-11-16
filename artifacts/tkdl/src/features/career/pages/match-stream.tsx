import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { streamingApi, errorMessage, type ChatEvent, type MatchStream, type SideMatchKind } from "../api";
import { formatPence } from "../model";
import { RecapList, StreamHud } from "./stream-hud";
import "./streaming.css";

/**
 * Stream your real match on DartCast (events without TV cameras). Chat follows the match's own dart log on the server, so
 * after every checkpoint (`tick`) it catches up. Hidden when the match can't be streamed.
 */
export type MatchStreamPanelHandle = { refresh: () => void };
/** A non-tournament match (money match, road trip, club/county, Pro-Am, webcam league, local competition): the scorer's own dart log drives chat. */
export type SideStream = { kind: SideMatchKind; format: unknown; firstThrower: 0 | 1; opponentName: string; opponentAvg: number; darts: () => unknown[] };

export const MatchStreamPanel = forwardRef<MatchStreamPanelHandle, { saveId: string; matchId: string; side?: SideStream }>(
  function MatchStreamPanel({ saveId, matchId, side }, ref) {
  const [state, setState] = useState<MatchStream | null>(null);
  const [chat, setChat] = useState<ChatEvent[]>([]);
  const [note, setNote] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [fresh, setFresh] = useState<ChatEvent[]>([]);
  const [answering, setAnswering] = useState(false);
  useImperativeHandle(ref, () => ({ refresh: () => setRefreshTick(t => t + 1) }), []);
  const sideRef = useRef(side); sideRef.current = side;
  const sent = useRef(-1);
  /** Tournament matches: the server reads the match's own log. Side matches: send the scorer's log. */
  const call = (start: boolean) => {
    const s = sideRef.current;
    if (!s) return streamingApi.match(saveId, matchId, start);
    const darts = start ? s.darts() : [];
    if (start) sent.current = darts.length;
    return streamingApi.sideMatch(saveId, matchId, { start, kind: s.kind, format: s.format, firstThrower: s.firstThrower, opponentName: s.opponentName, opponentAvg: s.opponentAvg, darts });
  };
  useEffect(() => {
    // A stream already going (e.g. the match just finished and this is the result card): catch chat up with the final darts.
    let active = true;
    call(false).then(async s => {
      if (!active) return;
      setState(s); if (s.session) setChat(s.session.chat);
      if (s.session?.status === "LIVE") {
        const c = await call(true);
        if (!active) return;
        setState(c); if (c.events.length) { setFresh(c.events); setChat(x => [...x, ...c.events].slice(-120)); }
      }
    }).catch(() => { if (active) setState(null); });
    return () => { active = false; };
  }, [saveId, matchId]);
  const live = state?.session?.status === "LIVE";
  useEffect(() => {
    if (!live || refreshTick === 0) return;
    let active = true;
    call(true).then(s => {
      if (!active) return;
      setState(s);
      if (s.events.length) { setFresh(s.events); setChat(c => [...c, ...s.events].slice(-120)); }
    }).catch(e => { if (active) setNote(errorMessage(e)); });
    return () => { active = false; };
  }, [live, refreshTick, saveId, matchId]);
  // Side matches have no server-side log to read: while live, send the scorer's log whenever it has grown.
  useEffect(() => {
    if (!live || !side) return;
    const t = window.setInterval(() => { if ((sideRef.current?.darts().length ?? 0) !== sent.current) setRefreshTick(x => x + 1); }, 2000);
    return () => window.clearInterval(t);
  }, [live, !!side]);
  if (!state || (!state.eligible && !state.session)) return null;
  const start = () => call(true).then(s => { setState(s); setChat(s.session?.chat ?? []); }).catch(e => setNote(errorMessage(e)));
  const s = state.session;
  const answer = (accept: boolean) => {
    if (!s) return;
    setAnswering(true);
    streamingApi.answerRequest(saveId, s.id, accept).then(session => setState(x => x ? { ...x, session } : x)).catch(e => setNote(errorMessage(e))).finally(() => setAnswering(false));
  };
  if (s) return <>
    <StreamHud session={s} chat={chat} fresh={fresh} onAnswer={answer} answering={answering}>
      {!live && <><p className="dc__note">Stream over: +{s.followersGained ?? 0} followers, {formatPence(s.incomePence ?? 0)} in cheers.</p><RecapList session={s} /></>}
    </StreamHud>
    {note && <p className="dc__warn dc-match__warn" role="alert">{note}</p>}
  </>;
  return (
    <div className="dc-match">
      <button type="button" className="dc-match__chip" onClick={start} aria-label="Stream this match on DartCast"><Radio aria-hidden /> <span className="dc-match__long">Stream this match on DartCast</span><span className="dc-match__short" aria-hidden>Stream</span></button>
      {note && <p className="dc__warn" role="alert">{note}</p>}
    </div>
  );
  },
);
