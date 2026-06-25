import React, { useState } from "react";
import { X } from "lucide-react";
import { CardImage } from "./CardImage";

export function CardDetailModal({ card, isOpen, onClose }: { card: any; isOpen: boolean; onClose: () => void }) {
  const [isFlipped, setIsFlipped] = useState(false);

  if (!isOpen || !card) return null;

  const rarityColors: Record<string, { text: string; bg: string; border: string }> = {
    COMMON: { text: "#9ca3af", bg: "#9ca3af22", border: "#9ca3af" },
    RARE: { text: "#3b82f6", bg: "#3b82f622", border: "#3b82f6" },
    LEGENDARY: { text: "#ffd24a", bg: "#ffd24a22", border: "#ffd24a" },
  };

  const gameModeBg: Record<string, string> = {
    X01: "#00e5ff",
    CRICKET: "#00ff88",
    WILDCARD: "#ffd24a",
  };

  const rarity = card.rarity || "COMMON";
  const colors = rarityColors[rarity] || rarityColors.COMMON;
  const gameMode = card.gameMode || "X01";

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(4px)",
          zIndex: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "linear-gradient(135deg, rgba(20,20,40,0.95), rgba(30,25,50,0.95))",
          border: `2px solid ${gameModeBg[gameMode] || "#ffd24a"}`,
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
          zIndex: 1000,
          boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 40px ${gameModeBg[gameMode] || "#ffd24a"}33`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "6px",
            padding: "8px",
            cursor: "pointer",
            color: "#fff",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "rgba(255,255,255,0.2)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "rgba(255,255,255,0.1)";
          }}
        >
          <X size={18} />
        </button>

        {/* 3D Flip Card */}
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          style={{
            perspective: "1000px",
            marginBottom: "20px",
            cursor: "pointer",
            height: "300px",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              transition: "transform 0.6s",
              transformStyle: "preserve-3d",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* Front of card */}
            <div
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                backfaceVisibility: "hidden",
                background: `linear-gradient(135deg, ${gameModeBg[gameMode] || "#ffd24a"}20, rgba(0,0,0,0.3))`,
                border: `2px solid ${gameModeBg[gameMode] || "#ffd24a"}`,
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px",
                boxSizing: "border-box",
              }}
            >
              <CardImage card={card} size="large" />

              <div style={{ textAlign: "center", marginTop: "12px" }}>
                <div
                  style={{
                    fontSize: "12px",
                    color: gameModeBg[gameMode] || "#ffd24a",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontWeight: "600",
                    marginBottom: "8px",
                  }}
                >
                  {gameMode}
                </div>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#fff",
                    marginBottom: "8px",
                  }}
                >
                  {card.name || card.cardName}
                </div>
                <div
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "4px",
                    color: colors.text,
                    fontWeight: "600",
                    fontSize: "10px",
                    textTransform: "uppercase",
                  }}
                >
                  {rarity}
                </div>
              </div>

              <div style={{ textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                ↻ Click to flip
              </div>
            </div>

            {/* Back of card (Effect) */}
            <div
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                background: `linear-gradient(135deg, rgba(0,0,0,0.4), ${gameModeBg[gameMode] || "#ffd24a"}15)`,
                border: `2px solid ${gameModeBg[gameMode] || "#ffd24a"}`,
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "16px",
                boxSizing: "border-box",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontWeight: "600",
                    marginBottom: "8px",
                  }}
                >
                  Card Effect
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#fff",
                    lineHeight: "1.5",
                  }}
                >
                  {card.effect || card.description || "Effect details loading..."}
                </div>
              </div>

              <div style={{ textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                ↻ Click to flip back
              </div>
            </div>
          </div>
        </div>

        {/* Card Info */}
        <div style={{ display: "grid", gap: "12px" }}>
          <div
            style={{
              padding: "12px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.1)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>
              You Own
            </div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: gameModeBg[gameMode] || "#ffd24a" }}>
              ×{card.quantity || 0}
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px",
            background: `${gameModeBg[gameMode] || "#ffd24a"}22`,
            border: `2px solid ${gameModeBg[gameMode] || "#ffd24a"}`,
            color: gameModeBg[gameMode] || "#ffd24a",
            fontWeight: "600",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            transition: "all 0.2s",
            marginTop: "16px",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = `${gameModeBg[gameMode] || "#ffd24a"}33`;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = `${gameModeBg[gameMode] || "#ffd24a"}22`;
          }}
        >
          Close
        </button>
      </div>
    </>
  );
}
