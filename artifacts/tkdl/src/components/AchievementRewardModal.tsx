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

  // Determine rarity color
  const rarityColors: Record<string, { bg: string; border: string; text: string }> = {
    Common: { bg: "bg-gray-100", border: "border-gray-300", text: "text-gray-700" },
    Rare: { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-700" },
    Epic: { bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-700" },
    Legendary: { bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-700" },
    Mythic: { bg: "bg-red-100", border: "border-red-300", text: "text-red-700" },
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-md rounded-lg border-2 ${colors.border} ${colors.bg} p-8 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 hover:bg-black/10 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon & Title */}
        <div className="mb-4 text-center">
          <div className="text-6xl mb-2">{achievement.icon}</div>
          <h2 className={`text-2xl font-bold ${colors.text} mb-1`}>{achievement.name}</h2>
          <div className="inline-block px-3 py-1 bg-white/50 rounded-full text-sm font-semibold">
            {achievement.rarity}
          </div>
        </div>

        {/* Description */}
        <p className="text-center text-gray-700 mb-6">{achievement.description}</p>

        {/* Rewards Section */}
        {(achievement.coinReward || packCount > 0) && (
          <div className="border-t-2 border-black/20 pt-6">
            <p className="text-sm font-semibold text-gray-600 uppercase mb-4 text-center">
              Rewards
            </p>

            <div className="flex gap-6 justify-center">
              {/* Coins */}
              {achievement.coinReward && achievement.coinReward > 0 && (
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600 mb-1">
                    {achievement.coinReward}
                  </div>
                  <div className="text-xs font-semibold text-gray-600">Card Points</div>
                </div>
              )}

              {/* Packs */}
              {packCount > 0 && (
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">{packCount}</div>
                  <div className="text-xs font-semibold text-gray-600">
                    {packCount === 1 ? "Pack" : "Packs"}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Close hint */}
        <div className="mt-6 text-center text-xs text-gray-500">Click anywhere to close</div>
      </div>
    </div>
  );
};
