import React, { useState } from "react";
import { X } from "lucide-react";

export interface AchievementRewardData {
  key: string;
  name: string;
  icon: string;
  description: string;
  rarity: string;
  coinReward?: number;
  packReward?: "SINGLE" | "FIVE" | "TEN";
}

interface AchievementRewardModalProps {
  achievement: AchievementRewardData | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Universal modal for displaying achievement details and rewards
 * Used across Card Clash, Practice, Master501, Format, Tour modes
 */
export const AchievementRewardModal: React.FC<AchievementRewardModalProps> = ({
  achievement,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !achievement) return null;

  // Determine rarity color — matches the dark palette used everywhere else
  // achievements render (RARITY_META in achievements.tsx / player-detail).
  // This modal previously hardcoded light-mode Tailwind classes (bg-gray-100,
  // text-gray-700, bg-white/50...) that clashed hard against the app's dark
  // theme; it's the same rgba(255,255,255,...) system as everything else now.
  const rarityColors: Record<string, { color: string; bg: string; border: string; glow: string }> = {
    Common:    { color: "#9ca3af", bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.12)", glow: "none" },
    Rare:      { color: "#0066ff", bg: "rgba(0,102,255,0.06)",   border: "rgba(0,102,255,0.35)",   glow: "0 0 30px rgba(0,102,255,0.15)" },
    Epic:      { color: "#a855f7", bg: "rgba(168,85,247,0.07)",  border: "rgba(168,85,247,0.4)",   glow: "0 0 30px rgba(168,85,247,0.18)" },
    Legendary: { color: "#ffd24a", bg: "rgba(255,210,74,0.07)",  border: "rgba(255,210,74,0.4)",   glow: "0 0 30px rgba(255,210,74,0.2)" },
    Mythic:    { color: "#ff005c", bg: "rgba(255,0,92,0.08)",    border: "rgba(255,0,92,0.45)",    glow: "0 0 34px rgba(255,0,92,0.25)" },
  };

  const colors = rarityColors[achievement.rarity] || rarityColors.Common;

  // Pack count display
  const packCount = achievement.packReward
    ? achievement.packReward === "TEN"
      ? 10
      : achievement.packReward === "FIVE"
        ? 5
        : 1
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-8"
        style={{ backgroundColor: "#0c0c14", backgroundImage: `linear-gradient(${colors.bg}, ${colors.bg})`, border: `1px solid ${colors.border}`, boxShadow: colors.glow }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 transition-colors"
          style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)" }}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon & Title */}
        <div className="mb-4 text-center">
          <div className="text-6xl mb-2" style={{ filter: `drop-shadow(0 0 16px ${colors.color}88)` }}>{achievement.icon}</div>
          <h2
            className="text-2xl font-black uppercase mb-2"
            style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.02em", color: "rgba(255,255,255,0.95)" }}
          >
            {achievement.name}
          </h2>
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase"
            style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", color: colors.color, background: `${colors.color}1a`, border: `1px solid ${colors.color}55` }}
          >
            {achievement.rarity}
          </div>
        </div>

        {/* Description */}
        <p className="text-center mb-6 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{achievement.description}</p>

        {/* Rewards Section */}
        {(achievement.coinReward || packCount > 0) && (
          <div className="pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <p
              className="text-xs font-black uppercase mb-4 text-center"
              style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.14em", color: "rgba(255,255,255,0.35)" }}
            >
              Rewards
            </p>

            <div className="flex gap-6 justify-center">
              {/* Coins */}
              {achievement.coinReward && achievement.coinReward > 0 && (
                <div className="text-center">
                  <div className="text-3xl font-black mb-1" style={{ fontFamily: "Share Tech Mono, monospace", color: "#ffd24a" }}>
                    {achievement.coinReward}
                  </div>
                  <div className="text-xs font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}>Card Points</div>
                </div>
              )}

              {/* Packs */}
              {packCount > 0 && (
                <div className="text-center">
                  <div className="text-3xl font-black mb-1" style={{ fontFamily: "Share Tech Mono, monospace", color: "#0066ff" }}>{packCount}</div>
                  <div className="text-xs font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}>
                    {packCount === 1 ? "Pack" : "Packs"}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Close hint */}
        <div className="mt-6 text-center text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Click anywhere to close</div>
      </div>
    </div>
  );
};
