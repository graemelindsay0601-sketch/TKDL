import React from 'react';
import { getCardGridPosition, getCardImageUrl, getCardBackgroundPosition, getCardBackgroundSize } from '../lib/card-image-mapping';

interface CardDisplayProps {
  cardId: number;
  cardName?: string;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  className?: string;
}

export const CardDisplay: React.FC<CardDisplayProps> = ({
  cardId,
  cardName,
  size = 'medium',
  onClick,
  className = '',
}) => {
  const position = getCardGridPosition(cardId);

  if (!position) {
    return (
      <div
        className={`card-display card-display-${size} bg-gray-700 rounded border border-gray-600 flex items-center justify-center ${className}`}
        onClick={onClick}
      >
        <span className="text-gray-400 text-xs">Card {cardId}</span>
      </div>
    );
  }

  const imageUrl = getCardImageUrl(position.grid);
  const backgroundPosition = getCardBackgroundPosition(cardId);
  const backgroundSize = getCardBackgroundSize();

  // Size dimensions in pixels
  const sizeMap = {
    small: 80,
    medium: 120,
    large: 180,
  };

  const dimension = sizeMap[size];

  return (
    <div
      className={`card-display card-display-${size} relative rounded-lg overflow-hidden shadow-lg cursor-pointer border-2 border-amber-400 transition-transform hover:scale-105 ${className}`}
      style={{
        width: dimension,
        height: dimension * 1.35, // Card aspect ratio
        backgroundImage: `url('${imageUrl}')`,
        backgroundPosition: backgroundPosition || 'center',
        backgroundSize: backgroundSize,
        backgroundRepeat: 'no-repeat',
      }}
      onClick={onClick}
      title={cardName || `Card ${cardId}`}
    >
      {/* Optional overlay with card info */}
      {size === 'large' && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white p-1 text-center text-xs font-bold">
          {cardName && <div>{cardName}</div>}
          <div>Card #{cardId}</div>
        </div>
      )}
    </div>
  );
};

/**
 * CardGrid - Display multiple cards in a grid layout
 */
interface CardGridProps {
  cardIds: number[];
  size?: 'small' | 'medium' | 'large';
  onCardClick?: (cardId: number) => void;
  className?: string;
}

export const CardGrid: React.FC<CardGridProps> = ({
  cardIds,
  size = 'medium',
  onCardClick,
  className = '',
}) => {
  const colsMap = {
    small: 'grid-cols-6',
    medium: 'grid-cols-4',
    large: 'grid-cols-3',
  };

  return (
    <div className={`grid ${colsMap[size]} gap-4 p-4 ${className}`}>
      {cardIds.map((cardId) => (
        <CardDisplay
          key={cardId}
          cardId={cardId}
          size={size}
          onClick={() => onCardClick?.(cardId)}
        />
      ))}
    </div>
  );
};

/**
 * CardBack - Display card back design
 */
interface CardBackProps {
  type: 'x01-good' | 'x01-bad' | 'cricket-good' | 'cricket-bad' | 'wildcard-good' | 'wildcard-bad';
  size?: 'small' | 'medium' | 'large';
}

export const CardBack: React.FC<CardBackProps> = ({ type, size = 'medium' }) => {
  const sizeMap = {
    small: 80,
    medium: 120,
    large: 180,
  };

  const dimension = sizeMap[size];

  // Map type to back design position
  const backPositions: Record<string, { x: number; y: number }> = {
    'x01-good': { x: 0, y: 0 },     // Top-left: Blue
    'x01-bad': { x: 33.33, y: 0 },  // Top-middle: Red
    'cricket-good': { x: 66.66, y: 0 }, // Top-right: Green
    'cricket-bad': { x: 0, y: 33.33 },  // Middle-left: Purple
    'wildcard-good': { x: 33.33, y: 33.33 }, // Middle-middle: Gold
    'wildcard-bad': { x: 66.66, y: 33.33 },  // Middle-right: Magenta/Purple
  };

  const pos = backPositions[type] || { x: 0, y: 0 };

  return (
    <div
      style={{
        width: dimension,
        height: dimension * 1.35,
        backgroundImage: "url('/cards/card-backs.png')",
        backgroundPosition: `${pos.x}% ${pos.y}%`,
        backgroundSize: '300% 300%',
        backgroundRepeat: 'no-repeat',
        borderRadius: '8px',
        border: '2px solid #d97706',
        overflow: 'hidden',
      }}
    />
  );
};
