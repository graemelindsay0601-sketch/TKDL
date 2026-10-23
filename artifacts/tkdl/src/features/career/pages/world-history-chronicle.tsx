import { useMemo, useState } from "react";
import { Link } from "wouter";
import type { LegacyView } from "../../../../../api-server/src/career/legacy/types";
import { titleCase } from "../model";
import "./world-history-chronicle.css";

const PAGE_SIZE = 5;

export function WorldHistoryChronicleHero({ data, saveId }: { data: LegacyView; saveId: string }) {
  const seasons = data.completedSeasons;
  const firstSeason = seasons.length ? Math.min(...seasons) : null;
  const latestSeason = seasons.length ? Math.max(...seasons) : null;
  const recordedPlayers = data.players.filter(player => player.id !== "HUMAN");
  const retiredPlayers = recordedPlayers.filter(player => player.retiredSeason);

  return <>
    <div className="whr-topline">
      <Link className="whr-brand" href={`/career/${saveId}/world`}>
        <span className="whr-brand-mark" aria-hidden="true">TK</span>
        <span>TKDL Career · Darts World</span>
      </Link>
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
        <strong>{firstSeason === null ? "No completed seasons" : `Seasons ${firstSeason}—${latestSeason}`}</strong>
        <span>Recorded from completed Career seasons</span>
      </aside>
    </header>
    <section className="whr-facts" aria-label="World archive totals">
      <div className="whr-fact"><small>Completed seasons</small><strong>{seasons.length}</strong></div>
      <div className="whr-fact"><small>Recorded players</small><strong>{recordedPlayers.length}</strong></div>
      <div className="whr-fact"><small>Retired players</small><strong>{retiredPlayers.length}</strong></div>
      <div className="whr-fact"><small>Hall of Fame</small><strong>{data.hallOfFame.length}</strong></div>
    </section>
  </>;
}

export function WorldHistoryChronicleArchive({ data, saveId }: { data: LegacyView; saveId: string }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const seasons = useMemo(() => data.world
    .map((record, index) => ({ season: data.completedSeasons[index], record }))
    .filter((entry): entry is { season: number; record: LegacyView["world"][number] } => Number.isInteger(entry.season)),
  [data.completedSeasons, data.world]);
  const pageCount = Math.ceil(seasons.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const visibleSeasons = seasons.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const playerName = (id: string) => data.players.find(player => player.id === id)?.name ?? "Recorded participant";
  const filteredPlayers = useMemo(() => data.players
    .filter(player => player.id !== "HUMAN" && player.name.toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, 30), [data.players, search]);

  return <>
    {seasons.length ? <>
      <div className="whr-seasons">
        {visibleSeasons.map(({ season, record }) => <article className="whr-season" key={season}>
          <div className="whr-season-rail"><small>Record</small><strong>S{season}</strong><b aria-hidden="true" /></div>
          <div className="whr-season-main">
            <div className="whr-number-one">
              <small>World number one</small>
              <strong>{record.numberOne?.name ?? "Not recorded"}</strong>
              {record.numberOne && <em>Ranking snapshot · Week {record.numberOne.week}</em>}
            </div>
            <div className="whr-groups">
              {record.champions.length > 0 && <section className="whr-group">
                <h3>Season champions</h3>
                {record.champions.map(champion => <div className="whr-entry" key={champion.id}>
                  <strong><span className="whr-tier">{titleCase(champion.tier)}</span>{champion.name}</strong>
                  <span>{playerName(champion.participant)}</span>
                </div>)}
              </section>}
              {record.cardChanges.length > 0 && <section className="whr-group">
                <h3>Tour Card changes</h3>
                {record.cardChanges.map(change => <div className="whr-entry" key={change.id}>
                  <strong>{playerName(change.participant)}</strong>
                  <span>{titleCase(change.source)} · {titleCase(change.status)}</span>
                </div>)}
              </section>}
              {record.retirements.length > 0 && <section className="whr-group">
                <h3>Retirements</h3>
                {record.retirements.map(person => <div className="whr-entry" key={person.id}>
                  <Link href={`/career/${saveId}/history/npcs/${person.id}`}><strong>{person.name}</strong></Link>
                  <span>Career concluded</span>
                </div>)}
              </section>}
              {record.newEntrants.length > 0 && <section className="whr-group">
                <h3>New entrants · {record.newEntrants.length}</h3>
                <div className="whr-names">{record.newEntrants.slice(0, 8).map(person => <span key={person.id}>{person.name}</span>)}</div>
              </section>}
            </div>
          </div>
        </article>)}
      </div>
      {pageCount > 1 && <nav className="whr-pager" aria-label="World history archive pagination">
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>Previous seasons</button>
        <span>{currentPage + 1} / {pageCount}</span>
        <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}>Earlier seasons</button>
      </nav>}
    </> : <div className="whr-empty">
      <strong>No completed world seasons yet</strong>
      <p>Champions, ranking snapshots and career changes appear here when a season is complete. No pre-save history is inferred.</p>
    </div>}

    <section className="whr-directory" aria-labelledby="whr-directory-title">
      <div className="whr-directory-head">
        <div><h2 id="whr-directory-title">Historical player index</h2><p>Active and retired names in the recorded world.</p></div>
        <input className="whr-search" type="search" maxLength={80} aria-label="Search historical players" placeholder="Search a public name" value={search} onChange={event => setSearch(event.target.value)} />
      </div>
      <div className="whr-directory-grid" aria-live="polite">
        {filteredPlayers.map(person => <Link className="whr-player" href={`/career/${saveId}/history/npcs/${person.id}`} key={person.id}>
          <span className="whr-monogram" aria-hidden="true">{person.name.split(" ").map(part => part[0]).join("")}</span>
          <span><strong>{person.name}</strong><small>{person.retiredSeason ? `Retired · season ${person.retiredSeason}` : "Active"}</small></span>
        </Link>)}
        {filteredPlayers.length === 0 && <p className="whr-empty-result">No recorded players match that name.</p>}
      </div>
    </section>
    <p className="whr-disclosure">Only completed seasons and player records stored in this Career are shown. Missing pre-save champions or ranking snapshots are not inferred.</p>
  </>;
}
