import { Award, HeartHandshake, PartyPopper, Swords, Timer, Trophy } from "lucide-react";
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
      <div><span className="sc-eyebrow"><b>06</b> / CREATOR CUPS · 4 A SEASON</span><h2 id="cups-title">{cup ? cup.name : "Creator Cups"}</h2>
        <p>{cup ? `One night, ${cup.size} creators around your size, knockout. First to ${cup.legsToWin} legs, the final first to ${cup.finalLegsToWin}. Extra to your stream nights.`
          : d.cups.next ? `Next up: the ${d.cups.next.name}, from week ${d.cups.next.opens}. Brackets of 8, or 16 once you're a Partner.` : "That's this season's cups done. They're back next season."}</p></div>
      <div className="sc-stats"><span><Trophy aria-hidden /> <span><b>{d.cups.trophies}</b> cup{d.cups.trophies === 1 ? "" : "s"} won</span></span></div>
    </div>
    {d.cups.season && <ol className="sc-cup-season" aria-label="This season's cups">{d.cups.season.map(c => <li key={c.n} data-status={c.status}>
      <Trophy aria-hidden /><b>{c.name}</b><small>Week {c.opens}</small><em>{{ WON: "Won", PLAYED: "Played", OPEN: "On now", UPCOMING: "Coming up", MISSED: "Missed" }[c.status]}</em></li>)}</ol>}
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

/** The season's big nights: the Subathon and the Charity Marathon (once a season each), and the Creator Awards. */
export function BigNightsSection({ d, night, canGo, busy, onGo }: { d: StreamingView; night: number | null; canGo: boolean; busy: boolean; onGo: (f: StreamFormat) => void }) {
  if (!d.marathons || !d.awards) return null;
  const latest = d.awards.seasons[0];
  return <section className="sc-panel" id="big-nights" aria-labelledby="big-nights-title">
    <div className="sc-head"><div><span className="sc-eyebrow"><b>07</b> / BIG NIGHTS · ONCE A SEASON</span><h2 id="big-nights-title">Big nights</h2>
      <p>Marathon streams against viewer after viewer on a clock, and the Creator Awards at the end of every season.</p></div>
      <div className="sc-stats"><span><Award aria-hidden /> <span><b>{d.awards.trophies}</b> award{d.awards.trophies === 1 ? "" : "s"} won</span></span></div></div>
    <div className="sc-nights">
      <article><Timer aria-hidden /><div><b>Subathon</b><small>Game after game of one-leg 501 on a timer. Subs, super chats and cheers add time, and support goals unlock as you go. Losing a leg never ends it.</small></div>
        {d.marathons.subathon.open ? <button type="button" disabled={!canGo || busy} onClick={() => onGo("SUBATHON")}>Start the subathon{night ? ` on ${dayLabel(night)}` : ""}</button> : <em>{d.marathons.subathon.why}</em>}</article>
      <article><HeartHandshake aria-hidden /><div><b>Charity Marathon</b><small>The same clock, but every cheer goes to the cause and creators chip in as the total climbs. Target: {formatPence(d.marathons.marathon.targetPence)}.</small></div>
        {d.marathons.marathon.open ? <button type="button" disabled={!canGo || busy} onClick={() => onGo("MARATHON")}>Start the marathon{night ? ` on ${dayLabel(night)}` : ""}</button> : <em>{d.marathons.marathon.why}</em>}</article>
    </div>
    <div className="sc-awards"><h3><Award aria-hidden /> Creator Awards {latest ? `· Season ${latest.season}` : ""}</h3>
      {latest ? <ul>{latest.results.map(r => <li key={r.award} data-won={r.youWon || undefined} data-nom={r.youNominated || undefined}>
        <b>{r.name}</b><small>{r.youWon ? "🏆 You won!" : `Winner: ${r.winner}${r.youNominated ? " · you were nominated" : ""}`}</small></li>)}</ul>
        : <p className="sc-note">Held at the end of every season (week {d.awards.nextAt}). Eight categories, judged on your season against the whole scene.</p>}
    </div>
  </section>;
}
