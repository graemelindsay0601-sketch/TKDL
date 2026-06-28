import React, { useState, useEffect } from 'react';

interface FeaturedCard {
  id: number;
  cardId: number;
  cardName?: string;
  name?: string;
  rarity: 'COMMON' | 'RARE' | 'LEGENDARY';
  priceCoins: number;
  slotNumber: number;
  imageUrl?: string;
}

interface PurchaseCooldown {
  canPurchase: boolean;
  hoursUntilAvailable: number;
  lastPurchasedAt: Date | null;
}

interface FeaturedCardShopProps {
  playerId: number;
  playerCoins: number;
  onPurchaseSuccess?: () => void;
}

const RARITY_COLORS: Record<string, { bg: string; border: string; accent: string }> = {
  COMMON: {
    bg: 'rgba(126, 184, 212, 0.08)',
    border: 'rgba(126, 184, 212, 0.3)',
    accent: '#7eb8d4',
  },
  RARE: {
    bg: 'rgba(168, 85, 247, 0.08)',
    border: 'rgba(168, 85, 247, 0.3)',
    accent: '#a855f7',
  },
  LEGENDARY: {
    bg: 'rgba(255, 170, 0, 0.08)',
    border: 'rgba(255, 170, 0, 0.3)',
    accent: '#ffaa00',
  },
};

export function FeaturedCardShop({
  playerId,
  playerCoins,
  onPurchaseSuccess,
}: FeaturedCardShopProps) {
  const [cards, setCards] = useState<FeaturedCard[]>([]);
  const [cooldowns, setCooldowns] = useState<Map<number, PurchaseCooldown>>(new Map());
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);

  // Timers for countdown display
  const [timers, setTimers] = useState<Map<number, { hours: number; minutes: number; seconds: number }>>(new Map());

  useEffect(() => {
    loadFeaturedCards();
  }, [playerId]);

  const loadFeaturedCards = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/card-clash/shop/featured');
      if (!res.ok) throw new Error('Failed to load featured cards');
      const data = await res.json();
      setCards(Array.isArray(data) ? data : data.cards || []);
      
      // Check cooldowns for each card
      checkAllCooldowns(Array.isArray(data) ? data : data.cards || []);
    } catch (err) {
      console.error('Error loading featured cards:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkAllCooldowns = async (cardList: FeaturedCard[]) => {
    if (cardList.length === 0) return;

    const newCooldowns = new Map<number, PurchaseCooldown>();
    
    // OPTIMIZATION: Batch query instead of N queries
    // Query all card purchase histories in ONE request instead of 3 separate requests
    try {
      const cooldownsResponse = await fetch('/api/card-clash/shop/featured/purchase-status/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardIds: cardList.map(c => c.cardId),
        }),
      });

      if (cooldownsResponse.ok) {
        const cooldownsData = await cooldownsResponse.json();
        
        // cooldownsData should be an object: { cardId: cooldownInfo }
        for (const card of cardList) {
          if (cooldownsData[card.cardId]) {
            const cooldown = cooldownsData[card.cardId];
            newCooldowns.set(card.cardId, cooldown);
            
            // Start timer if on cooldown
            if (!cooldown.canPurchase && cooldown.hoursUntilAvailable > 0) {
              startCooldownTimer(card.cardId, cooldown.hoursUntilAvailable);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error batch checking cooldowns:', err);
      
      // Fallback: Check individually if batch fails
      for (const card of cardList) {
        try {
          const res = await fetch(`/api/card-clash/shop/featured/${card.cardId}/purchase-status`);
          if (res.ok) {
            const data = await res.json();
            newCooldowns.set(card.cardId, data);
            
            if (!data.canPurchase && data.hoursUntilAvailable > 0) {
              startCooldownTimer(card.cardId, data.hoursUntilAvailable);
            }
          }
        } catch (err) {
          console.error(`Error checking cooldown for card ${card.cardId}:`, err);
        }
      }
    }
    
    setCooldowns(newCooldowns);
  };

  const startCooldownTimer = (cardId: number, hoursRemaining: number) => {
    const endTime = Date.now() + hoursRemaining * 60 * 60 * 1000;
    
    const updateTimer = () => {
      const now = Date.now();
      const diff = endTime - now;
      
      if (diff <= 0) {
        setTimers((prev) => {
          const next = new Map(prev);
          next.delete(cardId);
          return next;
        });
        // Cooldown expired, reload
        loadFeaturedCards();
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        setTimers((prev) => new Map(prev).set(cardId, { hours, minutes, seconds }));
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  };

  const handlePurchase = async (card: FeaturedCard) => {
    const cooldown = cooldowns.get(card.cardId);
    if (cooldown && !cooldown.canPurchase) {
      alert(`Card on cooldown. Available in ${cooldown.hoursUntilAvailable} hours`);
      return;
    }

    if (playerCoins < card.priceCoins) {
      alert(`Not enough coins. Need ${card.priceCoins}, have ${playerCoins}`);
      return;
    }

    try {
      setPurchasing(card.cardId);
      const res = await fetch(`/api/card-clash/shop/featured/${card.cardId}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Purchase failed');
      }

      const result = await res.json();
      alert(`Purchased ${result.cardName} for ${result.coinsSpent} coins!`);
      onPurchaseSuccess?.();
      loadFeaturedCards();
    } catch (err) {
      console.error('Purchase error:', err);
      alert(`Purchase failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.5)' }}>
        Loading featured cards...
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: '14px', fontWeight: 900, letterSpacing: '0.08em', marginBottom: '16px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
        ✨ Today's Featured Cards
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {cards.map((card) => {
          const cooldown = cooldowns.get(card.cardId);
          const timer = timers.get(card.cardId);
          const colors = RARITY_COLORS[card.rarity] || RARITY_COLORS.COMMON;
          const cardName = card.cardName || card.name || `Card #${card.cardId}`;
          const isOnCooldown = cooldown && !cooldown.canPurchase;
          const hasEnoughCoins = playerCoins >= card.priceCoins;

          return (
            <div
              key={card.cardId}
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                padding: '16px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Rarity badge */}
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  fontSize: '11px',
                  fontWeight: 900,
                  color: colors.accent,
                  background: 'rgba(0,0,0,0.3)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  letterSpacing: '0.05em',
                }}
              >
                {card.rarity}
              </div>

              {/* Card placeholder/image */}
              <div
                style={{
                  width: '100%',
                  height: '180px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: '32px',
                  border: `1px solid ${colors.border}`,
                }}
              >
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt={cardName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '7px' }} />
                ) : (
                  '🎴'
                )}
              </div>

              {/* Card name */}
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff', marginBottom: '8px', lineHeight: 1.2 }}>
                {cardName}
              </div>

              {/* Price */}
              <div style={{ fontSize: '12px', color: colors.accent, marginBottom: '12px', fontWeight: 700 }}>
                {card.priceCoins} 🪙
              </div>

              {/* Cooldown display or purchase button */}
              {isOnCooldown && timer ? (
                <div
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    padding: '10px',
                    textAlign: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
                    Cooldown
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: colors.accent }}>
                    {String(timer.hours).padStart(2, '0')}:{String(timer.minutes).padStart(2, '0')}:{String(timer.seconds).padStart(2, '0')}
                  </div>
                </div>
              ) : null}

              {/* Purchase button */}
              <button
                disabled={purchasing === card.cardId || isOnCooldown || !hasEnoughCoins}
                onClick={() => handlePurchase(card)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: isOnCooldown || !hasEnoughCoins ? 'rgba(255,255,255,0.05)' : colors.bg,
                  border: `1px solid ${isOnCooldown || !hasEnoughCoins ? 'rgba(255,255,255,0.1)' : colors.border}`,
                  borderRadius: '8px',
                  color: isOnCooldown || !hasEnoughCoins ? 'rgba(255,255,255,0.3)' : colors.accent,
                  fontWeight: 900,
                  fontSize: '12px',
                  cursor: isOnCooldown || !hasEnoughCoins || purchasing === card.cardId ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {purchasing === card.cardId ? '⏳ Buying...' : isOnCooldown ? '🔒 Cooldown' : !hasEnoughCoins ? '💸 Insufficient' : '🛒 Buy Now'}
              </button>

              {/* Cooldown info message */}
              {isOnCooldown && (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '8px', textAlign: 'center', fontStyle: 'italic' }}>
                  Can buy again in {cooldown?.hoursUntilAvailable}h
                </div>
              )}
            </div>
          );
        })}
      </div>

      {cards.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: 'rgba(255,255,255,0.3)' }}>
          No featured cards today. Try again later!
        </div>
      )}
    </div>
  );
}
