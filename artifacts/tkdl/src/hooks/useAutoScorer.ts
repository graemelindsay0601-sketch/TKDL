import { useRef, useState, useCallback, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AutoScorerStatus =
  | 'off'       // camera not started
  | 'starting'  // awaiting getUserMedia permission
  | 'waiting'   // camera on, board locked, waiting for throw
  | 'motion'    // motion detected (dart in flight)
  | 'settled';  // motion stopped, analysis complete

export interface DetectedDart {
  index: 0 | 1 | 2;
  sector: number;   // 1-20, 25 (outer bull), or 50 (bull)
  ring: 'bull' | 'outer_bull' | 'single' | 'triple' | 'double' | 'miss';
  score: number;
  confidence: number; // 0-1
  pixelX: number;     // position in native video frame (for overlay)
  pixelY: number;
}

interface UseAutoScorerOptions {
  onDartDetected?: (dart: DetectedDart) => void;
  onRoundComplete?: (darts: DetectedDart[]) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Dartboard sectors CW from top (20 at 12 o'clock)
const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const;

// Ring boundary as fraction of board radius (real dartboard measurements)
const RING = { bull: 0.037, outerBull: 0.094, tripleInner: 0.582, tripleOuter: 0.63, doubleInner: 0.953 };

const CALIBRATION_KEY = 'tkdl_scorer_radius';
const ANALYSIS_W = 320;    // downsampled width for frame analysis
const ANALYSIS_H = 240;
const MOTION_THRESHOLD = 12;      // mean pixel diff to declare motion
const DART_DIFF_THRESHOLD = 25;   // pixel diff to consider a dart-changed pixel
const MIN_DART_WEIGHT = 1200;     // minimum weighted diff signal to count as dart
const SETTLE_MS = 700;            // ms of low motion before we analyse dart position
const CAPTURE_INTERVAL_MS = 300;

// ── Board geometry ─────────────────────────────────────────────────────────────

function mapToBoard(
  px: number, py: number,
  frameW: number, frameH: number,
  radiusFraction: number,
): Pick<DetectedDart, 'sector' | 'ring' | 'score' | 'confidence'> {
  const cx = frameW / 2;
  const cy = frameH / 2;
  const r = Math.min(frameW, frameH) * radiusFraction;
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nd = dist / r; // normalized distance

  // Bullseye regions
  if (nd < RING.bull) return { sector: 50, ring: 'bull', score: 50, confidence: 0.95 };
  if (nd < RING.outerBull) return { sector: 25, ring: 'outer_bull', score: 25, confidence: 0.90 };
  if (nd > 1.1) return { sector: 0, ring: 'miss', score: 0, confidence: 0.70 };

  // Sector angle: atan2(dx, -dy) gives 0 at top, positive CW (matches dartboard)
  const rawAngle = Math.atan2(dx, -dy);
  const boardAngle = (rawAngle + 2 * Math.PI) % (2 * Math.PI);
  const sectorIdx = Math.floor(boardAngle / (2 * Math.PI / 20)) % 20;
  const sector = SECTORS[sectorIdx];

  let ring: DetectedDart['ring'];
  let score: number;
  if (nd < RING.tripleInner) { ring = 'single'; score = sector; }
  else if (nd < RING.tripleOuter) { ring = 'triple'; score = sector * 3; }
  else if (nd < RING.doubleInner) { ring = 'single'; score = sector; }
  else { ring = 'double'; score = sector * 2; }

  // Confidence: higher when far from ring boundaries
  const distFromBoundary = Math.min(
    Math.abs(nd - RING.bull), Math.abs(nd - RING.outerBull),
    Math.abs(nd - RING.tripleInner), Math.abs(nd - RING.tripleOuter),
    Math.abs(nd - RING.doubleInner), Math.abs(nd - 1.0),
  );
  const confidence = Math.min(0.95, 0.55 + distFromBoundary * 3);
  return { sector, ring, score, confidence };
}

// ── Frame analysis ─────────────────────────────────────────────────────────────

function computeMeanDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 4) {
    sum += Math.abs(b[i] - a[i]) + Math.abs(b[i + 1] - a[i + 1]) + Math.abs(b[i + 2] - a[i + 2]);
  }
  return sum / (a.length / 4 * 3);
}

function findCentroid(
  before: Uint8ClampedArray,
  after: Uint8ClampedArray,
  w: number, h: number,
): { x: number; y: number; totalWeight: number } | null {
  let sumX = 0, sumY = 0, total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const wt = (Math.abs(after[i] - before[i]) + Math.abs(after[i + 1] - before[i + 1]) + Math.abs(after[i + 2] - before[i + 2])) / 3;
      if (wt > DART_DIFF_THRESHOLD) { sumX += x * wt; sumY += y * wt; total += wt; }
    }
  }
  if (total < MIN_DART_WEIGHT) return null;
  return { x: sumX / total, y: sumY / total, totalWeight: total };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAutoScorer({ onDartDetected, onRoundComplete }: UseAutoScorerOptions = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisCanvas = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const preMotionFrameRef = useRef<Uint8ClampedArray | null>(null);
  const isMotionRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectedDartsRef = useRef<DetectedDart[]>([]);
  const sessionCodeRef = useRef<string | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [status, setStatus] = useState<AutoScorerStatus>('off');
  const [error, setError] = useState<string | null>(null);
  const [detectedDarts, setDetectedDarts] = useState<DetectedDart[]>([]);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [radiusFraction, setRadiusFractionState] = useState<number>(() => {
    try { const v = Number(localStorage.getItem(CALIBRATION_KEY)); return v > 0 ? v : 0.42; }
    catch { return 0.42; }
  });

  // ── Calibration ────────────────────────────────────────────────────────────

  const setRadiusFraction = useCallback((f: number) => {
    const clamped = Math.max(0.15, Math.min(0.65, f));
    setRadiusFractionState(clamped);
    try { localStorage.setItem(CALIBRATION_KEY, String(clamped)); } catch { /* ignore */ }
  }, []);

  // ── Session / SSE relay ────────────────────────────────────────────────────

  const broadcastEvent = useCallback(async (type: string, payload: unknown): Promise<void> => {
    const code = sessionCodeRef.current;
    if (!code) return;
    try {
      await fetch(`/api/scorer/sessions/${code}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload }),
      });
    } catch { /* non-fatal: display device may not be connected */ }
  }, []);

  const startSession = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/scorer/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameType: null, players: [] }),
      });
      const data = await res.json() as { code: string };
      sessionCodeRef.current = data.code;
      setSessionCode(data.code);
      return data.code;
    } catch { return null; }
  }, []);

  const stopSession = useCallback(async () => {
    const code = sessionCodeRef.current;
    if (!code) return;
    try { await fetch(`/api/scorer/sessions/${code}`, { method: 'DELETE' }); } catch { /* ignore */ }
    sessionCodeRef.current = null;
    setSessionCode(null);
  }, []);

  // ── Frame capture ──────────────────────────────────────────────────────────

  const captureFrame = useCallback((): Uint8ClampedArray | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
    const canvas = analysisCanvas.current;
    canvas.width = ANALYSIS_W;
    canvas.height = ANALYSIS_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, ANALYSIS_W, ANALYSIS_H);
    return ctx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H).data;
  }, []);

  // ── Dart analysis ──────────────────────────────────────────────────────────

  const analyzeDartLanding = useCallback(() => {
    const before = preMotionFrameRef.current;
    const after = captureFrame();
    const video = videoRef.current;
    if (!before || !after || !video) return;

    const centroid = findCentroid(before, after, ANALYSIS_W, ANALYSIS_H);
    if (!centroid) return;

    // Scale analysis-canvas coords → native video coords (for overlay)
    const scaleX = video.videoWidth / ANALYSIS_W;
    const scaleY = video.videoHeight / ANALYSIS_H;
    const pixelX = centroid.x * scaleX;
    const pixelY = centroid.y * scaleY;

    const board = mapToBoard(centroid.x, centroid.y, ANALYSIS_W, ANALYSIS_H, radiusFraction);
    // Reject if the centroid is clearly outside the board and signal is weak
    if (board.ring === 'miss' && centroid.totalWeight < MIN_DART_WEIGHT * 3) return;

    const idx = detectedDartsRef.current.length as 0 | 1 | 2;
    if (idx >= 3) return;

    const dart: DetectedDart = { index: idx, pixelX, pixelY, ...board };
    detectedDartsRef.current = [...detectedDartsRef.current, dart];
    setDetectedDarts([...detectedDartsRef.current]);
    setStatus('waiting');

    onDartDetected?.(dart);
    void broadcastEvent('dart_detected', {
      dartIndex: dart.index,
      sector: dart.sector,
      ring: dart.ring,
      score: dart.score,
      confidence: dart.confidence,
    });

    if (detectedDartsRef.current.length === 3) {
      const all = detectedDartsRef.current;
      onRoundComplete?.(all);
      void broadcastEvent('round_complete', {
        darts: all.map(d => ({ score: d.score, ring: d.ring, sector: d.sector })),
        total: all.reduce((s, d) => s + d.score, 0),
      });
    }
  }, [captureFrame, radiusFraction, onDartDetected, onRoundComplete, broadcastEvent]);

  // ── Detection loop ─────────────────────────────────────────────────────────

  const runTick = useCallback(() => {
    const current = captureFrame();
    if (!current) return;

    const prev = prevFrameRef.current;
    prevFrameRef.current = current;
    if (!prev || prev.length !== current.length) return;

    const diff = computeMeanDiff(prev, current);
    const isMoving = diff > MOTION_THRESHOLD;

    if (isMoving) {
      if (!isMotionRef.current) {
        // Motion just started — save pre-motion frame (the prev frame, before arm entered)
        preMotionFrameRef.current = prev;
        isMotionRef.current = true;
        setStatus('motion');
      }
      // Reset settle timer while motion continues
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        isMotionRef.current = false;
        setStatus('settled');
        analyzeDartLanding();
      }, SETTLE_MS);
    }
  }, [captureFrame, analyzeDartLanding]);

  // ── Camera lifecycle ───────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    if (cameraActive) return;
    setStatus('starting');
    setError(null);

    // iOS Safari rejects getUserMedia if it can't satisfy all constraints at once.
    // Try progressively simpler sets so we always get a stream if permission is granted.
    const constraintSets: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: 'environment' } },
      { video: true },
    ];

    let stream: MediaStream | null = null;
    let lastErr: unknown;

    for (const constraints of constraintSets) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastErr = err;
        // User denied permission — no point trying simpler constraints
        if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) break;
      }
    }

    if (!stream) {
      setStatus('off');
      const err = lastErr;
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError(err instanceof Error ? err.message : 'Camera unavailable');
      }
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    // videoRef is always mounted in the DOM (scorer-camera.tsx renders it unconditionally)
    // so this should never be null, but guard just in case
    if (!video) {
      stream.getTracks().forEach(t => t.stop());
      setStatus('off');
      setError('Camera not ready — please reload and try again.');
      return;
    }

    video.srcObject = stream;

    // On iOS, explicit play() called after an awaited async call breaks the
    // user-gesture chain and is silently refused. Instead we rely on the
    // autoPlay + playsInline + muted attributes on the <video> element and
    // wait for the 'playing' event with a timeout fallback.
    await new Promise<void>((resolve) => {
      const onPlaying = () => { video.removeEventListener('playing', onPlaying); resolve(); };
      video.addEventListener('playing', onPlaying);

      // Fallback: if playing never fires (e.g. stream attached but not started),
      // try play() once and resolve regardless after a short delay.
      setTimeout(() => {
        video.removeEventListener('playing', onPlaying);
        video.play().catch(() => { /* ignore — autoPlay should cover it */ });
        resolve();
      }, 1500);
    });

    setCameraActive(true);
    setStatus('waiting');
    captureIntervalRef.current = setInterval(runTick, CAPTURE_INTERVAL_MS);
  }, [cameraActive, runTick]);

  const stopCamera = useCallback(() => {
    if (captureIntervalRef.current) { clearInterval(captureIntervalRef.current); captureIntervalRef.current = null; }
    if (settleTimerRef.current) { clearTimeout(settleTimerRef.current); settleTimerRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    isMotionRef.current = false;
    prevFrameRef.current = null;
    preMotionFrameRef.current = null;
    setCameraActive(false);
    setStatus('off');
  }, []);

  const resetRound = useCallback(() => {
    detectedDartsRef.current = [];
    setDetectedDarts([]);
    prevFrameRef.current = null;
    preMotionFrameRef.current = null;
    isMotionRef.current = false;
    if (settleTimerRef.current) { clearTimeout(settleTimerRef.current); settleTimerRef.current = null; }
    if (cameraActive) setStatus('waiting');
  }, [cameraActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      void stopSession();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    videoRef,
    cameraActive,
    startCamera,
    stopCamera,
    status,
    error,
    radiusFraction,
    setRadiusFraction,
    detectedDarts,
    resetRound,
    sessionCode,
    startSession,
    stopSession,
    broadcastEvent,
  };
}
