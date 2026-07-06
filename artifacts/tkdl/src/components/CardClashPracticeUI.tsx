/**
 * CardClashPracticeUI
 * Clean, standalone Card Clash practice interface
 * No mixed UI, no confusion - just practice against a bot, fully client-side
 * (no DB persistence - practice has no stakes, no leaderboard impact)
 */

import React, { useState } from "react";
import { CardEquipmentSelector } from "./CardEquipmentSelector";
import { ALL_CARDS } from "@/lib/cards-data";
import type { CardData } from "@/lib/cards-data";

interface Bot {
  id: string;
  name: string;
  avatar: string;
  description: string;
  skillLevel: number; // 1-10
}

interface Props {
  playerId: number;
  playerName: string;
  onMatchReady: (opts: {
    bot: Bot;
    gameMode: "X01" | "CRICKET";
    playerCards: CardData[];
    botCards: CardData[];
  }) => void;
}

type Step = "bot" | "gamemode" | "equipment";

const BOTS: Bot[] = [
  { id: "bot-rookie", name: "Rookie Bot", avatar: "🤖", description: "Fresh off the production line — makes weak card picks", skillLevel: 1 },
  { id: "bot-steady", name: "Steady Eddie", avatar: "🎯", description: "Consistent but unremarkable — a fair warmup", skillLevel: 3 },
  { id: "bot-sharp", name: "Sharp Shooter", avatar: "🔥", description: "Knows how to play a good card at the right time", skillLevel: 5 },
  { id: "bot-cyber", name: "Cyber Ace", avatar: "⚡", description: "Aggressive deck, favours rare cards", skillLevel: 7 },
  { id: "bot-mastermind", name: "Master Mind", avatar: "🧠", description: "Nearly unbeatable — stacks legendary cards", skillLevel: 9 },
  { id: "bot-legend", name: "Legend Bot", avatar: "👑", description: "The ultimate test. Only the best survive", skillLevel: 10 },
];

const GAMEMODES = [
  { id: "X01" as const, label: "X01", desc: "Standard darts format", emoji: "🎯" },
  { id: "CRICKET" as const, label: "Cricket", desc: "Strategic scoring", emoji: "🏏" },
];

function generateBotCards(bot: Bot, gameMode: "X01" | "CRICKET"): CardData[] {
  const pool = (cardType: "GOOD" | "BAD") =>
    ALL_CARDS.filter(c => c.category === `${gameMode} ${cardType}` || c.category === `WILDCARD ${cardType}`);

  const goodPool = pool("GOOD");
  const badPool = pool("BAD");

  // Higher skill -> more GOOD cards and a bias toward rarer cards
  const goodCount = Math.max(1, Math.min(3, Math.round((bot.skillLevel / 10) * 4)));
  const badCount = 4 - goodCount;

  const rarityWeight = (rarity: CardData["rarity"]) => {
    if (bot.skillLevel >= 8) return rarity === "LEGENDARY" ? 3 : rarity === "RARE" ? 2 : 1;
    if (bot.skillLevel >= 5) return rarity === "RARE" ? 2 : 1;
    return rarity === "COMMON" ? 2 : 1;
  };

  const weightedPick = (pool: CardData[], count: number): CardData[] => {
    const bag: CardData[] = [];
    for (const c of pool) {
      for (let i = 0; i < rarityWeight(c.rarity); i++) bag.push(c);
    }
    const picked: CardData[] = [];
    const used = new Set<number>();
    let attempts = 0;
    while (picked.length < count && attempts < 200 && bag.length > 0) {
      attempts++;
      const c = bag[Math.floor(Math.random() * bag.length)];
      if (!used.has(c.id)) {
        used.add(c.id);
        picked.push(c);
      }
    }
    return picked;
  };

  return [...weightedPick(goodPool, goodCount), ...weightedPick(badPool, badCount)];
}

export function CardClashPracticeUI({ playerId, playerName, onMatchReady }: Props) {
  const [step, setStep] = useState<Step>("bot");
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [selectedGameMode, setSelectedGameMode] = useState<"X01" | "CRICKET" | null>(null);

  const handleBotSelect = (bot: Bot) => {
    setSelectedBot(bot);
    setStep("gamemode");
  };

  const handleGameModeSelect = (id: "X01" | "CRICKET") => {
    setSelectedGameMode(id);
    setStep("equipment");
  };

  const handleEquipmentConfirm = (cards: CardData[]) => {
    if (!selectedBot || !selectedGameMode) return;
    const botCards = generateBotCards(selectedBot, selectedGameMode);
    onMatchReady({
      bot: selectedBot,
      gameMode: selectedGameMode,
      playerCards: cards,
      botCards,
    });
  };

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: SELECT BOT OPPONENT
  // ═══════════════════════════════════════════════════════════════════════
  if (step === "bot") {
    return (
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <div style={{
          borderRadius: "16px",
          background: "linear-gradient(135deg,rgba(0,200,150,0.1),rgba(0,150,120,0.05))",
          border: "1px solid rgba(0,200,150,0.2)",
          padding: "32px 24px",
          marginBottom: "24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎯</div>
          <h2 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 900, color: "#fff" }}>
            Card Clash Practice
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
            Test your deck against an AI opponent
          </p>
        </div>

        <div style={{ display: "grid", gap: "12px", marginBottom: "20px" }}>
          {BOTS.map(bot => (
            <button
              key={bot.id}
              onClick={() => handleBotSelect(bot)}
              style={{
                all: "unset",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px 20px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(0,200,150,0.12)";
                el.style.borderColor = "rgba(0,200,150,0.3)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(255,255,255,0.04)";
                el.style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              <div style={{ fontSize: "28px" }}>{bot.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{bot.name}</div>
                  <div style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    color: "#00cc66",
                    background: "rgba(0,200,100,0.15)",
                    padding: "2px 8px",
                    borderRadius: "10px",
                  }}>
                    SKILL {bot.skillLevel}/10
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{bot.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: SELECT GAME MODE
  // ═══════════════════════════════════════════════════════════════════════
  if (step === "gamemode") {
    return (
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <button
          onClick={() => setStep("bot")}
          style={{
            all: "unset",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.6)",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: "20px",
            transition: "all 0.2s",
          }}
        >
          ← BACK
        </button>

        <div style={{
          borderRadius: "16px",
          background: "linear-gradient(135deg,rgba(0,200,150,0.1),rgba(0,150,120,0.05))",
          border: "1px solid rgba(0,200,150,0.2)",
          padding: "28px 24px",
          marginBottom: "24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>{selectedBot?.avatar}</div>
          <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 900, color: "#fff" }}>
            Select Game Mode
          </h2>
          <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
            vs {selectedBot?.name}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          {GAMEMODES.map(gm => (
            <button
              key={gm.id}
              onClick={() => handleGameModeSelect(gm.id)}
              style={{
                all: "unset",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "20px 16px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "28px" }}>{gm.emoji}</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{gm.label}</div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{gm.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: EQUIPMENT SELECTION
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div>
      <button
        onClick={() => setStep("gamemode")}
        style={{
          all: "unset",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 16px",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.6)",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: "20px",
          transition: "all 0.2s",
        }}
      >
        ← BACK
      </button>

      <CardEquipmentSelector
        currentPlayerId={playerId}
        currentPlayerName={playerName}
        opponentName={selectedBot?.name}
        gameMode={selectedGameMode ?? "X01"}
        testMode={true}
        onBack={() => setStep("gamemode")}
        onConfirm={(cards) => handleEquipmentConfirm(cards)}
      />
    </div>
  );
}
