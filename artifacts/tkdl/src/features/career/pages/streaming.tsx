import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, Eye, Loader2, Radio, Search, Trophy, Users } from "lucide-react";
import { useAnswerBrandDeal, useGoLive, useStreaming, errorMessage } from "../api";
import { CareerError, CareerLoading } from "../components";
import { dayLabel, formatPence } from "../model";
import type { ShellContext } from "../shell";
import "./streaming.css";

/** DartCast: a made-up darts streaming site. Your channel, the streamer route, going live and your past streams. */
export function StreamingPage({ ctx }: { ctx: ShellContext }) {
  const id = ctx.save.id, q = useStreaming(id), live = useGoLive(id), answer = useAnswerBrandDeal(id);
  const [, navigate] = useLocation();
  const [night, setNight] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  if (q.isLoading) return <CareerLoading />;
  if (q.error || !q.data) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data, retired = !!ctx.save.retiredAt;
  const pick = night ?? d.freeNights[0] ?? null;
  const progress = d.next ? Math.min(100, Math.round(d.followers / d.next.followers * 100)) : 100;
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
      {(d.subscribers > 0 || d.deal || d.dealOffer || d.invitations) && <section className="dc__panel">
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
        {d.invitations && <p className="dc__note">You're a DartCast Star: the televised invitationals send you invitations. Look for them in the calendar.</p>}
      </section>}
      <section className="dc__panel">
        <h2>Go live</h2>
        <p className="dc__note">Pick a free night this week. A viewer steps up to play you, first to 2 legs of 501, and chat reacts to every visit. A stream night is booked like any other: no events that night.
          {" "}Up to {d.perWeek} a week ({d.streamsThisWeek} so far).</p>
        {d.freeNights.length ? <div className="dc__nights" role="radiogroup" aria-label="Night to stream">
          {d.freeNights.map(n => <button key={n} type="button" role="radio" aria-checked={pick === n} className="dc__night" onClick={() => setNight(n)}>{dayLabel(n)}</button>)}
        </div> : <p className="dc__note">No free nights left this week.</p>}
        <button type="button" className="dc__go" disabled={!canGo || live.isPending}
          onClick={() => live.mutate(pick!, { onSuccess: s => navigate(`/career/${id}/streaming/${s.id}`), onError: e => setMessage(errorMessage(e)) })}>
          {live.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Radio aria-hidden />} Go live{pick ? ` on ${dayLabel(pick)}` : ""}</button>
        {message && <p className="dc__warn" role="alert">{message}</p>}
      </section>
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
          <div className="dc__thumb" data-result={v.result ?? "NONE"}><span>vs {v.challenger}</span><em>{v.result === "WON" ? "WON" : v.result === "LOST" ? "LOST" : "ENDED"}</em></div>
          <p><b>{v.result === "WON" ? <Trophy aria-hidden /> : null}Stream vs {v.challenger}</b>
            <small>S{v.season} Wk {v.week} · {dayLabel(v.dayOfWeek)} · <Eye aria-hidden /> {v.peak} peak · <Users aria-hidden /> +{v.followersGained} · {formatPence(v.incomePence)}</small></p>
        </li>)}</ul> : <p className="dc__note">No streams yet. Your first one starts above.</p>}
      </section>
    </div>
  );
}
