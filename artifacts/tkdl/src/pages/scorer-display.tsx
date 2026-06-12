import { useEffect, useState, useRef } from "react";
import { useParams } from "wouter";
import { Camera } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DartEvent {
  dartIndex: 0 | 1 | 2;
  sector: number;
  ring: string;
  score: number;
  confidence: number;
}

interface RoundEvent {
  darts: { score: number; ring: string; sector: number }[];
  total: number;
}

interface GameState {
  gameType?: string;
  players?: string[];
  status?: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ringLabel(ring: string, sector: number): string {
  if (ring === 'miss') return 'MISS';
  if (ring === 'bull') return 'BULL';
  if (ring === 'outer_bull') return 'OB';
  const prefix = ring === 'triple' ? 'T' : ring === 'double' ? 'D' : '';
  return `${prefix}${sector}`;
}

function ringColor(ring: string): string {
  if (ring === 'triple') return '#00d4ff';
  if (ring === 'double') return '#ffd24a';
  if (ring === 'bull') return '#ff005c';
  if (ring === 'outer_bull') return '#ff7849';
  if (ring === 'miss') return 'rgba(255,255,255,0.25)';
  return 'rgba(255,255,255,0.7)';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScorerDisplay() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'closed' | 'error'>('connecting');
  const [gameState, setGameState] = useState<GameState>({});
  const [currentDarts, setCurrentDarts] = useState<DartEvent[]>([]);
  const [lastRound, setLastRound] = useState<RoundEvent | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flashDart, setFlashDart] = useState<DartEvent | null>(null);

  useEffect(() => {
    if (!code) return;

    const es = new EventSource(`/api/scorer/sessions/${code}/stream`);
    esRef.current = es;

    es.onopen = () => setConnectionStatus('connected');

    es.onmessage = (e) => {
      let parsed: { type: string; payload: unknown };
      try { parsed = JSON.parse(e.data as string); }
      catch { return; }

      const { type, payload } = parsed;

      if (type === 'connected') {
        setConnectionStatus('connected');
        const p = payload as { gameState?: GameState };
        if (p.gameState) setGameState(p.gameState);
      }

      if (type === 'game_state_sync') {
        setGameState(prev => ({ ...prev, ...(payload as GameState) }));
      }

      if (type === 'dart_detected') {
        const dart = payload as DartEvent;
        setCurrentDarts(prev => {
          const updated = [...prev.filter(d => d.dartIndex !== dart.dartIndex), dart];
          return updated.sort((a, b) => a.dartIndex - b.dartIndex);
        });
        // Flash animation
        setFlashDart(dart);
        if (flashRef.current) clearTimeout(flashRef.current);
        flashRef.current = setTimeout(() => setFlashDart(null), 1500);
      }

      if (type === 'round_complete') {
        const r = payload as RoundEvent;
        setLastRound(r);
        setRoundHistory(prev => [r, ...prev].slice(0, 10));
        setTimeout(() => setCurrentDarts([]), 3000);
      }

      if (type === 'session_closed') {
        setConnectionStatus('closed');
        es.close();
      }
    };

    es.onerror = () => {
      setConnectionStatus('error');
    };

    return () => {
      es.close();
      if (flashRef.current) clearTimeout(flashRef.current);
    };
  }, [code]);

  const roundTotal = currentDarts.reduce((s, d) => s + d.score, 0);

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 15% 15%, rgba(0,212,255,0.1) 0%, transparent 50%), radial-gradient(ellipse at 85% 85%, rgba(255,0,92,0.08) 0%, transparent 50%), #06040e',
        fontFamily: 'Oswald, sans-serif',
      }}>

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)',
        backgroundSize: '80px 80px',
      }} />

      {/* Header bar */}
      <div className="relative flex items-center justify-between px-8 pt-6 pb-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)' }}>
            <Camera className="w-4 h-4" style={{ color: '#00d4ff' }} />
          </div>
          <div>
            <div className="text-xl font-bold uppercase tracking-widest" style={{ color: '#fff', letterSpacing: '0.15em' }}>
              Auto-Scorer
            </div>
            {gameState.gameType && (
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>
                {String(gameState.gameType)}
              </div>
            )}
          </div>
        </div>

        {/* Session code + connection pill */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-[0.25em]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
            {code}
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${connectionStatus === 'connected' ? '' : 'opacity-60'}`}
            style={{
              background: connectionStatus === 'connected' ? 'rgba(0,212,255,0.12)' : connectionStatus === 'error' || connectionStatus === 'closed' ? 'rgba(255,0,92,0.12)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${connectionStatus === 'connected' ? 'rgba(0,212,255,0.35)' : connectionStatus === 'error' || connectionStatus === 'closed' ? 'rgba(255,0,92,0.35)' : 'rgba(255,255,255,0.1)'}`,
              color: connectionStatus === 'connected' ? '#00d4ff' : connectionStatus === 'error' || connectionStatus === 'closed' ? '#ff005c' : 'rgba(255,255,255,0.4)',
            }}>
            <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-teal-400 animate-pulse' : 'bg-current'}`} />
            {connectionStatus === 'connected' ? 'Live' : connectionStatus === 'connecting' ? 'Connecting…' : connectionStatus === 'closed' ? 'Session ended' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="relative flex h-[calc(100%-80px)]">

        {/* Left: current round ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-12 gap-8">

          {/* Round total */}
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-[0.25em] mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Round Total
            </div>
            <div
              className={`text-8xl font-bold transition-all ${flashDart ? 'scale-110' : 'scale-100'}`}
              style={{ color: roundTotal > 0 ? '#fff' : 'rgba(255,255,255,0.15)', lineHeight: 1, letterSpacing: '-0.02em', transition: 'transform 0.2s' }}>
              {roundTotal || '—'}
            </div>
            {roundTotal > 0 && (
              <div className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                pts this round
              </div>
            )}
          </div>

          {/* Dart chips */}
          <div className="flex gap-4 justify-center">
            {[0, 1, 2].map(i => {
              const dart = currentDarts.find(d => d.dartIndex === i);
              const isFlashing = flashDart?.dartIndex === i;
              return (
                <div key={i}
                  className={`flex flex-col items-center gap-2 transition-all ${dart ? 'opacity-100' : 'opacity-20'} ${isFlashing ? 'scale-110' : 'scale-100'}`}
                  style={{ transition: 'transform 0.2s, opacity 0.3s' }}>
                  <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Dart {i + 1}
                  </div>
                  <div
                    className="w-28 h-28 rounded-2xl flex flex-col items-center justify-center"
                    style={{
                      background: dart ? `rgba(${dart.ring === 'triple' ? '0,212,255' : dart.ring === 'double' ? '255,210,74' : dart.ring === 'bull' ? '255,0,92' : '255,255,255'},0.08)` : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${dart ? ringColor(dart.ring) : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: dart && isFlashing ? `0 0 30px ${ringColor(dart.ring)}40` : 'none',
                    }}>
                    {dart ? (
                      <>
                        <div className="text-2xl font-bold" style={{ color: ringColor(dart.ring), lineHeight: 1 }}>
                          {ringLabel(dart.ring, dart.sector)}
                        </div>
                        <div className="text-4xl font-bold mt-1" style={{ color: '#fff', lineHeight: 1 }}>
                          {dart.score}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {Math.round(dart.confidence * 100)}% conf
                        </div>
                      </>
                    ) : (
                      <div className="text-2xl" style={{ color: 'rgba(255,255,255,0.15)' }}>···</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Last round summary */}
          {lastRound && currentDarts.length === 0 && (
            <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Previous Round
              </div>
              <div className="flex items-center gap-3 justify-center">
                {lastRound.darts.map((d, i) => (
                  <div key={i} className="text-sm font-bold" style={{ color: ringColor(d.ring) }}>
                    {ringLabel(d.ring, d.sector)}
                  </div>
                ))}
                <div className="text-lg font-bold" style={{ color: '#ffd24a' }}>= {lastRound.total}pts</div>
              </div>
            </div>
          )}

          {/* Disconnected banner */}
          {(connectionStatus === 'closed' || connectionStatus === 'error') && (
            <div className="px-6 py-4 rounded-xl text-center"
              style={{ background: 'rgba(255,0,92,0.1)', border: '1px solid rgba(255,0,92,0.3)' }}>
              <div className="font-bold text-lg" style={{ color: '#ff005c' }}>
                {connectionStatus === 'closed' ? 'Session ended' : 'Connection lost'}
              </div>
              <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {connectionStatus === 'closed' ? 'The scorer session was closed on the camera device.' : 'Trying to reconnect…'}
              </div>
            </div>
          )}
        </div>

        {/* Right: round history ──────────────────────────────────────────── */}
        {roundHistory.length > 0 && (
          <div className="w-64 border-l py-6 px-5 flex flex-col gap-3 overflow-y-auto" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="text-xs font-bold uppercase tracking-[0.2em] mb-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Round History
            </div>
            {roundHistory.map((r, ri) => (
              <div key={ri} className="py-2.5 px-3 rounded-lg" style={{ background: ri === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${ri === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}` }}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Round {roundHistory.length - ri}</div>
                  <div className="text-sm font-bold" style={{ color: '#ffd24a' }}>{r.total}pts</div>
                </div>
                <div className="flex gap-1.5">
                  {r.darts.map((d, di) => (
                    <div key={di} className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: ringColor(d.ring) }}>
                      {ringLabel(d.ring, d.sector)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
