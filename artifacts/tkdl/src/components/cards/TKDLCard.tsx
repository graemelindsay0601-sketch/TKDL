import React, { useState } from "react";

export interface CardData {
  id: number;
  name: string;
  category: "X01 GOOD" | "X01 BAD" | "CRICKET GOOD" | "CRICKET BAD" | "WILDCARD GOOD" | "WILDCARD BAD";
  rarity: "COMMON" | "RARE" | "LEGENDARY";
  effect: string;
  flavourText: string;
  energyCost: number;
  artworkUrl: string;
}

interface TKDLCardProps {
  card: CardData;
  size?: "sm" | "md" | "lg";
}

const RARITY_COLORS = {
  COMMON: "#c0c0c0",     // Silver
  RARE: "#4169e1",       // Blue
  LEGENDARY: "#ffd700",  // Gold
};

const CARD_BACK_COORDS: Record<CardData["category"], { col: number; row: number }> = {
  "X01 GOOD": { col: 0, row: 0 },
  "X01 BAD": { col: 1, row: 0 },
  "CRICKET GOOD": { col: 2, row: 0 },
  "CRICKET BAD": { col: 0, row: 1 },
  "WILDCARD GOOD": { col: 1, row: 1 },
  "WILDCARD BAD": { col: 2, row: 1 },
};

const CARD_SIZES = {
  sm: { width: "120px", height: "168px", fontSize: "10px" },
  md: { width: "200px", height: "280px", fontSize: "12px" },
  lg: { width: "280px", height: "392px", fontSize: "14px" },
};

export function TKDLCard({ card, size = "lg" }: TKDLCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const sizeStyle = CARD_SIZES[size];
  const backCoords = CARD_BACK_COORDS[card.category];
  
  // Card back position (3 cols × 2 rows grid)
  const backBgPosition = `${backCoords.col * 33.33}% ${backCoords.row * 50}%`;
  const backBgSize = "300% 200%";

  return (
    <div
      onClick={() => setIsFlipped(!isFlipped)}
      style={{
        perspective: "1000px",
        cursor: "pointer",
        width: sizeStyle.width,
        height: sizeStyle.height,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 0.6s",
        }}
      >
        {/* FRONT - Card Artwork */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            backfaceVisibility: "hidden",
            backgroundImage: `url('${card.artworkUrl}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            borderRadius: "12px",
            border: `3px solid ${RARITY_COLORS[card.rarity]}`,
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            padding: `${size === "sm" ? "6px" : size === "md" ? "10px" : "14px"}`,
            boxSizing: "border-box",
            background: `linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.2)), url('${card.artworkUrl}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Card Title */}
          <div
            style={{
              color: "#fff",
              fontWeight: "bold",
              textShadow: "1px 1px 3px rgba(0,0,0,0.7)",
              fontSize: size === "sm" ? "10px" : size === "md" ? "13px" : "16px",
              marginBottom: "auto",
            }}
          >
            {card.name}
          </div>

          {/* Energy Cost Badge */}
          <div
            style={{
              position: "absolute",
              top: size === "sm" ? "4px" : size === "md" ? "6px" : "8px",
              right: size === "sm" ? "4px" : size === "md" ? "6px" : "8px",
              width: size === "sm" ? "24px" : size === "md" ? "32px" : "40px",
              height: size === "sm" ? "24px" : size === "md" ? "32px" : "40px",
              borderRadius: "50%",
              backgroundColor: RARITY_COLORS[card.rarity],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: card.rarity === "RARE" ? "#fff" : "#000",
              fontWeight: "bold",
              fontSize: size === "sm" ? "12px" : size === "md" ? "14px" : "16px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            }}
          >
            ⚡{card.energyCost}
          </div>

          {/* Effect Text */}
          <div
            style={{
              color: "#fff",
              fontSize: size === "sm" ? "8px" : size === "md" ? "10px" : "12px",
              lineHeight: "1.3",
              textShadow: "1px 1px 2px rgba(0,0,0,0.7)",
              backgroundColor: "rgba(0,0,0,0.5)",
              padding: size === "sm" ? "3px" : size === "md" ? "5px" : "8px",
              borderRadius: "6px",
              marginBottom: size === "sm" ? "2px" : size === "md" ? "4px" : "6px",
            }}
          >
            {card.effect}
          </div>

          {/* Flavour Text */}
          <div
            style={{
              color: "#ddd",
              fontSize: size === "sm" ? "7px" : size === "md" ? "9px" : "11px",
              fontStyle: "italic",
              textShadow: "1px 1px 2px rgba(0,0,0,0.7)",
              opacity: 0.8,
            }}
          >
            "{card.flavourText}"
          </div>
        </div>

        {/* BACK - Card Back */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            backgroundImage: "url('/cards/card-backs.png')",
            backgroundPosition: backBgPosition,
            backgroundSize: backBgSize,
            backgroundRepeat: "no-repeat",
            borderRadius: "12px",
            border: `3px solid ${RARITY_COLORS[card.rarity]}`,
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1a1a1a",
            color: "#fff",
            fontSize: size === "sm" ? "10px" : size === "md" ? "13px" : "16px",
            fontWeight: "bold",
          }}
        >
          {card.category}
        </div>
      </div>
    </div>
  );
}
