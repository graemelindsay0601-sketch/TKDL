import React, { useEffect, useState } from "react";
import { Coins } from "lucide-react";

interface CoinBalanceProps {
  playerId: number;
}

export function CoinBalance({ playerId }: CoinBalanceProps) {
  const [coins, setCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const loadCoins = () => {
    fetch(`/api/card-clash/shop/currency/${playerId}`)
      .then((r) => r.json())
      .then((data) => {
        setCoins(data.cardPoints ?? 0);
        setLoading(false);
      })
      .catch((e) => {
        console.error("Failed to load coins:", e);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadCoins();
    // Refresh periodically to catch updates from purchases/rewards made
    // elsewhere. Was every 2 seconds (30x/minute per viewer) -- a coin
    // balance doesn't need sub-5-second precision, and that was a real,
    // avoidable, continuous source of database load for anyone sitting on
    // this page. 15 seconds still feels responsive while cutting the
    // request volume by ~87%.
    const interval = setInterval(loadCoins, 15000);
    return () => clearInterval(interval);
  }, [playerId]);

  // No loading gate here on purpose — this used to return null entirely
  // while the first fetch was in flight, so the whole widget blinked into
  // existence a beat after the Account page rendered. Showing the shell
  // immediately with a placeholder for the number, then swapping in the
  // real value, avoids that pop without displaying a possibly-wrong "0".
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
        <div style={{ fontSize: "0.8rem", color: "rgba(255,212,74,0.7)" }}>Coins</div>
        <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#ffd24a" }}>{loading ? "—" : coins}</div>
      </div>
    </div>
  );
}
