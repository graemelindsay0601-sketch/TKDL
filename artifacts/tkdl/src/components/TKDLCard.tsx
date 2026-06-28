import { useState } from "react";
import type { CardData, Category, Rarity } from "../lib/cards-data";
import { FavoriteButton } from "./FavoriteButton";
import { useCardAcquisitionDate } from "../utils/cardAcquisitionDate";

interface TKDLCardProps {
  card: CardData;
  size?: "sm" | "md" | "lg";
  locked?: boolean;
  isFavorite?: boolean;
  playerId?: number;
  onFavoriteChange?: (isFavorite: boolean) => void;
  acquisitionDate?: Date | string;
}

const CATEGORY_CONFIG: Record<Category, {
  primary: string; primaryDim: string; primaryGlow: string;
  barGradient: string; barText: string; effectHighlight: string;
  icon: string; iconSymbol: string; cardBackPosition: string;
  frameShadow: string; headerAccent: string;
}> = {
  "X01 GOOD": { primary: "#00b4ff", primaryDim: "#004d7a", primaryGlow: "rgba(0,180,255,0.5)", barGradient: "linear-gradient(90deg,#001f3d,#003366,#001f3d)", barText: "#00d4ff", effectHighlight: "#00d4ff", icon: "◎", iconSymbol: "X01", cardBackPosition: "0% 0%", frameShadow: "0 0 30px rgba(0,180,255,0.6),0 0 60px rgba(0,180,255,0.3),inset 0 0 20px rgba(0,180,255,0.05)", headerAccent: "#00b4ff" },
  "X01 BAD": { primary: "#ff2222", primaryDim: "#7a0000", primaryGlow: "rgba(255,34,34,0.5)", barGradient: "linear-gradient(90deg,#3d0000,#660000,#3d0000)", barText: "#ff5555", effectHighlight: "#ff6666", icon: "⊗", iconSymbol: "X01", cardBackPosition: "50% 0%", frameShadow: "0 0 30px rgba(255,34,34,0.6),0 0 60px rgba(255,34,34,0.3),inset 0 0 20px rgba(255,34,34,0.05)", headerAccent: "#ff2222" },
  "CRICKET GOOD": { primary: "#00cc44", primaryDim: "#005a1a", primaryGlow: "rgba(0,204,68,0.5)", barGradient: "linear-gradient(90deg,#002211,#004422,#002211)", barText: "#00ff66", effectHighlight: "#00ff66", icon: "⊞", iconSymbol: "CKT", cardBackPosition: "100% 0%", frameShadow: "0 0 30px rgba(0,204,68,0.6),0 0 60px rgba(0,204,68,0.3),inset 0 0 20px rgba(0,204,68,0.05)", headerAccent: "#00cc44" },
  "CRICKET BAD": { primary: "#9933ff", primaryDim: "#3d0066", primaryGlow: "rgba(153,51,255,0.5)", barGradient: "linear-gradient(90deg,#1a0033,#2d0055,#1a0033)", barText: "#cc66ff", effectHighlight: "#cc66ff", icon: "⊠", iconSymbol: "CKT", cardBackPosition: "0% 100%", frameShadow: "0 0 30px rgba(153,51,255,0.6),0 0 60px rgba(153,51,255,0.3),inset 0 0 20px rgba(153,51,255,0.05)", headerAccent: "#9933ff" },
  "WILDCARD GOOD": { primary: "#ffaa00", primaryDim: "#7a4a00", primaryGlow: "rgba(255,170,0,0.5)", barGradient: "linear-gradient(90deg,#2a1800,#442800,#2a1800)", barText: "#ffcc44", effectHighlight: "#ffcc44", icon: "★", iconSymbol: "WLD", cardBackPosition: "50% 100%", frameShadow: "0 0 30px rgba(255,170,0,0.6),0 0 60px rgba(255,170,0,0.3),inset 0 0 20px rgba(255,170,0,0.05)", headerAccent: "#ffaa00" },
  "WILDCARD BAD": { primary: "#cc1111", primaryDim: "#660000", primaryGlow: "rgba(204,17,17,0.5)", barGradient: "linear-gradient(90deg,#1f0000,#330000,#1f0000)", barText: "#ff4444", effectHighlight: "#ff5555", icon: "✦", iconSymbol: "WLD", cardBackPosition: "100% 100%", frameShadow: "0 0 30px rgba(204,17,17,0.6),0 0 60px rgba(204,17,17,0.3),inset 0 0 20px rgba(204,17,17,0.05)", headerAccent: "#cc1111" },
};

const RARITY_CONFIG: Record<Rarity, { color: string; glow: string; diamond: string; label: string; frameBorderWidth: string; cornerSize: string }> = {
  COMMON:    { color: "#9ab0c4", glow: "rgba(154,176,196,0.4)", diamond: "●", label: "COMMON",    frameBorderWidth: "1.5px", cornerSize: "14px" },
  RARE:      { color: "#00b4ff", glow: "rgba(0,180,255,0.5)",   diamond: "◆", label: "RARE",      frameBorderWidth: "2px",   cornerSize: "16px" },
  LEGENDARY: { color: "#ffaa00", glow: "rgba(255,170,0,0.6)",   diamond: "♛", label: "LEGENDARY", frameBorderWidth: "2.5px", cornerSize: "20px" },
};

function highlightEffect(text: string, color: string): React.ReactNode {
  const parts = text.split(/(\+\d+(?:\.\d+)?x?|-\d+|\d+(?:\.\d+)?x|\d+(?:\.\d+)?\.\d+x?)/g);
  return parts.map((part, i) => {
    if (/^(\+\d|[-]\d+x?|\d+x|\d+\.\d+x?)/.test(part) || /^[+-]\d+$/.test(part)) {
      return <span key={i} style={{ color, fontWeight: 800, textShadow: `0 0 6px ${color}88` }}>{part}</span>;
    }
    return part;
  });
}

export function TKDLCard({ 
  card, 
  size = "md", 
  locked = false,
  isFavorite = false,
  playerId,
  onFavoriteChange,
  acquisitionDate
}: TKDLCardProps) {
  const [flipped, setFlipped] = useState(false);
  const acqDate = useCardAcquisitionDate(acquisitionDate);
  const cfg = CATEGORY_CONFIG[card.category];
  const rar = RARITY_CONFIG[card.rarity];
  const isLegendary = card.rarity === "LEGENDARY";
  const isRare = card.rarity === "RARE";

  const dims = { sm: { w: "160px", h: "224px" }, md: { w: "220px", h: "308px" }, lg: { w: "290px", h: "406px" } }[size];
  const fs   = {
    sm:  { title: "0.55rem", cat: "0.45rem", effect: "0.5rem",  flavour: "0.45rem" },
    md:  { title: "0.65rem", cat: "0.5rem",  effect: "0.58rem", flavour: "0.5rem"  },
    lg:  { title: "0.8rem",  cat: "0.6rem",  effect: "0.68rem", flavour: "0.58rem" },
  }[size];

  const rarityColor = card.rarity === "LEGENDARY" ? "#ffaa00" : card.rarity === "RARE" ? "#00b4ff" : "#9ab0c4";
  const bubbleSize  = size === "lg" ? "28px" : size === "md" ? "24px" : "20px";
  const bubbleFont  = size === "lg" ? "0.8rem" : "0.65rem";
  const iconFont    = size === "lg" ? "11px" : "9px";

  return (
    <div
      style={{ width: dims.w, height: dims.h, perspective: "1200px", cursor: locked ? "not-allowed" : "pointer", userSelect: "none", flexShrink: 0, filter: locked ? "grayscale(80%)" : "none", opacity: locked ? 0.45 : 1 }}
      onClick={() => { if (!locked) setFlipped(f => !f); }}
    >
      <div style={{ width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)", transition: "transform 0.65s cubic-bezier(0.4,0,0.2,1)" }}>

        {/* ── FRONT ── */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "12px", overflow: "hidden",
          display: "flex", flexDirection: "column",
          backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          background: "linear-gradient(170deg,#0a0e18 0%,#06090f 60%,#04070d 100%)",
          border: `${rar.frameBorderWidth} solid ${rarityColor}`,
          boxShadow: isLegendary ? cfg.frameShadow : `0 0 18px ${rar.glow},inset 0 0 15px rgba(0,0,0,0.4)`,
        }}>
          {/* Legendary shimmer */}
          {isLegendary && (
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50, borderRadius: "12px",
              background: "linear-gradient(110deg,transparent 20%,rgba(255,170,0,0.08) 40%,transparent 60%)",
              backgroundSize: "200% 100%", animation: "legendaryShimmer 4s ease-in-out infinite",
            }} />
          )}

          {/* Corner brackets */}
          {(["tl","tr","bl","br"] as const).map(corner => {
            const isTop = corner[0] === "t", isLeft = corner[1] === "l";
            return (
              <div key={corner} style={{
                position: "absolute", pointerEvents: "none",
                top: isTop ? "4px" : "auto", bottom: !isTop ? "4px" : "auto",
                left: isLeft ? "4px" : "auto", right: !isLeft ? "4px" : "auto",
                width: rar.cornerSize, height: rar.cornerSize,
                borderTop:    isTop  ? `2px solid ${rarityColor}` : "none",
                borderBottom: !isTop ? `2px solid ${rarityColor}` : "none",
                borderLeft:   isLeft ? `2px solid ${rarityColor}` : "none",
                borderRight: !isLeft ? `2px solid ${rarityColor}` : "none",
                opacity: isLegendary ? 1 : 0.7,
              }} />
            );
          })}

          {/* Header */}
          <div style={{
            position: "relative", display: "flex", alignItems: "center", padding: "6px 8px 4px", flexShrink: 0, zIndex: 10,
            background: "linear-gradient(180deg,rgba(0,0,0,0.5) 0%,transparent 100%)",
            borderBottom: `1px solid ${cfg.primary}22`,
          }}>
            {/* Energy bubble */}
            <div style={{
              flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              width: bubbleSize, height: bubbleSize, fontSize: bubbleFont, fontWeight: 900, borderRadius: "50%",
              background: `radial-gradient(circle,${cfg.primaryDim},#000)`,
              border: `1.5px solid ${cfg.primary}`, color: cfg.primary,
              boxShadow: `0 0 10px ${cfg.primaryGlow},inset 0 0 6px rgba(0,0,0,0.5)`,
            }}>
              {card.energyCost ?? card.id}
            </div>

            {/* Title */}
            <div style={{ flex: 1, textAlign: "center", padding: "0 4px", position: "relative" }}>
              <div style={{
                fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.2,
                fontSize: card.name.length > 16 ? `calc(${fs.title} * 0.85)` : card.name.length > 12 ? `calc(${fs.title} * 0.92)` : fs.title,
                fontFamily: "'Arial Black','Impact',sans-serif",
                textShadow: `0 0 12px ${cfg.primary}99,0 1px 2px rgba(0,0,0,0.9)`,
              }}>
                {card.name}
              </div>
              <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "60%", height: "1px", background: `linear-gradient(90deg,transparent,${cfg.primary}88,transparent)` }} />
            </div>

            {/* Rarity */}
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
              <span style={{ fontSize: "0.45rem", color: rarityColor, fontWeight: 700, letterSpacing: "0.1em" }}>{rar.label}</span>
              <span style={{ color: rarityColor, fontSize: size === "lg" ? "12px" : "10px", lineHeight: 1, filter: `drop-shadow(0 0 4px ${rar.glow})` }}>{rar.diamond}</span>
            </div>

            {/* Favorite button */}
            {playerId && !locked && (
              <div style={{ marginLeft: "4px", opacity: 0.8 }}>
                <FavoriteButton
                  cardId={card.id}
                  playerId={playerId}
                  isFavorite={isFavorite}
                  onToggle={onFavoriteChange}
                  size="small"
                />
              </div>
            )}

            {/* New badge */}
            {acqDate.isNew && (
              <div
                title={`Acquired: ${acqDate.fullDate}`}
                style={{
                  fontSize: size === "lg" ? "9px" : size === "md" ? "7px" : "6px",
                  fontWeight: 900,
                  color: "#22ff22",
                  textShadow: "0 0 6px rgba(34,255,34,0.8)",
                  whiteSpace: "nowrap",
                  marginLeft: "2px",
                  padding: "2px 4px",
                  background: "rgba(34,255,34,0.1)",
                  border: "1px solid rgba(34,255,34,0.4)",
                  borderRadius: "3px",
                  letterSpacing: "0.05em",
                }}
              >
                {acqDate.badge}
              </div>
            )}
          </div>

          {/* Artwork area */}
          <div style={{ position: "relative", flexShrink: 0, overflow: "hidden", height: "50%", margin: "0 4px", borderRadius: "6px", border: `1px solid ${cfg.primary}44`, boxShadow: `inset 0 0 30px rgba(0,0,0,0.7),0 0 10px ${cfg.primaryGlow}` }}>
            {(() => {
              const slug = card.name.toLowerCase().replace(/\s+-\d+$/, '').replace(/\+/g, '').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
              const artUrl = card.artworkUrl ?? `/card-artwork/${slug}.jpg`;
              return locked ? null : (
                <img
                  src={artUrl}
                  alt={card.name}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block", filter: "brightness(0.9) contrast(1.1) saturate(1.2)" }}
                  onError={e => { const el = e.currentTarget as HTMLImageElement; el.style.display = "none"; const fb = el.nextElementSibling as HTMLElement; if (fb) fb.style.display = "flex"; }}
                />
              );
            })()}
            <div style={{ width: "100%", height: "100%", display: locked ? "flex" : "none", alignItems: "center", justifyContent: "center", background: `radial-gradient(ellipse at center,${cfg.primaryDim}cc 0%,#050810 100%)`, position: locked ? "relative" : "absolute", inset: locked ? "auto" : 0, flexDirection: "column", gap: "6px" }}>
              {locked ? (
                <span style={{ fontSize: "2.5rem", opacity: 0.4 }}>🔒</span>
              ) : (
                <>
                  <span style={{ fontSize: size === "lg" ? "3rem" : "2rem", filter: `drop-shadow(0 0 12px ${cfg.primary})`, lineHeight: 1 }}>
                    {card.category === "X01 GOOD" ? "🎯"
                      : card.category === "X01 BAD" ? "⚡"
                      : card.category === "CRICKET GOOD" ? "🏏"
                      : card.category === "CRICKET BAD" ? "💀"
                      : card.category === "WILDCARD GOOD" ? "⭐"
                      : "🌩️"}
                  </span>
                  <span style={{ fontSize: size === "lg" ? "9px" : "7px", color: cfg.primary, fontWeight: 700, letterSpacing: "0.12em", opacity: 0.6, textAlign: "center", padding: "0 4px" }}>{card.category}</span>
                </>
              )}
            </div>
            <div style={{ position: "absolute", inset: "auto 0 0 0", height: "33%", background: "linear-gradient(to top,#060912,transparent)", pointerEvents: "none" }} />
            {(isRare || isLegendary) && !locked && (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: "6px", boxShadow: `inset 0 0 20px ${isLegendary ? "#ffaa0033" : cfg.primaryGlow.replace("0.5","0.2")}` }} />
            )}
          </div>

          {/* Category bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", flexShrink: 0, background: cfg.barGradient }}>
            <span style={{ color: cfg.barText, fontSize: iconFont, fontWeight: 900, textShadow: `0 0 8px ${cfg.barText}` }}>{cfg.icon}</span>
            <span style={{ color: cfg.barText, fontSize: fs.cat, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>{card.category}</span>
          </div>

          {/* Effect text box */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", margin: "0 4px 4px", borderRadius: "8px", overflow: "hidden", background: "linear-gradient(180deg,rgba(0,0,0,0.65) 0%,rgba(2,5,12,0.8) 100%)", border: "1px solid rgba(255,255,255,0.07)", padding: size === "lg" ? "8px 10px 6px" : "5px 8px 4px" }}>
            <p style={{ color: "#fff", fontSize: fs.effect, lineHeight: 1.45, margin: 0 }}>
              {highlightEffect(card.effect, cfg.effectHighlight)}
            </p>
            {card.flavourText && (
              <p style={{ margin: "4px 0 0", fontStyle: "italic", fontSize: fs.flavour, color: "rgba(255,255,255,0.4)", lineHeight: 1.3, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "4px" }}>
                "{card.flavourText}"
              </p>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: "6px", flexShrink: 0, gap: "4px" }}>
            <div style={{ height: "1px", flex: 1, margin: "0 8px", background: `linear-gradient(90deg,transparent,${cfg.primary}44,transparent)` }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: size === "lg" ? "9px" : "7px", color: "rgba(255,255,255,0.6)", fontWeight: 900, fontFamily: "'Arial Black',sans-serif", letterSpacing: "0.2em", textShadow: `0 0 6px ${cfg.primary}55` }}>TKDL</span>
              <span style={{ fontSize: "6px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.15em" }}>CARD CLASH</span>
            </div>
            <div style={{ height: "1px", flex: 1, margin: "0 8px", background: `linear-gradient(90deg,${cfg.primary}44,transparent)` }} />
          </div>
        </div>

        {/* ── BACK ── */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "12px", overflow: "hidden",
          backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
        }}>
          <div style={{
            width: "100%", height: "100%",
            backgroundImage: "url('/cards/card-backs.png')",
            backgroundSize: "300% 200%",
            backgroundPosition: cfg.cardBackPosition,
            backgroundRepeat: "no-repeat",
          }} />
        </div>
      </div>
    </div>
  );
}

export type { CardData };
