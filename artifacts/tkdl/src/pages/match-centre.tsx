import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { format, isToday, isYesterday } from "date-fns";
import { Search, Swords, Target, Users, Building2, Trophy, Zap, CalendarDays, ChevronRight } from "lucide-react";
import "./match-centre.css";

type Mode = "singles" | "team" | "doubles" | "shift_wars";
type Match = {
  key: string; id: number; mode: Mode; playedAt: string;
  winnerName: string; loserName: string;
  winnerPlayerIds: number[]; loserPlayerIds: number[];
  stake: number; eloChange: number | null; gameType: string;
  seasonName: string | null; notes: string | null; isCombined: boolean;
};
type Feed = { items: Match[]; counts: Record<string, number> };

const MODE_INFO: Record<Mode, { label: string; short: string; color: string; icon: typeof Target }> = {
  singles: { label: "Singles", short: "SGL", color: "#ff005c", icon: Target },
  team: { label: "Uneven Teams", short: "TEAM", color: "#a855f7", icon: Users },
  doubles: { label: "Doubles", short: "DBL", color: "#0066ff", icon: Users },
  shift_wars: { label: "Shift Wars", short: "SHIFT", color: "#22c55e", icon: Building2 },
};

const PREVIEW_MATCHES: Match[] = [
  { key:"p1",id:1,mode:"singles",playedAt:new Date().toISOString(),winnerName:"Richard",loserName:"Graeme",winnerPlayerIds:[18],loserPlayerIds:[16],stake:15,eloChange:22,gameType:"501",seasonName:"September 2026",notes:null,isCombined:false },
  { key:"p2",id:2,mode:"team",playedAt:new Date(Date.now()-36e5).toISOString(),winnerName:"Jamie & Kyle",loserName:"Graeme",winnerPlayerIds:[14,15],loserPlayerIds:[16],stake:20,eloChange:18,gameType:"team_501",seasonName:"September 2026",notes:null,isCombined:true },
  { key:"p3",id:3,mode:"doubles",playedAt:new Date(Date.now()-9e7).toISOString(),winnerName:"Perfect Pair",loserName:"Old Rivalry",winnerPlayerIds:[],loserPlayerIds:[],stake:20,eloChange:17,gameType:"doubles_501",seasonName:"September Doubles",notes:null,isCombined:false },
  { key:"p4",id:4,mode:"shift_wars",playedAt:new Date(Date.now()-10e7).toISOString(),winnerName:"Back Shift",loserName:"Night Crew + Day Shift",winnerPlayerIds:[],loserPlayerIds:[],stake:30,eloChange:null,gameType:"shift_wars_501",seasonName:null,notes:null,isCombined:true },
  { key:"p5",id:5,mode:"singles",playedAt:new Date(Date.now()-18e7).toISOString(),winnerName:"Cavan",loserName:"Sean",winnerPlayerIds:[21],loserPlayerIds:[17],stake:15,eloChange:19,gameType:"Cricket",seasonName:"September 2026",notes:null,isCombined:false },
  { key:"p6",id:6,mode:"singles",playedAt:new Date(Date.now()-26e7).toISOString(),winnerName:"Sean",loserName:"Ryan",winnerPlayerIds:[17],loserPlayerIds:[20],stake:10,eloChange:14,gameType:"301",seasonName:"September 2026",notes:null,isCombined:false },
];

function displayGame(gameType: string) {
  return gameType.replace(/^(team_|doubles_|shift_wars_)/, "").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}

function dayLabel(value: string) {
  const date = new Date(value);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, d MMMM yyyy");
}

function PlayerName({ name, ids, winner = false }: { name: string; ids: number[]; winner?: boolean }) {
  if (ids.length === 1 && !name.includes(" & ")) {
    return <Link href={`/players/${ids[0]}`} className={winner ? "mc-winner-name" : "mc-loser-name"}>{name}</Link>;
  }
  return <span className={winner ? "mc-winner-name" : "mc-loser-name"}>{name}</span>;
}

function ResultCard({ match, featured = false }: { match: Match; featured?: boolean }) {
  const info = MODE_INFO[match.mode];
  const Icon = info.icon;
  return (
    <article className={`mc-result ${featured ? "mc-featured" : ""}`} style={{ "--mode": info.color } as React.CSSProperties}>
      <div className="mc-result-mode"><Icon size={13}/><span>{info.short}</span>{match.isCombined && <b>HANDICAP</b>}</div>
      <div className="mc-result-main">
        <div className="mc-side mc-side-winner">
          <small>WINNER</small><PlayerName name={match.winnerName} ids={match.winnerPlayerIds} winner />
        </div>
        <div className="mc-versus"><b>DEF.</b><span>{match.stake}<small>PTS</small></span></div>
        <div className="mc-side mc-side-loser">
          <small>RUNNER-UP</small><PlayerName name={match.loserName} ids={match.loserPlayerIds} />
        </div>
      </div>
      <div className="mc-result-meta">
        <span>{displayGame(match.gameType)}</span>
        {match.eloChange != null && <span>+{match.eloChange} Elo</span>}
        {match.seasonName && <span>{match.seasonName}</span>}
        <time>{format(new Date(match.playedAt), "HH:mm")}</time>
        {!match.key.startsWith("p") && <Link className="mc-view-link" href={`/match-centre/${match.key}`}>MATCH REPORT <ChevronRight size={11}/></Link>}
      </div>
    </article>
  );
}

export default function MatchCentre() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"all" | Mode>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
    if (preview) {
      setFeed({ items: PREVIEW_MATCHES, counts: { all: 6, singles: 3, team: 1, doubles: 1, shift_wars: 1 } });
      setLoading(false);
      return;
    }
    fetch("/api/match-centre")
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Unable to load results")))
      .then(setFeed).catch(() => setFeed({ items: [], counts: {} })).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (feed?.items ?? []).filter(m =>
      (mode === "all" || m.mode === mode) &&
      (!needle || `${m.winnerName} ${m.loserName} ${m.seasonName ?? ""} ${m.gameType}`.toLowerCase().includes(needle))
    );
  }, [feed, mode, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const match of filtered) {
      const key = format(new Date(match.playedAt), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), match]);
    }
    return [...map.entries()];
  }, [filtered]);

  const latest = feed?.items[0];
  const totalPoints = (feed?.items ?? []).reduce((sum, m) => sum + m.stake, 0);
  const activeModes = new Set((feed?.items ?? []).map(m => m.mode)).size;

  return (
    <div className="mc-shell">
      <header className="mc-hero">
        <div className="mc-hero-copy">
          <span className="mc-kicker"><i/> TKDL ARCHIVE</span>
          <h1>MATCH <em>CENTRE</em></h1>
          <p>Every result. Every format. One league record.</p>
        </div>
        <div className="mc-hero-stats">
          <div><strong>{feed?.items.length ?? "—"}</strong><span>RECORDED MATCHES</span></div>
          <div><strong>{totalPoints}</strong><span>POINTS WAGERED</span></div>
          <div><strong>{activeModes}</strong><span>COMPETITIONS</span></div>
        </div>
      </header>

      {latest && (
        <section className="mc-latest">
          <div className="mc-section-label"><Zap size={14}/> LATEST RESULT <span>Fresh from the oche</span></div>
          <ResultCard match={latest} featured />
        </section>
      )}

      <section className="mc-controls">
        <div className="mc-tabs">
          {(["all", "singles", "team", "doubles", "shift_wars"] as const).map(key => {
            const label = key === "all" ? "All Results" : MODE_INFO[key].label;
            return <button key={key} className={mode === key ? "active" : ""} onClick={() => setMode(key)}>
              {label}<span>{feed?.counts[key] ?? 0}</span>
            </button>;
          })}
        </div>
        <label className="mc-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search player, team or season…"/></label>
      </section>

      <div className="mc-content">
        <main className="mc-history">
          {loading && <div className="mc-empty">Loading the league archive…</div>}
          {!loading && groups.length === 0 && <div className="mc-empty"><Swords size={28}/><strong>No results found</strong><span>Try another player or competition.</span></div>}
          {groups.map(([date, matches]) => (
            <section className="mc-day" key={date}>
              <div className="mc-day-heading"><CalendarDays size={14}/><strong>{dayLabel(matches[0].playedAt)}</strong><span>{matches.length} {matches.length === 1 ? "match" : "matches"}</span></div>
              <div className="mc-day-results">{matches.map(match => <ResultCard key={match.key} match={match}/>)}</div>
            </section>
          ))}
        </main>

        <aside className="mc-aside">
          <div className="mc-aside-title"><Trophy size={15}/> RESULTS BREAKDOWN</div>
          {(["singles", "team", "doubles", "shift_wars"] as Mode[]).map(key => {
            const info = MODE_INFO[key]; const count = feed?.counts[key] ?? 0;
            return <button key={key} onClick={() => setMode(key)} style={{ "--mode": info.color } as React.CSSProperties}>
              <span><info.icon size={14}/>{info.label}</span><strong>{count}</strong><ChevronRight size={13}/>
            </button>;
          })}
          <div className="mc-aside-note"><Swords size={18}/><strong>The complete TKDL story</strong><p>Singles, doubles, department battles and uneven-team handicap games all live in the same timeline.</p></div>
        </aside>
      </div>
    </div>
  );
}
