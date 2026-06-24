import React, { useState, useEffect } from "react";
import { Banknote, Gamepad2, TrendingUp } from "lucide-react";
import { useFeatureFlags, FeatureGate } from "@/lib/useFeatureFlags";
import { useCurrentPlayer } from "@/context/auth";

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
  const [activeTab, setActiveTab] = useState<"overview" | "shop" | "standings">("overview");
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
    <div style={{ padding: "2rem" }}>
      {/* Header */}
      <div
        style={{
          marginBottom: "2rem",
          paddingBottom: "1.5rem",
          borderBottom: "1px solid var(--color-border-tertiary)",
        }}
      >
        <h1 style={{ fontSize: "28px", fontWeight: 500, margin: "0 0 0.5rem 0" }}>
          🎴 Card Clash
        </h1>
        {activeSeason && (
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", margin: 0 }}>
            {activeSeason.name}
          </p>
        )}
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "12px",
          marginBottom: "2rem",
        }}
      >
        <StatCard label="Coins" value={currency.cardPoints} icon={<Banknote size={20} />} />
        <StatCard label="Season Points" value={seasonStats?.cardPoints || 0} icon={<TrendingUp size={20} />} />
        <StatCard label="Wins" value={seasonStats?.wins || 0} icon={<Gamepad2 size={20} />} />
        <StatCard
          label="Losses"
          value={seasonStats?.losses || 0}
          icon={<span style={{ fontSize: "16px" }}>📉</span>}
        />
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--color-border-tertiary)" }}>
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            label="Overview"
          />
          <TabButton
            active={activeTab === "shop"}
            onClick={() => setActiveTab("shop")}
            label="Pack Shop"
          />
          <TabButton
            active={activeTab === "standings"}
            onClick={() => setActiveTab("standings")}
            label="Standings"
          />
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && <OverviewTab season={activeSeason} stats={seasonStats} />}
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
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--color-background-secondary)",
        padding: "1rem",
        borderRadius: "var(--border-radius-md)",
        border: "0.5px solid var(--color-border-tertiary)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <div style={{ color: "var(--color-text-secondary)", fontSize: "16px" }}>{icon}</div>
        <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: 0 }}>
          {label}
        </p>
      </div>
      <p style={{ fontSize: "20px", fontWeight: 500, margin: 0 }}>{value}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        borderBottom: active ? "2px solid var(--color-text-primary)" : "none",
        color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
        padding: "8px 16px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: active ? 500 : 400,
        transition: "color 0.2s",
      }}
    >
      {label}
    </button>
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
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async (packType: "SINGLE" | "FIVE" | "TEN") => {
    try {
      setPurchasing(true);
      const res = await fetch("/api/card-clash/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, packType }),
      });

      if (res.ok) {
        alert("Pack purchased! Cards added to inventory.");
        onPurchase();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert("Failed to purchase pack");
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
      }}
    >
      <PackCard
        title="Single Pack"
        cost={50}
        cards={1}
        isDisabled={purchasing}
        onClick={() => handlePurchase("SINGLE")}
      />
      <PackCard
        title="5-Pack"
        cost={200}
        cards={5}
        bonus="+5% Rarity Boost"
        isDisabled={purchasing}
        onClick={() => handlePurchase("FIVE")}
      />
      <PackCard
        title="10-Pack"
        cost={350}
        cards={10}
        bonus="+10% Rarity Boost"
        isDisabled={purchasing}
        onClick={() => handlePurchase("TEN")}
      />
    </div>
  );
}

function PackCard({
  title,
  cost,
  cards,
  bonus,
  isDisabled,
  onClick,
}: {
  title: string;
  cost: number;
  cards: number;
  bonus?: string;
  isDisabled: boolean;
  onClick: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--color-background-secondary)",
        padding: "1.5rem",
        borderRadius: "var(--border-radius-lg)",
        border: "0.5px solid var(--color-border-tertiary)",
        textAlign: "center",
      }}
    >
      <h3 style={{ fontSize: "16px", fontWeight: 500, margin: "0 0 8px 0" }}>
        {title}
      </h3>
      <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: "0 0 12px 0" }}>
        {cards} {cards === 1 ? "Card" : "Cards"}
      </p>
      {bonus && (
        <p style={{ fontSize: "12px", color: "var(--color-text-info)", margin: "0 0 12px 0" }}>
          {bonus}
        </p>
      )}
      <button
        onClick={onClick}
        disabled={isDisabled}
        style={{
          width: "100%",
          padding: "10px",
          background: "var(--color-background-info)",
          color: "var(--color-text-info)",
          border: "0.5px solid var(--color-border-info)",
          borderRadius: "var(--border-radius-md)",
          cursor: isDisabled ? "not-allowed" : "pointer",
          fontSize: "14px",
          fontWeight: 500,
          opacity: isDisabled ? 0.5 : 1,
        }}
      >
        {cost} 🪙
      </button>
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
              <td style={{ padding: "8px" }}>Player #{standing.playerId}</td>
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
