import { recordsView } from "./_fixtures";
import "./_group.css";
import "./HallOfFame.css";
import medallionStillLife from "./assets/hall-of-fame-medallion.png";

const SOURCE = { LIVE: "Live darts", QUICK_SIM: "Quick-sim", SIMULATED: "Tour" } as const;
type RecordGroup = (typeof recordsView.records)[number];
type Entry = RecordGroup["entries"][number];

const formattedValue = (record: RecordGroup, amount: number) =>
  record.unit === "average" ? amount.toFixed(2) : record.unit === "legs" ? `${amount} leg${amount === 1 ? "" : "s"}` : String(amount);

function RecordSeal({ kind }: { kind: string }) {
  return (
    <span className={`hof-seal hof-seal--${kind}`} aria-hidden="true">
      <svg viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="18" />
        <circle cx="22" cy="22" r="14" />
        {kind === "nine-darter" ? <path d="M22 10v24M10 22h24M14 14l16 16m0-16L14 30" /> :
          kind === "match-average" || kind === "tv-average" ? <path d="m13 28 6-7 5 4 8-10M13 32h19" /> :
            kind === "match-180s" ? <path d="M14 30V15m8 15V11m8 19V15" /> :
              <path d="M22 11v22m-8-14 8-8 8 8m-16 8 8 8 8-8" />}
      </svg>
    </span>
  );
}

function Provenance({ entry }: { entry: Entry }) {
  return (
    <span className="hof-provenance">
      <span>{entry.eventName}</span>
      <i aria-hidden="true">/</i>
      <span>Season {entry.season}</span>
      <i aria-hidden="true">/</i>
      <span>{SOURCE[entry.source]}</span>
    </span>
  );
}

function PersonalSeal() {
  return <span className="hof-personal-seal">YOUR<br />MARK</span>;
}

function NineDarters({ record }: { record: RecordGroup }) {
  return (
    <section className="hof-nine exhibit" aria-labelledby="hof-nine-title">
      <header className="hof-exhibit-head">
        <div className="hof-index">01 <span>PERFECT LEG</span></div>
        <RecordSeal kind={record.key} />
      </header>
      <h2 id="hof-nine-title">{record.label}</h2>
      <p className="hof-exhibit-deck">Nine darts. A place in the book.</p>
      <ol className="hof-nine-list">
        {record.entries.map((entry, index) => (
          <li className={entry.you ? "is-personal" : ""} key={`${entry.matchId}:${entry.participantKey}`}>
            <span className="hof-rank">0{index + 1}</span>
            <div className="hof-entry">
              <strong>{entry.name}</strong>
              <Provenance entry={entry} />
            </div>
            {entry.you && <PersonalSeal />}
            <span className="hof-nine-value">{entry.value}<small>LEG</small></span>
          </li>
        ))}
      </ol>
      {recordsView.nineDartersSince === "BOOK_ADDED" && (
        <p className="hof-book-note"><b>BOOK NOTE</b><span>Nine-darters are counted from when the records book was added to this Career.</span></p>
      )}
    </section>
  );
}

function FeatureRecord({ record }: { record: RecordGroup }) {
  const leader = record.entries[0];
  return (
    <section className="hof-feature" aria-labelledby="hof-feature-title">
      <div className="hof-feature-top">
        <div className="hof-index">02 <span>MATCH STANDARD</span></div>
        <span className="hof-feature-ribbon">CAREER<br />BEST</span>
      </div>
      <h2 id="hof-feature-title">{record.label}</h2>
      {leader && (
        <>
          <div className="hof-feature-number">{formattedValue(record, leader.value)}<span>AVG</span></div>
          <div className="hof-feature-holder">
            <div className="hof-feature-name">{leader.name}{leader.you && <PersonalSeal />}</div>
            <Provenance entry={leader} />
          </div>
        </>
      )}
      <div className="hof-ranking-label"><span>THE HONOUR ROLL</span><span>RANK / VALUE</span></div>
      <ol className="hof-feature-list">
        {record.entries.map((entry, index) => (
          <li className={entry.you ? "is-personal" : ""} key={`${entry.matchId}:${entry.participantKey}`}>
            <span className="hof-rank">0{index + 1}</span>
            <span className="hof-feature-person">{entry.name}{entry.you && <i>YOUR MARK</i>}</span>
            <strong>{formattedValue(record, entry.value)}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RecordGallery({ record, index }: { record: RecordGroup; index: string }) {
  return (
    <section className={`hof-gallery-card exhibit hof-gallery-card--${record.key}`} aria-labelledby={`hof-title-${record.key}`}>
      <div className="hof-gallery-top">
        <div className="hof-index">{index} <span>RECORD EXHIBIT</span></div>
        <RecordSeal kind={record.key} />
      </div>
      <h2 id={`hof-title-${record.key}`}>{record.label}</h2>
      <ol className="hof-gallery-list">
        {record.entries.map((entry, position) => (
          <li className={entry.you ? "is-personal" : ""} key={`${entry.matchId}:${entry.participantKey}`}>
            <div className="hof-gallery-value">
              <span className="hof-rank">0{position + 1}</span>
              <strong>{formattedValue(record, entry.value)}</strong>
            </div>
            <div className="hof-gallery-person">
              <span>{entry.name}{entry.you && <i>YOUR MARK</i>}</span>
              {entry.you && <PersonalSeal />}
            </div>
            <Provenance entry={entry} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HallOfFame() {
  const all = recordsView.records;
  const nines = all.find(record => record.key === "nine-darter")!;
  const matchAverage = all.find(record => record.key === "match-average")!;
  const gallery = all.filter(record => record.key === "tv-average" || record.key === "match-180s" || record.key === "checkout");
  const personalMarks = all.flatMap(record => record.entries).filter(entry => entry.you).length;

  return (
    <main className="hof-page">
      <div className="hof-frame">
        <header className="hof-masthead">
          <div className="hof-brand"><span className="hof-brand-emblem">D<span>W</span></span><span>DARTS WORLD<small>CAREER · HALL OF FAME</small></span></div>
          <div className="hof-edition"><span>RECORDS BOOK</span><b>VOL. 01</b></div>
        </header>

        <div className="hof-disclosure"><span />VISUAL SAMPLE <i>/</i> FICTIONAL CAREER DATA</div>

        <section className="hof-intro">
          <div className="hof-intro-copy">
            <p className="hof-overline">A place for the performances that stay</p>
            <h1>Hall of <em>Fame</em></h1>
            <p className="hof-intro-desc">Five records. Every mark earned in this darts world, entered for the record.</p>
            <div className="hof-rule"><span className="hof-rule-glyph">✳</span><span>Steel-tip only. Averages require at least six legs.</span></div>
          </div>
          <div className="hof-hero-art" aria-hidden="true">
            <img className="hof-medallion-still" src={medallionStillLife} alt="" />
            <div className="hof-art-engraving">CAREER ARCHIVE <i>·</i> RECORDS EDITION</div>
            <div className="hof-art-caption"><span>THE MARKS<br />THAT REMAIN</span><i /></div>
          </div>
        </section>

        <div className="hof-section-rule"><span>THE INDUCTED RECORDS</span><span>01 — 05</span></div>
        <div className="hof-feature-grid">
          <NineDarters record={nines} />
          <FeatureRecord record={matchAverage} />
        </div>
        <div className="hof-gallery">
          {gallery.map((record, index) => <RecordGallery key={record.key} record={record} index={`0${index + 3}`} />)}
        </div>
        <footer className="hof-footer">
          <div className="hof-footer-mark">DW<span>·</span>HOF</div>
          <p>Not just a number. A moment that made the book.</p>
          <div className="hof-personal-count"><strong>{personalMarks}</strong><span>PERSONAL<br />INDUCTIONS</span></div>
        </footer>
      </div>
    </main>
  );
}
