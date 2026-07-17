import React, { useState } from 'react';

type RuleCategory = 'basics' | 'good-cards' | 'bad-cards' | 'scoring' | 'coinEconomy' | 'seasons' | 'chaos-lab';

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
        description: 'Players take turns closing numbers (15-20 and 25 for Bull). Hit a number to "mark" it (single=1 mark, double=2 marks, triple=3 marks). After 3 marks on a number, you "close" it and can score points. Once you close a number, only you can score points on it. First to close all numbers (15-20, Bull) with the highest total score wins.',
      },
      {
        title: 'Card Bonuses',
        description: 'Certain cards grant bonus points. These are added to your turn total after you throw.',
      },
      {
        title: 'Winning the Match',
        description: 'In X01: First player to reach exactly 0 with their final dart being a double wins. In Cricket: First player to close all numbers (15–20, Bull) and have the highest total score wins.',
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
  {
    id: 'chaos-lab',
    title: 'Chaos Lab (Experimental)',
    icon: '⚡',
    color: '#a78bfa',
    rules: [
      {
        title: 'What Chaos Lab Is',
        description: 'A separate mode from Standard and Chaos Card Clash — normal darts scoring always stays exactly the same. Instead of equipping cards ahead of time, you get 3 face-down mystery cards at the start of every visit, and every one of them marks a target on the board rather than giving a flat score boost. Most targets are random, so the board looks different leg to leg.',
        important: true,
      },
      {
        title: 'Hot (Bounty)',
        description: 'Marks a target as a race — whoever hits it first (either player) scores completely normally AND gets a real bonus on top. The harder the target, the bigger the reward: a number bed pays modestly, a treble or double pays more, and Bull pays the most. Removed the moment it triggers.',
      },
      {
        title: 'Cold (Curse)',
        description: 'Marks a target against your opponent specifically. If they hit it, they still score exactly the same as normal — but nothing else happens; it\u2019s pure denial, no bonus or penalty attached. Lasts until their visit ends.',
      },
      {
        title: 'Trap (Curse)',
        description: 'Marks a target against your opponent. If they hit it, they still score normally, but they also take a real penalty — same rarity-scaled sizing as Hot. Removed the moment it\u2019s sprung.',
      },
      {
        title: 'Shield',
        description: 'Protects one of your own targets — while it\u2019s up, your opponent can\u2019t place a Cold or Trap mark there. Never blocks Hot, and never affects your own scoring in any way. Lasts through your next visit.',
      },
      {
        title: 'Reversal — Score Swap',
        description: 'One card, kept deliberately rare: whoever hits it first COMPLETELY SWAPS their remaining score with their opponent\u2019s. Total reversal of fortune. Because it\u2019s this dramatic, it only ever shows up occasionally.',
        important: true,
      },
      {
        title: 'Momentum — Surge & Weakened',
        description: 'Instead of a one-off bonus, these multiply an ENTIRE upcoming visit. Surge doubles every dart on the winner\u2019s next visit (checkout math included); Weakened halves every dart on the loser\u2019s next visit. Always applies to a full, fresh visit — never wasted on darts you\u2019ve already thrown.',
      },
      {
        title: 'Leech — Siphon & Parasite',
        description: 'Your dart scores completely normally for you — AND a cut of that same dart\u2019s value (50% for Siphon, 35% for Parasite) also gets added to your opponent\u2019s remaining. One throw, two consequences.',
      },
      {
        title: 'Sabotage — Erase & Purge',
        description: 'Instead of placing a new mark, these remove your opponent\u2019s active mark(s) outright — Erase takes one, Purge wipes all of them — the instant you draw the card, no dart needed. If they have nothing active, it falls back to a normal mark against them instead, so it\u2019s never a wasted draw.',
      },
      {
        title: 'Escalation — Slow Burn & Simmering Trap',
        description: 'These grow stronger the longer they go unhit — the bonus (Slow Burn) or penalty (Simmering Trap) increases each visit it survives, up to a cap. Patience and avoidance both have real consequences here.',
      },
      {
        title: 'Multi-Target — Wildfire Spread & Minefield',
        description: 'One card, three marks at once, scattered randomly across the board — a completely different risk map for the rest of that leg, not just one extra highlighted spot.',
      },
      {
        title: 'Leg-Wide — Treble Curse & Double Trouble',
        description: 'These don\u2019t mark one spot — they reshape an entire CATEGORY of the board for the rest of the leg. Treble Curse makes every treble Cold against your opponent, all leg. Double Trouble makes every double Hot for whoever hits it, all leg.',
      },
      {
        title: 'Unstable',
        description: 'A true wildcard — marks a random spot, but nobody (including whoever drew it) knows if it\u2019s Hot or Trap until someone actually hits it. Pure suspense.',
      },
      {
        title: 'Match Swing — Overtake, Underdog\u2019s Grace & Set Point',
        description: 'These read the live match score and can grant or remove a whole leg outright the instant they\u2019re drawn. Overtake steals a leg back if your opponent is 2+ ahead; Underdog\u2019s Grace hands you a leg if you\u2019re 2+ behind; Set Point (Sets format only) steals a leg when the current set is close. If the condition isn\u2019t met, you get a solid bonus instead — never a wasted draw. Kept genuinely rare on purpose.',
        important: true,
      },
      {
        title: 'Seeing What\u2019s Marked',
        description: 'Marked numbers glow on the dart input board itself in the mark\u2019s own color (orange=Hot, blue=Cold, red=Trap, green=Shield, purple=Unstable/Swap), and the Active Board Marks panel spells out the exact target, who it affects, and the live bonus/penalty number for each one. Tap any mark for the full card art and text.',
        important: true,
      },
      {
        title: 'Tracking What Happened',
        description: 'Every Chaos Lab event shows up in the Chaos Lab Activity Log during the match, and X01 additionally labels bonuses/penalties directly under the relevant visit in Recent Visits. A full downloadable match log is also available from the match screen for a complete record.',
      },
      {
        title: 'Chaos Lab Cards Are Exclusive',
        description: 'These cards only ever appear as mystery draws inside a Chaos Lab match. They\u2019re never available in packs, the shop, the equip screen, or regular Chaos Mode.',
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
        maxWidth: '800px',
        margin: '0 auto',
        padding: '28px',
        background: 'linear-gradient(135deg,rgba(20,10,40,0.8),rgba(10,5,25,0.95))',
        borderRadius: '16px',
        color: '#fff',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 12px', fontSize: '36px', fontWeight: 900, letterSpacing: '-0.01em' }}>
          📖 Card Clash Rules
        </h1>
        <p style={{ margin: 0, fontSize: '15px', color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
          Master the game with our comprehensive guide
        </p>
      </div>

      {/* Category Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '10px',
          marginBottom: '32px',
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
              padding: '14px 12px',
              background:
                activeCategory === section.id
                  ? `linear-gradient(135deg,${section.color}40,${section.color}15)`
                  : 'rgba(255,255,255,0.04)',
              border: `2px solid ${
                activeCategory === section.id ? section.color + '70' : 'rgba(255,255,255,0.12)'
              }`,
              borderRadius: '10px',
              color: activeCategory === section.id ? section.color : 'rgba(255,255,255,0.6)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ fontSize: '20px' }}>{section.icon}</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
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
          gap: '16px',
          marginBottom: '28px',
          paddingBottom: '20px',
          borderBottom: `3px solid ${currentSection.color}50`,
        }}
      >
        <span style={{ fontSize: '40px', flexShrink: 0 }}>{currentSection.icon}</span>
        <div>
          <h2 style={{ margin: '0', fontSize: '24px', fontWeight: 900, letterSpacing: '-0.01em' }}>
            {currentSection.title}
          </h2>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: '14px',
              color: currentSection.color,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {currentSection.rules.length} rules to master
          </p>
        </div>
      </div>

      {/* Rules List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {currentSection.rules.map((rule, idx) => (
          <div
            key={idx}
            style={{
              background: rule.important
                ? `linear-gradient(135deg,${currentSection.color}25,${currentSection.color}08)`
                : 'rgba(255,255,255,0.03)',
              border: `1.5px solid ${rule.important ? currentSection.color + '60' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '12px',
              overflow: 'hidden',
              transition: 'all 0.2s',
            }}
          >
            <button
              onClick={() => setExpandedRule(expandedRule === idx ? null : idx)}
              style={{
                all: 'unset',
                width: '100%',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
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
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: currentSection.color,
                    marginTop: '8px',
                  }}
                />
              )}

              {/* Content */}
              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <h3
                  style={{
                    margin: '0 0 6px',
                    fontSize: '15px',
                    fontWeight: 800,
                    color: rule.important ? currentSection.color : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    lineHeight: 1.3,
                  }}
                >
                  {rule.title}
                  {rule.important && <span style={{ fontSize: '12px' }}>⭐</span>}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.75)',
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}
                >
                  {rule.description}
                </p>
              </div>

              {/* Expand Indicator */}
              <div
                style={{
                  flexShrink: 0,
                  fontSize: '18px',
                  color: currentSection.color,
                  transition: 'transform 0.2s',
                  transform: expandedRule === idx ? 'rotate(180deg)' : 'rotate(0deg)',
                  marginTop: '2px',
                }}
              >
                ▼
              </div>
            </button>

            {/* Expanded Content */}
            {expandedRule === idx && rule.example && (
              <div
                style={{
                  borderTop: `2px solid ${currentSection.color}30`,
                  padding: '16px 20px',
                  background: `${currentSection.color}12`,
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 800, color: currentSection.color, marginBottom: '8px', letterSpacing: '0.04em' }}>
                  💡 EXAMPLE
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.8)',
                    fontStyle: 'italic',
                    lineHeight: 1.6,
                    paddingLeft: '12px',
                    borderLeft: `3px solid ${currentSection.color}`,
                  }}
                >
                  "{rule.example}"
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pro Tips Section */}
      <div
        style={{
          marginTop: '32px',
          padding: '18px 20px',
          background: 'linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.04))',
          border: '2px solid rgba(34,197,94,0.35)',
          borderRadius: '12px',
        }}
      >
        <h3
          style={{
            margin: '0 0 10px',
            fontSize: '14px',
            fontWeight: 900,
            color: '#22c55e',
            letterSpacing: '0.06em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          💪 PRO TIP
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.6,
            fontWeight: 500,
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
