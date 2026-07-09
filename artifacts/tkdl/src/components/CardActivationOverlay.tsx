/**
 * CardActivationOverlay - Card modal only (minimal)
 * Shows enlarged card in modal on tap. Doesn't block scorer.
 */

import React, { useState, useEffect } from "react";
import { TKDLCard } from "./TKDLCard";
import type { CardData } from "@/lib/cards-data";

interface CardState extends CardData {
  isActive?: boolean;
  modifier?: number;
}

interface CardActivationOverlayProps {
  equippedCards: CardState[];
  isVisible: boolean;
  selectedCard?: CardState | null;
  onCardActivate?: (cardId: number | string) => void;
  onClose?: () => void;
}

export function CardActivationOverlay({
  equippedCards,
  isVisible,
  selectedCard,
  onCardActivate,
}: CardActivationOverlayProps) {
  const [enlargedCard, setEnlargedCard] = useState<CardState | null>(selectedCard || null);

  // Sync selectedCard prop to local state
  useEffect(() => {
    if (selectedCard) {
      setEnlargedCard(selectedCard);
    }
  }, [selectedCard]);

  if (!isVisible || equippedCards.length === 0) return null;

  // Only render modal when a card is enlarged
  if (!enlargedCard) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        zIndex: 50,
        pointerEvents: "auto",
      }}
      onClick={() => setEnlargedCard(null)}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "14px",
          width: "min(78vw, 220px)",
          maxHeight: "92vh",
          overflowY: "auto",
          margin: "12px",
          padding: "16px 14px",
          background: "rgba(10,14,20,0.92)",
          border: "1px solid rgba(0,180,255,0.25)",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          animation: "cc-panel-in 0.18s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes cc-panel-in {
            from { opacity: 0; transform: translateX(24px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}</style>

        {/* Card */}
        <div>
          <TKDLCard card={enlargedCard} size="sm" locked={false} />
        </div>

        {/* Effect details */}
        <div
          style={{
            background: "rgba(0,180,255,0.05)",
            border: "1px solid rgba(0,180,255,0.3)",
            borderRadius: "10px",
            padding: "10px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#00d4ff",
              marginBottom: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Effect
          </div>
          <div style={{ fontSize: "11px", color: "#fff", lineHeight: 1.4 }}>
            {enlargedCard.effect}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
          {!enlargedCard.isActive && (
            <button
              onClick={() => {
                onCardActivate?.(enlargedCard.id.toString());
                setEnlargedCard(null);
              }}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "linear-gradient(135deg, #00d4ff, #0088ff)",
                border: "none",
                borderRadius: "9px",
                color: "#000",
                fontWeight: 900,
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: "0 4px 16px rgba(0,180,255,0.35)",
              }}
            >
              ⚡ CONFIRM
            </button>
          )}
          <button
            onClick={() => setEnlargedCard(null)}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: "9px",
              color: "#fff",
              fontWeight: 700,
              fontSize: "12px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
