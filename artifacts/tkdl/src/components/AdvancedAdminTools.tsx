import React, { useState } from 'react';

interface AdminToolsProps {
  playerId: number;
  adminPin: string;
}

/**
 * AdvancedAdminTools Component
 * 
 * Extended admin controls for Card Clash management:
 * - Player card management (grant/remove cards)
 * - Coin adjustments
 * - Seasonal management
 * - Debug utilities
 */
export function AdvancedAdminTools({ playerId, adminPin }: AdminToolsProps) {
  const [activeSection, setActiveSection] = useState<'cards' | 'coins' | 'seasons' | 'debug'>('cards');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Card Management
  const [cardId, setCardId] = useState('');
  const [cardQty, setCardQty] = useState(1);

  const grantCard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/card-clash/admin/grant-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin,
        },
        body: JSON.stringify({
          playerId,
          cardId,
          quantity: cardQty,
        }),
      });

      const data = await response.json();
      setMessage({ ok: response.ok, text: data.message || 'Updated' });
      if (response.ok) setCardId('');
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Error' });
    } finally {
      setLoading(false);
    }
  };

  // Coin Management
  const [coinAmount, setCoinAmount] = useState(0);
  const [coinOperation, setCoinOperation] = useState<'add' | 'set'>('add');

  const adjustCoins = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/card-clash/admin/adjust-coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin,
        },
        body: JSON.stringify({
          playerId,
          amount: coinAmount,
          operation: coinOperation,
        }),
      });

      const data = await response.json();
      setMessage({ ok: response.ok, text: data.message || 'Updated' });
      if (response.ok) setCoinAmount(0);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Error' });
    } finally {
      setLoading(false);
    }
  };

  // Debug Tools
  const [debugType, setDebugType] = useState<'stats' | 'inventory' | 'matches'>('stats');

  const runDebugTool = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/card-clash/admin/debug/${debugType}/${playerId}`, {
        headers: { 'x-admin-pin': adminPin },
      });

      const data = await response.json();
      setMessage({
        ok: response.ok,
        text: response.ok ? JSON.stringify(data, null, 2) : data.error,
      });
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
                {(['add', 'set'] as const).map((op) => (
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
                    {op === 'add' ? '➕ Add' : '🔧 Set'}
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
