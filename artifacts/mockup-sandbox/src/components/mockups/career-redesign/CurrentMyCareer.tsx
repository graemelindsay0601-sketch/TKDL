import { useState, type CSSProperties, type ReactNode } from "react";
import {
  Award, Bell, Briefcase, Clapperboard, Flag, Newspaper,
  Star, Swords, TrendingUp, Trophy, X, ArrowUpRight,
} from "lucide-react";
import "./_group.css";

const previewLink = "#career-preview";

function Attention() {
  const [open, setOpen] = useState(false);
  return <div className="career-attention-wrap">
    <button type="button" className="career-attention-trigger" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <Bell size={17} aria-hidden /><span>Attention</span><span className="career-inbox-count">2</span>
    </button>
    {open && <section className="career-attention-panel" aria-label="Career attention">
      <header className="career-attention-panel-header"><div><span className="career-eyebrow">Career updates</span><h2>Attention</h2><p>Your next steps and recent activity.</p></div>
        <div><span className="career-attention-total">2 actions</span>{" "}<button type="button" className="career-attention-close" aria-label="Close Career attention" onClick={() => setOpen(false)}><X size={17} /></button></div>
      </header>
      <div className="career-attention-content">
        <section className="career-attention-group"><h3>Action required</h3><a href={previewLink}><Bell size={14} /><span>Season Review waiting</span></a><a href={previewLink}>Entry window · East Midlands Open</a></section>
        <section className="career-attention-group"><h3>Career updates</h3><a href={previewLink}><Trophy size={14} /><span>First ranking recorded</span><small>Season 1</small></a></section>
        <section className="career-attention-group"><h3>World news</h3><a href={previewLink}><Newspaper size={14} /><span>North returns to winning form ahead of the majors</span></a><a href={previewLink}>Explore Darts World <ArrowUpRight size={14} /></a></section>
      </div>
    </section>}
  </div>;
}

function Section({ title, icon, accent, action, children }: {
  title: string; icon: ReactNode; accent: string; action?: string; children: ReactNode;
}) {
  return <section className="career-section" style={{ "--section-accent": accent } as CSSProperties}>
    <div className="career-section-head"><h2><span aria-hidden>{icon}</span>{title}</h2>{action && <a href={previewLink}>{action} <ArrowUpRight size={14} /></a>}</div>
    {children}
  </section>;
}

function PlayerShirt() {
  return <svg viewBox="0 0 120 140" role="img" aria-label="The North Star's shirt">
    <path d="M32 20 53 12 67 12 88 20 112 39 98 62 85 53 85 126 35 126 35 53 22 62 8 39Z" fill="#20334a" stroke="#ffffff50" strokeWidth="1.5" />
    <path d="M25 50H38V140H25ZM82 50H95V140H82Z" fill="#e9edf0" /><path d="M5 37 27 54M93 54 115 37" stroke="#c8a050" strokeWidth="7" />
    <path d="M53 12Q60 30 67 12L72 16Q60 38 48 16Z" fill="#c8a050" /><rect x="43" y="61" width="34" height="12" rx="2" fill="#10151e" /><text x="60" y="69" fill="white" fontSize="4.5" textAnchor="middle">NORTHSTAR</text>
  </svg>;
}

export function CurrentMyCareer() {
  return <main className="career-root">
    <header className="career-header">
      <div className="career-header-main"><div className="career-brand">My Career<small>Season 2 · Week 18 · Professional</small></div><span className="career-chip">Slot 1</span></div>
      <div className="career-header-tools"><Attention /><a className="home-text-link" href={previewLink}>Career Guide</a><a className="home-text-link" href={previewLink}>Save health</a></div>
    </header>
    <div className="my-career-summaries">
      <h2 className="sr-only">My Career · Overview</h2>
      <div className="pl-stack">
        <section className="pl-hero" aria-label="Alex North Career profile">
          <div className="pl-hero__card"><PlayerShirt /></div>
          <div className="pl-hero__body">
            <p className="pl-eyebrow">Season 2 · Tour Card professional</p>
            <h1 className="pl-hero__name">Alex North</h1>
            <p className="pl-hero__nick">“The North Star”</p>
            <div className="pl-chips"><span className="pl-chip">Tour Card professional</span><span className="pl-chip">World #18</span><span className="pl-chip">Career high #18</span><span className="pl-chip">Age 24</span></div>
            <dl className="pl-stats">
              <div><dt>Titles</dt><dd>4</dd></div><div><dt>Finals</dt><dd>9</dd></div><div><dt>Major / World</dt><dd>0</dd></div>
              <div><dt>Seasons</dt><dd>2</dd></div><div><dt>Match record</dt><dd>87–42</dd></div><div><dt>Prize money</dt><dd>£42,850</dd></div>
            </dl>
          </div>
        </section>
        <section className="pl-panel" aria-label="Career landmarks">
          <h2 className="pl-panel__title"><Flag size={15} aria-hidden /> Career landmarks</h2>
          <ol className="pl-landmarks">
            <li><span className="pl-landmarks__season">S1</span><Flag size={16} aria-hidden /><div><strong>First event played</strong><small>Northshire Open · entered the organised circuit</small></div></li>
            <li><span className="pl-landmarks__season">S1</span><TrendingUp size={16} aria-hidden /><div><strong>First World Ranking</strong><small>Earned ranking status after prize money was recorded</small></div></li>
            <li><span className="pl-landmarks__season">S1</span><Trophy size={16} aria-hidden /><div><strong>First title</strong><small>Midlands Classic · first career tournament win</small></div></li>
            <li><span className="pl-landmarks__season">S2</span><Award size={16} aria-hidden /><div><strong>Career high ranking</strong><small>Reached World #18</small></div></li>
          </ol>
        </section>
        <section className="pl-panel" aria-label="Recent honours">
          <h2 className="pl-panel__title"><Trophy size={15} aria-hidden /> Recent honours</h2>
          <div className="pl-shelf">
            <a className="pl-shelf__item" href={previewLink}><Award size={56} aria-hidden /><strong>Midlands Classic</strong><small>Season 2 · Classic Trophy</small></a>
            <a className="pl-shelf__item" href={previewLink}><Award size={56} aria-hidden /><strong>East Midlands Open</strong><small>Season 1 · Regional Trophy</small></a>
            <a className="pl-shelf__item" href={previewLink}><Award size={56} aria-hidden /><strong>Northshire Open</strong><small>Season 1 · County Trophy</small></a>
            <a className="pl-shelf__item" href={previewLink}><Award size={56} aria-hidden /><strong>Players Championship 4</strong><small>Season 2 · Tour title</small></a>
          </div>
        </section>
        <nav className="pl-links" aria-label="Career record">
          <a href={previewLink}><Trophy size={16} /> Trophy cabinet</a><a href={previewLink}><Award size={16} /> Season history</a>
          <a href={previewLink}><TrendingUp size={16} /> Ranking journey</a><a href={previewLink}><Swords size={16} /> Opponents &amp; rivals</a>
          <a href={previewLink}><Briefcase size={16} /> Finances &amp; sponsors</a><a href={previewLink}><Star size={16} /> Shirt &amp; identity</a>
          <a href={previewLink}><Clapperboard size={16} /> A Career Remembered</a>
        </nav>
      </div>

      <Section title="Your focus & goals" icon={<TargetIcon />} accent="#8dc9bc" action="Manage">
        <div className="my-career-summary-content">
          <p><strong>Professional growth</strong></p>
          <p className="subtle">Which kind of events to suggest to you. Optional: it changes suggestions, not rewards.</p>
          <p><strong>Main ambition:</strong> Win a Players Championship</p>
          <p>Chosen next step: Players Championship 8</p>
          <a href={previewLink}>Players Championship 8 · A strong professional field and a direct opportunity to build ranking prize money.</a>
        </div>
      </Section>
      <Section title="Career standing" icon={<TrendingUp size={16} />} accent="#e8c66a" action="Recognition">
        <div className="my-career-summary-content"><h3>Established professional</h3><p className="subtle">A rising presence across the professional tour, building a record through consistent results and prize-money finishes.</p></div>
        <div className="my-career-badges"><span className="my-career-badge">Professional tour · Established</span><span className="my-career-badge">Regional · Recognised</span></div>
      </Section>
    </div>
  </main>;
}

function TargetIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>;
}
