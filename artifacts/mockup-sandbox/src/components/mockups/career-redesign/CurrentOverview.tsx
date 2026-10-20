import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUpRight, Award, Bell, CalendarDays, Flag, History, Medal,
  Newspaper, Target, TrendingUp, Trophy, X,
} from "lucide-react";
import "./_group.css";

const link = "#career-preview";

function Attention() {
  const [open, setOpen] = useState(false);
  return (
    <div className="career-attention-wrap">
      <button type="button" className="career-attention-trigger" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <Bell size={17} aria-hidden /><span>Attention</span><span className="career-inbox-count" title="Known actions — open to check all updates">2</span>
      </button>
      {open && <section className="career-attention-panel" aria-label="Career attention">
        <header className="career-attention-panel-header">
          <div><span className="career-eyebrow">Career updates</span><h2>Attention</h2><p>Your next steps and recent activity.</p></div>
          <div><span className="career-attention-total">2 actions</span>{" "}
            <button type="button" className="career-attention-close" aria-label="Close Career attention" onClick={() => setOpen(false)}><X size={17} aria-hidden /></button></div>
        </header>
        <div className="career-attention-content">
          <section className="career-attention-group">
            <h3>Action required</h3>
            <a className="is-action" href={link}><Bell size={14} aria-hidden /><span>Season Review waiting</span></a>
            <a className="is-action" href={link}><CalendarDays size={14} aria-hidden /><span>Entry window · East Midlands Open<small>Entry closes this week</small></span></a>
          </section>
          <section className="career-attention-group">
            <h3>Career updates</h3>
            <a href={link}><Trophy size={14} aria-hidden /><span>First ranking recorded</span><small>Season 1</small></a>
            <a href={link}><Trophy size={14} aria-hidden /><span>First event title</span><small>Season 1</small></a>
          </section>
          <section className="career-attention-group">
            <h3>World news</h3>
            <a href={link}><Newspaper size={14} aria-hidden /><span>North returns to winning form ahead of the majors</span></a>
            <a href={link}>Explore Darts World <ArrowUpRight size={14} aria-hidden /></a>
          </section>
        </div>
      </section>}
    </div>
  );
}

function Section({ title, icon, accent, action, children }: {
  title: string; icon: ReactNode; accent: string; action?: string; children: ReactNode;
}) {
  return <section className="career-section" style={{ "--section-accent": accent } as CSSProperties}>
    <div className="career-section-head"><h2><span aria-hidden>{icon}</span>{title}</h2>{action && <a href={link}>{action} <ArrowUpRight size={14} aria-hidden /></a>}</div>
    {children}
  </section>;
}

export function CurrentOverview() {
  return <main className="career-root">
    <header className="career-header">
      <div className="career-header-main">
        <div className="career-brand">My Career<small>Season 2 · Week 18 · Professional</small></div>
        <span className="career-chip">Slot 1</span>
      </div>
      <div className="career-header-tools"><Attention /><a className="home-text-link" href={link}>Career Guide</a><a className="home-text-link" href={link}>Save health</a></div>
    </header>

    <div className="career-home">
      <section className="career-page-hero" style={{ "--hero-accent": "#ff005c" } as CSSProperties}>
        <div className="career-page-hero__stage">
          <span className="career-page-hero__watermark" aria-hidden="true">S02 · W18</span>
          <div className="career-page-hero__content">
            <div className="career-page-hero__text">
              <p className="career-page-hero__kicker"><i aria-hidden="true" />Career headquarters · Season 2 / Week 18</p>
              <h1 className="career-page-hero__title">Career Headquarters</h1>
              <div className="career-page-hero__subtitle">Professional · Age 24 · “The North Star”</div>
              <div className="career-page-hero__actions">
                <a className="career-btn career-btn-primary" href={link}><CalendarDays size={16} aria-hidden /> Open calendar</a>
                <a className="career-btn career-btn-ghost" href={link}><TrendingUp size={16} aria-hidden /> Rankings</a>
              </div>
            </div>
            <div className="career-page-hero__portrait" aria-hidden="true">
              <svg className="career-shirt" viewBox="0 0 120 140">
                <path d="M32 20 53 12 67 12 88 20 112 39 98 62 85 53 85 126 35 126 35 53 22 62 8 39Z" fill="#20334a" stroke="#ffffff50" strokeWidth="1.5" />
                <path d="M25 50H38V140H25ZM82 50H95V140H82Z" fill="#e9edf0" />
                <path d="M5 37 27 54M93 54 115 37" stroke="#c8a050" strokeWidth="7" />
                <path d="M53 12Q60 30 67 12L72 16Q60 38 48 16Z" fill="#c8a050" />
                <rect x="43" y="61" width="34" height="12" rx="2" fill="#10151e" /><text x="60" y="69" fill="white" fontSize="4.5" textAnchor="middle">NORTHSTAR</text>
              </svg>
            </div>
          </div>
        </div>
        <dl className="career-page-hero__stats" style={{ "--hero-cols": 4 } as CSSProperties}>
          <div className="is-gold"><dt>World rank</dt><dd>18th</dd></div>
          <div className="is-good"><dt>Tour Card</dt><dd>Active</dd><small>Review end of S3</small></div>
          <div><dt>Career balance</dt><dd>£18,420</dd><small>£12,680 available</small></div>
          <div><dt>Sponsor</dt><dd>Northstar Darts</dd></div>
        </dl>
      </section>

      <section className="next-move panel">
        <div className="next-move__kicker"><span className="live-indicator" aria-hidden /> YOUR NEXT MOVE</div>
        <h2 className="next-move__title">Next decision</h2>
        <div className="next-move__lead"><div><strong>East Midlands Open</strong><span>Registration closes this week · Week 19 · £65 estimated cost</span></div>
          <a className="career-btn career-btn-primary" href={link}>Review entry <ArrowUpRight size={14} aria-hidden /></a></div>
        <p className="next-move__empty">No tournament in progress. Your next event decision is ready.</p>
      </section>

      <aside className="home-sponsor-alert"><span><strong>Sponsor decision available</strong><small>Review the offer terms and coverage before your next commitment.</small></span><a href={link}>Review <ArrowUpRight size={14} aria-hidden /></a></aside>

      <section className="pathway-tracker panel" aria-labelledby="pathway-tracker-title">
        <header className="pathway-tracker__head"><div><span className="home-section-kicker">ROUTES THROUGH DARTS</span><h2 id="pathway-tracker-title">Pathway tracker</h2></div><a className="home-text-link" href={link}>All Tour Card routes <ArrowUpRight size={14} aria-hidden /></a></header>
        <p className="pathway-tracker__note">These routes can overlap. Choosing one does not close the others; DartCast is a parallel route, not a sporting qualification.</p>
        <div className="pathway-tracker__grid">
          <article className="pathway-tracker__route"><div><span className="pathway-tracker__eyebrow">SPORTING ROUTE</span><h3>Local &amp; amateur</h3></div><p>Listed: Nottinghamshire Open · week 20. Check event details for your entry status.</p><a href={link}>View local event <ArrowUpRight size={14} aria-hidden /></a></article>
          <article className="pathway-tracker__route"><div><span className="pathway-tracker__eyebrow">SPORTING ROUTE</span><h3>County &amp; national</h3></div><p>Selected for Nottinghamshire county. Next county fixture: week 21 v Derbyshire. No current national selection reported.</p><a href={link}>Club &amp; selection <ArrowUpRight size={14} aria-hidden /></a></article>
          <article className="pathway-tracker__route"><div><span className="pathway-tracker__eyebrow">PARALLEL ROUTE</span><h3>DartCast</h3></div><p>Streamer focus · Tuesday, Friday reserved this week. 2,480 followers · 20 to Copper Creator.</p><a href={link}>Manage stream schedule <ArrowUpRight size={14} aria-hidden /></a></article>
          <article className="pathway-tracker__route"><div><span className="pathway-tracker__eyebrow">PROFESSIONAL ROUTE</span><h3>Tour Card</h3></div><p>Tour Card held for Seasons 2–3.</p><a href={link}>Review routes <ArrowUpRight size={14} aria-hidden /></a></article>
        </div>
      </section>

      <details className="career-note" open><summary>Tour Card routes this season</summary><p>Play wherever suits you. Q-School runs in weeks 2–4 if you can afford it, and the Challenger Tour is open to anyone without a Tour Card this season: finish in its top 2 for a Tour Card. Turning professional is up to you.</p></details>

      <details className="home-more" open>
        <summary className="home-more__summary">More about your Career <span>Guidance, route ahead, goals, schedule and results</span></summary>
        <div className="home-more__body">
          <section className="career-help"><strong>Career headquarters</strong><p>Your next decision is shown first. Career guidance is optional; you remain in control of every entry, route and commitment.</p></section>
          <div className="home-two-column">
            <Section title="The route ahead" icon={<Target size={16} />} accent="#8dc9bc" action="Qualification">
              <div className="home-objective"><span className="home-objective-icon"><Flag size={18} aria-hidden /></span><div><span className="home-objective-label">TOUR CARD RETENTION</span><h3>Finish Season 3 in the World top 64</h3><p>You are 18th — inside the cut with 46 places to spare. The World Ranking is prize money over the last two seasons. Your card runs for two seasons, so this season counts towards the review without deciding it.</p></div><a className="home-text-link" href={link}>Rankings <ArrowUpRight size={14} /></a></div>
            </Section>
            <Section title="Your schedule" icon={<CalendarDays size={16} />} accent="#84c5b2" action="Plan the season">
              <div className="home-opportunity"><div className="home-entry-row"><span>East Midlands Open<small>Week 19 · Registration open · Nottingham</small></span><span className="career-chip">Open for entry</span></div></div>
              <div className="home-opportunity"><div className="home-entry-row"><span>Players Championship 8<small>Week 20 · Entered · Leicester</small></span><span className="career-chip">Confirmed</span></div></div>
            </Section>
          </div>
          <Section title="Career Compass" icon={<Target size={16} />} accent="#dbb866" action="Focus & goals">
            <div className="home-goals">
              <p className="home-focus">Professional growth <span>NEAR-TERM PREFERENCE</span></p>
              <div className="home-main-ambition"><strong>Win a Players Championship</strong><span>Main ambition</span><p>Not done yet. Your next step is below.</p></div>
              <div className="home-compass-opportunities">
                <div className="home-compass-title-row"><span>OPPORTUNITIES THAT FIT YOUR FOCUS</span><a href={link}>Full calendar <ArrowUpRight size={14} /></a></div>
                <article className="home-compass-opportunity is-recommended"><span className="home-compass-kicker">RECOMMENDED OPPORTUNITY</span><span className="home-compass-event-meta">S2 · Day 127 · PROFESSIONAL TOUR</span><h3>Players Championship 8</h3><p className="home-compass-reason">A strong professional field and a direct opportunity to build ranking prize money.</p><p className="home-compass-eligibility">Entered · Registration weeks 16–19 · £2,500 first prize · £140 estimated Career cost</p></article>
                <article className="home-compass-opportunity"><span className="home-compass-kicker">ALTERNATIVE</span><span className="home-compass-event-meta">S2 · Day 135 · PROFESSIONAL TOUR</span><h3>Players Championship 9</h3><p className="home-compass-reason">A second tour date remains available in your current window.</p><p className="home-compass-eligibility">Open for entry · Registration weeks 17–20 · £2,500 first prize · £140 estimated cost</p></article>
                <p className="home-compass-caveat">Guidance only. Check event eligibility, registration, schedule and costs before entering; this recommendation makes no sporting decision for you.</p>
              </div>
              <p className="home-goal-foot">Suggestions only: goals never give you rewards or shortcuts.</p>
            </div>
          </Section>
          <Section title="Entry windows" icon={<CalendarDays size={16} />} accent="#86b8ec" action="Full calendar">
            <div className="home-opportunity"><div className="home-entry-row"><span>East Midlands Open<small>Week 19 · Opens week 16 · Closes week 18</small></span><span className="career-chip">Entry open</span></div></div>
            <div className="home-opportunity"><div className="home-entry-row"><span>Players Championship 9<small>Week 20 · Opens week 17 · Closes week 19</small></span><span className="career-chip">Entry open</span></div></div>
          </Section>
          <div className="home-two-column home-records">
            <Section title="Recent results" icon={<Medal size={16} />} accent="#d8b76a" action="Full history">
              <ul className="home-result-list"><li><a className="home-result-link" href={link}><span className="home-result-season">S2<small>WK 16</small></span><span className="home-result-name"><strong>Players Championship 7</strong><small>Professional Tour · 5W–1L</small></span><span className="career-chip">Quarter Final</span></a></li><li><a className="home-result-link" href={link}><span className="home-result-season">S2<small>WK 13</small></span><span className="home-result-name"><strong>UK Open Qualifier 3</strong><small>Major · 4W–1L</small></span><span className="career-chip">Last 16</span></a></li></ul>
            </Section>
            <Section title="Latest milestones" icon={<Award size={16} />} accent="#c9a96e" action="Achievements">
              <ol className="home-milestones"><li><span className="home-milestone-date">S2<small>WK 14</small></span><span className="home-milestone-mark" aria-hidden /><span><strong>Career high: World #18</strong><small>Reached a new ranking high</small></span></li><li><span className="home-milestone-date">S2<small>WK 09</small></span><span className="home-milestone-mark" aria-hidden /><span><strong>Tour Card secured</strong><small>Won through the Q-School Final Stage</small></span></li></ol>
            </Section>
          </div>
          <div className="home-two-column home-latest">
            <Section title="Recent changes" icon={<History size={16} />} accent="#82a9d0" action="Career history">
              <div className="home-change-list"><p><span>S2</span>Season Review completed<small>Recorded season review</small><a href={link} aria-label="Open season 2 history"><ArrowUpRight size={14} /></a></p></div>
            </Section>
            <Section title="Darts world" icon={<TrendingUp size={16} />} accent="#7ebbd3" action="Explore world">
              <ul className="home-news"><li><a href={link}>North returns to winning form ahead of the majors <ArrowUpRight size={14} /></a></li><li><a href={link}>Q-School finalists confirmed for next season <ArrowUpRight size={14} /></a></li></ul>
            </Section>
          </div>
        </div>
      </details>
    </div>
  </main>;
}
