import { useEffect, useState } from "react";
import { Swords, Lock, Trophy, Skull, Clock, Users, Shield, Ghost, LockKeyhole, Zap, Sparkles, CheckCircle2, Heart, Gauge } from "lucide-react";
import { useCurrentPlayer } from "@/context/auth";
import { BOSSES, type Boss } from "@/lib/boss-battles-data";
import { BOT_LEVELS } from "@/lib/bot-engine";
import { BossBattleScorer } from "@/components/BossBattleScorer";
import type { GameResult } from "@/components/game-scorer";
import { useCosmeticsCatalog, glowRowStyle } from "@/lib/cosmetics";
import { AchievementRewardModal, type AchievementRewardData } from "@/components/AchievementRewardModal";
import "./boss-battle.css";

type Screen =
  | { kind: "ladder" }
  | { kind: "entrance"; boss: Boss; ascension?: number }
  | { kind: "fight"; boss: Boss; rush?: boolean; ascension?: number }
  | { kind: "result"; boss: Boss; won: boolean; elapsedSeconds?: number; cleanSweep: boolean; ascension?: number }
  | { kind: "rush-break"; boss: Boss; nextBoss: Boss; lives: number; wins: number }
  | { kind: "rush-result"; cleared: boolean; wins: number; elapsedSeconds: number; lives: number };

type BossStats = { attempts: number; wins: number; bestSeconds: number | null; cleanSweep: boolean; highestAscension: number };

type RosterPlayer = { id: number; name: string; status: string; isActive: boolean };

type LeaderboardData = {
  totalBosses: number;
  players: { playerId: number; playerName: string; bossesDefeated: number; fullClear: boolean; lastDefeatAt: string }[];
  fastestPerBoss: Record<string, { playerName: string; seconds: number }>;
};
type ArcadeRun = { id:number; mode:string; bossId:string|null; outcome:string; elapsedSeconds:number|null; milestoneLabel:string|null; playedAt:string };

/** mm:ss for a fight duration — best times are always well under an hour. */
function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Each boss gets its own emblem — purely cosmetic, picked to match its
// gimmick (Wall Block → Shield, Jinxed → Ghost, Cricket Prison → a cell
// lock, Lockdown's single-number trap → a keyed lock, Annihilator → Zap,
// the secret final boss → Skull). The *color* each boss uses isn't a new
// palette — it's lifted straight from BOT_LEVELS (lib/bot-engine.ts) via
// boss.botLevel, so the ladder's color progression already matches the
// difficulty curve used everywhere else bots appear in the app.
const BOSS_ICON: Record<string, typeof Shield> = {
  "rookie-wall": Shield,
  "old-jinx": Ghost,
  "the-warden": Lock,
  "lockdown": LockKeyhole,
  "the-annihilator": Zap,
  "the-reckoning": Skull,
};
const tierColor = (boss: Boss) => BOT_LEVELS[boss.botLevel]?.color ?? "#ff005c";
const tierVar = (boss: Boss) => ({ "--tier": tierColor(boss) }) as React.CSSProperties;

function masteryCount(boss: Boss, defeated: Set<string>, stats?: BossStats): number {
  return Number(defeated.has(boss.id))
    + Number(stats?.cleanSweep === true)
    + Number(stats?.bestSeconds !== null && stats?.bestSeconds !== undefined && stats.bestSeconds <= boss.masterySeconds);
}

export default function BossBattlePage() {
  // Playing Boss Battle has never needed an account — pick your name from
  // the roster and go, same as Master-501/Practice/Tour. useCurrentPlayer()
  // is only consulted to default the picker to your own name when you
  // happen to be logged in; logging in is for claiming/managing an account
  // (settings, notification prefs), never a requirement to play.
  const currentPlayer = useCurrentPlayer();
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [defeated, setDefeated] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Record<string, BossStats>>({});
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>({ kind: "ladder" });
  const [fightStartedAt, setFightStartedAt] = useState<number | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [history, setHistory] = useState<ArcadeRun[]>([]);
  const [saveState, setSaveState] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [rewardQueue, setRewardQueue] = useState<AchievementRewardData[]>([]);
  const [rush, setRush] = useState<{ index: number; lives: number; wins: number; startedAt: number } | null>(null);

  const playerName = players.find(p => p.id === playerId)?.name ?? "";

  // GLOW cosmetic for "your" row in the ladder — this page's own leaderboard
  // endpoint doesn't join equipped cosmetics per row (unlike the main
  // leaderboard), so rather than a backend change this fetches just the
  // currently-selected player's own GLOW, the same one row this ladder
  // already highlights via `p.playerId === playerId`.
  const cosmeticsCatalog = useCosmeticsCatalog();
  const [myGlowId, setMyGlowId] = useState<string | null>(null);
  useEffect(() => {
    if (!playerId) { setMyGlowId(null); return; }
    fetch(`/api/players/${playerId}/cosmetics`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => setMyGlowId(data?.equippedGlowId ?? null))
      .catch(() => {});
  }, [playerId]);
  const myGlowCosmetic = cosmeticsCatalog.find(c => c.id === myGlowId);
  const myGlow = glowRowStyle(myGlowCosmetic);

  useEffect(() => {
    fetch("/api/players")
      .then(r => r.json())
      .then((d: RosterPlayer[]) => {
        const active = d.filter(p => p.isActive !== false);
        setPlayers(active);
        setPlayerId(prev => prev ?? (currentPlayer ? active.find(p => p.id === currentPlayer.playerId)?.id : undefined) ?? active[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  const loadProgress = () => {
    if (!playerId) { setLoading(false); return; }
    fetch(`/api/boss-battles/progress/${playerId}`)
      .then(r => r.ok ? r.json() : { defeated: [], stats: {} })
      .then((d: { defeated: string[]; stats?: Record<string, BossStats> }) => {
        setDefeated(new Set(d.defeated));
        setStats(d.stats ?? {});
      })
      .catch(() => { setDefeated(new Set()); setStats({}); })
      .finally(() => setLoading(false));
  };

  useEffect(loadProgress, [playerId]);
  const loadHistory = () => {
    if (!playerId) { setHistory([]); return; }
    fetch(`/api/arcade/history/${playerId}?limit=8`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: ArcadeRun[]) => setHistory(rows.filter(row => row.mode === "boss_battle" || row.mode === "boss_rush")))
      .catch(() => setHistory([]));
  };
  useEffect(loadHistory, [playerId]);

  const toggleLeaderboard = () => {
    setShowLeaderboard(v => !v);
    if (!leaderboard && !leaderboardLoading) {
      setLeaderboardLoading(true);
      fetch("/api/boss-battles/leaderboard")
        .then(r => r.ok ? r.json() : null)
        .then(setLeaderboard)
        .catch(() => setLeaderboard(null))
        .finally(() => setLeaderboardLoading(false));
    }
  };

  const isUnlocked = (boss: Boss) => {
    if (boss.order <= 1) return true;
    const prev = BOSSES.find(b => b.order === boss.order - 1);
    return prev ? defeated.has(prev.id) : true;
  };

  const startFight = (boss: Boss, ascension = 0) => {
    setSaveState("idle");
    setFightStartedAt(Date.now());
    setScreen({ kind: "fight", boss, ascension });
  };

  const startRush = () => {
    const firstBoss = sortedBosses[0];
    if (!firstBoss || defeatedCount < sortedBosses.length) return;
    const nextRush = { index: 0, lives: 2, wins: 0, startedAt: Date.now() };
    setRush(nextRush);
    setSaveState("idle");
    setFightStartedAt(Date.now());
    setScreen({ kind: "fight", boss: firstBoss, rush: true });
  };

  const saveRush = async (cleared: boolean, wins: number, elapsedSeconds: number) => {
    if (!playerId) return;
    try {
      await fetch("/api/boss-battles/rush", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, cleared, wins, elapsedSeconds }),
      });
      loadHistory();
    } catch { /* the individual boss results are still safely recorded */ }
  };

  const handleMatchComplete = async (boss: Boss, result: GameResult, ascension = 0) => {
    const won = result.winnerIdx === 0;
    const elapsedSeconds = fightStartedAt ? Math.round((Date.now() - fightStartedAt) / 1000) : undefined;
    const cleanSweep = won && /^2[–-]0 legs$/i.test(result.detail ?? "");
    if (playerId) {
      setSaveState("saving");
      try {
        const response = await fetch("/api/boss-battles/attempt", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, bossId: boss.id, won, elapsedSeconds, cleanSweep, ascension }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error ?? "Result could not be saved");
        setSaveState("saved");
        if (Array.isArray(data.achievements) && data.achievements.length) setRewardQueue(data.achievements);
        // Refetch rather than patch locally — attempts/wins/best time are
        // server-computed (upserts, min() on best time), so re-reading is
        // the only way to stay exactly in sync with what was actually saved.
        loadProgress();
        loadHistory();
      } catch { setSaveState("error"); }
    }
    setFightStartedAt(null);
    if (rush) {
      const nextLives = won ? rush.lives : rush.lives - 1;
      const nextWins = rush.wins + (won ? 1 : 0);
      const nextIndex = won ? rush.index + 1 : rush.index;
      const totalElapsed = Math.max(1, Math.round((Date.now() - rush.startedAt) / 1000));
      if (nextIndex >= sortedBosses.length || nextLives <= 0) {
        const cleared = nextIndex >= sortedBosses.length;
        void saveRush(cleared, nextWins, totalElapsed);
        setRush(null);
        setScreen({ kind: "rush-result", cleared, wins: nextWins, elapsedSeconds: totalElapsed, lives: Math.max(0, nextLives) });
      } else {
        const nextBoss = sortedBosses[nextIndex];
        setRush({ ...rush, index: nextIndex, lives: nextLives, wins: nextWins });
        setScreen({ kind: "rush-break", boss, nextBoss, lives: nextLives, wins: nextWins });
      }
      return;
    }
    setScreen({ kind: "result", boss, won, elapsedSeconds, cleanSweep, ascension });
  };

  const sortedBosses = [...BOSSES].sort((a, b) => a.order - b.order);
  const defeatedCount = sortedBosses.filter(b => defeated.has(b.id)).length;
  const masteryTotal = sortedBosses.reduce((sum, boss) => sum + masteryCount(boss, defeated, stats[boss.id]), 0);

  if (loading) {
    return <div className="bb-shell" style={{ textAlign: "center", paddingTop: "4rem", color: "rgba(255,255,255,0.3)" }}>Loading…</div>;
  }

  if (screen.kind === "fight") {
    return (
      <BossBattleScorer
        boss={screen.boss}
        playerName={playerName}
        ascension={screen.ascension}
        onMatchComplete={(r) => handleMatchComplete(screen.boss, r, screen.ascension ?? 0)}
        onAbandon={() => {
          if (rush) void saveRush(false, rush.wins, Math.max(1, Math.round((Date.now() - rush.startedAt) / 1000)));
          setRush(null);
          setScreen({ kind: "ladder" });
        }}
      />
    );
  }

  if (screen.kind === "rush-break") {
    return (
      <div className="bb-shell"><div className="bb-result bb-rush-result" style={{ "--glow": tierColor(screen.nextBoss) } as React.CSSProperties}>
        <div className="bb-result-glow" />
        <div className="bb-result-icon"><Gauge /></div>
        <div className="bb-vs-kicker">Boss Rush · {screen.wins}/{sortedBosses.length} cleared</div>
        <h1>{screen.nextBoss.name} awaits</h1>
        <p>{screen.lives} life{screen.lives === 1 ? "" : "s"} remaining. A loss spends one life and repeats this boss.</p>
        <div className="bb-rush-lives">{[0, 1].map(i => <Heart key={i} className={i < screen.lives ? "active" : ""} />)}</div>
        <div className="bb-vs-actions">
          <button className="bb-btn-ghost" onClick={() => { if (rush) void saveRush(false, screen.wins, Math.max(1, Math.round((Date.now() - rush.startedAt) / 1000))); setRush(null); setScreen({ kind: "ladder" }); }}>Retire run</button>
          <button className="bb-btn-primary" onClick={() => { setFightStartedAt(Date.now()); setScreen({ kind: "fight", boss: screen.nextBoss, rush: true }); }}>Next fight</button>
        </div>
      </div></div>
    );
  }

  if (screen.kind === "rush-result") {
    return (
      <div className="bb-shell"><div className="bb-result bb-rush-result" style={{ "--glow": screen.cleared ? "#ffd24a" : "#ff6b6b" } as React.CSSProperties}>
        <div className="bb-result-glow" />
        <div className="bb-result-icon">{screen.cleared ? <Trophy /> : <Skull />}</div>
        <div className="bb-vs-kicker">Boss Rush Complete</div>
        <h1>{screen.cleared ? "The gauntlet is conquered" : "The gauntlet fought back"}</h1>
        <p>{screen.wins}/{sortedBosses.length} bosses · {formatSeconds(screen.elapsedSeconds)} total · {screen.lives} lives left</p>
        <div className="bb-vs-actions">
          <button className="bb-btn-ghost" onClick={() => setScreen({ kind: "ladder" })}>Ladder</button>
          <button className="bb-btn-primary" onClick={startRush}>Rush again</button>
        </div>
      </div></div>
    );
  }

  if (screen.kind === "entrance") {
    const boss = screen.boss;
    const ascension = screen.ascension ?? 0;
    const bossMastery = masteryCount(boss, defeated, stats[boss.id]);
    const Icon = BOSS_ICON[boss.id] ?? Swords;
    return (
      <div className="bb-shell">
        <div className="bb-vs" style={tierVar(boss)}>
          <div className="bb-vs-emblem"><Icon /></div>
          <div className="bb-vs-kicker">{ascension ? `Ascension ${ascension}` : `Boss ${boss.order} of ${sortedBosses.length}`}</div>
          <h1>{boss.name}</h1>
          <div className="bb-vs-tagline">"{boss.tagline}"</div>
          <div className="bb-vs-meta">
            <span>{boss.gameMode === "X01" ? "501, double out" : "Cricket"}</span>
            <span><b>{BOT_LEVELS[boss.botLevel]?.label ?? boss.botLevel}</b> tier</span>
            <span>Best of 3</span>
          </div>
          {defeated.has(boss.id) && <div className="bb-ascension-picker">
            {[0, 1, 2].map(level => {
              const allowed = level < 2 || bossMastery === 3;
              return <button key={level} disabled={!allowed} className={ascension === level ? "active" : ""} onClick={() => setScreen({ kind: "entrance", boss, ascension: level })}>{level === 0 ? "Standard" : `Ascension ${level}`}{level === 2 && !allowed ? " · 3 medals required" : ""}</button>;
            })}
          </div>}
          <div className="bb-moves">
            {boss.moves.map((m, i) => (
              <div className="bb-move-card" key={m.name}>
                <span className="bb-move-tag">Leg {i + 1}</span>
                <div className="bb-move-name"><Sparkles />{m.name}</div>
                <div className="bb-move-desc">{m.description}</div>
              </div>
            ))}
            {boss.enrageMove && (
              <div className="bb-move-card enrage">
                <span className="bb-move-tag">Decider — Leg 3</span>
                <div className="bb-move-name"><Zap />{boss.enrageMove.name}</div>
                <div className="bb-move-desc">{boss.enrageMove.description}</div>
              </div>
            )}
          </div>
          <div className="bb-vs-footnote">For bragging rights only — no Elo impact.</div>
          <div className="bb-vs-actions">
            <button className="bb-btn-ghost" onClick={() => setScreen({ kind: "ladder" })}>Back</button>
            <button className="bb-btn-primary" onClick={() => startFight(boss, ascension)}><Swords className="inline w-3.5 h-3.5 mr-1.5" />{ascension ? `Fight Ascension ${ascension}` : "Fight"}</button>
          </div>
        </div>
      </div>
    );
  }

  if (screen.kind === "result") {
    const { boss, won, elapsedSeconds, cleanSweep, ascension = 0 } = screen;
    const next = BOSSES.find(b => b.order === boss.order + 1);
    const glow = won ? "#ffd24a" : "#ff6b6b";
    return (
      <>
      <div className="bb-shell">
        <div className="bb-result" style={{ "--glow": glow } as React.CSSProperties}>
          <div className="bb-result-glow" />
          <div className="bb-result-icon">{won ? <Trophy /> : <Skull />}</div>
          {won ? (
            <>
              <h1>{boss.name} {ascension ? `Ascension ${ascension} cleared!` : "defeated!"}</h1>
              <p>{ascension ? `Your highest cleared tier for this boss is now recorded.` : next ? `${next.name} is now unlocked.` : "That's the whole ladder beaten. Nice work."}</p>
              <div className="bb-mastery-result">
                <span className="earned"><CheckCircle2 /> Clear</span>
                <span className={cleanSweep ? "earned" : ""}><Sparkles /> 2–0 sweep</span>
                <span className={elapsedSeconds !== undefined && elapsedSeconds <= boss.masterySeconds ? "earned" : ""}><Clock /> Under {formatSeconds(boss.masterySeconds)}</span>
              </div>
              {next && !ascension && (
                <div className="bb-unlock-card">
                  <CheckCircle2 size={22} />
                  <div><small>Next Up</small><strong>{next.name}</strong></div>
                </div>
              )}
            </>
          ) : (
            <>
              <h1>{boss.name} won this one.</h1>
              <p>Have another go whenever you're ready.</p>
            </>
          )}
          <div className={`bb-save-state ${saveState}`}>
            {saveState === "saving" ? "Saving arcade result…" : saveState === "saved" ? "Result saved · records and rewards updated" : saveState === "error" ? "Result shown, but it could not be saved" : "Arcade result"}
          </div>
          <div className="bb-vs-actions">
            <button className="bb-btn-ghost" onClick={() => setScreen({ kind: "ladder" })}>Ladder</button>
            <button className="bb-btn-primary" onClick={() => setScreen({ kind: "entrance", boss, ascension })}>Run it back</button>
          </div>
        </div>
      </div>
      <AchievementRewardModal achievement={rewardQueue[0] ?? null} isOpen={rewardQueue.length > 0} onClose={() => setRewardQueue(queue => queue.slice(1))} />
      </>
    );
  }

  return (
    <div className="bb-shell">
      <div className="bb-hero">
        <div className="bb-hero-copy">
          <div className="bb-kicker"><i />TKDL Arcade · Campaign Protocol</div>
          <h1>Boss <span>Battle</span></h1>
          <p>Climb a six-fight gauntlet. Every opponent brings a different rule set, signature moves and a harder route to the crown.</p>
          <div className="bb-hero-actions">
            <button className={`bb-pill-btn ${showLeaderboard ? "active" : ""}`} onClick={toggleLeaderboard}>
              <Users className="w-3.5 h-3.5" /> Hall of Challengers
            </button>
            {defeatedCount === sortedBosses.length && <button className="bb-pill-btn rush" onClick={startRush}><Gauge className="w-3.5 h-3.5" /> Boss Rush</button>}
          </div>
        </div>
        <div className="bb-command-card">
          <div className="bb-command-label"><span>Campaign Status</span><Shield /></div>
          <strong>{defeatedCount === sortedBosses.length ? "LADDER CLEARED" : `${sortedBosses.length - defeatedCount} BOSS${sortedBosses.length - defeatedCount === 1 ? "" : "ES"} REMAIN`}</strong>
          <small>{playerId ? "Progress is saved against your selected player" : "Select a player to enter the arena"}</small>
          <div className="bb-progress-wrap">
            <div className="bb-progress-head"><span>Clearance</span><strong>{defeatedCount}/{sortedBosses.length}</strong></div>
            <div className="bb-progress-track"><div className="bb-progress-fill" style={{ width: `${(defeatedCount / sortedBosses.length) * 100}%` }} /></div>
          </div>
          <div className="bb-command-cells">
            <span><b>{defeatedCount}</b> Defeated</span>
            <span><b>{Math.min(defeatedCount + 1, sortedBosses.length)}</b> Unlocked</span>
            <span><b>{masteryTotal}/18</b> Mastery</span>
          </div>
        </div>
      </div>

      <div className="bb-arena-grid">
        <aside className="bb-control-rail">
          <div className="bb-panel-heading"><span>Challenger Check-In</span><small>01</small></div>
          {/* Player selector — no login needed, pick your name like Master-501/Practice/Tour */}
          <div className="bb-field">
            <span className="bb-field-label">Player</span>
            <select value={playerId ?? ""} onChange={e => setPlayerId(Number(e.target.value) || null)} className="bb-select">
              <option value="">Select player…</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="bb-briefing">
            <span><Zap /> Arcade Rules</span>
            <p>Boss abilities change the match as you play. Wins unlock the next fight; losses never affect league Elo.</p>
          </div>
          {defeatedCount === sortedBosses.length && <div className="bb-rush-card"><span><Gauge /> Boss Rush Unlocked</span><p>Beat all six in one run. You have two lives; a loss repeats the current boss.</p><button onClick={startRush}>Enter the gauntlet</button></div>}
          {history.length > 0 && <div className="bb-history"><div className="bb-lb-title">Recent Battles</div>{history.slice(0,4).map(run => <div className="bb-history-row" key={run.id}><i className={run.outcome}/><span>{run.mode === "boss_rush" ? "Boss Rush" : run.bossId?.replaceAll("-", " ")}</span><b>{run.outcome === "win" ? "W" : "L"}</b></div>)}</div>}

      {showLeaderboard && (
        <div className="bb-leaderboard-panel">
          {leaderboardLoading ? (
            <div className="bb-empty">Loading…</div>
          ) : !leaderboard || leaderboard.players.length === 0 ? (
            <div className="bb-empty">No one's beaten a boss yet — could be you.</div>
          ) : (
            <>
              <div className="bb-lb-title">Ladder Progress</div>
              {leaderboard.players.map((p, i) => {
                const isMe = p.playerId === playerId;
                // A purchased GLOW cosmetic overrides the default gold "it's
                // you" highlight with your own colour, same override
                // convention as the main leaderboard's SeasonRow/CareerRow.
                const glowColor = isMe ? myGlowCosmetic?.color ?? null : null;
                const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
                const pct = Math.round((p.bossesDefeated / leaderboard.totalBosses) * 100);
                return (
                  <div key={p.playerId} className="bb-lb-row" style={isMe ? myGlow : undefined}>
                    <span className={`bb-lb-rank ${rankClass}`}>{i + 1}</span>
                    <span className={`bb-lb-name ${isMe ? "me" : ""}`} style={isMe && glowColor ? { color: glowColor } : undefined}>
                      {p.playerName}
                      {p.fullClear && <Trophy className="w-3 h-3" style={{ color: "#ffd24a", flexShrink: 0 }} />}
                    </span>
                    <span className="bb-lb-progress"><i style={{ width: `${pct}%` }} /></span>
                    <span className="bb-lb-frac">{p.bossesDefeated}/{leaderboard.totalBosses}</span>
                  </div>
                );
              })}
              {Object.keys(leaderboard.fastestPerBoss).length > 0 && (
                <>
                  <div className="bb-lb-title" style={{ marginTop: "16px" }}>Fastest Clears</div>
                  {BOSSES.filter(b => leaderboard.fastestPerBoss[b.id]).sort((a, b) => a.order - b.order).map(b => (
                    <div key={b.id} className="bb-lb-fastest-row">
                      <span>{b.name}</span>
                      <span><Clock />{leaderboard.fastestPerBoss[b.id].playerName} · {formatSeconds(leaderboard.fastestPerBoss[b.id].seconds)}</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
        </aside>

        <section className="bb-campaign-panel">
          <div className="bb-panel-heading"><span>Campaign Ladder</span><small>Choose Your Fight</small></div>
          <div className="bb-ladder">
        {sortedBosses.map(boss => {
          const unlocked = isUnlocked(boss);
          const won = defeated.has(boss.id);
          const bossStats = stats[boss.id];
          const mastery = masteryCount(boss, defeated, bossStats);
          const Icon = BOSS_ICON[boss.id] ?? Swords;
          const isFinal = boss.order === sortedBosses.length;
          return (
            <button
              key={boss.id}
              disabled={!unlocked || !playerId}
              onClick={() => setScreen({ kind: "entrance", boss })}
              className="bb-boss-row"
              style={tierVar(boss)}
            >
              <span className={`bb-node ${won ? "won" : ""}`} />
              <div className={`bb-boss-card ${won ? "won" : ""} ${!unlocked ? "locked" : ""} ${isFinal ? "final" : ""}`}>
                <div className="bb-boss-icon">{!unlocked ? <Lock size={16} style={{ color: "rgba(255,255,255,0.3)" }} /> : <Icon size={18} />}</div>
                <div className="bb-boss-body">
                  <div className="bb-boss-name">{boss.name}</div>
                  <div className="bb-boss-tag">{unlocked ? boss.tagline : "Beat the previous boss to unlock"}</div>
                  {unlocked && bossStats && bossStats.attempts > 0 && (
                    <div className="bb-boss-stats">
                      {won && <CheckCircle2 size={11} style={{ color: "#ffd24a" }} />}
                      <span>{bossStats.attempts} attempt{bossStats.attempts === 1 ? "" : "s"}{bossStats.bestSeconds !== null && <> · best {formatSeconds(bossStats.bestSeconds)}</>}</span>
                    </div>
                  )}
                  {unlocked && (
                    <div className="bb-mastery-stars" aria-label={`${mastery} of 3 mastery medals`}>
                      {[0, 1, 2].map(star => <Sparkles key={star} className={star < mastery ? "earned" : ""} />)}
                      <span>{mastery}/3 mastery</span>
                    </div>
                  )}
                  {bossStats?.highestAscension > 0 && <div className="bb-ascension-cleared">Ascension {bossStats.highestAscension} cleared</div>}
                </div>
                <div className="bb-boss-side">
                  <span className="bb-tier-chip">{BOT_LEVELS[boss.botLevel]?.label ?? boss.botLevel}</span>
                  <span className="bb-mode-chip">{boss.gameMode === "X01" ? "501" : "Cricket"}</span>
                </div>
              </div>
            </button>
          );
        })}
          </div>
        </section>
      </div>
    </div>
  );
}
