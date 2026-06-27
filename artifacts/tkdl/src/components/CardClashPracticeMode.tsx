import React, { useState, useEffect } from 'react';

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
  category: string;
  rarity: string;
  effect: string;
}

type Step = 'opponent-select' | 'card-select' | 'confirm';

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
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [gameType, setGameType] = useState<'X01' | 'CRICKET'>('X01');
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

  // ── Card selection ─────────────────────────────────────────────────────
  const handleCardSelect = (cardId: number) => {
    setSelectedCards((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      } else if (prev.length < 4) {
        return [...prev, cardId];
      }
      return prev;
    });
  };

  // ── Create and launch practice match ───────────────────────────────────
  const handleStartPractice = async () => {
    if (!selectedOpponent || selectedCards.length !== 4) {
      setError('Select opponent and 4 cards');
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
          selectedCards,
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
                setStep('card-select');
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

  // ── Render: Card Selection ─────────────────────────────────────────────
  if (step === 'card-select') {
    const filteredCards = allCards.filter((c) => {
      if (gameType === 'X01') return !c.category.includes('CRICKET');
      if (gameType === 'CRICKET') return !c.category.includes('X01');
      return true;
    });

    return (
      <div style={{ maxWidth: '600px' }}>
        <button
          onClick={() => setStep('opponent-select')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontSize: '13px',
            marginBottom: '16px',
            padding: 0,
          }}
        >
          ← Back
        </button>

        <h2 style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: 900 }}>
          🎯 Select 4 Cards
        </h2>
        <p style={{ margin: '0 0 16px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
          Playing vs <strong>{selectedOpponent?.name}</strong>
        </p>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
            <input
              type="radio"
              name="gameType"
              value="X01"
              checked={gameType === 'X01'}
              onChange={() => setGameType('X01')}
              style={{ cursor: 'pointer' }}
            />
            <span>X01 ({filteredCards.filter(c => !c.category.includes('CRICKET')).length} cards)</span>
          </label>
          <label style={{ display: 'flex', gap: '12px', fontSize: '13px', marginTop: '8px' }}>
            <input
              type="radio"
              name="gameType"
              value="CRICKET"
              checked={gameType === 'CRICKET'}
              onChange={() => setGameType('CRICKET')}
              style={{ cursor: 'pointer' }}
            />
            <span>CRICKET ({filteredCards.filter(c => !c.category.includes('X01')).length} cards)</span>
          </label>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
            gap: '8px',
            marginBottom: '20px',
            maxHeight: '320px',
            overflowY: 'auto',
            padding: '4px',
          }}
        >
          {filteredCards.map((card) => (
            <button
              key={card.id}
              onClick={() => handleCardSelect(card.id)}
              disabled={selectedCards.length === 4 && !selectedCards.includes(card.id)}
              style={{
                padding: '8px',
                background: selectedCards.includes(card.id)
                  ? 'rgba(0,200,150,0.3)'
                  : 'rgba(255,255,255,0.05)',
                border: selectedCards.includes(card.id)
                  ? '2px solid rgba(0,200,150,0.7)'
                  : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                cursor:
                  selectedCards.length === 4 && !selectedCards.includes(card.id)
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  selectedCards.length === 4 && !selectedCards.includes(card.id)
                    ? 0.4
                    : 1,
                fontSize: '10px',
                textAlign: 'center',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '2px', fontSize: '11px' }}>
                {card.name.substring(0, 14)}
              </div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>
                {card.rarity}
              </div>
            </button>
          ))}
        </div>

        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(100,150,255,0.1)',
            border: '1px solid rgba(100,150,255,0.3)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '16px',
          }}
        >
          Selected: <strong>{selectedCards.length}/4 cards</strong>
        </div>

        <button
          onClick={() => setStep('confirm')}
          disabled={selectedCards.length !== 4}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '14px',
            cursor: selectedCards.length === 4 ? 'pointer' : 'not-allowed',
            background:
              selectedCards.length === 4
                ? 'linear-gradient(135deg, #00b4ff, #0066cc)'
                : 'rgba(255,255,255,0.06)',
            color: selectedCards.length === 4 ? '#fff' : 'rgba(255,255,255,0.3)',
            transition: 'all 0.2s',
          }}
        >
          Continue →
        </button>
      </div>
    );
  }

  // ── Render: Confirmation ───────────────────────────────────────────────
  if (step === 'confirm') {
    const selectedCardNames = allCards
      .filter((c) => selectedCards.includes(c.id))
      .map((c) => c.name);

    return (
      <div style={{ maxWidth: '500px' }}>
        <button
          onClick={() => setStep('card-select')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontSize: '13px',
            marginBottom: '16px',
            padding: 0,
          }}
        >
          ← Back
        </button>

        <h2 style={{ margin: '0 0 20px', fontSize: '22px', fontWeight: 900 }}>
          ✓ Ready to Practice?
        </h2>

        <div
          style={{
            padding: '16px',
            background: 'rgba(0,200,150,0.08)',
            border: '1px solid rgba(0,200,150,0.2)',
            borderRadius: '10px',
            marginBottom: '20px',
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
              Opponent
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>
              {selectedOpponent?.avatar} {selectedOpponent?.name}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
              {selectedOpponent?.description}
            </div>
          </div>

          <div style={{ marginBottom: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
              Game Mode
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>
              {gameType === 'X01' ? '🎯 X01' : '🦗 CRICKET'}
            </div>
          </div>

          <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              Your Cards ({selectedCards.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {selectedCardNames.map((name, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '11px',
                    padding: '6px 8px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '6px',
                    border: '1px solid rgba(0,200,150,0.3)',
                  }}
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
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
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleStartPractice}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 24px',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 800,
            fontSize: '15px',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: loading
              ? 'rgba(255,255,255,0.06)'
              : 'linear-gradient(135deg, #00d47a, #00a355)',
            color: loading ? 'rgba(255,255,255,0.3)' : '#fff',
            boxShadow: loading ? 'none' : '0 6px 24px rgba(0,212,122,0.3)',
            transition: 'all 0.2s',
          }}
        >
          {loading ? '⏳ Creating Match...' : '🎲 Start Practice Match →'}
        </button>
      </div>
    );
  }

  return null;
}
