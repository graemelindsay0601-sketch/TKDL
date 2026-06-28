/**
 * Card Clash Shop Tab Component
 * 
 * Manages card packs, featured shop, and free packs
 * Extracted from card-clash.tsx for modularity
 */

import React, { useState } from 'react';
import { CardShopUI } from './CardShopUI';
import { FreePackDisplay } from './FreePackDisplay';
import { FeaturedCardShop } from './FeaturedCardShop';
import { SectionHeader } from './SectionHeader';

interface ShopStats {
  coins?: number;
  packTokens?: number;
  cardPoints?: number;
  [key: string]: any;
}

interface CardClashShopProps {
  stats: ShopStats | undefined;
  playerId: number | undefined;
  playerName: string;
  onCoinsUpdate?: (newCoins: number) => void;
  onCardsReceived?: () => void;
}

export const CardClashShop = React.memo(
  function CardClashShop({
    stats,
    playerId,
    playerName,
    onCoinsUpdate,
    onCardsReceived,
  }: CardClashShopProps) {
    const [shopTab, setShopTab] = useState<'packs' | 'featured' | 'free'>('packs');
    const [isOpeningPack, setIsOpeningPack] = useState(false);

    const coins = stats?.coins || 0;

    const handlePackOpened = () => {
      setIsOpeningPack(false);
      onCardsReceived?.();
    };

    return (
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <SectionHeader
          title="🛍️ Card Shop"
          subtitle="Open packs. Build your arsenal. All 100 cards waiting."
        />

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
          {(['packs', 'featured', 'free'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setShopTab(tab)}
              style={{
                padding: '8px 16px',
                background: shopTab === tab ? 'rgba(0,180,255,0.2)' : 'transparent',
                border: shopTab === tab ? '1px solid rgba(0,180,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: shopTab === tab ? '#00b4ff' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              {tab === 'packs' && '📦 Packs'}
              {tab === 'featured' && '⭐ Featured'}
              {tab === 'free' && '🎁 Free'}
            </button>
          ))}
        </div>

        {/* Coin display */}
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(255,140,0,0.05)',
            border: '1px solid rgba(255,140,0,0.2)',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Available Coins:</span>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: '#ff8c00',
            }}
          >
            {coins.toLocaleString()}
          </span>
        </div>

        {/* Tab content */}
        {shopTab === 'packs' && (
          <CardShopUI
            playerId={playerId}
            playerName={playerName}
            onCardsReceived={handlePackOpened}
          />
        )}

        {shopTab === 'featured' && (
          <FeaturedCardShop
            playerId={playerId}
            onPurchase={handlePackOpened}
          />
        )}

        {shopTab === 'free' && (
          <FreePackDisplay
            playerId={playerId}
            playerName={playerName}
            onFreePackOpened={handlePackOpened}
          />
        )}

        {/* Loading overlay */}
        {isOpeningPack && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
            }}
          >
            <div style={{ textAlign: 'center', color: '#fff' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✨</div>
              <div>Opening pack...</div>
            </div>
          </div>
        )}

        {/* Info section */}
        <div
          style={{
            marginTop: '2rem',
            padding: '16px',
            background: 'rgba(0,229,255,0.05)',
            border: '1px solid rgba(0,229,255,0.2)',
            borderRadius: '10px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: '1.6',
          }}
        >
          <div style={{ marginBottom: '8px', fontWeight: 600, color: 'rgba(0,229,255,0.7)' }}>
            💡 Tip: Collect all 100 cards to complete your collection
          </div>
          <div>
            Every pack is guaranteed to contain at least one card you don't have, until you've unlocked the entire collection.
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.stats?.coins === next.stats?.coins &&
      prev.playerId === next.playerId &&
      prev.playerName === next.playerName
    );
  }
);

CardClashShop.displayName = 'CardClashShop';
