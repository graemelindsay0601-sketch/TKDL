import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Crown, Search, Sparkles, Trophy, Users,
} from "lucide-react";
import "./_group.css";
import "./CurrentProduction.css";

type Player = {
  id: string;
  name: string;
  nickname: string;
  country: string;
  ranking: number | null;
  status: "ACTIVE" | "RETIRED";
  kitId: string;
};

const players: Player[] = [
  { id: "p01", name: "Rook Calder", nickname: "The North Star", country: "Scotland", ranking: 1, status: "ACTIVE", kitId: "kit-50-01" },
  { id: "p02", name: "Mara Vale", nickname: "The Iron Rose", country: "England", ranking: 2, status: "ACTIVE", kitId: "kit-50-02" },
  { id: "p03", name: "Jonah Mercer", nickname: "The Metronome", country: "Wales", ranking: 4, status: "ACTIVE", kitId: "kit-50-03" },
  { id: "p04", name: "Elliot Shaw", nickname: "The Quiet Storm", country: "England", ranking: 7, status: "ACTIVE", kitId: "kit-50-04" },
  { id: "p05", name: "Drew Lennox", nickname: "The Foundry", country: "Ireland", ranking: 12, status: "RETIRED", kitId: "kit-50-05" },
  { id: "p06", name: "Celia North", nickname: "The Ace", country: "Scotland", ranking: 18, status: "ACTIVE", kitId: "kit-50-06" },
  { id: "p07", name: "Tomas Varga", nickname: "The Switch", country: "Czechia", ranking: 23, status: "ACTIVE", kitId: "kit-50-07" },
  { id: "p08", name: "Niall Byrne", nickname: "Copperhead", country: "Ireland", ranking: 31, status: "RETIRED", kitId: "kit-50-08" },
  { id: "p09", name: "Freya Holt", nickname: "The Long Count", country: "Norway", ranking: 38, status: "ACTIVE", kitId: "kit-50-09" },
  { id: "p10", name: "Luc Moreau", nickname: "L'Éclair", country: "France", ranking: 46, status: "ACTIVE", kitId: "kit-50-10" },
  { id: "p11", name: "Isaac Bell", nickname: "The Locksmith", country: "England", ranking: 63, status: "RETIRED", kitId: "kit-50-11" },
  { id: "p12", name: "Asha Quinn", nickname: "Redline", country: "Wales", ranking: null, status: "ACTIVE", kitId: "kit-50-12" },
];

export function CurrentProduction() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const pageSize = 6;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return players.filter((player) =>
      (status === "ALL" || player.status === status) &&
      (!term || `${player.name} ${player.nickname} ${player.country}`.toLowerCase().includes(term)),
    );
  }, [search, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const offset = page * pageSize;

  const reset = () => {
    setSearch("");
    setStatus("ALL");
    setPage(0);
  };

  return (
    <div className="career-root">
      <main className="career-world-players-page">
        <header className="pwr-masthead">
          <a className="pwr-brand" href="#career-world"><span className="pwr-brand__crest"><Users size={17} /></span><span><b>TKDL</b><small>CAREER WORLD</small></span></a>
          <nav aria-label="Career location"><span>CAREER</span><i>/</i><a href="#darts-world">DARTS WORLD</a><i>/</i><strong>PLAYERS</strong></nav>
          <span className="pwr-season">WORLD TOUR <b>·</b> SEASON 04 · SAMPLE</span>
        </header>
        <section className="pwr-hero">
          <div className="pwr-hero__copy">
            <span className="pwr-kicker"><Sparkles size={13} /> THE WORLD ROSTER <i>—</i> CAREER EDITION</span>
            <h1>THE<br /><span>PLAYERS</span><sup>01</sup></h1>
            <p>Every name has a story.<br />Every ranking has a history.</p>
            <div className="pwr-hero__foot"><span>ILLUSTRATIVE DIRECTORY</span><span><i /> SAMPLE PLAYER FACTS</span></div>
          </div>
          <div className="pwr-art" aria-hidden="true">
            <img className="pwr-art__lineup" src="/__mockup/images/career-world-players-lineup-studio.png" alt="" />
            <span className="pwr-art__serial">THE WORLD ROSTER · CAREER EDITION</span>
          </div>
          <aside className="pwr-hero__stat">
            <span className="pwr-hero__stat-icon"><Crown size={17} /></span>
            <strong>{String(filtered.length).padStart(2, "0")}</strong>
            <small>PLAYER<br />PROFILES</small>
            <span className="pwr-hero__stat-rule" />
            <span className="pwr-hero__stat-caption">PUBLIC<br />RECORD</span>
          </aside>
        </section>
        <section className="pwr-directory" aria-label="World players directory">
          <div className="pwr-directory__heading">
            <div><span className="pwr-section-kicker">01 <i>—</i> ORDER OF MERIT</span><h2>The world roster <small>{filtered.length} profiles</small></h2></div>
            <span className="pwr-edition"><Trophy size={15} /> ILLUSTRATIVE RECORD <b>SEASON 04</b></span>
          </div>
          <div className="pwr-toolbar">
            <label className="pwr-search"><Search size={17} /><input aria-label="Search players" maxLength={80} placeholder="Search by player, nickname or nation" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></label>
            <div className="pwr-filter"><span>STATUS</span><label><select aria-label="Career status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><option value="ALL">All players</option><option value="ACTIVE">Active</option><option value="RETIRED">Retired</option></select></label></div>
            <div className="pwr-results"><b>{String(filtered.length).padStart(2, "0")}</b><span>PROFILES</span></div>
          </div>
          <div className="pwr-roster" aria-live="polite">
            {shown.map((player, index) => (
              <a key={player.id} className={`pwr-player${player.status === "RETIRED" ? " is-retired" : ""}`} href={`#profile-${player.id}`} aria-label={`Open ${player.name}'s player profile`}>
                <div className="pwr-player__topline"><span>WORLD ORDER <b>·</b> PROFILE {String(offset + index + 1).padStart(2, "0")}</span><ArrowRight size={16} /></div>
                <div className="pwr-player__main">
                  <span className="pwr-kit" aria-label={`${player.name}'s shirt`}><img src={`/__mockup/images/career-world-players/${player.kitId}.webp`} alt="" /></span>
                  <span className="pwr-player__copy">
                    <span className="pwr-player__rank">RANK <b>{player.ranking !== null ? `#${String(player.ranking).padStart(2, "0")}` : "—"}</b></span>
                    <strong>{player.name}</strong>
                    <em>“{player.nickname}”</em>
                    <span className="pwr-player__country">{player.country}</span>
                  </span>
                  <span className="pwr-player__medal"><span>{player.ranking !== null ? String(player.ranking).padStart(2, "0") : "—"}</span><small>WORLD<br />RANK</small></span>
                </div>
                <span className="pwr-player__foot"><span className={`pwr-status${player.status === "RETIRED" ? " is-retired" : ""}`}><i />{player.status === "RETIRED" ? "Retired" : "Active"}</span><span>OPEN PROFILE <ArrowRight size={12} /></span></span>
              </a>
            ))}
            {!shown.length && <div className="pwr-empty"><Users size={28} /><strong>No player found</strong><p>Try another name or career status.</p><button type="button" onClick={reset}>Clear filters</button></div>}
          </div>
          <footer className="pwr-pagination">
            <span>SHOWING <b>{filtered.length ? offset + 1 : 0}–{Math.min(offset + shown.length, filtered.length)}</b> OF <b>{String(filtered.length).padStart(2, "0")}</b> PROFILES</span>
            <div><button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}><ArrowLeft size={15} /></button><span>{String(page + 1).padStart(2, "0")} <i>/</i> {String(pageCount).padStart(2, "0")}</span><button type="button" aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}><ArrowRight size={15} /></button></div>
          </footer>
        </section>
        <footer className="pwr-bottom"><span>TKDL <i>×</i> DARTS WORLD</span><p>Fictional sample data for review.</p><a href="#darts-world">DARTS WORLD <ArrowRight size={13} /></a></footer>
      </main>
    </div>
  );
}
