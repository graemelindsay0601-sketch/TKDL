import React, { useState } from 'react';
import { 
  Achievement, 
  PlayerStats, 
  ACHIEVEMENTS, 
  getEarnedAchievements,
  ACHIEVEMENT_COLORS,
  TIER_COLORS,
  AchievementCategory
} from '@/utils/achievements';

interface AchievementsDisplayProps {
  playerStats: PlayerStats;
  maxWidth?: string;
}

/**
 * AchievementsDisplay Component
 * 
 * Shows all achievements with progress
 * Organized by category
 * Shows earned, in-progress, and locked achievements
 */
export function AchievementsDisplay({ playerStats, maxWidth = '800px' }: AchievementsDisplayProps) {
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const earnedIds = new Set(getEarnedAchievements(playerStats).map((a) => a.id));
  const categories: AchievementCategory[] = ['collection', 'matches', 'earnings', 'streaks', 'discovery', 'mastery'];

  const filteredAchievements =
    selectedCategory === 'all'
      ? ACHIEVEMENTS
      : ACHIEVEMENTS.filter((a) => a.category === selectedCategory);

  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    const aEarned = earnedIds.has(a.id) ? 1 : 0;
    const bEarned = earnedIds.has(b.id) ? 1 : 0;
    if (aEarned !== bEarned) return bEarned - aEarned; // Earned first
    return a.coinReward - b.coinReward; // Then by reward
  });

  const earnedCount = getEarnedAchievements(playerStats).length;
  const totalCount = ACHIEVEMENTS.length;

  return (
    <div style={{ maxWidth, margin: '0 auto', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 900 }}>
          🏆 Achievements
        </h2>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: '8px',
            }}
          >
            <span style={{ fontSize: '18px' }}>✨</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#22c55e' }}>
                {earnedCount} / {totalCount} Earned
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                {Math.round((earnedCount / totalCount) * 100)}% Complete
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: '12px',
        }}
      >
        <button
          onClick={() => setSelectedCategory('all')}
          style={{
            padding: '8px 14px',
            background: selectedCategory === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
            border: '1px solid ' + (selectedCategory === 'all' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'),
            borderRadius: '6px',
            color: selectedCategory === 'all' ? '#fff' : 'rgba(255,255,255,0.5)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
          }}
        >
          All ({ACHIEVEMENTS.length})
        </button>
        {categories.map((cat) => {
          const count = ACHIEVEMENTS.filter((a) => a.category === cat).length;
          const earned = ACHIEVEMENTS.filter((a) => a.category === cat && earnedIds.has(a.id)).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '8px 14px',
                background: selectedCategory === cat ? `${ACHIEVEMENT_COLORS[cat]}20` : 'transparent',
                border: `1px solid ${selectedCategory === cat ? ACHIEVEMENT_COLORS[cat] + '60' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '6px',
                color: selectedCategory === cat ? ACHIEVEMENT_COLORS[cat] : 'rgba(255,255,255,0.5)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                letterSpacing: '0.03em',
                textTransform: 'capitalize',
              }}
            >
              {cat} ({earned}/{count})
            </button>
          );
        })}
      </div>

      {/* Achievements Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '12px',
        }}
      >
        {sortedAchievements.map((achievement) => {
          const isEarned = earnedIds.has(achievement.id);
          const isExpanded = expandedId === achievement.id;
          const progress = achievement.progress?.(playerStats);

          return (
            <div
              key={achievement.id}
              onClick={() => setExpandedId(isExpanded ? null : achievement.id)}
              style={{
                background: isEarned
                  ? `linear-gradient(135deg,${TIER_COLORS[achievement.tier]}20,${TIER_COLORS[achievement.tier]}08)`
                  : 'rgba(255,255,255,0.02)',
                border: `1.5px solid ${isEarned ? TIER_COLORS[achievement.tier] + '60' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '12px',
                padding: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: isEarned ? 1 : 0.6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = isEarned
                  ? TIER_COLORS[achievement.tier] + '80'
                  : 'rgba(255,255,255,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isEarned
                  ? TIER_COLORS[achievement.tier] + '60'
                  : 'rgba(255,255,255,0.08)';
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                <div style={{ fontSize: '24px', flexShrink: 0 }}>{achievement.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: 800, color: '#fff' }}>
                    {achievement.name}
                  </h3>
                  <div
                    style={{
                      fontSize: '10px',
                      color: ACHIEVEMENT_COLORS[achievement.category],
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {achievement.category}
                  </div>
                </div>
                {isEarned && (
                  <div
                    style={{
                      fontSize: '14px',
                      color: TIER_COLORS[achievement.tier],
                      fontWeight: 900,
                    }}
                  >
                    ✓
                  </div>
                )}
              </div>

              {/* Description */}
              <p
                style={{
                  margin: '0 0 10px',
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.4,
                }}
              >
                {achievement.description}
              </p>

              {/* Progress Bar */}
              {progress && !isEarned && (
                <div style={{ marginBottom: '10px' }}>
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      height: '4px',
                      borderRadius: '2px',
                      overflow: 'hidden',
                      marginBottom: '4px',
                    }}
                  >
                    <div
                      style={{
                        background: ACHIEVEMENT_COLORS[achievement.category],
                        height: '100%',
                        width: `${Math.min((progress.current / progress.target) * 100, 100)}%`,
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.4)',
                      textAlign: 'right',
                    }}
                  >
                    {progress.current} / {progress.target}
                  </div>
                </div>
              )}

              {/* Rewards */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    background: 'rgba(255,210,74,0.1)',
                    border: '1px solid rgba(255,210,74,0.3)',
                    borderRadius: '4px',
                    color: '#ffd24a',
                    textAlign: 'center',
                  }}
                >
                  +{achievement.coinReward} 🪙
                </div>
                {achievement.packReward && (
                  <div
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      background: 'rgba(34,197,94,0.1)',
                      border: '1px solid rgba(34,197,94,0.3)',
                      borderRadius: '4px',
                      color: '#22c55e',
                      textAlign: 'center',
                      fontSize: '10px',
                    }}
                  >
                    {achievement.packReward === 'SINGLE' && '📦'}
                    {achievement.packReward === 'FIVE' && '📦📦📦'}
                    {achievement.packReward === 'TEN' && '📦×10'}
                  </div>
                )}
              </div>

              {/* Tier Badge */}
              <div
                style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '9px',
                  fontWeight: 600,
                  color: TIER_COLORS[achievement.tier],
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {achievement.tier} Tier
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats Summary */}
      <div
        style={{
          marginTop: '32px',
          padding: '16px',
          background: 'linear-gradient(135deg,rgba(192,132,252,0.1),rgba(192,132,252,0.02))',
          border: '1px solid rgba(192,132,252,0.2)',
          borderRadius: '12px',
        }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 900, color: '#c084fc' }}>
          📊 Achievement Summary
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Total Achievements</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>{earnedCount}</div>
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Completion %</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#22c55e' }}>
              {Math.round((earnedCount / totalCount) * 100)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
