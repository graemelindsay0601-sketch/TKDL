/**
 * Card Clash Admin Tab Component
 * 
 * Admin tools for debugging and managing Card Clash
 * Extracted from card-clash.tsx for modularity
 */

import React, { useState } from 'react';
import { SectionHeader } from './SectionHeader';

interface CardClashAdminProps {
  playerId: number | undefined;
  isAdmin?: boolean;
  stats?: {
    coins?: number;
    [key: string]: any;
  };
}

export const CardClashAdmin = React.memo(
  function CardClashAdmin({ playerId, isAdmin = false, stats }: CardClashAdminProps) {
    const [showTools, setShowTools] = useState(false);
    const [apiStatus, setApiStatus] = useState<string>('');

    if (!isAdmin) {
      return (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.25)' }}>
          <div style={{ fontSize: '32px', marginBottom: '1rem' }}>🔐</div>
          Admin tools are not available for your account
        </div>
      );
    }

    const handleTestAPI = async () => {
      setApiStatus('Testing...');
      try {
        const response = await fetch('/api/card-clash/standings?limit=1');
        const data = await response.json();
        setApiStatus(`✅ API OK - ${data.data?.length || 0} rows`);
      } catch (error) {
        setApiStatus(`❌ Error: ${error}`);
      }
    };

    const handleDebugState = () => {
      console.group('Card Clash Debug State');
      console.log('Player ID:', playerId);
      console.log('Stats:', stats);
      console.log('Timestamp:', new Date().toISOString());
      console.groupEnd();
      setApiStatus('✅ Debug info logged to console');
    };

    return (
      <div>
        <SectionHeader
          title="🛠️ Admin Tools"
          subtitle="Debugging & maintenance"
        />

        <div
          style={{
            padding: '20px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: '12px',
            marginBottom: '20px',
          }}
        >
          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ color: '#00b4ff', marginBottom: '10px', fontSize: '14px' }}>
              System Status
            </h4>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>
              <div>Player ID: <span style={{ color: '#fff' }}>{playerId}</span></div>
              <div>Current coins: <span style={{ color: '#ffd24a' }}>{stats?.coins || 0}</span></div>
              <div>Timestamp: <span style={{ color: '#fff' }}>{new Date().toLocaleTimeString()}</span></div>
            </div>
          </div>

          {apiStatus && (
            <div
              style={{
                padding: '10px',
                background: apiStatus.startsWith('✅') ? 'rgba(0,255,136,0.1)' : 'rgba(255,107,107,0.1)',
                border: `1px solid ${apiStatus.startsWith('✅') ? 'rgba(0,255,136,0.3)' : 'rgba(255,107,107,0.3)'}`,
                borderRadius: '6px',
                fontSize: '12px',
                color: apiStatus.startsWith('✅') ? '#00ff88' : '#ff6b6b',
                marginBottom: '15px',
              }}
            >
              {apiStatus}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleTestAPI}
              style={{
                padding: '8px 14px',
                background: 'rgba(0,229,255,0.1)',
                border: '1px solid rgba(0,229,255,0.3)',
                borderRadius: '6px',
                color: '#00e5ff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,229,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,229,255,0.1)';
              }}
            >
              Test API
            </button>
            <button
              onClick={handleDebugState}
              style={{
                padding: '8px 14px',
                background: 'rgba(255,215,0,0.1)',
                border: '1px solid rgba(255,215,0,0.3)',
                borderRadius: '6px',
                color: '#ffd24a',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,215,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,215,0,0.1)';
              }}
            >
              Debug State
            </button>
            <button
              onClick={() => setShowTools(!showTools)}
              style={{
                padding: '8px 14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: '6px',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
              }}
            >
              {showTools ? '▼ Hide' : '▶ More Tools'}
            </button>
          </div>

          {showTools && (
            <div
              style={{
                marginTop: '15px',
                paddingTop: '15px',
                borderTop: '1px solid rgba(255,255,255,0.09)',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              <p>Additional debugging tools available in browser console</p>
              <p>Use: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '3px' }}>window.__cardClash</code></p>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '15px',
            background: 'rgba(255,107,107,0.05)',
            border: '1px solid rgba(255,107,107,0.2)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'rgba(255,107,107,0.7)',
          }}
        >
          ⚠️ Admin tools should only be used by developers for debugging purposes
        </div>
      </div>
    );
  }
);

CardClashAdmin.displayName = 'CardClashAdmin';
