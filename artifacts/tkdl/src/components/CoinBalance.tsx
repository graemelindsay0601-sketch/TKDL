import React, { useEffect, useState } from "react";
import { Coins } from "lucide-react";

interface CoinBalanceProps {
  playerId: number;
}

export function CoinBalance({ playerId }: CoinBalanceProps) {
  const [coins, setCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/card-clash/shop/currency/${playerId}`)
      .then((r) => r.json())
      .then((data) => {
        setCoins(data.cardPoints ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [playerId]);

  if (loading) return null;

  return (
    <div
      style={{
        background: "rgba(255,212,74,0.1)",
        border: "1px solid rgba(255,212,74,0.3)",
        borderRadius: "0.5rem",
        padding: "0.75rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        marginBottom: "1rem",
      }}
    >
      <Coins size={20} style={{ color: "#ffd24a" }} />
      <div>
        <div style={{ fontSize: "0.8rem", color: "rgba(255,212,74,0.7)" }}>Card Coins</div>
        <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#ffd24a" }}>{coins}</div>
      </div>
    </div>
  );
}
