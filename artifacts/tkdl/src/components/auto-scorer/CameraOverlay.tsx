import { useRef, useEffect } from "react";
import type { DetectedDart, AutoScorerStatus } from "@/hooks/useAutoScorer";

// ── Ring label helpers ────────────────────────────────────────────────────────

function ringLabel(d: DetectedDart): string {
  if (d.ring === 'miss')       return 'MISS';
  if (d.ring === 'bull')       return 'BULL';
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
  boardCenterX: number,   // normalised 0-1
  boardCenterY: number,   // normalised 0-1
  boardDetected: boolean,
  status: AutoScorerStatus,
  darts: DetectedDart[],
) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  if (status === 'off' || status === 'starting') return;

  // Board centre in canvas pixels
  const cx = boardCenterX * canvasW;
  const cy = boardCenterY * canvasH;
  const r  = Math.min(canvasW, canvasH) * radiusFraction;

  const isMoving = status === 'motion';
  const ringColour = boardDetected
    ? (isMoving ? 'rgba(255,180,0,0.85)' : 'rgba(0,212,255,0.65)')
    : 'rgba(255,255,255,0.35)';

  // Outer board circle
  ctx.save();
  ctx.strokeStyle = ringColour;
  ctx.lineWidth   = 2.5;
  ctx.setLineDash(boardDetected ? [9, 7] : [5, 5]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.stroke();

  // Bull guide ring
  ctx.setLineDash([]);
  ctx.strokeStyle = boardDetected ? 'rgba(0,212,255,0.28)' : 'rgba(255,255,255,0.12)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.094, 0, 2 * Math.PI);
  ctx.stroke();

  // Centre crosshair
  ctx.strokeStyle = boardDetected ? 'rgba(0,212,255,0.22)' : 'rgba(255,255,255,0.12)';
  const cs = 7;
  ctx.beginPath();
  ctx.moveTo(cx - cs, cy); ctx.lineTo(cx + cs, cy);
  ctx.moveTo(cx, cy - cs); ctx.lineTo(cx, cy + cs);
  ctx.stroke();
  ctx.restore();

  // Dart position markers — scale from native video coords → canvas display coords
  const sx = canvasW / (videoNativeW || canvasW);
  const sy = canvasH / (videoNativeH || canvasH);

  for (const dart of darts) {
    const dx = dart.pixelX * sx;
    const dy = dart.pixelY * sy;
    const isHighConf = dart.confidence > 0.75;

    ctx.save();
    ctx.shadowColor = isHighConf ? '#ffd24a' : 'rgba(255,210,74,0.5)';
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = isHighConf ? '#ffd24a' : 'rgba(255,210,74,0.65)';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(dx, dy, 11, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle       = '#111';
    ctx.font            = 'bold 9px sans-serif';
    ctx.textAlign       = 'center';
    ctx.textBaseline    = 'middle';
    ctx.fillText(String(dart.index + 1), dx, dy);

    const label    = ringLabel(dart);
    const scoreStr = `${dart.score}pts`;
    const lx = dx + 15;
    const ly = dy - 8;

    ctx.font        = 'bold 11px sans-serif';
    ctx.textAlign   = 'left';
    ctx.lineWidth   = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle   = '#fff';
    ctx.fillText(label, lx, ly);

    ctx.font = '10px sans-serif';
    ctx.strokeText(scoreStr, lx, ly + 13);
    ctx.fillStyle = '#ffd24a';
    ctx.fillText(scoreStr, lx, ly + 13);
    ctx.restore();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
// NOTE: CameraOverlay renders ONLY the canvas + controls overlay.
// The <video> element is always mounted by the parent (scorer-camera.tsx)
// so that videoRef is available before cameraActive becomes true.

interface CameraOverlayProps {
  videoRef:      React.RefObject<HTMLVideoElement | null>;
  status:        AutoScorerStatus;
  radiusFraction: number;
  onRadiusChange: (f: number) => void;
  zoomLevel:     number;
  onZoomChange:  (z: number) => void;
  detectedDarts: DetectedDart[];
  // Board detection
  boardDetected:  boolean;
  boardCenterX:   number;   // normalised 0-1
  boardCenterY:   number;   // normalised 0-1
  cvReady:        boolean;
  onDetectBoard:  () => void;
}

const STATUS_LABEL: Record<AutoScorerStatus, string> = {
  off:      '',
  starting: 'Opening camera…',
  waiting:  '🎯 Ready',
  motion:   '⚡ Dart detected',
  settled:  '✓ Analysing',
};

export function CameraOverlay({
  videoRef, status, radiusFraction, onRadiusChange,
  zoomLevel, onZoomChange, detectedDarts,
  boardDetected, boardCenterX, boardCenterY, cvReady, onDetectBoard,
}: CameraOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }
      const { clientWidth: w, clientHeight: h } = canvas;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const video = videoRef.current;
      drawOverlay(
        ctx, w, h,
        video?.videoWidth ?? w, video?.videoHeight ?? h,
        radiusFraction, boardCenterX, boardCenterY, boardDetected,
        status, detectedDarts,
      );
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef, status, radiusFraction, boardCenterX, boardCenterY, boardDetected, detectedDarts]);

  const isOn = status !== 'off' && status !== 'starting';

  return (
    <>
      {/* Canvas overlay */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Status badge (top-left) */}
      {status !== 'off' && (
        <div
          className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
          style={{
            background:     status === 'motion' ? 'rgba(255,180,0,0.18)' : 'rgba(0,212,255,0.14)',
            border:         `1px solid ${status === 'motion' ? 'rgba(255,180,0,0.5)' : 'rgba(0,212,255,0.4)'}`,
            color:          status === 'motion' ? '#ffb400' : '#00d4ff',
            fontFamily:     'Oswald, sans-serif',
            letterSpacing:  '0.07em',
            backdropFilter: 'blur(6px)',
          }}>
          <div className={`w-1.5 h-1.5 rounded-full ${status === 'motion' ? 'bg-amber-400 animate-pulse' : 'bg-teal-400'}`} />
          {STATUS_LABEL[status]}
        </div>
      )}

      {/* Board detection pill (below status badge) */}
      {isOn && (
        <div className="absolute top-10 left-3 flex items-center gap-1.5">
          {boardDetected ? (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: 'rgba(0,212,255,0.12)',
                border: '1px solid rgba(0,212,255,0.35)',
                color: '#00d4ff',
                fontFamily: 'Oswald, sans-serif',
              }}>
              ✓ Board locked
            </div>
          ) : (
            <button
              onClick={onDetectBoard}
              disabled={!cvReady}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-opacity"
              style={{
                background:   cvReady ? 'rgba(255,0,92,0.18)' : 'rgba(255,255,255,0.06)',
                border:       `1px solid ${cvReady ? 'rgba(255,0,92,0.5)' : 'rgba(255,255,255,0.15)'}`,
                color:        cvReady ? '#ff005c' : 'rgba(255,255,255,0.35)',
                fontFamily:   'Oswald, sans-serif',
                cursor:       cvReady ? 'pointer' : 'default',
              }}>
              {cvReady ? '⊙ Detect Board' : '⌛ Loading CV…'}
            </button>
          )}
          {boardDetected && (
            <button
              onClick={onDetectBoard}
              className="text-[9px] opacity-30 hover:opacity-60 transition-opacity"
              style={{ color: '#fff', fontFamily: 'Oswald, sans-serif' }}>
              re-detect
            </button>
          )}
        </div>
      )}

      {/* Right-side controls: zoom (top) + circle size (bottom) */}
      {isOn && (
        <div className="absolute top-3 right-3 flex flex-col items-center gap-1">
          {/* Zoom */}
          <button
            onClick={() => onZoomChange(zoomLevel + 0.25)}
            className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center hover:opacity-100 opacity-70"
            style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(0,212,255,0.45)', color: '#00d4ff' }}>
            +
          </button>
          <div className="text-[9px] font-bold leading-none" style={{ color: '#00d4ff', opacity: 0.8, fontFamily: 'Oswald, sans-serif' }}>
            {zoomLevel.toFixed(1)}×
          </div>
          <button
            onClick={() => onZoomChange(zoomLevel - 0.25)}
            className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center hover:opacity-100 opacity-70"
            style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(0,212,255,0.45)', color: '#00d4ff' }}>
            −
          </button>

          {/* Divider */}
          <div className="w-5 h-px my-0.5" style={{ background: 'rgba(255,255,255,0.15)' }} />

          {/* Ring size (fine-tune after detection) */}
          <button
            onClick={() => onRadiusChange(radiusFraction + 0.02)}
            className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center hover:opacity-100 opacity-50"
            style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}>
            +
          </button>
          <div className="text-[9px] leading-none opacity-35" style={{ color: '#fff', fontFamily: 'Oswald, sans-serif' }}>⊙</div>
          <button
            onClick={() => onRadiusChange(radiusFraction - 0.02)}
            className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center hover:opacity-100 opacity-50"
            style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}>
            −
          </button>
        </div>
      )}

      {/* Dart score chips (bottom) */}
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
    </>
  );
}
