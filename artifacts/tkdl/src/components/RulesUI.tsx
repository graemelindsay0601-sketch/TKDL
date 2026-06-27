import React, { useState } from 'react';

type RuleCategory = 'basics' | 'good-cards' | 'bad-cards' | 'scoring' | 'coinEconomy' | 'seasons';

interface RuleSection {
  id: RuleCategory;
  title: string;
  icon: string;
  color: string;
  rules: RuleItem[];
}

interface RuleItem {
  title: string;
  description: string;
  example?: string;
  important?: boolean;
}

const RULES_DATA: RuleSection[] = [
  {
    id: 'basics',
    title: 'Game Basics',
    icon: '🎮',
    color: '#00b4ff',
    rules: [
      {
        title: 'Match Overview',
        description: 'Card Clash is a competitive darts game mode where you and an opponent each equip cards to boost your performance or curse your opponent.',
      },
      {
        title: 'Game Modes',
        description: 'Play X01 (X=501/301/201) or Cricket. Both are played with 2 players. Each player takes turns throwing 3 darts.',
      },
      {
        title: 'Card Equipment',
        description: 'Before each match, equip 2 GOOD cards and 2 BAD cards from your collection. Cards must match the game mode.',
        important: true,
      },
      {
        title: 'Turn Order',
        description: 'Players alternate turns. You can play GOOD cards at the START of your turn, and BAD cards at the END of your turn (before opponent throws).',
        important: true,
      },
    ],
  },
  {
    id: 'good-cards',
    title: 'GOOD Cards (Boost You)',
    icon: '⚡',
    color: '#22c55e',
    rules: [
      {
        title: 'When to Play',
        description: 'Play GOOD cards at the START of your turn, before throwing any darts.',
        important: true,
      },
      {
        title: 'Effects Apply Immediately',
        description: 'Once played, the card effect applies to your current turn only. Effects reset at the end of your turn.',
      },
      {
        title: 'Examples of GOOD Cards',
        description: 'Accuracy boost (+1 to single), Bull multiplier, Double catch, Extra dart, Healing, Shield, etc.',
        example: 'Steady Hand: +1 to all singles this turn',
      },
      {
        title: 'Limited Quantity',
        description: 'You start each match with a limited number of GOOD cards. Once used, they\'re consumed for the match.',
      },
    ],
  },
  {
    id: 'bad-cards',
    title: 'BAD Cards (Curse Opponent)',
    icon: '💀',
    color: '#ef4444',
    rules: [
      {
        title: 'When to Play',
        description: 'Play BAD cards at the END of your turn, after you throw but before opponent\'s turn starts.',
        important: true,
      },
      {
        title: 'Effects Target Opponent',
        description: 'BAD cards penalize your opponent on their NEXT turn. They apply immediately when opponent starts throwing.',
      },
      {
        title: 'Examples of BAD Cards',
        description: 'Dizzy (-1 to all), Fumble (half points), Curse (miss once), Pressure (must hit inner), etc.',
        example: 'Pressure: Opponent must hit inner ring for points this turn',
      },
      {
        title: 'Can Be Blocked',
        description: 'Some cards have shield or protection effects that can nullify bad cards.',
      },
    ],
  },
  {
    id: 'scoring',
    title: 'Scoring & Win Conditions',
    icon: '🏆',
    color: '#ffaa00',
    rules: [
      {
        title: 'X01 Game',
        description: 'Start at X (501/301/201) and count down to 0. Must finish with a double. Cards can modify points scored each turn.',
      },
      {
        title: 'Cricket Game',
        description: 'Mark numbers 15-20 and 25/50. Once you close a number 3 times (or hit bullseye), you can score points. First to close all and lead wins.',
      },
      {
        title: 'Card Bonuses',
        description: 'Certain cards grant bonus points. These are added to your turn total after you throw.',
      },
      {
        title: 'Winning the Match',
        description: 'First player to reach 0 in X01 (with double) or reach 75+ points in Cricket after closing all numbers wins the match.',
        important: true,
      },
    ],
  },
  {
    id: 'coinEconomy',
    title: 'Coin Economy',
    icon: '🪙',
    color: '#ffd24a',
    rules: [
      {
        title: 'Daily Login',
        description: 'Earn 10 coins per day just for logging in.',
      },
      {
        title: 'Win Rewards',
        description: 'Win a Card Clash match: 50 coins + (10 × cards used). Loss: 25 coins + (10 × cards used).',
      },
      {
        title: 'Streaks',
        description: '7-day streak: +25 bonus coins. 30-day streak: +100 bonus coins.',
      },
      {
        title: 'Practice Rewards',
        description: 'Practice matches give 50% coin rewards with no ranking impact.',
      },
      {
        title: 'Card Costs',
        description: 'Free packs every 3 days. Premium packs cost 100-500 coins depending on rarity.',
      },
    ],
  },
  {
    id: 'seasons',
    title: 'Seasons & Rankings',
    icon: '📅',
    color: '#9d4edd',
    rules: [
      {
        title: 'Season Duration',
        description: 'Each season lasts 1 month. Rankings reset at the start of each new season.',
      },
      {
        title: 'Rank Tiers',
        description: 'Bronze → Silver → Gold → Platinum → Diamond. Progress by winning matches.',
      },
      {
        title: 'End of Season Rewards',
        description: 'Final ranking determines rewards: coins and exclusive pack drops based on tier.',
      },
      {
        title: 'Card Collections',
        description: 'Cards are permanent. They carry over between seasons. Use them in any season.',
      },
      {
        title: 'Practice Impact',
        description: 'Practice matches do NOT affect your ranked tier. Perfect for testing strategies.',
      },
    ],
  },
];

/**
 * RulesUI Component
 * 
 * Comprehensive, easy-to-read rules guide for Card Clash
 * - Organized by category
 * - Visual hierarchy with colors
 * - Examples for clarity
 * - Important items highlighted
 */
export function RulesUI() {
  const [activeCategory, setActiveCategory] = useState<RuleCategory>('basics');
  const [expandedRule, setExpandedRule] = useState<number | null>(null);

  const currentSection = RULES_DATA.find((s) => s.id === activeCategory)!;

  return (
    <div
      style={{
        maxWidth: '700px',
        margin: '0 auto',
        padding: '20px',
        background: 'linear-gradient(135deg,rgba(20,10,40,0.6),rgba(10,5,25,0.8))',
        borderRadius: '16px',
        color: '#fff',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 900 }}>
          📖 Card Clash Rules
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
          Master the game with our comprehensive guide
        </p>
      </div>

      {/* Category Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
          gap: '8px',
          marginBottom: '24px',
        }}
      >
        {RULES_DATA.map((section) => (
          <button
            key={section.id}
            onClick={() => {
              setActiveCategory(section.id);
              setExpandedRule(null);
            }}
            style={{
              padding: '12px 8px',
              background:
                activeCategory === section.id
                  ? `linear-gradient(135deg,${section.color}33,${section.color}11)`
                  : 'rgba(255,255,255,0.03)',
              border: `2px solid ${
                activeCategory === section.id ? section.color + '60' : 'rgba(255,255,255,0.1)'
              }`,
              borderRadius: '10px',
              color: activeCategory === section.id ? section.color : 'rgba(255,255,255,0.5)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              letterSpacing: '0.03em',
            }}
          >
            <span style={{ fontSize: '16px' }}>{section.icon}</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {section.title.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: `2px solid ${currentSection.color}40`,
        }}
      >
        <span style={{ fontSize: '32px' }}>{currentSection.icon}</span>
        <div>
          <h2 style={{ margin: '0', fontSize: '20px', fontWeight: 900 }}>
            {currentSection.title}
          </h2>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '12px',
              color: currentSection.color,
              fontWeight: 600,
            }}
          >
            {currentSection.rules.length} rules to master
          </p>
        </div>
      </div>

      {/* Rules List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {currentSection.rules.map((rule, idx) => (
          <div
            key={idx}
            style={{
              background: rule.important
                ? `linear-gradient(135deg,${currentSection.color}15,${currentSection.color}05)`
                : 'rgba(255,255,255,0.02)',
              border: `1px solid ${rule.important ? currentSection.color + '40' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setExpandedRule(expandedRule === idx ? null : idx)}
              style={{
                all: 'unset',
                width: '100%',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: 'transparent',
              }}
            >
              {/* Important Badge */}
              {rule.important && (
                <div
                  style={{
                    flexShrink: 0,
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: currentSection.color,
                    marginTop: '6px',
                  }}
                />
              )}

              {/* Content */}
              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <h3
                  style={{
                    margin: '0 0 4px',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: rule.important ? currentSection.color : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {rule.title}
                  {rule.important && <span style={{ fontSize: '10px' }}>⭐</span>}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.6)',
                    lineHeight: 1.4,
                  }}
                >
                  {rule.description}
                </p>
              </div>

              {/* Expand Indicator */}
              <div
                style={{
                  flexShrink: 0,
                  fontSize: '16px',
                  color: currentSection.color,
                  transition: 'transform 0.2s',
                  transform: expandedRule === idx ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ▼
              </div>
            </button>

            {/* Expanded Content */}
            {expandedRule === idx && rule.example && (
              <div
                style={{
                  borderTop: `1px solid ${currentSection.color}20`,
                  padding: '12px 16px',
                  background: `${currentSection.color}08`,
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: currentSection.color, marginBottom: '6px' }}>
                  💡 EXAMPLE
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.7)',
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                    paddingLeft: '8px',
                    borderLeft: `2px solid ${currentSection.color}`,
                  }}
                >
                  {rule.example}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pro Tips Section */}
      <div
        style={{
          marginTop: '24px',
          padding: '14px 16px',
          background: 'linear-gradient(135deg,rgba(34,197,94,0.08),rgba(34,197,94,0.02))',
          border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: '12px',
        }}
      >
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: '12px',
            fontWeight: 900,
            color: '#22c55e',
            letterSpacing: '0.05em',
          }}
        >
          💪 PRO TIP
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.5,
          }}
        >
          {activeCategory === 'basics'
            ? 'Master the turn mechanics first. Understanding when to play GOOD vs BAD cards is key to winning.'
            : activeCategory === 'good-cards'
            ? 'Save your best GOOD cards for when you need them most. Timing matters more than quantity.'
            : activeCategory === 'bad-cards'
            ? 'Don\'t waste BAD cards on weak rounds. Stack them when your opponent has momentum.'
            : activeCategory === 'scoring'
            ? 'Cards can dramatically change who wins. A well-timed boost can turn the match around.'
            : activeCategory === 'coinEconomy'
            ? 'Log in every day for consistent income. Streaks are where the real coin rewards are.'
            : 'Practice mode is your friend. Use it to test new card combos risk-free.'}
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          textAlign: 'center',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.3)',
        }}
      >
        Have questions? Check each card's detailed description in your collection. Click any rule above to expand for
        examples! 📚
      </div>
    </div>
  );
}
