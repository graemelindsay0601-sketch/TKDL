import React, { useState, useEffect } from "react";
import { useCurrentPlayer } from "@/context/auth";
import { ShoppingCart, Zap, Trophy, BookOpen, Coins } from "lucide-react";
import { CardShopUI } from "@/components/CardShopUI";
import { CardCollectionBook } from "@/components/CardCollectionBook";
import { CoinBalance } from "@/components/CoinBalance";
import { CardEquipmentIntegration } from "@/components/CardEquipmentIntegration";
import { PlayerChallenges } from "@/components/PlayerChallenges";

export default function CardClashPage() {
  const currentPlayer = useCurrentPlayer();
  const playerId = currentPlayer?.playerId;

  const [activeTab, setActiveTab] = useState<"overview" | "shop" | "collection" | "play" | "standings">("overview");
  const [season, setSeason] = useState<any>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);

    // First get active season
    fetch("/api/card-clash/season/active")
      .then((r) => r.json())
      .then((season) => {
        setSeason(season);
        // Then fetch standings using the season ID
        return Promise.all([
          Promise.resolve(season),
          season?.id 
            ? fetch(`/api/card-clash/standings/${season.id}`).then((r) => r.json()).catch(() => [])
            : Promise.resolve([]),
          fetch(`/api/card-clash/player/${playerId}/stats`).then((r) => r.json()).catch(() => ({})),
        ]);
      })
      .then(([s, st, stats]) => {
        setSeason(s);
        setStandings(Array.isArray(st) ? st : st?.standings || []);
        setStats(stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [playerId]);

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
        Loading Card Clash...
      </div>
    );
  }

  if (!currentPlayer || !playerId) {
    console.error("Card Clash auth failed:", { currentPlayer, playerId });
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: "1rem" }}>
          Authentication issue - please try logging out and back in
        </div>
        <button
          onClick={() => window.location.href = "/login"}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#ffd24a",
            color: "#000",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Go to Login
        </button>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "🎴 Overview", icon: "📊" },
    { id: "shop", label: "🛍️ Shop", icon: "💳" },
    { id: "collection", label: "📚 Collection", icon: "🃏" },
    { id: "play", label: "⚡ Play", icon: "🎮" },
    { id: "standings", label: "🏆 Standings", icon: "📈" },
  ] as const;

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Hero Section */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(255,212,74,0.15), rgba(0,229,255,0.15))",
          borderRadius: "16px",
          padding: "2.5rem 2rem",
          marginBottom: "2rem",
          border: "2px solid rgba(255,212,74,0.3)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1rem" }}>
            <div style={{ fontSize: "48px" }}>🎴</div>
            <div>
              <h1 style={{ fontSize: "32px", fontWeight: "700", margin: "0", color: "#ffd24a" }}>Card Clash</h1>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", margin: "4px 0 0 0" }}>
                Collect, equip, and clash with tactical card effects
              </p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginTop: "1.5rem" }}>
            <StatBox title="Season" value={season?.name || "Waiting..."} color="#ffd24a" />
            <StatBox title="Your Coins" value={stats?.coins || "0"} color="#00ff88" />
            <StatBox title="Cards Owned" value={stats?.cardsOwned || "0"} color="#00e5ff" />
            <StatBox title="Matches Played" value={stats?.matchesPlayed || "0"} color="#ff6b6b" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: "flex",
        gap: "8px",
        marginBottom: "2rem",
        borderBottom: "2px solid rgba(255,255,255,0.1)",
        overflowX: "auto",
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: "12px 20px",
              background: activeTab === tab.id ? "rgba(255,212,74,0.2)" : "transparent",
              border: activeTab === tab.id ? "2px solid #ffd24a" : "2px solid transparent",
              color: activeTab === tab.id ? "#ffd24a" : "rgba(255,255,255,0.6)",
              borderRadius: "8px 8px 0 0",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "all 0.2s",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                const el = e.currentTarget as HTMLElement;
                el.style.color = "rgba(255,255,255,0.8)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                const el = e.currentTarget as HTMLElement;
                el.style.color = "rgba(255,255,255,0.6)";
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{
        background: "rgba(0,0,0,0.2)",
        borderRadius: "12px",
        padding: "2rem",
        border: "1px solid rgba(255,255,255,0.1)",
      }}>
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gap: "2rem" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "1rem", color: "#ffd24a" }}>
                Welcome to Card Clash!
              </h2>
              <div style={{
                background: "rgba(255,212,74,0.1)",
                border: "1px solid rgba(255,212,74,0.3)",
                borderRadius: "8px",
                padding: "16px",
                fontSize: "14px",
                color: "rgba(255,255,255,0.8)",
                lineHeight: "1.6",
              }}>
                <p>
                  🎴 <strong>Collect Cards</strong> - Buy card packs in the Shop tab to build your collection
                </p>
                <p>
                  ⚡ <strong>Equip Cards</strong> - Select up to 4 cards (2 good + 2 bad) before each match
                </p>
                <p>
                  🎮 <strong>Play Matches</strong> - Launch Card Clash matches and use card effects during gameplay
                </p>
                <p>
                  🏆 <strong>Earn Rewards</strong> - Win matches to earn coins and climb the seasonal leaderboard
                </p>
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "1rem", color: "#ffd24a" }}>
                Your Progress
              </h2>
              <CoinBalance playerId={playerId} />
              <div style={{ marginTop: "1rem" }}>
                <PlayerChallenges playerId={playerId} />
              </div>
            </div>
          </div>
        )}

        {/* Shop Tab */}
        {activeTab === "shop" && (
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "1rem", color: "#ffd24a" }}>
              Card Shop
            </h2>
            <CardShopUI playerId={playerId} />
          </div>
        )}

        {/* Collection Tab */}
        {activeTab === "collection" && (
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "1rem", color: "#ffd24a" }}>
              Your Collection
            </h2>
            <CardCollectionBook playerId={playerId} />
          </div>
        )}

        {/* Play Tab */}
        {activeTab === "play" && (
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "1rem", color: "#ffd24a" }}>
              Play Card Clash
            </h2>
            <CardEquipmentIntegration playerId={playerId} />
          </div>
        )}

        {/* Standings Tab */}
        {activeTab === "standings" && (
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "1rem", color: "#ffd24a" }}>
              Seasonal Standings
            </h2>
            {standings.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid rgba(255,212,74,0.3)" }}>
                      <th style={{ padding: "12px", textAlign: "left", color: "#ffd24a", fontWeight: "600" }}>Rank</th>
                      <th style={{ padding: "12px", textAlign: "left", color: "#ffd24a", fontWeight: "600" }}>Player</th>
                      <th style={{ padding: "12px", textAlign: "center", color: "#ffd24a", fontWeight: "600" }}>Points</th>
                      <th style={{ padding: "12px", textAlign: "center", color: "#ffd24a", fontWeight: "600" }}>Wins</th>
                      <th style={{ padding: "12px", textAlign: "center", color: "#ffd24a", fontWeight: "600" }}>Losses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((player, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.1)",
                          background: player.playerId === playerId ? "rgba(255,212,74,0.1)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "12px", color: "#ffd24a", fontWeight: "700" }}>{idx + 1}</td>
                        <td style={{ padding: "12px", color: "#fff" }}>{player.playerName}</td>
                        <td style={{ padding: "12px", textAlign: "center", color: "#00e5ff", fontWeight: "600" }}>
                          {player.points || 0}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center", color: "#00ff88" }}>
                          {player.wins || 0}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center", color: "#ff6b6b" }}>
                          {player.losses || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "2rem" }}>
                No standings data yet
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: `${color}15`,
      border: `1px solid ${color}`,
      borderRadius: "8px",
      padding: "16px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", marginBottom: "8px", textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ fontSize: "24px", fontWeight: "700", color: color }}>
        {value}
      </div>
    </div>
  );
}
