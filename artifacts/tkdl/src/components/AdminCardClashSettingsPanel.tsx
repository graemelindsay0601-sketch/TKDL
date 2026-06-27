import React, { useState, useEffect } from 'react';
import { useCardClashSettings, updateCardClashSettings } from '@/hooks/useCardClashSettings';

interface AdminSettingsPanelProps {
  adminPin: string;
}

/**
 * AdminCardClashSettingsPanel Component
 * 
 * Allows admins to manage Card Clash game settings:
 * - Equipable card counts (1-5 GOOD/BAD)
 * - Feature toggles
 * - View audit log
 * 
 * Requires admin PIN for access
 */
export function AdminCardClashSettingsPanel({ adminPin }: AdminSettingsPanelProps) {
  const { settings, loading, refetch } = useCardClashSettings();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [goodCards, setGoodCards] = useState(settings.equipable_good_cards);
  const [badCards, setBadCards] = useState(settings.equipable_bad_cards);
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // Update form when settings load
  useEffect(() => {
    setGoodCards(settings.equipable_good_cards);
    setBadCards(settings.equipable_bad_cards);
    setError(null);
    setSuccess(null);
  }, [settings]);

  const handleUpdateSettings = async () => {
    try {
      setUpdating(true);
      setError(null);
      setSuccess(null);

      // Validate
      if (goodCards < 1 || goodCards > 5 || badCards < 1 || badCards > 5) {
        setError('Card counts must be between 1 and 5');
        return;
      }

      // Update
      const result = await updateCardClashSettings(
        {
          equipable_good_cards: goodCards,
          equipable_bad_cards: badCards,
          adminPin,
        },
        notes || undefined
      );

      setSuccess(`✅ Settings updated! ${result.message}`);
      setNotes('');
      
      // Refetch to confirm
      setTimeout(() => refetch(), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setUpdating(false);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/card-clash/settings/history', {
        headers: { 'x-admin-pin': adminPin },
      });

      if (!response.ok) throw new Error('Failed to load history');

      const data = await response.json();
      setHistory(data.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit history');
    }
  };

  const handleToggleHistory = async () => {
    if (!showHistory) {
      await loadHistory();
    }
    setShowHistory(!showHistory);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(76,29,149,0.04))',
        border: '2px solid rgba(124,58,237,0.2)',
        borderRadius: '14px',
        padding: '24px',
        color: '#fff',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 900 }}>
          ⚙️ Card Clash Settings
        </h2>
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
          Manage game configuration for all players
        </p>
      </div>

      {/* Current Settings Info */}
      <div
        style={{
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(124,58,237,0.2)',
          borderRadius: '10px',
          padding: '14px',
          marginBottom: '20px',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Current GOOD Cards</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#22c55e' }}>
              {settings.equipable_good_cards}
            </div>
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Current BAD Cards</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#ef4444' }}>
              {settings.equipable_bad_cards}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Controls */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              color: '#22c55e',
              marginBottom: '8px',
              letterSpacing: '0.04em',
            }}
          >
            ⚡ GOOD CARDS (Boost Player)
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="range"
              min="1"
              max="5"
              value={goodCards}
              onChange={(e) => setGoodCards(parseInt(e.target.value))}
              style={{
                flex: 1,
                height: '6px',
                borderRadius: '3px',
                background: 'rgba(34,197,94,0.2)',
                outline: 'none',
                cursor: 'pointer',
                accentColor: '#22c55e',
              }}
            />
            <div
              style={{
                width: '40px',
                height: '40px',
                background: 'rgba(34,197,94,0.1)',
                border: '2px solid #22c55e',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '14px',
                color: '#22c55e',
              }}
            >
              {goodCards}
            </div>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
            Players can equip {goodCards} GOOD card{goodCards !== 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              color: '#ef4444',
              marginBottom: '8px',
              letterSpacing: '0.04em',
            }}
          >
            💀 BAD CARDS (Curse Opponent)
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="range"
              min="1"
              max="5"
              value={badCards}
              onChange={(e) => setBadCards(parseInt(e.target.value))}
              style={{
                flex: 1,
                height: '6px',
                borderRadius: '3px',
                background: 'rgba(239,68,68,0.2)',
                outline: 'none',
                cursor: 'pointer',
                accentColor: '#ef4444',
              }}
            />
            <div
              style={{
                width: '40px',
                height: '40px',
                background: 'rgba(239,68,68,0.1)',
                border: '2px solid #ef4444',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '14px',
                color: '#ef4444',
              }}
            >
              {badCards}
            </div>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
            Players can equip {badCards} BAD card{badCards !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Notes Field */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '6px',
              letterSpacing: '0.04em',
            }}
          >
            📝 CHANGE NOTES (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Adjusting for Season 2 balance..."
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '12px',
              fontFamily: 'Arial,sans-serif',
              resize: 'vertical',
              minHeight: '60px',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#ff6b6b',
          }}
        >
          ❌ {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.4)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#51cf66',
          }}
        >
          {success}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={handleUpdateSettings}
          disabled={updating}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'linear-gradient(135deg,#7c3aed,#4c1d95)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: 700,
            fontSize: '12px',
            cursor: updating ? 'wait' : 'pointer',
            transition: 'all 0.2s',
            opacity: updating ? 0.6 : 1,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {updating ? '⏳ Updating...' : '✅ Save Settings'}
        </button>

        <button
          onClick={handleToggleHistory}
          style={{
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.6)',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          📋 {showHistory ? 'Hide' : 'Show'} History
        </button>
      </div>

      {/* Audit History */}
      {showHistory && history.length > 0 && (
        <div
          style={{
            marginTop: '20px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: '20px',
          }}
        >
          <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 900 }}>
            📝 Recent Changes
          </h3>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {history.map((entry, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: '10px',
                  marginBottom: '8px',
                  fontSize: '11px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', color: '#fff' }}>
                  <span style={{ color: '#22c55e' }}>
                    ⚡ {entry.old_good_cards} → {entry.new_good_cards}
                  </span>
                  <span style={{ color: '#ef4444' }}>
                    💀 {entry.old_bad_cards} → {entry.new_bad_cards}
                  </span>
                </div>
                {entry.notes && (
                  <div style={{ marginTop: '4px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                    "{entry.notes}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showHistory && history.length === 0 && (
        <div
          style={{
            marginTop: '20px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.3)',
            fontSize: '12px',
          }}
        >
          No change history yet
        </div>
      )}
    </div>
  );
}
