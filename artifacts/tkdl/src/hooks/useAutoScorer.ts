import { useRef, useState, useCallback, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AutoScorerStatus =
  | 'off'
  | 'starting'
  | 'waiting'
  | 'motion'
  | 'settled';

export interface DetectedDart {
  index: 0 | 1 | 2;
  sector: number;
  ring: 'bull' | 'outer_bull' | 'single' | 'triple' | 'double' | 'miss';
  score: number;
  confidence: number;
  pixelX: number;
  pixelY: number;
}

export interface DetectedBoard {
  cx: number;  // board centre x in analysis-frame pixels
  cy: number;  // board centre y in analysis-frame pixels
  r: number;   // board radius in analysis-frame pixels
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

const CALIBRATION_KEY    = 'tkdl_scorer_radius';
const ZOOM_KEY           = 'tkdl_scorer_zoom';
const BOARD_CENTER_KEY   = 'tkdl_scorer_board_center';   // JSON DetectedBoard

const ANALYSIS_W          = 320;
const ANALYSIS_H          = 240;
const MOTION_THRESHOLD    = 12;    // mean-pixel-diff to call it motion
const SETTLE_MS           = 1500;  // ms of no motion before analysing
const STABLE_MS           = 3000;  // ms of no motion before treating frame as clean baseline
const CAPTURE_INTERVAL_MS = 300;

// OpenCV analysis constants
const CV_DIFF_THRESHOLD  = 30;    // per-pixel brightness diff (0-255) to call it changed
const MIN_CONTOUR_AREA   = 40;    // px² in analysis frame — smaller = noise, larger = dart

// Fallback (plain JS) constants — used while OpenCV is still loading
const FALLBACK_DIFF_THRESHOLD = 25;
const FALLBACK_MIN_WEIGHT     = 2500;

// ── Board geometry ─────────────────────────────────────────────────────────────

function mapToBoard(
  px: number, py: number,
  board: DetectedBoard,
): Pick<DetectedDart, 'sector' | 'ring' | 'score' | 'confidence'> {
  const dx  = px - board.cx;
  const dy  = py - board.cy;
  const nd  = Math.sqrt(dx * dx + dy * dy) / board.r;

  if (nd < RING.bull)      return { sector: 50, ring: 'bull',       score: 50, confidence: 0.95 };
  if (nd < RING.outerBull) return { sector: 25, ring: 'outer_bull', score: 25, confidence: 0.90 };
  if (nd > 1.1)            return { sector: 0,  ring: 'miss',       score: 0,  confidence: 0.70 };

  // atan2(dx, -dy) = 0 at top, positive CW — matches dartboard layout
  const boardAngle = ((Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI));
  const sectorIdx  = Math.floor(boardAngle / (2 * Math.PI / 20)) % 20;
  const sector     = SECTORS[sectorIdx];

  let ring: DetectedDart['ring'];
  let score: number;
  if      (nd < RING.tripleInner) { ring = 'single'; score = sector; }
  else if (nd < RING.tripleOuter) { ring = 'triple'; score = sector * 3; }
  else if (nd < RING.doubleInner) { ring = 'single'; score = sector; }
  else                            { ring = 'double'; score = sector * 2; }

  const distFromBoundary = Math.min(
    Math.abs(nd - RING.bull), Math.abs(nd - RING.outerBull),
    Math.abs(nd - RING.tripleInner), Math.abs(nd - RING.tripleOuter),
    Math.abs(nd - RING.doubleInner), Math.abs(nd - 1.0),
  );
  return { sector, ring, score, confidence: Math.min(0.95, 0.55 + distFromBoundary * 3) };
}

// ── OpenCV helpers ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCv(): any | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cv = (window as any).cv;
  return (cv && typeof cv.Mat === 'function') ? cv : null;
}

function loadOpenCV(): void {
  if (document.getElementById('tkdl-opencv')) return;
  const s = document.createElement('script');
  s.id  = 'tkdl-opencv';
  s.src = 'https://docs.opencv.org/4.8.0/opencv.js';
  s.async = true;
  document.head.appendChild(s);
}

// Use OpenCV to find the dart's position in the diff between baseline and current frame.
// Returns analysis-frame pixel coords of the dart centroid, or null if no dart found.
function analyzeWithOpenCV(
  before: Uint8ClampedArray,
  after:  Uint8ClampedArray,
  w: number, h: number,
  board: DetectedBoard,
): { x: number; y: number } | null {
  const cv = getCv();
  if (!cv) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bMat: any, aMat: any, diff: any, gray: any, thresh: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kernel: any, boardMask: any, masked: any, contours: any, hierarchy: any;

  try {
    bMat      = cv.matFromImageData(new ImageData(new Uint8ClampedArray(before), w, h));
    aMat      = cv.matFromImageData(new ImageData(new Uint8ClampedArray(after),  w, h));
    diff      = new cv.Mat();
    gray      = new cv.Mat();
    thresh    = new cv.Mat();
    kernel    = cv.Mat.ones(3, 3, cv.CV_8U);
    boardMask = cv.Mat.zeros(h, w, cv.CV_8UC1);
    masked    = new cv.Mat();
    contours  = new cv.MatVector();
    hierarchy = new cv.Mat();

    // 1. Absolute difference between clean baseline and current frame
    cv.absdiff(bMat, aMat, diff);

    // 2. Convert to greyscale (we only care about brightness change, not colour)
    cv.cvtColor(diff, gray, cv.COLOR_RGBA2GRAY);

    // 3. Threshold: pixels that changed by less than CV_DIFF_THRESHOLD → 0
    cv.threshold(gray, thresh, CV_DIFF_THRESHOLD, 255, cv.THRESH_BINARY);

    // 4. Morphological opening: erode then dilate.
    //    This removes isolated noise pixels while preserving dart-sized blobs.
    cv.morphologyEx(thresh, thresh, cv.MORPH_OPEN, kernel);

    // 5. Mask to the board circle — ignore everything outside the ring
    cv.circle(
      boardMask,
      new cv.Point(Math.round(board.cx), Math.round(board.cy)),
      Math.round(board.r),
      new cv.Scalar(255), -1,
    );
    cv.bitwise_and(thresh, boardMask, masked);

    // 6. Find connected regions (contours) of changed pixels
    cv.findContours(masked, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // 7. Pick the largest contour (most likely the dart)
    let bestIdx = -1, bestArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const a = cv.contourArea(contours.get(i));
      if (a > bestArea) { bestArea = a; bestIdx = i; }
    }

    if (bestIdx < 0 || bestArea < MIN_CONTOUR_AREA) return null;

    // 8. Centroid of the dart blob
    const M = cv.moments(contours.get(bestIdx));
    if (M.m00 === 0) return null;

    return { x: M.m10 / M.m00, y: M.m01 / M.m00 };

  } catch {
    return null;
  } finally {
    // MUST delete all Mats to avoid WASM heap leaks
    bMat?.delete(); aMat?.delete(); diff?.delete(); gray?.delete();
    thresh?.delete(); kernel?.delete(); boardMask?.delete(); masked?.delete();
    contours?.delete(); hierarchy?.delete();
  }
}

// Plain-JS fallback — used while OpenCV.js is still downloading.
// Finds the weighted centroid of changed pixels inside the board circle.
function findCentroidFallback(
  before: Uint8ClampedArray,
  after:  Uint8ClampedArray,
  w: number, h: number,
  board: DetectedBoard,
): { x: number; y: number } | null {
  const rSq = board.r * board.r;
  let sumX = 0, sumY = 0, total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - board.cx, dy = y - board.cy;
      if (dx * dx + dy * dy > rSq) continue;
      const i  = (y * w + x) * 4;
      const wt = (Math.abs(after[i] - before[i]) + Math.abs(after[i+1] - before[i+1]) + Math.abs(after[i+2] - before[i+2])) / 3;
      if (wt > FALLBACK_DIFF_THRESHOLD) { sumX += x * wt; sumY += y * wt; total += wt; }
    }
  }
  if (total < FALLBACK_MIN_WEIGHT) return null;
  return { x: sumX / total, y: sumY / total };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAutoScorer({ onDartDetected, onRoundComplete }: UseAutoScorerOptions = {}) {
  const videoRef          = useRef<HTMLVideoElement>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const analysisCanvas    = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const prevFrameRef      = useRef<Uint8ClampedArray | null>(null);
  const preMotionFrameRef = useRef<Uint8ClampedArray | null>(null);
  const stableBaselineRef = useRef<Uint8ClampedArray | null>(null);
  const lastMotionTimeRef = useRef<number>(Date.now());
  const isMotionRef       = useRef(false);
  const settleTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureIntervalRef= useRef<ReturnType<typeof setInterval> | null>(null);
  const detectedDartsRef  = useRef<DetectedDart[]>([]);
  const sessionCodeRef    = useRef<string | null>(null);
  const detectedBoardRef  = useRef<DetectedBoard | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [status,       setStatus      ] = useState<AutoScorerStatus>('off');
  const [error,        setError       ] = useState<string | null>(null);
  const [detectedDarts,setDetectedDarts] = useState<DetectedDart[]>([]);
  const [sessionCode,  setSessionCode ] = useState<string | null>(null);
  const [cvReady,      setCvReady     ] = useState(false);
  const [detectedBoard,setDetectedBoardState] = useState<DetectedBoard | null>(null);

  const [radiusFraction, setRadiusFractionState] = useState<number>(() => {
    try { const v = Number(localStorage.getItem(CALIBRATION_KEY)); return v > 0 ? v : 0.42; }
    catch { return 0.42; }
  });
  const [zoomLevel, setZoomLevelState] = useState<number>(() => {
    try { const v = Number(localStorage.getItem(ZOOM_KEY)); return v >= 1 ? v : 1; }
    catch { return 1; }
  });
  const zoomRef = useRef<number>(1);

  // ── OpenCV loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    loadOpenCV();
    // Poll until the WASM runtime is initialised (cv.Mat becomes a constructor)
    const iv = setInterval(() => {
      if (getCv()) { setCvReady(true); clearInterval(iv); }
    }, 500);
    return () => clearInterval(iv);
  }, []);

  // Restore previously-detected board position from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BOARD_CENTER_KEY);
      if (saved) {
        const board = JSON.parse(saved) as DetectedBoard;
        if (board.cx > 0 && board.cy > 0 && board.r > 0) {
          detectedBoardRef.current = board;
          setDetectedBoardState(board);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // ── Calibration ────────────────────────────────────────────────────────────

  const setRadiusFraction = useCallback((f: number) => {
    const c = Math.max(0.15, Math.min(0.65, f));
    setRadiusFractionState(c);
    try { localStorage.setItem(CALIBRATION_KEY, String(c)); } catch { /* ignore */ }
    // If we have a detected board, update its radius too (allows fine-tuning)
    if (detectedBoardRef.current) {
      const updated = { ...detectedBoardRef.current, r: c * Math.min(ANALYSIS_W, ANALYSIS_H) };
      detectedBoardRef.current = updated;
      setDetectedBoardState(updated);
      try { localStorage.setItem(BOARD_CENTER_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
    }
  }, []);

  const setZoomLevel = useCallback((z: number) => {
    const c = Math.max(1, Math.min(4, Math.round(z * 10) / 10));
    zoomRef.current = c;
    setZoomLevelState(c);
    try { localStorage.setItem(ZOOM_KEY, String(c)); } catch { /* ignore */ }
  }, []);

  useEffect(() => { zoomRef.current = zoomLevel; }, [zoomLevel]);

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
    } catch { /* non-fatal */ }
  }, []);

  const startSession = useCallback(async (): Promise<string | null> => {
    try {
      const res  = await fetch('/api/scorer/sessions', {
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
    canvas.width  = ANALYSIS_W;
    canvas.height = ANALYSIS_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const z  = zoomRef.current;
    const sw = video.videoWidth  / z;
    const sh = video.videoHeight / z;
    const sx = (video.videoWidth  - sw) / 2;
    const sy = (video.videoHeight - sh) / 2;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, ANALYSIS_W, ANALYSIS_H);
    return ctx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H).data;
  }, []);

  // ── Board detection ─────────────────────────────────────────────────────────

  // Returns the board to use for analysis: detected board, or a centred fallback.
  const getBoard = useCallback((): DetectedBoard => {
    if (detectedBoardRef.current) return detectedBoardRef.current;
    return {
      cx: ANALYSIS_W / 2,
      cy: ANALYSIS_H / 2,
      r:  radiusFraction * Math.min(ANALYSIS_W, ANALYSIS_H),
    };
  }, [radiusFraction]);

  // Run HoughCircles on the current camera frame to auto-detect the board circle.
  const detectBoard = useCallback(() => {
    const cv = getCv();
    if (!cv) return;
    const frame = captureFrame();
    if (!frame) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let src: any, gray: any, circles: any;
    try {
      src     = cv.matFromImageData(new ImageData(new Uint8ClampedArray(frame), ANALYSIS_W, ANALYSIS_H));
      gray    = new cv.Mat();
      circles = new cv.Mat();

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      // Blur reduces false edges caused by board graphics/lighting
      cv.GaussianBlur(gray, gray, new cv.Size(9, 9), 2, 2);

      // HoughCircles parameters tuned for a dartboard filling 30-90% of the frame:
      //   dp=1        — accumulator resolution equals image resolution
      //   minDist=50  — only one board expected, so any centre distance is fine
      //   param1=80   — upper Canny threshold
      //   param2=22   — accumulator threshold: lower = less strict (more circles)
      //   minRadius   — board must be at least 30% of analysis frame height
      //   maxRadius   — board at most 90% of analysis frame height
      cv.HoughCircles(
        gray, circles, cv.HOUGH_GRADIENT,
        1, 50, 80, 22,
        Math.floor(ANALYSIS_H * 0.15),
        Math.floor(ANALYSIS_H * 0.55),
      );

      if (circles.cols > 0) {
        const cx = circles.data32F[0];
        const cy = circles.data32F[1];
        const r  = circles.data32F[2];
        const board: DetectedBoard = { cx, cy, r };

        detectedBoardRef.current = board;
        setDetectedBoardState(board);

        // Sync radiusFraction so manual +/- controls stay consistent
        const frac = Math.max(0.15, Math.min(0.65, r / Math.min(ANALYSIS_W, ANALYSIS_H)));
        setRadiusFractionState(frac);

        try {
          localStorage.setItem(BOARD_CENTER_KEY, JSON.stringify(board));
          localStorage.setItem(CALIBRATION_KEY, String(frac));
        } catch { /* ignore */ }
      }
    } catch { /* ignore — if detection fails, user can retry */ }
    finally { src?.delete(); gray?.delete(); circles?.delete(); }
  }, [captureFrame]);

  // ── Dart analysis ──────────────────────────────────────────────────────────

  const analyzeDartLanding = useCallback(() => {
    // Prefer the long-stable baseline (arm-free clean board) over the pre-motion snapshot
    const before = stableBaselineRef.current ?? preMotionFrameRef.current;
    const after  = captureFrame();
    if (!before || !after) return;

    const board = getBoard();
    const cv    = getCv();

    // Use OpenCV pipeline if ready, otherwise fall back to plain-JS centroid
    const point = cv
      ? analyzeWithOpenCV(before, after, ANALYSIS_W, ANALYSIS_H, board)
      : findCentroidFallback(before, after, ANALYSIS_W, ANALYSIS_H, board);

    if (!point) return;

    const boardResult = mapToBoard(point.x, point.y, board);
    if (boardResult.ring === 'miss') return; // don't report misses as dart events

    // Scale analysis coords → native video pixel coords (for the overlay dot)
    const video  = videoRef.current;
    const scaleX = (video?.videoWidth  ?? ANALYSIS_W) / ANALYSIS_W;
    const scaleY = (video?.videoHeight ?? ANALYSIS_H) / ANALYSIS_H;

    const idx = detectedDartsRef.current.length as 0 | 1 | 2;
    if (idx >= 3) return;

    const dart: DetectedDart = {
      index: idx,
      pixelX: point.x * scaleX,
      pixelY: point.y * scaleY,
      ...boardResult,
    };
    detectedDartsRef.current = [...detectedDartsRef.current, dart];
    setDetectedDarts([...detectedDartsRef.current]);
    setStatus('waiting');

    // Update the stable baseline to include this dart so the next throw
    // diffs against a frame that already has the previous dart(s) in it.
    stableBaselineRef.current = after;

    onDartDetected?.(dart);
    void broadcastEvent('dart_detected', {
      dartIndex: dart.index, sector: dart.sector,
      ring: dart.ring, score: dart.score, confidence: dart.confidence,
    });

    if (detectedDartsRef.current.length === 3) {
      const all = detectedDartsRef.current;
      onRoundComplete?.(all);
      void broadcastEvent('round_complete', {
        darts: all.map(d => ({ score: d.score, ring: d.ring, sector: d.sector })),
        total: all.reduce((s, d) => s + d.score, 0),
      });
    }
  }, [captureFrame, getBoard, onDartDetected, onRoundComplete, broadcastEvent]);

  // ── Detection loop ─────────────────────────────────────────────────────────

  const runTick = useCallback(() => {
    const current = captureFrame();
    if (!current) return;

    const prev = prevFrameRef.current;
    prevFrameRef.current = current;
    if (!prev || prev.length !== current.length) return;

    // Mean per-channel diff across the whole frame (motion detection only —
    // dart analysis is restricted to the board circle)
    let sum = 0;
    for (let i = 0; i < prev.length; i += 4) {
      sum += Math.abs(current[i] - prev[i]) + Math.abs(current[i+1] - prev[i+1]) + Math.abs(current[i+2] - prev[i+2]);
    }
    const meanDiff = sum / (prev.length / 4 * 3);
    const isMoving = meanDiff > MOTION_THRESHOLD;

    if (isMoving) {
      lastMotionTimeRef.current = Date.now();
      if (!isMotionRef.current) {
        // Motion just started — save the frame immediately before it started
        preMotionFrameRef.current = prev;
        isMotionRef.current = true;
        setStatus('motion');
      }
      // Extend the settle timer while motion continues
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        isMotionRef.current = false;
        setStatus('settled');
        analyzeDartLanding();
      }, SETTLE_MS);
    } else {
      // Scene is still — update the clean baseline once it has been calm for STABLE_MS.
      // This ensures the baseline never includes the player's arm.
      if (Date.now() - lastMotionTimeRef.current > STABLE_MS) {
        stableBaselineRef.current = current;
      }
    }
  }, [captureFrame, analyzeDartLanding]);

  // ── Camera lifecycle ───────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    if (cameraActive) return;
    setStatus('starting');
    setError(null);

    const constraintSets: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: 'environment' } },
      { video: true },
    ];

    let stream: MediaStream | null = null;
    let lastErr: unknown;
    for (const constraints of constraintSets) {
      try { stream = await navigator.mediaDevices.getUserMedia(constraints); break; }
      catch (err) {
        lastErr = err;
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
    if (!video) {
      stream.getTracks().forEach(t => t.stop());
      setStatus('off');
      setError('Camera not ready — please reload and try again.');
      return;
    }

    video.srcObject = stream;

    await new Promise<void>((resolve) => {
      const onPlaying = () => { video.removeEventListener('playing', onPlaying); resolve(); };
      video.addEventListener('playing', onPlaying);
      setTimeout(() => {
        video.removeEventListener('playing', onPlaying);
        video.play().catch(() => { /* autoPlay covers it */ });
        resolve();
      }, 1500);
    });

    setCameraActive(true);
    setStatus('waiting');
    captureIntervalRef.current = setInterval(runTick, CAPTURE_INTERVAL_MS);

    // Auto-detect the board a couple of seconds after the camera stabilises
    setTimeout(() => detectBoard(), 2500);
  }, [cameraActive, runTick, detectBoard]);

  const stopCamera = useCallback(() => {
    if (captureIntervalRef.current) { clearInterval(captureIntervalRef.current); captureIntervalRef.current = null; }
    if (settleTimerRef.current)     { clearTimeout(settleTimerRef.current);      settleTimerRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    isMotionRef.current          = false;
    prevFrameRef.current         = null;
    preMotionFrameRef.current    = null;
    stableBaselineRef.current    = null;
    setCameraActive(false);
    setStatus('off');
  }, []);

  const resetRound = useCallback(() => {
    detectedDartsRef.current = [];
    setDetectedDarts([]);
    prevFrameRef.current      = null;
    preMotionFrameRef.current = null;
    stableBaselineRef.current = null;
    isMotionRef.current       = false;
    lastMotionTimeRef.current = Date.now();
    if (settleTimerRef.current) { clearTimeout(settleTimerRef.current); settleTimerRef.current = null; }
    if (cameraActive) setStatus('waiting');
  }, [cameraActive]);

  useEffect(() => {
    return () => { stopCamera(); void stopSession(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Exposed values ─────────────────────────────────────────────────────────

  // Normalised board centre (0-1) for the overlay to draw the ring at the right position
  const boardCenterX = detectedBoard ? detectedBoard.cx / ANALYSIS_W : 0.5;
  const boardCenterY = detectedBoard ? detectedBoard.cy / ANALYSIS_H : 0.5;

  return {
    videoRef,
    cameraActive,
    startCamera,
    stopCamera,
    status,
    error,
    radiusFraction,
    setRadiusFraction,
    zoomLevel,
    setZoomLevel,
    detectedDarts,
    resetRound,
    sessionCode,
    startSession,
    stopSession,
    broadcastEvent,
    // Board detection
    cvReady,
    boardDetected: !!detectedBoard,
    boardCenterX,
    boardCenterY,
    detectBoard,
  };
}
