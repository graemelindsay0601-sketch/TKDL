import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, CircleDot, ShieldCheck } from "lucide-react";
import "./Redesign.css";

type CabinetWin = {
  eventName: string;
  awardName: string;
  awardImage?: string;
  classification: string;
  editions: { eventId: string; eventHref: string; season: number; venue: string | null }[];
};

// The supplied preview data contains no recorded wins. Keep this record empty:
// catalogue artwork below is explicitly illustrative, never an earned award.
const recordedWins: CabinetWin[] = [];
const pageSize = 50;
const catalogueArt = [
  { src: "/__mockup/images/career-trophies/premium-gold-cup-clean.png", label: "Gold championship cup" },
  { src: "/__mockup/images/career-trophies/premium-silver-cup-clean.png", label: "Silver championship cup" },
  { src: "/__mockup/images/career-trophies/premium-champions-shield-clean.png", label: "Champions shield award" },
];

export function Redesign() {
  const [page, setPage] = useState(0);
  const [visibleArt, setVisibleArt] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const visibleWins = recordedWins.slice(page * pageSize, (page + 1) * pageSize);
  const physicalWins = visibleWins.filter((win) => Boolean(win.awardImage));
  const resultOnly = visibleWins.filter((win) => !win.awardImage);
  const totalTitles = recordedWins.length;
  const physicalCount = recordedWins.filter((win) => Boolean(win.awardImage)).length;
  const canPrevious = page > 0;
  const canNext = (page + 1) * pageSize < totalTitles;
  const activeArt = catalogueArt[visibleArt];

  return (
    <main className="tc-room">
      <div className="tc-room__wrap">
        <header className="tc-room__masthead">
          <span className="tc-room__brand"><b className="tc-room__brand-mark">TKDL</b><span>Career <i>/</i> World</span></span>
          <span className="tc-room__mast-note">Honours record <b>·</b> Personal cabinet</span>
        </header>

        <section className="tc-room__hero" aria-labelledby="cabinet-heading">
          <div className="tc-room__hero-copy">
            <p className="tc-room__eyebrow"><span /> The winner’s room</p>
            <h1 id="cabinet-heading">Trophy<br /><em>cabinet</em></h1>
            <p className="tc-room__intro">
              Every title starts with a result. Every award shown here is tied to a recorded event win.
              Repeat victories keep their own place in the record.
            </p>
            <div className="tc-room__hero-tag"><ShieldCheck size={15} /> Records only. Nothing assumed.</div>
          </div>
          <figure className="tc-room__showcase">
            <div className="tc-room__showcase-backdrop" aria-hidden="true">
              <span className="tc-room__spotlight" />
              <span className="tc-room__arch" />
              <span className="tc-room__rule tc-room__rule--one" />
              <span className="tc-room__rule tc-room__rule--two" />
            </div>
            <img className="tc-room__hero-art" src={activeArt.src} alt={activeArt.label} />
            <figcaption className="tc-room__art-caption">
              <span className="tc-room__live-dot" /> CATALOGUE ARTWORK <b>·</b> NOT AN EARNED AWARD
            </figcaption>
            <div className="tc-room__art-switcher" aria-label="Browse representative award artwork">
              {catalogueArt.map((art, index) => (
                <button
                  aria-label={`Show ${art.label} catalogue artwork`}
                  aria-pressed={visibleArt === index}
                  className={visibleArt === index ? "is-active" : ""}
                  key={art.src}
                  onClick={() => setVisibleArt(index)}
                  type="button"
                />
              ))}
            </div>
          </figure>
          <div className="tc-room__hero-foot"><span>01</span> TKDL CAREER / HONOURS</div>
        </section>

        <section className="tc-room__summary" aria-label="Career title summary">
          <div className="tc-room__total">
            <span className="tc-room__label">Recorded titles</span>
            <strong>{totalTitles}</strong>
            <span className="tc-room__total-tail">No recorded wins yet</span>
          </div>
          <div className="tc-room__stat"><b>{physicalCount}</b><span>Wins with<br />physical awards</span></div>
          <div className="tc-room__stat"><b>{new Set(recordedWins.filter((win) => win.awardImage).map((win) => win.awardImage)).size}</b><span>Award<br />designs</span></div>
          <div className="tc-room__stat"><b>{recordedWins.filter((win) => !win.awardImage).length}</b><span>Result-only<br />wins</span></div>
        </section>

        <section className="tc-room__cabinet" aria-label="Awarded silverware">
          <div className="tc-room__section-head">
            <div><span className="tc-room__overline">THE COLLECTION</span><h2>Silverware</h2></div>
            <span className="tc-room__section-count">{physicalWins.length.toString().padStart(2, "0")} AWARDS</span>
          </div>
          {physicalWins.length ? (
            <div className="tc-room__wins">
              {physicalWins.map((win) => (
                <article className="tc-room__win" key={`${win.eventName}-${win.classification}`}>
                  <img src={win.awardImage} alt={win.awardName} />
                  <div><h3>{win.eventName}</h3><p>{win.awardName} · {win.editions.length} recorded win{win.editions.length === 1 ? "" : "s"}</p>
                    <details><summary>Inspect individual wins <ChevronDown size={14} /></summary>
                      <div>{win.editions.map((edition) => (
                        <a href={edition.eventHref} key={edition.eventId}>
                          Season {edition.season} · {edition.venue ?? "Venue not recorded"} · {win.awardName}
                        </a>
                      ))}</div>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="tc-room__empty">
              <div className="tc-room__empty-copy">
                <span className="tc-room__empty-index">YOUR FIRST TITLE</span>
                <h3>The shelf is still waiting.</h3>
                <p>Silverware appears when a recorded event win awards a trophy, plaque or medal. This preview has no recorded wins, so this is representative catalogue art—not a trophy earned by your player.</p>
              </div>
              <div className="tc-room__empty-art" aria-hidden="true">
                {catalogueArt.slice(1, 3).map((art) => <img key={art.src} src={art.src} alt="" />)}
              </div>
            </div>
          )}
        </section>

        <section className="tc-room__results" aria-labelledby="result-heading">
          <div className="tc-room__section-head tc-room__section-head--results">
            <div><span className="tc-room__overline">THE RESULT BOOK</span><h2 id="result-heading">Wins without silverware</h2></div>
            <CircleDot size={19} aria-hidden="true" />
          </div>
          {resultOnly.length ? (
            <ul className="tc-room__result-list">
              {resultOnly.map((win) => (
                <li key={`${win.eventName}-${win.classification}`}>
                  <span className="tc-room__result-bullet" />
                  <a href={win.editions[0]?.eventHref ?? "#"}><strong>{win.eventName}</strong><small>{win.editions.length} recorded win{win.editions.length === 1 ? "" : "s"} · {win.classification}</small></a>
                  <span className="tc-room__result-prize">{win.awardName}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tc-room__result-empty">Weekly fixtures, qualifiers and Q-School sessions can be recorded as wins with result and prize only. None are recorded here yet.</p>
          )}
        </section>

        <div className="tc-room__integrity"><ShieldCheck size={16} /><span><b>No titles invented.</b> Your first actual win will be recorded here.</span></div>

        <footer className="tc-room__footer">
          <details className="tc-room__rules" open={rulesOpen} onToggle={(event) => setRulesOpen(event.currentTarget.open)}>
            <summary>How this cabinet works <ChevronDown size={15} /></summary>
            <p>Only recorded event wins count as titles. Repeat wins stay distinct; physical awards appear only when awarded. Individual event editions remain inspectable, while result-only wins stay separate.</p>
          </details>
          <nav className="tc-room__pager" aria-label="Trophy cabinet pages">
            <span>PAGE {page + 1}</span>
            <button disabled={!canPrevious} onClick={() => setPage((current) => Math.max(0, current - 1))} type="button"><ChevronLeft size={15} /> Previous</button>
            <button disabled={!canNext} onClick={() => setPage((current) => current + 1)} type="button">Next <ChevronRight size={15} /></button>
          </nav>
        </footer>
      </div>
    </main>
  );
}
