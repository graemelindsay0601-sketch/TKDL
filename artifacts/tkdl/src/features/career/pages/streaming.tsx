import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, Eye, Loader2, Radio, Search, Trophy, Users } from "lucide-react";
import { useAnswerBrandDeal, useGoLive, useSetSubGoal, useStreaming, errorMessage, type StreamFormat } from "../api";
import { CareerError, CareerLoading } from "../components";
import { dayLabel, formatPence } from "../model";
import type { ShellContext } from "../shell";
import "./streaming.css";

/** DartCast: a made-up darts streaming site. Your channel, the streamer route, going live and your past streams. */
export function StreamingPage({ ctx }: { ctx: ShellContext }) {
  const id = ctx.save.id, q = useStreaming(id), live = useGoLive(id), answer = useAnswerBrandDeal(id), goal = useSetSubGoal(id);
  const [format, setFormat] = useState<StreamFormat | null>(null);
  const [goalTarget, setGoalTarget] = useState<number | null>(null);
  const [promise, setPromise] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const [night, setNight] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  if (q.isLoading) return <CareerLoading />;
  if (q.error || !q.data) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data, retired = !!ctx.save.retiredAt;
  const pick = night ?? d.freeNights[0] ?? null;
  const progress = d.next ? Math.min(100, Math.round(d.followers / d.next.followers * 100)) : 100;
  const chosen = format ?? d.pollPick ?? "CHALLENGER";
  const crowd = (c: number) => c >= 1.15 ? "Big crowd" : c >= 0.95 ? "Normal crowd" : c >= 0.8 ? "Smaller crowd" : "Quiet night";
  const goalThisMonth = d.subGoal && d.subGoal.season === d.season && d.subGoal.endsWeek >= d.week;
  const chosenOk = !d.formats.find(f => f.key === chosen)?.why;
  const canGo = !retired && !d.live && d.streamsThisWeek < d.perWeek && pick !== null;
  return (
    <div className="dc">
      <header className="dc__bar">
        <span className="dc__logo"><Radio aria-hidden /> Dart<b>Cast</b></span>
        <span className="dc__search" aria-hidden><Search /> Search darts streams</span>
        {d.live ? <Link className="dc__live-btn" href={`/career/${id}/streaming/${d.live}`}>Back to your stream</Link> : null}
      </header>
      <section className="dc__channel">
        <div className="dc__avatar" aria-hidden>{d.handle.slice(0, 2).toUpperCase()}</div>
        <div className="dc__who">
          <h1>{d.handle}</h1>
          <p><b>{d.followers.toLocaleString("en-GB")}</b> followers · <span className="dc__tier" data-tier={d.tier.key}>{d.tier.name}</span>
            {" "}· {d.totals.streams} stream{d.totals.streams === 1 ? "" : "s"} · {formatPence(d.totals.earnedPence)} earned · beat {d.totals.won} challenger{d.totals.won === 1 ? "" : "s"}</p>
        </div>
      </section>
      {(d.subscribers > 0 || d.deal || d.dealOffer || d.invitations || d.charity.raisedPence > 0) && <section className="dc__panel">
        <h2>Channel money</h2>
        {d.subscribers > 0 && <p className="dc__note"><b>{d.subscribers.toLocaleString("en-GB")}</b> subscriber{d.subscribers === 1 ? "" : "s"} renew at the end of week {d.renewsWeek} ({formatPence(Math.round(d.subscribers * 125))} if they all stay).
          {" "}Stream at least once a month or more of them drift away.</p>}
        {d.dealOffer && <div className="dc__deal" role="group" aria-label="Brand offer">
          <p><b>{d.dealOffer.brand}</b> ({d.dealOffer.what}) wants their name on your stream: <b>{formatPence(d.dealOffer.perStreamPence)} a stream</b> for your next {d.dealOffer.streamsTotal} streams.
            {" "}Answer by week {d.dealOffer.expiresWeek}.</p>
          <button type="button" className="dc__go" disabled={answer.isPending} onClick={() => answer.mutate({ dealId: d.dealOffer!.id, accept: true }, { onError: e => setMessage(errorMessage(e)) })}>Take the deal</button>
          <button type="button" className="dc__link" disabled={answer.isPending} onClick={() => answer.mutate({ dealId: d.dealOffer!.id, accept: false }, { onError: e => setMessage(errorMessage(e)) })}>No thanks</button>
        </div>}
        {d.deal && <p className="dc__note">Brand deal with <b>{d.deal.brand}</b>: {formatPence(d.deal.perStreamPence)} a stream, {d.deal.streamsDone} of {d.deal.streamsTotal} streams done.</p>}
        {d.charity.raisedPence > 0 && <p className="dc__note">Raised for charity on stream: <b>{formatPence(d.charity.raisedPence)}</b>.</p>}
        {d.invitations && <p className="dc__note">You're a DartCast Star: the televised invitationals send you invitations. Look for them in the calendar.</p>}
      </section>}
      {d.goalOptions && <section className="dc__panel">
        <h2>Sub goal</h2>
        {d.subGoal && <p className="dc__note">{d.subGoal.status === "ON" ? <>This month (to week {d.subGoal.endsWeek}): <b>{d.subGoal.progress} of {d.subGoal.target} subs</b>. Your promise: {d.subGoal.promise}.</>
          : d.subGoal.status === "HIT" ? <>Goal hit: {d.subGoal.target} subs, and the buzz won you followers. Time to keep that promise: {d.subGoal.promise}.</>
          : <>Last month's goal of {d.subGoal.target} subs was missed ({d.subGoal.progress}).</>}</p>}
        {!goalThisMonth && <div className="dc__goal">
          <p className="dc__note">Set a goal for this month: hit it and the buzz wins you followers.</p>
          <div className="dc__nights" role="radiogroup" aria-label="Sub target">{d.goalOptions.targets.map(t => <button key={t} type="button" role="radio" aria-checked={goalTarget === t} className="dc__night" onClick={() => setGoalTarget(t)}>{t} subs</button>)}</div>
          <div className="dc__nights" role="radiogroup" aria-label="Your promise">{d.goalOptions.promises.map(p => <button key={p} type="button" role="radio" aria-checked={promise === p} className="dc__night" onClick={() => setPromise(p)}>{p}</button>)}</div>
          <button type="button" className="dc__go" disabled={goalTarget === null || promise === null || goal.isPending}
            onClick={() => goal.mutate({ target: goalTarget!, promise: promise! }, { onError: e => setMessage(errorMessage(e)) })}>Set the goal</button>
        </div>}
      </section>}
      <section className="dc__panel">
        <h2>Go live</h2>
        <p className="dc__note">Pick what to stream and a free night this week. Chat reacts to every visit. A stream night is booked like any other: no events that night.
          {" "}Up to {d.perWeek} a week ({d.streamsThisWeek} so far).</p>
        <div className="dc__formats" role="radiogroup" aria-label="What to stream">
          {d.formats.map(f => <button key={f.key} type="button" role="radio" aria-checked={chosen === f.key} className="dc__format" disabled={!!f.why} onClick={() => setFormat(f.key)}>
            <b>{f.name}{d.pollPick === f.key ? " · chat's pick" : ""}</b><span>{f.blurb}</span>
            <small data-crowd={f.crowd >= 1.15 ? "big" : f.crowd < 0.8 ? "quiet" : undefined}>{f.why ?? `${crowd(f.crowd)}${d.lastFormat === f.key ? " (you did this last time)" : ""}`}</small></button>)}
        </div>
        {d.freeNights.length ? <div className="dc__nights" role="radiogroup" aria-label="Night to stream">
          {d.freeNights.map(n => <button key={n} type="button" role="radio" aria-checked={pick === n} className="dc__night" onClick={() => setNight(n)}>{dayLabel(n)}</button>)}
        </div> : <p className="dc__note">No free nights left this week.</p>}
        <button type="button" className="dc__go" disabled={!canGo || !chosenOk || live.isPending}
          onClick={() => live.mutate({ dayOfWeek: pick!, format: chosen }, { onSuccess: s => navigate(`/career/${id}/streaming/${s.id}`), onError: e => setMessage(errorMessage(e)) })}>
          {live.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Radio aria-hidden />} Go live{pick ? ` on ${dayLabel(pick)}` : ""}</button>
        {message && <p className="dc__warn" role="alert">{message}</p>}
      </section>
      <section className="dc__panel">
        <h2>DartCast Invitational</h2>
        <p className="dc__note">Once a season, from week {d.invitational.fromWeek}: the season's top seven streamers and you, knockout, first to 2 legs, on one big stream.
          {" "}Prize money: {d.invitational.prizePence.map(p => formatPence(p)).join(" / ")} (out in the quarters / semis / final / winner).</p>
        <ol className="dc__field">{d.invitational.field.map(f => <li key={f.handle}><b>{f.handle}</b> <small>{f.followers.toLocaleString("en-GB")} followers · averages {f.avg}</small></li>)}</ol>
        {d.invitational.result ? <p className="dc__note"><b>{d.invitational.result.wins >= 3 ? "You won the Invitational!" : `You won ${d.invitational.result.wins} match${d.invitational.result.wins === 1 ? "" : "es"}.`}</b> Prize: {formatPence(d.invitational.result.prizePence)}.</p>
          : d.invitational.open ? <button type="button" className="dc__go" disabled={!canGo || live.isPending}
            onClick={() => live.mutate({ dayOfWeek: pick!, format: "INVITATIONAL" }, { onSuccess: s => navigate(`/career/${id}/streaming/${s.id}`), onError: e => setMessage(errorMessage(e)) })}>
            Play the Invitational{pick ? ` on ${dayLabel(pick)}` : ""}</button>
          : <p className="dc__note">{d.invitational.why}</p>}
      </section>
      <section className="dc__panel">
        <h2>Collabs</h2>
        <p className="dc__note">Play another streamer live on both channels: their viewers tune in, and the winner takes a share of the other's audience. They'll only collab with a channel near their size, once a season.
          {pick ? ` Goes out on ${dayLabel(pick)}.` : ""}</p>
        <ul className="dc__collabs">{d.collabs.map(c => <li key={c.key} data-ok={c.ok || undefined}>
          <div><b>{c.handle}</b><small>{c.followers.toLocaleString("en-GB")} followers · averages about {c.avg}</small><span>{c.blurb}</span></div>
          {c.ok ? <button type="button" className="dc__go" disabled={!canGo || live.isPending}
            onClick={() => live.mutate({ dayOfWeek: pick!, format: "COLLAB", streamer: c.key }, { onSuccess: s => navigate(`/career/${id}/streaming/${s.id}`), onError: e => setMessage(errorMessage(e)) })}>Collab</button>
            : <em>{c.why}</em>}
        </li>)}</ul>
      </section>
      {d.clips.length > 0 && <section className="dc__panel">
        <h2>Clips</h2>
        <ul className="dc__clips">{d.clips.map(c => <li key={c.id} data-status={c.status}>
          <div className="dc__thumb" data-result={c.status === "VIRAL" ? "WON" : "NONE"}><span>{c.title}</span>{c.status === "VIRAL" ? <em>VIRAL</em> : null}</div>
          <p><b>{c.title}</b><small>S{c.season} Wk {c.week} · {c.status === "NEW" ? "out this week: will it go viral?" : `${c.views.toLocaleString("en-GB")} views`}
            {c.followersGained ? ` · +${c.followersGained.toLocaleString("en-GB")} followers · +${c.fansGained.toLocaleString("en-GB")} fans` : ""}</small></p>
        </li>)}</ul>
      </section>}
      <section className="dc__panel">
        <h2>The streamer route</h2>
        <p className="dc__note">Another way up in darts: build an audience. {d.next ? `${(d.next.followers - d.followers).toLocaleString("en-GB")} more followers to ${d.next.name}.` : "You've made it to the top."}</p>
        <div className="dc__progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to the next step"><span style={{ width: `${progress}%` }} /></div>
        <ol className="dc__tiers">{d.tiers.map(t => <li key={t.key} data-reached={t.reached || undefined}>
          <b>{t.reached ? <Check aria-hidden /> : null}{t.name}</b><small>{t.followers ? `${t.followers.toLocaleString("en-GB")} followers` : "Start here"}</small><span>{t.perks}</span></li>)}</ol>
      </section>
      <section className="dc__panel">
        <h2>Videos</h2>
        {d.videos.length ? <ul className="dc__videos">{d.videos.map(v => <li key={v.id}>
          <div className="dc__thumb" data-result={v.result ?? "NONE"}><span>{v.format === "CHALLENGER" ? `vs ${v.challenger}` : v.title}</span><em>{v.result === "WON" ? "WON" : v.result === "LOST" ? "LOST" : "ENDED"}</em></div>
          <p><b>{v.result === "WON" ? <Trophy aria-hidden /> : null}{v.title}</b>
            <small>S{v.season} Wk {v.week} · {dayLabel(v.dayOfWeek)} · <Eye aria-hidden /> {v.peak} peak · <Users aria-hidden /> +{v.followersGained} · {formatPence(v.incomePence)}</small></p>
        </li>)}</ul> : <p className="dc__note">No streams yet. Your first one starts above.</p>}
      </section>
    </div>
  );
}
