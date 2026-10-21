import { useState, type CSSProperties } from "react";
import {
  Activity, Check, Crosshair, Crown, Eye, HeartHandshake, Radio, Search,
  Target, TrendingUp, Trophy, Users, ArrowUpRight, RadioTower, Sparkles,
} from "lucide-react";
import "./_group.css";
import "./DartCast.css";

type StreamFormat = "CHALLENGER" | "KING" | "CHECKOUTS" | "BOBS_27" | "SCORING" | "CHARITY" | "INVITATIONAL" | "COLLAB";

const d = {
  season: 2, week: 9, currentWeek: 9, handle: "AyrDarts", followers: 1450,
  tier: { key: "PARTNER", name: "Partner" }, next: { name: "Star", followers: 25000 },
  tiers: [
    { key: "NEWCOMER", name: "Newcomer", followers: 0, perks: "Go live and build an audience.", reached: true },
    { key: "AFFILIATE", name: "Affiliate", followers: 50, perks: "Viewers can cheer with bits and send super chats.", reached: true },
    { key: "PARTNER", name: "Partner", followers: 1000, perks: "Viewers can subscribe (£2.50 a month, half to you), and brands start to notice.", reached: true },
    { key: "STAR", name: "Star", followers: 25000, perks: "A household name in darts streaming: the biggest audiences and the biggest tips.", reached: false },
  ],
  streamsThisWeek: 1, perWeek: 3, freeNights: [2, 4, 5, 6],
  pathway: { focus: "DARTCAST" as "OPEN" | "DARTCAST", weeklyFrequency: 2, scheduledNights: [2, 5] },
  totals: { streams: 14, earnedPence: 18450, won: 9 }, subscribers: 14, renewsWeek: 12,
  dealOffer: { id: "local-deal", brand: "FlightDeck", what: "flights and stems", perStreamPence: 6900, streamsTotal: 6, expiresWeek: 13 },
  deal: { brand: "Oche Energy", perStreamPence: 4200, streamsDone: 2, streamsTotal: 6 },
  invitations: false,
  formats: [
    { key: "CHALLENGER" as StreamFormat, name: "Play a viewer", blurb: "Viewer steps up. First to 2 legs of 501.", crowd: 1 },
    { key: "KING" as StreamFormat, name: "King of the Oche", blurb: "One leg against viewer after viewer, up to 5. One loss and you're dethroned.", crowd: 1.25 },
    { key: "CHECKOUTS" as StreamFormat, name: "Checkout Challenge", blurb: "Chat picks 5 finishes. Three visits each; hit 3 to win.", crowd: .9 },
    { key: "BOBS_27" as StreamFormat, name: "Bob's 27 live", blurb: "Every double from 1 to bull, starting on 27. Don't drop to zero.", crowd: .8 },
    { key: "SCORING" as StreamFormat, name: "Average challenge", blurb: "33 visits of scoring against a target average. Chat pledges bits that pay only if you beat it.", crowd: .9 },
    { key: "CHARITY" as StreamFormat, name: "Charity stream", blurb: "Viewer match for a good cause. Bits and super chats go to charity; generous crowds, fans remember it. Once a month.", crowd: 1.1 },
  ],
  pollPick: "KING" as StreamFormat, lastFormat: "BOBS_27" as StreamFormat,
  subGoal: { season: 2, endsWeek: 12, target: 20, promise: "A Bob's 27 stream", progress: 11, status: "ON" },
  goalOptions: { targets: [5, 10, 20, 50], promises: ["A Bob's 27 stream", "Throw in fancy dress", "A charity night", "Answer every question in chat", "Play left-handed for a leg"] },
  invitational: {
    open: false, why: "For Partners and Stars", fromWeek: 40,
    field: [
      { handle: "TheOcheShow", followers: 95000, avg: 80 }, { handle: "NineDartNick", followers: 50000, avg: 82 },
      { handle: "ShanghaiSam", followers: 27000, avg: 75 }, { handle: "ArrowsAndAle", followers: 5800, avg: 61 },
      { handle: "CheckoutQueen", followers: 3400, avg: 66 }, { handle: "BullseyeBarry", followers: 1700, avg: 52 },
      { handle: "TungstenTomTV", followers: 950, avg: 58 },
    ],
    prizePence: [25000, 75000, 150000, 400000], result: null as { wins: number; prizePence: number } | null,
  },
  charity: { raisedPence: 12500 },
  collabs: [
    { key: "checkout-cleo", handle: "CheckoutCleo", followers: 3300, avg: 66, blurb: "Any finish in nine. Never misses a chance to celebrate a checkout.", ok: true, why: null },
    { key: "double-dan", handle: "DoubleTroubleDan", followers: 680, avg: 48, blurb: "Pub player, all heart, can't find a double.", ok: true, why: null },
    { key: "the-oche-show", handle: "TheOcheShow", followers: 95000, avg: 80, blurb: "The biggest darts channel on DartCast.", ok: false, why: "Too big for you yet" },
  ],
  clips: [
    { id: "clip-1", season: 2, week: 8, title: "NINE-DARTER LIVE ON STREAM", status: "VIRAL" as "VIRAL" | "NEW" | "SETTLED", views: 182000, followersGained: 2900, fansGained: 5800 },
    { id: "clip-2", season: 2, week: 9, title: "Maximum!", status: "NEW" as "VIRAL" | "NEW" | "SETTLED", views: 0, followersGained: 0, fansGained: 0 },
  ],
  videos: [
    { id: "video-1", season: 2, week: 8, dayOfWeek: 6, format: "CHALLENGER" as StreamFormat, title: "Stream vs OcheGremlin12", challenger: "OcheGremlin12", result: "WON" as "WON" | "LOST" | null, peak: 41, followersGained: 12, incomePence: 2350 },
    { id: "video-2", season: 2, week: 7, dayOfWeek: 4, format: "KING" as StreamFormat, title: "King of the Oche", challenger: "TungstenKev28", result: "LOST" as "WON" | "LOST" | null, peak: 36, followersGained: 7, incomePence: 1680 },
    { id: "video-3", season: 2, week: 6, dayOfWeek: 2, format: "BOBS_27" as StreamFormat, title: "Bob's 27 live", challenger: "DartCast", result: null as "WON" | "LOST" | null, peak: 29, followersGained: 5, incomePence: 1200 },
  ],
};

const dayLabel = (day: number) => ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day] ?? "";
const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const nfmt = (n: number) => n.toLocaleString("en-GB");
const crowdLabel = (crowd: number) => crowd >= 1.15 ? "Big crowd" : crowd >= .95 ? "Normal crowd" : crowd >= .8 ? "Smaller crowd" : "Quiet night";

function FormatIcon({ format }: { format: StreamFormat }) {
  switch (format) {
    case "CHALLENGER": return <Target aria-hidden />;
    case "KING": return <Crown aria-hidden />;
    case "CHECKOUTS": return <Crosshair aria-hidden />;
    case "BOBS_27": return <Activity aria-hidden />;
    case "SCORING": return <TrendingUp aria-hidden />;
    case "CHARITY": return <HeartHandshake aria-hidden />;
    default: return <Radio aria-hidden />;
  }
}

export function DartCast() {
  const [focus, setFocus] = useState<"OPEN" | "DARTCAST">(d.pathway.focus);
  const [frequency, setFrequency] = useState(d.pathway.weeklyFrequency);
  const [format, setFormat] = useState<StreamFormat | null>(null);
  const [night, setNight] = useState<number | null>(d.pathway.scheduledNights[0]);
  const [goalTarget, setGoalTarget] = useState<number | null>(null);
  const [promise, setPromise] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [dealState, setDealState] = useState<"pending" | "accepted" | "declined">("pending");
  const streamDays = d.pathway.scheduledNights.length ? d.pathway.scheduledNights : d.freeNights;
  const pick = night !== null && streamDays.includes(night) ? night : streamDays[0] ?? null;
  const chosen = format ?? d.pollPick;
  const progress = Math.min(100, Math.round(d.followers / d.next.followers * 100));
  const goalThisMonth = d.subGoal.season === d.season && d.subGoal.endsWeek >= d.week;
  const localAction = (action: string) => setMessage(`${action} is a local preview interaction; no Career data is changed.`);

  return (
    <main className="dc-redesign">
      <header className="dcr-topbar">
        <div className="dcr-brand"><span className="dcr-brand-icon"><RadioTower /></span><span>DART<span>CAST</span></span><i>CAREER NETWORK</i></div>
        <div className="dcr-search"><Search /><span>Search darts streams</span></div>
        <div className="dcr-week">SEASON {d.season} <b>—</b> WEEK {d.week}</div>
      </header>

      <section className="dcr-hero">
        <div className="dcr-hero-lines" aria-hidden="true" />
        <div className="dcr-hero-identity">
          <div className="dcr-onair"><i /> DARTCAST CAREER <span>{d.tier.name.toUpperCase()} CHANNEL</span></div>
          <div className="dcr-ident-row"><div className="dcr-avatar">AD<span /></div><div><h1>{d.handle}</h1><div className="dcr-ident-meta"><b>{d.tier.name.toUpperCase()}</b><span>YOUR CAREER CHANNEL</span></div></div></div>
          <div className="dcr-audience-caption"><span>FOLLOWER MILESTONE</span><i /><span>SEASON {d.season} · WEEK {d.week}</span></div>
        </div>
        <div className="dcr-audience">
          <div className="dcr-audience-rings" aria-hidden="true"><i /><i /><i /><span><b>{nfmt(d.followers)}</b><small>FOLLOWERS</small></span></div>
          <div className="dcr-audience-side"><div className="dcr-audience-label"><i /> PARTNER → STAR</div><div className="dcr-audience-progress"><span>STAR TIER</span><div><i style={{ width: `${progress}%` }} /></div><b>{progress}%</b></div><small className="dcr-audience-remaining">{nfmt(d.next.followers - d.followers)} TO NEXT TIER</small></div>
        </div>
        <div className="dcr-scorebar">
          <div><small>CAREER STREAMS</small><b>{d.totals.streams}</b></div><div><small>CAREER EARNED</small><b>{money(d.totals.earnedPence)}</b></div><div><small>CHALLENGERS BEATEN</small><b>{d.totals.won}</b></div>
          <span className="dcr-scorebar-mark">D<span>C</span></span>
        </div>
      </section>

      <section className="dcr-studio">
        <div className="dcr-studio-kicker"><span>01</span> BROADCAST CONTROL <i /></div>
        <div className="dcr-studio-grid">
          <section className="dcr-panel dcr-route">
            <div className="dcr-panel-title"><span className="dcr-index">01 / PATHWAY</span><span className={`dcr-route-status ${focus === "DARTCAST" ? "on" : ""}`}><i />{focus === "DARTCAST" ? "FOCUS ON" : "AVAILABLE"}</span></div>
            <h2>Build the<br /><em>channel.</em></h2>
            {focus === "DARTCAST" ? <>
              <div className="dcr-route-dial"><div className="dcr-route-icon"><RadioTower /></div><div><b>DARTCAST ROUTE</b><span>Stream alongside your darts career.</span></div><span className="dcr-route-check"><Check /></span></div>
              <div className="dcr-schedule-control"><label htmlFor="frequency">SCHEDULE PER WEEK</label><select id="frequency" value={frequency} onChange={e => setFrequency(Number(e.target.value))}>{[1, 2, 3].map(n => <option key={n} value={n}>{n} night{n === 1 ? "" : "s"}</option>)}</select></div>
              <div className="dcr-reserved"><small>RESERVED NIGHTS</small><strong>{d.pathway.scheduledNights.map(dayLabel).join(" / ")}</strong></div>
              <button className="dcr-text-button" onClick={() => { setFocus("OPEN"); localAction("Route update"); }}>Stop pursuing route <ArrowUpRight /></button>
            </> : <><p className="dcr-route-note">Reserve free nights for streams. Start each show when you choose.</p><button className="dcr-primary" onClick={() => { setFocus("DARTCAST"); localAction("Route update"); }}>Pursue streamer route <ArrowUpRight /></button></>}
          </section>

          <section className="dcr-panel dcr-money">
            <div className="dcr-panel-title"><span className="dcr-index">02 / CHANNEL ECONOMY</span><span className="dcr-money-symbol">£</span></div>
            <h2>Audience<br /><em>pays back.</em></h2>
            <div className="dcr-money-rail"><div><small>SUBS</small><b>{nfmt(d.subscribers)}</b></div><i /><div><small>RENEW WK</small><b>{d.renewsWeek}</b></div><i /><div><small>IF ALL STAY</small><b>{money(Math.round(d.subscribers * 125))}</b></div></div>
            <div className="dcr-money-note">Renew monthly · stream at least once to keep subscribers.</div>
            {dealState === "pending" ? <div className="dcr-offer">
              <div className="dcr-offer-top"><span>OFFER / REPLY BY WEEK {d.dealOffer.expiresWeek}</span><b>NEW</b></div>
              <div className="dcr-offer-body"><div><strong>{d.dealOffer.brand}</strong><small>{d.dealOffer.what} · {d.dealOffer.streamsTotal} streams</small></div><b>{money(d.dealOffer.perStreamPence)}<small>PER STREAM</small></b></div>
              <div className="dcr-offer-actions"><button className="dcr-primary" onClick={() => { setDealState("accepted"); localAction("Take the deal"); }}>Take offer</button><button className="dcr-text-button" onClick={() => { setDealState("declined"); localAction("Brand offer response"); }}>Pass</button></div>
            </div> : <div className="dcr-response"><Check /> OFFER {dealState.toUpperCase()}<button onClick={() => setDealState("pending")}>UNDO</button></div>}
            <div className="dcr-deal-footer"><div><small>ACTIVE · {d.deal.brand}</small><b>{money(d.deal.perStreamPence)} <i>/ STREAM</i></b><span className="dcr-deal-track"><i style={{ width: `${d.deal.streamsDone / d.deal.streamsTotal * 100}%` }} /></span><small>{d.deal.streamsDone} / {d.deal.streamsTotal} DELIVERED</small></div><div><small>CHARITY RAISED</small><b>{money(d.charity.raisedPence)}</b></div></div>
          </section>

          <section className="dcr-panel dcr-goal">
            <div className="dcr-panel-title"><span className="dcr-index">03 / CHAT CHALLENGE</span><Sparkles /></div>
            <h2>Make a<br /><em>promise.</em></h2>
            <div className="dcr-goal-visual"><div className="dcr-goal-slice" style={{ "--goal": `${d.subGoal.progress / d.subGoal.target * 100}%` } as CSSProperties}><b>{Math.round(d.subGoal.progress / d.subGoal.target * 100)}<small>%</small></b></div><div><small>MONTHLY TARGET · TO WK {d.subGoal.endsWeek}</small><strong>{d.subGoal.progress}<i> / {d.subGoal.target} SUBS</i></strong><span>{d.subGoal.promise}</span></div></div>
            {!goalThisMonth && <div className="dcr-set-goal"><span>GOAL TARGET</span><div className="dcr-choice-row" role="radiogroup" aria-label="Sub target">{d.goalOptions.targets.map(t => <button key={t} role="radio" aria-checked={goalTarget === t} onClick={() => setGoalTarget(t)}>{t}</button>)}</div><span>YOUR PROMISE</span><div className="dcr-promise-options" role="radiogroup" aria-label="Your promise">{d.goalOptions.promises.map(p => <button key={p} role="radio" aria-checked={promise === p} onClick={() => setPromise(p)}>{p}</button>)}</div><button className="dcr-primary" disabled={goalTarget === null || promise === null} onClick={() => localAction("Sub goal")}>Set monthly goal</button></div>}
            <small className="dcr-goal-rule">HIT IT: audience buzz earns followers.</small>
          </section>
        </div>
      </section>

      <section className="dcr-onair-stage">
        <div className="dcr-stage-top"><div><span className="dcr-index">02 / BROADCAST STAGE</span><span className="dcr-stage-lamp"><i /> READY WHEN YOU ARE</span></div><div className="dcr-stage-week">S{d.season}<b>W{d.week}</b></div></div>
        <div className="dcr-stage-heading"><h2>Own the<br /><em>moment.</em></h2><div className="dcr-stage-note"><b>{d.streamsThisWeek}<i> / {d.perWeek}</i></b><span>SHOWS THIS WEEK</span><small>A stream books its night. No event can be scheduled over it.</small></div></div>
        <div className="dcr-format-heading"><span>CHOOSE A SHOW FORMAT</span><span>CHAT'S PICK <b>{d.formats.find(item => item.key === d.pollPick)?.name}</b></span></div>
        <div className="dcr-formats" role="radiogroup" aria-label="What to stream">{d.formats.map((item, i) => <button key={item.key} type="button" role="radio" aria-checked={chosen === item.key} className="dcr-format" data-format={item.key} onClick={() => setFormat(item.key)}>
          <span className="dcr-format-count">0{i + 1}</span><span className="dcr-format-icon"><FormatIcon format={item.key} /></span><span className="dcr-format-copy"><b>{item.name}</b><span>{item.blurb}</span><small>{crowdLabel(item.crowd)}{d.lastFormat === item.key ? " · last played" : ""}{d.pollPick === item.key ? " · chat's pick" : ""}</small></span><i className="dcr-format-check">{chosen === item.key ? <Check /> : null}</i>
        </button>)}</div>
        <div className="dcr-stage-footer"><div><span>FREE NIGHTS</span><div className="dcr-nights" role="radiogroup" aria-label="Night to stream">{streamDays.map(day => <button key={day} role="radio" aria-checked={pick === day} onClick={() => setNight(day)}><b>{dayLabel(day)}</b><small>{d.pathway.scheduledNights.includes(day) ? "SET" : "FREE"}</small></button>)}</div></div><button className="dcr-primary dcr-go-live" onClick={() => localAction(`Go live on ${pick ? dayLabel(pick) : "a free night"}`)}><Radio /> GO LIVE <i>{pick ? dayLabel(pick) : ""}</i><ArrowUpRight /></button></div>
        <div className="dcr-stage-rules"><span><Eye /> Chat reacts to every visit</span><span><Check /> Show books the night</span><span>501 / visit-based formats</span></div>
        {message && <p className="dcr-feedback" role="status">{message}</p>}
      </section>

      <section className="dcr-circuit">
        <div className="dcr-circuit-title"><span>03</span><h2>On the circuit</h2><i /></div>
        <section className="dcr-panel dcr-invitational">
          <div className="dcr-panel-title"><span className="dcr-index">SEASONAL SHOWDOWN</span><span className="dcr-lock">WEEK {d.invitational.fromWeek}+</span></div><h2>Top seven.<br /><em>One winner.</em></h2>
          <div className="dcr-invite-rule"><Trophy /><span>Once a season · knockout · first to 2 legs</span></div>
          <div className="dcr-prizes">{d.invitational.prizePence.map((amt, i) => <div key={amt}><small>{["QF", "SF", "FINAL", "WINNER"][i]}</small><b>{money(amt)}</b></div>)}</div>
          <div className="dcr-field-head"><span>ENTRY FIELD</span><small>FOLLOWERS / AVERAGE</small></div>
          <ol className="dcr-field">{d.invitational.field.map((s, i) => <li key={s.handle}><span>{String(i + 1).padStart(2, "0")}</span><b>{s.handle}</b><small>{nfmt(s.followers)} / {s.avg}</small></li>)}</ol>
          {d.invitational.result ? <div className="dcr-locked-note"><span>RESULT</span><b>You won {d.invitational.result.wins} matches · {money(d.invitational.result.prizePence)}</b></div> : d.invitational.open ? <button className="dcr-primary" onClick={() => localAction(`Play the Invitational on ${pick ? dayLabel(pick) : "a free night"}`)}>Play the Invitational <ArrowUpRight /></button> : <div className="dcr-locked-note"><span>LOCKED</span><b>{d.invitational.why}</b></div>}
        </section>
        <section className="dcr-panel dcr-collabs">
          <div className="dcr-panel-title"><span className="dcr-index">CROSS-CHANNEL BROADCAST</span><Users /></div><h2>Bring a<br /><em>guest.</em></h2>
          <div className="dcr-collab-rulebar"><span>SIMILAR SIZE</span><span>ONCE / SEASON</span>{pick && <span>OUT · {dayLabel(pick)}</span>}</div>
          <ul className="dcr-collab-list">{d.collabs.map(c => <li key={c.key} data-ready={c.ok}><div className="dcr-collab-avatar">{c.handle.slice(0, 2).toUpperCase()}</div><div className="dcr-collab-info"><b>{c.handle}</b><small>{nfmt(c.followers)} followers · avg {c.avg}</small><span>{c.blurb}</span></div>{c.ok ? <button onClick={() => localAction(`Collab with ${c.handle}`)}>Invite <ArrowUpRight /></button> : <em>{c.why}</em>}</li>)}</ul>
          <small className="dcr-collab-rule">Both channels go live. Winner takes a share of the other audience.</small>
        </section>
      </section>

      <section className="dcr-archive">
        <div className="dcr-archive-head"><div><span className="dcr-index">04 / MOMENTS THAT TRAVEL</span><h2>Highlights & <em>replays.</em></h2></div><span className="dcr-archive-mark"><RadioTower /> DARTCAST VAULT</span></div>
        <div className="dcr-archive-columns">
          <section className="dcr-clips"><div className="dcr-subhead"><b>CLIPS</b><span>{d.clips.length} MOMENTS</span></div><ul>{d.clips.map((clip, i) => <li key={clip.id}><div className={`dcr-clip-art clip-${i + 1}`}><span className="dcr-clip-reticle" /><span className="dcr-clip-week">S{clip.season} / WK {clip.week}</span>{clip.status === "VIRAL" && <b className="dcr-viral">VIRAL</b>}<strong>{clip.title}</strong></div><div className="dcr-clip-stats"><b>{clip.status === "NEW" ? "OUT THIS WEEK" : `${nfmt(clip.views)} VIEWS`}</b>{clip.followersGained ? <span>+{nfmt(clip.followersGained)} followers · +{nfmt(clip.fansGained)} fans</span> : <span>Viral result pending</span>}</div></li>)}</ul></section>
          <section className="dcr-videos"><div className="dcr-subhead"><b>PAST SHOWS</b><span>{d.videos.length} REPLAYS</span></div><ul>{d.videos.map(video => <li key={video.id}><div className={`dcr-video-thumb result-${video.result ?? "ENDED"}`}><span className="dcr-video-rings" /><b>{video.format === "CHALLENGER" ? `VS ${video.challenger}` : video.title.toUpperCase()}</b><em>{video.result === "WON" ? "WON" : video.result === "LOST" ? "LOST" : "ENDED"}</em></div><div className="dcr-video-info"><b>{video.result === "WON" && <Trophy />}{video.title}</b><small>S{video.season} · WK {video.week} · {dayLabel(video.dayOfWeek)}</small><div><span><Eye /> {video.peak} peak</span><span><Users /> +{video.followersGained}</span><strong>{money(video.incomePence)}</strong></div></div></li>)}</ul></section>
        </div>
      </section>

      <section className="dcr-tier-track">
        <div className="dcr-tier-track-head"><div><span className="dcr-index">05 / THE LONG GAME</span><h2>Climb the<br /><em>broadcast ladder.</em></h2></div><div className="dcr-next"><b>{nfmt(d.next.followers - d.followers)}</b><span>TO STAR</span></div></div>
        <div className="dcr-ladder-line"><span>START</span><i style={{ "--width": `${progress}%` } as CSSProperties}><b style={{ left: `${progress}%` }} /></i><span>STAR</span></div>
        <ol className="dcr-tier-list">{d.tiers.map((tier, i) => <li key={tier.key} data-reached={tier.reached}><div className="dcr-tier-number">{tier.reached ? <Check /> : `0${i + 1}`}</div><div><b>{tier.name}</b><small>{tier.followers ? `${nfmt(tier.followers)} FOLLOWERS` : "START HERE"}</small><p>{tier.perks}</p></div><span>{tier.reached ? "CLEARED" : "NEXT UP"}</span></li>)}</ol>
      </section>
      <footer className="dcr-footer"><span>DARTCAST <b>CAREER NETWORK</b></span><span>YOUR CHANNEL. YOUR STORY. YOUR NEXT LEG.</span></footer>
    </main>
  );
}
