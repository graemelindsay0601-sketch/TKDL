import React, { useState, useEffect, useRef } from "react";
import { Sparkles, ShoppingCart, Zap } from "lucide-react";
import { ALL_CARDS } from "@/lib/cards-data";
import { TKDLCard } from "./TKDLCard";

interface Pack {
  id: string;
  name: string;
  cards: number;
  cost: number;
  value: string;
  icon: string;
  bestseller?: boolean;
  bonus?: string;
}

interface PurchasedCard {
  cardId: string;
  name: string;
  rarity: "COMMON" | "RARE" | "LEGENDARY";
  gameMode?: string;
}

export interface CardShopUIProps {
  playerId: number;
  onCardsReceived?: (cardNames: string[]) => void;
}

const PACKS: Pack[] = [
  { id: "single",  name: "Single Card",    cards: 1,  cost: 50,  value: "1 Random Card",   icon: "🎴" },
  { id: "five",    name: "Starter Pack",   cards: 5,  cost: 200, value: "5 Random Cards",  icon: "🎰", bestseller: true, bonus: "15% Savings" },
  { id: "ten",     name: "Champion Pack",  cards: 10, cost: 350, value: "10 Random Cards", icon: "🏆", bonus: "30% Savings" },
];

const RAR_COLOR: Record<string, string> = { COMMON: "#9ab0c4", RARE: "#00b4ff", LEGENDARY: "#ffaa00" };
const RAR_GLOW:  Record<string, string> = { COMMON: "rgba(154,176,196,0.3)", RARE: "rgba(0,180,255,0.4)", LEGENDARY: "rgba(255,170,0,0.5)" };

export function CardShopUI({ playerId, onCardsReceived }: CardShopUIProps) {
  const [selectedPack, setSelectedPack] = useState<string>("five");
  const [purchasing, setPurchasing] = useState(false);
  const [playerCoins, setPlayerCoins] = useState(0);
  const [loading, setLoading] = useState(true);

  // Pack opening overlay state
  const [opening, setOpening] = useState(false);
  const [openingCards, setOpeningCards] = useState<PurchasedCard[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [phase, setPhase] = useState<"pack" | "reveal" | "done">("pack");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playerId) return;
    fetch(`/api/card-clash/shop/currency/${playerId}`)
      .then(r => r.json())
      .then(d => { setPlayerCoins(d.cardPoints ?? 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [playerId]);

  // Card reveal stagger
  useEffect(() => {
    if (phase !== "reveal" || openingCards.length === 0) return;
    if (revealedCount >= openingCards.length) { setPhase("done"); return; }
    const t = setTimeout(() => setRevealedCount(n => n + 1), 420);
    return () => clearTimeout(t);
  }, [phase, revealedCount, openingCards.length]);

  const handlePurchase = async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      const r = await fetch("/api/card-clash/shop/purchase", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, packType: selectedPack.toUpperCase() }),
      });
      if (!r.ok) { const e = await r.json(); alert(`Purchase failed: ${e.error}`); return; }
      const result = await r.json();
      const cards: PurchasedCard[] = result.cardsGenerated ?? [];
      setOpeningCards(cards);
      setRevealedCount(0);
      setPhase("pack");
      setOpening(true);
      // Refresh coins
      const cRes = await fetch(`/api/card-clash/shop/currency/${playerId}`);
      const cData = await cRes.json();
      setPlayerCoins(cData.cardPoints ?? 0);
      // Transition to card reveal after pack animation
      setTimeout(() => setPhase("reveal"), 1400);
    } catch { alert("Failed to purchase pack"); } finally { setPurchasing(false); }
  };

  const handleClaim = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setOpening(false);
    setOpeningCards([]);
    setRevealedCount(0);
    setPhase("pack");
    if (onCardsReceived) onCardsReceived(openingCards.map(c => c.name));
  };

  const selectedPackData = PACKS.find(p => p.id === selectedPack);
  const canAfford = selectedPackData ? playerCoins >= selectedPackData.cost : false;

  return (
    <div style={{ maxWidth: "900px" }}>
      {/* Coin balance pill */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "rgba(255,210,74,0.12)", border: "1px solid rgba(255,210,74,0.35)", borderRadius: "12px", padding: "12px 20px", marginBottom: "2rem" }}>
        <span style={{ fontSize: "22px" }}>🪙</span>
        <div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}>YOUR COINS</div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#ffd24a", lineHeight: 1.1 }}>{loading ? "…" : playerCoins.toLocaleString()}</div>
        </div>
      </div>

      {/* Pack cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "16px", marginBottom: "1.5rem" }}>
        {PACKS.map(pack => {
          const sel = selectedPack === pack.id;
          const canAffordThis = playerCoins >= pack.cost;
          return (
            <div key={pack.id} onClick={() => setSelectedPack(pack.id)} style={{ position: "relative", cursor: "pointer", transition: "transform 0.2s", transform: sel ? "scale(1.03)" : "scale(1)" }}>
              {pack.bestseller && (
                <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,#ff6b6b,#ff8e53)", color: "#fff", padding: "3px 14px", borderRadius: "20px", fontSize: "10px", fontWeight: 800, letterSpacing: "0.05em", zIndex: 10 }}>
                  BESTSELLER
                </div>
              )}
              <div style={{ padding: "22px", borderRadius: "12px", border: sel ? "2px solid rgba(0,180,255,0.7)" : "1px solid rgba(255,255,255,0.08)", background: sel ? "linear-gradient(135deg,rgba(0,60,120,0.5),rgba(0,40,80,0.5))" : "rgba(255,255,255,0.03)", boxShadow: sel ? "0 0 30px rgba(0,180,255,0.2)" : "none", transition: "all 0.2s", opacity: canAffordThis ? 1 : 0.5 }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>{pack.icon}</div>
                <div style={{ fontSize: "16px", fontWeight: 800, color: sel ? "#00e5ff" : "#fff", marginBottom: "4px" }}>{pack.name}</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "12px" }}>{pack.value}</div>
                {pack.bonus && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(0,180,255,0.1)", border: "1px solid rgba(0,180,255,0.25)", borderRadius: "6px", padding: "3px 10px", fontSize: "10px", fontWeight: 700, color: "#00b4ff", marginBottom: "12px" }}>
                    <Zap size={10} /> {pack.bonus}
                  </div>
                )}
                <div style={{ fontSize: "22px", fontWeight: 900, color: "#ffd24a" }}>{pack.cost} 🪙</div>
                {!canAffordThis && (
                  <div style={{ marginTop: "8px", fontSize: "10px", color: "#ff6b6b", fontWeight: 700, letterSpacing: "0.05em" }}>INSUFFICIENT COINS</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Buy button */}
      <button
        onClick={handlePurchase}
        disabled={!canAfford || purchasing || loading}
        style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 32px", borderRadius: "10px", border: "none", cursor: canAfford && !purchasing ? "pointer" : "not-allowed", fontWeight: 800, fontSize: "15px", letterSpacing: "0.06em", transition: "all 0.2s", background: canAfford ? "linear-gradient(135deg,#0080ff,#0040c0)" : "rgba(255,255,255,0.08)", color: canAfford ? "#fff" : "rgba(255,255,255,0.3)", boxShadow: canAfford ? "0 6px 24px rgba(0,128,255,0.35)" : "none" }}
      >
        {purchasing ? <><Spinner /> Opening Pack…</> : <><ShoppingCart size={18} /> Buy Pack — {selectedPackData?.cost ?? 0} 🪙</>}
      </button>

      {/* ─── PACK OPENING OVERLAY ─── */}
      {opening && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.94)", backdropFilter: "blur(12px)" }}>
          <style>{`
            @keyframes packPulse { 0%,100%{transform:scale(1) rotate(-2deg);filter:brightness(1)} 50%{transform:scale(1.12) rotate(2deg);filter:brightness(1.4)} }
            @keyframes packExplode { 0%{transform:scale(1);opacity:1} 100%{transform:scale(2.5);opacity:0} }
            @keyframes cardIn { from{transform:translateY(40px) scale(0.8);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
            @keyframes shimmer { 0%,100%{opacity:0.5} 50%{opacity:1} }
          `}</style>

          {phase === "pack" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
              <div style={{ fontSize: "100px", animation: "packPulse 0.7s ease-in-out infinite" }}>📦</div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#fff", letterSpacing: "0.1em", animation: "shimmer 0.8s ease-in-out infinite" }}>OPENING PACK…</div>
            </div>
          )}

          {(phase === "reveal" || phase === "done") && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", maxWidth: "1200px", width: "100%", padding: "0 24px" }}>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#fff", letterSpacing: "0.12em" }}>
                🎴 YOU GOT <span style={{ color: "#ffd24a" }}>{openingCards.length} CARD{openingCards.length !== 1 ? "S" : ""}</span>!
              </div>

              {/* Cards grid */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "center" }}>
                {openingCards.map((card, i) => {
                  const fullCard = ALL_CARDS.find(c => c.name === card.name);
                  const revealed = i < revealedCount;
                  const color = RAR_COLOR[card.rarity] ?? "#9ab0c4";
                  const glow  = RAR_GLOW[card.rarity]  ?? "rgba(154,176,196,0.3)";
                  return (
                    <div key={i} style={{ opacity: revealed ? 1 : 0, animation: revealed ? "cardIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      {fullCard ? (
                        <TKDLCard card={fullCard} size="sm" locked={false} />
                      ) : (
                        <div style={{ width: "110px", height: "154px", borderRadius: "10px", background: `linear-gradient(135deg,${color}22,${color}11)`, border: `2px solid ${color}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: `0 0 20px ${glow}`, padding: "12px" }}>
                          <div style={{ fontSize: "28px" }}>🎴</div>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: "#fff", textAlign: "center", letterSpacing: "0.05em" }}>{card.name}</div>
                        </div>
                      )}
                      <div style={{ fontSize: "10px", fontWeight: 800, color, letterSpacing: "0.1em", padding: "2px 8px", borderRadius: "10px", background: `${color}22`, border: `1px solid ${color}44` }}>{card.rarity}</div>
                    </div>
                  );
                })}
              </div>

              {phase === "done" && (
                <button onClick={handleClaim} style={{ marginTop: "8px", padding: "14px 40px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#00b4ff,#0066cc)", color: "#fff", fontWeight: 900, fontSize: "16px", cursor: "pointer", letterSpacing: "0.08em", boxShadow: "0 6px 24px rgba(0,180,255,0.4)" }}>
                  <Sparkles size={16} style={{ display: "inline", marginRight: "8px" }} />
                  Claim Cards!
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Spinner() {
  return <span style={{ width: "16px", height: "16px", border: "2px solid transparent", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />;
}
