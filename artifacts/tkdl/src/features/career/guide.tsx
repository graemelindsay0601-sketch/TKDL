import { useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Compass, Loader2, MapPin, Sparkles, Sun } from "lucide-react";
import { useCareerFocus, useCareerProfile, useChooseHome, useEnterEvent, useGuide, errorMessage } from "./api";
import { HOME_REGIONS, dayName, denialLabel } from "./model";
import type { CalendarOverview, CareerSave, GuideAction, GuideFocus, GuideView } from "./types";
import "./guide.css";
import { Walkthrough } from "./glossary";

const askedKey = (saveId: string) => `tkdl-career-guide-path-asked:${saveId}`;
const asked = (saveId: string) => { try { return localStorage.getItem(askedKey(saveId)) === "1"; } catch { return true; } };
const markAsked = (saveId: string) => { try { localStorage.setItem(askedKey(saveId), "1"); } catch { /* this device only */ } };

/** One action: enter an event in place, or go somewhere. */
function ActionButton({ saveId, action, primary, onEntered }: { saveId: string; action: GuideAction; primary?: boolean; onEntered: (msg: string) => void }) {
  const enter = useEnterEvent(saveId);
  const cls = `career-btn ${primary ? "career-btn-gold" : "career-btn-ghost"} guide-action`;
  if (action.enterEventId) return <button type="button" className={cls} disabled={enter.isPending}
    onClick={() => enter.mutate(action.enterEventId!, {
      onSuccess: r => onEntered(r.entered ? "Entered. It's in your week now." : r.denials.map(denialLabel).join(" · ")),
      onError: e => onEntered(errorMessage(e)) })}>
    {enter.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}{action.label}</button>;
  return action.href ? <Link href={action.href} className={cls}>{action.label} <ArrowRight aria-hidden /></Link> : null;
}

/** Saves that never chose a home play out of Ayrshire: say so, and let the player pick their real home once. */
function HomeClubLine({ saveId }: { saveId: string }) {
  const profile = useCareerProfile(saveId), choose = useChooseHome(saveId);
  const [open, setOpen] = useState(false), [home, setHome] = useState("ayrshire");
  if (profile.data?.status !== "COMPLETE" || profile.data.homeLocality) return null;
  return <p className="guide-home">
    You play out of <b>Kilbirnie, Ayrshire</b> (the default): your club, local nights and money matches are there.{" "}
    {open ? <span className="guide-home__pick">
      <select value={home} onChange={e => setHome(e.target.value)} aria-label="Home area">{HOME_REGIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select>
      <button type="button" className="career-btn career-btn-gold" disabled={choose.isPending} onClick={() => choose.mutate(home)}>Make it my home</button>
      <small>You can only choose once.</small>
      {choose.error && <small role="alert">{errorMessage(choose.error)}</small>}
    </span> : <button type="button" className="guide-link" onClick={() => setOpen(true)}>Choose your home area</button>}
  </p>;
}

/** First time on a save: which career do you want? (Changeable any time from the path card.) */
function PathPicker({ saveId, guide, onDone }: { saveId: string; guide: GuideView; onDone: () => void }) {
  const focus = useCareerFocus(saveId);
  const pick = (key: GuideFocus) => focus.mutate(key, { onSettled: () => { markAsked(saveId); onDone(); } });
  return <section className="guide-card guide-picker" aria-labelledby="guide-picker-title">
    <h2 id="guide-picker-title"><Compass aria-hidden /> What do you want from this career?</h2>
    <p>Pick a path and the guide will point you at the right events and tell you what each step needs. You can change it any time.</p>
    <div className="guide-picker__grid">
      {guide.paths.map(p => <button key={p.key} type="button" className="guide-picker__option" data-current={p.key === guide.path.focus || undefined}
        disabled={focus.isPending} onClick={() => pick(p.key)}><b>{p.label}</b><small>{p.blurb}</small></button>)}
    </div>
    <button type="button" className="guide-link" onClick={() => { markAsked(saveId); onDone(); }}>Decide later</button>
  </section>;
}

/** The path: every stage as a step, the current one opened up with what it needs and how to get there. */
function PathCard({ saveId, guide, onChange }: { saveId: string; guide: GuideView; onChange: () => void }) {
  const [all, setAll] = useState(false);
  const { path } = guide, cur = path.current;
  const shown = all ? path.stages : path.stages.filter((s, i, a) => s.current || (a[i + 1]?.current) || (a[i - 1]?.current)
    || (!cur && i >= a.length - 2));
  return <section className="guide-card guide-path" aria-labelledby="guide-path-title">
    <header className="guide-card__head">
      <h2 id="guide-path-title"><MapPin aria-hidden /> Your path: {path.label}</h2>
      <button type="button" className="guide-link" onClick={onChange}>Change</button>
    </header>
    <div className="guide-path__bar" role="progressbar" aria-valuemin={0} aria-valuemax={path.total} aria-valuenow={path.done} aria-label={`${path.done} of ${path.total} steps done`}>
      <span style={{ width: `${(path.done / Math.max(1, path.total)) * 100}%` }} />
    </div>
    <small className="guide-muted">{path.done} of {path.total} steps done</small>
    <ol className="guide-path__stages">
      {shown.map(s => <li key={s.key} data-done={s.done || undefined} data-current={s.current || undefined}>
        {s.done ? <CheckCircle2 aria-hidden /> : <Circle aria-hidden />}
        <div>
          <b>{s.title}</b>
          {s.current && <>
            <p>{s.how}</p>
            {s.progress && <p className="guide-path__progress">{s.progress}</p>}
            <p className="guide-muted">Unlocks: {s.unlocks}</p>
          </>}
        </div>
      </li>)}
    </ol>
    <button type="button" className="guide-link" onClick={() => setAll(!all)}>{all ? "Show less" : `See the whole path (${path.total} steps)`}</button>
  </section>;
}

/**
 * The Career Guide (Home's top): where you are (week and day), what's waiting on you, the three best things to do next,
 * your path and what you've let slip by. Everything else on Home is below it.
 */
export function CareerGuide({ save, overview, children }: { save: CareerSave; overview?: CalendarOverview | null; children?: React.ReactNode }) {
  const q = useGuide(save.id, save.status === "ACTIVE");
  const [picking, setPicking] = useState(false), [dismissed, setDismissed] = useState(false), [msg, setMsg] = useState("");
  // While the guide loads, the day is already known from the header's overview: show it straight away.
  if (q.isLoading) return <div className="career-guide">
    <section className="guide-card guide-today" aria-busy>
      <p className="guide-today__date"><Sun aria-hidden /> Season {save.currentSeason} · Week {save.currentWeek}</p>
      <h2 className="guide-today__day">{dayName(overview?.today?.dayOfWeek ?? 1)}</h2>
      <p className="guide-muted"><Loader2 className="animate-spin" aria-hidden /> Working out your next steps…</p>
    </section>
    {children}
  </div>;
  if (!q.data) return null;
  const g = q.data, t = g.today;
  // The guide keeps six weeks of missed chances (the results card after a long skip uses them); Today shows the last two.
  const recentMissed = g.missed.filter(m => m.week >= t.week - 2);
  const showPicker = picking || (!dismissed && !asked(save.id) && g.path.focus === "OPEN_SCHEDULE");
  return <div className="career-guide">
    <Walkthrough saveId={save.id} />
    <section className="guide-card guide-today" aria-labelledby="guide-today-title">
      <p className="guide-today__date"><Sun aria-hidden /> Season {t.season} · Week {t.week}</p>
      <h2 id="guide-today-title" className="guide-today__day">{t.dayName}{t.phase === "MID_WEEK" ? <small> (rest of the week played)</small> : null}</h2>
      <p className="guide-today__headline">{t.headline}</p>
      <HomeClubLine saveId={save.id} />
      {t.waitingOn.length > 0 && <p className="guide-today__waiting">Waiting on: {t.waitingOn.map(w => w.label).join(" · ")} (see step 1 below)</p>}
      {t.options.length > 0 && <div className="guide-today__tonight">
        <b>On tonight you can enter</b>
        <ul>{t.options.map(o => <li key={o.id}><span>{o.name}<small>{o.detail}{o.fits ? " · fits your path" : ""}</small></span>
          <ActionButton saveId={save.id} action={{ label: "Enter", enterEventId: o.id }} onEntered={setMsg} /></li>)}</ul>
      </div>}
      {t.phase === "START_OF_WEEK" && t.laterThisWeek > 0 && <p className="guide-muted">{t.laterThisWeek} more event{t.laterThisWeek === 1 ? "" : "s"} later this week: see the planner below.</p>}
    </section>

    {g.nextSteps.length > 0 && <section className="guide-card guide-steps" aria-labelledby="guide-steps-title">
      <h2 id="guide-steps-title"><Sparkles aria-hidden /> What to do next</h2>
      <ol>{g.nextSteps.map((s, i) => <li key={s.key} data-tone={s.tone}>
        <span className="guide-steps__n" aria-hidden>{i + 1}</span>
        <div><b>{s.title}</b><p>{s.why}</p></div>
        <ActionButton saveId={save.id} action={s.action} primary={i === 0} onEntered={setMsg} />
      </li>)}</ol>
      {msg && <p className="guide-msg" role="status">{msg}</p>}
    </section>}

    {showPicker ? <PathPicker saveId={save.id} guide={g} onDone={() => { setPicking(false); setDismissed(true); }} /> : null}

    {children}

    {!showPicker && <PathCard saveId={save.id} guide={g} onChange={() => setPicking(true)} />}

    {(g.closing.length > 0 || recentMissed.length > 0) && <section className="guide-card guide-chances" aria-labelledby="guide-chances-title">
      <h2 id="guide-chances-title"><AlertTriangle aria-hidden /> Don't miss out</h2>
      {g.closing.length > 0 && <><b className="guide-chances__label">Entries close this week</b>
        <ul>{g.closing.map(c => <li key={c.id}><Link href={c.href}>{c.name}</Link><small>{c.when}</small></li>)}</ul></>}
      {recentMissed.length > 0 && <><b className="guide-chances__label">You missed these (they fitted your path)</b>
        <ul>{recentMissed.map(m => <li key={m.id}><span>{m.name}</span><small>{m.when}</small></li>)}</ul>
        <p className="guide-muted">Book ahead in the week planner so the next ones don't slip by.</p></>}
    </section>}
  </div>;
}
