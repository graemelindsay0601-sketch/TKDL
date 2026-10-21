import { useState } from "react";
import {
  Activity, Check, Crosshair, Crown, Eye, HeartHandshake, Radio, Search,
  Target, TrendingUp, Trophy, Users, SlidersHorizontal,
  CircleDollarSign, Clapperboard, ArrowUpRight, Sparkles, Play,
} from "lucide-react";
import "./CreatorStudio.css";

type StreamFormat = "CHALLENGER" | "KING" | "CHECKOUTS" | "BOBS_27" | "SCORING" | "CHARITY" | "INVITATIONAL" | "COLLAB";
const data = {
  season: 2, week: 9, handle: "AyrDarts", followers: 1450, tier: { key: "PARTNER", name: "Partner" },
  next: { name: "Star", followers: 25000 }, streamsThisWeek: 1, perWeek: 3, freeNights: [2, 4, 5, 6],
  pathway: { focus: "DARTCAST" as "OPEN" | "DARTCAST", weeklyFrequency: 2, scheduledNights: [2, 5] },
  totals: { streams: 14, earnedPence: 18450, won: 9 }, subscribers: 14, renewsWeek: 12,
  dealOffer: { brand: "FlightDeck", what: "flights and stems", perStreamPence: 6900, streamsTotal: 6, expiresWeek: 13 },
  deal: { brand: "Oche Energy", perStreamPence: 4200, streamsDone: 2, streamsTotal: 6 },
  formats: [
    { key: "CHALLENGER" as StreamFormat, name: "Play a viewer", blurb: "First to 2 legs of 501 against a viewer.", crowd: 1 },
    { key: "KING" as StreamFormat, name: "King of the Oche", blurb: "One leg against viewers, up to 5. One loss dethrones you.", crowd: 1.25 },
    { key: "CHECKOUTS" as StreamFormat, name: "Checkout Challenge", blurb: "Chat picks 5 finishes. Three visits each; hit 3 to win.", crowd: .9 },
    { key: "BOBS_27" as StreamFormat, name: "Bob's 27 live", blurb: "Every double from 1 to bull, starting on 27. Don't hit zero.", crowd: .8 },
    { key: "SCORING" as StreamFormat, name: "Average challenge", blurb: "33 scoring visits against a target average. Bits pay only if you beat it.", crowd: .9 },
    { key: "CHARITY" as StreamFormat, name: "Charity stream", blurb: "Play a viewer for a good cause: every bit and super chat goes to charity. Once a month.", crowd: 1.1 },
  ],
  pollPick: "KING" as StreamFormat, lastFormat: "BOBS_27" as StreamFormat,
  subGoal: { endsWeek: 12, target: 20, promise: "A Bob's 27 stream", progress: 11 },
  goalOptions: { targets: [5, 10, 20, 50], promises: ["A Bob's 27 stream", "Throw in fancy dress", "A charity night", "Answer every question in chat", "Play left-handed for a leg"] },
  invitational: {
    fromWeek: 40, field: [
      { handle: "TheOcheShow", followers: 95000, avg: 80 }, { handle: "NineDartNick", followers: 50000, avg: 82 },
      { handle: "ShanghaiSam", followers: 27000, avg: 75 }, { handle: "ArrowsAndAle", followers: 5800, avg: 61 },
      { handle: "CheckoutQueen", followers: 3400, avg: 66 }, { handle: "BullseyeBarry", followers: 1700, avg: 52 },
      { handle: "TungstenTomTV", followers: 950, avg: 58 },
    ], prizePence: [25000, 75000, 150000, 400000],
  },
  charity: { raisedPence: 12500 },
  collabs: [
    { handle: "CheckoutCleo", followers: 3300, avg: 66, blurb: "Any finish in nine. Never misses a chance to celebrate a checkout.", ok: true },
    { handle: "DoubleTroubleDan", followers: 680, avg: 48, blurb: "Pub player, all heart, can't find a double.", ok: true },
    { handle: "TheOcheShow", followers: 95000, avg: 80, blurb: "The biggest darts channel on DartCast.", ok: false, why: "Too big for you yet" },
  ],
  clips: [
    { id: "clip-1", season: 2, week: 8, title: "NINE-DARTER LIVE ON STREAM", status: "VIRAL", views: 182000, followersGained: 2900, fansGained: 5800 },
    { id: "clip-2", season: 2, week: 9, title: "Maximum!", status: "NEW", views: 0, followersGained: 0, fansGained: 0 },
  ],
  videos: [
    { id: "video-1", season: 2, week: 8, dayOfWeek: 6, format: "CHALLENGER" as StreamFormat, title: "Stream vs OcheGremlin12", challenger: "OcheGremlin12", result: "WON", peak: 41, followersGained: 12, incomePence: 2350 },
    { id: "video-2", season: 2, week: 7, dayOfWeek: 4, format: "KING" as StreamFormat, title: "King of the Oche", challenger: "TungstenKev28", result: "LOST", peak: 36, followersGained: 7, incomePence: 1680 },
    { id: "video-3", season: 2, week: 6, dayOfWeek: 2, format: "BOBS_27" as StreamFormat, title: "Bob's 27 live", challenger: "DartCast", result: null, peak: 29, followersGained: 5, incomePence: 1200 },
  ],
  tiers: [
    { name: "Newcomer", followers: 0, perks: "Go live and build an audience.", reached: true },
    { name: "Affiliate", followers: 50, perks: "Viewers can cheer with bits and send super chats.", reached: true },
    { name: "Partner", followers: 1000, perks: "Subscriptions (£2.50/month, half to you) and brand attention.", reached: true },
    { name: "Star", followers: 25000, perks: "A household name: the biggest audiences and tips.", reached: false },
  ],
};
const dayLabel = (day: number) => ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day] ?? "";
const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const crowd = (n: number) => n >= 1.15 ? "Big crowd" : n >= .95 ? "Normal crowd" : n >= .8 ? "Smaller crowd" : "Quiet night";
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

/** Creator-workstation hypothesis: controls first, archive and programming as studio tools. */
export function CreatorStudio() {
  const [focus, setFocus] = useState<"OPEN" | "DARTCAST">(data.pathway.focus);
  const [frequency, setFrequency] = useState(data.pathway.weeklyFrequency);
  const [format, setFormat] = useState<StreamFormat | null>(null);
  const [night, setNight] = useState<number | null>(data.pathway.scheduledNights[0]);
  const [goalTarget, setGoalTarget] = useState<number | null>(null);
  const [promise, setPromise] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [goalSet, setGoalSet] = useState(false);
  const available = focus === "DARTCAST" ? data.pathway.scheduledNights : data.freeNights;
  const pick = night !== null && available.includes(night) ? night : available[0];
  const chosen = format ?? data.pollPick;
  const progress = Math.round(data.followers / data.next.followers * 100);
  const notify = (action: string) => setMessage(`${action} is a local preview interaction; no Career data is changed.`);
  const goalActive = !goalSet;

  return <main className="studio">
    <header className="studio-top">
      <a className="studio-brand" href="#studio-home" aria-label="DartCast creator studio"><span className="brand-mark"><Radio /></span><span>DART<b>CAST</b><small>CREATOR STUDIO</small></span></a>
      <div className="studio-top-status"><i /> SEASON {data.season} <span>/</span> WEEK {data.week}</div>
      <label className="studio-search"><Search /><input aria-label="Search your studio" placeholder="Search your channel" /></label>
      <button className="studio-avatar" type="button" onClick={() => notify("Channel profile")}>AY</button>
    </header>

    <div className="studio-shell" id="studio-home">
      <div className="studio-content">
        <nav className="studio-nav" aria-label="Creator studio sections">
          <a href="#control-room" className="is-current"><SlidersHorizontal /> Overview</a>
          <a href="#programming"><Radio /> Programming</a>
          <a href="#audience"><Users /> Audience &amp; income</a>
          <a href="#vault"><Clapperboard /> Production vault</a>
          <span className="studio-nav-status"><i /> {data.tier.name.toUpperCase()} CHANNEL</span>
        </nav>
        <section className="studio-hero" id="control-room">
          <img className="studio-hero-image" src="/__mockup/images/dartcast-creator-studio.jpg" alt="A darts creator's private studio: board, camera, microphone and control desk" />
          <div className="studio-hero-shade" />
          <div className="hero-toolbar"><span><i /> YOUR PRIVATE STUDIO</span><span>CHANNEL ID / AYR-01450</span></div>
          <div className="hero-copy">
            <div className="hero-kicker">THE CREATOR WORKSPACE <span>•</span> SEASON {data.season}</div>
            <h1>Make the next<br /><em>good show.</em></h1>
            <p>Your channel, your schedule. Set the room before you step up to the oche.</p>
            <a className="hero-cta" href="#programming"><SlidersHorizontal /> Open programming desk <ArrowUpRight /></a>
          </div>
          <div className="hero-id"><span>CHANNEL</span><b>{data.handle}</b><i>{data.tier.name.toUpperCase()}</i></div>
          <div className="hero-depth-label"><span>STUDIO 02</span><span>LIVE SETUP / DARTCAST</span></div>
        </section>

        <section className="setpiece" aria-label="DartCast studio set">
          <img className="setpiece-image" src="/__mockup/images/dartcast-broadcast-diorama.png" alt="A miniature DartCast broadcast stage with an illuminated dartboard, studio screens, boom microphone, mixing desk and trophy" />
          <div className="setpiece-shade" />
          <div className="setpiece-copy">
            <span className="setpiece-kicker"><i /> YOUR BROADCAST SET <b>·</b> SEASON {data.season} / WEEK {data.week}</span>
            <h2>Set the scene.<br /><em>Take the shot.</em></h2>
            <p>The room is ready. Your channel, your format, your call on when to go live.</p>
            <a href="#programming" className="setpiece-action"><SlidersHorizontal /> Configure the next show <ArrowUpRight /></a>
          </div>
          <div className="setpiece-readout"><span>CHANNEL</span><b>{data.handle}</b><i>{data.tier.name.toUpperCase()}</i></div>
          <div className="setpiece-coordinate">DARTCAST STUDIO / CREATOR BAY</div>
        </section>

        <section className="creator-console">
          <div className="console-head"><div><span className="eyebrow">01 / CONTROL ROOM</span><h2>Today’s setup</h2></div><div className="console-state"><i /> READY WHEN YOU ARE</div></div>
          <div className="console-layout">
            <div className="setup-main">
              <figure className="control-room-image">
                <img src="/__mockup/images/dartcast-control-desk.png" alt="Close-up of the DartCast control desk, monitor, microphone and illuminated broadcast controls" />
              </figure>
              <div className="setup-current">
                <span className="onair"><i /> CHANNEL SNAPSHOT</span>
                <h3>{data.handle}</h3><span className="tier-pill">{data.tier.name} creator</span>
                <div className="audience-meter"><div><span>ROAD TO {data.next.name.toUpperCase()}</span><b>{data.followers.toLocaleString("en-GB")} <small>/ {data.next.followers.toLocaleString("en-GB")}</small></b></div><div className="meter-track"><span style={{ width: `${progress}%` }} /></div><small>{(data.next.followers - data.followers).toLocaleString("en-GB")} more followers to {data.next.name}</small></div>
              </div>
              <div className="control-stack">
                <div className="route-control">
                  <div className="control-title"><span className="control-number">A</span><div><b>Career focus</b><small>Choose the path you want to build</small></div></div>
                  {focus === "DARTCAST" ? <div className="route-config">
                    <div className="route-active"><i /> DARTCAST FOCUS ACTIVE</div>
                    <p>Weekly frequency is reserved on free nights. Starting each stream is still your choice.</p>
                    <label>Weekly schedule<select aria-label="Streams to schedule each week" value={frequency} onChange={e => setFrequency(Number(e.target.value))}>{[1, 2, 3].map(n => <option key={n} value={n}>{n} night{n === 1 ? "" : "s"} a week</option>)}</select></label>
                    <div className="reserved"><span>THIS WEEK RESERVED</span><b>{data.pathway.scheduledNights.map(dayLabel).join(" · ")}</b></div>
                    <button className="text-action" type="button" onClick={() => { setFocus("OPEN"); notify("Route update"); }}>Stop pursuing this route</button>
                  </div> : <div className="route-config"><div className="route-active is-idle">ROUTE AVAILABLE</div><p>Build an audience alongside your darts career. Reserve stream nights each week; change or stop any time.</p><button className="button-gold" type="button" onClick={() => { setFocus("DARTCAST"); notify("Route update"); }}>Pursue the streamer route <ArrowUpRight /></button></div>}
                </div>
                <div className="next-session">
                  <span className="control-number">B</span><div className="next-session-info"><small>NEXT SESSION</small><b>{pick ? dayLabel(pick) : "Choose a night"} <span>·</span> Season {data.season}, week {data.week}</b><span>{data.streamsThisWeek} of {data.perWeek} streams used this week</span></div>
                  <button type="button" onClick={() => document.getElementById("programming")?.scrollIntoView({ behavior: "smooth" })}>Configure <ArrowUpRight /></button>
                </div>
              </div>
            </div>
            <div className="studio-stats" aria-label="Career channel stats">
              <div className="stat-big"><span>FOLLOWERS</span><b>{data.followers.toLocaleString("en-GB")}</b><small>CHANNEL REACH</small></div>
              <div><span>SHOWS</span><b>{data.totals.streams}</b></div>
              <div><span>CAREER EARNED</span><b>{money(data.totals.earnedPence)}</b></div>
              <div><span>CHALLENGERS BEATEN</span><b>{data.totals.won}</b></div>
              <div className="stat-side-note"><Sparkles /><span>Growing one show<br />at a time.</span></div>
            </div>
          </div>
        </section>

        <section className="programming-desk" id="programming">
          <div className="section-heading"><div><span className="eyebrow">02 / SESSION BUILDER</span><h2>Build your next stream</h2></div><span className="heading-meta">SELECT FORMAT <i>→</i> PICK A NIGHT</span></div>
          <div className="program-topline"><div><b>WHAT’S THE SHOW?</b><span>Chat’s pick is marked. Your last format is noted.</span></div><span className="weekly-limit">WEEKLY LIMIT <b>{data.streamsThisWeek} / {data.perWeek}</b></span></div>
          <div className="format-list" role="radiogroup" aria-label="What to stream">
            {data.formats.map((item, index) => <button key={item.key} className={`format-row ${chosen === item.key ? "selected" : ""}`} type="button" role="radio" aria-checked={chosen === item.key} onClick={() => setFormat(item.key)}>
              <span className="format-index">0{index + 1}</span><span className="format-icon"><FormatIcon format={item.key} /></span><span className="format-title"><b>{item.name}</b><small>{item.blurb}</small></span>
              <span className="format-reach">{item.crowd >= 1.15 ? "BIG CROWD" : crowd(item.crowd).toUpperCase()}{data.pollPick === item.key ? <em>CHAT’S PICK</em> : data.lastFormat === item.key ? <em>LAST SHOW</em> : null}</span><span className="format-check">{chosen === item.key && <Check />}</span>
            </button>)}
          </div>
          <div className="schedule-picker"><div><span className="eyebrow">WHEN ARE YOU LIVE?</span><small>Choosing a night books it like any other event; no events can be scheduled then.</small></div><div className="night-choices" role="radiogroup" aria-label="Night to stream">{available.map(day => <button key={day} type="button" role="radio" aria-checked={pick === day} onClick={() => setNight(day)}><b>{dayLabel(day)}</b><small>{data.pathway.scheduledNights.includes(day) ? "SCHEDULED" : "FREE NIGHT"}</small></button>)}</div></div>
          <div className="go-live-row"><div><span className="live-dot" /> READY TO RECORD</div><button className="button-live" type="button" onClick={() => notify(`Go live${pick ? ` on ${dayLabel(pick)}` : ""}`)}><Play fill="currentColor" /> Go live{pick ? ` on ${dayLabel(pick)}` : ""}</button></div>
          {message && <p className="preview-message" role="status">{message}</p>}
        </section>

        <section className="audience-finance" id="audience">
          <div className="section-heading"><div><span className="eyebrow">03 / AUDIENCE &amp; INCOME</span><h2>The channel is working</h2></div><span className="heading-meta">YOUR CHANNEL ECONOMY</span></div>
          <div className="finance-layout">
            <div className="audience-panel">
              <div className="panel-label"><Users /> SUBSCRIBER HEALTH</div>
              <div className="sub-count"><b>{data.subscribers}</b><span>active subscribers</span></div>
              <div className="renewal-figure"><span>NEXT RENEWAL</span><b>Week {data.renewsWeek}</b><span>IF ALL STAY <strong>{money(Math.round(data.subscribers * 125))}</strong></span></div>
              <p>Subscribers renew at the end of week {data.renewsWeek}. Stream at least once a month or more of them drift away.</p>
              <div className="renewal-track"><span style={{ width: "70%" }} /></div><small className="track-note">RENEWAL WINDOW APPROACHING</small>
            </div>
            <div className="income-panel">
              <div className="panel-label"><CircleDollarSign /> BRAND DESK</div>
              <div className="offer-card"><div className="offer-top"><span>RESPONSE DUE · WEEK {data.dealOffer.expiresWeek}</span><i>NEW OFFER</i></div><div className="offer-brand">{data.dealOffer.brand}<small>{data.dealOffer.what}</small></div><div className="offer-terms"><b>{money(data.dealOffer.perStreamPence)} <small>/ STREAM</small></b><span>Next {data.dealOffer.streamsTotal} streams</span></div><div className="offer-actions"><button type="button" className="button-gold" onClick={() => notify("Take the deal")}>Take the deal</button><button type="button" className="text-action" onClick={() => notify("Brand offer response")}>No thanks</button></div></div>
              <div className="active-deal"><span>ACTIVE BRAND DEAL</span><div><b>{data.deal.brand}</b><strong>{money(data.deal.perStreamPence)} <small>PER STREAM</small></strong></div><div className="deal-progress"><span style={{ width: `${data.deal.streamsDone / data.deal.streamsTotal * 100}%` }} /></div><small>{data.deal.streamsDone} / {data.deal.streamsTotal} streams complete</small></div>
              <div className="charity-raised"><HeartHandshake /><span>RAISED FOR CHARITY ON STREAM</span><b>{money(data.charity.raisedPence)}</b></div>
            </div>
          </div>
          <div className="subgoal-panel">
            <div className="goal-heading"><div><span className="eyebrow">COMMUNITY COMMITMENT</span><h3>Subscriber goal</h3></div><span className="goal-window">MONTHLY · THROUGH WEEK {data.subGoal.endsWeek}</span></div>
            {!goalActive ? <div className="goal-current"><b>{goalTarget} subs</b><span>Your promise · {promise}</span></div> : <>
              <div className="goal-current"><div><b>{data.subGoal.progress} <small>of</small> {data.subGoal.target} subs</b><span>Current goal · through week {data.subGoal.endsWeek}</span></div><strong>Your promise · {data.subGoal.promise}</strong></div>
              <p>Set a goal for this month. Hit it and the buzz wins you followers.</p>
              <div className="goal-controls"><div><small>SUB TARGET</small><div className="goal-options" role="radiogroup" aria-label="Sub target">{data.goalOptions.targets.map(n => <button type="button" key={n} role="radio" aria-checked={goalTarget === n} onClick={() => setGoalTarget(n)}>{n} subs</button>)}</div></div><div><small>YOUR PROMISE</small><div className="promise-options" role="radiogroup" aria-label="Your promise">{data.goalOptions.promises.map(item => <button type="button" key={item} role="radio" aria-checked={promise === item} onClick={() => setPromise(item)}>{item}</button>)}</div></div><button className="button-gold goal-submit" type="button" disabled={goalTarget === null || promise === null} onClick={() => { setGoalSet(true); notify("Sub goal"); }}>Set the goal <ArrowUpRight /></button></div>
            </>}
          </div>
        </section>

        <section className="growth-map">
          <div className="growth-copy"><span className="eyebrow">04 / CHANNEL GROWTH</span><h2>A long game.<br /><em>Your own pace.</em></h2><p>Another way up in darts: build an audience. You’re {data.tier.name.toLowerCase()} today; {data.next.followers - data.followers} more followers to {data.next.name}.</p></div>
          <div className="growth-steps">{data.tiers.map((tier, i) => <div className={`growth-step ${tier.reached ? "reached" : ""}`} key={tier.name}><span className="step-index">0{i + 1}</span><div className="step-info"><div><b>{tier.reached && <Check />} {tier.name}</b><small>{tier.followers ? `${tier.followers.toLocaleString("en-GB")} followers` : "Start here"}</small></div><p>{tier.perks}</p></div></div>)}</div>
        </section>

        <section className="production-vault" id="vault">
          <div className="section-heading"><div><span className="eyebrow">05 / PRODUCTION VAULT</span><h2>Moments worth keeping</h2></div><span className="heading-meta">CLIPS · COLLABS · REPLAYS</span></div>
          <div className="vault-grid">
            <div className="vault-column clips-column"><div className="vault-title"><Clapperboard /><div><b>CLIP BOARD</b><small>THE MOMENTS THAT TRAVEL</small></div></div><div className="clip-stack">{data.clips.map(clip => <article className="clip-card" key={clip.id}><div className={`clip-art ${clip.status === "VIRAL" ? "viral" : ""}`}><span className="clip-stamp">{clip.status === "VIRAL" ? "VIRAL" : "NEW CUT"}</span><b>{clip.title}</b><span className="clip-play"><Play fill="currentColor" /></span></div><div className="clip-caption"><b>{clip.title}</b><small>S{clip.season} WK {clip.week} · {clip.status === "NEW" ? "out this week: will it go viral?" : `${clip.views.toLocaleString("en-GB")} views · +${clip.followersGained.toLocaleString("en-GB")} followers · +${clip.fansGained.toLocaleString("en-GB")} fans`}</small></div></article>)}</div></div>
            <div className="vault-column collab-column"><div className="vault-title"><Users /><div><b>COLLAB DESK</b><small>FIND YOUR NEXT GUEST</small></div></div><div className="collab-rules"><span>SIMILAR-SIZED CHANNELS</span><span>ONCE PER SEASON</span>{pick && <span>GOES OUT · {dayLabel(pick)}</span>}<p>They’ll only collab with a channel near your size. Stream together on both channels; their viewers tune in and the winner takes a share of the other audience.</p></div><div className="collab-list">{data.collabs.map(c => <article className={`collab-person ${c.ok ? "" : "unavailable"}`} key={c.handle}><div className="collab-monogram">{c.handle.slice(0, 2).toUpperCase()}</div><div className="collab-details"><b>{c.handle}</b><small>{c.followers.toLocaleString("en-GB")} followers · averages about {c.avg}</small><p>{c.blurb}</p></div>{c.ok ? <button type="button" onClick={() => notify(`Collab with ${c.handle}`)}>Invite <ArrowUpRight /></button> : <em>{c.why}</em>}</article>)}</div></div>
          </div>
          <div className="replay-shelf"><div className="replay-head"><div><span className="eyebrow">SHOW ARCHIVE</span><h3>Past broadcasts</h3></div><span>3 SAVED SHOWS</span></div><div className="replay-list">{data.videos.map(v => <article className="replay-item" key={v.id}><div className={`replay-thumb ${v.result === "WON" ? "win" : v.result === "LOST" ? "loss" : ""}`}><span>{v.format === "CHALLENGER" ? `vs ${v.challenger}` : v.title}</span><i>{v.result === "WON" ? "WON" : v.result === "LOST" ? "LOST" : "ENDED"}</i><Play /></div><div className="replay-meta"><b>{v.result === "WON" && <Trophy />} {v.title}</b><span>S{v.season} WK {v.week} · {dayLabel(v.dayOfWeek)}</span><div><span><Eye /> {v.peak} peak</span><span><Users /> +{v.followersGained}</span><strong>{money(v.incomePence)}</strong></div></div><button type="button" aria-label={`Open replay ${v.title}`} onClick={() => notify(`Replay ${v.title}`)}><ArrowUpRight /></button></article>)}</div></div>
        </section>

        <section className="invitational-studio">
          <div className="invitational-banner">
            <img className="final-stage-art" src="/__mockup/images/dartcast-final-stage.png" alt="A gold darts trophy on a stepped plinth beneath an illuminated dartboard at the DartCast finals stage" />
            <div className="invitational-copy">
              <span className="eyebrow">SEASONAL FEATURE · FROM WEEK {data.invitational.fromWeek}</span>
              <h2>DartCast<br /><em>Invitational</em></h2>
              <p>Once a season, the season’s top seven streamers and you meet in a knockout on one big stream. First to 2 legs.</p>
              <span className="locked-tag"><i /> FOR PARTNERS AND STARS</span>
            </div>
            <div className="prize-wall"><small>PRIZE BY FINISH</small>{data.invitational.prizePence.map((amount, i) => <div key={amount}><span>{["QUARTER-FINAL", "SEMI-FINAL", "FINAL", "WINNER"][i]}</span><b>{money(amount)}</b></div>)}</div>
          </div>
          <div className="field-panel"><div className="field-title"><span>INVITATIONAL FIELD</span><small>SEVEN INVITED CHANNELS</small></div><div className="field-list">{data.invitational.field.map((s, i) => <div className="field-member" key={s.handle}><span>0{i + 1}</span><b>{s.handle}</b><small>{s.followers.toLocaleString("en-GB")} followers</small><strong>AVG {s.avg}</strong></div>)}</div><p>Entry opens at week {data.invitational.fromWeek}. Current status: For Partners and Stars.</p></div>
        </section>
        <footer className="studio-footer"><span>DARTCAST <b>CREATOR STUDIO</b></span><span>SEASON {data.season} · WEEK {data.week} <i /> AYRDARTS</span></footer>
      </div>
    </div>
  </main>;
}
