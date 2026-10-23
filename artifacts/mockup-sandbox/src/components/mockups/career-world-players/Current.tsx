import { useState } from "react";
import { Search } from "lucide-react";
import "./_group.css";

const players = [
  { name: "Rook Calder", nickname: "The North Star", country: "Scotland", rank: 1, status: "Active", shirt: "#9b1c3e" },
  { name: "Mara Vale", nickname: "The Iron Rose", country: "England", rank: 2, status: "Active", shirt: "#253d65" },
  { name: "Jonah Mercer", nickname: "The Metronome", country: "Wales", rank: 4, status: "Active", shirt: "#315646" },
  { name: "Elliot Shaw", nickname: "The Quiet Storm", country: "England", rank: 7, status: "Active", shirt: "#5e3b68" },
  { name: "Drew Lennox", nickname: "The Foundry", country: "Ireland", rank: 12, status: "Retired", shirt: "#55442d" },
  { name: "Celia North", nickname: "The Ace", country: "Scotland", rank: 18, status: "Active", shirt: "#893f32" },
];

export function Current() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const shown = players.filter((player) =>
    (status === "All" || player.status === status) &&
    `${player.name} ${player.nickname} ${player.country}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <main className="players-current">
      <header className="pc-head">
        <div><span>TKDL CAREER <i>•</i> DARTS WORLD</span><strong>Players</strong><p>Every player in your saved Career world.</p></div>
        <aside><b>4</b><small>ACTIVE RANKED</small></aside>
      </header>
      <div className="pc-filters">
        <label className="pc-search"><Search size={15}/><input aria-label="Search players" placeholder="Search players" value={search} onChange={(event) => setSearch(event.target.value)}/></label>
        <label className="pc-status">Career status <select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Active</option><option>Retired</option></select></label>
        <span>{shown.length} players shown</span>
      </div>
      <section className="pc-grid" aria-label="Players">
        {shown.map((player) => (
          <a className={`pc-card${player.status === "Retired" ? " is-retired" : ""}`} href="#player" key={player.name}>
            <div className="pc-kit" style={{ "--kit": player.shirt } as React.CSSProperties}>
              <span className="pc-world">WORLD <b>#{player.rank}</b></span>
              <svg viewBox="0 0 160 136" role="img" aria-label={`${player.name}'s shirt`}>
                <path d="M48 12 24 25 8 52l21 13 10-13v70h82V52l10 13 21-13-16-27-24-13c-4 15-15 22-32 22S52 27 48 12Z" fill="var(--kit)" stroke="#dbe4ee" strokeOpacity=".42" strokeWidth="2"/>
                <path d="M57 16c5 12 13 17 23 17s18-5 23-17" fill="none" stroke="#e9d28a" strokeWidth="2"/>
                <text x="80" y="77" textAnchor="middle" fill="#f4e8c9" fontSize="11" fontWeight="700" letterSpacing="2">TKDL</text>
              </svg>
            </div>
            <div className="pc-copy"><strong>{player.name}</strong><em>“{player.nickname}”</em><span>{player.country}<i className={player.status === "Retired" ? "retired" : ""}>{player.status}</i></span></div>
          </a>
        ))}
        {!shown.length && <p className="pc-empty">No matching players. Retired careers remain discoverable with the All / Retired filter.</p>}
      </section>
      <footer className="pc-foot"><span>Showing 1–{shown.length} of 50 players</span><button disabled>Previous</button><button>Next</button></footer>
    </main>
  );
}
