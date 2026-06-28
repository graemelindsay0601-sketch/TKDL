/**
 * Card Clash Collection Tab Component
 * 
 * Displays player's card collection with filters and search
 * Extracted from card-clash.tsx for modularity
 */

import React, { useState, useMemo } from 'react';
import { TKDLCard } from './TKDLCard';
import { SectionHeader } from './SectionHeader';
import { ALL_CARDS } from '@/lib/cards-data';
import type { CardData } from '@/lib/cards-data';

const CATEGORIES = [
  'X01 GOOD',
  'X01 BAD',
  'CRICKET GOOD',
  'CRICKET BAD',
];

const RARITIES = ['COMMON', 'RARE', 'LEGENDARY'];

const CAT_COLOR: Record<string, string> = {
  'X01 GOOD': '#00ff88',
  'X01 BAD': '#ff6b6b',
  'CRICKET GOOD': '#00e5ff',
  'CRICKET BAD': '#ff8c00',
};

const RAR_COLOR: Record<string, string> = {
  COMMON: '#888',
  RARE: '#00b4ff',
  LEGENDARY: '#ffd24a',
};

interface CardClashCollectionProps {
  ownedNames: Set<string>;
  newCardNames: Set<string>;
  stats?: {
    cardsOwned?: number;
    [key: string]: any;
  };
}

export const CardClashCollection = React.memo(
  function CardClashCollection({
    ownedNames,
    newCardNames,
    stats,
  }: CardClashCollectionProps) {
    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState<string>('ALL');
    const [rarFilter, setRarFilter] = useState<string>('ALL');
    const [showOwned, setShowOwned] = useState<'all' | 'owned' | 'unowned'>('all');
    const [enlargedCard, setEnlargedCard] = useState<CardData | null>(null);

    const totalOwned = ownedNames.size;
    const completionPct = Math.round((totalOwned / ALL_CARDS.length) * 100);

    // Filter cards based on all criteria
    const filteredCards = useMemo(() => {
      return ALL_CARDS.filter((card) => {
        const owned = ownedNames.has(card.name);

        // Search filter
        if (search && !card.name.toLowerCase().includes(search.toLowerCase())) {
          return false;
        }

        // Category filter
        if (catFilter !== 'ALL' && card.category !== catFilter) {
          return false;
        }

        // Rarity filter
        if (rarFilter !== 'ALL' && card.rarity !== rarFilter) {
          return false;
        }

        // Ownership filter
        if (showOwned === 'owned' && !owned) return false;
        if (showOwned === 'unowned' && owned) return false;

        return true;
      });
    }, [search, catFilter, rarFilter, showOwned]);

    return (
      <div>
        <SectionHeader
          title="🃏 Your Collection"
          subtitle={`${totalOwned} of ${ALL_CARDS.length} cards unlocked · ${completionPct}% complete`}
        />

        {/* Progress bar */}
        <div
          style={{
            height: '4px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '2px',
            overflow: 'hidden',
            marginBottom: '1.5rem',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${completionPct}%`,
              background: 'linear-gradient(90deg,#00e5ff,#ffd24a)',
              borderRadius: '2px',
              transition: 'width 0.8s',
              boxShadow: '0 0 8px rgba(0,229,255,0.5)',
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.5rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="🔍 Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '8px 14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              outline: 'none',
              minWidth: '140px',
            }}
          />

          {/* Category chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            <div
              onClick={() => setCatFilter('ALL')}
              style={{
                padding: '5px 12px',
                borderRadius: '16px',
                border: '1px solid rgba(170,170,170,0.3)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
                background: catFilter === 'ALL' ? 'rgba(170,170,170,0.2)' : 'transparent',
                color: catFilter === 'ALL' ? '#aaa' : 'rgba(170,170,170,0.6)',
                transition: 'all 0.2s',
              }}
            >
              ALL
            </div>
            {CATEGORIES.map((cat) => (
              <div
                key={cat}
                onClick={() => setCatFilter(cat === catFilter ? 'ALL' : cat)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '16px',
                  border: `1px solid ${CAT_COLOR[cat]}33`,
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: catFilter === cat ? `${CAT_COLOR[cat]}22` : 'transparent',
                  color: catFilter === cat ? CAT_COLOR[cat] : `${CAT_COLOR[cat]}66`,
                  transition: 'all 0.2s',
                }}
              >
                {cat.replace(' GOOD', '+ ').replace(' BAD', '−')}
              </div>
            ))}
          </div>

          {/* Rarity chips */}
          <div style={{ display: 'flex', gap: '5px' }}>
            <div
              onClick={() => setRarFilter('ALL')}
              style={{
                padding: '5px 12px',
                borderRadius: '16px',
                border: '1px solid rgba(170,170,170,0.3)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
                background: rarFilter === 'ALL' ? 'rgba(170,170,170,0.2)' : 'transparent',
                color: rarFilter === 'ALL' ? '#aaa' : 'rgba(170,170,170,0.6)',
              }}
            >
              ALL
            </div>
            {RARITIES.map((r) => (
              <div
                key={r}
                onClick={() => setRarFilter(r === rarFilter ? 'ALL' : r)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '16px',
                  border: `1px solid ${RAR_COLOR[r]}33`,
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: rarFilter === r ? `${RAR_COLOR[r]}22` : 'transparent',
                  color: rarFilter === r ? RAR_COLOR[r] : `${RAR_COLOR[r]}66`,
                }}
              >
                {r}
              </div>
            ))}
          </div>

          {/* Ownership filter */}
          <div style={{ display: 'flex', gap: '5px', marginLeft: 'auto' }}>
            {(['all', 'owned', 'unowned'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setShowOwned(v)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '7px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: showOwned === v ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: showOwned === v ? '#fff' : 'rgba(255,255,255,0.3)',
                }}
              >
                {v === 'all' ? 'All' : v === 'owned' ? '✓ Owned' : '○ Missing'}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginLeft: '10px' }}>
            {filteredCards.length} cards
          </div>
        </div>

        {/* Card grid */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
          {filteredCards.map((card) => {
            const owned = ownedNames.has(card.name);
            return (
              <div
                key={card.id}
                onClick={() => setEnlargedCard(card)}
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.18s',
                  flexShrink: 0,
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.06) translateY(-5px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                }}
              >
                <TKDLCard card={card} size="sm" locked={!owned} />
                {newCardNames.has(card.name) && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'linear-gradient(135deg,#ff3b3b,#ff6b00)',
                      color: '#fff',
                      fontSize: '9px',
                      fontWeight: 900,
                      padding: '2px 6px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(255,60,60,0.55)',
                      zIndex: 5,
                    }}
                  >
                    NEW
                  </div>
                )}
              </div>
            );
          })}

          {filteredCards.length === 0 && (
            <div style={{ width: '100%', textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.25)' }}>
              <div style={{ fontSize: '44px', marginBottom: '1rem' }}>🃏</div>
              <div>No cards match your filters</div>
            </div>
          )}
        </div>

        {/* Card detail modal would go here */}
        {enlargedCard && (
          <div
            onClick={() => setEnlargedCard(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <TKDLCard card={enlargedCard} size="lg" locked={!ownedNames.has(enlargedCard.name)} />
            </div>
          </div>
        )}
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.ownedNames === next.ownedNames &&
      prev.newCardNames === next.newCardNames &&
      prev.stats === next.stats
    );
  }
);

CardClashCollection.displayName = 'CardClashCollection';
