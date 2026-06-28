import React, { useState, useEffect } from "react";
import { ALL_CARDS } from "@/lib/cards-data";
import { TKDLCard } from "./TKDLCard";

interface PurchasedCard {
  cardId: string;
  name: string;
  rarity: "COMMON" | "RARE" | "LEGENDARY";
  gameMode?: string;
}

export interface CardShopUIProps {
  playerId: number;
  onCardsReceived?: (cardNames: string[]) => void;
  freePacks?: Array<{ id: number; packName: string; earned_reason?: string }>;
  onFreePackOpened?: () => void;
}

type Phase = "shop" | "preview" | "tearing" | "cards" | "done";

// ── TKDL-themed pack definitions ───────────────────────────────────────────────
const PACK_DEFS = [
  {
    id: "single",
    name: "Standard Pull",
    label: "STANDARD",
    sub: "1 CARD",
    cards: 1,
    cost: 50,
    ribbon: null,
    desc: "One dart from the oche. One card. Step up.",
    bodyDark:    "#07111f",
    bodyMid:     "#10243e",
    bodyHigh:    "#193a60",
    stripDark:   "#060f1a",
    stripMid:    "#0e1f38",
    accent:      "#7eb8d4",
    accentBright:"#b2daf0",
    glow:        "rgba(126,184,212,0.55)",
    tier:        "silver" as const,
  },
  {
    id: "five",
    name: "Kilbirnie Night",
    label: "KILBIRNIE NIGHT",
    sub: "5 CARDS",
    cards: 5,
    cost: 200,
    ribbon: "MOST POPULAR",
    desc: "Five cards from a Thursday night at Kilbirnie. Anything can happen.",
    bodyDark:    "#1a0c00",
    bodyMid:     "#301800",
    bodyHigh:    "#4a2600",
    stripDark:   "#160a00",
    stripMid:    "#3c1e00",
    accent:      "#ffd24a",
    accentBright:"#ffe97e",
    glow:        "rgba(255,210,74,0.6)",
    tier:        "gold" as const,
  },
  {
    id: "ten",
    name: "Legend Vault",
    label: "LEGEND VAULT",
    sub: "10 CARDS",
    cards: 10,
    cost: 350,
    ribbon: "BEST VALUE",
    desc: "Ten cards from the vault. 5% Legendary rate. Pity after 50 pulls.",
    bodyDark:    "#08001a",
    bodyMid:     "#160040",
    bodyHigh:    "#280068",
    stripDark:   "#060014",
    stripMid:    "#1a004e",
    accent:      "#cc44ff",
    accentBright:"#e57fff",
    glow:        "rgba(204,68,255,0.6)",
    tier:        "legendary" as const,
  },
];

const RARITY_GLOW:  Record<string,string> = { LEGENDARY: "#ffaa00", RARE: "#a855f7", COMMON: "#7eb8d4" };
const RARITY_LABEL: Record<string,string> = { LEGENDARY: "✦ LEGENDARY ✦", RARE: "◆ RARE ◆", COMMON: "COMMON" };

// ── SVG pack art — proper TCG-style metallic packs ─────────────────────────────
  // ── Pack art (per-tier images) ─────────────────────────────────────────────────
function PackArt({ packId, isPreview }: { packId: string; isPreview: boolean }) {
  const W = isPreview ? 174 : 108;
  const H = isPreview ? 280 : 174;
  const PACK_IMGS: Record<string,string> = {
    single: "/assets/pack-league-front.png",
    five:   "/assets/pack-gold-front.png",
    ten:    "/assets/pack-purple-front.png",
  };
  const src = PACK_IMGS[packId] ?? PACK_IMGS.single;
  return (
    <div style={{ width: W, height: H, position: "relative", overflow: "hidden", borderRadius: 8 }}>
      <img src={src} alt={packId} loading="lazy"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", maxWidth: "none" }}
      />
    </div>
  );
}

// ── TKDL card back ─────────────────────────────────────────────────────────────
function CardBack({ accent = "#7eb8d4" }: { accent?: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", borderRadius: "12px",
      background: "linear-gradient(155deg,#060d1c 0%,#0c1e3c 50%,#060d1c 100%)",
      border: `2px solid ${accent}40`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: "18px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.05, backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,0.6) 0,rgba(255,255,255,0.6) 1px,transparent 0,transparent 50%)", backgroundSize: "18px 18px" }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 42%,${accent}18 0%,transparent 62%)` }} />
      {(["tl","tr","bl","br"] as const).map(c => (
        <div key={c} style={{ position: "absolute", [c[0]==="t"?"top":"bottom"]: "14px", [c[1]==="l"?"left":"right"]: "14px", width: "18px", height: "18px", borderTop: c[0]==="t" ? `2px solid ${accent}50` : undefined, borderBottom: c[0]==="b" ? `2px solid ${accent}50` : undefined, borderLeft: c[1]==="l" ? `2px solid ${accent}50` : undefined, borderRight: c[1]==="r" ? `2px solid ${accent}50` : undefined }} />
      ))}
      <div style={{ fontSize: "42px", filter: `drop-shadow(0 0 18px ${accent}99)`, zIndex: 1 }}>🎴</div>
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "0.35em", color: accent, textShadow: `0 0 24px ${accent}`, fontFamily: "'Arial Black',Impact,sans-serif" }}>TKDL</div>
        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.24)", letterSpacing: "0.22em", marginTop: "5px", fontFamily: "Arial,sans-serif" }}>CARD CLASH</div>
      </div>
    </div>
  );
}

function Spinner() {
  return <span style={{ width: "15px", height: "15px", border: "2px solid transparent", borderTopColor: "currentColor", borderRadius: "50%", animation: "ccSpin 0.65s linear infinite", display: "inline-block" }} />;
}

// ── Main ───────────────────────────────────────────────────────────────────────
export const CardShopUI = React.memo(
  function CardShopUI({ playerId, onCardsReceived, freePacks, onFreePackOpened }: CardShopUIProps) {
  const [selectedPack, setSelectedPack] = useState("five");
  const [purchasing, setPurchasing] = useState(false);
  const [playerCoins, setPlayerCoins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("shop");
  const [openingCards, setOpeningCards] = useState<PurchasedCard[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [canAdvance, setCanAdvance] = useState(false);
  const [legendaryFlash, setLegendaryFlash] = useState(false);
  const [openingFreePackId, setOpeningFreePackId] = useState<number | null>(null);

  const refreshCoins = () =>
    fetch(`/api/card-clash/shop/currency/${playerId}`).then(r => r.json()).then(d => setPlayerCoins(d.cardPoints ?? 0)).catch(() => {});

  useEffect(() => {
    if (!playerId) return;
    fetch(`/api/card-clash/shop/currency/${playerId}`)
      .then(r => r.json())
      .then(d => { setPlayerCoins(d.cardPoints ?? 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [playerId]);

  const packDef  = PACK_DEFS.find(p => p.id === selectedPack) ?? PACK_DEFS[1];
  const canAfford = playerCoins >= packDef.cost;

  const startReveal = (cards: PurchasedCard[]) => {
    setOpeningCards(cards); setCurrentIdx(0);
    setIsFlipped(false); setCanAdvance(false);
    setPhase("preview");
  };

  const handleBuy = async () => {
    if (!canAfford || purchasing) return;
    setPurchasing(true);
    try {
      const r = await fetch("/api/card-clash/shop/purchase", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, packType: selectedPack.toUpperCase() }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Purchase failed"); }
      const result = await r.json();
      const cards: PurchasedCard[] = result.cardsGenerated ?? result.cards ?? [];
      onCardsReceived?.(cards.map(c => c.name));
      refreshCoins();
      startReveal(cards);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Purchase failed");
    } finally { setPurchasing(false); }
  };

  const handleOpenFreePack = async (packId: number) => {
    setOpeningFreePackId(packId);
    try {
      const r = await fetch(`/api/card-clash/pack-inventory/${packId}/open`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await r.json();
      if (data.cards?.length > 0) {
        onCardsReceived?.(data.cards.map((c: any) => c.name));
        onFreePackOpened?.();
        startReveal(data.cards);
      }
    } catch {} finally { setOpeningFreePackId(null); }
  };

  const handleOpenPack = () => {
    if (phase !== "preview") return;
    setPhase("tearing");
    setTimeout(() => { setCurrentIdx(0); setIsFlipped(false); setCanAdvance(false); setPhase("cards"); }, 950);
  };

  const handleFlipCard = () => {
    if (isFlipped) return;
    setIsFlipped(true);
    const r = openingCards[currentIdx]?.rarity;
    if (r === "LEGENDARY")     { setLegendaryFlash(true); setTimeout(() => setLegendaryFlash(false), 1300); setTimeout(() => setCanAdvance(true), 3400); }
    else if (r === "RARE")     { setTimeout(() => setCanAdvance(true), 2000); }
    else                       { setTimeout(() => setCanAdvance(true), 1100); }
  };

  const handleNextCard = () => {
    if (currentIdx >= openingCards.length - 1) { setPhase("done"); }
    else { setCurrentIdx(i => i + 1); setIsFlipped(false); setCanAdvance(false); }
  };

  const currentRaw  = openingCards[currentIdx];
  const currentFull = currentRaw
    ? (ALL_CARDS.find(c => c.name === currentRaw.name) ?? { id: 0, name: currentRaw.name, category: "WILDCARD GOOD" as const, rarity: currentRaw.rarity, effect: "", flavourText: "", energyCost: 1 })
    : null;

  return (
    <div style={{ position: "relative", fontFamily: "'Arial Black',Impact,Arial,sans-serif" }}>
      <style>{`
        @keyframes ccSpin       { to{transform:rotate(360deg)} }
        @keyframes packFloat    { 0%,100%{transform:translateY(0) rotate(-1.2deg)} 50%{transform:translateY(-18px) rotate(1.2deg)} }
        @keyframes packTear     { 0%{transform:translateY(0) rotate(0);opacity:1} 20%{transform:translateY(-28px) rotate(-4deg);opacity:1} 100%{transform:translateY(-560px) rotate(-32deg);opacity:0} }
        @keyframes bounceIn     { from{transform:translateY(50px) scale(0.8);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
        @keyframes flashScreen  { 0%{opacity:0} 14%{opacity:.72} 55%{opacity:.4} 100%{opacity:0} }
        @keyframes legendPulse  { 0%,100%{box-shadow:0 0 32px #ffaa00,0 0 70px #ffaa0044} 50%{box-shadow:0 0 80px #ffaa00,0 0 160px #ffaa0066} }
        @keyframes rarePulse    { 0%,100%{box-shadow:0 0 22px #a855f7,0 0 50px #a855f730} 50%{box-shadow:0 0 55px #a855f7,0 0 110px #a855f755} }
        @keyframes pipPulse     { 0%,100%{opacity:1} 50%{opacity:0.38} }
        @keyframes rainbow      { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes fadeUp       { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes selectPop    { 0%{transform:scale(1)} 50%{transform:scale(1.07)} 100%{transform:scale(1)} }
        @keyframes packShimmer  { 0%{transform:translateX(-120%) skewX(-20deg)} 100%{transform:translateX(320%) skewX(-20deg)} }
      `}</style>

      {/* ── SHOP ── */}
      {phase === "shop" && (
        <div style={{ animation: "fadeUp 0.3s ease" }}>

          {/* Free achievement packs */}
          {freePacks && freePacks.length > 0 && (
            <div style={{ marginBottom: "28px", padding: "0", background: "linear-gradient(135deg,rgba(0,255,136,0.12),rgba(0,200,100,0.06))", border: "2px solid rgba(0,255,136,0.35)", borderRadius: "16px", overflow: "hidden" }}>
              {/* Header bar with gradient */}
              <div style={{ padding: "16px 20px", background: "linear-gradient(90deg,rgba(0,255,136,0.2),rgba(0,255,136,0.08))", borderBottom: "1px solid rgba(0,255,136,0.2)", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ fontSize: "24px" }}>🎁</div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 900, color: "#00ff88", letterSpacing: "0.06em" }}>CLAIM FREE PACKS</div>
                  <div style={{ fontSize: "11px", color: "rgba(0,255,136,0.65)", marginTop: "2px", fontWeight: 500 }}>You have {freePacks.length} reward{freePacks.length !== 1 ? 's' : ''} waiting</div>
                </div>
              </div>
              
              {/* Packs list */}
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {freePacks.map((pk, idx) => (
                  <div key={pk.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", padding: "14px 16px", background: "linear-gradient(135deg,rgba(0,255,136,0.08),rgba(0,255,136,0.02))", border: "1.5px solid rgba(0,255,136,0.25)", borderRadius: "12px", transition: "all 0.3s", animation: `slideIn 0.5s ease ${idx * 0.1}s both` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                      <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "linear-gradient(135deg,rgba(0,255,136,0.25),rgba(0,200,100,0.15))", border: "1.5px solid rgba(0,255,136,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
                        {pk.packName.includes("Single") ? "1️⃣" : pk.packName.includes("5-Pack") ? "5️⃣" : pk.packName.includes("10-Pack") ? "🔟" : "📦"}
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: "#fff", fontFamily: "Arial,sans-serif", marginBottom: "4px" }}>{pk.packName}</div>
                        <div style={{ fontSize: "12px", color: "rgba(0,255,136,0.7)", fontFamily: "Arial,sans-serif", fontWeight: 500 }}>{pk.earned_reason?.replace("ACHIEVEMENT:", "") ?? "Achievement reward"}</div>
                      </div>
                    </div>
                    <button
                      disabled={openingFreePackId === pk.id}
                      onClick={() => handleOpenFreePack(pk.id)}
                      style={{ padding: "10px 20px", background: openingFreePackId === pk.id ? "rgba(0,255,136,0.15)" : "linear-gradient(135deg,rgba(0,255,136,0.35),rgba(0,255,136,0.2))", border: "1.5px solid rgba(0,255,136,0.5)", borderRadius: "10px", color: "#fff", fontWeight: 900, fontSize: "13px", cursor: openingFreePackId === pk.id ? "not-allowed" : "pointer", letterSpacing: "0.06em", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.3s", boxShadow: openingFreePackId !== pk.id ? "0 4px 12px rgba(0,255,136,0.15)" : "none" }}
                    >
                      {openingFreePackId === pk.id ? "⏳ Opening…" : "✨ OPEN"}
                    </button>
                  </div>
                ))}
              </div>
              <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}`}</style>
            </div>
          )}

          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px" }}>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em" }}>SELECT A PACK</div>
            <div style={{ background: "linear-gradient(135deg,rgba(255,210,74,0.16),rgba(255,140,0,0.08))", border: "1px solid rgba(255,210,74,0.32)", borderRadius: "20px", padding: "7px 20px", fontSize: "16px", fontWeight: 900, color: "#ffd24a", letterSpacing: "0.05em" }}>
              🪙 {loading ? "…" : playerCoins.toLocaleString()}
            </div>
          </div>

          {/* Pack selection grid */}
          <div style={{ display: "flex", gap: "22px", justifyContent: "center", marginBottom: "26px", flexWrap: "wrap" }}>
            {PACK_DEFS.map(p => {
              const sel = selectedPack === p.id;
              return (
                <div key={p.id} onClick={() => setSelectedPack(p.id)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", position: "relative" }}>
                  {p.ribbon && (
                    <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: `linear-gradient(90deg,${p.accent},${p.accentBright},${p.accent})`, color: "#000", fontSize: "8px", fontWeight: 900, padding: "3px 14px", borderRadius: "10px", letterSpacing: "0.14em", zIndex: 20, whiteSpace: "nowrap", boxShadow: `0 0 14px ${p.glow}` }}>{p.ribbon}</div>
                  )}
                  <div style={{
                    outline: sel ? `2px solid ${p.accent}` : "2px solid transparent",
                    outlineOffset: "5px", borderRadius: "14px",
                    transition: "all 0.2s",
                    transform: sel ? "scale(1.07)" : "scale(1)",
                    boxShadow: sel ? `0 0 32px ${p.glow}, 0 0 64px ${p.glow.replace("0.6","0.2")}` : "none",
                    position: "relative", overflow: "hidden",
                  }}>
                    <PackArt packId={p.id} isPreview={false} />
                    {/* Shimmer on hover for selected */}
                    {sel && (
                      <div style={{ position: "absolute", top: 0, left: 0, width: "40px", height: "100%", background: `linear-gradient(90deg,transparent,${p.accentBright}22,transparent)`, animation: "packShimmer 2s linear infinite" }} />
                    )}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: sel ? p.accentBright : "rgba(255,255,255,0.6)", letterSpacing: "0.04em", fontFamily: "Arial,sans-serif", marginBottom: "2px" }}>{p.name}</div>
                    <div style={{ fontSize: "15px", fontWeight: 900, color: "#ffd24a" }}>🪙 {p.cost}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected pack detail strip */}
          <div style={{ padding: "16px 20px", marginBottom: "14px", borderRadius: "12px", background: `linear-gradient(135deg,${packDef.bodyMid}cc,${packDef.bodyDark}ee)`, border: `1px solid ${packDef.accent}35`, display: "flex", alignItems: "center", gap: "16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 10% 50%,${packDef.accent}0d 0%,transparent 60%)` }} />
            <div style={{ zIndex: 1, flexShrink: 0 }}>
              <PackArt packId={packDef.id} isPreview={false} />
            </div>
            <div style={{ flex: 1, zIndex: 1 }}>
              <div style={{ fontSize: "16px", fontWeight: 900, color: packDef.accentBright, letterSpacing: "0.06em", marginBottom: "4px" }}>{packDef.name}</div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.55, fontFamily: "Arial,sans-serif", fontWeight: 400, marginBottom: "8px" }}>{packDef.desc}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.26)", fontFamily: "Arial,sans-serif" }}>75% Common · 20% Rare · 5% Legendary · Pity at 50 pulls</div>
            </div>
          </div>

          {!canAfford && !loading && (
            <div style={{ textAlign: "center", fontSize: "12px", color: "#ff5566", marginBottom: "10px", fontFamily: "Arial,sans-serif" }}>
              Need {(packDef.cost - playerCoins).toLocaleString()} more coins 🪙
            </div>
          )}

          <button
            onClick={handleBuy}
            disabled={!canAfford || purchasing || loading}
            style={{
              width: "100%", padding: "16px", border: "none", borderRadius: "12px",
              fontSize: "15px", fontWeight: 900, letterSpacing: "0.1em",
              cursor: canAfford && !purchasing ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              transition: "all 0.2s",
              background: canAfford && !loading ? `linear-gradient(135deg,${packDef.accent},${packDef.accentBright} 50%,${packDef.accent})` : "rgba(255,255,255,0.06)",
              color: canAfford ? "#000" : "rgba(255,255,255,0.2)",
              boxShadow: canAfford ? `0 4px 30px ${packDef.glow}, 0 2px 8px rgba(0,0,0,0.5)` : "none",
            }}
          >
            {purchasing ? <><Spinner /> Purchasing…</> : <>🛒 BUY PACK — {packDef.cost} 🪙</>}
          </button>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {(phase === "preview" || phase === "tearing") && (
        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px", padding: "24px 0", cursor: phase === "preview" ? "pointer" : "default", animation: "fadeUp 0.35s ease" }}
          onClick={phase === "preview" ? handleOpenPack : undefined}
        >
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.38)", letterSpacing: "0.18em", fontFamily: "Arial,sans-serif" }}>
            {phase === "tearing" ? "OPENING…" : "TAP TO TEAR IT OPEN"}
          </div>
          <div style={{ animation: phase === "preview" ? "packFloat 3.2s ease-in-out infinite" : phase === "tearing" ? "packTear 0.7s cubic-bezier(0.3,0,0.6,1) forwards" : "none", filter: phase === "preview" ? `drop-shadow(0 0 28px ${packDef.glow}) drop-shadow(0 0 60px ${packDef.glow.replace("0.6","0.22")})` : "none" }}>
            <PackArt packId={selectedPack} isPreview={true} />
          </div>
          {phase === "preview" && (
            <div style={{ fontSize: "13px", color: packDef.accentBright, fontWeight: 900, letterSpacing: "0.22em", animation: "pipPulse 1.4s ease-in-out infinite" }}>▲ TAP THE PACK TO OPEN ▲</div>
          )}
          {phase === "tearing" && (
            <div style={{ fontSize: "22px", fontWeight: 900, color: packDef.accentBright, letterSpacing: "0.1em", textShadow: `0 0 30px ${packDef.glow}` }}>HERE WE GO…</div>
          )}
        </div>
      )}

      {/* ── CARD REVEAL ── */}
      {phase === "cards" && currentFull && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "10px 0", animation: "fadeUp 0.3s ease" }}>
          {legendaryFlash && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(255,155,0,0.82)", animation: "flashScreen 1.3s ease-out forwards", zIndex: 9999, pointerEvents: "none" }} />
          )}
          {/* Pips */}
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {openingCards.map((_, i) => (
              <div key={i} style={{ width: "28px", height: "4px", borderRadius: "2px", transition: "all 0.3s", background: i < currentIdx ? packDef.accent : i === currentIdx ? (isFlipped ? packDef.accent : "rgba(255,255,255,0.22)") : "rgba(255,255,255,0.08)", boxShadow: i === currentIdx && isFlipped ? `0 0 8px ${packDef.accent}` : "none" }} />
            ))}
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.32)", marginLeft: "8px", fontFamily: "Arial,sans-serif" }}>{currentIdx + 1}/{openingCards.length}</span>
          </div>
          {/* Rarity banner */}
          <div style={{ minHeight: "28px", display: "flex", alignItems: "center" }}>
            {isFlipped && (
              <div style={{ fontSize: "15px", fontWeight: 900, color: RARITY_GLOW[currentRaw.rarity], letterSpacing: "0.16em", animation: "bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1)", textShadow: `0 0 24px ${RARITY_GLOW[currentRaw.rarity]}` }}>
                {RARITY_LABEL[currentRaw.rarity]}
              </div>
            )}
          </div>
          {/* 3-D flip */}
          <div onClick={handleFlipCard} style={{ width: "180px", height: "258px", perspective: "1200px", cursor: isFlipped ? "default" : "pointer" }}>
            <div style={{ width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d", transition: "transform 0.72s cubic-bezier(0.4,0,0.2,1)", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
                <CardBack accent={packDef.accent} />
                {!isFlipped && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "16px" }}><div style={{ fontSize: "10px", color: "rgba(255,255,255,0.32)", fontWeight: 700, letterSpacing: "0.18em", animation: "pipPulse 1.6s ease-in-out infinite", fontFamily: "Arial,sans-serif" }}>TAP TO REVEAL</div></div>}
              </div>
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderRadius: "12px", animation: isFlipped ? currentRaw.rarity === "LEGENDARY" ? "legendPulse 1.8s ease-in-out infinite" : currentRaw.rarity === "RARE" ? "rarePulse 2s ease-in-out infinite" : "none" : "none" }}>
                <TKDLCard card={currentFull} size="lg" locked={false} />
                {currentRaw.rarity === "LEGENDARY" && isFlipped && (
                  <div style={{ position: "absolute", inset: 0, borderRadius: "12px", background: "linear-gradient(135deg,rgba(255,0,80,0.14),rgba(255,160,0,0.18),rgba(255,255,0,0.12),rgba(0,255,120,0.1),rgba(0,160,255,0.14),rgba(180,0,255,0.16))", backgroundSize: "400% 400%", animation: "rainbow 2.8s ease infinite", pointerEvents: "none" }} />
                )}
              </div>
            </div>
          </div>
          {/* Next btn */}
          <div style={{ minHeight: "56px", display: "flex", alignItems: "center" }}>
            {canAdvance && (
              <button onClick={handleNextCard} style={{ padding: "14px 34px", background: currentIdx >= openingCards.length - 1 ? `linear-gradient(135deg,${packDef.accent},${packDef.accentBright})` : "rgba(255,255,255,0.1)", border: `2px solid ${currentIdx >= openingCards.length - 1 ? packDef.accent : "rgba(255,255,255,0.22)"}`, borderRadius: "10px", color: currentIdx >= openingCards.length - 1 ? "#000" : "#fff", fontSize: "14px", fontWeight: 900, cursor: "pointer", letterSpacing: "0.1em", animation: "bounceIn 0.38s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: currentIdx >= openingCards.length - 1 ? `0 4px 24px ${packDef.glow}` : "none" }}>
                {currentIdx >= openingCards.length - 1 ? "🎉 CLAIM ALL CARDS!" : "NEXT CARD →"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "22px", animation: "fadeUp 0.4s ease" }}>
          <div style={{ fontSize: "17px", fontWeight: 900, color: packDef.accentBright, letterSpacing: "0.12em", textShadow: `0 0 28px ${packDef.glow}` }}>🎉 ADDED TO YOUR COLLECTION!</div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            {openingCards.map((raw, i) => {
              const full = ALL_CARDS.find(c => c.name === raw.name) ?? { id: 0, name: raw.name, category: "WILDCARD GOOD" as const, rarity: raw.rarity, effect: "", flavourText: "", energyCost: 1 };
              return <div key={i} style={{ width: "88px", height: "126px", animation: `bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s both` }}><TKDLCard card={full} size="sm" locked={false} /></div>;
            })}
          </div>
          <button onClick={() => { setPhase("shop"); setOpeningCards([]); setCurrentIdx(0); setIsFlipped(false); setCanAdvance(false); }} style={{ padding: "12px 28px", background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.18)", borderRadius: "10px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em" }}>
            🛍️ BUY ANOTHER PACK
          </button>
        </div>
      )}
    </div>
  );
},
  // Custom comparison: only re-render if playerId changes or freePacks updates
  (prev, next) => {
    return (
      prev.playerId === next.playerId &&
      prev.onCardsReceived === next.onCardsReceived &&
      prev.freePacks === next.freePacks &&
      prev.onFreePackOpened === next.onFreePackOpened
    );
  }
);
