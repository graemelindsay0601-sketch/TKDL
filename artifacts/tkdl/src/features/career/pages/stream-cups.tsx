import { PartyPopper, Swords, Trophy } from "lucide-react";
import type { StreamFormat, StreamingView } from "../api";
import { dayLabel, formatPence } from "../model";
import "./stream-community.css";

/**
 * Creator Cups: four one-night knockouts a season against creators your size (extra to your stream nights), your trophy
 * cabinet, and a celebration stream when you pass a follower milestone.
 */
export function CupsSection({ d, night, canGo, busy, onGo }: { d: StreamingView; night: number | null; canGo: boolean; busy: boolean; onGo: (f: StreamFormat) => void }) {
  if (!d.cups) return null;
  const cup = d.cups.current;
  return <section className="sc-panel" id="cups" aria-labelledby="cups-title">
    {d.celebration && <div className="sc-celebrate">
      <PartyPopper aria-hidden />
      <div><b>{d.celebration.milestone.toLocaleString("en-GB")} followers!</b><small>Throw a celebration stream: a big crowd, a party in chat and a milestone trophy for the channel. One per milestone.</small></div>
      <button type="button" disabled={!canGo || busy} onClick={() => onGo("CELEBRATION")}>Celebrate{night ? ` on ${dayLabel(night)}` : ""}</button>
    </div>}
    <div className="sc-head">
      <div><span className="sc-eyebrow">CREATOR CUPS · 4 A SEASON</span><h2 id="cups-title">{cup ? cup.name : "Creator Cups"}</h2>
        <p>{cup ? `One night, ${cup.size} creators around your size, knockout. First to ${cup.legsToWin} legs, the final first to ${cup.finalLegsToWin}. Extra to your stream nights.`
          : d.cups.next ? `Next up: the ${d.cups.next.name}, from week ${d.cups.next.opens}. Brackets of 8, or 16 once you're a Partner.` : "That's this season's cups done. They're back next season."}</p></div>
      <div className="sc-stats"><span><Trophy aria-hidden /> <span><b>{d.cups.trophies}</b> cup{d.cups.trophies === 1 ? "" : "s"} won</span></span></div>
    </div>
    {cup && <>
      {cup.callout && <blockquote className="sc-callout"><Swords aria-hidden /><div><b>{cup.callout.handle}</b> {cup.callout.text}</div></blockquote>}
      <div className="sc-cup-grid">
        <ol className="sc-field" aria-label="The field">{cup.field.map((f, i) => <li key={f.key} data-you={f.you || undefined}><span>{i + 1}</span><b>{f.you ? `${f.handle} (you)` : f.handle}</b><small>{f.followers.toLocaleString("en-GB")}{f.you ? "" : ` · avg ${f.avg}`}</small></li>)}</ol>
        <ul className="sc-prizes" aria-label="Prize money">{[...cup.prizes].reverse().map(p => <li key={p.round}><span>{p.round}</span><b>{formatPence(p.pence)}</b></li>)}</ul>
      </div>
      {cup.open ? <button className="sc-enter" type="button" disabled={!canGo || busy} onClick={() => onGo("CUP")}><Trophy aria-hidden /> Play the {cup.name}{night ? ` on ${dayLabel(night)}` : ""}</button>
        : <p className="sc-note">{cup.why}</p>}
      {cup.open && !canGo && <p className="sc-note">Pick a free night above (and finish any live stream) to play.</p>}
    </>}
    {d.cups.history.length > 0 && <div className="sc-trophies"><h3>Cup history</h3><ul>{d.cups.history.slice(0, 8).map(h => <li key={`${h.season}-${h.n}`} data-won={h.won || undefined}>
      <Trophy aria-hidden /><div><b>S{h.season} {h.name}</b><small>{h.won ? `Champion · ${formatPence(h.prizePence)}${h.fans ? ` · +${h.fans} fans` : ""}` : `${h.wins} win${h.wins === 1 ? "" : "s"} · won by ${h.champion}`}</small></div></li>)}</ul></div>}
  </section>;
}
