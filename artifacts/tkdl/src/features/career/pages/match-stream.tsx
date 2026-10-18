import { useEffect, useRef, useState } from "react";
import { Eye, Heart, Radio, Sparkles, Star, X } from "lucide-react";
import { streamingApi, errorMessage, type ChatEvent, type MatchStream } from "../api";
import { formatPence } from "../model";
import "./streaming.css";

function Line({ e }: { e: ChatEvent }) {
  if (e.kind === "CHAT") return <li className="dc-chat__line"><b>{e.user}</b> {e.text}</li>;
  if (e.kind === "FOLLOW") return <li className="dc-chat__note"><Heart aria-hidden /> {e.user} followed</li>;
  if (e.kind === "SUB") return <li className="dc-chat__alert" data-kind="SUB"><Star aria-hidden /> <b>{e.user}</b> subscribed!</li>;
  if (e.kind === "BITS" || e.kind === "PLEDGE") return <li className="dc-chat__alert" data-kind="BITS"><Sparkles aria-hidden /> <b>{e.user}</b> cheered {e.pence} bits</li>;
  return <li className="dc-chat__alert" data-kind="SUPERCHAT"><b>{e.user}</b> <em>{formatPence(e.pence)}</em><span>{e.text}</span></li>;
}

/**
 * Stream your real match on DartCast (events without TV cameras). Chat follows the match's own dart log on the server, so
 * after every checkpoint (`tick`) it catches up. Hidden when the match can't be streamed.
 */
export function MatchStreamPanel({ saveId, matchId, tick }: { saveId: string; matchId: string; tick: number }) {
  const [state, setState] = useState<MatchStream | null>(null);
  const [chat, setChat] = useState<ChatEvent[]>([]);
  const [open, setOpen] = useState(true);
  const [note, setNote] = useState("");
  const box = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // A stream already going (e.g. the match just finished and this is the result card): catch chat up with the final darts.
    streamingApi.match(saveId, matchId, false).then(async s => {
      setState(s); if (s.session) setChat(s.session.chat);
      if (s.session?.status === "LIVE") { const c = await streamingApi.match(saveId, matchId, true); setState(c); if (c.events.length) setChat(x => [...x, ...c.events].slice(-120)); }
    }).catch(() => setState(null));
  }, [saveId, matchId]);
  const live = state?.session?.status === "LIVE";
  useEffect(() => {
    if (!live || tick === 0) return;
    streamingApi.match(saveId, matchId, true).then(s => { setState(s); if (s.events.length) setChat(c => [...c, ...s.events].slice(-120)); }).catch(e => setNote(errorMessage(e)));
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [chat, open]);
  if (!state || (!state.eligible && !state.session)) return null;
  const start = () => streamingApi.match(saveId, matchId, true).then(s => { setState(s); setChat(s.session?.chat ?? []); }).catch(e => setNote(errorMessage(e)));
  const s = state.session;
  return (
    <div className="dc-match" data-open={open || undefined}>
      {!s ? <button type="button" className="dc-match__chip" onClick={start}><Radio aria-hidden /> Stream this match on DartCast</button>
        : <button type="button" className="dc-match__chip" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            <span className="dc__badge" data-live={live || undefined}>{live ? "LIVE" : "ENDED"}</span> <Eye aria-hidden /> {s.tally.viewers.toLocaleString("en-GB")}
            {open ? <X aria-hidden /> : null}</button>}
      {s && open && <div className="dc-match__panel" aria-label="DartCast chat">
        <ol ref={box} aria-live="polite">{chat.map((e, i) => <Line key={i} e={e} />)}</ol>
        {!live && <p className="dc__note">Stream over: +{s.followersGained ?? 0} followers, {formatPence(s.incomePence ?? 0)} in cheers.</p>}
      </div>}
      {note && <p className="dc__warn" role="alert">{note}</p>}
    </div>
  );
}
