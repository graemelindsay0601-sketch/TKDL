import { recordsView } from "./_fixtures";
import "./_group.css";
import "./Rework.css";

const SOURCE = { LIVE: "Live darts", QUICK_SIM: "Quick-sim", SIMULATED: "Tour" } as const;
type Record = typeof recordsView.records[number];

const week = (day: number) => Math.ceil(day / 7);
const value = (unit: string, amount: number) =>
  unit === "average" ? amount.toFixed(2) : unit === "legs" ? `${amount} leg${amount === 1 ? "" : "s"}` : String(amount);

function BookMark() {
  return (
    <svg className="rw-mark" aria-hidden="true" viewBox="0 0 64 64" fill="none">
      <path d="M13 8.5h27.5c5.8 0 10.5 4.7 10.5 10.5v36H23.5C17.7 55 13 50.3 13 44.5v-36Z" />
      <path d="M13 13.5h27.5c3 0 5.5 2.5 5.5 5.5v31H23.5c-4.2 0-7.9-2.1-10.1-5.3M22 20h15M22 27h15M22 34h10" />
      <path d="m47 8 3 5 5.8.9-4.2 4.1.9 5.8-5.5-2.8-5.2 2.8 1-5.8-4.2-4.1 5.7-.9 2.7-5Z" />
    </svg>
  );
}

function NineDartSeal() {
  return (
    <svg className="rw-seal" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="54" />
      <circle cx="60" cy="60" r="46" />
      <path d="M60 22v76M22 60h76M33 33l54 54M87 33 33 87" />
      <circle cx="60" cy="60" r="23" />
      <path d="m60 34 5.6 17.2H84L69.2 62l5.6 17.2L60 68.6l-14.8 10.6L50.8 62 36 51.2h18.4L60 34Z" />
    </svg>
  );
}

function EntryMeta({ record, entry }: { record: Record; entry: Record["entries"][number] }) {
  return (
    <span className="rw-meta">
      {entry.eventName}<i>·</i>Season {entry.season}
      {record.key === "nine-darter" && <><i>·</i>Week {week(entry.day)}</>}
      <i>·</i>{SOURCE[entry.source]}
    </span>
  );
}

function NineDarters({ record }: { record: Record }) {
  return (
    <section className="rw-nines" aria-labelledby="rw-nines-title">
      <div className="rw-nines-ornament"><NineDartSeal /></div>
      <div className="rw-section-kicker">The perfect leg <span>01</span></div>
      <h2 id="rw-nines-title">{record.label}</h2>
      <p className="rw-intro">Nine darts. No room for another.</p>
      {record.entries.length ? (
        <ol className="rw-nines-list">
          {record.entries.map((entry, index) => (
            <li className={entry.you ? "rw-you" : ""} key={`${entry.matchId}:${entry.participantKey}`}>
              <span className="rw-list-index">0{index + 1}</span>
              <div className="rw-entry-copy">
                <strong>{entry.name}{entry.you && <em className="rw-you-tag">Your mark</em>}</strong>
                <EntryMeta record={record} entry={entry} />
              </div>
              <span className="rw-leg-value">{entry.value}<span>LEG</span></span>
            </li>
          ))}
        </ol>
      ) : <p className="rw-empty">No nine-darter yet. The first one in this darts world will be remembered here.</p>}
      {recordsView.nineDartersSince === "BOOK_ADDED" && (
        <p className="rw-book-note"><span>BOOK NOTE</span>Nine-darters are counted from when the records book was added to this Career.</p>
      )}
    </section>
  );
}

function AverageFeature({ record }: { record: Record }) {
  const leader = record.entries[0];
  return (
    <section className="rw-feature" aria-labelledby="rw-feature-title">
      <div className="rw-feature-top">
        <span className="rw-section-kicker">Match standard <b>02</b></span>
        <span className="rw-feature-stamp">CAREER<br />BEST</span>
      </div>
      <h2 id="rw-feature-title">{record.label}</h2>
      <div className="rw-big-value">{leader ? leader.value.toFixed(2) : "—"}<span>AVG</span></div>
      {leader && (
        <div className="rw-feature-holder">
          <strong>{leader.name}{leader.you && <em className="rw-you-tag">Your mark</em>}</strong>
          <EntryMeta record={record} entry={leader} />
        </div>
      )}
      <div className="rw-feature-rule"><span>TOP THREE</span><span>STEEL-TIP</span></div>
      <ol className="rw-feature-ranks">
        {record.entries.map((entry, index) => (
          <li className={entry.you ? "rw-you" : ""} key={`${entry.matchId}:${entry.participantKey}`}>
            <b>0{index + 1}</b>
            <span>{entry.name}{entry.you && <em className="rw-you-tag">Your mark</em>}</span>
            <strong>{entry.value.toFixed(2)}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RecordColumn({ record, index }: { record: Record; index: string }) {
  return (
    <section className="rw-column" aria-labelledby={`rw-${record.key}`}>
      <header className="rw-column-head">
        <span className="rw-section-kicker">Record {index}</span>
        <h2 id={`rw-${record.key}`}>{record.label}</h2>
      </header>
      <ol className="rw-rank-list">
        {record.entries.map((entry, position) => (
          <li className={entry.you ? "rw-you" : ""} key={`${entry.matchId}:${entry.participantKey}`}>
            <div className="rw-rank-line">
              <span className="rw-rank-number">0{position + 1}</span>
              <strong className="rw-rank-value">{value(record.unit, entry.value)}</strong>
            </div>
            <div className="rw-rank-person">{entry.name}{entry.you && <em className="rw-you-tag">Your mark</em>}</div>
            <EntryMeta record={record} entry={entry} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Rework() {
  const all = recordsView.records;
  const nines = all.find(record => record.key === "nine-darter")!;
  const matchAverage = all.find(record => record.key === "match-average")!;
  const lowerRecords = all.filter(record => record.key === "tv-average" || record.key === "match-180s" || record.key === "checkout");
  const yourCount = all.flatMap(record => record.entries).filter(entry => entry.you).length;

  return (
    <main className="rw-page">
      <div className="rw-paper">
        <header className="rw-masthead">
          <div className="rw-brand"><span className="rw-brand-star" aria-hidden="true" /><span>DARTS<br />WORLD</span><i>CAREER ARCHIVE</i></div>
          <div className="rw-edition"><span>THE OFFICIAL RECORD BOOK</span><b>CAREER RECORDS</b></div>
          <div className="rw-book-icon"><BookMark /></div>
        </header>

        <div className="rw-disclosure"><span className="rw-disclosure-dot" />Visual sample <i>/</i> fictional Career data</div>

        <section className="rw-titlebar">
          <div>
            <p className="rw-eyebrow">A living archive of extraordinary play</p>
            <h1>Records <span>Book</span></h1>
          </div>
          <div className="rw-title-note">
            <span>THE CAREER LEDGER</span>
            <p>The best performances in your darts world, from every match played.</p>
            <p className="rw-rule">Steel-tip only. Averages require at least six legs.</p>
          </div>
        </section>

        <div className="rw-ruleline"><span>THE MARKS THAT LAST</span><span>01 — 05</span></div>

        <div className="rw-feature-grid">
          <NineDarters record={nines} />
          <AverageFeature record={matchAverage} />
        </div>

        <div className="rw-lower-grid">
          {lowerRecords.map((record, index) => (
            <RecordColumn key={record.key} record={record} index={`0${index + 3}`} />
          ))}
        </div>

        <footer className="rw-footer">
          <div className="rw-footer-mark"><span>D/W</span><i /></div>
          <p>Five disciplines. Every mark earned.</p>
          <span className="rw-footer-count"><b>{yourCount}</b> personal highlights</span>
        </footer>
      </div>
    </main>
  );
}
