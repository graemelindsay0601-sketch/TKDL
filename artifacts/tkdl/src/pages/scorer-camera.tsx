/**
 * /scorer/camera — Camera-based X01 scorer (primary interface for auto-scorer testing).
 * Camera detects each dart, accumulates 3-dart round total, applies to X01 state.
 * Supports two-device mode: session code connects a display device via SSE.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { Camera, RotateCcw, Check, AlertTriangle, ChevronLeft, Tv2, ChevronDown } from "lucide-react";
import { useAutoScorer, type DetectedDart } from "@/hooks/useAutoScorer";
import { CameraOverlay } from "@/components/auto-scorer/CameraOverlay";

// ── Checkout table ─────────────────────────────────────────────────────────────

const CO: Record<number, string> = {
  170:"T20 T20 DB", 167:"T20 T19 DB", 164:"T20 T18 DB", 161:"T20 T17 DB",
  160:"T20 T20 D20", 158:"T20 T20 D19", 157:"T20 T19 D20", 156:"T20 T20 D18",
  155:"T20 T19 D19", 154:"T20 T18 D20", 153:"T20 T19 D18", 152:"T20 T20 D16",
  151:"T20 T17 D20", 150:"T20 T18 D18", 149:"T20 T19 D16", 148:"T20 T20 D14",
  147:"T20 T17 D18", 146:"T20 T18 D16", 145:"T20 T19 D14", 144:"T20 T20 D12",
  143:"T20 T17 D16", 142:"T20 T14 DB",  141:"T20 T19 D12", 140:"T20 T20 D10",
  139:"T20 T13 DB",  138:"T20 T18 D12", 137:"T20 T19 D10", 136:"T20 T20 D8",
  135:"T20 T17 D12", 134:"T20 T14 D16", 133:"T20 T19 D8",  132:"T20 T16 D12",
  131:"T20 T13 D16", 130:"T20 T20 D5",  129:"T20 T19 D6",  128:"T20 T18 D7",
  127:"T20 T17 D8",  126:"T19 T19 D6",  125:"T20 T15 D10", 124:"T20 T16 D8",
  123:"T20 T13 D12", 122:"T18 T18 D7",  121:"T20 T11 D14", 120:"T20 S20 D20",
  119:"T19 T12 D13", 118:"T20 S18 D20", 117:"T20 S17 D20", 116:"T20 S16 D20",
  115:"T19 S18 D20", 114:"T20 S14 D20", 113:"T19 S16 D20", 112:"T20 S12 D20",
  111:"T20 S19 D16", 110:"T20 S10 D20", 109:"T20 S9 D20",  108:"T20 S16 D16",
  107:"T19 S10 D20", 106:"T20 S10 D18", 105:"T20 S13 D16", 104:"T20 S8 D20",
  103:"T20 S3 D20",  102:"T20 S10 D16", 101:"T17 D25",     100:"T20 D20",
  99:"T19 D21", 98:"T20 D19", 97:"T19 D20", 96:"T20 D18", 95:"T19 D19",
  94:"T18 D20", 93:"T19 D18", 92:"T20 D16", 91:"T17 D20",  90:"T18 D18",
  89:"T19 D16", 88:"T20 D14", 87:"T17 D18", 86:"T18 D16",  85:"T15 D20",
  84:"T20 D12", 83:"T17 D16", 82:"T14 D20", 81:"T19 D12",  80:"T16 D16",
  79:"T13 D20", 78:"T18 D12", 77:"T15 D16", 76:"T20 D8",   75:"T15 D15",
  74:"T14 D16", 73:"T19 D8",  72:"T16 D12", 71:"T13 D16",  70:"T10 D20",
  69:"T19 D6",  68:"T20 D4",  67:"T9 D20",  66:"T10 D18",  65:"T11 D16",
  64:"T16 D8",  63:"T13 D12", 62:"T10 D16", 61:"T15 D8",   60:"S20 D20",
  59:"S19 D20", 58:"S18 D20", 57:"S17 D20", 56:"S16 D20",  55:"S15 D20",
  54:"S14 D20", 53:"S13 D20", 52:"S12 D20", 51:"S11 D20",  50:"S10 D20",
  49:"S9 D20",  48:"S16 D16", 47:"S15 D16", 46:"S14 D16",  45:"S13 D16",
  44:"S12 D16", 43:"S11 D16", 42:"S10 D16", 41:"S9 D16",   40:"D20",
  38:"D19",     36:"D18",     34:"D17",      32:"D16",       30:"D15",
  28:"D14",     26:"D13",     24:"D12",      22:"D11",       20:"D10",
  18:"D9",      16:"D8",      14:"D7",       12:"D6",        10:"D5",
  8:"D4",       6:"D3",       4:"D2",        2:"D1",
};

function ringLabel(d: { ring: string; sector: number }): string {
  if (d.ring === 'miss') return 'Miss';
  if (d.ring === 'bull') return 'BULL';
  if (d.ring === 'outer_bull') return 'OB';
  const p = d.ring === 'triple' ? 'T' : d.ring === 'double' ? 'D' : '';
  return `${p}${d.sector}`;
}

// ── Manual numpad overlay ─────────────────────────────────────────────────────

function ManualNumpad({ max, onSubmit, onCancel }: { max: number; onSubmit: (n: number) => void; onCancel: () => void }) {
  const [digits, setDigits] = useState('');
  const val = Number(digits) || 0;
  const valid = digits !== '' && val >= 0 && val <= Math.min(180, max);

  const press = (k: string) => {
    if (k === '⌫') { setDigits(p => p.slice(0, -1)); return; }
    const next = digits + k;
    if (Number(next) > 180) return;
    setDigits(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onCancel}>
      <div className="w-full max-w-sm rounded-t-2xl pb-6 pt-5 px-5" style={{ background: '#0e0a1a', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
        <div className="text-center mb-4">
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Oswald, sans-serif' }}>Manual Score Entry</div>
          <div className={`text-5xl font-bold ${digits ? '' : 'opacity-20'}`} style={{ fontFamily: 'Oswald, sans-serif', color: valid ? '#fff' : '#ff005c' }}>
            {digits || '0'}
          </div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Max: {Math.min(180, max)}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
            <button key={i} onClick={() => k && press(k)} disabled={!k}
              className={`h-14 rounded-xl text-xl font-bold transition-all ${k ? 'active:scale-95 hover:bg-white/10' : 'opacity-0'}`}
              style={{ background: k === '⌫' ? 'rgba(255,0,92,0.12)' : k ? 'rgba(255,255,255,0.07)' : 'transparent', color: '#fff', fontFamily: 'Oswald, sans-serif' }}>
              {k}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3.5 rounded-xl font-bold uppercase tracking-wider text-sm"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Oswald, sans-serif' }}>
            Cancel
          </button>
          <button onClick={() => valid && onSubmit(val)} disabled={!valid}
            className="flex-1 py-3.5 rounded-xl font-bold uppercase tracking-wider text-sm"
            style={{ background: valid ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)', color: valid ? '#00d4ff' : 'rgba(255,255,255,0.2)', border: `1px solid ${valid ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`, fontFamily: 'Oswald, sans-serif' }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Setup screen ──────────────────────────────────────────────────────────────

const START_SCORES = [170, 301, 401, 501];

interface Player { id: number; name: string; isActive: boolean; }

function PlayerSelect({ label, value, onChange, players, exclude }: {
  label: string;
  value: string;
  onChange: (name: string) => void;
  players: Player[];
  exclude: string;
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</div>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none px-4 py-3 rounded-xl text-sm font-bold pr-10"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: value ? '#fff' : 'rgba(255,255,255,0.35)',
            fontFamily: 'Oswald, sans-serif',
            outline: 'none',
          }}>
          <option value="" style={{ background: '#0e0a1a', color: 'rgba(255,255,255,0.35)' }}>Select player…</option>
          {players
            .filter(p => p.name !== exclude)
            .map(p => (
              <option key={p.id} value={p.name} style={{ background: '#0e0a1a', color: '#fff' }}>
                {p.name}{!p.isActive ? ' (inactive)' : ''}
              </option>
            ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
      </div>
    </div>
  );
}

function SetupScreen({ onStart }: { onStart: (p1: string, p2: string, start: number) => void }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [start, setStart] = useState(501);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/players')
      .then(r => r.json() as Promise<Player[]>)
      .then(data => {
        // Active players first, then inactive
        const sorted = [...data].sort((a, b) => {
          if (a.isActive === b.isActive) return a.name.localeCompare(b.name);
          return a.isActive ? -1 : 1;
        });
        setPlayers(sorted);
      })
      .catch(() => { /* show empty list */ })
      .finally(() => setLoading(false));
  }, []);

  const canStart = p1 && p2 && p1 !== p2;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-6" style={{ background: '#06040e', fontFamily: 'Oswald, sans-serif' }}>
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)' }}>
            <Camera className="w-6 h-6" style={{ color: '#00d4ff' }} />
          </div>
          <div className="text-3xl font-bold uppercase tracking-widest" style={{ color: '#fff' }}>Camera Scorer</div>
          <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Point your camera at the dartboard</div>
        </div>

        {/* Player selectors */}
        {loading ? (
          <div className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading players…</div>
        ) : (
          <div className="space-y-3">
            <PlayerSelect label="Player 1" value={p1} onChange={setP1} players={players} exclude={p2} />
            <PlayerSelect label="Player 2" value={p2} onChange={setP2} players={players} exclude={p1} />
            {p1 && p2 && p1 === p2 && (
              <div className="text-xs text-center" style={{ color: '#ff005c' }}>Players must be different</div>
            )}
          </div>
        )}

        {/* Starting score */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Starting Score</div>
          <div className="grid grid-cols-4 gap-2">
            {START_SCORES.map(s => (
              <button key={s} onClick={() => setStart(s)}
                className="py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: start === s ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${start === s ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: start === s ? '#00d4ff' : 'rgba(255,255,255,0.5)',
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Start */}
        <button
          onClick={() => canStart && onStart(p1, p2, start)}
          disabled={!canStart}
          className="w-full py-4 rounded-xl text-base font-bold uppercase tracking-widest transition-opacity"
          style={{
            background: canStart ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${canStart ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: canStart ? '#00d4ff' : 'rgba(255,255,255,0.2)',
            opacity: canStart ? 1 : 0.6,
          }}>
          <Camera className="inline w-4 h-4 mr-2" />Start Game
        </button>

        <a href="/" className="block text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>← Back to TKDL</a>
      </div>
    </div>
  );
}

// ── Game screen ───────────────────────────────────────────────────────────────

interface RoundRecord {
  playerIdx: 0 | 1;
  total: number;
  bust: boolean;
  darts: { sector: number; ring: string; score: number }[];
}

function GameScreen({ p1Name, p2Name, startScore, onBack }: {
  p1Name: string; p2Name: string; startScore: number; onBack: () => void;
}) {
  const names = [p1Name, p2Name];
  const [scores, setScores] = useState([startScore, startScore]);
  const [currentPlayer, setCurrentPlayer] = useState<0 | 1>(0);
  const [round, setRound] = useState(1);
  const [history, setHistory] = useState<RoundRecord[]>([]);
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const [pendingDarts, setPendingDarts] = useState<DetectedDart[] | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [bustFlag, setBustFlag] = useState(false);
  const [displayCode, setDisplayCode] = useState<string | null>(null);

  const onDartDetected = useCallback((_dart: DetectedDart) => {
    // Handled in onRoundComplete
  }, []);

  const onRoundComplete = useCallback((darts: DetectedDart[]) => {
    setPendingDarts(darts);
  }, []);

  const { videoRef, cameraActive, startCamera, stopCamera, status, error, radiusFraction, setRadiusFraction, zoomLevel, setZoomLevel, detectedDarts, resetRound, startSession, broadcastEvent, cvReady, boardDetected, boardCenterX, boardCenterY, detectBoard } = useAutoScorer({ onDartDetected, onRoundComplete });

  // Auto-check bust when 3 darts pending
  useEffect(() => {
    if (!pendingDarts) return;
    const total = pendingDarts.reduce((s, d) => s + d.score, 0);
    const newScore = scores[currentPlayer] - total;
    setBustFlag(newScore < 0 || newScore === 1);
  }, [pendingDarts, scores, currentPlayer]);

  const applyRound = useCallback((total: number, darts: { sector: number; ring: string; score: number }[]) => {
    const newScore = scores[currentPlayer] - total;
    const isBust = newScore < 0 || newScore === 1;
    const isWin = newScore === 0;

    const record: RoundRecord = { playerIdx: currentPlayer, total, bust: isBust, darts };
    setHistory(prev => [record, ...prev]);

    void broadcastEvent('round_submitted', {
      playerIdx: currentPlayer,
      total, bust: isBust, win: isWin,
      scoresAfter: isBust ? scores : scores.map((s, i) => i === currentPlayer ? newScore : s),
    });

    if (isWin) {
      setScores(prev => prev.map((s, i) => i === currentPlayer ? 0 : s));
      setWinner(currentPlayer);
      void broadcastEvent('game_won', { winnerIdx: currentPlayer, winnerName: names[currentPlayer] });
    } else {
      if (!isBust) setScores(prev => prev.map((s, i) => i === currentPlayer ? newScore : s));
      const nextPlayer = (1 - currentPlayer) as 0 | 1;
      setCurrentPlayer(nextPlayer);
      if (currentPlayer === 1) setRound(r => r + 1);
    }

    setPendingDarts(null);
    setBustFlag(false);
    resetRound();
  }, [scores, currentPlayer, broadcastEvent, names, resetRound]);

  const handleConfirmDetected = () => {
    if (!pendingDarts) return;
    const total = pendingDarts.reduce((s, d) => s + d.score, 0);
    applyRound(total, pendingDarts.map(d => ({ sector: d.sector, ring: d.ring, score: d.score })));
  };

  const handleManualScore = (n: number) => {
    applyRound(n, [{ sector: 0, ring: 'single', score: n }]);
    setShowManual(false);
  };

  const handleDiscard = () => {
    setPendingDarts(null);
    setBustFlag(false);
    resetRound();
  };

  // Start a display device session
  const handleStartDisplay = async () => {
    const code = await startSession();
    if (code) setDisplayCode(code);
  };

  const checkout0 = CO[scores[0]] ?? null;
  const checkout1 = CO[scores[1]] ?? null;
  const currentCheckout = currentPlayer === 0 ? checkout0 : checkout1;

  const roundTotal = pendingDarts?.reduce((s, d) => s + d.score, 0)
    ?? detectedDarts.reduce((s, d) => s + d.score, 0);

  // ── Winner screen ─────────────────────────────────────────────────────────

  if (winner !== null) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center text-center px-6"
        style={{ background: '#06040e', fontFamily: 'Oswald, sans-serif' }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'rgba(0,212,255,0.12)', border: '2px solid rgba(0,212,255,0.4)' }}>
          <Check className="w-10 h-10" style={{ color: '#00d4ff' }} />
        </div>
        <div className="text-xs font-bold uppercase tracking-[0.3em] mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Winner</div>
        <div className="text-5xl font-black uppercase" style={{ color: '#fff', letterSpacing: '0.05em' }}>
          {names[winner]}
        </div>
        <div className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Game of {startScore} — Round {round}
        </div>
        <div className="flex gap-3 mt-8 w-full max-w-xs">
          <button onClick={() => { setScores([startScore, startScore]); setCurrentPlayer(0); setRound(1); setHistory([]); setWinner(null); setPendingDarts(null); resetRound(); }}
            className="flex-1 py-3.5 rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
            <RotateCcw className="w-4 h-4" />Again
          </button>
          <button onClick={onBack}
            className="flex-1 py-3.5 rounded-xl font-bold uppercase tracking-wider text-sm"
            style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>
            New Setup
          </button>
        </div>
      </div>
    );
  }

  // ── Main playing view ─────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#06040e', fontFamily: 'Oswald, sans-serif' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={onBack} className="p-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {startScore} · Round {round}
        </div>
        <div className="flex items-center gap-2">
          {displayCode ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold tracking-[0.2em]"
              style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>
              <Tv2 className="w-3 h-3" />{displayCode}
            </div>
          ) : (
            <button onClick={handleStartDisplay}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
              <Tv2 className="w-3 h-3" />Display
            </button>
          )}
        </div>
      </div>

      {/* Camera view — video is ALWAYS mounted so videoRef is ready before cameraActive */}
      <div className="px-3 pt-2.5 shrink-0">
        <div
          className="relative w-full overflow-hidden rounded-xl"
          style={{
            aspectRatio: '16/9',
            background: cameraActive ? '#000' : (error ? 'rgba(255,20,20,0.04)' : 'rgba(255,255,255,0.03)'),
            border: `1px solid ${error && !cameraActive ? 'rgba(255,0,92,0.25)' : 'rgba(255,255,255,0.08)'}`,
          }}>

          {/* Video always rendered; invisible until cameraActive.
              CSS scale provides the visual zoom — detection zoom is handled
              by cropping the canvas drawImage in useAutoScorer. */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              display: cameraActive ? 'block' : 'none',
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
            }}
          />

          {/* Canvas + controls overlay — only when camera is active */}
          {cameraActive && (
            <CameraOverlay
              videoRef={videoRef}
              status={pendingDarts ? 'settled' : status}
              radiusFraction={radiusFraction}
              onRadiusChange={setRadiusFraction}
              zoomLevel={zoomLevel}
              onZoomChange={setZoomLevel}
              detectedDarts={pendingDarts ?? detectedDarts}
              boardDetected={boardDetected}
              boardCenterX={boardCenterX}
              boardCenterY={boardCenterY}
              cvReady={cvReady}
              onDetectBoard={detectBoard}
            />
          )}

          {/* Placeholder — shown while camera is off */}
          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              {status === 'starting' ? (
                <>
                  <div className="w-10 h-10 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'rgba(0,212,255,0.5)', borderTopColor: 'transparent' }} />
                  <div className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: 'rgba(0,212,255,0.7)', fontFamily: 'Oswald, sans-serif' }}>Opening camera…</div>
                  <div className="text-xs text-center px-6" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Allow camera access if prompted
                  </div>
                </>
              ) : error ? (
                <>
                  <AlertTriangle className="w-8 h-8" style={{ color: '#ff005c' }} />
                  <div className="text-xs text-center px-4" style={{ color: 'rgba(255,100,100,0.8)' }}>{error}</div>
                  <button onClick={() => void startCamera()}
                    className="px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wider"
                    style={{ background: 'rgba(255,0,92,0.12)', border: '1px solid rgba(255,0,92,0.35)', color: '#ff005c' }}>
                    Try Again
                  </button>
                </>
              ) : (
                <>
                  <Camera className="w-10 h-10" style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <button onClick={() => void startCamera()}
                    className="px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wider"
                    style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.4)', color: '#00d4ff' }}>
                    Open Camera
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-2 px-3 pt-2.5 shrink-0">
        {([0, 1] as const).map(i => (
          <div key={i} className="rounded-xl px-3 py-3 text-center relative overflow-hidden"
            style={{
              background: currentPlayer === i ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${currentPlayer === i ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
            }}>
            {currentPlayer === i && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: '#00d4ff' }} />}
            <div className="text-xs font-bold uppercase tracking-widest truncate mb-0.5"
              style={{ color: currentPlayer === i ? '#00d4ff' : 'rgba(255,255,255,0.3)' }}>
              {names[i]}
            </div>
            <div className="text-4xl font-black leading-none" style={{ color: currentPlayer === i ? '#fff' : 'rgba(255,255,255,0.35)' }}>
              {scores[i]}
            </div>
            {currentPlayer === i && (i === 0 ? checkout0 : checkout1) && (
              <div className="text-xs mt-1 font-bold" style={{ color: 'rgba(0,212,255,0.7)' }}>
                {i === 0 ? checkout0 : checkout1}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Turn + detected darts */}
      <div className="px-3 pt-2.5 shrink-0">
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {names[currentPlayer]}'s turn
            </div>
            {roundTotal > 0 && (
              <div className="text-sm font-bold" style={{ color: bustFlag ? '#ff005c' : '#ffd24a' }}>
                {bustFlag ? '💥 BUST' : `${roundTotal} pts`}
              </div>
            )}
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => {
              const dart = (pendingDarts ?? detectedDarts)[i];
              return (
                <div key={i} className="flex-1 py-2 rounded-lg text-center text-xs font-bold"
                  style={{
                    background: dart ? 'rgba(255,210,74,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${dart ? 'rgba(255,210,74,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    color: dart ? '#ffd24a' : 'rgba(255,255,255,0.15)',
                  }}>
                  {dart ? (
                    <>
                      <div>{ringLabel(dart)}</div>
                      <div className="opacity-60">{dart.score}</div>
                    </>
                  ) : '···'}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-3 pt-2 pb-4 mt-auto shrink-0 space-y-2">
        {pendingDarts ? (
          <div className="flex gap-2">
            <button onClick={handleDiscard}
              className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl font-bold uppercase tracking-wider text-sm"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
              <RotateCcw className="w-4 h-4" />Redo
            </button>
            {bustFlag ? (
              <button onClick={handleConfirmDetected}
                className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,0,92,0.15)', border: '1px solid rgba(255,0,92,0.4)', color: '#ff005c' }}>
                <AlertTriangle className="w-4 h-4" />Bust — Confirm
              </button>
            ) : (
              <button onClick={handleConfirmDetected}
                className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2"
                style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.4)', color: '#00d4ff' }}>
                <Check className="w-4 h-4" />Apply {roundTotal}pts
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            {cameraActive && (
              <button onClick={stopCamera}
                className="p-3 rounded-xl"
                style={{ background: 'rgba(255,0,92,0.08)', border: '1px solid rgba(255,0,92,0.2)', color: 'rgba(255,0,92,0.6)' }}>
                <Camera className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setShowManual(true)}
              className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-sm"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
              Manual Score
            </button>
            {detectedDarts.length > 0 && (
              <button onClick={resetRound}
                className="p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Recent history */}
        {history.length > 0 && !pendingDarts && (
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {history.slice(0, 4).map((h, i) => (
              <div key={i} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  background: h.bust ? 'rgba(255,0,92,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${h.bust ? 'rgba(255,0,92,0.2)' : 'rgba(255,255,255,0.08)'}`,
                  color: h.bust ? 'rgba(255,0,92,0.6)' : 'rgba(255,255,255,0.3)',
                }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{names[h.playerIdx].slice(0, 3)}</span>
                {' '}{h.bust ? '💥' : `+${h.total}`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual input overlay */}
      {showManual && (
        <ManualNumpad
          max={Math.min(180, scores[currentPlayer])}
          onSubmit={handleManualScore}
          onCancel={() => setShowManual(false)}
        />
      )}
    </div>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────────

export default function CameraScorer() {
  const [config, setConfig] = useState<{ p1: string; p2: string; start: number } | null>(null);

  if (!config) {
    return <SetupScreen onStart={(p1, p2, start) => setConfig({ p1, p2, start })} />;
  }

  return (
    <GameScreen
      key={JSON.stringify(config)}
      p1Name={config.p1}
      p2Name={config.p2}
      startScore={config.start}
      onBack={() => setConfig(null)}
    />
  );
}
