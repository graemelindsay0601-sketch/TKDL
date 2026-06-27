/**
 * Buzz Text & Engagement Messages
 * 
 * Dynamic, rotating messages to engage players
 * Shows on Card Clash hub to encourage exploration
 * Updates based on game state, time, events
 */

export interface BuzzMessage {
  text: string;
  icon: string;
  category: 'action' | 'achievement' | 'tip' | 'seasonal' | 'motivational';
  color: string;
}

/**
 * Get dynamic buzz message based on player state
 */
export function getDynamicBuzzMessage(playerData: {
  coinBalance: number;
  cardsCollected: number;
  matchesWon: number;
  dayStreak: number;
  hasUnclaimedPacks: boolean;
}): BuzzMessage {
  // If player has unclaimed packs, prioritize that
  if (playerData.hasUnclaimedPacks) {
    return {
      text: '🎁 You have unopened packs waiting! Open them now to grow your arsenal.',
      icon: '📦',
      category: 'action',
      color: '#ffd24a',
    };
  }

  // If low on coins
  if (playerData.coinBalance < 50) {
    return {
      text: '🪙 Win matches to earn coins or check in daily for free rewards.',
      icon: '💰',
      category: 'tip',
      color: '#ffd24a',
    };
  }

  // If high win rate, encourage ranking up
  if (playerData.matchesWon > 10) {
    return {
      text: '🏆 You\'re on fire! Keep winning to climb the rankings.',
      icon: '🎯',
      category: 'motivational',
      color: '#ffaa00',
    };
  }

  // If solid collection, encourage trading/practice
  if (playerData.cardsCollected > 30) {
    return {
      text: '⚡ Try Practice mode to test new card combos without risking rank.',
      icon: '🎮',
      category: 'tip',
      color: '#00b4ff',
    };
  }

  // If just starting, encourage collection building
  if (playerData.cardsCollected < 20) {
    return {
      text: '📚 Collect more cards to unlock powerful combos and strategies.',
      icon: '🃏',
      category: 'motivational',
      color: '#22c55e',
    };
  }

  // If active streak, celebrate
  if (playerData.dayStreak > 0) {
    return {
      text: `🔥 ${playerData.dayStreak}-day login streak! Keep it going for bonus rewards.`,
      icon: '⭐',
      category: 'achievement',
      color: '#ff6b6b',
    };
  }

  // Default motivational
  return {
    text: '⚔️ Ready to challenge another player? Head to Play to start a match!',
    icon: '🎮',
    category: 'action',
    color: '#00b4ff',
  };
}

/**
 * Get time-based buzz message
 */
export function getTimeBasedBuzzMessage(): BuzzMessage {
  const hour = new Date().getHours();

  // Morning
  if (hour >= 6 && hour < 12) {
    return {
      text: '☀️ Good morning! Claim your daily free pack.',
      icon: '🌅',
      category: 'seasonal',
      color: '#ffaa00',
    };
  }

  // Afternoon
  if (hour >= 12 && hour < 17) {
    return {
      text: '☕ Afternoon darts session? Jump into a match!',
      icon: '🎯',
      category: 'motivational',
      color: '#00b4ff',
    };
  }

  // Evening
  if (hour >= 17 && hour < 21) {
    return {
      text: '🌆 Evening tournament time? Show your skills in ranked matches.',
      icon: '🏆',
      category: 'action',
      color: '#ffaa00',
    };
  }

  // Night
  return {
    text: '🌙 Late night grind? Perfect time to test strategies in Practice mode.',
    icon: '🌙',
    category: 'tip',
    color: '#9d4edd',
  };
}

/**
 * Buzz message templates for different game states
 */
export const BUZZ_TEMPLATES: Record<string, BuzzMessage> = {
  newPlayer: {
    text: '🎯 Welcome to Card Clash! Open your free starter pack and build your deck.',
    icon: '🎉',
    category: 'action',
    color: '#22c55e',
  },
  noMatchesToday: {
    text: '⚡ You haven\'t played yet today. Challenge someone to a match!',
    icon: '🎮',
    category: 'action',
    color: '#ff6b6b',
  },
  seasonEnding: {
    text: '⏰ Season ending soon! Play your last matches before reset.',
    icon: '⏳',
    category: 'seasonal',
    color: '#ffaa00',
  },
  newSeason: {
    text: '🆕 New season started! Rankings reset. Climb to the top.',
    icon: '🎊',
    category: 'seasonal',
    color: '#22c55e',
  },
  specialEvent: {
    text: '🎪 Limited-time event active! Check the Achievements tab for special challenges.',
    icon: '🎭',
    category: 'seasonal',
    color: '#ff6b6b',
  },
  legendaryPull: {
    text: '✨ Legendary card unlocked! Add it to your deck and dominate.',
    icon: '👑',
    category: 'achievement',
    color: '#ffaa00',
  },
  perfectMatch: {
    text: '🌟 Flawless victory! You\'re a true master of Card Clash.',
    icon: '⭐',
    category: 'achievement',
    color: '#ffd24a',
  },
  collectionComplete: {
    text: '🏆 You\'ve collected all common cards! Rare cards await.',
    icon: '📚',
    category: 'achievement',
    color: '#22c55e',
  },
  tradeLaunching: {
    text: '🤝 Trading system launching soon! Prepare your duplicate cards.',
    icon: '💱',
    category: 'seasonal',
    color: '#00b4ff',
  },
};

/**
 * React component for displaying a buzz message
 */
export function BuzzMessageDisplay({ message }: { message: BuzzMessage }) {
  return (
    <div
      style={{
        background:
          message.category === 'achievement'
            ? 'linear-gradient(135deg,rgba(255,170,0,0.12),rgba(255,170,0,0.04))'
            : message.category === 'seasonal'
            ? 'linear-gradient(135deg,rgba(255,107,107,0.12),rgba(255,107,107,0.04))'
            : 'linear-gradient(135deg,rgba(0,180,255,0.08),rgba(0,180,255,0.02))',
        border: `1.5px solid ${message.color}40`,
        borderRadius: '12px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
      }}
    >
      <span style={{ fontSize: '18px', flexShrink: 0 }}>{message.icon}</span>
      <p
        style={{
          margin: 0,
          fontSize: '12px',
          color: '#fff',
          lineHeight: 1.5,
          flex: 1,
        }}
      >
        {message.text}
      </p>
    </div>
  );
}

/**
 * Hook: useRotatingBuzzMessage
 * Rotates between different messages every 30 seconds
 */
export function useRotatingBuzzMessage(playerData: any, autoRotate = true) {
  const [currentMessageIndex, setCurrentMessageIndex] = React.useState(0);

  const messages: BuzzMessage[] = [
    getDynamicBuzzMessage(playerData),
    getTimeBasedBuzzMessage(),
    BUZZ_TEMPLATES.specialEvent,
  ];

  React.useEffect(() => {
    if (!autoRotate) return;

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 30000); // Rotate every 30 seconds

    return () => clearInterval(interval);
  }, [messages.length, autoRotate]);

  return messages[currentMessageIndex];
}
