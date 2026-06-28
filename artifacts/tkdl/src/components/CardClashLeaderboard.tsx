/**
 * Card Clash Leaderboard Tab Component
 * 
 * Extracted from card-clash.tsx for modularity
 * Displays virtualized standings leaderboard
 */

import React from 'react';
import { VirtualizedLeaderboard } from './VirtualizedLeaderboard';
import { SectionHeader } from './SectionHeader';

interface Standing {
  player_id: number;
  player_name: string;
  wins: number;
  losses: number;
  total_matches: number;
  win_percentage?: number;
  cards_unlocked_count?: number;
  cards_owned?: number;
  coins?: number;
  updated_at?: string;
}

interface CardClashLeaderboardProps {
  standings: Standing[];
  playerId: number | undefined;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const CardClashLeaderboard = React.memo(
  function CardClashLeaderboard({
    standings,
    playerId,
    onRefresh,
    isLoading = false,
  }: CardClashLeaderboardProps) {
    if (isLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.25)' }}>
          Loading standings...
        </div>
      );
    }

    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '1.75rem',
          }}
        >
          <SectionHeader
            title="🏆 Leaderboard"
            subtitle="All-time Card Clash rankings"
            noMargin
          />
          <button
            onClick={onRefresh}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '7px',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {standings.length > 0 ? (
          <VirtualizedLeaderboard
            standings={standings}
            playerId={playerId || 0}
            containerHeight="600px"
          />
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem 1rem',
              color: 'rgba(255,255,255,0.25)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '14px',
              background: 'rgba(255,255,255,0.025)',
            }}
          >
            <div style={{ fontSize: '44px', marginBottom: '1rem' }}>🏆</div>
            <div style={{ marginBottom: '1rem' }}>Waiting for players to join Card Clash...</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.15)' }}>
              Inactive players will appear here soon
            </div>
          </div>
        )}
      </div>
    );
  },
  (prev, next) => {
    // Only re-render if key props change
    return (
      prev.standings.length === next.standings.length &&
      prev.playerId === next.playerId &&
      prev.isLoading === next.isLoading
    );
  }
);

CardClashLeaderboard.displayName = 'CardClashLeaderboard';
