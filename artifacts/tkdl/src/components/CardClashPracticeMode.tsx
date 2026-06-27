import React, { useState } from 'react';
import { Bot, Users, Trophy } from 'lucide-react';

interface PracticeModeProps {
  playerId: number;
  playerCards: any[];
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

/**
 * CardClashPracticeMode Component
 * 
 * Allows players to:
 * - Select any cards from their collection (not just equipped)
 * - Choose opponent (bot or player)
 * - Test strategies without ranking impact
 * - Play for lower coin rewards
 * 
 * Usage:
 * <CardClashPracticeMode
 *   playerId={16}
 *   playerCards={allCards}
 *   onMatchCreated={(id) => startMatch(id)}
 * />
 */
export function CardClashPracticeMode({
  playerId,
  playerCards,
  onMatchCreated,
}: PracticeModeProps) {
  const [step, setStep] = useState<'opponent-select' | 'card-select' | 'confirm'>('opponent-select');
  const [selectedOpponent, setSelectedOpponent] = useState<BotOpponent | null>(null);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [gameType, setGameType] = useState<'X01' | 'CRICKET'>('X01');
  const [bots, setBots] = useState<BotOpponent[]>([]);
  const [loading, setLoading] = useState(false);

  // Load bots on mount
  React.useEffect(() => {
    const loadBots = async () => {
      try {
        const response = await fetch('/api/card-clash/practice/bots');
        const data = await response.json();
        setBots(data.bots);
      } catch (error) {
        console.error('Failed to load bots:', error);
      }
    };
    loadBots();
  }, []);

  const handleCardSelect = (cardId: number) => {
    setSelectedCards((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId].slice(-4) // Max 4 cards
    );
  };

  const handleStartPractice = async () => {
    if (!selectedOpponent || selectedCards.length !== 4) {
      alert('Select opponent and 4 cards');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/card-clash/practice/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          opponentId: selectedOpponent.id,
          selectedCards,
          gameType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onMatchCreated?.(data.matchId);
      } else {
        alert('Failed to create practice match');
      }
    } catch (error) {
      console.error('Error creating practice match:', error);
      alert('Error creating practice match');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(0,200,150,0.08), rgba(100,200,200,0.06))',
        border: '1px solid rgba(0,200,150,0.2)',
        borderRadius: '12px',
        padding: '24px',
        color: '#fff',
      }}
    >
      <h2 style={{ margin: '0 0 16px', fontSize: '24px', fontWeight: 900 }}>🎓 Practice Mode</h2>
      <p style={{ margin: '0 0 24px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
        Test your strategies risk-free. Practice matches don't affect your ranking.
      </p>

      {/* Step 1: Choose Opponent */}
      {step === 'opponent-select' && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700 }}>Choose Your Opponent</h3>

            {/* Bot Options */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                🤖 Bot Opponents
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {bots.map((bot) => (
                  <button
                    key={bot.id}
                    onClick={() => {
                      setSelectedOpponent(bot);
                      setStep('card-select');
                    }}
                    style={{
                      padding: '12px 14px',
                      background:
                        selectedOpponent?.id === bot.id
                          ? 'rgba(0,200,150,0.25)'
                          : 'rgba(255,255,255,0.05)',
                      border:
                        selectedOpponent?.id === bot.id
                          ? '1px solid rgba(0,200,150,0.5)'
                          : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{bot.avatar}</span>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: '2px' }}>{bot.name}</div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                        {bot.difficulty} · {bot.description}
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'rgba(0,200,150,0.8)' }}>
                      Skill {bot.skillLevel}/10
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Player vs Player Option */}
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                👥 Play Against Another Player
              </div>
              <button
                style={{
                  padding: '12px 14px',
                  background: 'rgba(100,150,255,0.1)',
                  border: '1px solid rgba(100,150,255,0.3)',
                  borderRadius: '8px',
                  color: 'rgba(100,150,255,0.8)',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <Users size={20} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>Player Match</div>
                  <div style={{ fontSize: '12px', color: 'rgba(100,150,255,0.6)' }}>Find opponent via lobby</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Select Cards */}
      {step === 'card-select' && selectedOpponent && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700 }}>
              Select 4 Cards ({selectedCards.length}/4)
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
              You can use ANY cards from your collection, even without equipping them.
            </p>
          </div>

          {/* Game Type Selection */}
          <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {(['X01', 'CRICKET'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setGameType(type)}
                style={{
                  padding: '10px',
                  background: gameType === type ? 'rgba(0,200,150,0.25)' : 'rgba(255,255,255,0.05)',
                  border: gameType === type ? '1px solid rgba(0,200,150,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  transition: 'all 0.2s',
                }}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Card Selection Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px', marginBottom: '16px', maxHeight: '300px', overflowY: 'auto' }}>
            {playerCards.map((card) => (
              <button
                key={card.id}
                onClick={() => handleCardSelect(card.id)}
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
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontSize: '11px',
                  transition: 'all 0.2s',
                  opacity: selectedCards.length === 4 && !selectedCards.includes(card.id) ? 0.4 : 1,
                  pointerEvents:
                    selectedCards.length === 4 && !selectedCards.includes(card.id) ? 'none' : 'auto',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '2px' }}>{card.name.substring(0, 12)}</div>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>{card.rarity}</div>
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => setStep('opponent-select')}
              style={{
                padding: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={selectedCards.length !== 4}
              style={{
                padding: '10px',
                background: selectedCards.length === 4 ? 'rgba(0,200,150,0.3)' : 'rgba(0,200,150,0.1)',
                border: '1px solid rgba(0,200,150,0.3)',
                borderRadius: '8px',
                color: selectedCards.length === 4 ? 'rgba(0,200,150,1)' : 'rgba(0,200,150,0.5)',
                cursor: selectedCards.length === 4 ? 'pointer' : 'not-allowed',
              }}
            >
              Continue ({selectedCards.length}/4)
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm & Start */}
      {step === 'confirm' && selectedOpponent && (
        <div>
          <div style={{ background: 'rgba(0,200,150,0.1)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>OPPONENT</div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{selectedOpponent.name}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>GAME TYPE</div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{gameType}</div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
              💰 Coin rewards are 50% of ranked matches (practice mode)
            </div>
          </div>

          <button
            onClick={handleStartPractice}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, rgba(0,200,150,0.5), rgba(100,200,200,0.4))',
              border: '1px solid rgba(0,200,150,0.5)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '⏳ Starting Practice Match...' : '▶️ Start Practice Match'}
          </button>

          <button
            onClick={() => {
              setStep('opponent-select');
              setSelectedCards([]);
              setSelectedOpponent(null);
            }}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              marginTop: '8px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
