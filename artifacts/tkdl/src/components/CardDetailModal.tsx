import React, { useState } from "react";
import { X } from "lucide-react";

export function CardDetailModal({ card, isOpen, onClose }: { card: any; isOpen: boolean; onClose: () => void }) {
  if (!isOpen || !card) return null;

  const rarityColors: Record<string, { text: string; bg: string; border: string }> = {
    Common: { text: "#9ca3af", bg: "#9ca3af22", border: "#9ca3af" },
    Rare: { text: "#3b82f6", bg: "#3b82f622", border: "#3b82f6" },
    Legendary: { text: "#ffd24a", bg: "#ffd24a22", border: "#ffd24a" },
  };

  const gameModeBg: Record<string, string> = {
    X01: "#00e5ff",
    Cricket: "#00ff88",
    Wildcard: "#ffd24a",
  };

  const rarity = card.rarity || "Common";
  const colors = rarityColors[rarity] || rarityColors.Common;

  // Mock card effects based on name
  const effectMap: Record<string, string> = {
    "Power Surge": "+50 to your turn total. Add 50 bonus points per turn.",
    "Treble Hunter": "Your next treble hit counts as 1.3x (20=78 instead of 60).",
    "Big Game Player": "If you score 80+ (not on double), gain +35 bonus next leg.",
    "Safety Net": "If on double, opponent can't play penalty cards this turn.",
    "Unstoppable Checkout": "When on double, opponent can't play penalty cards.",
    "Invincible": "Block any negative card this turn.",
    "Golden Dart": "Next dart scores double value this turn.",
  };

  const effect = effectMap[card.cardName] || "A powerful card that affects your darts scoring and match strategy.";

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
          border: `2px solid ${gameModeBg[card.gameMode] || "#ffd24a"}`,
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
          zIndex: 1000,
          boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 40px ${gameModeBg[card.gameMode] || "#ffd24a"}33`,
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

        {/* Card Header */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{
            fontSize: "12px",
            color: gameModeBg[card.gameMode] || "#ffd24a",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: "600",
            marginBottom: "8px",
          }}>
            {card.gameMode}
          </div>
          <div style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "#fff",
            marginBottom: "12px",
          }}>
            {card.cardName}
          </div>

          {/* Rarity Badge */}
          <div style={{
            display: "inline-block",
            padding: "8px 16px",
            background: colors.bg,
            border: `2px solid ${colors.border}`,
            borderRadius: "6px",
            color: colors.text,
            fontWeight: "600",
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            {rarity}
          </div>
        </div>

        {/* Card Image Preview */}
        <div style={{
          width: "100%",
          height: "200px",
          background: `url('${card.image}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: "8px",
          border: `2px solid ${gameModeBg[card.gameMode] || "#ffd24a"}`,
          marginBottom: "20px",
          boxShadow: `0 0 20px ${gameModeBg[card.gameMode] || "#ffd24a"}33`,
        }} />

        {/* Effect Description */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.6)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: "600",
            marginBottom: "8px",
          }}>
            Card Effect
          </div>
          <div style={{
            fontSize: "14px",
            color: "#fff",
            lineHeight: "1.6",
            padding: "12px",
            background: "rgba(0,0,0,0.2)",
            borderRadius: "6px",
            border: `1px solid ${gameModeBg[card.gameMode] || "#ffd24a"}33`,
          }}>
            {effect}
          </div>
        </div>

        {/* Quantity */}
        <div style={{
          padding: "12px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "6px",
          border: "1px solid rgba(255,255,255,0.1)",
          marginBottom: "20px",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.6)",
            marginBottom: "4px",
          }}>
            You Own
          </div>
          <div style={{
            fontSize: "24px",
            fontWeight: "700",
            color: gameModeBg[card.gameMode] || "#ffd24a",
          }}>
            {card.quantity || 0}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px",
            background: `${gameModeBg[card.gameMode] || "#ffd24a"}22`,
            border: `2px solid ${gameModeBg[card.gameMode] || "#ffd24a"}`,
            color: gameModeBg[card.gameMode] || "#ffd24a",
            fontWeight: "600",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = `${gameModeBg[card.gameMode] || "#ffd24a"}33`;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = `${gameModeBg[card.gameMode] || "#ffd24a"}22`;
          }}
        >
          Close
        </button>
      </div>
    </>
  );
}
