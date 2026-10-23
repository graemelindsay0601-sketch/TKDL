import { recordsView } from "./_fixtures";
import "./_group.css";
import "./Redesign.css";

const SOURCE = { LIVE: "Live darts", QUICK_SIM: "Quick-sim", SIMULATED: "Tour" } as const;
const displayValue = (unit: string, value: number) =>
  unit === "average" ? value.toFixed(2) : unit === "legs" ? `${value} leg${value === 1 ? "" : "s"}` : String(value);
const week = (day: number) => Math.ceil(day / 7);

function RecordRows({ record, nineDarters = false }: {
  record: typeof recordsView.records[number];
  nineDarters?: boolean;
}) {
  if (!record.entries.length) {
    return <p className="wr-redesign-empty">
      {nineDarters
        ? "No nine-darter yet. The first one in this darts world will be remembered here."
        : "Nothing recorded yet. This category will appear when a qualifying match sets a mark."}
    </p>;
  }

  return (
    <ol className={`wr-redesign-list${nineDarters ? " wr-redesign-list--nines" : ""}`}>
      {record.entries.map((entry, index) => (
        <li
          className={entry.you ? "is-you" : ""}
          key={`${entry.matchId}:${entry.participantKey}`}
        >
          <b>{nineDarters ? "•" : String(index + 1).padStart(2, "0")}</b>
          <span>
            {entry.you
              ? <strong>{entry.name} (you)</strong>
              : <a href="#sample-player-profile" aria-label={`View ${entry.name} profile`}>{entry.name}</a>}
          </span>
          {!nineDarters && <em>{displayValue(record.unit, entry.value)}</em>}
          <small>
            {entry.eventName} · Season {entry.season}
            {nineDarters ? `, week ${week(entry.day)}` : ""}
            {" · "}{SOURCE[entry.source]}
          </small>
        </li>
      ))}
    </ol>
  );
}

export function Redesign() {
  const all = recordsView.records;
  const nines = all.find((record) => record.key === "nine-darter");
  const categories = all.filter((record) => record.key !== "nine-darter");
  const yourEntries = all.flatMap((record) => record.entries).filter((entry) => entry.you).length;

  return (
    <main className="wr-redesign">
      <div className="wr-redesign-wrap">
        <div className="wr-redesign-topline">
          <div className="wr-redesign-brand">
            <span className="wr-redesign-brand-mark" aria-hidden="true"><span>TK</span></span>
            <span>TKDL Career</span>
          </div>
          <span className="wr-redesign-edition">Darts World / Official archive</span>
        </div>

        <div className="wr-redesign-sample">Visual sample · fictional Career data</div>

        <header className="wr-redesign-hero">
          <div>
            <p className="wr-redesign-kicker">Darts World · Records archive</p>
            <h1>Records<br />Book</h1>
            <p className="wr-redesign-subtitle">
              The verified marks set across this darts world. Steel-tip only; averages require at least six legs.
            </p>
          </div>
          <dl className="wr-redesign-stats">
            <div><dt>Nine-dart finishes</dt><dd>{nines?.entries.length ?? 0}</dd></div>
            <div><dt>Your record entries</dt><dd>{yourEntries}</dd></div>
          </dl>
        </header>

        <div className="wr-redesign-rule">Recorded in this world</div>

        <div className="wr-redesign-grid">
          {nines && (
            <section className="wr-redesign-section wr-redesign-section--feature" aria-labelledby="wr-redesign-nines">
              <header>
                <span className="wr-redesign-index" aria-hidden="true">01</span>
                <h2 id="wr-redesign-nines">Nine-dart finishes</h2>
                <span className="wr-redesign-section-label">Perfect leg</span>
              </header>
              <RecordRows record={nines} nineDarters />
              {recordsView.nineDartersSince === "BOOK_ADDED" && (
                <p className="wr-redesign-note">
                  Nine-darters are counted from when the records book was added to this Career.
                </p>
              )}
            </section>
          )}

          {categories.map((record, index) => (
            <section className="wr-redesign-section" key={record.key} aria-labelledby={`wr-record-${record.key}`}>
              <header>
                <span className="wr-redesign-index" aria-hidden="true">{String(index + 2).padStart(2, "0")}</span>
                <h2 id={`wr-record-${record.key}`}>{record.label}</h2>
                <span className="wr-redesign-section-label">World mark</span>
              </header>
              <RecordRows record={record} />
            </section>
          ))}
        </div>

        <footer className="wr-redesign-footer">
          <span>TKDL Career · Darts World</span>
          <span>Steel-tip record standard</span>
        </footer>
      </div>
    </main>
  );
}
