import { recordsView } from "./_fixtures";
import "./_group.css";
import "./Refined.css";

const SOURCE = { LIVE: "Live darts", QUICK_SIM: "Quick-sim", SIMULATED: "Tour" } as const;

const displayValue = (unit: string, value: number) =>
  unit === "average" ? value.toFixed(2) : unit === "legs" ? `${value} leg${value === 1 ? "" : "s"}` : String(value);

const week = (day: number) => Math.ceil(day / 7);

function EntryList({ record, nineDarters = false }: {
  record: typeof recordsView.records[number];
  nineDarters?: boolean;
}) {
  if (!record.entries.length) {
    return (
      <p className="wr-refined-empty">
        {nineDarters
          ? "No nine-darter yet. The first one in this darts world will be remembered here."
          : "Nothing recorded yet. This category will appear when a qualifying match sets a mark."}
      </p>
    );
  }

  return (
    <ol className={`wr-refined-entries${nineDarters ? " wr-refined-entries--nines" : ""}`}>
      {record.entries.map((entry, index) => (
        <li className={entry.you ? "is-you" : ""} key={`${entry.matchId}:${entry.participantKey}`}>
          <span className="wr-refined-rank" aria-hidden="true">
            {nineDarters ? <i /> : String(index + 1).padStart(2, "0")}
          </span>
          <div className="wr-refined-entry-main">
            <span className="wr-refined-player">
              {entry.name}{entry.you && <small>you</small>}
            </span>
            <span className="wr-refined-detail">
              {entry.eventName}<span aria-hidden="true"> / </span>Season {entry.season}
              {nineDarters ? ` / Week ${week(entry.day)}` : ""}
              <span aria-hidden="true"> / </span>{SOURCE[entry.source]}
            </span>
          </div>
          {!nineDarters && <strong className="wr-refined-value">{displayValue(record.unit, entry.value)}</strong>}
        </li>
      ))}
    </ol>
  );
}

export function Refined() {
  const records = recordsView.records;
  const nines = records.find((record) => record.key === "nine-darter");
  const categories = records.filter((record) => record.key !== "nine-darter");
  const topAverage = records.find((record) => record.key === "match-average")?.entries[0]?.value;
  const highestCheckout = records.find((record) => record.key === "checkout")?.entries[0]?.value;

  return (
    <main className="wr-refined">
      <div className="wr-refined-page">
        <div className="wr-refined-masthead">
          <div className="wr-refined-brand">
            <span className="wr-refined-monogram" aria-hidden="true">TK</span>
            <span className="wr-refined-brand-name">TKDL <b>Career</b></span>
          </div>
          <span className="wr-refined-archive-label">Darts world <i /> Official archive</span>
        </div>

        <div className="wr-refined-sample">Fictional sample Career data</div>

        <header className="wr-refined-hero">
          <div className="wr-refined-hero-copy">
            <p className="wr-refined-kicker"><span>Career archive</span><span>—</span><span>Record book</span></p>
            <h1>Records <em>Book</em></h1>
            <p className="wr-refined-intro">
              The standout performances in this darts world, recorded match by match.
            </p>
            <p className="wr-refined-standard">
              <span className="wr-refined-standard-rule" />
              Steel-tip only <i /> Averages require at least six legs
            </p>
          </div>
          <aside className="wr-refined-highlights" aria-label="Records at a glance">
            <p>Inside this archive</p>
            <dl>
              <div><dt>Nine-dart finishes</dt><dd>{nines?.entries.length ?? 0}</dd></div>
              <div><dt>Top match average</dt><dd>{topAverage === undefined ? "—" : displayValue("average", topAverage)}</dd></div>
              <div><dt>Highest checkout</dt><dd>{highestCheckout === undefined ? "—" : displayValue("checkout", highestCheckout)}</dd></div>
            </dl>
          </aside>
          <div className="wr-refined-hero-foot">
            <span>TKDL Career <b>·</b> Darts World</span>
            <span>THE RECORDS BOOK</span>
          </div>
        </header>

        <div className="wr-refined-section-heading">
          <span className="wr-refined-section-number">01 — 05</span>
          <h2>World marks</h2>
          <span className="wr-refined-section-note">Recorded in this world</span>
        </div>

        <div className="wr-refined-ledger">
          {nines && (
            <section className="wr-refined-category wr-refined-category--feature" aria-labelledby="wr-refined-nine-title">
              <div className="wr-refined-category-head">
                <span className="wr-refined-category-num">01</span>
                <div>
                  <span className="wr-refined-eyebrow">The perfect leg</span>
                  <h3 id="wr-refined-nine-title">Nine-dart finishes</h3>
                </div>
                <span className="wr-refined-record-mark" aria-label="Nine-dart record">
                  <b>9</b><i>DARTS</i>
                </span>
              </div>
              <EntryList record={nines} nineDarters />
              {recordsView.nineDartersSince === "BOOK_ADDED" && (
                <p className="wr-refined-note">
                  Nine-darters are counted from when the records book was added to this Career.
                </p>
              )}
            </section>
          )}

          {categories.map((record, index) => (
            <section
              className="wr-refined-category"
              key={record.key}
              aria-labelledby={`wr-refined-title-${record.key}`}
            >
              <div className="wr-refined-category-head">
                <span className="wr-refined-category-num">{String(index + 2).padStart(2, "0")}</span>
                <div>
                  <span className="wr-refined-eyebrow">Career benchmark</span>
                  <h3 id={`wr-refined-title-${record.key}`}>{record.label}</h3>
                </div>
                <span className="wr-refined-category-rule" aria-hidden="true" />
              </div>
              <EntryList record={record} />
            </section>
          ))}
        </div>

        <footer className="wr-refined-footer">
          <span className="wr-refined-footer-brand">TKDL <b>Career</b></span>
          <span>Steel-tip record standard</span>
          <span className="wr-refined-footer-seal">Darts World <i>·</i> Archive</span>
        </footer>
      </div>
    </main>
  );
}
