import { useState } from "react";
import {
  Activity, Check, Crosshair, Crown, Eye, HeartHandshake, Radio, Search,
  Target, TrendingUp, Trophy, Users, ChevronRight, Play, CalendarDays,
} from "lucide-react";
import "./ArenaNetwork.css";

type StreamFormat = "CHALLENGER" | "KING" | "CHECKOUTS" | "BOBS_27" | "SCORING" | "CHARITY";
const d = {
  season: 2, week: 9, handle: "AyrDarts", followers: 1450, tier: "Partner",
  totals: { streams: 14, earnedPence: 18450, won: 9 }, streamsThisWeek: 1, perWeek: 3,
  freeNights: [2, 4, 5, 6], scheduledNights: [2, 5], frequency: 2,
  subscribers: 14, renewsWeek: 12,
  dealOffer: { brand: "FlightDeck", what: "flights and stems", perStreamPence: 6900, streamsTotal: 6, expiresWeek: 13 },
  deal: { brand: "Oche Energy", perStreamPence: 4200, streamsDone: 2, streamsTotal: 6 },
  charity: { raisedPence: 12500 },
  formats: [
    { key: "CHALLENGER" as StreamFormat, name: "Play a viewer", blurb: "First to 2 legs of 501.", crowd: 1 },
    { key: "KING" as StreamFormat, name: "King of the Oche", blurb: "One leg against viewers, up to 5. One loss dethrones you.", crowd: 1.25 },
    { key: "CHECKOUTS" as StreamFormat, name: "Checkout Challenge", blurb: "Chat picks 5 finishes. Three visits each; hit 3 to win.", crowd: .9 },
    { key: "BOBS_27" as StreamFormat, name: "Bob's 27 live", blurb: "Every double from 1 to bull, starting on 27. Don't drop to zero.", crowd: .8 },
    { key: "SCORING" as StreamFormat, name: "Average challenge", blurb: "33 visits against a target average. Chat pledges bits only if you beat it.", crowd: .9 },
    { key: "CHARITY" as StreamFormat, name: "Charity stream", blurb: "Play a viewer for a good cause. All bits and super chats go to charity. Once a month.", crowd: 1.1 },
  ],
  pollPick: "KING" as StreamFormat, lastFormat: "BOBS_27" as StreamFormat,
  subGoal: { endsWeek: 12, target: 20, promise: "A Bob's 27 stream", progress: 11 },
  goalTargets: [5, 10, 20, 50],
  promises: ["A Bob's 27 stream", "Throw in fancy dress", "A charity night", "Answer every question in chat", "Play left-handed for a leg"],
  invitational: { fromWeek: 40, field: [
    ["TheOcheShow", 95000, 80], ["NineDartNick", 50000, 82], ["ShanghaiSam", 27000, 75],
    ["ArrowsAndAle", 5800, 61], ["CheckoutQueen", 3400, 66], ["BullseyeBarry", 1700, 52], ["TungstenTomTV", 950, 58],
  ] as [string, number, number][], prizes: [250, 750, 1500, 4000] },
  collabs: [
    { handle: "CheckoutCleo", followers: 3300, avg: 66, blurb: "Any finish in nine. Never misses a chance to celebrate a checkout.", ok: true },
    { handle: "DoubleTroubleDan", followers: 680, avg: 48, blurb: "Pub player, all heart, can't find a double.", ok: true },
    { handle: "TheOcheShow", followers: 95000, avg: 80, blurb: "The biggest darts channel on DartCast.", ok: false, why: "Too big for you yet" },
  ],
  clips: [
    { title: "NINE-DARTER LIVE ON STREAM", week: 8, status: "VIRAL", views: 182000, gained: 2900, fans: 5800 },
    { title: "Maximum!", week: 9, status: "NEW", views: 0, gained: 0, fans: 0 },
  ],
  videos: [
    { title: "Stream vs OcheGremlin12", format: "CHALLENGER", challenger: "OcheGremlin12", result: "WON", week: 8, day: 6, peak: 41, gained: 12, income: 2350 },
    { title: "King of the Oche", format: "KING", challenger: "TungstenKev28", result: "LOST", week: 7, day: 4, peak: 36, gained: 7, income: 1680 },
    { title: "Bob's 27 live", format: "BOBS_27", challenger: "DartCast", result: null, week: 6, day: 2, peak: 29, gained: 5, income: 1200 },
  ],
  tiers: [
    { name: "Newcomer", followers: 0, reached: true, perks: "Go live and build an audience." },
    { name: "Affiliate", followers: 50, reached: true, perks: "Viewers can cheer with bits and send super chats." },
    { name: "Partner", followers: 1000, reached: true, perks: "Subscriptions (£2.50 a month, half to you); brands start to notice." },
    { name: "Star", followers: 25000, reached: false, perks: "A household name: the biggest audiences and the biggest tips." },
  ],
};
const days = (n: number) => ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][n] ?? "";
const pounds = (p: number) => `£${(p / 100).toFixed(2)}`;
function FormatIcon({ format }: { format: StreamFormat }) {
  const icons = { CHALLENGER: Target, KING: Crown, CHECKOUTS: Crosshair, BOBS_27: Activity, SCORING: TrendingUp, CHARITY: HeartHandshake };
  const Icon = icons[format]; return <Icon aria-hidden />;
}

export function ArenaNetwork() {
  const [focus, setFocus] = useState(true);
  const [frequency, setFrequency] = useState(2);
  const [format, setFormat] = useState<StreamFormat>("KING");
  const [night, setNight] = useState<number | null>(2);
  const [goalTarget, setGoalTarget] = useState<number | null>(null);
  const [promise, setPromise] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [offerState, setOfferState] = useState("");
  const [goalSet, setGoalSet] = useState(false);
  const [collab, setCollab] = useState("");
  const streamDays = focus ? d.scheduledNights : d.freeNights;
  const chosenNight = night !== null && streamDays.includes(night) ? night : streamDays[0];
  const preview = (s: string) => setMessage(`${s} is a local preview interaction; no Career data is changed.`);
  return <main className="arena-page">
    <header className="an-topbar">
      <div className="an-brand"><Radio/><span>DART<span>CAST</span></span><i>CAREER NETWORK</i></div>
      <div className="an-search"><Search/><span>Search darts streams</span><kbd>⌘ K</kbd></div>
      <div className="an-season">S{d.season} <b>·</b> WEEK {d.week}</div>
    </header>
    <section className="an-hero">
      <div className="an-hero-image" />
      <div className="an-hero-shade" />
      <div className="an-broadcast-stamp"><span className="an-live-dot"/> CHANNEL ON AIR <b>NETWORK 09</b></div>
      <div className="an-hero-copy">
        <p className="an-eyebrow">YOUR CHANNEL · CAREER BROADCASTER</p>
        <h1>Ayr<span>Darts</span></h1>
        <div className="an-hero-meta"><b className="an-tier-badge">PARTNER</b><span>FOCUSED ON THE OCHE</span></div>
        <p className="an-hero-line">Fourteen shows. <strong>Nine challengers down.</strong><br/>Your next moment starts here.</p>
        <a className="an-scroll-cue" href="#broadcast"><span>STEP UP TO THE DESK</span><ChevronRight/></a>
      </div>
      <div className="an-reach-panel">
        <div className="an-reach-label"><span>CHANNEL REACH</span><span>PARTNER TIER</span></div>
        <strong>1,450</strong><small>FOLLOWERS</small>
        <div className="an-reach-rule"><i style={{ width: "5.8%" }}/></div>
        <p><b>23,550</b> to Star <span>25,000</span></p>
      </div>
      <div className="an-hero-foot"><span>SEASON 02 / LIVE CHANNEL IDENTITY</span><span>CAREER MODE <b>●</b></span></div>
    </section>
    <section className="an-scorebar" aria-label="Channel statistics">
      <div><small>CAREER EARNED</small><b>{pounds(d.totals.earnedPence)}</b></div>
      <div><small>SHOWS PLAYED</small><b>{d.totals.streams}</b></div>
      <div><small>CHALLENGERS BEATEN</small><b>{d.totals.won}<em> W</em></b></div>
      <div className="an-next-show"><span className="an-led"/><small>NEXT SHOW SLOT</small><b>{days(chosenNight ?? 2)} <em>·</em> {format === "KING" ? "KING OF THE OCHE" : d.formats.find(f => f.key === format)?.name.toUpperCase()}</b></div>
    </section>

    <div className="an-content">
      <section className="an-control" id="broadcast">
        <div className="an-section-head"><div><span className="an-index">01 / BROADCAST DESK</span><h2>Call the next show.</h2></div><span className="an-onair"><i/> WEEK {d.week} · ON AIR</span></div>
        <div className="an-desk-grid">
          <div className="an-program">
            <div className="an-desk-kicker"><Radio/> PROGRAM SELECT <span>CHAT POLL: KING</span></div>
            <div className="an-format-list" role="radiogroup" aria-label="What to stream">
              {d.formats.map((item, i) => <button key={item.key} type="button" role="radio" aria-checked={format === item.key} className="an-format" onClick={() => setFormat(item.key)}>
                <span className="an-format-no">0{i + 1}</span><span className="an-format-icon"><FormatIcon format={item.key}/></span>
                <span className="an-format-info"><b>{item.name}{item.key === d.pollPick ? <em>CHAT'S PICK</em> : null}</b><small>{item.blurb}</small></span>
                <span className="an-crowd">{item.crowd >= 1.15 ? "BIG CROWD" : item.crowd >= .95 ? "NORMAL CROWD" : item.crowd >= .8 ? "SMALLER CROWD" : "QUIET NIGHT"}{item.key === d.lastFormat && <i> LAST SHOW</i>}</span>
                <span className="an-select-mark">{format === item.key ? "✓" : ""}</span>
              </button>)}
            </div>
          </div>
          <aside className="an-slot-board">
            <span className="an-desk-kicker"><CalendarDays/> YOUR RUN OF SHOW</span>
            <h3>One stream this week.<br/><i>Two slots left.</i></h3>
            <p>Up to {d.perWeek} shows a week · {d.streamsThisWeek} booked so far. A stream books that night like any other, so no events can be scheduled then.</p>
            <div className="an-night-picker" role="radiogroup" aria-label="Night to stream">
              {streamDays.map(day => <button key={day} role="radio" aria-checked={chosenNight === day} onClick={() => setNight(day)}>{days(day)}{d.scheduledNights.includes(day) && <small>RESERVED</small>}</button>)}
            </div>
            <button type="button" className="an-live-button" onClick={() => preview(`Go live on ${days(chosenNight ?? 2)}`)}><Play fill="currentColor"/> GO LIVE <span>TAKE THE STAGE · {days(chosenNight ?? 2)}</span></button>
            {message && <p className="an-feedback" role="status">{message}</p>}
            <div className="an-slot-foot">CHAT REACTS TO EVERY VISIT <span>● PREVIEW MODE</span></div>
          </aside>
        </div>
      </section>

      <section className="an-route">
        <div className="an-route-title"><span className="an-index">02 / CHANNEL STRATEGY</span><h2>Set your pace.</h2><p>Make room for the channel in your career week.</p></div>
        <div className="an-route-controls">
          <div className="an-route-status"><i className={focus ? "active" : ""}/><div><small>{focus ? "ACTIVE FOCUS" : "ROUTE AVAILABLE"}</small><b>DartCast</b></div><p>{focus ? "Reserved on free nights. Starting each stream is still your choice." : "Reserve stream nights each week. Change or stop this focus anytime."}</p></div>
          {focus ? <><label>STREAMS TO SCHEDULE<select value={frequency} onChange={e => setFrequency(Number(e.target.value))}>{[1, 2, 3].map(n => <option key={n} value={n}>{n} night{n > 1 ? "s" : ""} a week</option>)}</select></label><div className="an-reserved"><small>THIS WEEK’S RESERVED NIGHTS</small><b>{d.scheduledNights.map(days).join(" · ")}</b></div><button className="an-text-btn" onClick={() => { setFocus(false); preview("Route update"); }}>Stop pursuing this route</button></> : <button className="an-gold-btn" onClick={() => { setFocus(true); preview("Route update"); }}>Pursue the streamer route</button>}
        </div>
      </section>

      <section className="an-revenue">
        <div className="an-section-head"><div><span className="an-index">03 / CHANNEL BUSINESS</span><h2>Audience in. Value out.</h2></div><span className="an-currency">£ / GBP</span></div>
        <div className="an-revenue-grid">
          <div className="an-subs">
            <small className="an-mini-title">SUBSCRIBER RENEWALS</small><div className="an-subs-number">{d.subscribers}<span> ACTIVE SUBS</span></div>
            <div className="an-renew-row"><span>NEXT RENEWAL</span><b>WEEK {d.renewsWeek}</b></div>
            <div className="an-renew-row"><span>IF ALL STAY</span><b>{pounds(d.subscribers * 125)}</b></div>
            <p>Renewal lands at week {d.renewsWeek}. Skip a month of streaming and more subscribers may drift away.</p>
          </div>
          <div className="an-offer">
            <div className="an-offer-top"><span>INCOMING BRAND OFFER</span><b>RESPONSE DUE · WK {d.dealOffer.expiresWeek}</b></div>
            <div className="an-offer-brand"><strong>{d.dealOffer.brand}</strong><span>{d.dealOffer.what}</span></div>
            <div className="an-offer-rate"><b>{pounds(d.dealOffer.perStreamPence)}</b><span>PER STREAM · NEXT {d.dealOffer.streamsTotal} STREAMS</span></div>
            {offerState ? <p className="an-feedback" role="status">{offerState}</p> : <div className="an-offer-actions"><button onClick={() => setOfferState("Take the deal is a local preview interaction; no Career data is changed.")}>Take the deal</button><button onClick={() => setOfferState("Brand offer response is a local preview interaction; no Career data is changed.")}>No thanks</button></div>}
          </div>
          <div className="an-active-deal"><span>ACTIVE PARTNERSHIP</span><b>{d.deal.brand}</b><strong>{pounds(d.deal.perStreamPence)} <small>/ STREAM</small></strong><div className="an-deal-progress"><i style={{ width: `${d.deal.streamsDone / d.deal.streamsTotal * 100}%` }}/></div><small>{d.deal.streamsDone} / {d.deal.streamsTotal} streams complete</small></div>
          <div className="an-charity"><HeartHandshake/><span>CHARITY STREAMS</span><b>{pounds(d.charity.raisedPence)}</b><small>RAISED ON STREAM</small></div>
        </div>
      </section>

      <section className="an-goal">
        <div className="an-goal-current"><span className="an-index">04 / AUDIENCE PROMISE</span><small>MONTHLY SUB GOAL · THROUGH WEEK {d.subGoal.endsWeek}</small><b>{d.subGoal.progress} <i>of</i> {d.subGoal.target} <small>SUBS</small></b><p>YOUR PROMISE <strong>{d.subGoal.promise}</strong></p><div className="an-goal-meter"><i style={{ width: `${d.subGoal.progress / d.subGoal.target * 100}%` }}/></div></div>
        <div className="an-goal-setup"><span className="an-index">NEXT MONTH'S GOAL</span><h2>Put a promise on it.</h2><p>Reach the target; the buzz brings new followers.</p>
          <small className="an-label">SUBSCRIBER TARGET</small><div className="an-choice-row" role="radiogroup" aria-label="Sub target">{d.goalTargets.map(n => <button key={n} role="radio" aria-checked={goalTarget === n} onClick={() => setGoalTarget(n)}>{n}<small>subs</small></button>)}</div>
          <small className="an-label">YOUR PROMISE</small><div className="an-promise-list" role="radiogroup" aria-label="Your promise">{d.promises.map(p => <button key={p} role="radio" aria-checked={promise === p} onClick={() => setPromise(p)}>{p}</button>)}</div>
          {goalSet ? <p className="an-feedback" role="status">Sub goal is a local preview interaction; no Career data is changed.</p> : <button disabled={!goalTarget || !promise} className="an-gold-btn" onClick={() => setGoalSet(true)}>Set the goal</button>}
        </div>
      </section>

      <section className="an-invitational">
        <div className="an-invite-visual"><div className="an-invite-orbit">DC<br/><b>40</b></div><span>SEASONAL MAJOR · WEEK {d.invitational.fromWeek}</span><h2>The DartCast<br/><i>Invitational.</i></h2><p>You and the season’s top seven. Knockout draw · first to 2 legs.</p><b className="an-locked">PARTNERS & STARS ONLY</b></div>
        <div className="an-invite-board"><span className="an-index">05 / SEASON COVERAGE</span><h3>THE FIELD OF SEVEN</h3><ol>{d.invitational.field.map(([handle, followers, avg], i) => <li key={handle}><span>0{i + 1}</span><b>{handle}</b><small>{followers.toLocaleString("en-GB")} followers · avg {avg}</small></li>)}</ol>
          <div className="an-prizes"><span>PRIZE LADDER</span>{["Quarter-final", "Semi-final", "Final", "Winner"].map((label, i) => <div key={label}><small>{label}</small><b>£{d.invitational.prizes[i].toLocaleString("en-GB")}</b></div>)}</div>
          <p className="an-note">Available to Partners and Stars · tournament begins week {d.invitational.fromWeek}.</p>
        </div>
      </section>

      <section className="an-collabs">
        <div className="an-section-head"><div><span className="an-index">06 / NETWORK EXCHANGE</span><h2>Guest channels.</h2></div><span className="an-collab-rule">SIMILAR SIZE · ONCE PER SEASON</span></div>
        <p className="an-collab-intro">Go live on both channels. Viewers cross over; the winner takes a share of the other audience. Collabs are limited to channels near your size, once per season.</p>
        <div className="an-collab-list">{d.collabs.map((c, i) => <article key={c.handle} className={!c.ok ? "unavailable" : ""}><span className="an-collab-number">0{i + 1}</span><div className="an-monogram">{c.handle.slice(0, 2).toUpperCase()}</div><div className="an-collab-info"><b>{c.handle}</b><small>{c.followers.toLocaleString("en-GB")} followers · averages about {c.avg}</small><p>{c.blurb}</p></div>{c.ok ? <button onClick={() => { setCollab(c.handle); preview(`Collab with ${c.handle}`); }}>COLLAB <ChevronRight/></button> : <em>{c.why}</em>}</article>)}</div>
        {collab && <p className="an-feedback" role="status">Collab with {collab} is a local preview interaction; no Career data is changed.</p>}
      </section>

      <section className="an-clips">
        <div className="an-section-head"><div><span className="an-index">07 / HIGHLIGHT REEL</span><h2>Clips making noise.</h2></div><span className="an-clip-count">02 CUTS</span></div>
        <div className="an-clip-strip">{d.clips.map((clip, i) => <article key={clip.title} className={`an-clip an-clip-${i}`}><div className="an-clip-art"><span className="an-clip-play"><Play fill="currentColor"/></span><small>{clip.status === "VIRAL" ? "VIRAL CUT" : "FRESH CUT"} · S{d.season} W{clip.week}</small><b>{clip.title}</b>{clip.status === "VIRAL" && <em>VIRAL</em>}</div><div className="an-clip-stats">{clip.status === "NEW" ? <span>OUT THIS WEEK · WILL IT GO VIRAL?</span> : <><span><Eye/>{clip.views.toLocaleString("en-GB")} views</span><span>+{clip.gained.toLocaleString("en-GB")} followers</span><span>+{clip.fans.toLocaleString("en-GB")} fans</span></>}</div></article>)}</div>
      </section>

      <section className="an-rankings">
        <div className="an-ranking-intro"><span className="an-index">08 / NETWORK LADDER</span><h2>Earn your<br/>next tier.</h2><p>There’s another way up in darts: build your audience.</p><div className="an-next-tier"><small>23,550 MORE FOLLOWERS TO</small><b>STAR</b><div className="an-tier-meter"><i style={{width:"5.8%"}}/></div></div></div>
        <ol className="an-tier-track">{d.tiers.map((tier, i) => <li key={tier.name} className={tier.reached ? "reached" : ""}><span className="an-tier-step">{tier.reached ? <Check/> : `0${i + 1}`}</span><div><small>{tier.followers ? `${tier.followers.toLocaleString("en-GB")} FOLLOWERS` : "START HERE"}</small><b>{tier.name}</b><p>{tier.perks}</p></div></li>)}</ol>
      </section>

      <section className="an-archive">
        <div className="an-archive-heading"><span className="an-index">09 / THE TAPE ROOM</span><h2>Past broadcasts.</h2><p>Every leg, every lesson, in the can.</p></div>
        <div className="an-tape-list">{d.videos.map(video => <article key={video.title}><div className={`an-tape-cover ${video.result ?? "ENDED"}`}><span>{video.format === "CHALLENGER" ? `VS ${video.challenger}` : video.title}</span><b>{video.result ?? "ENDED"}</b></div><div className="an-tape-copy"><small>S{d.season} · WEEK {video.week} · {days(video.day)}</small><h3>{video.title}</h3><div className="an-tape-metrics">{video.result === "WON" && <Trophy/>}<span><Eye/> {video.peak} peak</span><span><Users/> +{video.gained}</span><b>{pounds(video.income)}</b></div></div><button aria-label={`Preview ${video.title}`} onClick={() => preview(`Replay ${video.title}`)}><Play fill="currentColor"/></button></article>)}</div>
      </section>

      <footer className="an-footer"><div className="an-brand"><Radio/><span>DART<span>CAST</span></span><i>CAREER NETWORK</i></div><span>SEASON {d.season} · WEEK {d.week}</span><span>YOUR CHANNEL, YOUR CALL.</span></footer>
    </div>
  </main>;
}
