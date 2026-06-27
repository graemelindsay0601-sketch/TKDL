import React, { useState } from 'react';
import { Heart } from 'lucide-react';

interface FavoriteButtonProps {
  cardId: number;
  playerId: number;
  isFavorite: boolean;
  onToggle?: (isFavorite: boolean) => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'icon-only' | 'with-text';
}

/**
 * FavoriteButton Component
 * 
 * Allows players to mark/unmark cards as favorites.
 * Favorites appear at the top of the collection and equip screen.
 * 
 * Usage:
 * <FavoriteButton 
 *   cardId={card.id} 
 *   playerId={16} 
 *   isFavorite={card.isFavorite}
 *   onToggle={(isFav) => handleFavoriteChange(isFav)}
 * />
 */
export function FavoriteButton({
  cardId,
  playerId,
  isFavorite: initialFavorite,
  onToggle,
  size = 'medium',
  variant = 'icon-only',
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/cards/${cardId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsFavorite(data.isFavorite);
        onToggle?.(data.isFavorite);
      } else {
        console.error('Failed to toggle favorite');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeMap = {
    small: { icon: 16, padding: '4px' },
    medium: { icon: 20, padding: '6px' },
    large: { icon: 24, padding: '8px' },
  };

  const sizes = sizeMap[size];

  const buttonStyle = {
    background: isFavorite ? 'rgba(255,82,82,0.15)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${isFavorite ? 'rgba(255,82,82,0.4)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: '8px',
    padding: sizes.padding,
    cursor: isLoading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    opacity: isLoading ? 0.6 : 1,
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      style={buttonStyle}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      onMouseEnter={(e) => {
        const target = e.currentTarget;
        if (!isLoading) {
          target.style.background = isFavorite
            ? 'rgba(255,82,82,0.25)'
            : 'rgba(255,255,255,0.1)';
          target.style.borderColor = isFavorite
            ? 'rgba(255,82,82,0.6)'
            : 'rgba(255,255,255,0.2)';
        }
      }}
      onMouseLeave={(e) => {
        const target = e.currentTarget;
        target.style.background = isFavorite
          ? 'rgba(255,82,82,0.15)'
          : 'rgba(255,255,255,0.05)';
        target.style.borderColor = isFavorite
          ? 'rgba(255,82,82,0.4)'
          : 'rgba(255,255,255,0.1)';
      }}
    >
      <Heart
        size={sizes.icon}
        fill={isFavorite ? '#ff5252' : 'none'}
        color={isFavorite ? '#ff5252' : 'rgba(255,255,255,0.4)'}
        style={{ transition: 'all 0.2s ease' }}
      />
      {variant === 'with-text' && (
        <span
          style={{
            marginLeft: '6px',
            fontSize: size === 'small' ? '11px' : '12px',
            color: isFavorite ? '#ff5252' : 'rgba(255,255,255,0.4)',
            fontWeight: 600,
          }}
        >
          {isFavorite ? 'Favorite' : 'Add'}
        </span>
      )}
    </button>
  );
}

/**
 * FavoriteBadge Component
 * 
 * Small visual indicator that a card is favorited
 * Use in list views where space is limited
 */
export function FavoriteBadge({ isFavorite }: { isFavorite: boolean }) {
  if (!isFavorite) return null;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        background: 'rgba(255,82,82,0.15)',
        border: '1px solid rgba(255,82,82,0.3)',
        borderRadius: '6px',
        fontSize: '10px',
        color: '#ff5252',
        fontWeight: 600,
      }}
    >
      <Heart size={12} fill="#ff5252" color="#ff5252" />
      FAVORITE
    </div>
  );
}
