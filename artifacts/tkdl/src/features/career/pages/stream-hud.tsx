import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Siren, ChevronUp, Eye, Flame, Inbox, Target, TrainFront, X } from "lucide-react";
import { errorMessage, streamingApi, useStreaming, type ChatEvent, type StreamSession } from "../api";
import { formatPence } from "../model";
import { hudAlertText, isHudAlert } from "./stream-hud-model";
import "./stream-hud.css";

/**
 * The stream's on-screen overlay, built like a real broadcast's so nothing important is lost in fast chat:
 * - a compact chip beside Minimise (live, viewers, hype train level, and a pulsing pill when a request is waiting);
 * - alerts (hype train, requests, upsets, milestones, subs) take over the chip for a moment, one at a time, so they
 *   never cover the scores or the keypad;
 * - tap the chip for the tray: meters (hype, hype train, goal), chat's call on this leg, the request card (Accept or
 *   Skip), the challenge you're on, and the latest chat.
 * Requests only arrive between legs, so answering never interrupts a visit.
 */
export function StreamHud({ session, chat, fresh, onAnswer, answering, inline, children }: {
  session: StreamSession; chat: ChatEvent[]; fresh: ChatEvent[]; onAnswer: (accept: boolean) => void; answering?: boolean;
  /** Render in the page flow (a drill stream, no scorer stage) instead of floating beside Minimise. */ inline?: boolean;
  /** Extra tray content (e.g. the stream's own controls). */ children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<ChatEvent[]>([]);
  const box = useRef<HTMLOListElement>(null);
  const seen = useRef<ChatEvent[] | null>(null);
  // New alerts join the queue (the latest few), shown one at a time.
  useEffect(() => {
    if (seen.current === fresh) return; seen.current = fresh;
    const add = fresh.filter(isHudAlert);
    if (add.length) setQueue(q => [...q, ...add].slice(-4));
  }, [fresh]);
  useEffect(() => { if (!queue.length) return; const t = setTimeout(() => setQueue(q => q.slice(1)), 2600); return () => clearTimeout(t); }, [queue]);
  useEffect(() => { if (open) box.current?.scrollTo({ top: box.current.scrollHeight }); }, [chat, open]);
  const t = session.tally, ov = t.ov ?? {}, live = session.status === "LIVE";
  const req = ov.request ?? null, offer = req?.status === "OFFERED" ? req : null, active = req?.status === "ACTIVE" ? req : null;
  const train = ov.train && ov.train.level > 0 ? ov.train : null;
  const current = queue[0];
  const hypePct = Math.round(Math.min(3, t.hype) / 3 * 100);
  return <div className={`dc-hud ${inline ? "dc-hud--inline" : ""}`} data-open={open || undefined}>
    <button type="button" className="dc-hud__chip" data-alert={current ? (current.kind === "ALERT" ? current.alert : current.kind) : undefined} data-offer={offer ? true : undefined}
      onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={open ? "Hide stream overlay" : "Show stream overlay"}>
      {current ? <span className="dc-hud__alert" role="status">{hudAlertText(current)}</span> : <>
        {offer || active ? <span className="sr-only">{live ? "Live" : "Ended"}</span> : <span className="dc__badge" data-live={live || undefined}><i aria-hidden />{live ? "LIVE" : "ENDED"}</span>}
        <span className="dc-hud__stat"><Eye aria-hidden />{t.viewers.toLocaleString("en-GB")}</span>
        {train && <span className="dc-hud__stat dc-hud__stat--train"><TrainFront aria-hidden />{train.level}</span>}
        {offer ? <span className="dc-hud__pill"><Inbox aria-hidden /> Request</span> : active ? <span className="dc-hud__pill dc-hud__pill--active"><Target aria-hidden /> On it</span> : null}
      </>}
      {open ? <ChevronUp aria-hidden className="dc-hud__caret" /> : <ChevronDown aria-hidden className="dc-hud__caret" />}
    </button>
    {open && <div className="dc-hud__tray" role="region" aria-label="Stream overlay">
      <div className="dc-hud__meters">
        <Meter icon={<Flame aria-hidden />} label="Hype" value={hypePct} text={hypePct >= 70 ? "Buzzing" : hypePct >= 35 ? "Warm" : "Settling in"} />
        {session.tier !== "NEWCOMER" && <Meter icon={<TrainFront aria-hidden />} label={train ? `Hype train · level ${train.level}` : "Hype train"}
          value={train ? (train.level >= 5 ? 100 : train.progress) : Math.min(99, ov.train?.progress ?? 0)}
          text={train ? `${train.visitsLeft} visit${train.visitsLeft === 1 ? "" : "s"} to keep it going` : "Cheers in a row start it"} />}
        {session.goal && <Meter label={session.goal.label} value={Math.min(100, Math.round(session.goal.current / Math.max(1, session.goal.target) * 100))}
          text={`${session.goal.current.toLocaleString("en-GB")} / ${session.goal.target.toLocaleString("en-GB")}`} />}
      </div>
      {ov.prediction && ov.prediction.status === "OPEN" && <p className="dc-hud__call">Chat's call on leg {ov.prediction.leg}: <b>{ov.prediction.believe}%</b> back you to win it{ov.prediction.believe < 50 ? ". Prove them wrong!" : "."}</p>}
      {offer && <div className="dc-hud__request">
        <div><small><Inbox aria-hidden /> REQUEST FROM {offer.by.toUpperCase()}</small><b>{offer.label}</b>
          <span>{offer.unit === "VISITS" ? `Within ${offer.left} visits` : `Within ${offer.left} leg${offer.left === 1 ? "" : "s"}`} · {offer.rewardPence > 0 ? `${formatPence(offer.rewardPence)} in bits` : "for the hype"} · skip costs nothing</span></div>
        <div className="dc-hud__request-actions">
          <button type="button" className="dc-hud__accept" disabled={answering} onClick={() => onAnswer(true)}><Check aria-hidden /> Accept</button>
          <button type="button" className="dc-hud__skip" disabled={answering} onClick={() => onAnswer(false)}><X aria-hidden /> Skip</button>
        </div>
      </div>}
      {active && <div className="dc-hud__challenge"><Target aria-hidden /><div><small>CHALLENGE ON · FOR {active.by.toUpperCase()}</small><b>{active.label}</b>
        <span>{active.left} {active.unit === "VISITS" ? "visit" : "leg"}{active.left === 1 ? "" : "s"} left · {active.rewardPence > 0 ? formatPence(active.rewardPence) : "hype"}</span></div></div>}
      <ol ref={box} className="dc-hud__chat" aria-live="off">{chat.slice(-30).map((e, i) => <HudLine key={i} e={e} />)}</ol>
      {children}
    </div>}
  </div>;
}

function Meter({ icon, label, value, text }: { icon?: ReactNode; label: string; value: number; text: string }) {
  return <div className="dc-hud__meter"><span className="dc-hud__meter-label">{icon}{label}<small>{text}</small></span>
    <span className="dc-hud__bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span style={{ width: `${value}%` }} /></span></div>;
}

function HudLine({ e }: { e: ChatEvent }) {
  if (e.kind === "CHAT") return <li>{e.role && <i className="dc-chat__badge" data-role={e.role}>{e.role}</i>}<b>{e.user}</b> {e.text}</li>;
  if (e.kind === "ALERT") return <li className="dc-hud__chat-alert">{e.text}</li>;
  if (e.kind === "FOLLOW") return <li className="dc-hud__chat-note">{e.user} followed</li>;
  if (e.kind === "SUB") return <li className="dc-hud__chat-alert"><b>{e.user}</b> subscribed!</li>;
  if (e.kind === "SUPERCHAT") return <li className="dc-hud__chat-alert"><b>{e.user}</b> {formatPence(e.pence)} · {e.text}</li>;
  return <li className="dc-hud__chat-alert"><b>{e.user}</b> cheered {e.pence} bits</li>;
}

/** The recap line(s) for a finished stream. */
export function RecapList({ session }: { session: StreamSession }) {
  const r = session.tally.ov?.recap;
  if (!r) return null;
  const items = [
    r.topChatter && `Top chatter: ${r.topChatter}`,
    r.requestsTried > 0 && `Requests: ${r.requestsDone} of ${r.requestsTried} done`,
    r.trainBest > 0 && `Best hype train: level ${r.trainBest}`,
    r.legsCalled > 0 && `Chat called ${r.legsCalled} leg${r.legsCalled === 1 ? "" : "s"}${r.upsets ? ` · ${r.upsets} upset${r.upsets === 1 ? "" : "s"}!` : ""}`,
    session.tally.clip && "Your best moment was clipped",
  ].filter(Boolean) as string[];
  return items.length ? <ul className="dc-hud__recap">{items.map(i => <li key={i}>{i}</li>)}</ul> : null;
}

/**
 * End a stream like real creators do: send your audience to another creator. It builds the friendship, and they may
 * raid you back one night. Suggests your friends first, then channels around your size.
 */
export function RaidPicker({ saveId, session, onRaided }: { saveId: string; session: StreamSession; onRaided: (s: StreamSession) => void }) {
  const q = useStreaming(saveId), [busy, setBusy] = useState(false), [note, setNote] = useState("");
  const out = session.tally.ov?.raidOut, inn = session.tally.ov?.raidIn;
  const d = q.data;
  const header = inn ? <p className="dc__note">{inn.handle} raided you with {inn.viewers} viewers tonight.</p> : null;
  if (out) return <>{header}<p className="dc__note dc-raid__done"><Siren aria-hidden className="dc-raid__icon" /> You raided {out.handle} with {out.viewers} viewer{out.viewers === 1 ? "" : "s"}.</p></>;
  if (!d || session.status !== "ENDED" || session.processedVisits === 0 || session.season !== d.season || session.week !== d.currentWeek) return header;
  const me = Math.max(1, d.followers), dist = (f: number) => Math.abs(Math.log(Math.max(1, f) / me));
  const picks = [...(d.scene?.creators ?? [])].sort((a, b) => Number(b.relationship !== "NEW") - Number(a.relationship !== "NEW") || dist(a.followers) - dist(b.followers)).slice(0, 6);
  if (!picks.length) return header;
  const raid = (key: string) => { setBusy(true); streamingApi.raid(saveId, session.id, key).then(onRaided).catch(e => setNote(errorMessage(e))).finally(() => setBusy(false)); };
  return <div className="dc-raid">
    {header}
    <h3><Siren aria-hidden className="dc-raid__icon" /> Raid someone?</h3>
    <p className="dc__note">Send your {session.tally.viewers} viewer{session.tally.viewers === 1 ? "" : "s"} to another creator. Creators remember: they may raid you back.</p>
    <ul>{picks.map(c => <li key={c.key}><div><b>{c.handle}</b><small>{c.followers.toLocaleString("en-GB")} followers · {c.relationship === "NEW" ? "not met yet" : c.relationship.toLowerCase()}</small></div>
      <button type="button" disabled={busy} onClick={() => raid(c.key)}>Raid</button></li>)}</ul>
    {note && <p className="dc__warn" role="alert">{note}</p>}
  </div>;
}
