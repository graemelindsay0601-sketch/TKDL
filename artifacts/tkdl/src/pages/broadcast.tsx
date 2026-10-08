import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Trophy, Target, Radio, Pause, Play, Maximize, ArrowLeft, Users, Zap, Crown, Activity, Medal, RotateCcw, FastForward, X, Sparkles } from "lucide-react";
import "./broadcast.css";

type Standing = { id: number; name: string; points: number; wins: number; losses: number; detail: string; out: boolean };
type Result = { matchId: number; winnerName: string; loserName: string; gameType: string; playedAt: string; stake: number };
type Summary = { currentSeasonName: string; currentSeasonMatches: number; totalPlayers: number; seasonsCompleted: number };
type League = { key: string; label: string; note: string; rows: Standing[] };
type FeedItem = { type: string; text: string; accent: string };
type Champion = { championName: string; name: string };
type LiveMatch = { sessionId: string; status: "prematch" | "live" | "finished"; winnerSide?: 0 | 1; winnerName?: string; format: string; game: string; sides: [string[], string[]]; score: null | { mode: "x01" | "cricket"; scores: [number, number]; turn: 0 | 1; detail?: [string, string]; currentPlayer?: string; lastVisit?: string; checkout?: string }; updatedAt: string; presentation?: { headline?:string; sideA?:{points?:number;elo?:number;form?:string[];kit?:string}; sideB?:{points?:number;elo?:number;form?:string[];kit?:string}; spotlight?:{level:"featured"|"major";kicker:string;reason:string}; h2h?:{aWins:number;bWins:number;total:number}|null } };
type DrawTeam = { id: number; name: string; players: string[] };
const time = (value: Date) => value.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
function matchDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function DoublesDrawShow({ teams, onClose, onFullscreen }: { teams: DrawTeam[]; onClose: () => void; onFullscreen: () => void }) {
  const sequence = teams.flatMap((team, teamIndex) => team.players.map((name, memberIndex) => ({ name, teamIndex, memberIndex })));
  const teamKey = teams.map(team => `${team.id}:${team.players.join("|")}`).join(";");
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => { setRevealed(0); setPlaying(true); }, 700);
    return () => window.clearTimeout(id);
  }, [teamKey]);

  useEffect(() => {
    if (!playing) return;
    if (revealed >= sequence.length) { setPlaying(false); return; }
    const id = window.setTimeout(() => setRevealed(value => value + 1), revealed === 0 ? 750 : 920);
    return () => window.clearTimeout(id);
  }, [playing, revealed, sequence.length]);

  const replay = () => { setRevealed(0); setPlaying(true); };
  const revealAll = () => { setRevealed(sequence.length); setPlaying(false); };
  const current = revealed > 0 ? sequence[revealed - 1] : null;
  const currentTeam = current ? teams[current.teamIndex] : null;
  const complete = sequence.length > 0 && revealed === sequence.length;
  let offset = 0;

  return <section className="ls-draw-show" aria-live="polite" aria-label="Official Doubles team draw">
    <div className="ls-draw-grid" aria-hidden="true" />
    <div className="ls-draw-header">
      <div><span><Sparkles size={15}/> TKDL LIVE</span><strong>OFFICIAL DOUBLES DRAW</strong></div>
      <div className="ls-draw-actions">
        <button onClick={replay} disabled={playing} aria-label="Replay draw"><RotateCcw size={17}/><span>REPLAY</span></button>
        <button onClick={revealAll} disabled={complete} aria-label="Reveal all teams"><FastForward size={17}/><span>REVEAL ALL</span></button>
        <button onClick={onFullscreen} aria-label="Toggle fullscreen"><Maximize size={17}/></button>
        <button onClick={onClose} aria-label="Close draw show"><X size={18}/></button>
      </div>
    </div>
    <div className="ls-draw-progress"><i style={{ width: `${sequence.length ? (revealed / sequence.length) * 100 : 0}%` }}/></div>
    <div className="ls-draw-stage">
      <div className="ls-draw-board" aria-hidden="true"><i/><i/><i/><i/></div>
      <div className="ls-draw-orbit" aria-hidden="true" />
      <div className="ls-draw-reveal" key={`${revealed}-${playing}`}>
        <span>{complete ? "THE DRAW IS COMPLETE" : current ? `TEAM ${current.teamIndex + 1} · ${current.memberIndex === 0 ? "FIRST PLAYER" : "PARTNER"}` : playing ? "SHUFFLING THE FIELD" : "READY TO DRAW"}</span>
        <h2>{complete ? `${teams.length} TEAMS LOCKED` : current?.name ?? `${sequence.length} PLAYERS`}</h2>
        <p>{complete ? "The official Doubles Event line-up is confirmed" : currentTeam ? `${currentTeam.name} is taking shape` : "Every name. Every partnership. Drawn live."}</p>
      </div>
      <div className="ls-draw-remaining">
        {sequence.map((player, index) => <span key={`${player.teamIndex}-${player.memberIndex}`} className={index < revealed ? "drawn" : ""}>{player.name}</span>)}
      </div>
    </div>
    <div className="ls-draw-team-ribbon">
      {teams.map((team, teamIndex) => {
        const start = offset;
        const end = start + team.players.length;
        offset = end;
        const locked = revealed >= end;
        const active = revealed > start && revealed < end;
        return <article key={team.id} className={`${locked ? "locked" : ""} ${active ? "active" : ""}`}>
          <div className="ls-draw-team-number">{String(teamIndex + 1).padStart(2, "0")}</div>
          <div className="ls-draw-avatars">{team.players.map((name, memberIndex) => <i key={name} className={revealed > start + memberIndex ? "shown" : ""}>{revealed > start + memberIndex ? name.slice(0, 1).toUpperCase() : "?"}</i>)}</div>
          <strong>{team.players.map((name, memberIndex) => revealed > start + memberIndex ? name : "Waiting…").join(" + ")}</strong>
          <small>{locked ? "TEAM LOCKED" : active ? "PARTNER DRAW IN PROGRESS" : `${team.players.length} PLAYERS TO DRAW`}</small>
        </article>;
      })}
    </div>
    <div className="ls-draw-footer"><span><i/> LIVE DRAW</span><strong>{revealed} / {sequence.length} PLAYERS REVEALED</strong><small>{complete ? "GAME ON" : "TESCO KILBIRNIE DARTS LEAGUE"}</small></div>
  </section>;
}

export default function Broadcast() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [issue, setIssue] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [frame, setFrame] = useState(0);
  const [transition, setTransition] = useState(0);
  const [spotlightFrame, setSpotlightFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(new Date());
  const [fullscreenError, setFullscreenError] = useState(false);
  const [liveMatch, setLiveMatch] = useState<LiveMatch | null>(null);
  const [drawShowOpen, setDrawShowOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("doublesDraw") === "1");

  useEffect(() => {
    let disposed = false, busy = false;
    const controller = new AbortController();
    async function get(url: string) {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }
    async function refresh() {
      if (busy) return;
      busy = true;
      try {
        const [singles, recent, stats, settings] = await Promise.all([
          get("/api/leaderboard"), get("/api/stats/recent-activity"), get("/api/stats/summary"), get("/api/settings"),
        ]);
        if (!Array.isArray(singles) || !Array.isArray(recent)) throw new Error("Invalid display data");
        const next: League[] = [{ key: "singles", label: "Singles", note: stats.currentSeasonName ?? "Current season", rows: singles.map((p: any) => ({ id: p.playerId, name: p.playerName, points: p.points, wins: p.wins, losses: p.losses, detail: `${p.tier} · ${p.elo} ELO`, out: p.status === "ELIMINATED" })) }];
        let partial = false;
        const extra = await Promise.allSettled([
          settings.doubles_event_enabled ? (async () => {
            const season = await get("/api/seasons/current?leagueType=doubles");
            if (!season?.id) return null;
            const rows = await get(`/api/seasons/${season.id}/doubles/teams`);
            return { key: "doubles", label: "Doubles", note: season.name ?? "Doubles event", rows: rows.map((p: any) => ({ id: p.id, name: p.teamName, points: p.points, wins: p.wins, losses: p.losses, detail: p.players.map((v: any) => v.name).join(" / "), out: p.isEliminated })) };
          })() : Promise.resolve(null),
          settings.shift_wars_enabled ? get("/api/shift-wars/teams").then(rows => ({ key: "shifts", label: "Shift Wars", note: "Department standings", rows: rows.map((p: any) => ({ id: p.id, name: p.name, points: p.points, wins: p.wins, losses: p.losses, detail: `${p.players.length} players`, out: false })) })) : Promise.resolve(null),
        ]);
        for (const item of extra) {
          if (item.status === "fulfilled" && item.value) next.push(item.value);
          if (item.status === "rejected") partial = true;
        }
        const stories = await Promise.allSettled([get("/api/stats/live-feed"), get("/api/stats/hall-of-fame")]);
        if (!disposed && stories[0].status === "fulfilled" && Array.isArray(stories[0].value)) setFeed(stories[0].value);
        if (!disposed && stories[1].status === "fulfilled" && Array.isArray(stories[1].value?.champions)) setChampions(stories[1].value.champions);
        if (!disposed) { setLeagues(next); setResults(recent); setSummary(stats); setUpdated(new Date()); setIssue(partial); }
      } catch { if (!disposed) setIssue(true); }
      finally { busy = false; if (!disposed) setLoaded(true); }
    }
    const poll = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    poll();
    // League tables and completed results do not need live-score cadence.
    // One refresh per minute halves this screen's database work, while the
    // live-match poll below remains fast during an active game.
    const interval = setInterval(poll, 60_000);
    const online = poll;
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", online);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", online);
    };
  }, []);

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let disposed = false, busy = false;
    let timer: number | undefined;
    const schedule = (delay: number) => {
      if (!disposed) timer = window.setTimeout(() => void refresh(), delay);
    };
    const refresh = async () => {
      if (disposed || busy) return;
      if (document.visibilityState !== "visible") return;
      busy = true;
      let nextDelay = 4_000;
      try {
        const response = await fetch("/api/live-match", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const next = data.active ?? null;
        if (!disposed) setLiveMatch(next);
        // Idle screens can check less often. Once a match appears, retain the
        // original 1.5 second cadence for fluent live score updates.
        if (next?.status === "live") nextDelay = 1_500;
      } catch { /* keep the last successful display */ }
      finally { busy = false; schedule(nextDelay); }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (timer !== undefined) window.clearTimeout(timer);
      void refresh();
    };
    void refresh();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => { setTransition(n => n + 1); setFrame(n => n + 1); }, 18_000);
    return () => clearInterval(timer);
  }, [paused]);
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setSpotlightFrame(n => n + 1), 8_000);
    return () => clearInterval(timer);
  }, [paused]);
  const pages = leagues.flatMap(league => Array.from({ length: Math.max(1, Math.ceil(league.rows.length / 7)) }, (_, page) => ({ league, page })));
  const current = pages[frame % Math.max(1, pages.length)];
  const league = current?.league;
  const page = current?.page ?? 0;
  const leader = league?.rows.find(p => !p.out);
  const runnerUp = league?.rows.filter(p => !p.out)[1];
  const latest = results[0];
  const selectLeague = (key: string) => { const index = pages.findIndex(p => p.league.key === key); if (index >= 0) { setTransition(n => n + 1); setFrame(index); } };
  const singles = leagues.find(l => l.key === "singles");
  const doubles = leagues.find(l => l.key === "doubles");
  const drawTeams: DrawTeam[] = (doubles?.rows ?? []).map(team => ({ id: team.id, name: team.name, players: team.detail.split(" / ").map(name => name.trim()).filter(Boolean) }));
  const activeSingles = singles?.rows.filter(p => !p.out) ?? [];
  const unbeaten = activeSingles.find(p => p.wins > 0 && p.losses === 0);
  const gap = activeSingles.length > 1 ? activeSingles[0].points - activeSingles[1].points : null;
  const appStory = feed.find(item => item.type !== "match");
  const spotlights = [
    champions[0] ? { tone: "gold", kicker: "FROM THE ARCHIVE", icon: Crown, headline: champions[0].championName, body: `Champion of ${champions[0].name}. A name already written into TKDL history.` } : null,
    appStory ? { tone: appStory.accent === "gold" ? "gold" : appStory.accent === "red" ? "pink" : "blue", kicker: "AROUND THE APP", icon: Medal, headline: appStory.type === "tour_trophy" ? "TOUR GLORY" : "ACHIEVEMENT UNLOCKED", body: appStory.text } : null,
    gap !== null ? { tone: "pink", kicker: "TITLE RACE", icon: Trophy, headline: gap === 0 ? "LEVEL AT THE TOP" : `${gap} POINT${gap === 1 ? "" : "S"} IN IT`, body: gap === 0 ? `${activeSingles[0].name} and ${activeSingles[1].name} cannot be separated.` : `${activeSingles[0].name} leads ${activeSingles[1].name} in the race for the title.` } : null,
    unbeaten ? { tone: "gold", kicker: "UNBEATEN", icon: Crown, headline: unbeaten.name, body: `${unbeaten.wins} wins and no losses. The player everyone is chasing.` } : null,
    doubles?.rows[0] ? { tone: "blue", kicker: "DOUBLES LEADERS", icon: Users, headline: doubles.rows[0].name, body: `${doubles.rows[0].points} points from ${doubles.rows[0].wins} wins.` } : null,
    { tone: "blue", kicker: "MORE THAN THE SCORE", icon: Zap, headline: "YOUR LEAGUE. YOUR NEXT MOVE.", body: "Play, practise, follow rivalries and track every achievement in TKDL." },
  ].filter(Boolean) as Array<{ tone: string; kicker: string; icon: typeof Trophy; headline: string; body: string }>;
  const spotlight = spotlights[spotlightFrame % Math.max(1, spotlights.length)];
  const SpotlightIcon = spotlight?.icon ?? Zap;
  const fresh = updated && now.getTime() - updated.getTime() < 125_000 && !issue;
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFullscreenError(false);
    } catch { setFullscreenError(true); }
  }
  function closeDrawShow() {
    setDrawShowOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("doublesDraw");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }
  return <main className="league-screen">
    <header className="ls-header">
      <div className="ls-brand"><span className="ls-mark"><Target size={28} /></span><div><strong>TKDL<span> / MATCHDAY</span></strong><small>TESCO KILBIRNIE DARTS LEAGUE</small></div></div>
      <div className="ls-header-right"><span className={`ls-status ${liveMatch ? "ls-status-live" : fresh ? "" : "ls-status-wait"}`}><i />{liveMatch?.status === "prematch" ? "PRE-MATCH" : liveMatch ? "MATCH LIVE" : !loaded ? "CONNECTING" : fresh ? "AUTO-UPDATING" : "UPDATE DELAYED"}</span><time>{time(now)}</time><div className="ls-controls"><button onClick={() => setPaused(v => !v)} aria-label={paused ? "Resume rotation" : "Pause rotation"}>{paused ? <Play size={17}/> : <Pause size={17}/>}</button><button onClick={fullscreen} aria-label="Toggle fullscreen"><Maximize size={17}/></button><Link href="/" aria-label="Exit broadcast"><ArrowLeft size={17}/></Link></div></div>
    </header>
    {drawShowOpen && loaded && <DoublesDrawShow teams={drawTeams} onClose={closeDrawShow} onFullscreen={() => void fullscreen()} />}
    {liveMatch && <section className="ls-live-match" aria-live="polite">
      <div className="ls-live-backdrop" aria-hidden="true">{liveMatch.status === "prematch" ? "NEXT" : "LIVE"}</div>
      <div className="ls-live-heading"><span><Radio size={16}/> {liveMatch.status === "prematch" ? (liveMatch.presentation?.headline??"NEXT ON THE OCHE") : "LIVE FROM THE OCHE"}</span><strong>{liveMatch.format}</strong><i>{liveMatch.game}</i></div>
      {liveMatch.status === "prematch" ? <div className="ls-prematch-board">
        {([0,1] as const).map(side=>{const details=side===0?liveMatch.presentation?.sideA:liveMatch.presentation?.sideB;return <article key={side}><small>SIDE {side===0?"A":"B"}</small><h2>{liveMatch.sides[side].join(" & ")}</h2><strong>{details?.points??"—"}<span> PTS</span></strong><p>{details?.kit??(details?.elo!=null?`${details.elo} ELO`:"READY FOR THE OCHE")}</p></article>})}
        <div className="ls-prematch-vs"><span>VS</span><Target size={36}/>{liveMatch.presentation?.h2h&&<small>H2H {liveMatch.presentation.h2h.aWins}–{liveMatch.presentation.h2h.bWins}</small>}</div>
      </div> : liveMatch.status === "finished" ? <div className="ls-live-winner">
        <div className="ls-live-trophy"><Crown size={52}/></div><small>MATCH WINNER</small><h2>{liveMatch.winnerName ?? (liveMatch.winnerSide !== undefined ? liveMatch.sides[liveMatch.winnerSide].join(" & ") : "WINNER")}</h2><p>{liveMatch.game} · {liveMatch.format}</p><div><span>RESULT COMPLETE</span><ArrowUpRight size={24}/></div>
      </div> : <div className="ls-live-board">
        {([0, 1] as const).map(side => <div key={side} className={`ls-live-side ${liveMatch.score?.turn === side ? "is-throwing" : ""}`}>
          <small>{liveMatch.score?.turn === side ? "NOW THROWING" : `SIDE ${side === 0 ? "A" : "B"}`}</small>
          <h2>{liveMatch.sides[side].join(" & ")}</h2>
          <div className="ls-live-score">{liveMatch.score ? liveMatch.score.scores[side] : "—"}</div>
          <p>{liveMatch.score?.currentPlayer && liveMatch.score.turn === side ? `${liveMatch.score.currentPlayer} at the oche` : liveMatch.score?.detail?.[side] ?? (liveMatch.score ? liveMatch.score.mode === "cricket" ? "Cricket points" : "Remaining" : "Bull-up / scorer loading")}</p>
        </div>)}
        <div className="ls-live-vs"><span>VS</span><Target size={34}/></div>
      </div>}
      <div className="ls-live-pulse"><i/><span>{liveMatch.status === "prematch" ? "Pre-match coverage · scorer standing by" : liveMatch.status === "finished" ? "Returning to league coverage shortly" : liveMatch.score?.checkout ? `Checkout route · ${liveMatch.score.checkout}` : liveMatch.score?.lastVisit ? `Last visit · ${liveMatch.score.lastVisit}` : "Scores update automatically from the live scorer"}</span></div>
    </section>}
    <div className="ls-masthead"><div className="ls-ghost-word" aria-hidden="true">TKDL</div><div><div className="ls-eyebrow"><span />THE LEAGUE. EVERY ANGLE.</div><h1>GAME ON<span>.</span></h1></div><div className="ls-season"><span>ON THE BOARD</span><strong>{summary?.currentSeasonName ?? "League overview"}</strong><div className="ls-season-stats"><b>{summary?.totalPlayers ?? "—"}<small>PLAYERS</small></b><b>{summary?.currentSeasonMatches ?? "—"}<small>MATCHES</small></b><b>{leagues.length || "—"}<small>FORMATS</small></b></div></div></div>
    {transition > 0 && league && <div className="ls-transition" key={transition} aria-hidden="true"><div><span>NOW SHOWING</span><strong>{league.label.toUpperCase()} STANDINGS</strong><small>{league.note}</small></div></div>}
    <div className="ls-grid">
      <section className="ls-standings ls-panel" aria-label="League standings">
        <div className="ls-panel-heading"><div className="ls-eyebrow">01 / THE STANDINGS</div><span>{String(page + 1).padStart(2,"0")} / {String(Math.max(1, Math.ceil((league?.rows.length ?? 0) / 7))).padStart(2,"0")}</span></div>
        <nav className="ls-tabs tkdl-tab-rail" aria-label="Competition">{leagues.map(l => <button key={l.key} type="button" className={`tkdl-tab-trigger ${league?.key === l.key ? "active" : ""}`} aria-pressed={league?.key === l.key} onClick={() => selectLeague(l.key)}>{l.label}</button>)}</nav>
        <div className="ls-table" key={`${league?.key}-${page}`}>
          <div className="ls-table-head"><span>POS</span><span>{league?.key === "singles" ? "PLAYER" : "TEAM"}</span><span>W</span><span>L</span><span>PTS</span></div>
          {!loaded && <div className="ls-empty">Connecting to the league…</div>}
          {loaded && !league && <div className="ls-empty">League data is unavailable. Retrying automatically.</div>}
          {league && !league.rows.length && <div className="ls-empty">No standings yet. The next chapter starts here.</div>}
          {league?.rows.slice(page * 7, page * 7 + 7).map((p, index) => { const rank = page * 7 + index + 1; return <div className={`ls-row ${rank <= 3 ? `top-${rank}` : ""} ${p.out ? "out" : ""}`} key={p.id}><span className="ls-position">{rank === 1 ? <Crown size={16}/> : String(rank).padStart(2,"0")}</span><div className="ls-player"><strong>{p.name}</strong><small>{p.out ? "Eliminated" : p.detail}</small></div><span className="ls-wins">{p.wins}</span><span className="ls-losses">{p.losses}</span><b>{p.points}</b></div> })}
        </div>
        <div className="ls-table-foot"><span>{league?.note ?? "Waiting for standings"}</span><span>{paused ? "Rotation paused" : "Next board every 18s"}</span></div>
      </section>
      <div className="ls-feature-column">
        <section className="ls-result ls-panel">
          <div className="ls-panel-heading"><span className="ls-eyebrow"><Radio size={14}/>LATEST RESULT</span><span>{latest ? matchDate(latest.playedAt) : "MATCH CENTRE"}</span></div>
          {latest ? <><div className="ls-result-stage"><div className="ls-result-label">{latest.gameType || "League match"}</div><div className="ls-winner-kicker"><Crown size={15}/> MATCH WINNER</div><h2>{latest.winnerName}</h2><div className="ls-victory"><span>TAKES THE WIN</span><ArrowUpRight size={27}/></div><div className="ls-versus"><span>DEFEATED</span><strong>{latest.loserName}</strong></div></div><div className="ls-result-foot"><span><Activity size={13}/> RESULT RECORDED</span><strong>{latest.stake} <small>PT WAGER</small></strong></div></> : <div className="ls-empty">{loaded ? "The next result belongs here." : "Loading the latest result…"}</div>}
          <div className="ls-target" aria-hidden="true"><i/><i/><i/></div>
        </section>
        <section className="ls-leader ls-panel"><div><div className="ls-eyebrow"><Trophy size={14}/>{league?.label ?? "LEAGUE"} LEADER</div><h3>{leader?.name ?? "A title to play for"}</h3><p>{leader && runnerUp ? leader.points === runnerUp.points ? `Level on points with ${runnerUp.name}` : `${leader.points - runnerUp.points} points ahead of ${runnerUp.name}` : league?.note ?? "Waiting for the first standings"}</p></div><div className="ls-leader-points">{leader?.points ?? "—"}<span>POINTS</span></div></section>
      </div>
      <aside className="ls-side-column">
        <section className="ls-panel ls-results"><div className="ls-panel-heading"><div className="ls-eyebrow">02 / RECENT ACTION</div></div>{results.slice(1, 4).map((r, i) => <div className="ls-recent" key={r.matchId}><div><span>{String(i+1).padStart(2,"0")}</span><small>{matchDate(r.playedAt)}</small></div><strong>{r.winnerName}</strong><p>beat {r.loserName}</p><small>{r.gameType || "League match"} · {r.stake}pt wager</small></div>)}{loaded && results.length < 2 && <div className="ls-empty">More results will appear as matches are recorded.</div>}</section>
        <section className={`ls-app-card tone-${spotlight?.tone ?? "blue"}`}><div className="ls-spotlight" key={spotlightFrame}><div className="ls-eyebrow"><SpotlightIcon size={14}/> {spotlight?.kicker ?? "LEAGUE SPOTLIGHT"}</div><h3>{spotlight?.headline ?? "YOUR LEAGUE"}</h3><p>{spotlight?.body ?? "The latest story from around TKDL."}</p></div><div className="ls-spotlight-dots">{spotlights.map((_,i) => <i key={i} className={i === spotlightFrame % spotlights.length ? "active" : ""}/>)}</div></section>
      </aside>
    </div>
    <footer className="ls-footer"><strong><span/>LIVE LEAGUE FEED</strong><div className="ls-footer-mask"><div className="ls-footer-track">{[...results.slice(0,4), ...results.slice(0,4)].map((r,i) => <span key={`${r.matchId}-${i}`}><b>{r.winnerName}</b> beat {r.loserName}<i>◆</i></span>)}</div></div><small>{fullscreenError ? "Fullscreen unavailable" : updated ? `${issue ? "PARTIAL · " : ""}CHECKED ${time(updated)}` : "CONNECTING"}</small></footer>
    <div className={`ls-progress ${paused ? "paused" : ""}`} key={`${frame}-${paused}`} aria-hidden="true"/>
  </main>;
}
