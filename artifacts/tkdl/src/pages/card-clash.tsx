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

    Promise.all([
      fetch("/api/card-clash/season/active").then((r) => r.json()),
      fetch(`/api/card-clash/standings?season=current`).then((r) => r.json()).catch(() => []),
      fetch(`/api/card-clash/player/${playerId}/stats`).then((r) => r.json()).catch(() => ({})),
    ])
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
    <div style={{ padding: "0", maxWidth: "100%", margin: "0", background: "linear-gradient(180deg, rgba(20,10,40,0.8), rgba(10,5,20,0.9))" }}>
      {/* HERO SECTION - Professional Large Header */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(255,212,74,0.25) 0%, rgba(0,229,255,0.15) 50%, rgba(255,80,100,0.1) 100%)",
          borderBottom: "3px solid rgba(255,212,74,0.4)",
          padding: "3rem 2rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Animated background effect */}
        <div
          style={{
            position: "absolute",
            top: "-50%",
            right: "-10%",
            width: "600px",
            height: "600px",
            background: "radial-gradient(circle, rgba(255,212,74,0.1) 0%, transparent 70%)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: "1400px", margin: "0 auto", position: "relative", zIndex: 2 }}>
          {/* Main Title */}
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "64px", textShadow: "0 0 20px rgba(255,212,74,0.6)" }}>🎴</div>
              <div>
                <h1 style={{ 
                  fontSize: "48px", 
                  fontWeight: "800", 
                  margin: "0",
                  background: "linear-gradient(135deg, #ffd24a 0%, #00e5ff 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                }}>CARD CLASH</h1>
                <p style={{ 
                  fontSize: "16px", 
                  color: "rgba(255,255,255,0.7)", 
                  margin: "8px 0 0 0",
                  fontStyle: "italic",
                }}>
                  Collect legendary cards • Master tactical effects • Clash with style
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", 
            gap: "16px",
            marginTop: "2rem",
          }}>
            <StatBoxPro title="ACTIVE SEASON" value={season?.name || "Loading..."} color="#ffd24a" icon="📅" />
            <StatBoxPro title="CARD COINS" value={stats?.coins?.toString() || "0"} color="#00e5ff" icon="💎" />
            <StatBoxPro title="COLLECTION" value={(stats?.cardsOwned || 0) + "/100"} color="#00ff88" icon="📚" />
            <StatBoxPro title="MATCHES" value={stats?.matchesPlayed || "0"} color="#ff6b6b" icon="⚔️" />
          </div>
        </div>
      </div>

      {/* TAB NAVIGATION - Professional Styling */}
      <div style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "0 2rem",
        display: "flex",
        gap: "12px",
        marginTop: "2rem",
        overflowX: "auto",
        borderBottom: "2px solid rgba(255,212,74,0.2)",
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: "16px 28px",
              background: activeTab === tab.id 
                ? "linear-gradient(135deg, rgba(255,212,74,0.3), rgba(0,229,255,0.2))"
                : "transparent",
              border: activeTab === tab.id 
                ? "2px solid rgba(255,212,74,0.6)"
                : "2px solid rgba(255,255,255,0.1)",
              color: activeTab === tab.id ? "#ffd24a" : "rgba(255,255,255,0.6)",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: "700",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              textDecoration: "none",
              whiteSpace: "nowrap",
              boxShadow: activeTab === tab.id ? "0 0 20px rgba(255,212,74,0.3)" : "none",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "rgba(255,212,74,0.4)";
                el.style.color = "rgba(255,255,255,0.8)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "rgba(255,255,255,0.1)";
                el.style.color = "rgba(255,255,255,0.6)";
              }
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT AREA */}
      <div style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "2rem",
        minHeight: "calc(100vh - 300px)",
      }}>
        {/* Tab Content */}
        <div style={{
          background: "rgba(0,0,0,0.3)",
          borderRadius: "16px",
          padding: "2.5rem",
          border: "1px solid rgba(255,212,74,0.15)",
          marginTop: "2rem",
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

function StatBoxPro({ title, value, color, icon }: { title: string; value: string | number; color: string; icon: string }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`,
      border: `2px solid ${color}40`,
      borderRadius: "14px",
      padding: "24px 20px",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
      transition: "all 0.3s ease",
      boxShadow: `0 0 20px ${color}20`,
    }}>
      {/* Gradient accent */}
      <div
        style={{
          position: "absolute",
          top: "-50%",
          right: "-50%",
          width: "200px",
          height: "200px",
          background: `radial-gradient(circle, ${color}30, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      
      <div style={{ position: "relative", zIndex: 2 }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>{icon}</div>
        <div style={{ 
          fontSize: "11px", 
          color: "rgba(255,255,255,0.6)", 
          marginBottom: "8px", 
          textTransform: "uppercase",
          letterSpacing: "1px",
          fontWeight: "700",
        }}>
          {title}
        </div>
        <div style={{ 
          fontSize: "32px", 
          fontWeight: "800", 
          color: color,
          textShadow: `0 0 10px ${color}60`,
        }}>
          {value}
        </div>
      </div>
    </div>
  );
}
