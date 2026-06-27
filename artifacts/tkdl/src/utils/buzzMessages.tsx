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
      text: '🎁 Fresh packs waiting! Open now to boost your deck power.',
      icon: '📦',
      category: 'action',
      color: '#ffd24a',
    };
  }

  // If low on coins
  if (playerData.coinBalance < 50) {
    return {
      text: '🪙 Coins running low? Win matches or log in daily for rewards.',
      icon: '💰',
      category: 'tip',
      color: '#ffd24a',
    };
  }

  // If high win rate, encourage ranking up
  if (playerData.matchesWon > 10) {
    return {
      text: '🏆 Dominating the board! Keep this streak to own the leaderboard.',
      icon: '🎯',
      category: 'motivational',
      color: '#ffaa00',
    };
  }

  // If solid collection, encourage practice
  if (playerData.cardsCollected > 30) {
    return {
      text: '⚡ You\'ve got the cards—now test your combos in Practice mode.',
      icon: '🎮',
      category: 'tip',
      color: '#00b4ff',
    };
  }

  // If just starting, encourage collection building
  if (playerData.cardsCollected < 20) {
    return {
      text: '📚 Build your arsenal! Each card is a new strategy waiting.',
      icon: '🃏',
      category: 'motivational',
      color: '#22c55e',
    };
  }

  // If active streak, celebrate
  if (playerData.dayStreak > 0) {
    return {
      text: `🔥 ${playerData.dayStreak}-day streak! Don't break it—claim your bonus!`,
      icon: '⭐',
      category: 'achievement',
      color: '#ff6b6b',
    };
  }

  // Default motivational
  return {
    text: '⚔️ Challenge a rival. Face the meta. Prove yourself in ranked play.',
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
      text: '☀️ Rise and shine! Grab your daily free pack to start strong.',
      icon: '🌅',
      category: 'seasonal',
      color: '#ffaa00',
    };
  }

  // Afternoon
  if (hour >= 12 && hour < 17) {
    return {
      text: '☕ Break time? Play a quick match to stay sharp.',
      icon: '🎯',
      category: 'motivational',
      color: '#00b4ff',
    };
  }

  // Evening
  if (hour >= 17 && hour < 21) {
    return {
      text: '🌆 Prime time league action. Challenge rivals and climb ranks.',
      icon: '🏆',
      category: 'action',
      color: '#ffaa00',
    };
  }

  // Night
  return {
    text: '🌙 Night owl mode? Perfect for Practice—test strategies risk-free.',
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
    text: '🎯 Welcome to the league! Open your starter pack and build your first deck.',
    icon: '🎉',
    category: 'action',
    color: '#22c55e',
  },
  noMatchesToday: {
    text: '⚡ No matches today? Challenge someone to break the streak!',
    icon: '🎮',
    category: 'action',
    color: '#ff6b6b',
  },
  seasonEnding: {
    text: '⏰ Season ending soon! Final chance to secure your rank.',
    icon: '⏳',
    category: 'seasonal',
    color: '#ffaa00',
  },
  newSeason: {
    text: '🆕 New season! Rankings reset. Race to the top.',
    icon: '🎊',
    category: 'seasonal',
    color: '#22c55e',
  },
  specialEvent: {
    text: '🎪 Limited-time event! Check Achievements for exclusive challenges.',
    icon: '🎭',
    category: 'seasonal',
    color: '#ff6b6b',
  },
  legendaryPull: {
    text: '✨ Legendary pulled! Legendary cards change everything—use it wisely.',
    icon: '👑',
    category: 'achievement',
    color: '#ffaa00',
  },
  perfectMatch: {
    text: '🌟 Flawless! You didn\'t just win—you dominated.',
    icon: '⭐',
    category: 'achievement',
    color: '#ffd24a',
  },
  collectionComplete: {
    text: '🏆 All commons collected! Rare cards are waiting for you.',
    icon: '📚',
    category: 'achievement',
    color: '#22c55e',
  },
  tradeLaunching: {
    text: '🤝 Trading system coming soon! Start collecting duplicates now.',
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
