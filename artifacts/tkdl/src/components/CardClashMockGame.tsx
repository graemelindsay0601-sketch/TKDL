/**
 * CardClashMockGame
 * Practice mode — choose a bot (level 1-20 or Fake Pro) or real player,
 * pick game mode, then play a full live match via CardClashMatchScorer.
 * No coins spent, no cards consumed from inventory.
 */

import React, { useState, useEffect } from "react";
import { Cpu, Bot, Users } from "lucide-react";
import {
  BOT_LEVELS, BOT_PERSONAS, numLevelConfig, numLevelLabel, numLevelColor,
  type BotPersona,
} from "@/lib/bot-engine";
import { CardClashMatchScorer } from "./CardClashMatchScorer";
import type { GameResult } from "./game-scorer";

interface Player { id: number; name: string; }

interface Props {
  playerId: number;
  playerName: string;
  onDone: () => void;
}

type MockMode = "level" | "pro" | "player";
type Step     = "setup" | "gamemode" | "playing" | "done";

// ── Level bot picker (1–20 grid) ──────────────────────────────────────────────
function LevelBotPicker({ selected, onSelect }: { selected: number | null; onSelect: (n: number) => void }) {
  const levels = Array.from({ length: 20 }, (_, i) => i + 1);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: "6px", marginBottom: "12px" }}>
        {levels.map(n => {
          const sel = selected === n;
          const color = numLevelColor(n);
          return (
            <button key={n} onClick={() => onSelect(n)} style={{
              aspectRatio: "1", borderRadius: "8px", fontSize: "13px", fontWeight: 900,
              fontFamily: "Oswald, sans-serif", cursor: "pointer", transition: "all 0.15s",
              background: sel ? color : `${color}18`,
              color:      sel ? "#fff" : color,
              border:     `1px solid ${sel ? color : `${color}44`}`,
            }}>
              {n}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", background: `${numLevelColor(selected)}0e`, border: `1px solid ${numLevelColor(selected)}33` }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "20px", fontFamily: "Oswald, sans-serif", background: `${numLevelColor(selected)}22`, color: numLevelColor(selected) }}>
            {selected}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "13px", color: numLevelColor(selected), fontFamily: "Oswald, sans-serif" }}>
              Level {selected} · {numLevelLabel(selected)}
            </div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
              ~{numLevelConfig(selected).avg} avg · {Math.round(numLevelConfig(selected).checkoutPct * 100)}% checkout
            </div>
          </div>
          <Cpu size={20} color={numLevelColor(selected)} />
        </div>
      )}
    </div>
  );
}

// ── Pro persona card ──────────────────────────────────────────────────────────
function PersonaCard({ persona, selected, onSelect }: { persona: BotPersona; selected: boolean; onSelect: () => void }) {
  const lvl = BOT_LEVELS[persona.level];
  return (
    <button onClick={onSelect} style={{
      width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: "10px", cursor: "pointer",
      border: `1px solid ${selected ? lvl.color : "rgba(255,255,255,0.07)"}`,
      background: selected ? `${lvl.color}14` : "rgba(255,255,255,0.02)",
      transition: "all 0.15s", position: "relative", overflow: "hidden",
    }}>
      {selected && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: lvl.color }} />}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "24px", lineHeight: 1 }}>{persona.flag}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: "13px", color: selected ? "#fff" : "rgba(255,255,255,0.85)", fontFamily: "Oswald, sans-serif" }}>{persona.name}</span>
            <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "6px", fontWeight: 700, background: `${lvl.color}22`, color: lvl.color, fontFamily: "Oswald, sans-serif", letterSpacing: "0.05em" }}>
              {persona.nickname}
            </span>
          </div>
          <div style={{ fontSize: "11px", marginTop: "2px", color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{persona.tagline}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "20px", fontWeight: 900, color: lvl.color, fontFamily: "Oswald, sans-serif", lineHeight: 1 }}>{persona.avg}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>avg</div>
        </div>
      </div>
    </button>
  );
}

// ── Game mode card ────────────────────────────────────────────────────────────
function GameModeBtn({ mode, selected, onSelect }: { mode: "X01" | "CRICKET"; selected: boolean; onSelect: () => void }) {
  const color = mode === "X01" ? "#00b4ff" : "#00cc66";
  const desc  = mode === "X01" ? "501 · Double Out" : "Marks & Close";
  const icon  = mode === "X01" ? "🎯" : "🏏";
  return (
    <button onClick={onSelect} style={{
      flex: 1, padding: "20px", borderRadius: "12px", cursor: "pointer", textAlign: "center",
      border: `1px solid ${selected ? color : "rgba(255,255,255,0.08)"}`,
      background: selected ? `${color}18` : "rgba(255,255,255,0.03)",
      boxShadow: selected ? `0 0 24px ${color}22` : "none",
      transition: "all 0.2s",
    }}>
      <div style={{ fontSize: "36px", marginBottom: "10px" }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: "16px", color: selected ? color : "#fff", fontFamily: "Oswald, sans-serif", letterSpacing: "0.05em", marginBottom: "4px" }}>{mode}</div>
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{desc}</div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CardClashMockGame({ playerId, playerName, onDone }: Props) {
  const [step, setStep]             = useState<Step>("setup");
  const [mockMode, setMockMode]     = useState<MockMode>("level");
  const [selectedLevel, setLevel]   = useState<number | null>(null);
  const [selectedPersona, setPersona] = useState<BotPersona | null>(null);
  const [players, setPlayers]       = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [gameMode, setGameMode]     = useState<"X01" | "CRICKET" | null>(null);
  const [matchId, setMatchId]       = useState<number | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  // Load real players for "vs Player" mode
  useEffect(() => {
    fetch("/api/card-clash/mock-game/players")
      .then(r => r.ok ? r.json() : [])
      .then((p: Player[]) => setPlayers(p.filter(pl => pl.id !== playerId)))
      .catch(() => {});
  }, [playerId]);

  // ── Derived opponent info ──────────────────────────────────────────────────
  const opponentId   = mockMode === "player" ? (selectedPlayerId ?? playerId) : -1;
  const opponentName = mockMode === "level"  ? (selectedLevel  ? `Level ${selectedLevel} Bot` : "Bot")
                     : mockMode === "pro"    ? (selectedPersona?.name ?? "Pro Bot")
                     : (players.find(p => p.id === selectedPlayerId)?.name ?? "Opponent");

  const setupReady = mockMode === "level"  ? selectedLevel !== null
                   : mockMode === "pro"    ? selectedPersona !== null
                   : selectedPlayerId !== null;

  // ── Step 1 → Step 2: Start the DB record + advance to game mode pick ───────
  const handleProceedToGameMode = async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/card-clash/mock-game/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player1Id: playerId,
          player2Id: mockMode === "player" ? selectedPlayerId : null,
          isBotOpponent: mockMode !== "player",
          player1Cards: [],
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Failed to create match"); setLoading(false); return; }
      setMatchId(d.match?.id ?? null);
      setStep("gamemode");
    } catch { setError("Network error — try again"); } finally { setLoading(false); }
  };

  // ── Step 3: Match complete ─────────────────────────────────────────────────
  const handleMatchComplete = async (result: GameResult, _cardsUsed: string[]) => {
    setGameResult(result);
    const winnerId = result.winnerIdx === 0 ? playerId : (mockMode === "player" && selectedPlayerId ? selectedPlayerId : playerId);
    try {
      await fetch("/api/card-clash/match/finish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, winnerId, cardsUsedInMatch: [] }),
      });
    } catch {}
    setStep("done");
  };

  // ─── STEP 1: Setup ────────────────────────────────────────────────────────
  if (step === "setup") {
    return (
      <div style={{ maxWidth: "640px" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#fff", margin: "0 0 4px", letterSpacing: "0.05em" }}>🎲 Practice Match</h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>
            No coins risked, no cards consumed — test your strategies for real.
          </p>
        </div>

        {error && (
          <div style={{ padding: "12px 16px", borderRadius: "8px", marginBottom: "1rem", background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", color: "#ff6b6b", fontSize: "13px" }}>
            {error}
          </div>
        )}

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "1.5rem" }}>
          {([
            { id: "level",  label: "🤖 Bot Level",   icon: <Cpu size={14} /> },
            { id: "pro",    label: "⭐ Fake Pro",     icon: <Bot size={14} /> },
            { id: "player", label: "👤 Real Player",  icon: <Users size={14} /> },
          ] as const).map(({ id, label }) => (
            <button key={id} onClick={() => setMockMode(id)} style={{
              flex: 1, padding: "10px 8px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "12px",
              border: `1px solid ${mockMode === id ? "rgba(0,180,255,0.5)" : "rgba(255,255,255,0.08)"}`,
              background: mockMode === id ? "rgba(0,180,255,0.12)" : "rgba(255,255,255,0.03)",
              color: mockMode === id ? "#00b4ff" : "rgba(255,255,255,0.45)",
              transition: "all 0.15s",
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Bot Level picker */}
        {mockMode === "level" && (
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "10px" }}>SELECT BOT LEVEL</div>
            <LevelBotPicker selected={selectedLevel} onSelect={setLevel} />
          </div>
        )}

        {/* Fake Pros */}
        {mockMode === "pro" && (
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "10px" }}>SELECT YOUR OPPONENT</div>
            <div style={{ display: "grid", gap: "6px", maxHeight: "320px", overflowY: "auto" }}>
              {BOT_PERSONAS.map(p => (
                <PersonaCard key={p.name} persona={p} selected={selectedPersona?.name === p.name} onSelect={() => setPersona(p)} />
              ))}
            </div>
          </div>
        )}

        {/* Real player dropdown */}
        {mockMode === "player" && (
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "10px" }}>SELECT OPPONENT</div>
            <div style={{ position: "relative" }}>
              <select
                value={selectedPlayerId ?? ""}
                onChange={e => setSelectedPlayerId(Number(e.target.value) || null)}
                style={{ width: "100%", padding: "12px 36px 12px 14px", borderRadius: "10px", appearance: "none", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: selectedPlayerId ? "#fff" : "rgba(255,255,255,0.4)", fontSize: "14px", outline: "none", cursor: "pointer" }}
              >
                <option value="" style={{ background: "#0a0e18" }}>Choose a player…</option>
                {players.map(p => <option key={p.id} value={p.id} style={{ background: "#0a0e18" }}>{p.name}</option>)}
              </select>
              <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", pointerEvents: "none" }}>▾</span>
            </div>
          </div>
        )}

        <button
          onClick={handleProceedToGameMode}
          disabled={!setupReady || loading}
          style={{
            width: "100%", padding: "14px 24px", borderRadius: "10px", border: "none", fontWeight: 800, fontSize: "15px", letterSpacing: "0.06em", cursor: setupReady && !loading ? "pointer" : "not-allowed",
            background: setupReady ? "linear-gradient(135deg,#0080ff,#0040c0)" : "rgba(255,255,255,0.06)",
            color: setupReady ? "#fff" : "rgba(255,255,255,0.3)",
            boxShadow: setupReady ? "0 6px 24px rgba(0,128,255,0.3)" : "none",
            opacity: loading ? 0.7 : 1, transition: "all 0.2s",
          }}
        >
          {loading ? "Setting up…" : `Next — Pick Game Mode →`}
        </button>
      </div>
    );
  }

  // ─── STEP 2: Game mode ────────────────────────────────────────────────────
  if (step === "gamemode") {
    return (
      <div style={{ maxWidth: "500px" }}>
        <button onClick={() => setStep("setup")} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "13px", marginBottom: "1.5rem", padding: 0 }}>
          ← Back
        </button>
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#fff", margin: "0 0 4px" }}>🎯 Choose Game Mode</h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>
            Playing vs <strong style={{ color: "#fff" }}>{opponentName}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: "16px", marginBottom: "2rem" }}>
          <GameModeBtn mode="X01"     selected={gameMode === "X01"}     onSelect={() => setGameMode("X01")} />
          <GameModeBtn mode="CRICKET" selected={gameMode === "CRICKET"} onSelect={() => setGameMode("CRICKET")} />
        </div>
        <button
          disabled={!gameMode}
          onClick={() => gameMode && setStep("playing")}
          style={{
            width: "100%", padding: "14px 24px", borderRadius: "10px", border: "none", fontWeight: 800, fontSize: "15px", letterSpacing: "0.06em", cursor: gameMode ? "pointer" : "not-allowed",
            background: gameMode ? "linear-gradient(135deg,#00b4ff,#0066cc)" : "rgba(255,255,255,0.06)",
            color: gameMode ? "#fff" : "rgba(255,255,255,0.3)",
            boxShadow: gameMode ? "0 6px 24px rgba(0,180,255,0.3)" : "none", transition: "all 0.2s",
          }}
        >
          🎲 Start Game →
        </button>
      </div>
    );
  }

  // ─── STEP 3: Live game ────────────────────────────────────────────────────
  if (step === "playing") {
    return (
      <CardClashMatchScorer
        player1Id={playerId}
        player1Name={playerName}
        player2Id={opponentId}
        player2Name={opponentName}
        gameMode={gameMode!}
        player1EquippedCards={[]}
        player2EquippedCards={[]}
        onMatchComplete={handleMatchComplete}
        isBot={mockMode !== "player"}
      />
    );
  }

  // ─── STEP 4: Done ────────────────────────────────────────────────────────
  if (step === "done") {
    const iWon = gameResult?.winnerIdx === 0;
    return (
      <div style={{ maxWidth: "480px", textAlign: "center", padding: "2rem 0" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>{iWon ? "🏆" : "💪"}</div>
        <h2 style={{ fontSize: "24px", fontWeight: 900, color: iWon ? "#00ff88" : "#ff6b6b", margin: "0 0 8px", letterSpacing: "0.05em" }}>
          {iWon ? "Practice Win!" : "Good Effort!"}
        </h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "2rem", lineHeight: 1.6 }}>
          {iWon
            ? `You beat ${opponentName} in a practice match. Now try it for real!`
            : `${opponentName} got you this time. Practice makes perfect.`}
          <br />Practice results don't affect your coins or collection.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => { setStep("setup"); setGameMode(null); setGameResult(null); }}
            style={{ padding: "12px 24px", borderRadius: "10px", border: "none", background: "rgba(0,180,255,0.15)", color: "#00b4ff", cursor: "pointer", fontWeight: 700, fontSize: "14px", border: "1px solid rgba(0,180,255,0.3)" } as React.CSSProperties}
          >
            🔄 Play Again
          </button>
          <button
            onClick={onDone}
            style={{ padding: "12px 24px", borderRadius: "10px", border: "none", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontWeight: 600, fontSize: "14px", border: "1px solid rgba(255,255,255,0.1)" } as React.CSSProperties}
          >
            Back to Collection
          </button>
        </div>
      </div>
    );
  }

  return null;
}
