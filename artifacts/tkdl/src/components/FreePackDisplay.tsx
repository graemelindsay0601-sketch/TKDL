import React, { useState, useEffect } from 'react';

interface FreePackDisplayProps {
  playerId: number;
  onClaimPack?: () => void;
}

/**
 * FreePackDisplay Component
 * 
 * Beautiful, engaging display of the daily free pack
 * Shows countdown timer, visual indicators, claim button
 */
export function FreePackDisplay({ playerId, onClaimPack }: FreePackDisplayProps) {
  const [timeUntilNext, setTimeUntilNext] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPackAvailability = async () => {
      try {
        const response = await fetch(`/api/card-clash/free-pack/status`);
        if (!response.ok) throw new Error('Failed to check pack');

        const data = await response.json();
        setIsAvailable(data.canClaim || false);

        if (!data.canClaim && data.hoursUntilAvailable > 0) {
          // Calculate next available time
          const nextDate = new Date(Date.now() + data.hoursUntilAvailable * 60 * 60 * 1000);
          updateCountdown(nextDate);
        }
      } catch (err) {
        console.error('Error checking free pack:', err);
      } finally {
        setLoading(false);
      }
    };

    checkPackAvailability();
    const interval = setInterval(checkPackAvailability, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [playerId]);

  const updateCountdown = (nextDate: Date) => {
    const update = () => {
      const now = new Date();
      const diff = nextDate.getTime() - now.getTime();

      if (diff <= 0) {
        setIsAvailable(true);
        setTimeUntilNext(null);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeUntilNext({ hours, minutes, seconds });
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  };

  const handleClaimPack = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/card-clash/free-pack/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to claim pack');
      }

      const data = await response.json();
      if (data.success) {
        onClaimPack?.();
        setIsAvailable(false);
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      console.error('Error claiming pack:', err);
      alert(`Failed to claim pack: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '12px',
        }}
      >
        Loading free pack info...
      </div>
    );
  }

  return (
    <div
      style={{
        background: isAvailable
          ? 'linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05))'
          : 'linear-gradient(135deg,rgba(255,210,74,0.08),rgba(255,210,74,0.02))',
        border: `2px solid ${isAvailable ? 'rgba(34,197,94,0.4)' : 'rgba(255,210,74,0.3)'}`,
        borderRadius: '14px',
        padding: '20px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow effect */}
      {isAvailable && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 0%, rgba(34,197,94,0.3), transparent 70%)',
            animation: 'pulse 2s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Icon */}
        <div
          style={{
            fontSize: isAvailable ? '48px' : '40px',
            marginBottom: '12px',
            animation: isAvailable ? 'bounce 0.6s ease-in-out infinite' : 'none',
          }}
        >
          📦
        </div>

        {/* Title */}
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: '16px',
            fontWeight: 900,
            color: isAvailable ? '#22c55e' : '#ffd24a',
            letterSpacing: '0.05em',
          }}
        >
          {isAvailable ? '✨ FREE PACK READY!' : '📅 FREE PACK AVAILABLE SOON'}
        </h3>

        {/* Description */}
        <p
          style={{
            margin: '0 0 16px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.5,
          }}
        >
          {isAvailable
            ? 'Claim your daily free card pack and grow your collection!'
            : 'Come back soon for your next free pack.'}
        </p>

        {/* Countdown or Action */}
        {isAvailable ? (
          <button
            onClick={handleClaimPack}
            disabled={loading}
            style={{
              padding: '12px 32px',
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontWeight: 900,
              fontSize: '13px',
              cursor: loading ? 'wait' : 'pointer',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              boxShadow: '0 4px 16px rgba(34,197,94,0.4)',
              transition: 'all 0.2s',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.boxShadow = '0 6px 24px rgba(34,197,94,0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(34,197,94,0.4)';
            }}
          >
            {loading ? '⏳ Claiming...' : '🎁 Claim Now'}
          </button>
        ) : timeUntilNext ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              marginTop: '12px',
            }}
          >
            {/* Countdown boxes */}
            {[
              { value: timeUntilNext.hours, label: 'H' },
              { value: timeUntilNext.minutes, label: 'M' },
              { value: timeUntilNext.seconds, label: 'S' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,210,74,0.3)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  minWidth: '50px',
                }}
              >
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 900,
                    color: '#ffd24a',
                    lineHeight: 1,
                    marginBottom: '4px',
                  }}
                >
                  {String(item.value).padStart(2, '0')}
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.4)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Info text */}
        <div
          style={{
            marginTop: '14px',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.4)',
            fontStyle: 'italic',
          }}
        >
          💡 Free packs reset every 3 days. Don't miss out!
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
