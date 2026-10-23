import { useMemo, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, ChevronDown, Crown, Search,
  SlidersHorizontal, Sparkles, Target, Trophy,
} from "lucide-react";
import "./_group.css";
import "./Redesign.css";

type Player = {
  name: string;
  nickname: string;
  country: string;
  countryCode: string;
  rank: number | null;
  status: "Active" | "Retired";
  kitId: string;
  kitName: string;
};

const players: Player[] = [
  { name: "Rook Calder", nickname: "The North Star", country: "Scotland", countryCode: "SCO", rank: 1, status: "Active", kitId: "kit-50-01", kitName: "Redline" },
  { name: "Mara Vale", nickname: "The Iron Rose", country: "England", countryCode: "ENG", rank: 2, status: "Active", kitId: "kit-50-02", kitName: "Circuit Break" },
  { name: "Jonah Mercer", nickname: "The Metronome", country: "Wales", countryCode: "WAL", rank: 4, status: "Active", kitId: "kit-50-03", kitName: "Flightpath" },
  { name: "Elliot Shaw", nickname: "The Quiet Storm", country: "England", countryCode: "ENG", rank: 7, status: "Active", kitId: "kit-50-04", kitName: "Bullseye" },
  { name: "Drew Lennox", nickname: "The Foundry", country: "Ireland", countryCode: "IRL", rank: 12, status: "Retired", kitId: "kit-50-05", kitName: "Nightshift" },
  { name: "Celia North", nickname: "The Ace", country: "Scotland", countryCode: "SCO", rank: 18, status: "Active", kitId: "kit-50-06", kitName: "Vault" },
  { name: "Tomas Varga", nickname: "The Switch", country: "Czechia", countryCode: "CZE", rank: 23, status: "Active", kitId: "kit-50-07", kitName: "Prism" },
  { name: "Niall Byrne", nickname: "Copperhead", country: "Ireland", countryCode: "IRL", rank: 31, status: "Retired", kitId: "kit-50-08", kitName: "Heritage" },
  { name: "Freya Holt", nickname: "The Long Count", country: "Norway", countryCode: "NOR", rank: 38, status: "Active", kitId: "kit-50-09", kitName: "Counterpoint" },
  { name: "Luc Moreau", nickname: "L'Éclair", country: "France", countryCode: "FRA", rank: 46, status: "Active", kitId: "kit-50-10", kitName: "Stormline" },
  { name: "Isaac Bell", nickname: "The Locksmith", country: "England", countryCode: "ENG", rank: 63, status: "Retired", kitId: "kit-50-11", kitName: "Gilded Orbit" },
  { name: "Asha Quinn", nickname: "Redline", country: "Wales", countryCode: "WAL", rank: null, status: "Active", kitId: "kit-50-12", kitName: "Apex Cobalt" },
];

function PlayerLineupArt() {
  return (
    <div className="pwr-art" aria-hidden="true">
      <img className="pwr-art__lineup" src="/__mockup/images/career-world-players-lineup-studio.png" alt="" />
      <span className="pwr-art__serial">THE WORLD ROSTER · 2026</span>
    </div>
  );
}

function PremiumShirt({ player }: { player: Player }) {
  return (
    <div className="pwr-kit" aria-label={`${player.name} wearing ${player.kitName}`}>
      <img src={`/__mockup/images/career-world-players/${player.kitId}.webp`} alt="" aria-hidden="true" />
      <span>{player.kitName}</span>
    </div>
  );
}

function PlayerCard({ player, index }: { player: Player; index: number }) {
  return (
    <a className={`pwr-player${player.status === "Retired" ? " is-retired" : ""}`} href={`#player-${player.kitId}`} aria-label={`Open ${player.name}'s player profile`}>
      <div className="pwr-player__topline"><span>WORLD ORDER <b>·</b> PROFILE {String(index + 1).padStart(2, "0")}</span><ArrowRight size={16} /></div>
      <div className="pwr-player__main">
        <PremiumShirt player={player} />
        <div className="pwr-player__copy">
          <span className="pwr-player__rank">{player.rank ? <>RANK <b>#{String(player.rank).padStart(2, "0")}</b></> : <>RANK <b>—</b></>}</span>
          <strong>{player.name}</strong>
          <em>“{player.nickname}”</em>
          <span className="pwr-player__country"><i>{player.countryCode}</i>{player.country}</span>
        </div>
        <div className="pwr-player__medal"><span>{player.rank ? String(player.rank).padStart(2, "0") : "—"}</span><small>WORLD<br />RANK</small></div>
      </div>
      <div className="pwr-player__foot"><span className={`pwr-status${player.status === "Retired" ? " is-retired" : ""}`}><i />{player.status}</span><span>OPEN PROFILE <ArrowRight size={12} /></span></div>
    </a>
  );
}

export function Redesign() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All players");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => players.filter((player) => {
    const query = search.trim().toLowerCase();
    return (status === "All players" || player.status === status) &&
      (!query || `${player.name} ${player.nickname} ${player.country} ${player.countryCode}`.toLowerCase().includes(query));
  }), [search, status]);
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagePlayers = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const activeRanked = players.filter((player) => player.status === "Active" && player.rank !== null).length;

  const changeFilter = (nextStatus: string) => {
    setStatus(nextStatus);
    setPage(0);
  };

  return (
    <main className="players-world">
      <div className="pwr-shell">
        <header className="pwr-masthead">
          <a className="pwr-brand" href="#career-world" aria-label="TKDL Career World home">
            <span className="pwr-brand__crest"><Target size={18} /></span>
            <span><b>TKDL</b><small>CAREER WORLD</small></span>
          </a>
          <nav aria-label="Career location"><span>CAREER</span><i>/</i><span>DARTS WORLD</span><i>/</i><strong>PLAYERS</strong></nav>
          <span className="pwr-season">WORLD TOUR <b>·</b> SEASON 04</span>
        </header>

        <section className="pwr-hero">
          <div className="pwr-hero__copy">
            <span className="pwr-kicker"><Sparkles size={13} /> THE WORLD ROSTER <i>—</i> 2026 EDITION</span>
            <h1>THE<br /><span>PLAYERS</span><sup>01</sup></h1>
            <p>Every name has a story.<br />Every ranking has a history.</p>
            <div className="pwr-hero__foot"><span>OFFICIAL CAREER DIRECTORY</span><span><i /> ILLUSTRATIVE PREVIEW</span></div>
          </div>
          <PlayerLineupArt />
          <aside className="pwr-hero__stat">
            <span className="pwr-hero__stat-icon"><Crown size={17} /></span>
            <strong>{String(activeRanked).padStart(2, "0")}</strong>
            <small>ACTIVE<br />RANKED</small>
            <span className="pwr-hero__stat-rule" />
            <span className="pwr-hero__stat-caption">THE FIELD<br />IS SET</span>
          </aside>
        </section>

        <section className="pwr-directory" aria-label="World players directory">
          <div className="pwr-directory__heading">
            <div><span className="pwr-section-kicker">01 <i>—</i> ORDER OF MERIT</span><h2>The world roster <small>{players.length} profiles</small></h2></div>
            <span className="pwr-edition"><Trophy size={15} /> OFFICIAL RECORD <b>NO. 04</b></span>
          </div>
          <div className="pwr-toolbar">
            <label className="pwr-search"><Search size={17} /><input aria-label="Search players" placeholder="Search by player, nickname or nation" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /><kbd>⌘ K</kbd></label>
            <div className="pwr-filter"><SlidersHorizontal size={15} /><span>STATUS</span><label><select aria-label="Career status" value={status} onChange={(event) => changeFilter(event.target.value)}><option>All players</option><option>Active</option><option>Retired</option></select><ChevronDown size={14} /></label></div>
            <div className="pwr-results"><b>{String(filtered.length).padStart(2, "0")}</b><span>PROFILES</span></div>
          </div>
          <div className="pwr-roster" aria-live="polite">
            {pagePlayers.map((player, index) => <PlayerCard key={player.name} player={player} index={page * pageSize + index} />)}
            {!pagePlayers.length && <div className="pwr-empty"><Target size={28} /><strong>No player found</strong><p>Try another name, nickname or nation.</p><button type="button" onClick={() => { setSearch(""); changeFilter("All players"); }}>Clear filters</button></div>}
          </div>
          <footer className="pwr-pagination">
            <span>SHOWING <b>{filtered.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, filtered.length)}</b> OF <b>{String(filtered.length).padStart(2, "0")}</b> PROFILES</span>
            <div><button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}><ArrowLeft size={16} /></button><span>{String(page + 1).padStart(2, "0")} <i>/</i> {String(pageCount).padStart(2, "0")}</span><button type="button" aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}><ArrowDown size={16} /></button></div>
          </footer>
        </section>
        <footer className="pwr-bottom"><span>TKDL <i>×</i> DARTS WORLD</span><p>The world remembers every throw.</p><a href="#world-records">WORLD RECORDS <ArrowRight size={13} /></a></footer>
      </div>
    </main>
  );
}
