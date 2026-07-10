/**
 * CardClashMatchLauncher
 * Unified entry point for Card Clash: mode (2 Players / Solo vs CPU) →
 * opponent/bot → game mode (X01 / Cricket / Chaos) → match length →
 * equipment → launch match.
 *
 * Visual language (mode-toggle pills, pdc-card tiles, Oswald uppercase
 * headers) AND the full Solo vs CPU bot system (Level Bot / Play a Pro /
 * Player Clone) are ported from the Practice page's setup screen so Card
 * Clash feels consistent with the rest of the app, while keeping its own
 * game modes (X01 / Cricket / Chaos Mode) rather than Practice's full game
 * list.
 */

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Users, Bot as BotIcon, Cpu, Trophy, Ghost } from "lucide-react";
import { CardClashMatchScorer } from "./CardClashMatchScorer";
import { CardEquipmentSelector } from "./CardEquipmentSelector";
import { LevelBotPicker, PersonaCard, ShadowPlayerPicker, type SoloBotMode, type ShadowProfileData, type ShadowProfileResult } from "./BotPickers";
import { generateBotCards } from "@/lib/card-clash-bots";
import {
  BOT_PERSONAS, BOT_LEVELS, getBotConfig, numLevelConfig, numLevelLabel, numLevelColor,
  type BotPersona, type BotConfig, type ShadowProfile,
} from "@/lib/bot-engine";
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

type VsMode = "2p" | "bot";
type GameEngine = "X01" | "CRICKET";
type Step = "mode" | "opponent" | "bot" | "gamemode" | "matchlength" | "equipment-p1" | "equipment-p2" | "match";

interface ResolvedBot {
  name: string;
  subtitle: string;
  flag?: string;
  color: string;
  config: BotConfig;
}

const D = {
  border:  "rgba(255,255,255,0.08)",
  sub:     "rgba(255,255,255,0.4)",
  gold:    "#ffd24a",
  cyan:    "#00d4ff",
  green:   "#00cc66",
  chaos:   "#f472b6",
};

function PrimaryButton({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        width: "100%", padding: "13px 24px", borderRadius: "10px", border: "none",
        fontWeight: 800, fontSize: "15px", letterSpacing: "0.06em",
        fontFamily: "Oswald, sans-serif", textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${D.gold}, #ff9d00)`,
        color: disabled ? "rgba(255,255,255,0.3)" : "#1a1200",
        boxShadow: disabled ? "none" : `0 6px 24px rgba(255,210,74,0.3)`,
        transition: "all 0.2s",
      }}
    >
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ background: "transparent", border: "none", color: D.sub, cursor: "pointer", fontSize: "13px", marginBottom: "1.25rem", padding: 0, fontFamily: "Oswald, sans-serif" }}
    >
      ← Back
    </button>
  );
}

function StepHeader({ label, sub }: { label: string; sub?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div style={{ fontSize: "11px", color: D.sub, fontWeight: 700, letterSpacing: "0.1em", fontFamily: "Oswald, sans-serif", marginBottom: sub ? "4px" : 0 }}>
        {label}
      </div>
      {sub && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: 0 }}>{sub}</p>}
    </div>
  );
}

export function CardClashMatchLauncher({
  currentPlayerId,
  currentPlayerName,
  onMatchComplete,
}: CardClashMatchLauncherProps) {
  const [step, setStep] = useState<Step>("mode");
  const [vsMode, setVsMode] = useState<VsMode>("2p");
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<Player | null>(null);

  // Solo vs CPU — same three modes as Practice
  const [botMode, setBotMode] = useState<SoloBotMode>("level");
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<BotPersona | null>(null);
  const [selectedShadowId, setSelectedShadowId] = useState<number | null>(null);
  const [shadowProfiles, setShadowProfiles] = useState<Record<number, ShadowProfileResult>>({});

  const [selectedTile, setSelectedTile] = useState<GameEngine | "CHAOS" | null>(null);
  const [chaosEngine, setChaosEngine] = useState<GameEngine>("X01");
  const gameMode: GameEngine | null = selectedTile === "CHAOS" ? chaosEngine : selectedTile;
  const isChaos = selectedTile === "CHAOS";

  const [formatMode, setFormatMode] = useState<"legs" | "sets">("legs");
  const [selectedLegs, setSelectedLegs] = useState(1);
  const [selectedSets, setSelectedSets] = useState({ sets: 3, legsPerSet: 3 });
  const matchFormat = formatMode === "sets"
    ? { legs: selectedSets.legsPerSet, setsToWin: selectedSets.sets, legsToWinSet: selectedSets.legsPerSet }
    : { legs: selectedLegs, setsToWin: undefined as number | undefined, legsToWinSet: undefined as number | undefined };
  const [player1Cards, setPlayer1Cards] = useState<any[]>([]);
  const [player2Cards, setPlayer2Cards] = useState<any[]>([]);
  const [matchId, setMatchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [startingChaos, setStartingChaos] = useState(false);

  useEffect(() => {
    fetch("/api/players")
      .then(r => r.ok ? r.json() : [])
      .then((data: Player[]) => {
        setPlayers(data.filter(p => p.id !== currentPlayerId));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentPlayerId]);

  // Fetch shadow (player-clone) profiles once players are known — same as Practice
  useEffect(() => {
    if (players.length === 0) return;
    const needed = players.filter(p => !(p.id in shadowProfiles));
    if (needed.length === 0) return;
    needed.forEach(p => {
      fetch(`/api/players/${p.id}/shadow-profile`).then(r => r.json())
        .then(data => {
          setShadowProfiles(prev => ({ ...prev, [p.id]: { ...data, playerName: p.name } }));
        })
        .catch(() => {});
    });
  }, [players]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveBot = (): ResolvedBot | null => {
    if (botMode === "level" && selectedLevel !== null) {
      const color = numLevelColor(selectedLevel);
      return {
        name: `Level ${selectedLevel} Bot`,
        subtitle: `${numLevelLabel(selectedLevel)} · ${numLevelConfig(selectedLevel).avg} avg`,
        color,
        config: numLevelConfig(selectedLevel),
      };
    }
    if (botMode === "shadow" && selectedShadowId !== null) {
      const prof = shadowProfiles[selectedShadowId] as ShadowProfileData;
      if (!prof || (prof as any).locked) return null;
      const shadowPlayer = players.find(p => p.id === selectedShadowId);
      if (!shadowPlayer) return null;
      const sp: ShadowProfile = {
        playerId: selectedShadowId,
        playerName: shadowPlayer.name,
        totalDarts: prof.totalDarts,
        primarySeg: prof.primarySeg,
        treblePct: prof.treblePct,
        singlePct: prof.singlePct,
        checkoutSegs: prof.checkoutSegs,
        doubleHitPct: prof.doubleHitPct,
        computedAvg: prof.computedAvg,
      };
      return {
        name: `Shadow ${shadowPlayer.name}`,
        subtitle: `Player Clone · ${Number(prof.computedAvg).toFixed(1)} avg`,
        flag: "👻",
        color: "#a78bfa",
        config: { ...getBotConfig("club"), shadowProfile: sp },
      };
    }
    if (botMode === "pro" && selectedPersona) {
      const lvl = BOT_LEVELS[selectedPersona.level];
      return {
        name: selectedPersona.name,
        subtitle: `${selectedPersona.nickname} · ${lvl.label} · ${selectedPersona.avg} avg`,
        flag: selectedPersona.flag,
        color: lvl.color,
        config: getBotConfig(selectedPersona.level),
      };
    }
    return null;
  };

  const resolvedBot = vsMode === "bot" ? resolveBot() : null;

  const resetAll = () => {
    setStep("mode");
    setPlayer1Cards([]);
    setPlayer2Cards([]);
    setSelectedOpponent(null);
    setBotMode("level");
    setSelectedLevel(null);
    setSelectedPersona(null);
    setSelectedShadowId(null);
    setSelectedTile(null);
    setFormatMode("legs");
    setSelectedLegs(1);
    setSelectedSets({ sets: 3, legsPerSet: 3 });
    setMatchId(null);
    setMatchError(null);
  };

  const handlePlayer1Equip = (p1Cards: any[]) => {
    setPlayer1Cards(p1Cards);
    if (vsMode === "bot") {
      // Client-side only, no stakes — generate bot deck from its real avg and jump straight in
      const botCards = generateBotCards(resolvedBot!.config.avg, gameMode!);
      setPlayer2Cards(botCards);
      setStep("match");
    } else {
      setStep("equipment-p2");
    }
  };

  const startMatchOnServer = async (p1Cards: any[], p2Cards: any[]) => {
    setMatchError(null);
    try {
      const res = await fetch("/api/card-clash/match/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameMode,
          player1Id: currentPlayerId,
          player2Id: selectedOpponent!.id,
          equippedCards: {
            player1: p1Cards.map((c: any) => ({ cardId: c.id || c.cardId || c.name, cardType: c.cardType || "GOOD" })),
            player2: p2Cards.map((c: any) => ({ cardId: c.id || c.cardId || c.name, cardType: c.cardType || "GOOD" })),
          },
        }),
      });
      if (res.ok) {
        const match = await res.json();
        setMatchId(match.id ?? null);
        setStep("match");
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        setMatchError(err.error ?? `Failed to start match (${res.status})`);
        return false;
      }
    } catch (e) {
      setMatchError("Network error — check your connection and try again");
      return false;
    }
  };

  const handlePlayer2Equip = async (p2Cards: any[]) => {
    setPlayer2Cards(p2Cards);
    const ok = await startMatchOnServer(player1Cards, p2Cards);
    if (!ok) setStep("equipment-p2");
  };

  const handleStartChaos = async () => {
    setPlayer1Cards([]);
    setPlayer2Cards([]);
    if (vsMode === "bot") {
      // No stakes, fully client-side — chaos mode ignores equipped cards anyway
      setStep("match");
      return;
    }
    setStartingChaos(true);
    const ok = await startMatchOnServer([], []);
    setStartingChaos(false);
    if (!ok) setStep("matchlength");
  };

  const handleMatchComplete = async (result: GameResult, cardsUsed: string[]) => {
    if (vsMode === "bot") {
      // Practice vs CPU — no stakes, no DB persistence, matches prior behavior
      onMatchComplete();
      return;
    }
    try {
      if (!matchId) {
        console.error("Cannot finish match: matchId not set");
      } else {
        const winnerId = result.winnerIdx === 0 ? currentPlayerId : selectedOpponent!.id;
        const res = await fetch("/api/card-clash/match/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId, winnerId, cardsUsedInMatch: cardsUsed }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("Failed to finish match:", err);
        }
      }
    } catch (e) {
      console.error("Network error sending match result:", e);
    }
    onMatchComplete();
  };

  const handleAbandon = () => resetAll();

  const opponentLabel = vsMode === "bot" ? resolvedBot?.name : selectedOpponent?.name;

  // ── STEP 0: Mode Toggle ─────────────────────────────────────────────────
  if (step === "mode") {
    return (
      <div style={{ maxWidth: "520px" }}>
        <StepHeader label="CARD CLASH" sub="Battle another player, or warm up against the CPU" />
        <div className="flex gap-2" style={{ marginBottom: "1.5rem" }}>
          {([
            { v: "2p" as const, l: "2 Players", icon: <Users className="w-4 h-4 shrink-0" /> },
            { v: "bot" as const, l: "Solo vs CPU", icon: <BotIcon className="w-4 h-4 shrink-0" /> },
          ]).map(({ v, l, icon }) => (
            <button
              key={v}
              onClick={() => setVsMode(v)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              style={{
                fontFamily: "Oswald, sans-serif",
                background: vsMode === v ? "rgba(255,210,74,0.15)" : "rgba(255,255,255,0.03)",
                border: vsMode === v ? `1px solid rgba(255,210,74,0.4)` : "1px solid rgba(255,255,255,0.07)",
                color: vsMode === v ? D.gold : "rgba(255,255,255,0.3)",
                cursor: "pointer",
              }}
            >
              {icon}{l}
            </button>
          ))}
        </div>
        <PrimaryButton onClick={() => setStep(vsMode === "2p" ? "opponent" : "bot")}>
          Next →
        </PrimaryButton>
      </div>
    );
  }

  // ── STEP 1a: Opponent Selection (2 Players) ─────────────────────────────
  if (step === "opponent") {
    return (
      <div style={{ maxWidth: "520px" }}>
        <BackButton onClick={() => setStep("mode")} />
        <StepHeader label="PLAYERS" />
        {loading ? (
          <div style={{ color: D.sub, fontSize: "13px" }}>Loading players…</div>
        ) : players.length === 0 ? (
          <div style={{ color: D.sub, fontSize: "13px" }}>No other players available.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: "1.5rem" }}>
              <div className="pdc-card p-3">
                <div className="text-xs font-bold uppercase mb-2" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e", letterSpacing: "0.1em" }}>
                  Player 1
                </div>
                <div className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "Oswald, sans-serif" }}>
                  {currentPlayerName} <span style={{ color: "rgba(255,255,255,0.3)" }}>(you)</span>
                </div>
              </div>
              <div className="pdc-card p-3" style={{ borderColor: selectedOpponent ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)" }}>
                <div className="text-xs font-bold uppercase mb-2" style={{ fontFamily: "Oswald, sans-serif", color: "#ee0a78", letterSpacing: "0.1em" }}>
                  Player 2
                </div>
                <select
                  value={selectedOpponent?.id ?? ""}
                  onChange={e => setSelectedOpponent(players.find(p => p.id === parseInt(e.target.value)) ?? null)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: selectedOpponent ? "#fff" : "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}
                >
                  <option value="" style={{ color: "#111" }}>Select…</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id} style={{ color: "#111" }}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <PrimaryButton disabled={!selectedOpponent} onClick={() => selectedOpponent && setStep("gamemode")}>
              Next — Pick Game Mode →
            </PrimaryButton>
          </>
        )}
      </div>
    );
  }

  // ── STEP 1b: Bot Selection (Solo vs CPU) — same Level Bot / Play a Pro /
  //     Player Clone system as Practice ──────────────────────────────────
  if (step === "bot") {
    return (
      <div style={{ maxWidth: "520px" }}>
        <BackButton onClick={() => setStep("mode")} />
        <StepHeader label="CHOOSE YOUR OPPONENT" />

        <div className="flex gap-1 p-1 rounded-xl mb-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {([
            { key: "level" as SoloBotMode, label: "Level Bot", icon: <Cpu className="w-3.5 h-3.5" /> },
            { key: "pro" as SoloBotMode, label: "Play a Pro", icon: <Trophy className="w-3.5 h-3.5" /> },
            { key: "shadow" as SoloBotMode, label: "Player Clone", icon: <Ghost className="w-3.5 h-3.5" /> },
          ]).map(({ key, label, icon }) => (
            <button key={key} onClick={() => setBotMode(key)}
              className="flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1.5"
              style={{
                fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", cursor: "pointer",
                background: botMode === key ? "rgba(255,210,74,0.15)" : "transparent",
                color: botMode === key ? D.gold : "rgba(255,255,255,0.3)",
                border: botMode === key ? "1px solid rgba(255,210,74,0.3)" : "1px solid transparent",
              }}>
              {icon}{label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          {botMode === "level" ? (
            <div>
              <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                Pick a difficulty from 1 (pub rookie) to 20 (world-class). Card deck strength scales with it too.
              </p>
              <LevelBotPicker selected={selectedLevel} onSelect={setSelectedLevel} />
            </div>
          ) : botMode === "pro" ? (
            <div>
              <div className="flex gap-2 flex-wrap mb-3">
                {(Object.entries(BOT_LEVELS) as [string, typeof BOT_LEVELS[keyof typeof BOT_LEVELS]][])
                  .reverse()
                  .map(([key, lvl]) => (
                    <span key={key} className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: `${lvl.color}18`, color: lvl.color, fontFamily: "Oswald, sans-serif", border: `1px solid ${lvl.color}44` }}>
                      {lvl.label} · {lvl.avg}+ avg
                    </span>
                  ))}
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {BOT_PERSONAS.map(p => (
                  <PersonaCard key={p.id} persona={p}
                    selected={selectedPersona?.id === p.id}
                    onSelect={() => setSelectedPersona(p)} />
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                Play against a bot that mirrors how a real player actually throws. Unlocks at 250 combined darts.
              </p>
              <ShadowPlayerPicker
                players={players}
                profiles={shadowProfiles}
                selected={selectedShadowId}
                onSelect={setSelectedShadowId}
              />
            </div>
          )}
        </div>

        <PrimaryButton disabled={!resolvedBot} onClick={() => resolvedBot && setStep("gamemode")}>
          Next — Pick Game Mode →
        </PrimaryButton>
      </div>
    );
  }

  // ── STEP 2: Game Mode (X01 / Cricket / Chaos) ───────────────────────────
  if (step === "gamemode") {
    return (
      <div style={{ maxWidth: "520px" }}>
        <BackButton onClick={() => setStep(vsMode === "2p" ? "opponent" : "bot")} />
        <StepHeader label="GAME MODE" sub={<>vs <strong style={{ color: "#fff" }}>{opponentLabel}</strong></>} />
        <div className="flex gap-3" style={{ marginBottom: "0.75rem" }}>
          {([
            { id: "X01" as const, color: D.cyan, icon: "🎯", desc: "501 · Double Out" },
            { id: "CRICKET" as const, color: D.green, icon: "🏏", desc: "Marks & Close" },
          ]).map(({ id, color, icon, desc }) => (
            <button
              key={id}
              onClick={() => { setSelectedTile(id); }}
              className="pdc-card flex-1 p-4 text-center transition-all"
              style={{
                cursor: "pointer",
                borderColor: selectedTile === id ? color : undefined,
                background: selectedTile === id ? `${color}18` : undefined,
                boxShadow: selectedTile === id ? `0 0 24px ${color}22` : undefined,
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>{icon}</div>
              <div style={{ fontWeight: 900, fontSize: "16px", color: selectedTile === id ? color : "#fff", fontFamily: "Oswald, sans-serif", letterSpacing: "0.05em", marginBottom: "4px" }}>{id}</div>
              <div style={{ fontSize: "11px", color: D.sub }}>{desc}</div>
            </button>
          ))}
        </div>

        <div
          onClick={() => setSelectedTile("CHAOS")}
          className="pdc-card p-3 cursor-pointer transition-all relative overflow-hidden"
          style={{
            marginBottom: "1.5rem",
            borderColor: isChaos ? D.chaos : "rgba(244,114,182,0.35)",
            background: isChaos ? "rgba(244,114,182,0.1)" : "rgba(244,114,182,0.04)",
            boxShadow: isChaos ? `0 0 18px rgba(244,114,182,0.18)` : undefined,
          }}
        >
          {isChaos && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: D.chaos }} />}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm flex items-center gap-1.5" style={{ fontFamily: "Oswald, sans-serif", color: isChaos ? "#fff" : "rgba(255,255,255,0.8)", letterSpacing: "0.05em" }}>
                🌀 Chaos Mode
              </div>
              <div className="text-xs mt-0.5 leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>
                No pre-match equipping — mystery cards drawn every visit
              </div>
            </div>
          </div>
          {isChaos && (
            <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
              {(["X01", "CRICKET"] as const).map(eng => (
                <button
                  key={eng}
                  onClick={() => setChaosEngine(eng)}
                  className="px-3 py-1 text-xs font-bold rounded-lg transition-all"
                  style={{
                    fontFamily: "Oswald, sans-serif", cursor: "pointer",
                    background: chaosEngine === eng ? D.chaos : "rgba(244,114,182,0.1)",
                    color: chaosEngine === eng ? "#1a0a12" : D.chaos,
                    border: "1px solid rgba(244,114,182,0.4)",
                  }}
                >
                  {eng === "X01" ? "X01" : "Cricket"}
                </button>
              ))}
            </div>
          )}
        </div>

        <PrimaryButton disabled={!selectedTile} onClick={() => selectedTile && setStep("matchlength")}>
          Next — Match Length →
        </PrimaryButton>
      </div>
    );
  }

  // ── STEP 3: Match Length (legs or sets, same picker as Practice) ────────
  if (step === "matchlength") {
    return (
      <div style={{ maxWidth: "520px" }}>
        <BackButton onClick={() => setStep("gamemode")} />
        <StepHeader label="MATCH LENGTH" sub={<>{isChaos ? `${gameMode} · Chaos Mode` : gameMode} vs <strong style={{ color: "#fff" }}>{opponentLabel}</strong></>} />

        <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {([
            { key: "legs" as const, label: "Best of Legs" },
            { key: "sets" as const, label: "Sets" },
          ]).map(({ key, label }) => (
            <button key={key} onClick={() => setFormatMode(key)}
              className="flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all"
              style={{
                fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", cursor: "pointer",
                background: formatMode === key ? "rgba(255,210,74,0.15)" : "transparent",
                color: formatMode === key ? D.gold : "rgba(255,255,255,0.3)",
                border: formatMode === key ? "1px solid rgba(255,210,74,0.3)" : "1px solid transparent",
              }}>
              {label}
            </button>
          ))}
        </div>

        {formatMode === "legs" ? (
          <div style={{ marginBottom: "1.5rem" }}>
            <div className="text-xs mb-3" style={{ color: D.sub, fontFamily: "Oswald, sans-serif" }}>
              Best of how many legs?
            </div>
            <div className="flex gap-2 flex-wrap">
              {[1, 3, 5, 7, 9, 11].map(n => (
                <button key={n} onClick={() => setSelectedLegs(n)}
                  className="px-4 py-2 rounded-lg text-sm font-black uppercase transition-all"
                  style={{
                    fontFamily: "Oswald, sans-serif", cursor: "pointer",
                    background: selectedLegs === n ? "rgba(255,210,74,0.2)" : "rgba(255,255,255,0.04)",
                    color: selectedLegs === n ? D.gold : "rgba(255,255,255,0.4)",
                    border: selectedLegs === n ? `1px solid rgba(255,210,74,0.4)` : "1px solid rgba(255,255,255,0.07)",
                  }}>
                  {n === 1 ? "Single" : `BO${n}`}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4" style={{ marginBottom: "1.5rem" }}>
            <div>
              <div className="text-xs mb-2" style={{ color: D.sub, fontFamily: "Oswald, sans-serif" }}>Sets to win match</div>
              <div className="flex gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setSelectedSets(s => ({ ...s, sets: n }))}
                    className="w-10 h-10 rounded-lg text-sm font-black transition-all"
                    style={{
                      fontFamily: "Oswald, sans-serif", cursor: "pointer",
                      background: selectedSets.sets === n ? "rgba(255,210,74,0.2)" : "rgba(255,255,255,0.04)",
                      color: selectedSets.sets === n ? D.gold : "rgba(255,255,255,0.4)",
                      border: selectedSets.sets === n ? `1px solid rgba(255,210,74,0.4)` : "1px solid rgba(255,255,255,0.07)",
                    }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs mb-2" style={{ color: D.sub, fontFamily: "Oswald, sans-serif" }}>Legs per set</div>
              <div className="flex gap-1.5 flex-wrap">
                {[3, 5, 7].map(n => (
                  <button key={n} onClick={() => setSelectedSets(s => ({ ...s, legsPerSet: n }))}
                    className="w-10 h-10 rounded-lg text-sm font-black transition-all"
                    style={{
                      fontFamily: "Oswald, sans-serif", cursor: "pointer",
                      background: selectedSets.legsPerSet === n ? "rgba(255,210,74,0.2)" : "rgba(255,255,255,0.04)",
                      color: selectedSets.legsPerSet === n ? D.gold : "rgba(255,255,255,0.4)",
                      border: selectedSets.legsPerSet === n ? `1px solid rgba(255,210,74,0.4)` : "1px solid rgba(255,255,255,0.07)",
                    }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(255,210,74,0.05)", border: "1px solid rgba(255,210,74,0.15)", color: D.sub, fontFamily: "Oswald, sans-serif" }}>
                Best of {selectedSets.sets} sets · {selectedSets.legsPerSet} legs/set · First to {Math.ceil(selectedSets.sets / 2)} sets
              </div>
            </div>
          </div>
        )}

        {matchError && (
          <div style={{ marginBottom: "1rem", padding: "10px 14px", borderRadius: "10px", background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", color: "#ff8080", fontSize: "13px" }}>
            {matchError}
          </div>
        )}
        {isChaos ? (
          <>
            <div style={{ marginBottom: "1rem", padding: "10px 14px", borderRadius: "10px", background: "rgba(244,114,182,0.06)", border: "1px solid rgba(244,114,182,0.2)", color: "rgba(255,255,255,0.4)", fontSize: "12px", fontFamily: "Oswald, sans-serif" }}>
              🎲 No pre-match equipping — at the start of every visit you'll get 3 face-down cards. Pick one to reveal and it applies instantly.
            </div>
            <PrimaryButton disabled={startingChaos} onClick={handleStartChaos}>
              {startingChaos ? "Starting…" : "Start Chaos Match →"}
            </PrimaryButton>
          </>
        ) : (
          <PrimaryButton onClick={() => setStep("equipment-p1")}>
            Next — Equip Cards →
          </PrimaryButton>
        )}
      </div>
    );
  }

  // ── STEP 4a: Player 1 Equipment Selection ────────────────────────────────
  if (step === "equipment-p1") {
    return (
      <CardEquipmentSelector
        key="p1"
        currentPlayerId={currentPlayerId}
        currentPlayerName={currentPlayerName}
        opponentId={vsMode === "2p" ? selectedOpponent!.id : undefined}
        opponentName={opponentLabel}
        gameMode={gameMode!}
        testMode={vsMode === "bot"}
        onConfirm={handlePlayer1Equip}
        onBack={() => { setMatchError(null); setStep("matchlength"); }}
        submitError={matchError}
      />
    );
  }

  // ── STEP 4b: Player 2 Equipment Selection (2 Players only) ──────────────
  if (step === "equipment-p2") {
    return (
      <CardEquipmentSelector
        key="p2"
        currentPlayerId={selectedOpponent!.id}
        currentPlayerName={selectedOpponent!.name}
        opponentId={currentPlayerId}
        opponentName={currentPlayerName}
        gameMode={gameMode!}
        onConfirm={handlePlayer2Equip}
        onBack={() => { setMatchError(null); setStep("equipment-p1"); }}
        submitError={matchError}
      />
    );
  }

  // ── STEP 5: Live match ────────────────────────────────────────────────────
  if (step === "match") {
    const p1CardsWithUsed = player1Cards.map(c => ({ ...c, used: false }));
    const p2CardsWithUsed = player2Cards.map(c => ({ ...c, used: false }));

    // Render via createPortal to document.body so match is truly fullscreen
    return createPortal(
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#06040e" }}>
        <CardClashMatchScorer
          player1Id={currentPlayerId}
          player1Name={currentPlayerName}
          player2Id={vsMode === "2p" ? selectedOpponent!.id : -1}
          player2Name={opponentLabel!}
          gameMode={gameMode!}
          player1EquippedCards={p1CardsWithUsed}
          player2EquippedCards={p2CardsWithUsed}
          onMatchComplete={handleMatchComplete}
          onAbandon={handleAbandon}
          isBot={vsMode === "bot"}
          botConfig={resolvedBot?.config}
          legs={matchFormat.legs}
          setsToWin={matchFormat.setsToWin}
          legsToWinSet={matchFormat.legsToWinSet}
          chaosMode={isChaos}
        />
      </div>,
      document.body
    );
  }

  return null;
}
