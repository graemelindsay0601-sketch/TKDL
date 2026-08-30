import { useEffect, useState } from "react";
import { Swords, Lock, Trophy, Skull } from "lucide-react";
import { useCurrentPlayer } from "@/context/auth";
import { BOSSES, type Boss } from "@/lib/boss-battles-data";
import { BossBattleScorer } from "@/components/BossBattleScorer";
import type { GameResult } from "@/components/game-scorer";

type Screen = { kind: "ladder" } | { kind: "entrance"; boss: Boss } | { kind: "fight"; boss: Boss } | { kind: "result"; boss: Boss; won: boolean };

export default function BossBattlePage() {
  const currentPlayer = useCurrentPlayer();
  const [defeated, setDefeated] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>({ kind: "ladder" });

  const loadProgress = () => {
    if (!currentPlayer?.playerId) { setLoading(false); return; }
    fetch(`/api/boss-battles/progress/${currentPlayer.playerId}`)
      .then(r => r.ok ? r.json() : { defeated: [] })
      .then((d: { defeated: string[] }) => setDefeated(new Set(d.defeated)))
      .catch(() => setDefeated(new Set()))
      .finally(() => setLoading(false));
  };

  useEffect(loadProgress, [currentPlayer?.playerId]);

  const isUnlocked = (boss: Boss) => {
    if (boss.order <= 1) return true;
    const prev = BOSSES.find(b => b.order === boss.order - 1);
    return prev ? defeated.has(prev.id) : true;
  };

  const handleMatchComplete = async (boss: Boss, result: GameResult) => {
    const won = result.winnerIdx === 0;
    if (won && currentPlayer?.playerId) {
      try {
        await fetch("/api/boss-battles/complete", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: currentPlayer.playerId, bossId: boss.id }),
        });
        setDefeated(prev => new Set(prev).add(boss.id));
      } catch { /* progress just won't be saved this time — not worth blocking the result screen over */ }
    }
    setScreen({ kind: "result", boss, won });
  };

  if (!currentPlayer) {
    return (
      <div className="max-w-md mx-auto py-16 text-center" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Oswald, sans-serif" }}>
        Log in to take on the boss ladder.
      </div>
    );
  }

  if (loading) {
    return <div className="max-w-md mx-auto py-16 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>Loading…</div>;
  }

  if (screen.kind === "fight") {
    return (
      <BossBattleScorer
        boss={screen.boss}
        playerName={currentPlayer.playerName}
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
          <button onClick={() => setScreen({ kind: "fight", boss })}
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
      </div>
      <div className="space-y-3">
        {BOSSES.sort((a, b) => a.order - b.order).map(boss => {
          const unlocked = isUnlocked(boss);
          const won = defeated.has(boss.id);
          return (
            <button
              key={boss.id}
              disabled={!unlocked}
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
