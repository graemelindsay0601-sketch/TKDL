/**
 * Card Clash Hub - Main Orchestrator Component
 * 
 * Coordinates all Card Clash tabs and navigation
 * Manages tab state, layout, and child component rendering
 */

import React from 'react';
import { CardClashLeaderboard } from './CardClashLeaderboard';
import { CardClashCollection } from './CardClashCollection';
import { CardClashShop } from './CardClashShop';
import { CardClashAdmin } from './CardClashAdmin';
import {
  CollectionIcon,
  ShopIcon,
  PlayIcon,
  PracticeIcon,
  StandingsIcon,
  AchievementsIcon,
  RulesIcon,
  AdminIcon,
  LeaderboardIcon,
} from './CardClashIcons';

type Tab = 'hub' | 'collection' | 'shop' | 'play' | 'practice' | 'standings' | 'achievements' | 'rules' | 'admin';

interface CardClashHubProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  playerId: number | undefined;
  playerName: string;
  stats: any;
  standings: any[];
  ownedNames: Set<string>;
  newCardNames: Set<string>;
  isAdmin?: boolean;
  onLoadData: () => void;
  // Child component callbacks
  onCardsReceived?: () => void;
  onCoinsUpdate?: (coins: number) => void;
  // Other tabs content
  playTabContent?: React.ReactNode;
  practiceTabContent?: React.ReactNode;
  achievementsTabContent?: React.ReactNode;
  rulesTabContent?: React.ReactNode;
}

export const CardClashHub = React.memo(
  function CardClashHub({
    activeTab,
    setActiveTab,
    playerId,
    playerName,
    stats,
    standings,
    ownedNames,
    newCardNames,
    isAdmin = false,
    onLoadData,
    onCardsReceived,
    onCoinsUpdate,
    playTabContent,
    practiceTabContent,
    achievementsTabContent,
    rulesTabContent,
  }: CardClashHubProps) {
    const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode; sublabel: string }> = [
      { id: 'hub', label: 'Hub', icon: <LeaderboardIcon />, sublabel: 'Overview' },
      { id: 'collection', label: 'Collection', icon: <CollectionIcon />, sublabel: 'Your cards' },
      { id: 'shop', label: 'Shop', icon: <ShopIcon />, sublabel: 'Get cards' },
      { id: 'play', label: 'Play', icon: <PlayIcon />, sublabel: 'Matched game' },
      { id: 'practice', label: 'Practice', icon: <PracticeIcon />, sublabel: 'vs Bot' },
      { id: 'standings', label: 'Standings', icon: <StandingsIcon />, sublabel: 'Rankings' },
      { id: 'achievements', label: 'Achievements', icon: <AchievementsIcon />, sublabel: 'Milestones' },
      { id: 'rules', label: 'Rules', icon: <RulesIcon />, sublabel: 'How to play' },
      ...(isAdmin ? [{ id: 'admin' as Tab, label: 'Admin', icon: <AdminIcon />, sublabel: 'Tools' }] : []),
    ];

    return (
      <div>
        {/* Tab Navigation */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(80px, 1fr))`,
            gap: '8px',
            marginBottom: '2rem',
            padding: '12px',
            background: 'rgba(255,255,255,0.01)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px',
                background: activeTab === tab.id ? 'rgba(0,180,255,0.15)' : 'transparent',
                border: activeTab === tab.id ? '1px solid rgba(0,180,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                color: activeTab === tab.id ? '#00b4ff' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                fontSize: '11px',
                fontWeight: 600,
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                }
              }}
            >
              <div style={{ fontSize: '18px' }}>{tab.icon}</div>
              <div>{tab.label}</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>{tab.sublabel}</div>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ minHeight: '400px' }}>
          {/* Hub Tab */}
          {activeTab === 'hub' && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🎮</div>
              <h2 style={{ fontSize: '24px', marginBottom: '0.5rem', color: '#fff' }}>Card Clash</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2rem' }}>
                Collect cards, build strategies, climb the rankings
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '12px',
                  maxWidth: '600px',
                  margin: '0 auto',
                }}
              >
                {[
                  { emoji: '🃏', text: `${ownedNames.size}/${100} Cards`, desc: 'Collection' },
                  { emoji: '🏆', text: `${standings.length}`, desc: 'Players' },
                  { emoji: '💰', text: `${stats?.coins || 0}`, desc: 'Coins' },
                ].map((stat, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '16px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)';
                    }}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>{stat.emoji}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                      {stat.text}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{stat.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collection Tab */}
          {activeTab === 'collection' && (
            <CardClashCollection ownedNames={ownedNames} newCardNames={newCardNames} stats={stats} />
          )}

          {/* Shop Tab */}
          {activeTab === 'shop' && (
            <CardClashShop
              stats={stats}
              playerId={playerId}
              playerName={playerName}
              onCardsReceived={onCardsReceived}
              onCoinsUpdate={onCoinsUpdate}
            />
          )}

          {/* Play Tab */}
          {activeTab === 'play' && playTabContent}

          {/* Practice Tab */}
          {activeTab === 'practice' && practiceTabContent}

          {/* Standings Tab */}
          {activeTab === 'standings' && (
            <CardClashLeaderboard standings={standings} playerId={playerId} onRefresh={onLoadData} />
          )}

          {/* Achievements Tab */}
          {activeTab === 'achievements' && achievementsTabContent}

          {/* Rules Tab */}
          {activeTab === 'rules' && rulesTabContent}

          {/* Admin Tab */}
          {activeTab === 'admin' && isAdmin && (
            <CardClashAdmin playerId={playerId} isAdmin={isAdmin} stats={stats} />
          )}
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.activeTab === next.activeTab &&
      prev.playerId === next.playerId &&
      prev.standings.length === next.standings.length &&
      prev.stats?.coins === next.stats?.coins &&
      prev.ownedNames.size === next.ownedNames.size
    );
  }
);

CardClashHub.displayName = 'CardClashHub';
