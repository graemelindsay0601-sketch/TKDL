import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Banknote, Gamepad2, TrendingUp } from "lucide-react";
import { useFeatureFlags, FeatureGate } from "@/lib/useFeatureFlags";
import { useCurrentPlayer } from "@/context/auth";
import { CardEquipmentSelector } from "@/components/CardEquipmentSelector";
import { CardShopUI } from "@/components/CardShopUI";
import { CardInventory } from "@/components/CardInventory";
import { CardClashMatchLauncher } from "@/components/CardClashMatchLauncher";

interface Season {
  id: number;
  name: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

interface Currency {
  cardPoints: number;
  lifetimeCoinsEarned: number;
}

interface SeasonStats {
  cardPoints: number;
  wins: number;
  losses: number;
  rank?: number;
}

export default function CardClashPage() {
  const currentPlayer = useCurrentPlayer();
  const playerId = currentPlayer?.id;
  const playerName = currentPlayer?.name || "Player";
  
  const { isCardClashAvailable, isCoinsAvailable, isCardShopAvailable, isLoading } = useFeatureFlags();
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [currency, setCurrency] = useState<Currency>({ cardPoints: 0, lifetimeCoinsEarned: 0 });
  const [seasonStats, setSeasonStats] = useState<SeasonStats | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "play" | "shop" | "standings">("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (playerId) {
      loadData();
    }
  }, [playerId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get active season
      const seasonRes = await fetch("/api/card-clash/season/active");
      const season = await seasonRes.json();
      setActiveSeason(season);

      // Get player currency
      const currencyRes = await fetch(`/api/card-clash/shop/currency/${playerId}`);
      const curr = await currencyRes.json();
      setCurrency(curr);

      // Get player season stats
      if (season?.id) {
        const statsRes = await fetch(`/api/card-clash/standings/${season.id}`);
        const standings = await statsRes.json();
        const playerStats = standings.find((s: any) => s.playerId === playerId);
        setSeasonStats(playerStats || { cardPoints: 0, wins: 0, losses: 0 });
      }
    } catch (error) {
      console.error("Failed to load Card Clash data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading Card Clash data...</p>
      </div>
    );
  }

  // Check if Card Clash is available
  if (!isCardClashAvailable) {
    return (
      <div style={{ padding: "2rem" }}>
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            background: "var(--color-background-secondary)",
            borderRadius: "var(--border-radius-lg)",
            border: "1px dashed var(--color-border-tertiary)",
          }}
        >
          <h2 style={{ fontSize: "24px", fontWeight: "600", margin: "0 0 12px 0" }}>
            🎴 Card Clash
          </h2>
          <p style={{ fontSize: "16px", color: "var(--color-text-secondary)", margin: 0 }}>
            This feature is coming soon! Check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Hero Section */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(0, 102, 255, 0.15) 0%, rgba(102, 51, 255, 0.15) 100%)",
          borderRadius: "16px",
          padding: "2.5rem 2rem",
          marginBottom: "2rem",
          border: "2px solid rgba(0, 102, 255, 0.2)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background decoration */}
        <div
          style={{
            position: "absolute",
            top: "-150px",
            right: "-150px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 102, 255, 0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "0.5rem" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                background: "linear-gradient(135deg, #0066ff 0%, #0052cc 100%)",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
                boxShadow: "0 8px 20px rgba(0, 102, 255, 0.3)",
              }}
            >
              🎴
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "36px",
                  fontWeight: 900,
                  fontFamily: "Oswald, sans-serif",
                  letterSpacing: "0.03em",
                  color: "var(--color-text-primary)",
                }}
              >
                CARD CLASH
              </h1>
              <p
                style={{
                  margin: "0.5rem 0 0 0",
                  fontSize: "14px",
                  color: "var(--color-text-secondary)",
                  fontWeight: 500,
                }}
              >
                {activeSeason?.name || "Collect cards, compete, and earn rewards"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
          marginBottom: "2rem",
        }}
      >
        <StatCard label="Your Points" value={seasonStats?.cardPoints || 0} icon={<TrendingUp size={20} />} highlight />
        <StatCard label="Wins" value={seasonStats?.wins || 0} icon={<Gamepad2 size={20} />} />
        <StatCard label="Coins" value={currency.cardPoints} icon={<Banknote size={20} />} highlight />
        <StatCard
          label="Losses"
          value={seasonStats?.losses || 0}
          icon={<span style={{ fontSize: "18px" }}>📉</span>}
        />
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: "2rem" }}>
        <div 
          style={{ 
            display: "flex", 
            gap: "2px", 
            borderBottom: "3px solid var(--color-border-tertiary)",
            overflowX: "auto",
            scrollBehavior: "smooth",
          }}
        >
          {[
            { id: "overview", label: "Overview" },
            { id: "play", label: "Play" },
            { id: "shop", label: "Pack Shop" },
            { id: "standings", label: "Standings" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "14px 18px",
                border: "none",
                background: activeTab === tab.id ? "#0066ff" : "transparent",
                color: activeTab === tab.id ? "white" : "var(--color-text-secondary)",
                fontSize: "13px",
                fontWeight: activeTab === tab.id ? 700 : 600,
                fontFamily: "Oswald, sans-serif",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                borderRadius: "8px 8px 0 0",
                marginBottom: "-3px",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(0, 102, 255, 0.1)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ paddingBottom: "2rem" }}>
        {activeTab === "overview" && <OverviewTab season={activeSeason} stats={seasonStats} />}
        {activeTab === "play" && (
          <CardClashMatchLauncher
            currentPlayerId={playerId}
            currentPlayerName={playerName}
            onMatchComplete={() => {
              setActiveTab("standings");
              loadData();
            }}
          />
        )}
        {activeTab === "shop" && (
          <FeatureGate
            featureName="Card Shop"
            isAvailable={isCardShopAvailable}
            fallback="The Card Shop is not yet available. Check back soon!"
          >
            <ShopTab playerId={playerId} onPurchase={loadData} />
          </FeatureGate>
        )}
        {activeTab === "standings" && activeSeason && <StandingsTab seasonId={activeSeason.id} />}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: highlight
          ? "linear-gradient(135deg, rgba(0, 102, 255, 0.1) 0%, rgba(0, 102, 255, 0.05) 100%)"
          : "var(--color-background-secondary)",
        padding: "16px",
        borderRadius: "12px",
        border: highlight ? "2px solid rgba(0, 102, 255, 0.3)" : "1px solid var(--color-border-tertiary)",
        boxShadow: highlight ? "0 0 20px rgba(0, 102, 255, 0.1)" : "none",
        transition: "all 0.3s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = highlight
          ? "0 4px 24px rgba(0, 102, 255, 0.2)"
          : "0 2px 8px rgba(0, 0, 0, 0.1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = highlight
          ? "0 0 20px rgba(0, 102, 255, 0.1)"
          : "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <div style={{ color: highlight ? "#0066ff" : "var(--color-text-secondary)", fontSize: "18px" }}>
          {icon}
        </div>
        <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </p>
      </div>
      <p
        style={{
          fontSize: "28px",
          fontWeight: 900,
          margin: 0,
          color: highlight ? "#0066ff" : "var(--color-text-primary)",
          fontFamily: "Oswald, sans-serif",
          letterSpacing: "0.02em",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function OverviewTab({
  season,
  stats,
}: {
  season: Season | null;
  stats: SeasonStats | null;
}) {
  return (
    <div>
      <div
        style={{
          background: "var(--color-background-secondary)",
          padding: "1.5rem",
          borderRadius: "var(--border-radius-lg)",
          border: "0.5px solid var(--color-border-tertiary)",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: 500, marginTop: 0 }}>📊 Current Season</h3>
        {season ? (
          <div>
            <p style={{ margin: "8px 0", fontSize: "14px" }}>
              <strong>Season:</strong> {season.name}
            </p>
            <p style={{ margin: "8px 0", fontSize: "14px" }}>
              <strong>Started:</strong> {new Date(season.startDate).toLocaleDateString()}
            </p>
            <p style={{ margin: "8px 0", fontSize: "14px" }}>
              <strong>Ends:</strong> {new Date(season.endDate).toLocaleDateString()}
            </p>
            {stats && (
              <>
                <p style={{ margin: "8px 0", fontSize: "14px" }}>
                  <strong>Your Points:</strong> {stats.cardPoints}
                </p>
                <p style={{ margin: "8px 0", fontSize: "14px" }}>
                  <strong>Record:</strong> {stats.wins}W - {stats.losses}L
                </p>
              </>
            )}
          </div>
        ) : (
          <p style={{ color: "var(--color-text-secondary)" }}>No active season</p>
        )}
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 500 }}>🎯 How Card Clash Works</h3>
        <div style={{ fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: "1.6" }}>
          <p>
            <strong>Buy Packs:</strong> Purchase card packs with coins earned from matches.
          </p>
          <p>
            <strong>Equip Cards:</strong> Before each Card Clash match, equip 2 GOOD and 2 BAD cards.
          </p>
          <p>
            <strong>Play & Earn:</strong> Win matches to earn points and climb the leaderboard.
          </p>
          <p>
            <strong>Collect Cards:</strong> Build your card collection across 100+ unique cards.
          </p>
        </div>
      </div>
    </div>
  );
}

function ShopTab({
  playerId,
  onPurchase,
}: {
  playerId: number;
  onPurchase: () => void;
}) {
  const [currency, setCurrency] = useState<any>({ cardPoints: 0 });
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [playerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const currencyRes = await fetch(`/api/card-clash/shop/currency/${playerId}`);
      const curr = await currencyRes.json();
      setCurrency(curr);

      const inventoryRes = await fetch(`/api/card-clash/inventory/${playerId}`);
      const inv = await inventoryRes.json();
      setInventory(inv.cards || []);
    } catch (error) {
      console.error("Failed to load shop data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packId: string) => {
    const packMap: Record<string, string> = {
      single: "SINGLE",
      five: "FIVE",
      ten: "TEN",
    };

    try {
      const res = await fetch("/api/card-clash/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, packType: packMap[packId] }),
      });

      if (res.ok) {
        await loadData();
        onPurchase();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert("Failed to purchase pack");
    }
  };

  return (
    <div style={{ paddingBottom: "2rem" }}>
      {/* Shop Section */}
      <div style={{ marginBottom: "3rem" }}>
        <CardShopUI
          playerCoins={currency.cardPoints || 0}
          onPurchase={handlePurchase}
          loading={loading}
        />
      </div>

      {/* Inventory Section */}
      <div style={{ marginTop: "3rem", paddingTop: "2rem", borderTop: "1px solid var(--color-border-tertiary)" }}>
        <h3
          style={{
            fontSize: "20px",
            fontWeight: 700,
            marginBottom: "1.5rem",
            fontFamily: "Oswald, sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          Your Collection
        </h3>
        <CardInventory cards={inventory} loading={loading} />
      </div>
    </div>
  );
}


function StandingsTab({ seasonId }: { seasonId: number }) {
  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStandings();
  }, [seasonId]);

  const loadStandings = async () => {
    try {
      const res = await fetch(`/api/card-clash/standings/${seasonId}`);
      const data = await res.json();
      setStandings(data);
    } catch (error) {
      console.error("Failed to load standings:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p>Loading standings...</p>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: "14px", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            <th style={{ textAlign: "left", padding: "8px", fontWeight: 500 }}>Rank</th>
            <th style={{ textAlign: "left", padding: "8px", fontWeight: 500 }}>Player</th>
            <th style={{ textAlign: "center", padding: "8px", fontWeight: 500 }}>Points</th>
            <th style={{ textAlign: "center", padding: "8px", fontWeight: 500 }}>Wins</th>
            <th style={{ textAlign: "center", padding: "8px", fontWeight: 500 }}>Losses</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing, index) => (
            <tr
              key={standing.id}
              style={{
                borderBottom: "0.5px solid var(--color-border-tertiary)",
                background: index < 3 ? "var(--color-background-info)" : "transparent",
              }}
            >
              <td style={{ padding: "8px" }}>
                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
              </td>
              <td style={{ padding: "8px" }}>
                {standing.playerName || `Player ${standing.playerId}`}
              </td>
              <td style={{ textAlign: "center", padding: "8px" }}>{standing.cardPoints}</td>
              <td style={{ textAlign: "center", padding: "8px" }}>{standing.wins}</td>
              <td style={{ textAlign: "center", padding: "8px" }}>{standing.losses}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
