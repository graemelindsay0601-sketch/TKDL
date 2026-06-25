/**
 * CardClashMatchLauncher
 * Handles: opponent selection → game mode → equipment → launch match
 */

import React, { useState, useEffect } from "react";
import { CardClashMatchScorer } from "./CardClashMatchScorer";
import { CardEquipmentSelector } from "./CardEquipmentSelector";
import type { GameResult } from "./game-scorer";

interface Player {
  id: number;
  name: string;
}

interface CardClashMatchLauncherProps {
  currentPlayerId: number;
  currentPlayerName: string;
  onMatchComplete: () => void;
}

type Step = "opponent" | "gamemode" | "equipment" | "match";

const D = {
  border:  "rgba(255,255,255,0.08)",
  sub:     "rgba(255,255,255,0.4)",
  info:    "#00b4ff",
  success: "#00cc66",
};

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "13px 40px 13px 16px", borderRadius: "10px",
  appearance: "none", background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)", color: "#fff",
  fontSize: "15px", outline: "none", cursor: "pointer", boxSizing: "border-box",
};

export function CardClashMatchLauncher({
  currentPlayerId,
  currentPlayerName,
  onMatchComplete,
}: CardClashMatchLauncherProps) {
  const [step, setStep] = useState<Step>("opponent");
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<Player | null>(null);
  const [gameMode, setGameMode] = useState<"X01" | "CRICKET" | null>(null);
  const [player1Cards, setPlayer1Cards] = useState<any[]>([]);
  const [player2Cards, setPlayer2Cards] = useState<any[]>([]);
  const [matchId, setMatchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/players")
      .then(r => r.ok ? r.json() : [])
      .then((data: Player[]) => {
        setPlayers(data.filter(p => p.id !== currentPlayerId));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentPlayerId]);

  const handleOpponentChange = (val: string) => {
    const id = parseInt(val);
    setSelectedOpponent(players.find(pl => pl.id === id) ?? null);
  };

  const handleEquipmentConfirm = async (p1Cards: any[], p2Cards: any[]) => {
    setPlayer1Cards(p1Cards);
    setPlayer2Cards(p2Cards);
    try {
      const res = await fetch("/api/card-clash/match/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameMode,
          player1Id: currentPlayerId,
          player2Id: selectedOpponent!.id,
          equippedCards: {
            player1: p1Cards.map((c: any) => ({ cardId: c.cardId || c.name, cardType: c.cardType || (c.type === "BAD" ? "BAD" : "GOOD") })),
            player2: p2Cards.map((c: any) => ({ cardId: c.cardId || c.name, cardType: c.cardType || (c.type === "BAD" ? "BAD" : "GOOD") })),
          },
        }),
      });
      if (res.ok) { const match = await res.json(); setMatchId(match.id ?? null); }
    } catch {}
    setStep("match");
  };

  const handleMatchComplete = async (result: GameResult, cardsUsed: string[]) => {
    try {
      const winnerId = result.winnerIdx === 0 ? currentPlayerId : selectedOpponent!.id;
      await fetch("/api/card-clash/match/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, winnerId, cardsUsedInMatch: cardsUsed }),
      });
    } catch {}
    onMatchComplete();
  };

  // ── STEP 1: Opponent Selection ────────────────────────────────────────────
  if (step === "opponent") {
    return (
      <div style={{ maxWidth: "520px" }}>
        <div style={{ fontSize: "11px", color: D.sub, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "10px" }}>
          SELECT OPPONENT
        </div>
        {loading ? (
          <div style={{ color: D.sub, fontSize: "13px" }}>Loading players…</div>
        ) : players.length === 0 ? (
          <div style={{ color: D.sub, fontSize: "13px" }}>No other players available.</div>
        ) : (
          <>
            <div style={{ position: "relative", marginBottom: "1.5rem" }}>
              <select
                value={selectedOpponent?.id ?? ""}
                onChange={e => handleOpponentChange(e.target.value)}
                style={selectStyle}
              >
                <option value="" style={{ background: "#0a0e18", color: "rgba(255,255,255,0.4)" }}>
                  Choose an opponent…
                </option>
                {players.map(p => (
                  <option key={p.id} value={p.id} style={{ background: "#0a0e18", color: "#fff" }}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: D.sub, pointerEvents: "none" }}>▾</span>
            </div>
            <button
              disabled={!selectedOpponent}
              onClick={() => selectedOpponent && setStep("gamemode")}
              style={{
                width: "100%", padding: "13px 24px", borderRadius: "10px", border: "none",
                fontWeight: 800, fontSize: "15px", letterSpacing: "0.06em",
                cursor: selectedOpponent ? "pointer" : "not-allowed",
                background: selectedOpponent ? "linear-gradient(135deg,#0080ff,#0040c0)" : "rgba(255,255,255,0.06)",
                color: selectedOpponent ? "#fff" : "rgba(255,255,255,0.3)",
                boxShadow: selectedOpponent ? "0 6px 24px rgba(0,128,255,0.3)" : "none",
                transition: "all 0.2s",
              }}
            >
              Next — Pick Game Mode →
            </button>
          </>
        )}
      </div>
    );
  }

  // ── STEP 2: Game Mode ─────────────────────────────────────────────────────
  if (step === "gamemode") {
    return (
      <div style={{ maxWidth: "520px" }}>
        <button
          onClick={() => setStep("opponent")}
          style={{ background: "transparent", border: "none", color: D.sub, cursor: "pointer", fontSize: "13px", marginBottom: "1.5rem", padding: 0 }}
        >
          ← Back
        </button>
        <div style={{ fontSize: "11px", color: D.sub, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "4px" }}>GAME MODE</div>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", marginBottom: "1.5rem", margin: "0 0 1.5rem" }}>
          vs <strong style={{ color: "#fff" }}>{selectedOpponent?.name}</strong>
        </p>
        <div style={{ display: "flex", gap: "16px", marginBottom: "1.5rem" }}>
          {(["X01", "CRICKET"] as const).map(mode => {
            const color = mode === "X01" ? D.info : D.success;
            const icon  = mode === "X01" ? "🎯" : "🏏";
            const desc  = mode === "X01" ? "501 · Double Out" : "Marks & Close";
            return (
              <button
                key={mode}
                onClick={() => setGameMode(mode)}
                style={{
                  flex: 1, padding: "20px 16px", borderRadius: "12px", cursor: "pointer", textAlign: "center",
                  border: `1px solid ${gameMode === mode ? color : "rgba(255,255,255,0.08)"}`,
                  background: gameMode === mode ? `${color}18` : "rgba(255,255,255,0.03)",
                  boxShadow: gameMode === mode ? `0 0 24px ${color}22` : "none",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>{icon}</div>
                <div style={{ fontWeight: 900, fontSize: "18px", color: gameMode === mode ? color : "#fff", fontFamily: "Oswald, sans-serif", letterSpacing: "0.05em", marginBottom: "4px" }}>{mode}</div>
                <div style={{ fontSize: "11px", color: D.sub }}>{desc}</div>
              </button>
            );
          })}
        </div>
        <button
          disabled={!gameMode}
          onClick={() => gameMode && setStep("equipment")}
          style={{
            width: "100%", padding: "13px 24px", borderRadius: "10px", border: "none",
            fontWeight: 800, fontSize: "15px", letterSpacing: "0.06em",
            cursor: gameMode ? "pointer" : "not-allowed",
            background: gameMode ? "linear-gradient(135deg,#0080ff,#0040c0)" : "rgba(255,255,255,0.06)",
            color: gameMode ? "#fff" : "rgba(255,255,255,0.3)",
            boxShadow: gameMode ? "0 6px 24px rgba(0,128,255,0.3)" : "none",
            transition: "all 0.2s",
          }}
        >
          Next — Equip Cards →
        </button>
      </div>
    );
  }

  // ── STEP 3: Equipment Selection ───────────────────────────────────────────
  if (step === "equipment") {
    return (
      <CardEquipmentSelector
        currentPlayerId={currentPlayerId}
        currentPlayerName={currentPlayerName}
        opponentId={selectedOpponent!.id}
        opponentName={selectedOpponent!.name}
        gameMode={gameMode!}
        onConfirm={handleEquipmentConfirm}
        onBack={() => setStep("gamemode")}
      />
    );
  }

  // ── STEP 4: Live match ────────────────────────────────────────────────────
  if (step === "match") {
    return (
      <CardClashMatchScorer
        player1Id={currentPlayerId}
        player1Name={currentPlayerName}
        player2Id={selectedOpponent!.id}
        player2Name={selectedOpponent!.name}
        gameMode={gameMode!}
        player1EquippedCards={player1Cards}
        player2EquippedCards={player2Cards}
        onMatchComplete={handleMatchComplete}
        isBot={false}
      />
    );
  }

  return null;
}
