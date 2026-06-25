import React, { useState, useEffect } from "react";
import { ShoppingCart } from "lucide-react";
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
}

type Phase = "shop" | "preview" | "tearing" | "cards" | "done";

const PACK_DEFS = [
  {
    id: "single", name: "Arrow Pack", cards: 1, cost: 50,
    accent: "#00b4ff", glow: "rgba(0,180,255,0.55)",
    icon: "🎯", label: "ARROW PACK", sub: "1 CARD", ribbon: null,
    desc: "One dart from the oche. One card. Quick draw.",
    bodyGrad: "linear-gradient(155deg,#020d20 0%,#062144 55%,#020d20 100%)",
    stripGrad: "linear-gradient(90deg,#041830 0%,#0a3570 50%,#041830 100%)",
  },
  {
    id: "five", name: "League Night Pack", cards: 5, cost: 200,
    accent: "#ffd24a", glow: "rgba(255,210,74,0.55)",
    icon: "🏹", label: "LEAGUE NIGHT", sub: "5 CARDS", ribbon: "BESTSELLER",
    desc: "Five cards from a Kilbirnie league night. Anything could drop.",
    bodyGrad: "linear-gradient(155deg,#1a0e00 0%,#3d2200 55%,#1a0e00 100%)",
    stripGrad: "linear-gradient(90deg,#2a1500 0%,#5c3000 50%,#2a1500 100%)",
  },
  {
    id: "ten", name: "Kilbirnie Elite", cards: 10, cost: 350,
    accent: "#cc44ff", glow: "rgba(204,68,255,0.55)",
    icon: "⚡", label: "KILBIRNIE ELITE", sub: "10 CARDS", ribbon: "BEST VALUE",
    desc: "Ten cards. 20% Rare rate per card. Pity system active.",
    bodyGrad: "linear-gradient(155deg,#0a0020 0%,#1f0050 55%,#0a0020 100%)",
    stripGrad: "linear-gradient(90deg,#14004a 0%,#2d0080 50%,#14004a 100%)",
  },
];

const RARITY_GLOW: Record<string, string> = { LEGENDARY: "#ffaa00", RARE: "#00b4ff", COMMON: "#9ab0c4" };
const RARITY_LABEL: Record<string, string> = { LEGENDARY: "✨ LEGENDARY CARD! ✨", RARE: "💎 RARE CARD!", COMMON: "Common Card" };

/* ── CSS-drawn pack art ───────────────────────────────────────── */
function PackArt({ packId, isTearing, isPreview }: { packId: string; isTearing: boolean; isPreview: boolean }) {
  const cfg = PACK_DEFS.find(p => p.id === packId) ?? PACK_DEFS[1];
  const W = isPreview ? 200 : 118;
  const H = isPreview ? 336 : 200;
  const STRIP = isPreview ? 84 : 50;

  return (
    <div style={{ position: "relative", width: W, height: H, flexShrink: 0, userSelect: "none" }}>
      {/* Tear strip */}
      <div style={{
        position: "absolute", top: 0, left: 0, width: "100%", height: STRIP,
        background: cfg.stripGrad,
        borderRadius: "10px 10px 0 0",
        border: `1.5px solid ${cfg.accent}55`,
        borderBottom: "none",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
        zIndex: 10,
        animation: isTearing ? "tcgTearTop 0.65s cubic-bezier(0.3,0,0.6,1) forwards" : isPreview ? "tcgPackGlow 2.5s ease-in-out infinite" : "none",
      }}>
        <span style={{ fontSize: isPreview ? "18px" : "11px" }}>🎴</span>
        <span style={{ fontSize: isPreview ? "13px" : "8px", fontWeight: 900, color: cfg.accent, letterSpacing: "0.2em" }}>TKDL</span>
        {/* dotted tear line */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "2px", background: `repeating-linear-gradient(90deg,${cfg.accent}99 0,${cfg.accent}99 6px,transparent 6px,transparent 12px)` }} />
      </div>

      {/* Main body */}
      <div style={{
        position: "absolute", top: STRIP, left: 0, width: "100%", height: H - STRIP,
        background: cfg.bodyGrad,
        border: `1.5px solid ${cfg.accent}44`,
        borderTop: "none",
        borderRadius: "0 0 10px 10px",
        boxShadow: isPreview ? `0 0 55px ${cfg.glow}, 0 0 110px ${cfg.glow.replace("0.55","0.22")}` : `0 4px 18px ${cfg.glow.replace("0.55","0.28")}`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: isPreview ? "14px" : "6px",
        overflow: "hidden",
        animation: isPreview && !isTearing ? "tcgPackFloat 3.2s ease-in-out infinite" : "none",
      }}>
        {/* Ambient glow blob */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 28%,${cfg.accent}1c 0%,transparent 65%)`, pointerEvents: "none" }} />
        {/* Diamond mesh */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.05, background: "repeating-linear-gradient(45deg,rgba(255,255,255,0.5) 0,rgba(255,255,255,0.5) 1px,transparent 0,transparent 50%)", backgroundSize: "18px 18px", pointerEvents: "none" }} />

        <div style={{ fontSize: isPreview ? "56px" : "30px", lineHeight: 1, zIndex: 1, filter: `drop-shadow(0 0 14px ${cfg.accent})` }}>{cfg.icon}</div>

        <div style={{ zIndex: 1, textAlign: "center" }}>
          <div style={{ fontSize: isPreview ? "21px" : "11px", fontWeight: 900, color: cfg.accent, letterSpacing: "0.2em", textShadow: `0 0 18px ${cfg.accent}` }}>{cfg.label}</div>
          <div style={{ fontSize: isPreview ? "12px" : "8px", color: "rgba(255,255,255,0.42)", letterSpacing: "0.1em", marginTop: "3px" }}>{cfg.sub}</div>
        </div>

        {cfg.ribbon && isPreview && (
          <div style={{ zIndex: 1, padding: "4px 18px", background: `${cfg.accent}22`, border: `1px solid ${cfg.accent}66`, borderRadius: "20px", fontSize: "10px", fontWeight: 800, color: cfg.accent, letterSpacing: "0.14em" }}>
            {cfg.ribbon}
          </div>
        )}

        {/* Tear burst flash */}
        {isTearing && (
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 0%,${cfg.accent}dd,transparent 65%)`, borderRadius: "0 0 10px 10px", animation: "tcgTearFlash 0.55s ease-out forwards", zIndex: 20, pointerEvents: "none" }} />
        )}
      </div>
    </div>
  );
}

/* ── CSS-drawn card back face ─────────────────────────────────── */
function CardBack({ accent = "#00b4ff" }: { accent?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", borderRadius: "12px", background: "linear-gradient(135deg,#030b1c 0%,#071633 50%,#030b1c 100%)", border: `2px solid ${accent}44`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.065, background: "repeating-linear-gradient(45deg,rgba(255,255,255,0.45) 0,rgba(255,255,255,0.45) 1px,transparent 0,transparent 50%)", backgroundSize: "22px 22px" }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 42%,${accent}15 0%,transparent 62%)` }} />
      <div style={{ fontSize: "38px", filter: `drop-shadow(0 0 14px ${accent}88)`, zIndex: 1 }}>🎴</div>
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div style={{ fontSize: "21px", fontWeight: 900, letterSpacing: "0.3em", color: accent, textShadow: `0 0 20px ${accent}` }}>TKDL</div>
        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.28)", letterSpacing: "0.22em", marginTop: "5px" }}>CARD CLASH</div>
      </div>
      {/* corner brackets */}
      {(["tl","tr","bl","br"] as const).map(c => (
        <div key={c} style={{ position: "absolute", [c[0]==="t"?"top":"bottom"]: "13px", [c[1]==="l"?"left":"right"]: "13px", width: "17px", height: "17px", borderTop: c[0]==="t" ? `2px solid ${accent}55` : undefined, borderBottom: c[0]==="b" ? `2px solid ${accent}55` : undefined, borderLeft: c[1]==="l" ? `2px solid ${accent}55` : undefined, borderRight: c[1]==="r" ? `2px solid ${accent}55` : undefined }} />
      ))}
    </div>
  );
}

function Spinner() {
  return <span style={{ width: "14px", height: "14px", border: "2px solid transparent", borderTopColor: "#fff", borderRadius: "50%", animation: "tcgSpin 0.6s linear infinite", display: "inline-block" }} />;
}

/* ── Main component ───────────────────────────────────────────── */
export function CardShopUI({ playerId, onCardsReceived }: CardShopUIProps) {
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

  useEffect(() => {
    if (!playerId) return;
    fetch(`/api/card-clash/shop/currency/${playerId}`)
      .then(r => r.json())
      .then(d => { setPlayerCoins(d.cardPoints ?? 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [playerId]);

  const packDef = PACK_DEFS.find(p => p.id === selectedPack) ?? PACK_DEFS[1];
  const canAfford = playerCoins >= packDef.cost;

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
      setOpeningCards(cards);
      onCardsReceived?.(cards.map(c => c.name));
      // Refresh coins
      fetch(`/api/card-clash/shop/currency/${playerId}`)
        .then(res => res.json())
        .then(d => setPlayerCoins(d.cardPoints ?? 0))
        .catch(() => {});
      setCurrentIdx(0);
      setIsFlipped(false);
      setCanAdvance(false);
      setPhase("preview");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  };

  const handleOpenPack = () => {
    if (phase !== "preview") return;
    setPhase("tearing");
    setTimeout(() => {
      setCurrentIdx(0);
      setIsFlipped(false);
      setCanAdvance(false);
      setPhase("cards");
    }, 950);
  };

  const handleFlipCard = () => {
    if (isFlipped) return;
    setIsFlipped(true);
    const rarity = openingCards[currentIdx]?.rarity;
    if (rarity === "LEGENDARY") {
      setLegendaryFlash(true);
      setTimeout(() => setLegendaryFlash(false), 1300);
      setTimeout(() => setCanAdvance(true), 3400);
    } else if (rarity === "RARE") {
      setTimeout(() => setCanAdvance(true), 2000);
    } else {
      setTimeout(() => setCanAdvance(true), 1100);
    }
  };

  const handleNextCard = () => {
    if (currentIdx >= openingCards.length - 1) {
      setPhase("done");
    } else {
      setCurrentIdx(i => i + 1);
      setIsFlipped(false);
      setCanAdvance(false);
    }
  };

  const handleBuyAgain = () => {
    setPhase("shop");
    setOpeningCards([]);
    setCurrentIdx(0);
    setIsFlipped(false);
    setCanAdvance(false);
  };

  const currentRaw = openingCards[currentIdx];
  const currentFull = currentRaw
    ? (ALL_CARDS.find(c => c.name === currentRaw.name) ?? { id: 0, name: currentRaw.name, category: "WILDCARD GOOD" as const, rarity: currentRaw.rarity, effect: "", flavourText: "", energyCost: 1 })
    : null;

  return (
    <div style={{ fontFamily: "'Oswald','Rajdhani',sans-serif", position: "relative" }}>
      <style>{`
        @keyframes tcgSpin          { to { transform: rotate(360deg); } }
        @keyframes tcgPackGlow      { 0%,100%{filter:brightness(1) drop-shadow(0 0 10px ${packDef.accent}88)} 50%{filter:brightness(1.2) drop-shadow(0 0 26px ${packDef.accent})} }
        @keyframes tcgPackFloat     { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-14px) rotate(1deg)} }
        @keyframes tcgTearTop       { 0%{transform:translateY(0) rotate(0deg);opacity:1} 15%{transform:translateY(-18px) rotate(-2deg);opacity:1} 100%{transform:translateY(-460px) rotate(-24deg);opacity:0} }
        @keyframes tcgTearFlash     { 0%{opacity:0} 25%{opacity:1} 100%{opacity:0} }
        @keyframes tcgBounceIn      { from{transform:translateY(55px) scale(0.82);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
        @keyframes tcgFlashScreen   { 0%{opacity:0} 18%{opacity:0.65} 55%{opacity:0.38} 100%{opacity:0} }
        @keyframes tcgLegendaryPulse{ 0%,100%{box-shadow:0 0 30px #ffaa00,0 0 60px #ffaa0055} 50%{box-shadow:0 0 70px #ffaa00,0 0 130px #ffaa0077,0 0 180px #ffaa0033} }
        @keyframes tcgRarePulse     { 0%,100%{box-shadow:0 0 20px #00b4ff,0 0 42px #00b4ff44} 50%{box-shadow:0 0 45px #00b4ff,0 0 90px #00b4ff66} }
        @keyframes tcgRainbow       { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes tcgPipPulse      { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes tcgSelectPop     { 0%{transform:scale(1)} 50%{transform:scale(1.07)} 100%{transform:scale(1)} }
        @keyframes tcgFadeIn        { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ─── SHOP ─────────────────────────────────────────── */}
      {phase === "shop" && (
        <div style={{ animation: "tcgFadeIn 0.3s ease" }}>
          {/* Coin balance */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "18px" }}>
            <div style={{ background: "rgba(255,210,74,0.13)", border: "1px solid rgba(255,210,74,0.32)", borderRadius: "20px", padding: "7px 16px", fontSize: "14px", fontWeight: 700, color: "#ffd24a", letterSpacing: "0.06em" }}>
              🪙 {loading ? "…" : playerCoins.toLocaleString()} coins
            </div>
          </div>

          {/* Pack row */}
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginBottom: "22px", flexWrap: "wrap" }}>
            {PACK_DEFS.map(p => {
              const sel = selectedPack === p.id;
              return (
                <div key={p.id} onClick={() => setSelectedPack(p.id)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", position: "relative" }}>
                  {p.ribbon && (
                    <div style={{ position: "absolute", top: "-11px", left: "50%", transform: "translateX(-50%)", background: p.accent, color: "#000", fontSize: "8px", fontWeight: 900, padding: "3px 10px", borderRadius: "10px", letterSpacing: "0.1em", zIndex: 20, whiteSpace: "nowrap" }}>
                      {p.ribbon}
                    </div>
                  )}
                  <div style={{ outline: sel ? `3px solid ${p.accent}` : "3px solid transparent", outlineOffset: "3px", borderRadius: "13px", transition: "outline 0.18s, transform 0.18s, box-shadow 0.18s", transform: sel ? "scale(1.06)" : "scale(1)", boxShadow: sel ? `0 0 28px ${p.glow}` : "none", animation: sel ? "tcgSelectPop 0.22s ease" : "none" }}>
                    <PackArt packId={p.id} isTearing={false} isPreview={false} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: sel ? p.accent : "rgba(255,255,255,0.75)", letterSpacing: "0.06em" }}>{p.name}</div>
                    <div style={{ fontSize: "13px", color: "#ffd24a", fontWeight: 800 }}>🪙 {p.cost}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected pack summary */}
          <div style={{ background: `linear-gradient(135deg,${packDef.accent}12,${packDef.accent}06)`, border: `1px solid ${packDef.accent}33`, borderRadius: "12px", padding: "14px 18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ fontSize: "26px" }}>{packDef.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: packDef.accent, letterSpacing: "0.08em" }}>{packDef.name}</div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>{(packDef as any).desc ?? `${packDef.cards} card${packDef.cards > 1 ? "s" : ""} from the full TKDL deck`}</div>
            </div>
            <div style={{ fontSize: "18px", fontWeight: 900, color: "#ffd24a" }}>🪙 {packDef.cost}</div>
          </div>

          {!canAfford && !loading && (
            <div style={{ textAlign: "center", fontSize: "12px", color: "#ff5555", marginBottom: "10px", fontWeight: 600 }}>
              Need {packDef.cost - playerCoins} more coins 🪙
            </div>
          )}

          <button
            onClick={handleBuy}
            disabled={!canAfford || purchasing || loading}
            style={{ width: "100%", padding: "14px", background: canAfford && !loading ? `linear-gradient(135deg,${packDef.accent}cc,${packDef.accent}88)` : "#333", border: "none", borderRadius: "10px", color: canAfford ? "#000" : "#666", fontSize: "15px", fontWeight: 900, cursor: canAfford && !purchasing ? "pointer" : "not-allowed", letterSpacing: "0.08em", display: "flex", alignItems: "center", justifyContent: "center", gap: "9px", boxShadow: canAfford ? `0 4px 22px ${packDef.glow}` : "none", transition: "all 0.18s" }}
          >
            {purchasing ? <><Spinner /> Opening Pack…</> : <><ShoppingCart size={16} /> Buy Pack — {packDef.cost} 🪙</>}
          </button>
        </div>
      )}

      {/* ─── PREVIEW: tap to open ────────────────────────── */}
      {(phase === "preview" || phase === "tearing") && (
        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "22px", padding: "14px 0", cursor: phase === "preview" ? "pointer" : "default", animation: "tcgFadeIn 0.35s ease" }}
          onClick={phase === "preview" ? handleOpenPack : undefined}
        >
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {phase === "tearing" ? "Opening…" : "Tap to tear it open"}
          </div>

          <PackArt packId={selectedPack} isTearing={phase === "tearing"} isPreview={true} />

          {phase === "preview" && (
            <div style={{ fontSize: "13px", color: packDef.accent, fontWeight: 800, letterSpacing: "0.16em", animation: "tcgPipPulse 1.4s ease-in-out infinite" }}>
              👆 TAP THE PACK
            </div>
          )}
          {phase === "tearing" && (
            <div style={{ fontSize: "18px", fontWeight: 900, color: packDef.accent, letterSpacing: "0.1em" }}>
              HERE WE GO…
            </div>
          )}
        </div>
      )}

      {/* ─── CARD REVEAL ─────────────────────────────────── */}
      {phase === "cards" && currentFull && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "18px", padding: "8px 0", position: "relative", animation: "tcgFadeIn 0.3s ease" }}>
          {/* LEGENDARY screen flash */}
          {legendaryFlash && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(255,160,0,0.82)", animation: "tcgFlashScreen 1.3s ease-out forwards", zIndex: 9999, pointerEvents: "none" }} />
          )}

          {/* Progress pips */}
          <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
            {openingCards.map((_, i) => (
              <div key={i} style={{ width: "26px", height: "4px", borderRadius: "2px", transition: "background 0.3s", background: i < currentIdx ? packDef.accent : i === currentIdx ? (isFlipped ? packDef.accent : "rgba(255,255,255,0.28)") : "rgba(255,255,255,0.1)" }} />
            ))}
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.38)", marginLeft: "6px" }}>{currentIdx + 1}/{openingCards.length}</span>
          </div>

          {/* Rarity banner — appears after flip */}
          <div style={{ minHeight: "22px", display: "flex", alignItems: "center" }}>
            {isFlipped && (
              <div style={{ fontSize: "13px", fontWeight: 800, color: RARITY_GLOW[currentRaw.rarity] ?? "#fff", letterSpacing: "0.12em", animation: "tcgBounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
                {RARITY_LABEL[currentRaw.rarity]}
              </div>
            )}
          </div>

          {/* 3-D flip card */}
          <div onClick={handleFlipCard} style={{ width: "180px", height: "258px", perspective: "1200px", cursor: isFlipped ? "default" : "pointer" }}>
            <div style={{
              width: "100%", height: "100%", position: "relative",
              transformStyle: "preserve-3d",
              transition: "transform 0.72s cubic-bezier(0.4,0,0.2,1)",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}>
              {/* Back */}
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
                <CardBack accent={packDef.accent} />
                {!isFlipped && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "15px" }}>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: "0.13em", animation: "tcgPipPulse 1.6s ease-in-out infinite" }}>TAP TO REVEAL</div>
                  </div>
                )}
              </div>

              {/* Front */}
              <div style={{
                position: "absolute", inset: 0,
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                borderRadius: "12px",
                animation: isFlipped
                  ? currentRaw.rarity === "LEGENDARY" ? "tcgLegendaryPulse 1.8s ease-in-out infinite"
                  : currentRaw.rarity === "RARE"      ? "tcgRarePulse 2s ease-in-out infinite"
                  : "none"
                  : "none",
              }}>
                <TKDLCard card={currentFull} size="lg" locked={false} />
                {/* LEGENDARY rainbow foil overlay */}
                {currentRaw.rarity === "LEGENDARY" && isFlipped && (
                  <div style={{ position: "absolute", inset: 0, borderRadius: "12px", background: "linear-gradient(135deg,rgba(255,0,60,0.12),rgba(255,150,0,0.15),rgba(255,255,0,0.1),rgba(0,255,100,0.1),rgba(0,160,255,0.1),rgba(160,0,255,0.12))", backgroundSize: "400% 400%", animation: "tcgRainbow 3s ease infinite", pointerEvents: "none" }} />
                )}
              </div>
            </div>
          </div>

          {/* Next / Claim button */}
          <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
            {canAdvance && (
              <button
                onClick={handleNextCard}
                style={{ padding: "12px 30px", background: currentIdx >= openingCards.length - 1 ? `linear-gradient(135deg,${packDef.accent}cc,${packDef.accent}88)` : "rgba(255,255,255,0.11)", border: `2px solid ${currentIdx >= openingCards.length - 1 ? packDef.accent : "rgba(255,255,255,0.22)"}`, borderRadius: "10px", color: currentIdx >= openingCards.length - 1 ? "#000" : "#fff", fontSize: "14px", fontWeight: 800, cursor: "pointer", letterSpacing: "0.1em", animation: "tcgBounceIn 0.38s cubic-bezier(0.34,1.56,0.64,1)" }}
              >
                {currentIdx >= openingCards.length - 1 ? "🎉 Claim All Cards!" : "Next Card →"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── DONE ────────────────────────────────────────── */}
      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", animation: "tcgFadeIn 0.4s ease" }}>
          <div style={{ fontSize: "18px", fontWeight: 900, color: packDef.accent, letterSpacing: "0.1em" }}>
            🎉 ADDED TO YOUR COLLECTION!
          </div>

          {/* Mini card grid */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            {openingCards.map((raw, i) => {
              const full = ALL_CARDS.find(c => c.name === raw.name) ?? { id: 0, name: raw.name, category: "WILDCARD GOOD" as const, rarity: raw.rarity, effect: "", flavourText: "", energyCost: 1 };
              return (
                <div key={i} style={{ width: "88px", height: "126px", animation: `tcgBounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s both` }}>
                  <TKDLCard card={full} size="sm" locked={false} />
                </div>
              );
            })}
          </div>

          <button onClick={handleBuyAgain} style={{ padding: "12px 26px", background: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.2)", borderRadius: "10px", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.07em" }}>
            🛍️ Buy Another Pack
          </button>
        </div>
      )}
    </div>
  );
}
