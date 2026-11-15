import { useState } from "react";
import { Clapperboard, Lightbulb, Map as MapIcon, Mic, Rocket, Tv, Warehouse } from "lucide-react";
import { errorMessage, useBuyStudioSet, useSetStreamLook, useMakeShort, usePostVlog, useRecordPodcast, useWatchAlong, type StreamingView } from "../api";
import { dayLabel, formatPence } from "../model";
import "./stream-community.css";

/**
 * Content beyond going live: VODs that keep earning, Shorts cut from your clips, a weekly podcast with a guest from the
 * scene, watch-alongs of real televised events, and studio sets that make each kind of show more watchable.
 */
export function ContentSection({ saveId, d, night, canGo, retired, onWatched }: { saveId: string; d: StreamingView; night: number | null; canGo: boolean; retired: boolean;
  onWatched: (streamId: string) => void }) {
  const c = d.content;
  const short = useMakeShort(saveId), pod = useRecordPodcast(saveId), set = useBuyStudioSet(saveId), watch = useWatchAlong(saveId), vlog = usePostVlog(saveId), look = useSetStreamLook(saveId);
  const [guest, setGuest] = useState(""), [topic, setTopic] = useState("STORY"), [boost, setBoost] = useState(false), [message, setMessage] = useState("");
  if (!c) return null;
  const fail = (e: unknown) => setMessage(errorMessage(e)), ok = () => setMessage("");
  const guestPick = guest || c.podcast.guests.find(g => g.ok)?.key || "";
  return <section className="sc-panel" id="content" aria-labelledby="content-title">
    <div className="sc-head"><div><span className="sc-eyebrow"><b>08</b> / CONTENT · BETWEEN STREAMS</span><h2 id="content-title">Content</h2>
      <p>Your streams live on as VODs, clips become Shorts, and the podcast and watch-alongs keep the channel busy on nights you're not throwing.</p></div>
      <div className="sc-stats"><span><Clapperboard aria-hidden /> <span><b>{c.vods.live}</b> VOD{c.vods.live === 1 ? "" : "s"} earning · {formatPence(c.vods.earnedPence)} so far</span></span></div></div>
    <div className="sc-content-grid">
      <article className="sc-card"><h3><Rocket aria-hidden /> Shorts</h3>
        <p className="sc-note">Cut a clip into a Short: lots of new eyes, very little money. One boost a week ({formatPence(c.shorts.boostPence)}) reaches far more people.</p>
        {c.shorts.makeable.length ? <ul className="sc-rows">{c.shorts.makeable.map(m => <li key={m.clipId}><span>{m.title}</span>
          <button type="button" disabled={retired || short.isPending} onClick={() => short.mutate({ clipId: m.clipId, boost: boost && !c.shorts.boostUsed }, { onSuccess: ok, onError: fail })}>Make Short</button></li>)}</ul>
          : <p className="sc-note">No clips waiting. Big moments on stream get clipped automatically.</p>}
        {c.shorts.makeable.length > 0 && <label className="sc-check"><input type="checkbox" checked={boost && !c.shorts.boostUsed} disabled={c.shorts.boostUsed} onChange={e => setBoost(e.target.checked)} />
          {c.shorts.boostUsed ? "This week's boost is used" : "Boost the next one"}</label>}
        {c.shorts.list.length > 0 && <ul className="sc-rows sc-rows--quiet">{c.shorts.list.map(x => <li key={x.id}><span>{x.title}{x.boosted ? " · boosted" : ""}</span>
          <small>{x.status === "NEW" ? "out this week" : `${x.views.toLocaleString("en-GB")} views · +${x.followers}`}</small></li>)}</ul>}
      </article>
      <article className="sc-card"><h3><Mic aria-hidden /> The podcast</h3>
        {c.podcast.thisWeek ? <p className="sc-note">This week: <b>{c.podcast.thisWeek.topic}</b> with {c.podcast.thisWeek.guest}. {c.podcast.thisWeek.listeners.toLocaleString("en-GB")} listeners, +{c.podcast.thisWeek.followers} followers{c.podcast.thisWeek.sponsorPence ? `, ${formatPence(c.podcast.thisWeek.sponsorPence)} sponsor read` : ""}.</p> : <>
          <p className="sc-note">One episode a week, extra to your stream nights. Friends always say yes; bigger names want to know you first. Episodes so far: {c.podcast.episodes}.</p>
          {!c.podcast.guests.some(g => g.ok) && <p className="sc-note">Nobody will come on just yet: collab with, raid or meet creators in a cup first, or grow the channel a little.</p>}
          <label className="sc-field-label">Guest<select value={guestPick} onChange={e => setGuest(e.target.value)}>
            <optgroup label="Creators">{c.podcast.guests.map(g => <option key={g.key} value={g.key} disabled={!g.ok}>{g.handle} ({g.followers.toLocaleString("en-GB")}){g.ok ? "" : ` · ${g.why}`}</option>)}</optgroup>
            {c.podcast.pros?.length > 0 && <optgroup label="Pros (fans for your darts career)">{c.podcast.pros.map(p => <option key={p.key} value={p.key} disabled={!p.ok}>
              {p.handle}{p.rank ? ` · world #${p.rank}` : ""}{p.meetings ? ` · you're ${p.record}${p.rival ? " (rival)" : ""}` : ""}{p.ok ? "" : ` · ${p.why}`}</option>)}</optgroup>}
          </select></label>
          <label className="sc-field-label">Topic<select value={topic} onChange={e => setTopic(e.target.value)}>{c.podcast.topics.map(t => <option key={t.key} value={t.key}>{t.name}: {t.blurb}</option>)}</select></label>
          <button type="button" className="sc-enter" disabled={retired || pod.isPending || !guestPick} onClick={() => pod.mutate({ guest: guestPick, topic }, { onSuccess: ok, onError: fail })}><Mic aria-hidden /> Record the episode</button>
        </>}
      </article>
      <article className="sc-card"><h3><Tv aria-hidden /> Watch-alongs</h3>
        <p className="sc-note">Co-stream a televised event that's just finished: a big room, no darts, chat reacting to the real result. Uses a stream night.</p>
        {c.watchAlongs.length ? <ul className="sc-rows">{c.watchAlongs.map(e => <li key={e.eventId}><span>{e.name}<small> · won by {e.champion}</small></span>
          {e.done ? <small>Watched</small> : <button type="button" disabled={!canGo || watch.isPending} onClick={() => watch.mutate({ eventId: e.eventId, dayOfWeek: night! }, { onSuccess: s => onWatched(s.id), onError: fail })}>Watch along{night ? ` on ${dayLabel(night)}` : ""}</button>}</li>)}</ul>
          : <p className="sc-note">No televised event has finished this week or last.</p>}
      </article>
      {c.vlogs && <article className="sc-card"><h3><MapIcon aria-hidden /> Tour vlogs</h3>
        <p className="sc-note">Life on the road between the darts: cut a vlog from an event you've just played or a road trip. Bigger events travel further; an editor helps.</p>
        {c.vlogs.available.length ? <ul className="sc-rows">{c.vlogs.available.map(x => <li key={x.source}><span><b>{x.title}</b></span>
          <button type="button" disabled={retired || vlog.isPending} onClick={() => vlog.mutate(x.source, { onSuccess: ok, onError: fail })}>Post it</button></li>)}</ul>
          : <p className="sc-note">Nothing to vlog right now: play an event or take a road trip, then come back within {4} weeks.</p>}
        {c.vlogs.posted.length > 0 && <ul className="sc-rows">{c.vlogs.posted.map(x => <li key={x.title + x.week}><span><b>{x.title}</b><small> · S{x.season} wk {x.week}</small></span>
          <small>{x.views.toLocaleString("en-GB")} views · +{x.followers} · {formatPence(x.pence)}</small></li>)}</ul>}
      </article>}
      {d.look && <article className="sc-card"><h3><Lightbulb aria-hidden /> Studio look</h3>
        <p className="sc-note">Set dressing changes how your stream looks; better lighting makes every show a little more watchable. Buy once, switch any time.</p>
        <ul className="sc-rows">{d.look.themes.map(t => <li key={t.key}><span><i className="sc-swatch" style={{ background: t.accent }} aria-hidden /> <b>{t.name}</b><small> · {t.blurb}</small></span>
          {d.look.theme === t.key ? <small>On show</small> : <button type="button" disabled={retired || look.isPending} onClick={() => look.mutate(t.key, { onSuccess: ok, onError: fail })}>
            {t.owned || !t.costPence ? "Use it" : `Buy · ${formatPence(t.costPence)}`}</button>}</li>)}</ul>
        <ul className="sc-rows">{d.look.lights.map(l => <li key={l.key}><span><b>{l.name}</b><small>{l.bonusPercent ? ` · +${l.bonusPercent}% viewers` : ""}</small></span>
          {d.look.lighting === l.key ? <small>In use</small> : <button type="button" disabled={retired || look.isPending} onClick={() => look.mutate(l.key, { onSuccess: ok, onError: fail })}>
            {l.owned || !l.costPence ? "Use it" : `Buy · ${formatPence(l.costPence)}`}</button>}</li>)}</ul>
      </article>}
      <article className="sc-card"><h3><Warehouse aria-hidden /> Studio sets</h3>
        <ul className="sc-rows">{c.sets.map(x => <li key={x.key}><span><b>{x.name}</b><small> · +{x.bonusPercent}% crowd for {x.formats.map(f => f.toLowerCase().replace(/_/g, " ")).join(", ")}</small></span>
          {x.owned ? <small>Built</small> : <button type="button" disabled={retired || set.isPending} onClick={() => set.mutate(x.key, { onSuccess: ok, onError: fail })}>Build · {formatPence(x.costPence)}</button>}</li>)}</ul>
      </article>
    </div>
    {message && <p className="sc-error" role="alert">{message}</p>}
  </section>;
}
