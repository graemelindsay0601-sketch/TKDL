import React, { useState } from "react";
import { Sparkles, ShoppingCart, Zap } from "lucide-react";

interface Pack {
  id: string;
  name: string;
  cards: number;
  cost: number;
  value: string;
  bestseller?: boolean;
  bonus?: string;
}

interface CardShopUIProps {
  playerCoins: number;
  onPurchase: (packId: string) => Promise<void>;
  loading?: boolean;
}

const PACKS: Pack[] = [
  {
    id: "single",
    name: "Single Card",
    cards: 1,
    cost: 50,
    value: "1 Random Card",
  },
  {
    id: "five",
    name: "Starter Pack",
    cards: 5,
    cost: 200,
    value: "5 Random Cards",
    bonus: "15% Savings",
    bestseller: true,
  },
  {
    id: "ten",
    name: "Champion Pack",
    cards: 10,
    cost: 350,
    value: "10 Random Cards",
    bonus: "30% Savings",
  },
];

export function CardShopUI({ playerCoins, onPurchase, loading = false }: CardShopUIProps) {
  const [selectedPack, setSelectedPack] = useState<string>("five");
  const [purchasing, setPurchasing] = useState(false);
  const [justPurchased, setJustPurchased] = useState<string | null>(null);

  const handlePurchase = async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      await onPurchase(selectedPack);
      setJustPurchased(selectedPack);
      setTimeout(() => setJustPurchased(null), 2000);
    } finally {
      setPurchasing(false);
    }
  };

  const selectedPackData = PACKS.find((p) => p.id === selectedPack);
  const canAfford = selectedPackData ? playerCoins >= selectedPackData.cost : false;

  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "3rem",
          padding: "2rem 1rem",
          borderRadius: "12px",
          background: "linear-gradient(135deg, rgba(0,102,255,0.1) 0%, rgba(102,51,255,0.1) 100%)",
          border: "1px solid rgba(0,102,255,0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "1rem" }}>
          <ShoppingCart size={28} color="#0066ff" />
          <h2
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 900,
              color: "var(--color-text-primary)",
              fontFamily: "Oswald, sans-serif",
            }}
          >
            Card Shop
          </h2>
        </div>
        <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
          Expand your collection with premium card packs
        </p>
      </div>

      {/* Coin Balance */}
      <div
        style={{
          marginBottom: "2rem",
          padding: "1rem",
          background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
          borderRadius: "10px",
          textAlign: "center",
          boxShadow: "0 4px 12px rgba(255, 215, 0, 0.3)",
        }}
      >
        <p style={{ margin: "0 0 0.5rem 0", fontSize: "12px", color: "#8B6914", fontWeight: 600 }}>
          BALANCE
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "32px",
            fontWeight: 900,
            color: "#1a1a1a",
            fontFamily: "Oswald, sans-serif",
            letterSpacing: "0.05em",
          }}
        >
          {playerCoins} 🪙
        </p>
      </div>

      {/* Pack Selection */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
          marginBottom: "2rem",
        }}
      >
        {PACKS.map((pack) => {
          const isSelected = selectedPack === pack.id;
          const canAffordThisPack = playerCoins >= pack.cost;

          return (
            <div
              key={pack.id}
              onClick={() => setSelectedPack(pack.id)}
              style={{
                position: "relative",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                transform: isSelected ? "scale(1.05)" : "scale(1)",
              }}
            >
              {/* Bestseller Badge */}
              {pack.bestseller && (
                <div
                  style={{
                    position: "absolute",
                    top: "-12px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)",
                    color: "white",
                    padding: "4px 16px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    boxShadow: "0 4px 12px rgba(255, 107, 107, 0.3)",
                    zIndex: 10,
                  }}
                >
                  BESTSELLER
                </div>
              )}

              {/* Card */}
              <div
                style={{
                  padding: "24px",
                  borderRadius: "12px",
                  background: isSelected
                    ? "linear-gradient(135deg, #0066ff 0%, #0052cc 100%)"
                    : "var(--color-background-secondary)",
                  border: isSelected ? "3px solid #0066ff" : "2px solid var(--color-border-tertiary)",
                  boxShadow: isSelected
                    ? "0 0 30px rgba(0, 102, 255, 0.4), inset 0 0 20px rgba(0, 102, 255, 0.1)"
                    : "0 4px 12px rgba(0, 0, 0, 0.1)",
                  transition: "all 0.3s ease",
                  opacity: !canAffordThisPack ? 0.6 : 1,
                }}
              >
                {/* Card Icon */}
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "8px",
                    background: isSelected
                      ? "rgba(255, 255, 255, 0.15)"
                      : "var(--color-background-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1rem",
                    fontSize: "32px",
                  }}
                >
                  {pack.cards === 1 ? "🎴" : pack.cards === 5 ? "🎰" : "🏆"}
                </div>

                {/* Pack Name */}
                <h3
                  style={{
                    margin: "0 0 0.5rem 0",
                    fontSize: "18px",
                    fontWeight: 700,
                    color: isSelected ? "white" : "var(--color-text-primary)",
                    fontFamily: "Oswald, sans-serif",
                  }}
                >
                  {pack.name}
                </h3>

                {/* Cards Count */}
                <p
                  style={{
                    margin: "0 0 1rem 0",
                    fontSize: "14px",
                    color: isSelected ? "rgba(255,255,255,0.8)" : "var(--color-text-secondary)",
                    fontWeight: 500,
                  }}
                >
                  {pack.value}
                </p>

                {/* Bonus */}
                {pack.bonus && (
                  <div
                    style={{
                      marginBottom: "1rem",
                      background: isSelected ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 102, 255, 0.1)",
                      color: isSelected ? "white" : "#0066ff",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Zap size={12} />
                    {pack.bonus}
                  </div>
                )}

                {/* Cost */}
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 900,
                    color: isSelected ? "white" : "var(--color-text-primary)",
                    fontFamily: "Oswald, sans-serif",
                    letterSpacing: "0.05em",
                  }}
                >
                  {pack.cost} 🪙
                </div>
              </div>

              {/* Affordability Badge */}
              {!canAffordThisPack && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0, 0, 0, 0.5)",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    color: "white",
                    fontWeight: 700,
                    pointerEvents: "none",
                  }}
                >
                  INSUFFICIENT COINS
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Purchase Button */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <button
          onClick={handlePurchase}
          disabled={!canAfford || purchasing || loading}
          style={{
            flex: 1,
            padding: "16px 24px",
            borderRadius: "10px",
            border: "none",
            background: canAfford
              ? "linear-gradient(135deg, #0066ff 0%, #0052cc 100%)"
              : "linear-gradient(135deg, #666 0%, #555 100%)",
            color: "white",
            fontSize: "16px",
            fontWeight: 700,
            cursor: canAfford && !purchasing ? "pointer" : "not-allowed",
            transition: "all 0.3s ease",
            boxShadow: canAfford ? "0 6px 20px rgba(0, 102, 255, 0.3)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            letterSpacing: "0.05em",
          }}
          onMouseEnter={(e) => {
            if (canAfford && !purchasing) {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(0, 102, 255, 0.4)";
            }
          }}
          onMouseLeave={(e) => {
            if (canAfford && !purchasing) {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(0, 102, 255, 0.3)";
            }
          }}
        >
          {purchasing ? (
            <>
              <span
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid transparent",
                  borderTopColor: "white",
                  borderRadius: "50%",
                  animation: "spin 0.6s linear infinite",
                }}
              />
              Processing...
            </>
          ) : justPurchased === selectedPack ? (
            <>
              <Sparkles size={18} />
              Pack Acquired!
            </>
          ) : (
            <>
              <ShoppingCart size={18} />
              Purchase Pack
            </>
          )}
        </button>

        {/* Info */}
        <div
          style={{
            padding: "12px",
            background: "var(--color-background-tertiary)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "var(--color-text-secondary)",
            maxWidth: "200px",
          }}
        >
          <p style={{ margin: "0 0 6px 0", fontWeight: 600 }}>💡 Tips</p>
          <p style={{ margin: 0 }}>Complete challenges and matches to earn more coins!</p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
