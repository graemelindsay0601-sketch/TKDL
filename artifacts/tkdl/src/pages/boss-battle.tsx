import { useEffect, useState } from "react";
import { Swords, Lock, Trophy, Skull, Clock, Users } from "lucide-react";
import { useCurrentPlayer } from "@/context/auth";
import { BOSSES, type Boss } from "@/lib/boss-battles-data";
import { BossBattleScorer } from "@/components/BossBattleScorer";
import type { GameResult } from "@/components/game-scorer";

type Screen = { kind: "ladder" } | { kind: "entrance"; boss: Boss } | { kind: "fight"; boss: Boss } | { kind: "result"; boss: Boss; won: boolean };

type BossStats = { attempts: number; wins: number; bestSeconds: number | null };

type RosterPlayer = { id: number; name: string; status: string; isActive: boolean };

type LeaderboardData = {
  totalBosses: number;
  players: { playerId: number; playerName: string; bossesDefeated: number; fullClear: boolean; lastDefeatAt: string }[];
  fastestPerBoss: Record<string, { playerName: string; seconds: number }>;
};

/** mm:ss for a fight duration — best times are always well under an hour. */
function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
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

  const playerName = players.find(p => p.id === playerId)?.name ?? "";

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

  const startFight = (boss: Boss) => {
    setFightStartedAt(Date.now());
    setScreen({ kind: "fight", boss });
  };

  const handleMatchComplete = async (boss: Boss, result: GameResult) => {
    const won = result.winnerIdx === 0;
    const elapsedSeconds = fightStartedAt ? Math.round((Date.now() - fightStartedAt) / 1000) : undefined;
    if (playerId) {
      try {
        await fetch("/api/boss-battles/attempt", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, bossId: boss.id, won, elapsedSeconds }),
        });
        // Refetch rather than patch locally — attempts/wins/best time are
        // server-computed (upserts, min() on best time), so re-reading is
        // the only way to stay exactly in sync with what was actually saved.
        loadProgress();
      } catch { /* progress just won't be saved this time — not worth blocking the result screen over */ }
    }
    setFightStartedAt(null);
    setScreen({ kind: "result", boss, won });
  };

  if (loading) {
    return <div className="max-w-md mx-auto py-16 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>Loading…</div>;
  }

  if (screen.kind === "fight") {
    return (
      <BossBattleScorer
        boss={screen.boss}
        playerName={playerName}
        onMatchComplete={(r) => handleMatchComplete(screen.boss, r)}
        onAbandon={() => setScreen({ kind: "ladder" })}
      />
    );
  }

  if (screen.kind === "entrance") {
    const boss = screen.boss;
    return (
      <div className="max-w-md mx-auto py-10 px-4 text-center" style={{ fontFamily: "Oswald, sans-serif" }}>
        <div style={{ fontSize: "0.7rem", letterSpacing: "0.2em", color: "rgba(255,80,80,0.6)", textTransform: "uppercase" }}>Boss Battle</div>
        <div style={{ fontSize: "2rem", fontWeight: 900, color: "#fff", marginTop: "8px" }}>{boss.name}</div>
        <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.5)", marginTop: "4px", fontStyle: "italic" }}>"{boss.tagline}"</div>
        <div style={{ marginTop: "24px", padding: "16px", borderRadius: "12px", background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.25)", textAlign: "left" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.08em", color: "#ff6b6b", textTransform: "uppercase", marginBottom: "8px" }}>Moves</div>
          {boss.moves.map(m => (
            <div key={m.name} style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff" }}>{m.name}</div>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)" }}>{m.description}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", marginTop: "10px" }}>
          Best of 3 legs · {boss.gameMode === "X01" ? "501, double out" : "Cricket"} · for bragging rights only, no Elo impact
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={() => setScreen({ kind: "ladder" })}
            className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
            Back
          </button>
          <button onClick={() => startFight(boss)}
            className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider"
            style={{ background: "linear-gradient(135deg,#ff005c,#8b0000)", color: "#fff" }}>
            <Swords className="inline w-3.5 h-3.5 mr-1.5" />Fight
          </button>
        </div>
      </div>
    );
  }

  if (screen.kind === "result") {
    const { boss, won } = screen;
    const next = BOSSES.find(b => b.order === boss.order + 1);
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center" style={{ fontFamily: "Oswald, sans-serif" }}>
        {won ? (
          <>
            <Trophy className="mx-auto mb-3" size={40} style={{ color: "#ffd24a" }} />
            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff" }}>{boss.name} defeated!</div>
            {next ? (
              <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: "6px" }}>{next.name} is now unlocked.</div>
            ) : (
              <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: "6px" }}>That's the whole ladder beaten. Nice work.</div>
            )}
          </>
        ) : (
          <>
            <Skull className="mx-auto mb-3" size={40} style={{ color: "#ff6b6b" }} />
            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff" }}>{boss.name} won this one.</div>
            <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: "6px" }}>Have another go whenever you're ready.</div>
          </>
        )}
        <div className="flex gap-2 mt-8">
          <button onClick={() => setScreen({ kind: "ladder" })}
            className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
            Ladder
          </button>
          <button onClick={() => setScreen({ kind: "entrance", boss })}
            className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider"
            style={{ background: "linear-gradient(135deg,#ff005c,#8b0000)", color: "#fff" }}>
            Run it back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4" style={{ fontFamily: "Oswald, sans-serif" }}>
      <div className="text-center mb-6">
        <div style={{ fontSize: "0.7rem", letterSpacing: "0.2em", color: "rgba(255,80,80,0.6)", textTransform: "uppercase" }}>Beta</div>
        <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#fff" }}>Boss Battle</div>
        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>Beat each boss to unlock the next. Arcade only — no Elo impact.</div>
        <button onClick={toggleLeaderboard}
          className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide"
          style={{ background: showLeaderboard ? "rgba(255,210,74,0.15)" : "rgba(255,255,255,0.06)", color: showLeaderboard ? "#ffd24a" : "rgba(255,255,255,0.5)" }}>
          <Users className="w-3.5 h-3.5" /> Leaderboard
        </button>
      </div>

      {/* Player selector — no login needed, pick your name like Master-501/Practice/Tour */}
      <div className="mb-5">
        <h2 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald,sans-serif" }}>Player</h2>
        <select value={playerId ?? ""} onChange={e => setPlayerId(Number(e.target.value) || null)}
          className="w-full px-3 py-2.5 rounded-lg text-sm"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontFamily: "Oswald,sans-serif", cursor: "pointer" }}>
          <option value="">Select player…</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {showLeaderboard && (
        <div className="pdc-card p-4 mb-5">
          {leaderboardLoading ? (
            <div className="text-center py-4 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Loading…</div>
          ) : !leaderboard || leaderboard.players.length === 0 ? (
            <div className="text-center py-2 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>No one's beaten a boss yet — could be you.</div>
          ) : (
            <div className="space-y-2">
              <div style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "4px" }}>
                Ladder Progress
              </div>
              {leaderboard.players.map((p, i) => (
                <div key={p.playerId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem", width: "1.2em", display: "inline-block" }}>{i + 1}</span>
                    <span style={{ color: p.playerId === playerId ? "#ffd24a" : "#fff", fontWeight: p.playerId === playerId ? 800 : 500 }}>
                      {p.playerName}
                    </span>
                    {p.fullClear && <Trophy className="w-3 h-3" style={{ color: "#ffd24a" }} />}
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem" }}>{p.bossesDefeated}/{leaderboard.totalBosses}</span>
                </div>
              ))}
              {Object.keys(leaderboard.fastestPerBoss).length > 0 && (
                <>
                  <div style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", margin: "10px 0 4px" }}>
                    Fastest Clears
                  </div>
                  {BOSSES.filter(b => leaderboard.fastestPerBoss[b.id]).sort((a, b) => a.order - b.order).map(b => (
                    <div key={b.id} className="flex items-center justify-between text-xs">
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>{b.name}</span>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>
                        <Clock className="inline w-3 h-3 mr-1" style={{ verticalAlign: "-1px" }} />
                        {leaderboard.fastestPerBoss[b.id].playerName} · {formatSeconds(leaderboard.fastestPerBoss[b.id].seconds)}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {BOSSES.sort((a, b) => a.order - b.order).map(boss => {
          const unlocked = isUnlocked(boss);
          const won = defeated.has(boss.id);
          const bossStats = stats[boss.id];
          return (
            <button
              key={boss.id}
              disabled={!unlocked || !playerId}
              onClick={() => setScreen({ kind: "entrance", boss })}
              className="w-full text-left"
              style={{
                display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderRadius: "12px",
                background: won ? "rgba(255,210,74,0.06)" : unlocked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
                border: `1px solid ${won ? "rgba(255,210,74,0.3)" : unlocked ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}`,
                opacity: unlocked ? 1 : 0.5, cursor: unlocked ? "pointer" : "not-allowed",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: won ? "rgba(255,210,74,0.15)" : "rgba(255,80,80,0.1)", flexShrink: 0,
              }}>
                {!unlocked ? <Lock size={16} style={{ color: "rgba(255,255,255,0.3)" }} /> : won ? <Trophy size={16} style={{ color: "#ffd24a" }} /> : <Swords size={16} style={{ color: "#ff6b6b" }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 800, color: unlocked ? "#fff" : "rgba(255,255,255,0.4)" }}>{boss.name}</div>
                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)" }}>
                  {unlocked ? boss.tagline : "Beat the previous boss to unlock"}
                </div>
                {unlocked && bossStats && bossStats.attempts > 0 && (
                  <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}>
                    {bossStats.attempts} attempt{bossStats.attempts === 1 ? "" : "s"}
                    {bossStats.bestSeconds !== null && <> · best {formatSeconds(bossStats.bestSeconds)}</>}
                  </div>
                )}
              </div>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                {boss.gameMode === "X01" ? "501" : "Cricket"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
