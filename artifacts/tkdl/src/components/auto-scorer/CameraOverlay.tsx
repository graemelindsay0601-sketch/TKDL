import { useRef, useEffect } from "react";
import type { DetectedDart, AutoScorerStatus } from "@/hooks/useAutoScorer";

// ── Ring label helpers ────────────────────────────────────────────────────────

function ringLabel(d: DetectedDart): string {
  if (d.ring === 'miss') return 'MISS';
  if (d.ring === 'bull') return 'BULL';
  if (d.ring === 'outer_bull') return 'OB';
  const prefix = d.ring === 'triple' ? 'T' : d.ring === 'double' ? 'D' : '';
  return `${prefix}${d.sector}`;
}

// ── Canvas overlay drawing ────────────────────────────────────────────────────

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number, canvasH: number,
  videoNativeW: number, videoNativeH: number,
  radiusFraction: number,
  status: AutoScorerStatus,
  darts: DetectedDart[],
) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  if (status === 'off' || status === 'starting') return;

  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const r = Math.min(canvasW, canvasH) * radiusFraction;
  const isMoving = status === 'motion';

  // Outer board circle
  ctx.save();
  ctx.strokeStyle = isMoving ? 'rgba(255,180,0,0.85)' : 'rgba(0,212,255,0.55)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([9, 7]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.stroke();

  // Bull guide ring
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(0,212,255,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.094, 0, 2 * Math.PI);
  ctx.stroke();

  // Centre crosshair
  ctx.strokeStyle = 'rgba(0,212,255,0.22)';
  const cs = 7;
  ctx.beginPath();
  ctx.moveTo(cx - cs, cy); ctx.lineTo(cx + cs, cy);
  ctx.moveTo(cx, cy - cs); ctx.lineTo(cx, cy + cs);
  ctx.stroke();
  ctx.restore();

  // Dart position markers (scale from native video coords → canvas)
  const sx = canvasW / (videoNativeW || canvasW);
  const sy = canvasH / (videoNativeH || canvasH);

  for (const dart of darts) {
    const dx = dart.pixelX * sx;
    const dy = dart.pixelY * sy;
    const isHighConf = dart.confidence > 0.75;

    ctx.save();
    // Outer glow
    ctx.shadowColor = isHighConf ? '#ffd24a' : 'rgba(255,210,74,0.5)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = isHighConf ? '#ffd24a' : 'rgba(255,210,74,0.65)';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(dx, dy, 11, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Dart index number
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(dart.index + 1), dx, dy);

    // Score label
    const label = ringLabel(dart);
    const scoreStr = `${dart.score}pts`;
    const lx = dx + 15;
    const ly = dy - 8;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, lx, ly);

    ctx.font = '10px sans-serif';
    ctx.strokeText(scoreStr, lx, ly + 13);
    ctx.fillStyle = '#ffd24a';
    ctx.fillText(scoreStr, lx, ly + 13);
    ctx.restore();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CameraOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: AutoScorerStatus;
  radiusFraction: number;
  onRadiusChange: (f: number) => void;
  detectedDarts: DetectedDart[];
}

const STATUS_LABEL: Record<AutoScorerStatus, string> = {
  off: '',
  starting: 'Opening camera…',
  waiting: '🎯 Ready',
  motion: '⚡ Dart detected',
  settled: '✓ Analysing',
};

export function CameraOverlay({ videoRef, status, radiusFraction, onRadiusChange, detectedDarts }: CameraOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      const { clientWidth: w, clientHeight: h } = canvas;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

      const video = videoRef.current;
      drawOverlay(ctx, w, h, video?.videoWidth ?? w, video?.videoHeight ?? h, radiusFraction, status, detectedDarts);
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef, status, radiusFraction, detectedDarts]);

  const isOn = status !== 'off' && status !== 'starting';

  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: '16/9', background: '#000' }}>
      {/* Camera feed */}
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />

      {/* Overlay canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Status badge */}
      {status !== 'off' && (
        <div
          className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
          style={{
            background: status === 'motion' ? 'rgba(255,180,0,0.18)' : 'rgba(0,212,255,0.14)',
            border: `1px solid ${status === 'motion' ? 'rgba(255,180,0,0.5)' : 'rgba(0,212,255,0.4)'}`,
            color: status === 'motion' ? '#ffb400' : '#00d4ff',
            fontFamily: 'Oswald, sans-serif', letterSpacing: '0.07em',
            backdropFilter: 'blur(6px)',
          }}>
          <div className={`w-1.5 h-1.5 rounded-full ${status === 'motion' ? 'bg-amber-400 animate-pulse' : 'bg-teal-400'}`} />
          {STATUS_LABEL[status]}
        </div>
      )}

      {/* Board size adjuster */}
      {isOn && (
        <div className="absolute top-3 right-3 flex flex-col items-center gap-1">
          {[{ label: '+', delta: 0.02 }, { label: '−', delta: -0.02 }].map(({ label, delta }) => (
            <button
              key={label}
              onClick={() => onRadiusChange(radiusFraction + delta)}
              className="w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center transition-opacity hover:opacity-100 opacity-55"
              style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}>
              {label}
            </button>
          ))}
          <div className="text-xs mt-0.5 opacity-40" style={{ color: '#fff', fontFamily: 'Oswald, sans-serif' }}>⊙</div>
        </div>
      )}

      {/* Dart score chips */}
      {detectedDarts.length > 0 && (
        <div className="absolute bottom-3 left-3 right-3 flex gap-2 justify-center flex-wrap">
          {detectedDarts.map((d) => (
            <div key={d.index}
              className="px-2.5 py-1 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(255,210,74,0.4)', color: '#ffd24a', fontFamily: 'Oswald, sans-serif' }}>
              {ringLabel(d)}
              <span className="ml-1" style={{ color: 'rgba(255,210,74,0.55)' }}>{d.score}pts</span>
            </div>
          ))}
          {Array.from({ length: 3 - detectedDarts.length }).map((_, i) => (
            <div key={`e${i}`}
              className="px-2.5 py-1 rounded-lg text-xs"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.2)', fontFamily: 'Oswald, sans-serif' }}>
              ···
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
