import { recordsView } from "./_fixtures";
import "./_group.css";

const SOURCE = { LIVE: "Live darts", QUICK_SIM: "Quick-sim", SIMULATED: "Tour" } as const;
const displayValue = (unit: string, value: number) => unit === "average" ? value.toFixed(2) : unit === "legs" ? `${value} leg${value === 1 ? "" : "s"}` : String(value);
const week = (day: number) => Math.ceil(day / 7);

function MedalMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="9" r="6.5"/><path d="m8 14-1.5 8L12 19l5.5 3L16 14"/></svg>;
}

function CurrentRecordList({ record, numbered = false }: { record: typeof recordsView.records[number]; numbered?: boolean }) {
  return record.entries.length ? <ol className="wr-current-list">
    {record.entries.map((entry, index) => <li className={entry.you ? "is-you" : ""} key={`${entry.matchId}:${entry.participantKey}`}>
      {numbered && <b>{index + 1}</b>}
      <span>{entry.you ? <strong>{entry.name} (you)</strong> : <a href="#sample-player">{entry.name}</a>}</span>
      {numbered && <em>{displayValue(record.unit, entry.value)}</em>}
      <small>{entry.eventName} · Season {entry.season}{record.key === "nine-darter" ? `, week ${week(entry.day)}` : ""} · {SOURCE[entry.source]}</small>
    </li>)}
  </ol> : <p className="wr-current-empty">Nothing recorded yet.</p>;
}

export function Current() {
  const all = recordsView.records;
  const nines = all.find(record => record.key === "nine-darter")?.entries ?? [];
  const yours = all.flatMap(record => record.entries).filter(entry => entry.you).length;

  return <main className="wr-current">
    <div className="wr-current-wrap">
      <div className="wr-sample-tag">Visual sample · fictional Career data</div>
      <header className="wr-current-hero">
        <div className="wr-current-copy">
          <p>Darts World</p>
          <h1>Records Book</h1>
          <span>The best performances in your darts world, from every match played. Steel-tip only; averages need at least six legs.</span>
        </div>
        <dl className="wr-current-stats">
          <div><dt>Nine-darters</dt><dd>{nines.length}</dd></div>
          <div><dt>Your entries</dt><dd>{yours}</dd></div>
        </dl>
      </header>

      <section className="wr-current-section" aria-labelledby="wr-current-nines">
        <header><span className="wr-current-medal"><MedalMark /></span><h2 id="wr-current-nines">Nine-dart finishes</h2></header>
        {nines.length ? <ol className="wr-current-list wr-current-list--nines">{nines.map(entry => <li className={entry.you ? "is-you" : ""} key={`${entry.matchId}:${entry.participantKey}`}>
          <span>{entry.you ? <strong>{entry.name} (you)</strong> : <a href="#sample-player">{entry.name}</a>}</span>
          <small>{entry.eventName} · Season {entry.season}, week {week(entry.day)} · {SOURCE[entry.source]}</small>
        </li>)}</ol> : <p className="wr-current-empty">No nine-darter yet. The first one in this darts world will be remembered here.</p>}
        {recordsView.nineDartersSince === "BOOK_ADDED" && <p className="wr-current-note">Nine-darters are counted from when the records book was added to this Career.</p>}
      </section>

      {all.filter(record => record.key !== "nine-darter").map(record => <section className="wr-current-section" key={record.key}>
        <header><span className="wr-current-medal"><MedalMark /></span><h2>{record.label}</h2></header>
        <CurrentRecordList record={record} numbered />
      </section>)}
    </div>
  </main>;
}
