import { CircleDot, Crosshair, Target, TrendingUp, Trophy } from "lucide-react";
import { recordsView, type RecordEntry, type WorldRecordsView } from "./_fixtures";
import hallOfFameMedallion from "./assets/hall-of-fame-medallion.png";
import "./_group.css";
import "../../../../../tkdl/src/features/career/pages/records-book.css";
import "./Current.css";

type RecordGroup = WorldRecordsView["records"][number];
type RecordKey = RecordGroup["key"];

const SOURCE: Record<RecordEntry["source"], string> = {
  LIVE: "Live darts",
  QUICK_SIM: "Quick-sim",
  SIMULATED: "Tour",
};

const SEALS = {
  "nine-darter": Crosshair,
  "match-average": TrendingUp,
  "tv-average": CircleDot,
  "match-180s": Trophy,
  checkout: Target,
} satisfies Record<RecordKey, typeof Crosshair>;

const formatValue = (record: RecordGroup, amount: number) =>
  record.unit === "average"
    ? amount.toFixed(2)
    : record.unit === "legs"
      ? `${amount} leg${amount === 1 ? "" : "s"}`
      : String(amount);

function RecordSeal({ recordKey }: { recordKey: RecordKey }) {
  const Icon = SEALS[recordKey];
  return <span className={`rb-seal rb-seal--${recordKey}`} aria-hidden="true"><Icon size={18} strokeWidth={1.5} /></span>;
}

function PersonalSeal() {
  return <span className="rb-personal-seal">YOUR<br />MARK</span>;
}

function PlayerName({ entry }: { entry: RecordEntry }) {
  if (entry.you) return <strong className="rb-player-name">{entry.name}<i>YOUR MARK</i></strong>;
  return <a className="rb-player-name" href="#sample-player">{entry.name}</a>;
}

function Provenance({ entry }: { entry: RecordEntry }) {
  return (
    <span className="rb-provenance">
      <span>{entry.eventName}</span><i aria-hidden="true">/</i>
      <span>Season {entry.season}</span><i aria-hidden="true">/</i>
      <span>{SOURCE[entry.source]}</span>
    </span>
  );
}

function NineDarters({ record, bookAdded }: { record: RecordGroup; bookAdded: boolean }) {
  return (
    <section className="rb-box rb-nine" aria-labelledby="rb-nine-title">
      <header className="rb-box-head">
        <div className="rb-index">01 <span>PERFECT LEG</span></div>
        <RecordSeal recordKey={record.key} />
      </header>
      <h2 id="rb-nine-title">{record.label}</h2>
      <p className="rb-box-deck">Nine darts. A place in the book.</p>
      {record.entries.length ? (
        <ol className="rb-nine-list">
          {record.entries.map((entry, index) => (
            <li className={entry.you ? "is-personal" : undefined} key={`${entry.matchId}:${entry.participantKey}`}>
              <span className="rb-rank">0{index + 1}</span>
              <div className="rb-entry"><PlayerName entry={entry} /><Provenance entry={entry} /></div>
              {entry.you && <PersonalSeal />}
              <span className="rb-value">{formatValue(record, entry.value)}<small>LEG</small></span>
            </li>
          ))}
        </ol>
      ) : <p className="rb-empty">No nine-darter yet. The first one in this darts world will be remembered here.</p>}
      {bookAdded && <p className="rb-book-note"><b>BOOK NOTE</b><span>Nine-darters are counted from when the records book was added to this Career.</span></p>}
    </section>
  );
}

function FeatureRecord({ record }: { record: RecordGroup }) {
  const leader = record.entries[0];
  return (
    <section className="rb-box rb-feature" aria-labelledby="rb-feature-title">
      <header className="rb-box-head">
        <div className="rb-index">02 <span>MATCH STANDARD</span></div>
        <span className="rb-career-best">CAREER<br />BEST</span>
      </header>
      <h2 id="rb-feature-title">{record.label}</h2>
      {leader ? (
        <>
          <div className="rb-feature-value">{formatValue(record, leader.value)}<small>AVG</small></div>
          <div className="rb-feature-holder"><PlayerName entry={leader} /><Provenance entry={leader} /></div>
        </>
      ) : <p className="rb-empty">No match average has been recorded yet.</p>}
      <div className="rb-ranking-label"><span>THE HONOUR ROLL</span><span>RANK / VALUE</span></div>
      {record.entries.length ? (
        <ol className="rb-feature-list">
          {record.entries.map((entry, index) => (
            <li className={entry.you ? "is-personal" : undefined} key={`${entry.matchId}:${entry.participantKey}`}>
              <span className="rb-rank">0{index + 1}</span>
              <PlayerName entry={entry} />
              <strong>{formatValue(record, entry.value)}</strong>
            </li>
          ))}
        </ol>
      ) : <p className="rb-feature-empty">The honour roll will appear after a qualifying match.</p>}
    </section>
  );
}

function RecordCard({ record, index }: { record: RecordGroup; index: number }) {
  return (
    <section className={`rb-box rb-card rb-card--${record.key}`} aria-labelledby={`rb-title-${record.key}`}>
      <header className="rb-box-head">
        <div className="rb-index">0{index} <span>RECORD EXHIBIT</span></div>
        <RecordSeal recordKey={record.key} />
      </header>
      <h2 id={`rb-title-${record.key}`}>{record.label}</h2>
      {record.entries.length ? (
        <ol className="rb-card-list">
          {record.entries.map((entry, position) => (
            <li className={entry.you ? "is-personal" : undefined} key={`${entry.matchId}:${entry.participantKey}`}>
              <div className="rb-card-value"><span className="rb-rank">0{position + 1}</span><strong>{formatValue(record, entry.value)}</strong></div>
              <div className="rb-card-person"><PlayerName entry={entry} />{entry.you && <PersonalSeal />}</div>
              <Provenance entry={entry} />
            </li>
          ))}
        </ol>
      ) : <p className="rb-empty">No qualifying performance has been recorded yet.</p>}
    </section>
  );
}

export function Current() {
  const all = recordsView.records;
  const nines = all.find(record => record.key === "nine-darter");
  const matchAverage = all.find(record => record.key === "match-average");
  const gallery = all.filter(record => record.key !== "nine-darter" && record.key !== "match-average");
  const personalMarks = all.flatMap(record => record.entries).filter(entry => entry.you).length;

  return (
    <main className="wr-current">
      <div style={{ width: "min(1190px, 100%)", margin: "0 auto", padding: "12px 20px 0" }}>
        <span className="wr-sample-tag">Visual sample · fictional Career data</span>
      </div>
      <div className="records-book">
        <div className="rb-shell">
          <header className="rb-masthead">
            <a className="rb-brand" href="#records">
              <span className="rb-brand-mark">TK</span>
              <span>TKDL CAREER<small>DARTS WORLD · RECORDS</small></span>
            </a>
            <div className="rb-edition"><span>RECORDS BOOK</span><b>CAREER ARCHIVE</b></div>
          </header>
          <div className="rb-disclosure"><span />DARTS WORLD <i>/</i> CAREER RECORDS</div>
          <section className="rb-hero">
            <div className="rb-hero-copy">
              <p className="rb-overline">A place for the performances that stay</p>
              <h1>Hall of <em>Fame</em></h1>
              <p className="rb-intro">Every mark earned in this darts world, entered for the record.</p>
              <div className="rb-rule"><span>✳</span>Steel-tip only. Averages require at least six legs.</div>
            </div>
            <div className="rb-hero-art" aria-hidden="true">
              <img src={hallOfFameMedallion} alt="" />
              <span className="rb-art-label">CAREER ARCHIVE <i>·</i> RECORDS EDITION</span>
              <span className="rb-art-caption">THE MARKS<br />THAT REMAIN</span>
            </div>
          </section>
          <div className="rb-section-rule"><span>THE INDUCTED RECORDS</span><span>{String(all.length).padStart(2, "0")} CATEGORIES</span></div>
          <div className="rb-feature-grid">
            {nines && <NineDarters record={nines} bookAdded={recordsView.nineDartersSince === "BOOK_ADDED"} />}
            {matchAverage && <FeatureRecord record={matchAverage} />}
          </div>
          <div className="rb-gallery">
            {gallery.map((record, index) => <RecordCard key={record.key} record={record} index={index + 3} />)}
          </div>
          <footer className="rb-footer">
            <span className="rb-footer-mark">DW<span>·</span>RECORDS</span>
            <p>Not just a number. A moment that made the book.</p>
            <div className="rb-personal-count"><strong>{personalMarks}</strong><span>PERSONAL<br />RECORDS</span></div>
          </footer>
        </div>
      </div>
    </main>
  );
}
