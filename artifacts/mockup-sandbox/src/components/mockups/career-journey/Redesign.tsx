import { BadgeCheck, Compass, CreditCard, Flag, Milestone, TrendingUp, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import "./Redesign.css";

const milestones = [
  ["S4 W20", "Regional Open champion", "First title of the season"],
  ["S4 W15", "Challenger Tour · 5th", "Season ranking published"],
  ["S3 W42", "World Ranking debut", "Entered the professional ranking"],
  ["S3 W08", "Won a Tour Card", "Challenger Order of Merit"],
];

const titleResults = [
  { name: "Regional Open", detail: "S4 W20 · Regional", status: "Champion", tone: "champion" },
  { name: "European Masters", detail: "S4 W16 · European Series", status: "Semi-final", tone: "semifinal" },
];

const stageResults = [
  { name: "Regional Open", detail: "S4 W20 · Regional", status: "Champion", tone: "champion" },
  { name: "European Masters", detail: "S4 W16 · European Series", status: "Semi-final", tone: "semifinal" },
  { name: "UK Open", detail: "S4 W12 · Major", status: "Quarter-final", tone: "neutral" },
];

function Section({ icon, title, kicker, accent = "red", children }: { icon: ReactNode; title: string; kicker?: string; accent?: "red" | "gold"; children: ReactNode }) {
  return (
    <section className={`cj-redesign__section cj-redesign__section--${accent}`}>
      <header className="cj-redesign__section-head">
        <span className="cj-redesign__section-icon" aria-hidden="true">{icon}</span>
        <h2 className="cj-redesign__section-title">{title}</h2>
        {kicker && <span className="cj-redesign__section-kicker">{kicker}</span>}
      </header>
      {children}
    </section>
  );
}

/** Standalone visual redesign. All displayed career values are illustrative preview data. */
export function Redesign() {
  return (
    <main className="cj-redesign">
      <div className="cj-redesign__frame">
        <p className="cj-redesign__sample">Illustrative preview data · Not a live career save</p>

        <header className="cj-redesign__hero">
          <div className="cj-redesign__hero-inner">
            <div className="cj-redesign__hero-copy">
              <p className="cj-redesign__eyebrow">Career record <span>·</span> Season 4, week 21</p>
              <h1 className="cj-redesign__title"><span className="cj-redesign__title-pre">The</span> Contender</h1>
              <p className="cj-redesign__subtitle">A career measured in seasons, results and ranking snapshots. The record so far — and the next line still to write.</p>
              <div className="cj-redesign__objective">
                <span className="cj-redesign__objective-mark" aria-hidden="true"><Compass size={15} /></span>
                <span><b>Next objective</b>Retain your Tour Card by finishing inside the World Ranking top 64.</span>
              </div>
            </div>
            <div className="cj-redesign__seal" aria-label="Season 4, week 21">
              <div className="cj-redesign__seal-inner"><small>Career file</small><strong>S04</strong><span>Week 21</span></div>
            </div>
          </div>
          <dl className="cj-redesign__stats">
            <div className="cj-redesign__stat"><dt>Titles</dt><dd>8</dd></div>
            <div className="cj-redesign__stat"><dt>Finals</dt><dd>14</dd></div>
            <div className="cj-redesign__stat"><dt>Big-stage appearances</dt><dd>9</dd></div>
            <div className="cj-redesign__stat"><dt>World career high</dt><dd>58th</dd></div>
          </dl>
        </header>

        <Section icon={<Milestone size={15} />} title="Career eras" kicker="Progression by season" accent="gold">
          <div className="cj-redesign__eras">
            <article className="cj-redesign__era cj-redesign__era--amateur">
              <svg className="cj-redesign__era-art" viewBox="0 0 96 96" aria-hidden="true">
                <circle cx="48" cy="48" r="37" /><circle cx="48" cy="48" r="26" /><circle cx="48" cy="48" r="14" />
                <path d="M48 9v78M9 48h78M20.5 20.5l55 55M75.5 20.5l-55 55" />
                <circle className="cj-redesign__era-art-core" cx="48" cy="48" r="4" />
              </svg>
              <span className="cj-redesign__era-index">Era 01</span>
              <strong>Amateur circuit</strong>
              <span className="cj-redesign__era-period">S1–S2</span>
              <p>County and national halls · routes to the card</p>
            </article>
            <article className="cj-redesign__era cj-redesign__era--active cj-redesign__era--tour">
              <svg className="cj-redesign__era-art" viewBox="0 0 96 96" aria-hidden="true">
                <path d="M48 8 76 24v29c0 18-12 29-28 37C32 82 20 71 20 53V24L48 8Z" />
                <path d="M48 24 54 39l16 1-12 10 4 16-14-8-14 8 4-16-12-10 16-1 6-15Z" />
                <path d="M29 25v25M67 25v25" />
              </svg>
              <span className="cj-redesign__era-index">Era 02 · Current</span>
              <strong>Tour Card season</strong>
              <span className="cj-redesign__era-period">S3–S4</span>
              <p>Professional floor · card currently active</p>
            </article>
            <article className="cj-redesign__era cj-redesign__era--stage">
              <svg className="cj-redesign__era-art" viewBox="0 0 96 96" aria-hidden="true">
                <path d="M19 29h58v39H19zM27 75h42M37 68v7M59 68v7" />
                <path d="M48 10v10M14 15l8 8M82 15l-8 8M9 43h7M80 43h7" />
                <path d="M31 41h34M31 49h21" />
              </svg>
              <span className="cj-redesign__era-index">Era 03</span>
              <strong>Televised stage</strong>
              <span className="cj-redesign__era-period">S3–S4</span>
              <p>Two seasons with major and series results</p>
            </article>
          </div>
        </Section>

        <aside className="cj-redesign__record-note">
          <strong>Career record</strong><i aria-hidden="true" />
          <span>Career facts, playing statistics, records and full history</span>
        </aside>

        <div className="cj-redesign__columns">
          <Section icon={<Milestone size={15} />} title="Milestones" kicker="Season record" accent="gold">
            <ol className="cj-redesign__timeline">
              {milestones.map(([date, title, detail]) => (
                <li key={title}>
                  <time>{date}</time><span className="cj-redesign__timeline-dot" aria-hidden="true" />
                  <div><strong>{title}</strong><p>{detail}</p></div>
                </li>
              ))}
            </ol>
          </Section>

          <div className="cj-redesign__stack">
            <Section icon={<CreditCard size={15} />} title="Tour Card history" accent="gold">
              <div className="cj-redesign__entry"><strong>S3–S4</strong><span>· Challenger ranking</span><span className="cj-redesign__pill">Active</span></div>
              <div className="cj-redesign__entry"><strong>S3 W08</strong><span>· Card earned</span><span className="cj-redesign__pill cj-redesign__pill--neutral">2 seasons</span></div>
            </Section>
            <Section icon={<Flag size={15} />} title="Q-School" kicker="Progress" accent="red">
              <div className="cj-redesign__entry"><strong>Season 3:</strong><span>Final Stage reached</span><span className="cj-redesign__pill">Reached</span></div>
              <div className="cj-redesign__entry"><strong>Season 4:</strong><span>No Final Stage place yet</span><span className="cj-redesign__pill cj-redesign__pill--red">In progress</span></div>
            </Section>
            <Section icon={<TrendingUp size={15} />} title="World Ranking progress" accent="gold">
              <div className="cj-redesign__ranking">
                <span className="cj-redesign__ranking-number">58th</span>
                <span className="cj-redesign__ranking-label"><strong>Career high</strong>Season 4 best: 58th</span>
              </div>
            </Section>
          </div>
        </div>

        <div className="cj-redesign__results-grid">
          <Section icon={<Trophy size={15} />} title="Titles & finals" kicker="Selected results" accent="gold">
            {titleResults.map((result) => (
              <div className="cj-redesign__result" key={result.name}>
                <span><strong>{result.name}</strong><small>{result.detail}</small></span>
                <span className={`cj-redesign__result-status cj-redesign__result-status--${result.tone}`}>{result.status}</span>
              </div>
            ))}
          </Section>
          <Section icon={<BadgeCheck size={15} />} title="Big-stage appearances" kicker="Major & series">
            {stageResults.map((result) => (
              <div className="cj-redesign__result" key={result.name}>
                <span><strong>{result.name}</strong><small>{result.detail}</small></span>
                <span className={`cj-redesign__result-status cj-redesign__result-status--${result.tone}`}>{result.status}</span>
              </div>
            ))}
          </Section>
        </div>

        <footer className="cj-redesign__footer">
          <span>TKDL · Career journey</span>
          <span>All values shown are illustrative</span>
        </footer>
      </div>
    </main>
  );
}

export default Redesign;
