/**
 * CardActivationOverlay - Card modal only (minimal)
 * Shows enlarged card in modal on tap. Doesn't block scorer.
 */

import React, { useState } from "react";
import { TKDLCard } from "./TKDLCard";
import type { CardData } from "@/lib/cards-data";

interface CardState extends CardData {
  isActive?: boolean;
  modifier?: number;
}

interface CardActivationOverlayProps {
  equippedCards: CardState[];
  isVisible: boolean;
  onCardActivate?: (cardId: number | string) => void;
  onClose?: () => void;
}

export function CardActivationOverlay({
  equippedCards,
  isVisible,
  onCardActivate,
}: CardActivationOverlayProps) {
  const [enlargedCard, setEnlargedCard] = useState<CardState | null>(null);

  if (!isVisible || equippedCards.length === 0) return null;

  // Only render modal when a card is enlarged
  if (!enlargedCard) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "16px",
        backdropFilter: "blur(4px)",
      }}
      onClick={() => setEnlargedCard(null)}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          maxWidth: "360px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Enlarged card */}
        <div style={{ transform: "scale(1.3)", transformOrigin: "center" }}>
          <TKDLCard card={enlargedCard} size="lg" locked={false} />
        </div>

        {/* Effect details */}
        <div
          style={{
            background: "rgba(0,180,255,0.05)",
            border: "1px solid rgba(0,180,255,0.3)",
            borderRadius: "12px",
            padding: "16px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#00d4ff",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Effect
          </div>
          <div style={{ fontSize: "13px", color: "#fff", lineHeight: 1.5 }}>
            {enlargedCard.effect}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "10px", width: "100%" }}>
          <button
            onClick={() => setEnlargedCard(null)}
            style={{
              flex: 1,
              padding: "14px 20px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: "10px",
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.08)";
            }}
          >
            CLOSE
          </button>
          {!enlargedCard.isActive && (
            <button
              onClick={() => {
                onCardActivate?.(enlargedCard.id);
                setEnlargedCard(null);
              }}
              style={{
                flex: 1,
                padding: "14px 20px",
                background: "linear-gradient(135deg, #00d4ff, #0088ff)",
                border: "none",
                borderRadius: "10px",
                color: "#000",
                fontWeight: 900,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: "0 4px 16px rgba(0,180,255,0.4)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 6px 24px rgba(0,180,255,0.6)";
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 4px 16px rgba(0,180,255,0.4)";
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(0)";
              }}
            >
              ⚡ CONFIRM
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
