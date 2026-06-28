import React, { useState, useEffect } from 'react';
import { CardEquipmentSelector } from './CardEquipmentSelector';

interface PracticeModeProps {
  playerId: number;
  onMatchCreated?: (matchId: number) => void;
}

interface BotOpponent {
  id: string;
  name: string;
  difficulty: string;
  description: string;
  avatar: string;
  skillLevel: number;
}

interface Card {
  id: number;
  name: string;
  cardId?: string;
  category?: string;
  rarity: string;
  effect?: string;
  cardType?: string;
  gameMode?: string;
  quantity?: number;
}

type Step = 'opponent-select' | 'gamemode-select' | 'equipment-select' | 'confirm';

/**
 * CardClashPracticeMode
 * 
 * Allows players to test any card strategy without ranking impact
 * - Select from 3 bot difficulties
 * - Pick ANY card from full 100-card pool
 * - Choose X01 or CRICKET mode
 * - Play practice match with full scoring
 * - No coins consumed, no ranking impact
 */
export function CardClashPracticeMode({
  playerId,
  onMatchCreated,
}: PracticeModeProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('opponent-select');
  const [selectedOpponent, setSelectedOpponent] = useState<BotOpponent | null>(null);
  const [gameType, setGameType] = useState<'X01' | 'CRICKET'>('X01');
  const [equippedCards, setEquippedCards] = useState<any[]>([]);
  const [bots, setBots] = useState<BotOpponent[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Load data on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');

        const [botsRes, cardsRes] = await Promise.all([
          fetch('/api/card-clash/practice/bots'),
          fetch('/api/card-clash/all-cards'),
        ]);

        if (!botsRes.ok || !cardsRes.ok) {
          setError('Failed to load practice mode data');
          return;
        }

        const botsData = await botsRes.json();
        const cardsData = await cardsRes.json();

        setBots(botsData.bots || []);
        setAllCards(cardsData.cards || []);
      } catch (err) {
        console.error('Failed to load practice data:', err);
        setError('Failed to load practice mode');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // ── Equipment selected ─────────────────────────────────────────────────
  const handleEquipmentConfirm = (goodCards: Card[], badCards: Card[]) => {
    if (goodCards.length !== 2 || badCards.length !== 2) {
      setError('Please equip 2 GOOD and 2 BAD cards');
      return;
    }
    setEquippedCards([...goodCards, ...badCards]);
    setStep('confirm');
  };

  // ── Create and launch practice match ───────────────────────────────────
  const handleStartPractice = async () => {
    if (!selectedOpponent || equippedCards.length !== 4) {
      setError('Select opponent and equip 2 GOOD + 2 BAD cards');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/card-clash/practice/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          opponentId: selectedOpponent.id,
          gameMode: gameType,
          equippedCards: equippedCards.map((c: any) => ({ 
            cardId: c.id || c.cardId || c.name, 
            cardType: c.cardType || 'GOOD',
            name: c.name 
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to create practice match');
        return;
      }

      const data = await response.json();
      onMatchCreated?.(data.matchId);
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to create practice match');
    } finally {
      setLoading(false);
    }
  };

  // ── Render: Opponent Selection ─────────────────────────────────────────
  if (step === 'opponent-select') {
    return (
      <div style={{ maxWidth: '500px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: 900 }}>
          🎓 Card Clash Practice Mode
        </h2>
        <p
          style={{
            margin: '0 0 24px',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '13px',
          }}
        >
          Test any strategy risk-free. Use ANY cards from the full pool—even ones you don't own.
          Practice matches don't affect your ranking.
        </p>

        <h3 style={{ margin: '24px 0 12px', fontSize: '14px', fontWeight: 700 }}>
          Choose Your Opponent
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          {bots.map((bot) => (
            <button
              key={bot.id}
              onClick={() => {
                setSelectedOpponent(bot);
                setStep('gamemode-select');
              }}
              style={{
                padding: '16px 12px',
                background:
                  selectedOpponent?.id === bot.id
                    ? 'rgba(0,200,150,0.2)'
                    : 'rgba(255,255,255,0.05)',
                border:
                  selectedOpponent?.id === bot.id
                    ? '2px solid rgba(0,200,150,0.6)'
                    : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: '#fff',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>{bot.avatar}</div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>
                {bot.name}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.4)',
                  marginBottom: '4px',
                }}
              >
                {bot.difficulty}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                ⭐ {bot.skillLevel}/10
              </div>
            </button>
          ))}
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(255,100,100,0.1)',
              border: '1px solid rgba(255,100,100,0.3)',
              borderRadius: '8px',
              color: '#ff9999',
              fontSize: '12px',
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── Render: Game Mode Selection ────────────────────────────────────────
  if (step === 'gamemode-select') {
    return (
      <div style={{ maxWidth: '500px' }}>
        <button
          onClick={() => setStep('opponent-select')}
          style={{
            all: 'unset',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            marginBottom: '1.5rem',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.45)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ← BACK
        </button>
        
        <h2 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: 900 }}>
          Choose Game Mode
        </h2>
        <p style={{ margin: '0 0 24px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
          Opponent: <strong>{selectedOpponent?.name}</strong>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          {(['X01', 'CRICKET'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setGameType(mode);
                setStep('equipment-select');
              }}
              style={{
                padding: '20px 16px',
                background: gameType === mode ? 'rgba(0,150,255,0.2)' : 'rgba(255,255,255,0.05)',
                border: gameType === mode ? '2px solid rgba(0,150,255,0.6)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 700,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                {mode === 'X01' ? '🎯' : '🏁'}
              </div>
              {mode}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ padding: '12px 14px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: '8px', color: '#ff9999', fontSize: '12px' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── Render: Equipment Selection ────────────────────────────────────────
  if (step === 'equipment-select') {
    return (
      <div>
        <button
          onClick={() => setStep('gamemode-select')}
          style={{
            all: 'unset',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            marginBottom: '1.5rem',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.45)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ← BACK
        </button>
        
        <CardEquipmentSelector 
          playerId={playerId!}
          gameMode={gameType}
          onEquip={handleEquipmentConfirm}
          onCancel={() => setStep('gamemode-select')}
        />
      </div>
    );
  }

  if (step === 'confirm') {
    const goodCards = equippedCards.filter((c: any) => c.cardType === 'GOOD');
    const badCards = equippedCards.filter((c: any) => c.cardType === 'BAD');

    return (
      <div style={{ maxWidth: '600px' }}>
        <button
          onClick={() => setStep('equipment-select')}
          style={{
            all: 'unset',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            marginBottom: '1.5rem',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.45)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ← BACK
        </button>

        <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 900 }}>
          ✓ Ready to Practice?
        </h2>
        <p style={{ margin: '0 0 20px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
          Match: <strong>{selectedOpponent?.name}</strong> • <strong>{gameType}</strong>
        </p>

        <div style={{ padding: '16px', background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: '10px', marginBottom: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontWeight: 700 }}>⚡ GOOD CARDS (Boost You)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {goodCards.map((c: any, i: number) => (
                <div key={i} style={{ fontSize: '12px', padding: '8px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '6px', color: '#00ff88' }}>
                  {c.name || c.cardName || `Card ${i + 1}`}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>💀 BAD CARDS (Curse Opponent)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {badCards.map((c: any, i: number) => (
                <div key={i} style={{ fontSize: '12px', padding: '8px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: '6px', color: '#ff9999' }}>
                  {c.name || c.cardName || `Card ${i + 1}`}
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 14px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: '8px', color: '#ff9999', fontSize: '12px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleStartPractice}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #00cc66, #00aa44)',
            color: '#fff',
            transition: 'all 0.2s',
          }}
        >
          {loading ? 'Launching...' : '🎴 Launch Practice Match'}
        </button>
      </div>
    );
  }
}
