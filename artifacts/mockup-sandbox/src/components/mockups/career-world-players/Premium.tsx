import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, BookOpen, ChevronDown, Crown, Search, Shield,
  Users, X,
} from "lucide-react";
import "./_group.css";
import "./Premium.css";

type Player = {
  id: string;
  name: string;
  nickname: string;
  country: string;
  ranking: number | null;
  status: "ACTIVE" | "RETIRED";
  kitId: string;
  kitName: string;
};

const players: Player[] = [
  { id: "p01", name: "Rook Calder", nickname: "The North Star", country: "Scotland", ranking: 1, status: "ACTIVE", kitId: "kit-50-01", kitName: "Redline" },
  { id: "p02", name: "Mara Vale", nickname: "The Iron Rose", country: "England", ranking: 2, status: "ACTIVE", kitId: "kit-50-02", kitName: "Circuit Break" },
  { id: "p03", name: "Jonah Mercer", nickname: "The Metronome", country: "Wales", ranking: 4, status: "ACTIVE", kitId: "kit-50-03", kitName: "Flightpath" },
  { id: "p04", name: "Elliot Shaw", nickname: "The Quiet Storm", country: "England", ranking: 7, status: "ACTIVE", kitId: "kit-50-04", kitName: "Bullseye" },
  { id: "p05", name: "Drew Lennox", nickname: "The Foundry", country: "Ireland", ranking: 12, status: "RETIRED", kitId: "kit-50-05", kitName: "Nightshift" },
  { id: "p06", name: "Celia North", nickname: "The Ace", country: "Scotland", ranking: 18, status: "ACTIVE", kitId: "kit-50-06", kitName: "Vault" },
  { id: "p07", name: "Tomas Varga", nickname: "The Switch", country: "Czechia", ranking: 23, status: "ACTIVE", kitId: "kit-50-07", kitName: "Prism" },
  { id: "p08", name: "Niall Byrne", nickname: "Copperhead", country: "Ireland", ranking: 31, status: "RETIRED", kitId: "kit-50-08", kitName: "Heritage" },
  { id: "p09", name: "Freya Holt", nickname: "The Long Count", country: "Norway", ranking: 38, status: "ACTIVE", kitId: "kit-50-09", kitName: "Counterpoint" },
  { id: "p10", name: "Luc Moreau", nickname: "L'Éclair", country: "France", ranking: 46, status: "ACTIVE", kitId: "kit-50-10", kitName: "Stormline" },
  { id: "p11", name: "Isaac Bell", nickname: "The Locksmith", country: "England", ranking: 63, status: "RETIRED", kitId: "kit-50-11", kitName: "Gilded Orbit" },
  { id: "p12", name: "Asha Quinn", nickname: "Redline", country: "Wales", ranking: null, status: "ACTIVE", kitId: "kit-50-12", kitName: "Apex Cobalt" },
];

const pageSize = 6;

function PlayerCard({ player, index, onOpen }: { player: Player; index: number; onOpen: (player: Player) => void }) {
  return (
    <button className={`wp-card${player.status === "RETIRED" ? " is-retired" : ""}`} onClick={() => onOpen(player)} type="button" aria-label={`Open ${player.name}'s player profile`}>
      <span className="wp-card__index"><span>WORLD ORDER</span><b>{String(index + 1).padStart(2, "0")}</b></span>
      <span className="wp-card__portrait">
        <img src={`/__mockup/images/career-world-players/${player.kitId}.webp`} alt={`${player.kitName} shirt`} />
        <span className="wp-card__rank"><small>WORLD<br />RANK</small><b>{player.ranking ? String(player.ranking).padStart(2, "0") : "—"}</b></span>
      </span>
      <span className="wp-card__identity">
        <span className="wp-card__country">{player.country}</span>
        <strong>{player.name}</strong>
        <em>“{player.nickname}”</em>
      </span>
      <span className="wp-card__foot">
        <span className={`wp-status${player.status === "RETIRED" ? " is-retired" : ""}`}><i />{player.status === "ACTIVE" ? "Active" : "Retired"}</span>
        <span className="wp-open">OPEN RECORD <ArrowRight size={14} /></span>
      </span>
    </button>
  );
}

export function Premium() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "RETIRED">("ALL");
  const [page, setPage] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return players.filter((player) =>
      (status === "ALL" || player.status === status) &&
      (!term || `${player.name} ${player.nickname} ${player.country}`.toLowerCase().includes(term)),
    );
  }, [search, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const reset = () => { setSearch(""); setStatus("ALL"); setPage(0); };

  return (
    <main className="world-players-premium">
      <div className="wp-shell">
        <header className="wp-masthead">
          <a className="wp-brand" href="#darts-world" aria-label="TKDL Career, Darts World">
            <span className="wp-brand__mark">TK</span>
            <span><b>TKDL CAREER</b><small>DARTS WORLD · PLAYER ARCHIVE</small></span>
          </a>
          <nav aria-label="Breadcrumb"><span>CAREER</span><i>/</i><span>DARTS WORLD</span><i>/</i><b>PLAYERS</b></nav>
          <span className="wp-edition">WORLD TOUR <b>·</b> SEASON 04</span>
        </header>

        <section className="wp-hero" aria-labelledby="wp-title">
          <div className="wp-hero__copy">
            <span className="wp-overline"><BookOpen size={14} /> THE PUBLIC REGISTER <i>—</i> ILLUSTRATIVE PREVIEW</span>
            <h1 id="wp-title">Names in<br /><em>the world.</em></h1>
            <p>A carefully kept directory of the players who shape this fictional tour—from the current order to careers already complete.</p>
            <div className="wp-hero__seal"><Shield size={14} /><span>PLAYER FACTS ONLY</span><b>·</b><span>ILLUSTRATIVE FIXTURES</span></div>
          </div>
          <figure className="wp-hero__art">
            <img src="/__mockup/images/career-world-players-lineup-studio.png" alt="Illustrative lineup of fictional tour players" />
            <figcaption><span>THE WORLD ROSTER</span><i>CAREER ARCHIVE · SAMPLE VISUAL</i></figcaption>
          </figure>
          <aside className="wp-hero__count">
            <span><Users size={16} /></span><b>{String(filtered.length).padStart(2, "0")}</b><small>PLAYER<br />RECORDS</small>
            <i /><em>PUBLIC<br />REGISTER</em>
          </aside>
          <span className="wp-hero__folio">DW / 01</span>
        </section>

        <section className="wp-register" aria-label="World players directory">
          <div className="wp-section-head">
            <div><span className="wp-kicker">THE ORDER OF MERIT <i>·</i> 01</span><h2>Player directory</h2></div>
            <span className="wp-record-stamp"><BadgeCheck size={16} /><span>RECORD EDITION</span><b>SEASON 04</b></span>
          </div>
          <div className="wp-toolbar">
            <label className="wp-search"><Search size={17} /><input aria-label="Search by player, nickname or nation" maxLength={80} placeholder="Search player, nickname or nation" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />{search && <button aria-label="Clear search" onClick={() => { setSearch(""); setPage(0); }} type="button"><X size={14} /></button>}</label>
            <label className="wp-filter"><span>CAREER STATUS</span><span className="wp-select-wrap"><select aria-label="Career status" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(0); }}><option value="ALL">All players</option><option value="ACTIVE">Active</option><option value="RETIRED">Retired</option></select><ChevronDown size={15} /></span></label>
            <div className="wp-result-count"><b>{String(filtered.length).padStart(2, "0")}</b><span>RECORDS</span></div>
          </div>
          <div className="wp-roster" aria-live="polite">
            {shown.map((player, index) => <PlayerCard key={player.id} player={player} index={page * pageSize + index} onOpen={setSelectedPlayer} />)}
            {!shown.length && <div className="wp-empty"><span><Search size={22} /></span><strong>No matching record</strong><p>Try another player, nickname or nation.</p><button onClick={reset} type="button">Reset directory filters <ArrowRight size={14} /></button></div>}
          </div>
          <footer className="wp-pagination">
            <span>SHOWING <b>{filtered.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, filtered.length)}</b> OF <b>{String(filtered.length).padStart(2, "0")}</b> RECORDS</span>
            <div><button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}><ArrowLeft size={16} /></button><span>PAGE <b>{String(page + 1).padStart(2, "0")}</b><i>/</i>{String(pageCount).padStart(2, "0")}</span><button type="button" aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}><ArrowRight size={16} /></button></div>
          </footer>
        </section>

        <footer className="wp-footer"><span className="wp-footer__brand">TKDL <i>×</i> DARTS WORLD</span><p>Names, nations, nicknames and published rank. No record embellished.</p><span className="wp-footer__note"><Crown size={14} /> ILLUSTRATIVE FIXTURES</span></footer>
      </div>

      {selectedPlayer && <div className="wp-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPlayer(null); }}>
        <section className="wp-profile" role="dialog" aria-modal="true" aria-labelledby="wp-profile-title">
          <button className="wp-profile__close" type="button" aria-label="Close player record" onClick={() => setSelectedPlayer(null)}><X size={18} /></button>
          <div className="wp-profile__top"><span>PLAYER RECORD <i>·</i> ILLUSTRATIVE</span><span className={`wp-status${selectedPlayer.status === "RETIRED" ? " is-retired" : ""}`}><i />{selectedPlayer.status === "ACTIVE" ? "Active" : "Retired"}</span></div>
          <div className="wp-profile__body">
            <div className="wp-profile__shirt"><img src={`/__mockup/images/career-world-players/${selectedPlayer.kitId}.webp`} alt={`${selectedPlayer.kitName} shirt`} /><small>ILLUSTRATIVE KIT</small></div>
            <div className="wp-profile__details"><span className="wp-kicker">DARTS WORLD <i>·</i> PLAYER DIRECTORY</span><h2 id="wp-profile-title">{selectedPlayer.name}</h2><p className="wp-profile__nickname">“{selectedPlayer.nickname}”</p><div className="wp-profile__facts"><div><span>WORLD RANK</span><b>{selectedPlayer.ranking ? `#${String(selectedPlayer.ranking).padStart(2, "0")}` : "Unranked"}</b></div><div><span>NATION</span><b>{selectedPlayer.country}</b></div><div><span>CAREER STATUS</span><b>{selectedPlayer.status === "ACTIVE" ? "Active" : "Retired"}</b></div></div><p className="wp-profile__note">This preview contains directory facts only. No achievements, match statistics or commercial history are included.</p></div>
          </div>
          <div className="wp-profile__bottom"><span><Shield size={14} /> PUBLIC PLAYER FACTS</span><button type="button" onClick={() => setSelectedPlayer(null)}>Return to directory <ArrowRight size={14} /></button></div>
        </section>
      </div>}
    </main>
  );
}
