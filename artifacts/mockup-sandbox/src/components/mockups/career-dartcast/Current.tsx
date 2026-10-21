import { useState } from "react";
import {
  Activity, Check, Crosshair, Crown, Eye, HeartHandshake, Radio, Search,
  Target, TrendingUp, Trophy, Users,
} from "lucide-react";
import "./_group.css";

type StreamFormat = "CHALLENGER" | "KING" | "CHECKOUTS" | "BOBS_27" | "SCORING" | "CHARITY" | "INVITATIONAL" | "COLLAB";

const fixture = {
  season: 2,
  week: 9,
  currentWeek: 9,
  handle: "AyrDarts",
  followers: 1_450,
  tier: { key: "PARTNER", name: "Partner" },
  next: { name: "Star", followers: 25_000 },
  tiers: [
    { key: "NEWCOMER", name: "Newcomer", followers: 0, perks: "Go live and build an audience.", reached: true },
    { key: "AFFILIATE", name: "Affiliate", followers: 50, perks: "Viewers can cheer with bits and send super chats.", reached: true },
    { key: "PARTNER", name: "Partner", followers: 1_000, perks: "Viewers can subscribe (£2.50 a month, half to you), and brands start to notice.", reached: true },
    { key: "STAR", name: "Star", followers: 25_000, perks: "A household name in darts streaming: the biggest audiences and the biggest tips.", reached: false },
  ],
  streamsThisWeek: 1,
  perWeek: 3,
  freeNights: [2, 4, 5, 6],
  pathway: { focus: "DARTCAST" as "OPEN" | "DARTCAST", weeklyFrequency: 2, scheduledNights: [2, 5] },
  totals: { streams: 14, earnedPence: 18450, won: 9 },
  subscribers: 14,
  renewsWeek: 12,
  dealOffer: { id: "local-deal", brand: "FlightDeck", what: "flights and stems", perStreamPence: 6900, streamsTotal: 6, expiresWeek: 13 },
  deal: { brand: "Oche Energy", perStreamPence: 4200, streamsDone: 2, streamsTotal: 6 },
  invitations: false,
  formats: [
    { key: "CHALLENGER" as StreamFormat, name: "Play a viewer", blurb: "A viewer steps up: first to 2 legs of 501.", crowd: 1, why: null },
    { key: "KING" as StreamFormat, name: "King of the Oche", blurb: "One leg of 501 against viewer after viewer, up to 5. One loss and you're dethroned.", crowd: 1.25, why: null },
    { key: "CHECKOUTS" as StreamFormat, name: "Checkout Challenge", blurb: "Chat picks 5 finishes: three visits at each. Hit 3 to win.", crowd: 0.9, why: null },
    { key: "BOBS_27" as StreamFormat, name: "Bob's 27 live", blurb: "Every double from 1 to the bull, starting on 27. Don't drop to zero.", crowd: 0.8, why: null },
    { key: "SCORING" as StreamFormat, name: "Average challenge", blurb: "33 visits of pure scoring against a target average. Chat pledges bits that pay only if you beat it.", crowd: 0.9, why: null },
    { key: "CHARITY" as StreamFormat, name: "Charity stream", blurb: "Play a viewer for a good cause: every bit and super chat goes to charity. Generous crowds, and fans remember it. Once a month.", crowd: 1.1, why: null },
  ],
  pollPick: "KING" as StreamFormat,
  lastFormat: "BOBS_27" as StreamFormat,
  subGoal: { season: 2, endsWeek: 12, target: 20, promise: "A Bob's 27 stream", progress: 11, status: "ON" },
  goalOptions: { targets: [5, 10, 20, 50], promises: ["A Bob's 27 stream", "Throw in fancy dress", "A charity night", "Answer every question in chat", "Play left-handed for a leg"] },
  invitational: {
    open: false,
    why: "For Partners and Stars",
    fromWeek: 40,
    field: [
      { handle: "TheOcheShow", followers: 95_000, avg: 80 },
      { handle: "NineDartNick", followers: 50_000, avg: 82 },
      { handle: "ShanghaiSam", followers: 27_000, avg: 75 },
      { handle: "ArrowsAndAle", followers: 5_800, avg: 61 },
      { handle: "CheckoutQueen", followers: 3_400, avg: 66 },
      { handle: "BullseyeBarry", followers: 1_700, avg: 52 },
      { handle: "TungstenTomTV", followers: 950, avg: 58 },
    ],
    prizePence: [25_000, 75_000, 150_000, 400_000],
    result: null as { wins: number; prizePence: number } | null,
  },
  charity: { raisedPence: 12500 },
  collabs: [
    { key: "checkout-cleo", handle: "CheckoutCleo", followers: 3_300, avg: 66, blurb: "Any finish in nine. Never misses a chance to celebrate a checkout.", ok: true, why: null },
    { key: "double-dan", handle: "DoubleTroubleDan", followers: 680, avg: 48, blurb: "Pub player, all heart, can't find a double.", ok: true, why: null },
    { key: "the-oche-show", handle: "TheOcheShow", followers: 95_000, avg: 80, blurb: "The biggest darts channel on DartCast.", ok: false, why: "Too big for you yet" },
  ],
  clips: [
    { id: "clip-1", season: 2, week: 8, title: "NINE-DARTER LIVE ON STREAM", status: "VIRAL" as "VIRAL" | "NEW" | "SETTLED", views: 182_000, followersGained: 2_900, fansGained: 5_800 },
    { id: "clip-2", season: 2, week: 9, title: "Maximum!", status: "NEW" as "VIRAL" | "NEW" | "SETTLED", views: 0, followersGained: 0, fansGained: 0 },
  ],
  videos: [
    { id: "video-1", season: 2, week: 8, dayOfWeek: 6, format: "CHALLENGER" as StreamFormat, title: "Stream vs OcheGremlin12", challenger: "OcheGremlin12", result: "WON" as "WON" | "LOST" | null, peak: 41, followersGained: 12, incomePence: 2350 },
    { id: "video-2", season: 2, week: 7, dayOfWeek: 4, format: "KING" as StreamFormat, title: "King of the Oche", challenger: "TungstenKev28", result: "LOST" as "WON" | "LOST" | null, peak: 36, followersGained: 7, incomePence: 1680 },
    { id: "video-3", season: 2, week: 6, dayOfWeek: 2, format: "BOBS_27" as StreamFormat, title: "Bob's 27 live", challenger: "DartCast", result: null as "WON" | "LOST" | null, peak: 29, followersGained: 5, incomePence: 1200 },
  ],
};

const dayLabel = (day: number) => ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day] ?? "";
const formatPence = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const crowdLabel = (crowd: number) => crowd >= 1.15 ? "Big crowd" : crowd >= 0.95 ? "Normal crowd" : crowd >= 0.8 ? "Smaller crowd" : "Quiet night";

function StreamFormatIcon({ format }: { format: StreamFormat }) {
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

/** Faithful standalone baseline of the Career DartCast channel page. */
export function Current() {
  const [focus, setFocus] = useState<"OPEN" | "DARTCAST">(fixture.pathway.focus);
  const [frequency, setFrequency] = useState(fixture.pathway.weeklyFrequency);
  const [format, setFormat] = useState<StreamFormat | null>(null);
  const [night, setNight] = useState<number | null>(fixture.pathway.scheduledNights[0]);
  const [goalTarget, setGoalTarget] = useState<number | null>(null);
  const [promise, setPromise] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const d = fixture;
  const streamDays = d.pathway.scheduledNights.length ? d.pathway.scheduledNights : d.freeNights;
  const pick = night !== null && streamDays.includes(night) ? night : streamDays[0] ?? null;
  const chosen = format ?? d.pollPick ?? "CHALLENGER";
  const progress = d.next ? Math.min(100, Math.round(d.followers / d.next.followers * 100)) : 100;
  const goalThisMonth = d.subGoal && d.subGoal.season === d.season && d.subGoal.endsWeek >= d.week;
  const goLive = (action: string) => setMessage(`${action} is a local preview interaction; no Career data is changed.`);

  return (
    <div className="dc min-h-screen">
      <header className="dc__bar">
        <span className="dc__logo"><Radio aria-hidden /> Dart<b>Cast</b></span>
        <span className="dc__search" aria-hidden><Search /> Search darts streams</span>
      </header>
      <section className="dc__channel">
        <div className="dc__avatar" aria-hidden>{d.handle.slice(0, 2).toUpperCase()}</div>
        <div className="dc__who">
          <span className="dc__channel-kicker"><i /> YOUR DARTCAST CHANNEL</span>
          <h1>{d.handle}</h1>
          <p><span className="dc__tier" data-tier={d.tier.key}>{d.tier.name}</span><span className="dc__channel-separator" aria-hidden="true" />Career broadcaster</p>
          <p className="dc__channel-summary"><b>{d.followers.toLocaleString("en-GB")} followers</b> · {d.totals.streams} streams · {formatPence(d.totals.earnedPence)} earned · beat {d.totals.won} challengers</p>
        </div>
        <dl className="dc__channel-stats">
          <div><dt>FOLLOWERS</dt><dd>{d.followers.toLocaleString("en-GB")}</dd></div>
          <div><dt>STREAMS</dt><dd>{d.totals.streams}</dd></div>
          <div><dt>CAREER EARNED</dt><dd>{formatPence(d.totals.earnedPence)}</dd></div>
          <div><dt>CHALLENGERS BEATEN</dt><dd>{d.totals.won}</dd></div>
        </dl>
      </section>
      <section className="dc__panel dc__panel--pathway">
        <h2>The streamer route</h2>
        {focus === "DARTCAST" ? <>
          <div className="dc__route-status"><span className="dc__route-led" /><div><b>ACTIVE FOCUS</b><small>DartCast</small></div>
            <p>Your chosen weekly frequency is reserved on free nights. Starting each stream is still your choice.</p></div>
          <label className="dc__frequency">Streams to schedule each week
            <select aria-label="Streams to schedule each week" value={frequency} onChange={event => setFrequency(Number(event.target.value))}>
              {[1, 2, 3].map(count => <option key={count} value={count}>{count} night{count === 1 ? "" : "s"} a week</option>)}
            </select>
          </label>
          <div className="dc__schedule-state"><small>THIS WEEK’S RESERVED NIGHTS</small><strong>{d.pathway.scheduledNights.map(dayLabel).join(" · ")}</strong></div>
          <button type="button" className="dc__link" onClick={() => { setFocus("OPEN"); goLive("Route update"); }}>Stop pursuing this route</button>
        </> : <>
          <div className="dc__route-status"><span className="dc__route-led is-idle" /><div><b>ROUTE AVAILABLE</b><small>Build an audience alongside your darts career</small></div>
            <p>Choose DartCast to reserve stream nights each week. This focus can be changed or stopped at any time.</p></div>
          <button type="button" className="dc__go" onClick={() => { setFocus("DARTCAST"); goLive("Route update"); }}>Pursue the streamer route</button>
        </>}
      </section>
      <section className="dc__panel dc__panel--money">
        <h2>Channel money</h2>
        <div className="dc__money-fact">
          <div><small>ACTIVE SUBSCRIBERS</small><strong>{d.subscribers.toLocaleString("en-GB")}</strong></div>
          <div><small>NEXT RENEWAL</small><strong>Week {d.renewsWeek}</strong></div>
          <div><small>IF ALL STAY</small><strong>{formatPence(Math.round(d.subscribers * 125))}</strong></div>
          <p>Subscribers renew at the end of week {d.renewsWeek}. Stream at least once a month or more of them drift away.</p>
          <span className="sr-only">{d.subscribers} subscribers renew at the end of week {d.renewsWeek}. {formatPence(Math.round(d.subscribers * 125))} if they all stay.</span>
        </div>
        <div className="dc__deal" role="group" aria-label="Brand offer">
          <div className="dc__deal-detail"><small>BRAND OFFER · RESPONSE DUE WEEK {d.dealOffer.expiresWeek}</small><strong>{d.dealOffer.brand}</strong><span>{d.dealOffer.what}</span>
            <b>{formatPence(d.dealOffer.perStreamPence)} <small>PER STREAM</small></b><em>Next {d.dealOffer.streamsTotal} streams</em></div>
          <span className="sr-only">{d.dealOffer.brand} ({d.dealOffer.what}) · {formatPence(d.dealOffer.perStreamPence)} a stream · next {d.dealOffer.streamsTotal} streams · Answer by week {d.dealOffer.expiresWeek}</span>
          <button type="button" className="dc__go" onClick={() => goLive("Take the deal")}>Take the deal</button>
          <button type="button" className="dc__link" onClick={() => goLive("Brand offer response")}>No thanks</button>
        </div>
        <div className="dc__money-line"><small>ACTIVE BRAND DEAL</small><b>{d.deal.brand}</b><span>{formatPence(d.deal.perStreamPence)} per stream</span><em>{d.deal.streamsDone} / {d.deal.streamsTotal} streams complete</em></div>
        <div className="dc__money-line"><small>CHARITY STREAMS</small><b>{formatPence(d.charity.raisedPence)}</b><span>Raised for charity on stream</span></div>
      </section>
      <section className="dc__panel dc__panel--goal">
        <h2>Sub goal</h2>
        <div className="dc__goal-current" data-status={d.subGoal.status}>
          <div><small>MONTHLY TARGET · THROUGH WEEK {d.subGoal.endsWeek}</small><strong>{d.subGoal.progress} of {d.subGoal.target} subs</strong></div>
          <span>Your promise · {d.subGoal.promise}</span>
          <span className="sr-only">Your promise: {d.subGoal.promise}</span>
        </div>
        {!goalThisMonth && <div className="dc__goal">
          <p className="dc__note">Set a goal for this month: hit it and the buzz wins you followers.</p>
          <div className="dc__nights" role="radiogroup" aria-label="Sub target">{d.goalOptions.targets.map(target => <button key={target} type="button" role="radio" aria-checked={goalTarget === target} className="dc__night" onClick={() => setGoalTarget(target)}>{target} subs</button>)}</div>
          <div className="dc__nights" role="radiogroup" aria-label="Your promise">{d.goalOptions.promises.map(item => <button key={item} type="button" role="radio" aria-checked={promise === item} className="dc__night" onClick={() => setPromise(item)}>{item}</button>)}</div>
          <button type="button" className="dc__go" disabled={goalTarget === null || promise === null} onClick={() => goLive("Sub goal")}>Set the goal</button>
        </div>}
      </section>
      <section className="dc__panel dc__panel--broadcast">
        <h2>Go live</h2>
        <div className="dc__broadcast-brief">
          <div><small>CURRENT WEEK</small><strong>Season {d.season} · Week {d.week}</strong></div>
          <div><small>WEEKLY LIMIT</small><strong>{d.streamsThisWeek} of {d.perWeek} streams</strong><span className="sr-only">Up to {d.perWeek} a week ({d.streamsThisWeek} so far)</span></div>
          <p>Choose what to stream and a free night. Chat reacts to every visit; a stream books that night like any other, so no events can be scheduled then.</p>
        </div>
        <div className="dc__formats" role="radiogroup" aria-label="What to stream">
          {d.formats.map(item => <button key={item.key} type="button" role="radio" aria-checked={chosen === item.key} className="dc__format" data-format={item.key} onClick={() => setFormat(item.key)}>
            <span className="dc__format-icon"><StreamFormatIcon format={item.key} /></span>
            <span className="dc__format-copy"><b>{item.name}{d.pollPick === item.key ? " · chat's pick" : ""}</b><span>{item.blurb}</span>
              <small data-crowd={item.crowd >= 1.15 ? "big" : item.crowd < 0.8 ? "quiet" : undefined}>{crowdLabel(item.crowd)}{d.lastFormat === item.key ? " (you did this last time)" : ""}</small></span>
          </button>)}
        </div>
        <div className="dc__nights" role="radiogroup" aria-label="Night to stream">
          {streamDays.map(day => <button key={day} type="button" role="radio" aria-checked={pick === day} className="dc__night" onClick={() => setNight(day)}>{dayLabel(day)}{d.pathway.scheduledNights.includes(day) ? " · scheduled" : ""}</button>)}
        </div>
        <button type="button" className="dc__go" onClick={() => goLive("Go live")}><Radio aria-hidden />Go live{pick ? ` on ${dayLabel(pick)}` : ""}</button>
        {message && <p className="dc__warn" role="status">{message}</p>}
      </section>
      <section className="dc__panel dc__panel--invitational">
        <h2>DartCast Invitational</h2>
        <div className="dc__invitational-brief">
          <p>Once a season from week {d.invitational.fromWeek}, the season’s top seven streamers and you meet in a knockout on one big stream. First to 2 legs.</p>
          <div className="dc__prize-ladder"><small>PRIZE BY FINISH · QUARTERS / SEMIS / FINAL / WINNER</small>
            {d.invitational.prizePence.map((amount, index) => <span key={`${index}-${amount}`}><b>{["Quarter-final", "Semi-final", "Final", "Winner"][index]}</b><strong>{formatPence(amount)}</strong></span>)}
            <span className="sr-only">{d.invitational.prizePence.map(formatPence).join(" / ")}</span>
          </div>
        </div>
        <ol className="dc__field">{d.invitational.field.map(streamer => <li key={streamer.handle}><b>{streamer.handle}</b>{" "}<span>{streamer.followers.toLocaleString("en-GB")} followers · averages {streamer.avg}</span></li>)}</ol>
        {d.invitational.result ? <p className="dc__note"><b>You won {d.invitational.result.wins} matches.</b> Prize: {formatPence(d.invitational.result.prizePence)}.</p>
          : d.invitational.open ? <button type="button" className="dc__go" onClick={() => goLive("Invitational")}>Play the Invitational{pick ? ` on ${dayLabel(pick)}` : ""}</button>
          : <p className="dc__note">{d.invitational.why}</p>}
      </section>
      <section className="dc__panel dc__panel--collabs">
        <h2>Collabs</h2>
        <div className="dc__collab-brief"><p>Stream together on both channels. Their viewers tune in; the winner takes a share of the other audience.</p>
          <div><span>SIMILAR-SIZED CHANNELS</span><span>ONCE PER SEASON</span>{pick && <span>GOES OUT · {dayLabel(pick)}</span>}</div>
          <small>They’ll only collab with a channel near your size.</small></div>
        <ul className="dc__collabs">{d.collabs.map(collab => <li key={collab.key} data-ok={collab.ok || undefined}>
          <div><b>{collab.handle}</b><small>{collab.followers.toLocaleString("en-GB")} followers · averages about {collab.avg}</small><span>{collab.blurb}</span></div>
          {collab.ok ? <button type="button" className="dc__go" onClick={() => goLive(`Collab with ${collab.handle}`)}>Collab</button>
            : <em>{collab.why}</em>}
        </li>)}</ul>
      </section>
      <section className="dc__panel dc__panel--clips">
        <h2>Clips</h2>
        <ul className="dc__clips">{d.clips.map(clip => <li key={clip.id} data-status={clip.status}>
          <div className="dc__thumb" data-result={clip.status === "VIRAL" ? "WON" : "NONE"}><span>{clip.title}</span>{clip.status === "VIRAL" ? <em>VIRAL</em> : null}</div>
          <p><b>{clip.title}</b><small>S{clip.season} Wk {clip.week} · {clip.status === "NEW" ? "out this week: will it go viral?" : `${clip.views.toLocaleString("en-GB")} views`}
            {clip.followersGained ? ` · +${clip.followersGained.toLocaleString("en-GB")} followers · +${clip.fansGained.toLocaleString("en-GB")} fans` : ""}</small></p>
        </li>)}</ul>
      </section>
      <section className="dc__panel dc__panel--tiers">
        <h2>The streamer route</h2>
        <p className="dc__note">Another way up in darts: build an audience. {(d.next.followers - d.followers).toLocaleString("en-GB")} more followers to {d.next.name}.</p>
        <div className="dc__progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to the next step"><span style={{ width: `${progress}%` }} /></div>
        <ol className="dc__tiers">{d.tiers.map(tier => <li key={tier.key} data-reached={tier.reached || undefined}>
          <b>{tier.reached ? <Check aria-hidden /> : null}{tier.name}</b><small>{tier.followers ? `${tier.followers.toLocaleString("en-GB")} followers` : "Start here"}</small><span>{tier.perks}</span></li>)}</ol>
      </section>
      <section className="dc__panel dc__panel--videos">
        <h2>Videos</h2>
        <ul className="dc__videos">{d.videos.map(video => <li key={video.id}>
          <div className="dc__thumb" data-result={video.result ?? "NONE"}><span>{video.format === "CHALLENGER" ? `vs ${video.challenger}` : video.title}</span><em>{video.result === "WON" ? "WON" : video.result === "LOST" ? "LOST" : "ENDED"}</em></div>
          <p><b>{video.result === "WON" ? <Trophy aria-hidden /> : null}{video.title}</b>
            <small>S{video.season} Wk {video.week} · {dayLabel(video.dayOfWeek)} · <Eye aria-hidden /> {video.peak} peak · <Users aria-hidden /> +{video.followersGained} · {formatPence(video.incomePence)}</small></p>
        </li>)}</ul>
      </section>
    </div>
  );
}
