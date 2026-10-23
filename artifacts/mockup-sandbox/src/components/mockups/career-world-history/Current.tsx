import { useMemo, useState } from "react";
import "./_current.css";
import { archiveCounts, completedSeasons, players, world, type ArchivePlayer, type ChronicleSeason } from "./_fixtures";

const labels = ["Career Record", "Seasons", "Honours", "World History", "Event Legends", "Records", "Hall of Fame", "Retirement"];

export function Current() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("World History");
  const [selected, setSelected] = useState<ArchivePlayer | null>(null);
  const pageSize = 5;
  const pageCount = Math.ceil(world.length / pageSize);
  const seasons = useMemo(() => world.slice(page * pageSize, (page + 1) * pageSize), [page]);
  const matches = useMemo(
    () => players.filter((person) => person.name.toLowerCase().includes(search.toLowerCase())).slice(0, 30),
    [search],
  );
  const openPlayer = (event: React.MouseEvent<HTMLAnchorElement>, person: ArchivePlayer) => {
    event.preventDefault();
    setSelected(person);
  };
  const playerById = (id: string) => players.find((person) => person.id === id)?.name ?? "Recorded participant";

  return (
    <main className="wh-current">
      <div className="whc-shell">
        <header className="whc-hero">
          <p className="whc-kicker">Darts World · Champions &amp; records</p>
          <h1 className="whc-title">World history</h1>
          <p className="whc-subtitle">A record of completed seasons in this saved Career world. The archive begins with recorded Career history.</p>
          <div className="whc-stats" aria-label="World history totals">
            <div className="whc-stat"><small>Completed seasons</small><strong>{completedSeasons.length}</strong></div>
            <div className="whc-stat"><small>Recorded players</small><strong>{archiveCounts.recordedPlayers}</strong></div>
            <div className="whc-stat"><small>Retired players</small><strong>{archiveCounts.retiredPlayers}</strong></div>
            <div className="whc-stat"><small>Hall of Fame</small><strong>{archiveCounts.hallOfFame}</strong></div>
          </div>
        </header>

        <section className="whc-section" aria-labelledby="current-history-heading">
          <div className="whc-section-head"><h2 id="current-history-heading">History &amp; Legacy</h2></div>
          <nav className="whc-tabs" aria-label="History and Legacy areas" role="tablist">
            {labels.map((label) => <button key={label} type="button" role="tab" aria-selected={label === activeTab} onClick={() => setActiveTab(label)}>{label}</button>)}
          </nav>
          <div className="whc-body">
            {activeTab !== "World History" ? <div className="whc-disclosure">
              <strong>{activeTab}</strong> is outside this single-page preview.
              <button className="whc-tab-return" type="button" onClick={() => setActiveTab("World History")}>Return to World History</button>
            </div> : <>
            <h2 className="whc-eyebrow">Career world history</h2>
            {seasons.map((season: ChronicleSeason) => (
              <article className="whc-season career-archive__world-season" key={season.season}>
                <header>
                  <span className="whc-season-label">Season {season.season}</span>
                  <strong>World #1: {season.numberOne?.name ?? "not recorded"}</strong>
                  {season.numberOne && <small>Week {season.numberOne.week}</small>}
                </header>
                {season.champions.length > 0 && <>
                  <h3>Champions</h3>
                  {season.champions.map((champion) => <div className="whc-row career-archive__row" key={champion.id}>
                    <span className="whc-chip career-archive__chip">{champion.tier}</span><strong>{champion.name}</strong><em>{playerById(champion.participant)}</em>
                  </div>)}
                </>}
                {season.cardChanges.length > 0 && <>
                  <h3>Tour Card changes</h3>
                  {season.cardChanges.map((change) => <div className="whc-row career-archive__row" key={change.id}>
                    <span className="whc-chip career-archive__chip">Card</span><strong>{playerById(change.participant)}</strong><em>{change.source} · {change.status}</em>
                  </div>)}
                </>}
                {season.retirements.length > 0 && <>
                  <h3>Retirements</h3>
                  {season.retirements.map((person) => <div className="whc-row career-archive__row" key={person.id}>
                    <span className="whc-chip career-archive__chip">Retired</span>
                    <a className="whc-row-link" href={`#player-${person.id}`} onClick={(event) => openPlayer(event, person)}><strong>{person.name}</strong></a><em />
                  </div>)}
                </>}
                <h3>{season.newEntrants.length} new players</h3>
                <div className="whc-names career-archive__names">{season.newEntrants.slice(0, 8).map((person) => <span className="whc-name" key={person.id}>{person.name}</span>)}</div>
              </article>
            ))}
            {pageCount > 1 && <nav className="whc-pagination" aria-label="World history archive pagination">
              <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>Previous</button>
              <span>Page {page + 1} of {pageCount}</span>
              <button type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1}>Next</button>
            </nav>}

            <section aria-labelledby="historical-players">
              <div className="whc-tools">
                <h3 id="historical-players">Other players, including retired ones</h3>
                <input className="whc-search" aria-label="Search historical players" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search a public name" />
              </div>
              <p className="whc-hint">Showing up to 30 matches; use a name to find older retired players.</p>
              <div className="whc-player-grid career-archive__npc-grid">
                {matches.map((person) => <a className="whc-player-link career-archive__npc" href={`#player-${person.id}`} key={person.id} onClick={(event) => openPlayer(event, person)}>
                  <span className="whc-avatar" aria-hidden="true">{person.name.split(" ").map((part) => part[0]).join("")}</span>
                  <span><strong>{person.name}</strong><small>{person.retiredSeason ? `Retired season ${person.retiredSeason}` : "Active"}</small></span>
                </a>)}
                {matches.length === 0 && <p className="whc-hint">No recorded players match that name.</p>}
              </div>
            </section>
            <p className="whc-disclosure">Preview fixture data for visual review. Counts and season records are illustrative saved-world snapshots; no pre-save results or history are implied.</p>
            </>}
          </div>
        </section>
      </div>
      {selected && <aside className="whc-profile" aria-live="polite">
        <button type="button" aria-label="Close historical player preview" onClick={() => setSelected(null)}>×</button>
        <p className="whc-eyebrow">Historical player · local preview</p><strong>{selected.name}</strong>
        <p>{selected.retiredSeason ? `Retired in season ${selected.retiredSeason}.` : "Active in the recorded world archive."} Full historical Career details are not connected in this static preview.</p>
      </aside>}
    </main>
  );
}
