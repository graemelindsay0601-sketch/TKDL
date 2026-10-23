import { useMemo, useState, type MouseEvent } from "react";
import "./_redesign.css";
import { archiveCounts, completedSeasons, players, world, type ArchivePlayer } from "./_fixtures";

const tabs = ["Career Record", "Seasons", "Honours", "World History", "Event Legends", "Records", "Hall of Fame", "Retirement"];

export function Redesign() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("World History");
  const [selected, setSelected] = useState<ArchivePlayer | null>(null);
  const pageSize = 5;
  const pageCount = Math.ceil(world.length / pageSize);
  const seasons = useMemo(() => world.slice(page * pageSize, (page + 1) * pageSize), [page]);
  const filteredPlayers = useMemo(() => players.filter((person) => person.name.toLowerCase().includes(search.toLowerCase())).slice(0, 30), [search]);
  const playerName = (id: string) => players.find((person) => person.id === id)?.name ?? "Recorded participant";
  const selectPlayer = (event: MouseEvent<HTMLAnchorElement>, player: ArchivePlayer) => {
    event.preventDefault();
    setSelected(player);
  };

  return (
    <main className="wh-redesign">
      <div className="whr-container">
        <div className="whr-topline">
          <div className="whr-brand"><span className="whr-brand-mark">TK</span><span>TKDL Career · Darts World</span></div>
          <span>Official world archive</span>
        </div>
        <header className="whr-hero">
          <div>
            <p className="whr-kicker">The annual chronicle · champions, rankings &amp; careers</p>
            <h1>World<br />history</h1>
            <p className="whr-hero-copy">Every completed campaign leaves its mark. Explore the champions, world number ones and career changes recorded in this saved world.</p>
          </div>
          <aside className="whr-edition">
            <small>Archive edition</small>
            <strong>Seasons {completedSeasons[completedSeasons.length - 1]}—{completedSeasons[0]}</strong>
            <span>Recorded from completed Career seasons</span>
          </aside>
        </header>
        <section className="whr-facts" aria-label="World archive totals">
          <div className="whr-fact"><small>Completed seasons</small><strong>{completedSeasons.length}</strong></div>
          <div className="whr-fact"><small>Recorded players</small><strong>{archiveCounts.recordedPlayers}</strong></div>
          <div className="whr-fact"><small>Retired players</small><strong>{archiveCounts.retiredPlayers}</strong></div>
          <div className="whr-fact"><small>Hall of Fame</small><strong>{archiveCounts.hallOfFame}</strong></div>
        </section>

        <section aria-labelledby="whr-index-heading">
          <header className="whr-index"><h2 id="whr-index-heading">History &amp; Legacy</h2><small>Career archive / 04</small></header>
          <nav className="whr-tabrow" role="tablist" aria-label="History and Legacy areas">
            {tabs.map((tab) => <button type="button" role="tab" aria-selected={tab === activeTab} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}
          </nav>
          <div className="whr-archive">
            {activeTab !== "World History" ? <div className="whr-disclosure"><strong>{activeTab}</strong> is outside this single-page preview. <button type="button" onClick={() => setActiveTab("World History")}>Return to World History</button></div> : <>
            <div className="whr-seasons">
              {seasons.map((season) => <article className="whr-season" key={season.season}>
                <div className="whr-season-rail"><small>Record</small><strong>S{season.season}</strong><b aria-hidden="true" /></div>
                <div className="whr-season-main">
                  <div className="whr-number-one">
                    <small>World number one</small>
                    <strong>{season.numberOne?.name ?? "Not recorded"}</strong>
                    {season.numberOne && <em>Ranking snapshot · Week {season.numberOne.week}</em>}
                  </div>
                  <div className="whr-groups">
                    {season.champions.length > 0 && <section className="whr-group">
                      <h3>Season champions</h3>
                      {season.champions.map((champion) => <div className="whr-entry" key={champion.id}><strong><span className="whr-tier">{champion.tier}</span>{champion.name}</strong><span>{playerName(champion.participant)}</span></div>)}
                    </section>}
                    {season.cardChanges.length > 0 && <section className="whr-group">
                      <h3>Tour Card changes</h3>
                      {season.cardChanges.map((change) => <div className="whr-entry" key={change.id}><strong>{playerName(change.participant)}</strong><span>{change.source} · {change.status}</span></div>)}
                    </section>}
                    {season.retirements.length > 0 && <section className="whr-group">
                      <h3>Retirements</h3>
                      {season.retirements.map((person) => <div className="whr-entry" key={person.id}>
                        <a href={`#player-${person.id}`} onClick={(event) => selectPlayer(event, person)}><strong>{person.name}</strong></a><span>Career concluded</span>
                      </div>)}
                    </section>}
                    <section className="whr-group"><h3>New entrants · {season.newEntrants.length}</h3>
                      <div className="whr-names">{season.newEntrants.slice(0, 8).map((person) => <span key={person.id}>{person.name}</span>)}</div>
                    </section>
                  </div>
                </div>
              </article>)}
            </div>
            {pageCount > 1 && <nav className="whr-pager" aria-label="World history archive pagination">
              <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous seasons</button>
              <span>{page + 1} / {pageCount}</span>
              <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Earlier seasons</button>
            </nav>}

            <section className="whr-directory" aria-labelledby="whr-directory-title">
              <div className="whr-directory-head">
                <div><h2 id="whr-directory-title">Historical player index</h2><p>Active and retired names in the recorded world.</p></div>
                <input className="whr-search" aria-label="Search historical players" placeholder="Search a public name" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <div className="whr-directory-grid">
                {filteredPlayers.map((person) => <a className="whr-player" href={`#player-${person.id}`} key={person.id} onClick={(event) => selectPlayer(event, person)}>
                  <span className="whr-monogram" aria-hidden="true">{person.name.split(" ").map((part) => part[0]).join("")}</span>
                  <span><strong>{person.name}</strong><small>{person.retiredSeason ? `Retired · season ${person.retiredSeason}` : "Active"}</small></span>
                </a>)}
                {filteredPlayers.length === 0 && <p className="whr-directory-head">No recorded players match that name.</p>}
              </div>
            </section>
            <p className="whr-disclosure">Visual review sample data. These records describe only the supplied completed-season fixtures; no pre-save champions, ranking snapshots or player history are inferred.</p>
            </>}
          </div>
        </section>
      </div>
      {selected && <aside className="whr-profile" aria-live="polite">
        <button type="button" aria-label="Close historical player preview" onClick={() => setSelected(null)}>×</button>
        <small>Local historical-player preview</small><strong>{selected.name}</strong>
        <p>{selected.retiredSeason ? `Retired during season ${selected.retiredSeason}.` : "Active in the recorded world."} A full career record is not connected in this static fixture.</p>
      </aside>}
    </main>
  );
}
