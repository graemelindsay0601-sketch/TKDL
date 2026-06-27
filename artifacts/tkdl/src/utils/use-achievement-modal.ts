import { useState } from "react";
import type { AchievementRewardData } from "../components/AchievementRewardModal";
import { getAchievementReward } from "./achievement-rewards";

/**
 * Hook for managing achievement modal state across all displays
 * Enriches achievements with reward data and handles modal visibility
 */
export function useAchievementModal() {
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementRewardData | null>(
    null
  );

  const openAchievementModal = (achievement: {
    key: string;
    name: string;
    icon: string;
    description: string;
    rarity: string;
  }) => {
    const reward = getAchievementReward(achievement.key);
    const enrichedAchievement: AchievementRewardData = {
      ...achievement,
      coinReward: reward.coinReward,
      packReward: reward.packReward,
    };
    setSelectedAchievement(enrichedAchievement);
  };

  const closeAchievementModal = () => {
    setSelectedAchievement(null);
  };

  return {
    selectedAchievement,
    isModalOpen: selectedAchievement !== null,
    openAchievementModal,
    closeAchievementModal,
  };
}

/**
 * Enrich achievement data with rewards
 */
export function enrichAchievementWithReward(achievement: {
  key: string;
  name: string;
  icon: string;
  description: string;
  rarity: string;
}): AchievementRewardData {
  const reward = getAchievementReward(achievement.key);
  return {
    ...achievement,
    coinReward: reward.coinReward,
    packReward: reward.packReward,
  };
}
