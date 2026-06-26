/**
 * CardActivationOverlay - Display equipped cards during match
 * Shows cards as full TKDLCard components with tap-to-enlarge modal
 */

import React, { useState } from "react";
import { TKDLCard } from "./TKDLCard";
import { X } from "lucide-react";
import type { CardData } from "@/lib/cards-data";

interface CardState extends CardData {
  isActive?: boolean;
  modifier?: number;
}

interface CardActivationOverlayProps {
  equippedCards: CardState[];
  isVisible: boolean;
  activatedCard?: CardState;
  scoreModifier?: number;
  onCardActivate?: (cardId: number | string) => void;
  onClose?: () => void;
}

export function CardActivationOverlay({
  equippedCards,
  isVisible,
  onCardActivate,
  onClose,
}: CardActivationOverlayProps) {
  const [enlargedCard, setEnlargedCard] = useState<CardState | null>(null);

  if (!isVisible || equippedCards.length === 0) return null;

  const activeCards = equippedCards.filter(c => !c.isActive);
  const usedCards = equippedCards.filter(c => c.isActive);

  return (
    <>
      {/* Main card panel - bottom area */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        padding: "16px",
        background: "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.85), transparent)",
        borderTop: "2px solid rgba(0,180,255,0.3)",
        maxHeight: "45vh",
        overflow: "auto",
      }}>
        {/* Header */}
        <div style={{
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{
              fontSize: "12px",
              fontWeight: 900,
              color: "#00d4ff",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}>
              ⚡ YOUR CARDS
            </div>
            <div style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.4)",
              marginTop: "4px",
            }}>
              {activeCards.length} available · {usedCards.length} used
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.4)",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Cards grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: "12px",
        }}>
          {equippedCards.map((card) => (
            <div
              key={card.id}
              onClick={() => !card.isActive && setEnlargedCard(card)}
              style={{
                cursor: card.isActive ? "not-allowed" : "pointer",
                transform: "scale(1)",
                transition: "transform 0.2s, filter 0.2s",
                filter: card.isActive ? "grayscale(80%) brightness(0.6)" : "none",
                opacity: card.isActive ? 0.5 : 1,
                pointerEvents: card.isActive ? "none" : "auto",
              }}
              onMouseEnter={(e) => {
                if (!card.isActive) {
                  (e.currentTarget as HTMLElement).style.transform = "scale(1.08)";
                  (e.currentTarget as HTMLElement).style.filter = "drop-shadow(0 0 16px rgba(0,180,255,0.6))";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                (e.currentTarget as HTMLElement).style.filter = card.isActive ? "grayscale(80%) brightness(0.6)" : "none";
              }}
            >
              <TKDLCard card={card} size="sm" locked={card.isActive} />
              {card.isActive && (
                <div style={{
                  marginTop: "6px",
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#ffaa00",
                  textAlign: "center",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}>
                  ✓ Used
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Enlarged card modal */}
      {enlargedCard && (
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
              animation: "fadeIn 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Card display */}
            <div style={{ transform: "scale(1.3)", transformOrigin: "center" }}>
              <TKDLCard card={enlargedCard} size="lg" locked={false} />
            </div>

            {/* Effect details */}
            <div style={{
              background: "rgba(0,180,255,0.05)",
              border: "1px solid rgba(0,180,255,0.3)",
              borderRadius: "12px",
              padding: "16px",
              width: "100%",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#00d4ff", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
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
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
                }}
              >
                CLOSE
              </button>
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
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 24px rgba(0,180,255,0.6)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,180,255,0.4)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                }}
              >
                ⚡ CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
