import { ArrowUpRight, CircleDot, Crosshair, Target, TrendingUp, Trophy } from "lucide-react";
import { recordsView, type RecordEntry, type WorldRecordsView } from "./_fixtures";
import "./_group.css";
import "./RecordsBookPreview.css";

type RecordGroup = WorldRecordsView["records"][number];

const SOURCE: Record<RecordEntry["source"], string> = {
  LIVE: "Live darts",
  QUICK_SIM: "Quick-sim",
  SIMULATED: "Tour",
};

const RECORD_ICONS = {
  "nine-darter": Crosshair,
  "match-average": TrendingUp,
  "tv-average": CircleDot,
  "match-180s": Trophy,
  checkout: Target,
} satisfies Record<RecordEntry["key"], typeof Crosshair>;

const displayValue = (record: RecordGroup, value: number) =>
  record.unit === "average"
    ? value.toFixed(2)
    : record.unit === "legs"
      ? `${value} leg${value === 1 ? "" : "s"}`
      : String(value);

function DartboardMark() {
  return (
    <svg className="rbp-board" viewBox="0 0 360 360" role="img" aria-label="Abstract darts board record mark">
      <circle className="rbp-board-ring rbp-board-ring--outer" cx="180" cy="180" r="158" />
      <circle className="rbp-board-ring" cx="180" cy="180" r="141" />
      <circle className="rbp-board-ring rbp-board-ring--red" cx="180" cy="180" r="104" />
      <circle className="rbp-board-ring" cx="180" cy="180" r="89" />
      <circle className="rbp-board-ring rbp-board-ring--gold" cx="180" cy="180" r="15" />
      <circle className="rbp-board-ring rbp-board-ring--red" cx="180" cy="180" r="7" />
      <path className="rbp-board-spoke" d="M180 22v143m0 30v143M22 180h143m30 0h143M68.3 68.3l101.1 101.1m21.2 21.2 101.1 101.1m0-223.4L191.6 169.4m-21.2 21.2L69.3 291.7" />
      <path className="rbp-dart" d="m259 62 44-43-12 58-18 18z" />
      <path className="rbp-dart-line" d="m273 94-64 64" />
    </svg>
  );
}

function PersonalMark() {
  return <span className="rbp-personal-mark" aria-label="Personal record">YOUR <b>MARK</b></span>;
}

function Provenance({ entry }: { entry: RecordEntry }) {
  return (
    <span className="rbp-provenance">
      <span>{entry.eventName}</span><i aria-hidden="true">/</i>
      <span>Season {entry.season}</span><i aria-hidden="true">/</i>
      <span>{SOURCE[entry.source]}</span>
    </span>
  );
}

function Player({ entry }: { entry: RecordEntry }) {
  return (
    <span className="rbp-player">
      {entry.name}
      {entry.you && <span className="rbp-you">YOUR MARK</span>}
    </span>
  );
}

function RecordIcon({ record }: { record: RecordGroup }) {
  const Icon = RECORD_ICONS[record.key];
  return <span className={`rbp-icon rbp-icon--${record.key}`} aria-hidden="true"><Icon size={19} strokeWidth={1.6} /></span>;
}

function NineDartSection({ record }: { record: RecordGroup }) {
  return (
    <section className="rbp-panel rbp-nines" aria-labelledby="rbp-nines-title">
      <div className="rbp-panel-top">
        <span className="rbp-section-index">01 <i>—</i> THE PERFECT LEG</span>
        <RecordIcon record={record} />
      </div>
      <h2 id="rbp-nines-title">{record.label}</h2>
      <p className="rbp-panel-deck">Nine darts. A place in the book.</p>
      {record.entries.length ? (
        <ol className="rbp-nine-list">
          {record.entries.map((entry, index) => (
            <li className={entry.you ? "is-personal" : ""} key={`${entry.matchId}:${entry.participantKey}`}>
              <span className="rbp-rank">{String(index + 1).padStart(2, "0")}</span>
              <div className="rbp-entry-copy">
                <Player entry={entry} />
                <Provenance entry={entry} />
              </div>
              {entry.you && <PersonalMark />}
              <strong className="rbp-leg-value">{displayValue(record, entry.value)}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rbp-empty">No nine-darter yet. The first one in this darts world will be remembered here.</p>
      )}
      {recordsView.nineDartersSince === "BOOK_ADDED" && (
        <p className="rbp-book-note"><b>BOOK NOTE</b><span>Nine-darters are counted from when the records book was added to this Career.</span></p>
      )}
    </section>
  );
}

function AverageSection({ record }: { record: RecordGroup }) {
  const leader = record.entries[0];
  return (
    <section className="rbp-panel rbp-average" aria-labelledby="rbp-average-title">
      <div className="rbp-panel-top">
        <span className="rbp-section-index">02 <i>—</i> MATCH STANDARD</span>
        <span className="rbp-career-best">CAREER<br />BEST</span>
      </div>
      <h2 id="rbp-average-title">{record.label}</h2>
      {leader ? (
        <>
          <div className="rbp-average-leader">
            <strong>{displayValue(record, leader.value)}</strong><span>AVG</span>
          </div>
          <div className="rbp-leader-byline">
            <Player entry={leader} />
            <Provenance entry={leader} />
          </div>
        </>
      ) : <p className="rbp-empty">No match average has been recorded yet.</p>}
      <div className="rbp-list-heading"><span>THE HONOUR ROLL</span><span>RANK / VALUE</span></div>
      {record.entries.length ? (
        <ol className="rbp-average-list">
          {record.entries.map((entry, index) => (
            <li className={entry.you ? "is-personal" : ""} key={`${entry.matchId}:${entry.participantKey}`}>
              <span className="rbp-rank">{String(index + 1).padStart(2, "0")}</span>
              <Player entry={entry} />
              <strong>{displayValue(record, entry.value)}</strong>
            </li>
          ))}
        </ol>
      ) : <p className="rbp-empty">The honour roll will appear after a qualifying match.</p>}
    </section>
  );
}

function RecordExhibit({ record, index }: { record: RecordGroup; index: number }) {
  return (
    <section className={`rbp-exhibit rbp-exhibit--${record.key}`} aria-labelledby={`rbp-exhibit-${record.key}`}>
      <div className="rbp-exhibit-heading">
        <span className="rbp-exhibit-no">0{index}</span>
        <div>
          <span className="rbp-exhibit-kicker">RECORD EXHIBIT</span>
          <h2 id={`rbp-exhibit-${record.key}`}>{record.label}</h2>
        </div>
        <RecordIcon record={record} />
      </div>
      {record.entries.length ? (
        <ol className="rbp-exhibit-list">
          {record.entries.map((entry, position) => (
            <li className={entry.you ? "is-personal" : ""} key={`${entry.matchId}:${entry.participantKey}`}>
              <span className="rbp-exhibit-rank">{String(position + 1).padStart(2, "0")}</span>
              <span className="rbp-exhibit-value">{displayValue(record, entry.value)}</span>
              <div className="rbp-exhibit-person">
                <Player entry={entry} />
                <Provenance entry={entry} />
              </div>
              {entry.you && <PersonalMark />}
            </li>
          ))}
        </ol>
      ) : <p className="rbp-empty">No qualifying performance has been recorded yet.</p>}
    </section>
  );
}

export function RecordsBookPreview() {
  const records = recordsView.records;
  const nines = records.find(record => record.key === "nine-darter");
  const average = records.find(record => record.key === "match-average");
  const gallery = records.filter(record => record.key !== "nine-darter" && record.key !== "match-average");
  const personalCount = records.flatMap(record => record.entries).filter(entry => entry.you).length;

  return (
    <main className="rbp-page">
      <div className="rbp-page-inner">
        <div className="rbp-sample-note"><span />VISUAL SAMPLE <i>/</i> FICTIONAL CAREER DATA</div>
        <header className="rbp-masthead">
          <div className="rbp-brand">
            <span className="rbp-monogram">TK</span>
            <span>TKDL <b>CAREER</b><small>DARTS WORLD ARCHIVE</small></span>
          </div>
          <div className="rbp-edition"><span>THE RECORDS BOOK</span><b>CAREER EDITION</b></div>
        </header>

        <section className="rbp-hero" aria-labelledby="rbp-title">
          <div className="rbp-hero-copy">
            <p className="rbp-eyebrow">A living record of play</p>
            <h1 id="rbp-title">The marks<br />that <em>remain.</em></h1>
            <p className="rbp-intro">The standout performances in this darts world, entered from matches played in a Career.</p>
            <div className="rbp-standard"><span className="rbp-standard-rule" />STEEL-TIP ONLY <i>·</i> AVERAGES REQUIRE AT LEAST SIX LEGS</div>
          </div>
          <div className="rbp-hero-art">
            <DartboardMark />
            <span className="rbp-art-overline">TKDL CAREER <i> / </i> RECORDS</span>
            <span className="rbp-art-caption">MEASURED<br />IN PLAY</span>
            <span className="rbp-art-index">D/W <b>01—05</b></span>
          </div>
        </section>

        <div className="rbp-section-heading">
          <span>THE CAREER LEDGER</span>
          <span>{String(records.length).padStart(2, "0")} RECORDED CATEGORIES</span>
        </div>

        <div className="rbp-feature-grid">
          {nines && <NineDartSection record={nines} />}
          {average && <AverageSection record={average} />}
        </div>

        <div className="rbp-gallery-heading">
          <span className="rbp-gallery-number">03—05</span>
          <h2>More ways to make the book</h2>
          <span className="rbp-gallery-rule" />
        </div>
        <div className="rbp-exhibits">
          {gallery.map((record, index) => <RecordExhibit key={record.key} record={record} index={index + 3} />)}
        </div>

        <footer className="rbp-footer">
          <div className="rbp-footer-brand">TKDL <span>·</span> RECORDS</div>
          <p>Every mark follows the match that made it.</p>
          <div className="rbp-personal-count"><strong>{personalCount}</strong><span>PERSONAL<br />RECORDS</span></div>
          <span className="rbp-footer-link">CAREER ARCHIVE <ArrowUpRight size={13} aria-hidden="true" /></span>
        </footer>
      </div>
    </main>
  );
}
