import React, { useState } from 'react';
import { ALL_CARDS } from '@/lib/cards-data';
import type { CardData } from '@/lib/cards-data';

interface EquipCardProps {
  card: {
    id: string;
    name: string;
    cardType: 'GOOD' | 'BAD';
    rarity: 'COMMON' | 'RARE' | 'LEGENDARY';
    effect: string;
    quantity: number;
    gameMode: string;
  };
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  showPreview?: boolean;
}

// Rarity colors
const RAR_COLOR: Record<string, { bg: string; border: string; label: string }> = {
  COMMON: { bg: 'rgba(154,176,196,0.08)', border: '#9ab0c4', label: '#9ab0c4' },
  RARE: { bg: 'rgba(0,180,255,0.08)', border: '#00b4ff', label: '#00b4ff' },
  LEGENDARY: { bg: 'rgba(255,170,0,0.12)', border: '#ffaa00', label: '#ffaa00' },
};

const CAT_COLOR: Record<string, string> = {
  'X01 GOOD': '#00b4ff',
  'X01 BAD': '#ff3b3b',
  'CRICKET GOOD': '#00cc66',
  'CRICKET BAD': '#9933ff',
  'WILDCARD GOOD': '#ffaa00',
  'WILDCARD BAD': '#cc1111',
};

/**
 * EquipCardDisplay Component
 * 
 * Enhanced card display for equipment selection screen
 * Shows card details with optional preview modal
 */
export function EquipCardDisplay({ 
  card, 
  selected, 
  disabled, 
  onClick,
  showPreview = true
}: EquipCardProps) {
  const [showModal, setShowModal] = useState(false);
  const rc = RAR_COLOR[card.rarity] ?? RAR_COLOR.COMMON;
  const isGood = card.cardType === 'GOOD';
  
  // Find full card data for preview
  const fullCard = ALL_CARDS.find(c => c.name === card.name);
  const category = fullCard?.category || 'WILDCARD GOOD';
  const catColor = CAT_COLOR[category as keyof typeof CAT_COLOR] || '#ffaa00';

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onClick();
    }
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showPreview) setShowModal(true);
  };

  return (
    <>
      {/* Main Card Button */}
      <button
        onClick={handleCardClick}
        disabled={disabled}
        style={{
          all: 'unset',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '12px',
          borderRadius: '10px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          background: selected
            ? isGood
              ? 'linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05))'
              : 'linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.05))'
            : rc.bg,
          border: `2px solid ${
            selected 
              ? isGood ? '#22c55e' : '#ef4444'
              : rc.border + '40'
          }`,
          boxShadow: selected
            ? `0 0 16px ${isGood ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`
            : 'none',
          opacity: disabled ? 0.4 : 1,
          minWidth: '140px',
          position: 'relative',
        }}
      >
        {/* Rarity Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 700,
            color: rc.label,
            letterSpacing: '0.06em',
          }}
        >
          <span style={{ fontSize: '12px' }}>
            {card.rarity === 'LEGENDARY' ? '♛' : card.rarity === 'RARE' ? '◆' : '●'}
          </span>
          {card.rarity}
        </div>

        {/* Card Name */}
        <div
          style={{
            fontWeight: 800,
            fontSize: '13px',
            color: '#fff',
            lineHeight: 1.2,
            textAlign: 'left',
          }}
        >
          {card.name}
        </div>

        {/* Category & Type */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
            color: catColor,
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          <span style={{ fontSize: '11px' }}>{isGood ? '⚡' : '💀'}</span>
          {category.split(' ')[0]}
        </div>

        {/* Effect Preview (first 2 lines) */}
        <div
          style={{
            fontSize: '9px',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.4,
            textAlign: 'left',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '18px',
          }}
        >
          {card.effect}
        </div>

        {/* Quantity & Preview */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: 'rgba(255,255,255,0.4)',
            marginTop: '4px',
          }}
        >
          <span>×{card.quantity}</span>
          {showPreview && !disabled && (
            <button
              onClick={handlePreviewClick}
              style={{
                all: 'unset',
                cursor: 'pointer',
                color: rc.label,
                fontWeight: 600,
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: `${rc.border}15`,
                border: `1px solid ${rc.border}40`,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${rc.border}30`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${rc.border}15`;
              }}
            >
              👁 Preview
            </button>
          )}
        </div>

        {/* Selection Checkmark */}
        {selected && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: isGood ? '#22c55e' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 900,
              color: '#fff',
              boxShadow: `0 0 12px ${isGood ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
            }}
          >
            ✓
          </div>
        )}
      </button>

      {/* Card Preview Modal */}
      {showModal && fullCard && (
        <CardPreviewModal card={fullCard} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

/**
 * CardPreviewModal - Show full card details
 */
function CardPreviewModal({
  card,
  onClose,
}: {
  card: CardData;
  onClose: () => void;
}) {
  const catColor =
    CAT_COLOR[card.category as keyof typeof CAT_COLOR] || '#ffaa00';
  const isGood = card.category.includes('GOOD');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg,rgba(10,10,30,0.95),rgba(20,10,40,0.95))',
          border: `2px solid ${catColor}40`,
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '400px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: `0 0 40px ${catColor}40`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            all: 'unset',
            position: 'absolute',
            top: '12px',
            right: '12px',
            cursor: 'pointer',
            fontSize: '24px',
            color: 'rgba(255,255,255,0.5)',
            padding: '4px 8px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
          }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '18px' }}>{isGood ? '⚡' : '💀'}</span>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#fff' }}>
              {card.name}
            </h2>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: catColor,
                background: `${catColor}20`,
                padding: '4px 10px',
                borderRadius: '6px',
                border: `1px solid ${catColor}40`,
                letterSpacing: '0.04em',
              }}
            >
              {card.category}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: RAR_COLOR[card.rarity].label,
                background: `${RAR_COLOR[card.rarity].bg}`,
                padding: '4px 10px',
                borderRadius: '6px',
                border: `1px solid ${RAR_COLOR[card.rarity].border}40`,
              }}
            >
              {card.rarity}
            </span>
            {card.energyCost && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#ffd24a',
                  background: 'rgba(255,210,74,0.15)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,210,74,0.3)',
                }}
              >
                ⚙️ Energy: {card.energyCost}
              </span>
            )}
          </div>
        </div>

        {/* Effect Description */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: catColor,
              marginBottom: '6px',
              letterSpacing: '0.05em',
            }}
          >
            EFFECT
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: '#fff',
              lineHeight: 1.6,
              padding: '12px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              border: `1px solid ${catColor}20`,
            }}
          >
            {card.effect}
          </p>
        </div>

        {/* Flavor Text */}
        {card.flavourText && (
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.4)',
                marginBottom: '6px',
                letterSpacing: '0.05em',
              }}
            >
              FLAVOR
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '12px',
                color: 'rgba(255,255,255,0.6)',
                fontStyle: 'italic',
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                borderLeft: `3px solid ${catColor}`,
              }}
            >
              "{card.flavourText}"
            </p>
          </div>
        )}

        {/* Info Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
              TYPE
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: catColor }}>
              {isGood ? 'GOOD' : 'BAD'}
            </div>
          </div>
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
              CARD ID
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
              #{card.id}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
