import React, { useState } from "react";
import { ChevronUp, ChevronDown, RotateCw } from "lucide-react";

interface CardDisplayProps {
  id: string;
  name: string;
  description: string;
  cardType: "GOOD" | "BAD";
  rarity: "COMMON" | "RARE" | "LEGENDARY";
  effect: string;
  gameMode: "X01" | "CRICKET" | "WILDCARD";
  quantity?: number;
  onClick?: () => void;
  showQuantity?: boolean;
  interactive?: boolean;
}

const RARITY_CONFIG = {
  COMMON: {
    bg: "linear-gradient(135deg, #6B7280 0%, #4B5563 100%)",
    border: "#9CA3AF",
    text: "#E5E7EB",
    glow: "rgba(107, 114, 128, 0.4)",
    accent: "#D1D5DB",
  },
  RARE: {
    bg: "linear-gradient(135deg, #1E40AF 0%, #1E3A8A 100%)",
    border: "#3B82F6",
    text: "#DBEAFE",
    glow: "rgba(59, 130, 246, 0.5)",
    accent: "#60A5FA",
  },
  LEGENDARY: {
    bg: "linear-gradient(135deg, #D97706 0%, #92400E 100%)",
    border: "#FBBF24",
    text: "#FEF3C7",
    glow: "rgba(251, 191, 36, 0.6)",
    accent: "#FBBF24",
  },
};

const CARD_TYPE_CONFIG = {
  GOOD: { label: "BOOST", color: "#22C55E", bg: "rgba(34, 197, 94, 0.15)" },
  BAD: { label: "CURSE", color: "#EF4444", bg: "rgba(239, 68, 68, 0.15)" },
};

export function CardDisplay({
  id,
  name,
  description,
  cardType,
  rarity,
  effect,
  gameMode,
  quantity = 0,
  onClick,
  showQuantity = true,
  interactive = true,
}: CardDisplayProps) {
  const [isInspecting, setIsInspecting] = useState(false);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isSpinning, setIsSpinning] = useState(false);

  const config = RARITY_CONFIG[rarity];
  const typeConfig = CARD_TYPE_CONFIG[cardType];

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!interactive || !isInspecting) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientY - rect.top - rect.height / 2) / 12;
    const y = (rect.width / 2 - (e.clientX - rect.left)) / 12;
    setRotation({ x, y });
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
  };

  const handleSpin = () => {
    setIsSpinning(true);
    setTimeout(() => setIsSpinning(false), 600);
  };

  const cardHeight = isInspecting ? "500px" : "340px";

  return (
    <div
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: isInspecting ? "1200px" : "none",
        cursor: interactive ? "pointer" : "default",
        position: "relative",
      }}
    >
      {/* Main Card */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: cardHeight,
          borderRadius: "16px",
          background: config.bg,
          border: `3px solid ${config.border}`,
          boxShadow: `
            0 0 30px ${config.glow},
            inset 0 0 20px ${config.glow},
            0 8px 16px rgba(0,0,0,0.4)
          `,
          overflow: "hidden",
          transition: isSpinning ? "none" : "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          transform: isInspecting
            ? `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(1.02)`
            : isSpinning
              ? "rotateY(360deg)"
              : "scale(1) translateZ(0)",
          transformStyle: isInspecting ? "preserve-3d" : "flat",
          transitionProperty: isSpinning ? "transform" : "all",
          transitionDuration: isSpinning ? "600ms" : "300ms",
          transitionTimingFunction: isSpinning ? "cubic-bezier(0.68, -0.55, 0.265, 1.55)" : "cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Background Pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              radial-gradient(circle at 20% 50%, ${config.accent}08 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, ${config.accent}08 0%, transparent 50%)
            `,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Shine Effect */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "-100%",
            width: "100%",
            height: "100%",
            background: `linear-gradient(
              90deg,
              transparent,
              ${config.accent}20,
              transparent
            )`,
            pointerEvents: "none",
            zIndex: 1,
            animation: isInspecting ? "none" : "shimmer 3s infinite",
          }}
        />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div
            style={{
              padding: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: `1px solid ${config.border}33`,
            }}
          >
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", flex: 1 }}>
              <span
                style={{
                  background: typeConfig.bg,
                  color: typeConfig.color,
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "6px 10px",
                  borderRadius: "6px",
                  letterSpacing: "0.06em",
                  fontFamily: "Oswald, sans-serif",
                  textTransform: "uppercase",
                }}
              >
                {typeConfig.label}
              </span>
              <span
                style={{
                  background: `${config.border}22`,
                  color: config.accent,
                  fontSize: "9px",
                  fontWeight: 700,
                  padding: "6px 10px",
                  borderRadius: "6px",
                  letterSpacing: "0.05em",
                  fontFamily: "Oswald, sans-serif",
                  textTransform: "uppercase",
                }}
              >
                {gameMode}
              </span>
            </div>
            <span
              style={{
                fontSize: "9px",
                fontWeight: 800,
                color: config.accent,
                letterSpacing: "0.08em",
                fontFamily: "Oswald, sans-serif",
                textTransform: "uppercase",
                textShadow: `0 0 10px ${config.glow}`,
              }}
            >
              {rarity}
            </span>
          </div>

          {/* Card Name */}
          <div style={{ padding: "12px 16px 0" }}>
            <h3
              style={{
                margin: 0,
                fontSize: isInspecting ? "24px" : "18px",
                fontWeight: 900,
                color: config.text,
                fontFamily: "Oswald, sans-serif",
                letterSpacing: "0.02em",
                lineHeight: 1.2,
                textShadow: `0 2px 8px rgba(0,0,0,0.6), 0 0 10px ${config.glow}`,
              }}
            >
              {name}
            </h3>
          </div>

          {/* Description & Effect */}
          <div style={{ padding: "12px 16px", flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
            <p
              style={{
                margin: 0,
                fontSize: isInspecting ? "12px" : "11px",
                color: `${config.text}dd`,
                fontStyle: "italic",
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>

            <div
              style={{
                background: `rgba(0, 0, 0, 0.4)`,
                padding: "10px 12px",
                borderRadius: "8px",
                borderLeft: `4px solid ${config.accent}`,
                backdropFilter: "blur(5px)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: isInspecting ? "11px" : "10px",
                  color: config.text,
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                <strong style={{ color: config.accent }}>→</strong> {effect}
              </p>
            </div>
          </div>

          {/* Footer - Quantity */}
          {showQuantity && (
            <div
              style={{
                padding: "0 16px 16px",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <div
                style={{
                  background: `${config.border}44`,
                  color: config.accent,
                  width: "48px",
                  height: "48px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  fontWeight: 900,
                  border: `2px solid ${config.border}`,
                  boxShadow: `0 0 15px ${config.glow}`,
                }}
              >
                {quantity}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inspect Controls */}
      {interactive && isInspecting && (
        <div
          style={{
            position: "absolute",
            bottom: "-50px",
            left: 0,
            right: 0,
            display: "flex",
            gap: "10px",
            justifyContent: "center",
            padding: "8px",
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSpin();
            }}
            style={{
              background: "linear-gradient(135deg, #0066ff 0%, #0052cc 100%)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "10px 14px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 12px rgba(0, 102, 255, 0.3)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 16px rgba(0, 102, 255, 0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(0, 102, 255, 0.3)";
            }}
          >
            <RotateCw size={14} />
            Spin
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsInspecting(false);
            }}
            style={{
              background: "rgba(100, 100, 100, 0.5)",
              color: "white",
              border: "1px solid rgba(200, 200, 200, 0.3)",
              borderRadius: "8px",
              padding: "10px 14px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(100, 100, 100, 0.7)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(100, 100, 100, 0.5)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            }}
          >
            <ChevronDown size={14} />
            Close
          </button>
        </div>
      )}

      {/* Inspect Button */}
      {interactive && !isInspecting && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsInspecting(true);
          }}
          style={{
            position: "absolute",
            bottom: "-45px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, #0066ff 0%, #0052cc 100%)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s ease",
            boxShadow: "0 4px 12px rgba(0, 102, 255, 0.3)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateX(-50%) translateY(-2px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 16px rgba(0, 102, 255, 0.4)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateX(-50%) translateY(0)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(0, 102, 255, 0.3)";
          }}
        >
          <ChevronUp size={14} />
          Inspect
        </button>
      )}

      <style>{`
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
