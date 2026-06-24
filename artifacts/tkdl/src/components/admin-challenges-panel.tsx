import React, { useState, useEffect } from "react";
import { Plus, RotateCcw, Check, Trash2, ChevronDown } from "lucide-react";

const getAdminHeaders = () => {
  const pin = sessionStorage.getItem("tkdl_admin_pin");
  return {
    "Content-Type": "application/json",
    ...(pin ? { "x-admin-pin": pin } : {}),
  };
};

interface Challenge {
  id: number;
  title: string;
  description: string | null;
  requirement_value: number;
  reward_coins: number;
}

interface Player {
  id: number;
  name: string;
}

export default function AdminChallengesPanel() {
  const [adminPin, setAdminPin] = useState(sessionStorage.getItem("tkdl_admin_pin") || "");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [dailyChallenges, setDailyChallenges] = useState<Challenge[]>([]);
  const [weeklyChallenges, setWeeklyChallenges] = useState<Challenge[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (adminPin) {
      sessionStorage.setItem("tkdl_admin_pin", adminPin);
      loadChallengeDefs();
      loadPlayers();
    }
  }, [adminPin]);

  const showMessage = (msg: string, type: "success" | "error" = "success") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 4000);
  };

  const loadPlayers = async () => {
    try {
      const res = await fetch("/api/players");
      if (res.ok) {
        const data = await res.json();
        setPlayers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to load players:", error);
    }
  };

  const loadChallengeDefs = async () => {
    try {
      const [dailyRes, weeklyRes] = await Promise.all([
        fetch("/api/challenges/admin/daily-definitions", { headers: getAdminHeaders() }),
        fetch("/api/challenges/admin/weekly-definitions", { headers: getAdminHeaders() }),
      ]);

      if (dailyRes.ok) setDailyChallenges(await dailyRes.json());
      if (weeklyRes.ok) setWeeklyChallenges(await weeklyRes.json());
    } catch (error) {
      showMessage("Failed to load challenge definitions", "error");
    }
  };

  const seedChallenges = async () => {
    try {
      const res = await fetch("/api/card-clash/admin/challenges/seed", {
        method: "POST",
        headers: getAdminHeaders(),
      });

      if (res.ok) {
        showMessage("✅ Challenges seeded successfully");
        loadChallengeDefs();
      } else {
        const error = await res.json();
        showMessage(`Failed: ${error.error}`, "error");
      }
    } catch (error) {
      showMessage(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    }
  };

  const resetDailyForPlayer = async () => {
    if (!selectedPlayerId) {
      showMessage("Select a player", "error");
      return;
    }

    try {
      const res = await fetch(`/api/challenges/admin/daily/reset/${selectedPlayerId}`, {
        method: "POST",
        headers: getAdminHeaders(),
      });

      if (res.ok) {
        showMessage(`✅ Reset daily challenges for player ${selectedPlayerId}`);
      } else {
        const error = await res.json();
        showMessage(`Failed: ${error.error}`, "error");
      }
    } catch (error) {
      showMessage(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    }
  };

  const resetWeeklyForPlayer = async () => {
    if (!selectedPlayerId) {
      showMessage("Select a player", "error");
      return;
    }

    try {
      const res = await fetch(`/api/challenges/admin/weekly/reset/${selectedPlayerId}`, {
        method: "POST",
        headers: getAdminHeaders(),
      });

      if (res.ok) {
        showMessage(`✅ Reset weekly challenges for player ${selectedPlayerId}`);
      } else {
        const error = await res.json();
        showMessage(`Failed: ${error.error}`, "error");
      }
    } catch (error) {
      showMessage(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    }
  };

  const addBonusDaily = async (challengeId: number) => {
    if (!selectedPlayerId) {
      showMessage("Select a player", "error");
      return;
    }

    try {
      const res = await fetch(`/api/challenges/admin/daily/bonus/${selectedPlayerId}`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ challengeId }),
      });

      if (res.ok) {
        showMessage(`✅ Added bonus daily challenge`);
      } else {
        const error = await res.json();
        showMessage(`Failed: ${error.error}`, "error");
      }
    } catch (error) {
      showMessage(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    }
  };

  const addBonusWeekly = async (challengeId: number) => {
    if (!selectedPlayerId) {
      showMessage("Select a player", "error");
      return;
    }

    try {
      const res = await fetch(`/api/challenges/admin/weekly/bonus/${selectedPlayerId}`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ challengeId }),
      });

      if (res.ok) {
        showMessage(`✅ Added bonus weekly challenge`);
      } else {
        const error = await res.json();
        showMessage(`Failed: ${error.error}`, "error");
      }
    } catch (error) {
      showMessage(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    }
  };

  const getPlayerName = (id: string) => {
    const player = players.find(p => p.id === parseInt(id));
    return player ? player.name : `Player ${id}`;
  };

  return (
    <div
      style={{
        background: "#ffffff",
        border: "2px solid #333",
        borderRadius: "1rem",
        padding: "1.5rem",
        marginTop: "1rem",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "1.25rem",
          fontWeight: 900,
          color: "#1a1a1a",
          marginBottom: expanded ? "1.5rem" : 0,
        }}
      >
        🎯 CHALLENGES ADMIN
        <span style={{ marginLeft: "auto", fontSize: "0.9rem" }}>{expanded ? "▼" : "▶"}</span>
      </button>

      {!expanded && <div style={{ marginTop: "1rem" }} />}

      {expanded && (
        <>
          {/* PIN Section */}
          <div
            style={{
              background: "#f0f0f0",
              border: "2px solid #3b82f6",
              borderRadius: "0.75rem",
              padding: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              🔐 Admin PIN
            </label>
            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="0601"
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid #ccc",
                borderRadius: "0.5rem",
                marginBottom: "0.5rem",
                fontFamily: "monospace",
              }}
            />
            <div style={{ fontSize: "0.85rem", color: "green" }}>✓ PIN saved in session</div>
          </div>

          {/* Player Selection */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              👤 Player
            </label>
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid #ccc",
                borderRadius: "0.5rem",
                fontFamily: "inherit",
              }}
            >
              <option value="">-- Select a player --</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} (ID: {player.id})
                </option>
              ))}
            </select>
          </div>

          {/* Seed Section */}
          <div
            style={{
              background: "#f0f0f0",
              border: "2px solid #10b981",
              borderRadius: "0.75rem",
              padding: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "0.75rem", color: "#059669" }}>🌱 Seed Challenges</div>
            <button
              onClick={seedChallenges}
              style={{
                background: "#10b981",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: 600,
                width: "100%",
              }}
            >
              Seed All Challenges (8 Daily + 6 Weekly)
            </button>
          </div>
          {message && (
            <div
              style={{
                background: messageType === "success" ? "#d1fae5" : "#fee2e2",
                color: messageType === "success" ? "#065f46" : "#991b1b",
                padding: "0.75rem",
                borderRadius: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              {message}
            </div>
          )}

          {/* Daily Challenges */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ marginBottom: "0.75rem", fontWeight: 600, display: "flex", gap: "0.5rem" }}>
              <RotateCcw size={18} /> Daily Challenges
            </h3>

            <button
              onClick={resetDailyForPlayer}
              style={{
                background: "#f97316",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                cursor: "pointer",
                marginBottom: "1rem",
                fontWeight: 600,
              }}
            >
              Reroll Daily Challenges
            </button>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              {dailyChallenges.map((challenge) => (
                <div
                  key={challenge.id}
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{challenge.title}</div>
                  <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                    {challenge.description}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#999", marginBottom: "0.5rem" }}>
                    Goal: {challenge.requirement_value} · Reward: +{challenge.reward_coins} coins
                  </div>
                  <button
                    onClick={() => addBonusDaily(challenge.id)}
                    style={{
                      background: "#10b981",
                      color: "white",
                      border: "none",
                      padding: "0.4rem 0.8rem",
                      borderRadius: "0.35rem",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      width: "100%",
                    }}
                  >
                    <Plus size={14} style={{ marginRight: "0.25rem" }} /> Add Bonus
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Challenges */}
          <div>
            <h3 style={{ marginBottom: "0.75rem", fontWeight: 600, display: "flex", gap: "0.5rem" }}>
              <RotateCcw size={18} /> Weekly Challenges
            </h3>

            <button
              onClick={resetWeeklyForPlayer}
              style={{
                background: "#f97316",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                cursor: "pointer",
                marginBottom: "1rem",
                fontWeight: 600,
              }}
            >
              Reroll Weekly Challenges
            </button>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              {weeklyChallenges.map((challenge) => (
                <div
                  key={challenge.id}
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{challenge.title}</div>
                  <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                    {challenge.description}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#999", marginBottom: "0.5rem" }}>
                    Goal: {challenge.requirement_value} · Reward: +{challenge.reward_coins} coins
                  </div>
                  <button
                    onClick={() => addBonusWeekly(challenge.id)}
                    style={{
                      background: "#0066ff",
                      color: "white",
                      border: "none",
                      padding: "0.4rem 0.8rem",
                      borderRadius: "0.35rem",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      width: "100%",
                    }}
                  >
                    <Plus size={14} style={{ marginRight: "0.25rem" }} /> Add Bonus
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
