import "./_group.css";
import type { ReactNode } from "react";
import { BadgeCheck, CreditCard, Flag, Milestone, TrendingUp, Trophy } from "lucide-react";

const milestones = [
  ["S4 W20", "Regional Open champion", "First title of the season"],
  ["S4 W15", "Challenger Tour · 5th", "Season ranking published"],
  ["S3 W42", "World Ranking debut", "Entered the professional ranking"],
  ["S3 W08", "Won a Tour Card", "Challenger Order of Merit"],
];
const results = [
  ["Regional Open", "S4 W20 · Regional", "Champion"],
  ["European Masters", "S4 W16 · European Series", "Semi-final"],
  ["UK Open", "S4 W12 · Major", "Quarter-final"],
];

function Section({ icon, title, children, kicker }: { icon: ReactNode; title: string; children: ReactNode; kicker?: string }) {
  return <section className="cj-current__section">
    <header className="cj-current__section-head"><i />{icon}<span>{title}</span>{kicker && <small className="cj-current__section-kicker">{kicker}</small>}</header>
    {children}
  </section>;
}

/** Extracted Career Journey structure with API/context replaced by illustrative preview data. */
export function Current() {
  return <main className="cj-current">
    <p className="cj-current__sample">ILLUSTRATIVE PREVIEW DATA · NOT A LIVE CAREER SAVE</p>
    <header className="cj-current__hero">
      <div className="cj-current__hero-content">
        <p className="cj-current__eyebrow">Career journey · Season 4, week 21</p>
        <h1 className="cj-current__title">The Contender</h1>
        <p className="cj-current__subtitle">Your Career so far, recorded through results, milestones, ranking snapshots and Tour Card history.</p>
        <div className="cj-current__objective"><b>Next objective</b> · Retain your Tour Card by finishing inside the World Ranking top 64.</div>
      </div>
      <dl className="cj-current__stats">
        <div><dt>Titles</dt><dd>8</dd></div><div><dt>Finals</dt><dd>14</dd></div>
        <div><dt>Big-stage appearances</dt><dd>9</dd></div><div><dt>World career high</dt><dd>58th</dd></div>
      </dl>
    </header>
    <Section icon={<Milestone size={14} />} title="Career eras">
      <div className="cj-current__eras">
        <article className="cj-current__era"><small className="cj-current__tag">ERA 01</small><strong>Amateur circuit</strong><b>S1–S2</b><p>County and national halls · routes to the card</p></article>
        <article className="cj-current__era"><small className="cj-current__tag">ERA 02</small><strong>Tour Card season</strong><b>S3–S4</b><p>Professional floor · card currently active</p></article>
        <article className="cj-current__era"><small className="cj-current__tag">ERA 03</small><strong>Televised stage</strong><b>S3–S4</b><p>Two seasons with major and series results</p></article>
      </div>
    </Section>
    <a className="cj-current__link" href="#career-facts" onClick={e => e.preventDefault()}>Career facts, playing statistics, records and full history →</a>
    <div className="cj-current__columns">
      <Section icon={<Milestone size={14} />} title="Milestones" kicker="SEASON RECORD">
        <ol className="cj-current__list">{milestones.map(([date, title, detail]) => <li key={title}><time>{date}</time><i className="cj-current__dot" /><div><strong>{title}</strong><p>{detail}</p></div></li>)}</ol>
      </Section>
      <div>
        <Section icon={<CreditCard size={14} />} title="Tour Card history">
          <div className="cj-current__entry"><strong>S3–S4</strong> · Challenger ranking <span>Active</span></div>
          <div className="cj-current__entry"><strong>S3 W08</strong> · Card earned <span>2 seasons</span></div>
        </Section>
        <Section icon={<Flag size={14} />} title="Q-School">
          <div className="cj-current__entry"><strong>Season 3:</strong> Final Stage reached</div>
          <div className="cj-current__entry"><strong>Season 4:</strong> No Final Stage place yet</div>
        </Section>
        <Section icon={<TrendingUp size={14} />} title="World Ranking progress">
          <div className="cj-current__entry"><strong>Career high</strong> · 58th <span>Season 4 best: 58th</span></div>
        </Section>
      </div>
    </div>
    <div className="cj-current__columns">
      <Section icon={<Trophy size={14} />} title="Titles & finals">
        {results.slice(0,2).map(([name, detail, status]) => <div className="cj-current__entry" key={name}><strong>{name}</strong><p>{detail}<span>{status}</span></p></div>)}
      </Section>
      <Section icon={<BadgeCheck size={14} />} title="Big-stage appearances">
        {results.map(([name, detail, status]) => <div className="cj-current__entry" key={name}><strong>{name}</strong><p>{detail}<span>{status}</span></p></div>)}
      </Section>
    </div>
  </main>;
}
