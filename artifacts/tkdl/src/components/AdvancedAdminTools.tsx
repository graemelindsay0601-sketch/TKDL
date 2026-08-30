import React, { useState } from 'react';

interface AdminToolsProps {
  playerId: number;
}

/**
 * AdvancedAdminTools Component
 *
 * Extended admin controls for Card Clash management:
 * - Player card management (grant/remove cards)
 * - Coin adjustments
 * - Seasonal management
 * - Debug utilities
 *
 * Requires an admin session — no PIN is sent with these requests.
 */
export function AdvancedAdminTools({ playerId }: AdminToolsProps) {
  const [activeSection, setActiveSection] = useState<'cards' | 'coins' | 'seasons' | 'debug'>('cards');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Card Management
  const [cardId, setCardId] = useState('');
  const [cardQty, setCardQty] = useState(1);

  const grantCard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/card-clash/admin/card/give', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          cardId,
          quantity: cardQty,
        }),
      });

      const data = await response.json();
      setMessage({
        ok: response.ok,
        text: response.ok ? `Granted ${cardQty}x card #${cardId} to player ${playerId}` : (data.error || 'Failed to grant card'),
      });
      if (response.ok) setCardId('');
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Error' });
    } finally {
      setLoading(false);
    }
  };

  // Coin Management
  const [coinAmount, setCoinAmount] = useState(0);
  const [coinOperation, setCoinOperation] = useState<'give' | 'remove'>('give');

  const adjustCoins = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/card-clash/admin/coins/${coinOperation}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          amount: coinAmount,
        }),
      });

      const data = await response.json();
      setMessage({
        ok: response.ok,
        text: response.ok
          ? `${coinOperation === 'give' ? 'Gave' : 'Removed'} ${coinAmount} coins. New balance: ${data.cardPoints ?? '?'}`
          : (data.error || 'Failed to adjust coins'),
      });
      if (response.ok) setCoinAmount(0);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Error' });
    } finally {
      setLoading(false);
    }
  };

  // Debug Tools — reads straight from the real, already-working card-clash endpoints
  const [debugType, setDebugType] = useState<'stats' | 'inventory' | 'matches'>('stats');

  const DEBUG_ENDPOINTS: Record<'stats' | 'inventory' | 'matches', (id: number) => string> = {
    stats:     (id) => `/api/card-clash/player/${id}/stats`,
    inventory: (id) => `/api/card-clash/inventory/${id}`,
    matches:   (id) => `/api/card-clash/matches/${id}`,
  };

  const runDebugTool = async () => {
    try {
      setLoading(true);
      const response = await fetch(DEBUG_ENDPOINTS[debugType](playerId));

      const data = await response.json();
      setMessage({
        ok: response.ok,
        text: response.ok ? JSON.stringify(data, null, 2) : (data.error || 'Debug fetch failed'),
      });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Error' });
    } finally {
      setLoading(false);
    }
  };

  // Season Info — read-only view of the active Card Clash season
  const [seasonInfo, setSeasonInfo] = useState<any>(null);

  const fetchSeasonInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/card-clash/admin/season/active');
      const data = await response.json();
      setSeasonInfo(data);
      setMessage({ ok: response.ok, text: response.ok ? 'Season info refreshed below' : (data.error || 'Failed to fetch season info') });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ color: '#fff' }}>
      {/* Section Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '20px',
        }}
      >
        {[
          { id: 'cards', label: '🃏 Cards', icon: '🃏' },
          { id: 'coins', label: '🪙 Coins', icon: '🪙' },
          { id: 'seasons', label: '📅 Seasons', icon: '📅' },
          { id: 'debug', label: '🔧 Debug', icon: '🔧' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            style={{
              padding: '12px',
              background:
                activeSection === tab.id ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${activeSection === tab.id ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '8px',
              color: activeSection === tab.id ? '#c084fc' : 'rgba(255,255,255,0.5)',
              fontWeight: 700,
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Card Management */}
      {activeSection === 'cards' && (
        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 900, color: '#00b4ff' }}>
            Grant Cards to Player
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                Card ID
              </label>
              <input
                type="text"
                placeholder="e.g., 101, 205, etc."
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#fff',
                  boxSizing: 'border-box',
                  fontSize: '12px',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={cardQty}
                onChange={(e) => setCardQty(parseInt(e.target.value) || 1)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#fff',
                  boxSizing: 'border-box',
                  fontSize: '12px',
                }}
              />
            </div>
            <button
              onClick={grantCard}
              disabled={loading || !cardId}
              style={{
                padding: '10px',
                background: cardId ? 'rgba(0,180,255,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${cardId ? 'rgba(0,180,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '6px',
                color: cardId ? '#00b4ff' : 'rgba(255,255,255,0.3)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: cardId ? 'pointer' : 'not-allowed',
              }}
            >
              {loading ? '⏳ Granting...' : '✓ Grant Card'}
            </button>
          </div>
        </div>
      )}

      {/* Coin Management */}
      {activeSection === 'coins' && (
        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 900, color: '#ffd24a' }}>
            Adjust Player Coins
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                Operation
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(['give', 'remove'] as const).map((op) => (
                  <button
                    key={op}
                    onClick={() => setCoinOperation(op)}
                    style={{
                      padding: '8px',
                      background: coinOperation === op ? 'rgba(255,210,74,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${coinOperation === op ? 'rgba(255,210,74,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '6px',
                      color: coinOperation === op ? '#ffd24a' : 'rgba(255,255,255,0.5)',
                      fontWeight: 700,
                      fontSize: '11px',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    {op === 'give' ? '➕ Give' : '➖ Remove'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                Amount
              </label>
              <input
                type="number"
                value={coinAmount}
                onChange={(e) => setCoinAmount(parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#fff',
                  boxSizing: 'border-box',
                  fontSize: '12px',
                }}
              />
            </div>
            <button
              onClick={adjustCoins}
              disabled={loading}
              style={{
                padding: '10px',
                background: 'rgba(255,210,74,0.2)',
                border: '1px solid rgba(255,210,74,0.4)',
                borderRadius: '6px',
                color: '#ffd24a',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {loading ? '⏳ Adjusting...' : '✓ Adjust Coins'}
            </button>
          </div>
        </div>
      )}

      {/* Seasonal Management */}
      {activeSection === 'seasons' && (
        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 900, color: '#00e5a0' }}>
            Active Season
          </h3>
          <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
            Read-only lookup of the current Card Clash season. Ending a season or forcing reward
            payouts is handled from the main season tools — this is just for checking state.
          </p>
          <button
            onClick={fetchSeasonInfo}
            disabled={loading}
            style={{
              padding: '10px',
              background: 'rgba(0,229,160,0.15)',
              border: '1px solid rgba(0,229,160,0.4)',
              borderRadius: '6px',
              color: '#00e5a0',
              fontWeight: 700,
              fontSize: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              width: '100%',
            }}
          >
            {loading ? '⏳ Fetching...' : '🔄 Fetch Active Season'}
          </button>
          {seasonInfo && (
            <pre
              style={{
                marginTop: '14px',
                padding: '12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.65)',
                overflow: 'auto',
                maxHeight: '220px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {JSON.stringify(seasonInfo, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Debug Tools */}
      {activeSection === 'debug' && (
        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 900, color: '#9d4edd' }}>
            Debug Tools
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                Data Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {(['stats', 'inventory', 'matches'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDebugType(type)}
                    style={{
                      padding: '8px',
                      background: debugType === type ? 'rgba(157,78,221,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${debugType === type ? 'rgba(157,78,221,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '6px',
                      color: debugType === type ? '#9d4edd' : 'rgba(255,255,255,0.5)',
                      fontWeight: 700,
                      fontSize: '10px',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={runDebugTool}
              disabled={loading}
              style={{
                padding: '10px',
                background: 'rgba(157,78,221,0.2)',
                border: '1px solid rgba(157,78,221,0.4)',
                borderRadius: '6px',
                color: '#9d4edd',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {loading ? '⏳ Fetching...' : '▶ Run Debug'}
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px 14px',
            background: message.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${message.ok ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
            borderRadius: '8px',
            fontSize: '11px',
            color: message.ok ? '#51cf66' : '#ff6b6b',
            fontFamily: 'monospace',
            maxHeight: '200px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {message.ok ? '✓ ' : '✗ '}
          {message.text}
        </div>
      )}
    </div>
  );
}
