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
  const [activeTab, setActiveTab] = useState<"overview" | "play" | "shop" | "standings">("overview");
  const [loading, setLoading] = useState(true);
  
  // Match flow state
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<number | null>(null);
  const [selectedGameMode, setSelectedGameMode] = useState<"X01" | "CRICKET" | null>(null);
  const [matchStarting, setMatchStarting] = useState(false);

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

      // Get player season stats and available opponents
      if (season?.id) {
        const statsRes = await fetch(`/api/card-clash/standings/${season.id}`);
        const standings = await statsRes.json();
        const playerStats = standings.find((s: any) => s.playerId === playerId);
        setSeasonStats(playerStats || { cardPoints: 0, wins: 0, losses: 0 });
        
        // Set available players (all except self)
        const otherPlayers = standings.filter((s: any) => s.playerId !== playerId);
        setAvailablePlayers(otherPlayers.slice(0, 20)); // Show top 20
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
            active={activeTab === "play"}
            onClick={() => setActiveTab("play")}
            label="Play"
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
        {activeTab === "play" && (
          <PlayTab 
            playerId={playerId} 
            availablePlayers={availablePlayers}
            selectedOpponent={selectedOpponent}
            setSelectedOpponent={setSelectedOpponent}
            selectedGameMode={selectedGameMode}
            setSelectedGameMode={setSelectedGameMode}
            matchStarting={matchStarting}
            setMatchStarting={setMatchStarting}
            seasonId={activeSeason?.id}
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

function PlayTab({
  playerId,
  availablePlayers,
  selectedOpponent,
  setSelectedOpponent,
  selectedGameMode,
  setSelectedGameMode,
  matchStarting,
  setMatchStarting,
  seasonId,
}: {
  playerId: number;
  availablePlayers: any[];
  selectedOpponent: number | null;
  setSelectedOpponent: (id: number | null) => void;
  selectedGameMode: "X01" | "CRICKET" | null;
  setSelectedGameMode: (mode: "X01" | "CRICKET" | null) => void;
  matchStarting: boolean;
  setMatchStarting: (bool: boolean) => void;
  seasonId?: number;
}) {
  const handleStartMatch = async () => {
    if (!selectedOpponent || !selectedGameMode || !seasonId) {
      alert("Please select an opponent and game mode");
      return;
    }

    setMatchStarting(true);
    try {
      const res = await fetch("/api/card-clash/match/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player1Id: playerId,
          player2Id: selectedOpponent,
          gameMode: selectedGameMode,
          equippedCards: [], // TODO: Get from equipment selector
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to start match");
      }

      const match = await res.json();
      // TODO: Navigate to match/scoring screen with matchId
      alert(`Match started! ID: ${match.id}`);
    } catch (error) {
      console.error("Error starting match:", error);
      alert("Failed to start match. Try again.");
    } finally {
      setMatchStarting(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px" }}>
      <div style={{ marginBottom: "2rem", padding: "1.5rem", background: "var(--color-background-secondary)", borderRadius: "8px" }}>
        <h3 style={{ marginBottom: "1.5rem", fontSize: "18px", fontWeight: 600 }}>Start a Match</h3>

        {/* Select Opponent */}
        <div style={{ marginBottom: "2rem" }}>
          <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "14px", fontWeight: 500 }}>
            Select Opponent
          </label>
          <div style={{
            maxHeight: "300px",
            overflowY: "auto",
            border: "1px solid var(--color-border-tertiary)",
            borderRadius: "6px",
          }}>
            {availablePlayers.length === 0 ? (
              <div style={{ padding: "1rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
                No other players in Card Clash yet
              </div>
            ) : (
              availablePlayers.map((player) => (
                <button
                  key={player.playerId}
                  onClick={() => setSelectedOpponent(player.playerId)}
                  style={{
                    width: "100%",
                    padding: "12px 1rem",
                    textAlign: "left",
                    border: "none",
                    borderBottom: "1px solid var(--color-border-tertiary)",
                    background: selectedOpponent === player.playerId 
                      ? "var(--color-background-info)" 
                      : "transparent",
                    cursor: "pointer",
                    transition: "background 0.2s",
                    fontSize: "14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>Player #{player.playerId}</span>
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    {player.wins}W-{player.losses}L
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Select Game Mode */}
        <div style={{ marginBottom: "2rem" }}>
          <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "14px", fontWeight: 500 }}>
            Select Game Mode
          </label>
          <div style={{ display: "flex", gap: "12px" }}>
            {["X01", "CRICKET"].map((mode) => (
              <button
                key={mode}
                onClick={() => setSelectedGameMode(mode as "X01" | "CRICKET")}
                style={{
                  flex: 1,
                  padding: "12px 1rem",
                  borderRadius: "6px",
                  border: selectedGameMode === mode 
                    ? "2px solid #0066ff" 
                    : "1px solid var(--color-border-tertiary)",
                  background: selectedGameMode === mode 
                    ? "rgba(0, 102, 255, 0.1)" 
                    : "transparent",
                  color: selectedGameMode === mode ? "#0066ff" : "var(--color-text-primary)",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 500,
                  transition: "all 0.2s",
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartMatch}
          disabled={!selectedOpponent || !selectedGameMode || matchStarting}
          style={{
            width: "100%",
            padding: "12px 1rem",
            borderRadius: "6px",
            border: "none",
            background: selectedOpponent && selectedGameMode && !matchStarting ? "#0066ff" : "#0066ff80",
            color: "white",
            fontSize: "14px",
            fontWeight: 600,
            cursor: selectedOpponent && selectedGameMode && !matchStarting ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}
        >
          {matchStarting ? "Starting Match..." : "Start Match"}
        </button>
      </div>

      {/* Info */}
      <div style={{ padding: "1rem", background: "var(--color-background-tertiary)", borderRadius: "6px", fontSize: "12px" }}>
        <p style={{ margin: "0 0 0.5rem 0" }}>
          <strong>Note:</strong> Cards are consumed when used in a match.
        </p>
        <p style={{ margin: 0 }}>
          Win or lose, you earn coins based on performance.
        </p>
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
