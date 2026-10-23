import { useEffect, useRef, useState } from "react";
import { markSeen } from "../unlocks";
import { Link, useLocation, useSearch } from "wouter";
import { Activity, ArrowUpRight, Check, CircleDollarSign, Clapperboard, Crosshair, Crown, Eye, HeartHandshake, Loader2, Play, Radio, Search, SlidersHorizontal, Sparkles, Target, TrendingUp, Trophy, Users } from "lucide-react";
import { useAnswerBrandDeal, useAnswerStreamCampaign, useGoLive, useSetSubGoal, useStreaming, useSetStreamingPathway, useScheduleStreamingPathway, useScheduleStreamNight, errorMessage, type StreamFormat } from "../api";
import { CareerError, CareerLoading } from "../components";
import { dayLabel, formatPence } from "../model";
import type { ShellContext } from "../shell";
import "./streaming.css";

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

/** DartCast Creator Studio. Live career data and actions remain connected to the Career API. */
export function StreamingPage({ ctx }: { ctx: ShellContext }) {
  const id = ctx.save.id;
  const search = useSearch(), params = new URLSearchParams(search), weekParam = params.get("week");
  const requestedWeek = weekParam === null ? undefined : Number(weekParam) || undefined;
  const q = useStreaming(id, requestedWeek), live = useGoLive(id), scheduleNight = useScheduleStreamNight(id), answer = useAnswerBrandDeal(id),
    answerCampaign=useAnswerStreamCampaign(id),goal = useSetSubGoal(id);
  const setPathway = useSetStreamingPathway(id), schedulePathway = useScheduleStreamingPathway(id);
  useEffect(() => { markSeen(id, "streaming"); }, [id]);
  const [format, setFormat] = useState<StreamFormat | null>(null);
  const [goalTarget, setGoalTarget] = useState<number | null>(null);
  const [promise, setPromise] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const requestedDayValue = params.get("day");
  const requestedDay = requestedDayValue === null ? null : Number(requestedDayValue);
  const [night, setNight] = useState<number | null>(requestedDay !== null && requestedDay >= 1 && requestedDay <= 7 ? requestedDay : null);
  const [message, setMessage] = useState("");
  const scheduledWeek = useRef("");
  useEffect(() => {
    const data = q.data;
    if (ctx.save.retiredAt || !data || data.week !== data.currentWeek || data.pathway.focus !== "DARTCAST" || data.pathway.scheduledNights.length) return;
    const key = `${id}:${data.season}:${data.week}`;
    if (scheduledWeek.current === key) return;
    scheduledWeek.current = key;
    schedulePathway.mutate(undefined);
  }, [id, q.data, schedulePathway]);
  if (q.isLoading) return <CareerLoading />;
  if (q.error || !q.data) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data, retired = !!ctx.save.retiredAt;
  const futureWeek = d.week > d.currentWeek;
  const streamDays = !futureWeek && d.pathway.scheduledNights.length ? d.pathway.scheduledNights : d.freeNights;
  const preferredNight = night ?? requestedDay;
  const pick = preferredNight !== null && streamDays.includes(preferredNight) ? preferredNight : streamDays[0] ?? null;
  const progress = d.next ? Math.min(100, Math.round(d.followers / d.next.followers * 100)) : 100;
  const chosen = format ?? d.pollPick ?? "CHALLENGER";
  const crowd = (c: number) => c >= 1.15 ? "Big crowd" : c >= 0.95 ? "Normal crowd" : c >= 0.8 ? "Smaller crowd" : "Quiet night";
  const goalThisMonth = d.subGoal && d.subGoal.season === d.season && d.subGoal.endsWeek >= d.week;
  const chosenOk = !d.formats.find(f => f.key === chosen)?.why;
  const canGo = !futureWeek && !retired && !d.live && d.streamsThisWeek < d.perWeek && pick !== null;
  const money = formatPence;
  return (
    <main className="studio">
      <header className="studio-top">
        <a className="studio-brand" href="#studio-home" aria-label="DartCast creator studio"><span className="brand-mark"><Radio aria-hidden /></span><span>DART<b>CAST</b><small>CREATOR STUDIO</small></span><span className="sr-only">Dart Cast</span></a>
        <div className="studio-top-status"><i /> SEASON {d.season} <span>/</span> WEEK {d.week}</div>
        <div className="studio-search" aria-hidden="true"><Search /><span>YOUR CHANNEL / {d.handle}</span></div>
        {d.live ? <Link className="studio-avatar" href={`/career/${id}/streaming/${d.live}`} aria-label="Back to your live stream">{d.handle.slice(0, 2).toUpperCase()}</Link> : <span className="studio-avatar" aria-hidden="true">{d.handle.slice(0, 2).toUpperCase()}</span>}
      </header>
      <div className="studio-shell" id="studio-home">
        <div className="studio-content">
          <nav className="studio-nav" aria-label="Creator studio sections">
            <a href="#control-room" className="is-current"><SlidersHorizontal aria-hidden /> Overview</a>
            <a href="#programming"><Radio aria-hidden /> Programming</a>
            <a href="#audience"><Users aria-hidden /> Audience &amp; income</a>
            <a href="#vault"><Clapperboard aria-hidden /> Production vault</a>
            <span className="studio-nav-status"><i /> {d.tier.name.toUpperCase()} CHANNEL</span>
          </nav>
          <section className="studio-hero" id="control-room">
            <img className="studio-hero-image" src="/assets/dartcast-creator-studio/dartcast-creator-studio.jpg" alt="A darts creator's private studio: board, camera, microphone and control desk" />
            <div className="studio-hero-shade" />
            <div className="hero-toolbar"><span><i /> YOUR PRIVATE STUDIO</span><span>SEASON {d.season} / WEEK {d.week}</span></div>
            <div className="hero-copy">
              <div className="hero-kicker">THE CREATOR WORKSPACE <span>•</span> SEASON {d.season}</div>
              <h1>Make the next<br /><em>good show.</em></h1>
              <p>Your channel, your schedule. Set the room before you step up to the oche.</p>
              <a className="hero-cta" href="#programming"><SlidersHorizontal aria-hidden /> Open programming desk <ArrowUpRight aria-hidden /></a>
            </div>
            <div className="hero-id"><span>CHANNEL</span><b>{d.handle}</b><i>{d.tier.name.toUpperCase()}</i></div>
            <div className="hero-depth-label"><span>STUDIO 02</span><span>LIVE SETUP / DARTCAST</span></div>
          </section>
          <section className="setpiece" aria-label="DartCast studio set">
            <img className="setpiece-image" src="/assets/dartcast-creator-studio/dartcast-broadcast-diorama.png" alt="A miniature DartCast broadcast stage with an illuminated dartboard, studio screens, boom microphone, mixing desk and trophy" />
            <div className="setpiece-shade" />
            <div className="setpiece-copy">
              <span className="setpiece-kicker"><i /> YOUR BROADCAST SET <b>·</b> SEASON {d.season} / WEEK {d.week}</span>
              <h2>Set the scene.<br /><em>Take the shot.</em></h2>
              <p>The room is ready. Your channel, your format, your call on when to go live.</p>
              <a href="#programming" className="setpiece-action"><SlidersHorizontal aria-hidden /> Configure the next show <ArrowUpRight aria-hidden /></a>
            </div>
            <div className="setpiece-readout"><span>CHANNEL</span><b>{d.handle}</b><i>{d.tier.name.toUpperCase()}</i></div>
            <div className="setpiece-coordinate">DARTCAST STUDIO / CREATOR BAY</div>
          </section>
          <section className="creator-console">
            <div className="console-head"><div><span className="eyebrow">01 / CONTROL ROOM</span><h2>Today’s setup</h2></div><div className="console-state"><i /> {d.live ? "YOU’RE ON AIR" : "READY WHEN YOU ARE"}</div></div>
            <div className="console-layout">
              <div className="setup-main">
                <figure className="control-room-image"><img src="/assets/dartcast-creator-studio/dartcast-control-desk.png" alt="Close-up of the DartCast control desk, monitor, microphone and illuminated broadcast controls" /></figure>
                <div className="setup-current">
                  <span className="onair"><i /> CHANNEL SNAPSHOT</span>
                  <h3>{d.handle}</h3><span className="tier-pill">{d.tier.name} creator</span>
                  <div className="audience-meter"><div><span>ROAD TO {d.next?.name.toUpperCase() ?? "THE TOP"}</span><b>{d.followers.toLocaleString("en-GB")} <small>{d.next ? `/ ${d.next.followers.toLocaleString("en-GB")}` : "followers"}</small></b></div><div className="meter-track"><span style={{ width: `${progress}%` }} /></div><small>{d.next ? `${(d.next.followers - d.followers).toLocaleString("en-GB")} more followers to ${d.next.name}` : "Top channel tier reached"}</small></div>
                </div>
                <div className="control-stack">
                  <div className="route-control">
                    <div className="control-title"><span className="control-number">A</span><div><b>Career focus</b><small>Choose the path you want to build</small></div></div>
                    {d.pathway.focus === "DARTCAST" ? <div className="route-config">
                      <div className="route-active"><i /> DARTCAST FOCUS ACTIVE</div>
                      <p>Your chosen weekly frequency is reserved on free nights. Starting each stream is still your choice.</p>
                      <label>Weekly schedule<select aria-label="Streams to schedule each week" value={d.pathway.weeklyFrequency} disabled={setPathway.isPending || retired} onChange={e => setPathway.mutate({ focus: "DARTCAST", weeklyFrequency: Number(e.target.value) }, { onError: err => setMessage(errorMessage(err)) })}>{[1, 2, 3].map(n => <option key={n} value={n}>{n} night{n === 1 ? "" : "s"} a week</option>)}</select></label>
                      <div className="reserved"><span>THIS WEEK RESERVED</span><b>{d.pathway.scheduledNights.length ? d.pathway.scheduledNights.map(dayLabel).join(" · ") : "No nights reserved"}</b></div>
                      {!d.pathway.scheduledNights.length && d.streamsThisWeek < d.pathway.weeklyFrequency && d.freeNights.length > 0 && <button className="text-action" type="button" disabled={schedulePathway.isPending} onClick={() => schedulePathway.mutate(undefined, { onError: err => setMessage(errorMessage(err)) })}>{schedulePathway.isPending ? "Checking free nights…" : "Try scheduling this week again"}</button>}
                      <button className="text-action" type="button" disabled={setPathway.isPending || retired} onClick={() => setPathway.mutate({ focus: "OPEN", weeklyFrequency: 0 }, { onError: err => setMessage(errorMessage(err)) })}>Stop pursuing this route</button>
                    </div> : <div className="route-config"><div className="route-active is-idle">ROUTE AVAILABLE</div><p>Build an audience alongside your darts career. Reserve stream nights each week; change or stop any time.</p><button className="button-gold" type="button" disabled={setPathway.isPending || retired} onClick={() => setPathway.mutate({ focus: "DARTCAST", weeklyFrequency: 1 }, { onError: err => setMessage(errorMessage(err)) })}>Pursue the streamer route <ArrowUpRight aria-hidden /></button></div>}
                  </div>
                  <div className="next-session"><span className="control-number">B</span><div className="next-session-info"><small>NEXT SESSION</small><b>{pick ? dayLabel(pick) : "Choose a night"} <span>·</span> Season {d.season}, week {d.week}</b><span>{d.streamsThisWeek} of {d.perWeek} streams used this week</span></div><a href="#programming">Configure <ArrowUpRight aria-hidden /></a></div>
                </div>
              </div>
              <div className="studio-stats" aria-label="Career channel stats">
                <div className="stat-big"><span>FOLLOWERS</span><b>{d.followers.toLocaleString("en-GB")}</b><small>CHANNEL REACH</small></div>
                <div><span>SHOWS</span><b>{d.totals.streams}</b></div><div><span>CAREER EARNED</span><b>{money(d.totals.earnedPence)}</b></div><div><span>CHALLENGERS BEATEN</span><b>{d.totals.won}</b></div>
                <div className="stat-side-note"><Sparkles aria-hidden /><span>Growing one show<br />at a time.</span></div>
              </div>
            </div>
          </section>
          <section className="programming-desk" id="programming">
            <div className="section-heading"><div><span className="eyebrow">02 / SESSION BUILDER</span><h2>Build your next stream</h2></div><span className="heading-meta">SELECT FORMAT <i>→</i> PICK A NIGHT</span></div>
            <div className="program-topline"><div><b>WHAT’S THE SHOW?</b><span>Chat’s pick is marked. Your last format is noted.</span></div><span className="weekly-limit">WEEKLY LIMIT <b>{d.streamsThisWeek} / {d.perWeek}</b></span></div>
            <div className="format-list" role="radiogroup" aria-label="What to stream">{d.formats.map((f, index) => <button key={f.key} className={`format-row ${chosen === f.key ? "selected" : ""}`} type="button" role="radio" aria-checked={chosen === f.key} disabled={!!f.why} onClick={() => setFormat(f.key)}>
              <span className="format-index">0{index + 1}</span><span className="format-icon"><StreamFormatIcon format={f.key} /></span><span className="format-title"><b>{f.name}</b><small>{f.blurb}</small></span>
              <span className="format-reach">{f.why ?? crowd(f.crowd).toUpperCase()}{d.pollPick === f.key ? <em>CHAT’S PICK</em> : d.lastFormat === f.key ? <em>LAST SHOW</em> : null}</span><span className="format-check">{chosen === f.key && <Check aria-hidden />}</span>
            </button>)}</div>
            <div className="schedule-picker"><div><span className="eyebrow">{futureWeek ? "SCHEDULE FOR WEEK" : "WHEN ARE YOU LIVE?"}</span><small>{futureWeek ? `Choose a free night in week ${d.week}; you can go live when it begins.` : "Choosing a night books it like any other event; no events can be scheduled then."}</small></div>
              {streamDays.length ? <div className="night-choices" role="radiogroup" aria-label="Night to stream">{streamDays.map(day => <button key={day} type="button" role="radio" aria-checked={pick === day} disabled={retired} onClick={() => setNight(day)}><b>{dayLabel(day)}</b><small>{d.pathway.scheduledNights.includes(day) ? "SCHEDULED" : "FREE NIGHT"}</small></button>)}</div> : <p className="dc__note">No free nights left this week.</p>}
            </div>
            <div className="go-live-row"><div><span className="live-dot" /> {d.live ? "STREAM IN PROGRESS" : retired ? "CAREER RETIRED" : futureWeek ? "READY TO SCHEDULE" : "READY TO RECORD"}</div>
              <button className="button-live" type="button" disabled={futureWeek ? retired || !pick || scheduleNight.isPending || d.streamsThisWeek >= d.perWeek : !canGo || !chosenOk || live.isPending} onClick={() => futureWeek ? scheduleNight.mutate({ week: d.week, dayOfWeek: pick! }, { onError: e => setMessage(errorMessage(e)) }) : live.mutate({ dayOfWeek: pick!, format: chosen }, { onSuccess: s => navigate(`/career/${id}/streaming/${s.id}`), onError: e => setMessage(errorMessage(e)) })}>
                {futureWeek ? scheduleNight.isPending || live.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Radio aria-hidden /> : live.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Play fill="currentColor" aria-hidden />}
                {futureWeek ? "Schedule stream" : "Go live"}{pick ? ` on ${dayLabel(pick)}` : ""}</button>
            </div>
            {message && <p className="preview-message" role="alert">{message}</p>}
          </section>
          {(d.platform.adsEligible || d.subscribers > 0 || d.deal || d.dealOffer || d.campaign || d.campaignOffer || d.invitations || d.charity.raisedPence > 0 || d.goalOptions) && <section className="audience-finance" id="audience">
            <div className="section-heading"><div><span className="eyebrow">03 / AUDIENCE &amp; INCOME</span><h2>The channel is working</h2></div><span className="heading-meta">YOUR CHANNEL ECONOMY</span></div>
            <div className="finance-layout">
              <div className="audience-panel"><div className="panel-label"><CircleDollarSign aria-hidden /> PLATFORM ADS</div>
                {d.platform.adsEligible ? <><div className="sub-count"><b>{money(d.platform.estimatedAdPence)}</b><span>estimated this month</span></div>
                  <div className="renewal-figure"><span>WATCH TIME</span><b>{d.platform.viewerMinutesThisMonth.toLocaleString("en-GB")} min</b><span>STREAMED WEEKS <strong>{d.platform.streamedWeeksThisMonth} / {d.platform.fullRateWeeks} for full rate</strong></span></div>
                  <p>Ads are separate from sponsors. Earnings scale with audience watch time and how consistently you stream; paid at the end of each four-week month.</p></>
                  : <><div className="sub-count"><b>50</b><span>followers to unlock ads</span></div><p>Build your audience to Affiliate. Platform ads will provide income without a sponsor deal.</p></>}
              </div>
              {d.subscribers > 0 && <div className="audience-panel"><div className="panel-label"><Users aria-hidden /> SUBSCRIBER HEALTH</div><div className="sub-count"><b>{d.subscribers}</b><span>active subscribers</span></div>
                <div className="renewal-figure"><span>NEXT RENEWAL</span><b>Week {d.renewsWeek}</b><span>IF ALL STAY <strong>{money(Math.round(d.subscribers * 125))}</strong></span></div>
                <p>Subscribers renew at the end of week {d.renewsWeek}. Stream at least once a month or more of them drift away.</p>
                <small className="track-note">RENEWAL WINDOW · WEEK {d.renewsWeek}</small></div>}
              <div className="income-panel">
                <h2 className="sr-only">Channel money</h2>
                {(d.dealOffer || d.deal || d.campaign || d.campaignOffer || d.charity.raisedPence > 0 || d.invitations) && <div className="panel-label"><CircleDollarSign aria-hidden /> BRAND DESK</div>}
                {d.campaignOffer && <div className="offer-card campaign-card" role="group" aria-label="One-off sponsored stream campaign">
                  <div className="offer-top"><span>ONE STREAM · RESPONSE DUE WEEK {d.campaignOffer.expiresWeek}</span><i>CAMPAIGN</i></div>
                  <div className="offer-brand">{d.campaignOffer.sponsorName}<small>{d.campaignOffer.requiredFormatName} · one-off activation</small></div>
                  <p>{d.campaignOffer.brief}</p>
                  <div className="offer-terms"><b>{money(d.campaignOffer.rewardPence)} <small>ON COMPLETION</small></b><span>Play the required format before the deadline</span></div>
                  <div className="offer-actions"><button type="button" className="button-gold" disabled={answerCampaign.isPending} onClick={() => answerCampaign.mutate({campaignId:d.campaignOffer!.id,accept:true},{onError:e=>setMessage(errorMessage(e))})}>Accept campaign</button>
                    <button type="button" className="text-action" disabled={answerCampaign.isPending} onClick={() => answerCampaign.mutate({campaignId:d.campaignOffer!.id,accept:false},{onError:e=>setMessage(errorMessage(e))})}>Decline</button></div>
                </div>}
                {d.campaign && <div className="active-deal campaign-active"><span>SPONSORED STREAM · {d.campaign.requiredFormatName.toUpperCase()}</span>
                  <div><b>{d.campaign.sponsorName}</b><strong>{money(d.campaign.rewardPence)} <small>ON COMPLETION</small></strong></div>
                  <small>{d.campaign.brief} · due week {d.campaign.expiresWeek}</small></div>}
                {d.dealOffer && <div className="offer-card" role="group" aria-label="Brand offer"><div className="offer-top"><span>RESPONSE DUE · WEEK {d.dealOffer.expiresWeek}</span><i>NEW OFFER</i></div><div className="offer-brand">{d.dealOffer.brand}<small>{d.dealOffer.what}</small></div><div className="offer-terms"><b>{money(d.dealOffer.perStreamPence)} <small>/ STREAM</small></b><span>Next {d.dealOffer.streamsTotal} streams</span></div><div className="offer-actions"><button type="button" className="button-gold" disabled={answer.isPending} onClick={() => answer.mutate({ dealId: d.dealOffer!.id, accept: true }, { onError: e => setMessage(errorMessage(e)) })}>Take the deal</button><button type="button" className="text-action" disabled={answer.isPending} onClick={() => answer.mutate({ dealId: d.dealOffer!.id, accept: false }, { onError: e => setMessage(errorMessage(e)) })}>No thanks</button></div></div>}
                {d.deal && <div className="active-deal"><span>ACTIVE BRAND DEAL</span><div><b>{d.deal.brand}</b><strong>{money(d.deal.perStreamPence)} <small>PER STREAM</small></strong></div><div className="deal-progress"><span style={{ width: `${d.deal.streamsTotal ? d.deal.streamsDone / d.deal.streamsTotal * 100 : 0}%` }} /></div><small>{d.deal.streamsDone} / {d.deal.streamsTotal} streams complete</small></div>}
                {d.charity.raisedPence > 0 && <div className="charity-raised"><HeartHandshake aria-hidden /><span>RAISED FOR CHARITY ON STREAM</span><b>{money(d.charity.raisedPence)}</b></div>}
                {d.invitations && <div className="active-deal"><span>INVITATIONAL ACCESS</span><div><b>DartCast Star</b></div><small>Televised invitations are listed in your calendar.</small></div>}
              </div>
            </div>
            {d.goalOptions && <div className="subgoal-panel"><div className="goal-heading"><div><span className="eyebrow">COMMUNITY COMMITMENT</span><h3>Subscriber goal</h3></div><span className="goal-window">{d.subGoal ? `${d.subGoal.status === "ON" ? "MONTHLY" : d.subGoal.status === "HIT" ? "GOAL HIT" : "PREVIOUS GOAL"} · WEEK ${d.subGoal.endsWeek}` : "SET A MONTHLY GOAL"}</span></div>
              {d.subGoal && <div className="goal-current"><div><b>{d.subGoal.status === "HIT" ? d.subGoal.target : d.subGoal.progress} <small>{d.subGoal.status === "HIT" ? "subs reached" : "of"}</small>{d.subGoal.status !== "HIT" && ` ${d.subGoal.target} subs`}</b><span>{d.subGoal.status === "ON" ? `Current goal · through week ${d.subGoal.endsWeek}` : d.subGoal.status === "HIT" ? "Monthly target hit" : "Previous month’s goal was missed"}</span></div><strong>{d.subGoal.status === "MISSED" ? "Set a new goal to get the community buzzing." : `Your promise · ${d.subGoal.promise}`}</strong></div>}
              {!goalThisMonth && <><p>Set a goal for this month. Hit it and the buzz wins you followers.</p><div className="goal-controls"><div><small>SUB TARGET</small><div className="goal-options" role="radiogroup" aria-label="Sub target">{d.goalOptions.targets.map(t => <button type="button" key={t} role="radio" aria-checked={goalTarget === t} onClick={() => setGoalTarget(t)}>{t} subs</button>)}</div></div><div><small>YOUR PROMISE</small><div className="promise-options" role="radiogroup" aria-label="Your promise">{d.goalOptions.promises.map(p => <button type="button" key={p} role="radio" aria-checked={promise === p} onClick={() => setPromise(p)}>{p}</button>)}</div></div><button className="button-gold goal-submit" type="button" disabled={goalTarget === null || promise === null || goal.isPending} onClick={() => goal.mutate({ target: goalTarget!, promise: promise! }, { onError: e => setMessage(errorMessage(e)) })}>{goal.isPending ? "Setting goal…" : "Set the goal"} <ArrowUpRight aria-hidden /></button></div></>}
            </div>}
          </section>}
          <section className="growth-map">
            <div className="growth-copy"><span className="eyebrow">04 / CHANNEL GROWTH</span><h2>A long game.<br /><em>Your own pace.</em></h2><p>Another way up in darts: build an audience. You’re {d.tier.name.toLowerCase()} today; {d.next ? `${(d.next.followers - d.followers).toLocaleString("en-GB")} more followers to ${d.next.name}.` : "you have reached the top tier."}</p></div>
            <div className="growth-steps">{d.tiers.map((tier, i) => <div className={`growth-step ${tier.reached ? "reached" : ""}`} key={tier.key}><span className="step-index">0{i + 1}</span><div className="step-info"><div><b>{tier.reached && <Check aria-hidden />} {tier.name}</b><small>{tier.followers ? `${tier.followers.toLocaleString("en-GB")} followers` : "Start here"}</small></div><p>{tier.perks}</p></div></div>)}</div>
          </section>
          <section className="production-vault" id="vault">
            <div className="section-heading"><div><span className="eyebrow">05 / PRODUCTION VAULT</span><h2>Moments worth keeping</h2></div><span className="heading-meta">CLIPS · COLLABS · REPLAYS</span></div>
            <div className="vault-grid">
              {d.clips.length > 0 && <div className="vault-column clips-column"><div className="vault-title"><Clapperboard aria-hidden /><div><b>CLIP BOARD</b><small>THE MOMENTS THAT TRAVEL</small></div></div><div className="clip-stack">{d.clips.map(clip => <article className="clip-card" key={clip.id}><div className={`clip-art ${clip.status === "VIRAL" ? "viral" : ""}`}><span className="clip-stamp">{clip.status === "VIRAL" ? "VIRAL" : "NEW CUT"}</span><b>{clip.title}</b><span className="clip-play"><Play fill="currentColor" aria-hidden /></span></div><div className="clip-caption"><b>{clip.title}</b><small>S{clip.season} WK {clip.week} · {clip.status === "NEW" ? "out this week: will it go viral?" : `${clip.views.toLocaleString("en-GB")} views · +${clip.followersGained.toLocaleString("en-GB")} followers · +${clip.fansGained.toLocaleString("en-GB")} fans`}</small></div></article>)}</div></div>}
              <div className="vault-column collab-column"><div className="vault-title"><Users aria-hidden /><div><b>COLLAB DESK</b><small>FIND YOUR NEXT GUEST</small></div></div><div className="collab-rules"><span>SIMILAR-SIZED CHANNELS</span><span>ONCE PER SEASON</span>{pick && <span>GOES OUT · {dayLabel(pick)}</span>}<p>They’ll only collab with a channel near your size. Stream together on both channels; their viewers tune in and the winner takes a share of the other audience.</p></div><div className="collab-list">{d.collabs.map(c => <article className={`collab-person ${c.ok ? "" : "unavailable"}`} key={c.key}><div className="collab-monogram">{c.handle.slice(0, 2).toUpperCase()}</div><div className="collab-details"><b>{c.handle}</b><small>{c.followers.toLocaleString("en-GB")} followers · averages about {c.avg}</small><p>{c.blurb}</p></div>{c.ok ? <button type="button" disabled={!canGo || live.isPending} onClick={() => live.mutate({ dayOfWeek: pick!, format: "COLLAB", streamer: c.key }, { onSuccess: s => navigate(`/career/${id}/streaming/${s.id}`), onError: e => setMessage(errorMessage(e)) })}>Invite <ArrowUpRight aria-hidden /></button> : <em>{c.why}</em>}</article>)}</div></div>
            </div>
            <div className="replay-shelf"><div className="replay-head"><div><span className="eyebrow">SHOW ARCHIVE</span><h3>Past broadcasts</h3></div><span>{d.videos.length} SAVED SHOW{d.videos.length === 1 ? "" : "S"}</span></div>
              {d.videos.length ? <div className="replay-list">{d.videos.map(v => <article className="replay-item" key={v.id}><div className={`replay-thumb ${v.result === "WON" ? "win" : v.result === "LOST" ? "loss" : ""}`}><span>{v.format === "CHALLENGER" ? `vs ${v.challenger}` : v.title}</span><i>{v.result === "WON" ? "WON" : v.result === "LOST" ? "LOST" : "ENDED"}</i><Play aria-hidden /></div><div className="replay-meta"><b>{v.result === "WON" && <Trophy aria-hidden />} {v.title}</b><span>S{v.season} WK {v.week} · {dayLabel(v.dayOfWeek)}</span><div><span><Eye aria-hidden /> {v.peak} peak</span><span><Users aria-hidden /> +{v.followersGained}</span><strong>{money(v.incomePence)}</strong></div></div></article>)}</div> : <p className="dc__note">No past broadcasts yet. Your first show will appear here.</p>}
            </div>
          </section>
          <section className="invitational-studio">
            <div className="invitational-banner"><img className="final-stage-art" src="/assets/dartcast-creator-studio/dartcast-final-stage.png" alt="A gold darts trophy on a stepped plinth beneath an illuminated dartboard at the DartCast finals stage" /><div className="invitational-copy"><span className="eyebrow">SEASONAL FEATURE · FROM WEEK {d.invitational.fromWeek}</span><h2>DartCast<br /><em>Invitational</em></h2><p>Once a season, the season’s top seven streamers and you meet in a knockout on one big stream. First to 2 legs.</p><span className="locked-tag"><i /> {d.invitational.open ? "ENTRY OPEN" : d.invitational.why}</span></div>
              <div className="prize-wall"><small>PRIZE BY FINISH</small>{d.invitational.prizePence.map((amount, i) => <div key={`${i}-${amount}`}><span>{["QUARTER-FINAL", "SEMI-FINAL", "FINAL", "WINNER"][i] ?? `FINISH ${i + 1}`}</span><b>{money(amount)}</b></div>)}</div></div>
            <div className="field-panel"><div className="field-title"><span>INVITATIONAL FIELD</span><small>SEVEN INVITED CHANNELS</small></div><div className="field-list">{d.invitational.field.map((s, i) => <div className="field-member" key={s.handle}><span>0{i + 1}</span><b>{s.handle}</b><small>{s.followers.toLocaleString("en-GB")} followers</small><strong>AVG {s.avg}</strong></div>)}</div>
              {d.invitational.result ? <p>{d.invitational.result.wins >= 3 ? "You won the Invitational!" : `You won ${d.invitational.result.wins} match${d.invitational.result.wins === 1 ? "" : "es"}.`} Prize: {money(d.invitational.result.prizePence)}.</p> : d.invitational.open ? <button className="button-gold" type="button" disabled={!canGo || live.isPending} onClick={() => live.mutate({ dayOfWeek: pick!, format: "INVITATIONAL" }, { onSuccess: s => navigate(`/career/${id}/streaming/${s.id}`), onError: e => setMessage(errorMessage(e)) })}>Play the Invitational{pick ? ` on ${dayLabel(pick)}` : ""} <ArrowUpRight aria-hidden /></button> : <p>Entry opens at week {d.invitational.fromWeek}. {d.invitational.why}</p>}</div>
          </section>
          <footer className="studio-footer"><span>DARTCAST <b>CREATOR STUDIO</b></span><span>SEASON {d.season} · WEEK {d.week} <i /> {d.handle.toUpperCase()}</span></footer>
        </div>
      </div>
    </main>
  );
}
